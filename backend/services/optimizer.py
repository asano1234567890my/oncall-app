# backend/services/optimizer.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from ortools.sat.python import cp_model
import calendar
import datetime


@dataclass
class ObjectiveWeights:
    month_fairness: int = 100
    past_sat_gap: int = 10
    past_sunhol_gap: int = 5


class OnCallOptimizer:
    """
    仕様復帰版（最小変更で拡張）
    - 平日: 当直1
    - 土曜: 当直1
    - 日祝: 日直1 + 当直1（同日兼務不可）
    - 祝日前夜: TODO（現状は未実装）
    ハード制約:
    - 枠充足
    - 日祝同日兼務禁止
    - 個別不可日
    - 固定不可曜日（毎週固定）
    - 4日間隔（最低4日空ける、厳密）
    - 月跨ぎ4日間隔（厳密）
    - 月間スコア上下限（0.5〜4.5）
    - 土曜当直 月1回まで
    目的関数:
    - 当月総スコア公平（max-min）
    - 過去土曜担当回数ギャップ補正
    - 過去日祝担当回数ギャップ補正
    """

    # スコア重み（*10して整数）
    W_WEEKDAY_NIGHT = 10  # 1.0
    W_SAT_NIGHT = 15      # 1.5
    W_SUNHOL_DAY = 5      # 0.5
    W_SUNHOL_NIGHT = 10   # 1.0

    def __init__(
        self,
        num_doctors: int,
        year: int,
        month: int,
        holidays: Optional[List[int]] = None,
        unavailable: Optional[Dict[int, List[int]]] = None,
        fixed_unavailable_weekdays: Optional[Dict[int, List[int]]] = None,  # doctor -> [0..6]
        prev_month_worked_days: Optional[Dict[int, List[int]]] = None,      # doctor -> [day numbers in prev month]
        prev_month_last_day: Optional[int] = None,                          # 28/29/30/31
        score_min: float = 0.5,
        score_max: float = 4.5,
        past_sat_counts: Optional[List[int]] = None,     # len=num_doctors (or shorter -> missing treated as 0)
        past_sunhol_counts: Optional[List[int]] = None,  # len=num_doctors
        objective_weights: Optional[Dict[str, int]] = None,
    ):
        self.num_doctors = num_doctors
        self.year = year
        self.month = month
        self.num_days = calendar.monthrange(year, month)[1]

        self.holidays = holidays or []
        self.unavailable = unavailable or {}
        self.fixed_unavailable_weekdays = fixed_unavailable_weekdays or {}

        self.prev_month_worked_days = prev_month_worked_days or {}
        self.prev_month_last_day = prev_month_last_day  # Noneなら月跨ぎ制約はスキップ

        self.score_min_int = int(round(score_min * 10))
        self.score_max_int = int(round(score_max * 10))

        self.past_sat_counts = past_sat_counts or []
        self.past_sunhol_counts = past_sunhol_counts or []

        ow = objective_weights or {"month_fairness": 100, "past_sat_gap": 10, "past_sunhol_gap": 5}
        self.objective_weights = ObjectiveWeights(
            month_fairness=int(ow.get("month_fairness", 100)),
            past_sat_gap=int(ow.get("past_sat_gap", 10)),
            past_sunhol_gap=int(ow.get("past_sunhol_gap", 5)),
        )

        self.model = cp_model.CpModel()

        # decision vars
        self.night_shifts: Dict[Tuple[int, int], cp_model.IntVar] = {}
        self.day_shifts: Dict[Tuple[int, int], cp_model.IntVar] = {}
        self.work: Dict[Tuple[int, int], cp_model.IntVar] = {}

        # outputs
        self.doctor_scores: List[cp_model.IntVar] = []
        self.max_score: Optional[cp_model.IntVar] = None
        self.min_score: Optional[cp_model.IntVar] = None

    def is_holiday(self, day: int) -> bool:
        return day in self.holidays

    def is_saturday(self, day: int) -> bool:
        return datetime.date(self.year, self.month, day).weekday() == 5

    def is_sunday(self, day: int) -> bool:
        return datetime.date(self.year, self.month, day).weekday() == 6

    def is_sunday_or_holiday(self, day: int) -> bool:
        # 祝日 or 日曜なら「日祝扱い」
        # NOTE: 「祝日前夜は平日扱い」はTODO
        return self.is_sunday(day) or self.is_holiday(day)

    def _get_past(self, arr: List[int], d: int) -> int:
        return arr[d] if d < len(arr) else 0

    def build_model(self) -> None:
        doctors = range(self.num_doctors)
        days = range(1, self.num_days + 1)

        # 1) vars
        for d in doctors:
            for day in days:
                self.night_shifts[(d, day)] = self.model.NewBoolVar(f"night_d{d}_day{day}")
                self.day_shifts[(d, day)] = self.model.NewBoolVar(f"day_d{d}_day{day}")
                self.work[(d, day)] = self.model.NewBoolVar(f"work_d{d}_day{day}")

                # work = night + day  （日祝以外は day=0 にするので自然に nightだけ）
                self.model.Add(self.work[(d, day)] == self.night_shifts[(d, day)] + self.day_shifts[(d, day)])

        # 2) slot fulfillment
        for day in days:
            # 毎日：当直1
            self.model.AddExactlyOne(self.night_shifts[(d, day)] for d in doctors)

            if self.is_sunday_or_holiday(day):
                # 日祝：日直1
                self.model.AddExactlyOne(self.day_shifts[(d, day)] for d in doctors)
            else:
                # 平日/土曜：日直は0
                for d in doctors:
                    self.model.Add(self.day_shifts[(d, day)] == 0)

        # 3) hard: 日祝同日兼務禁止（平日/土曜は day=0 なので常にOK）
        for d in doctors:
            for day in days:
                self.model.Add(self.night_shifts[(d, day)] + self.day_shifts[(d, day)] <= 1)

        # 4) hard: 個別不可日
        for d, bad_days in self.unavailable.items():
            for day in bad_days:
                if 1 <= day <= self.num_days:
                    self.model.Add(self.night_shifts[(d, day)] == 0)
                    self.model.Add(self.day_shifts[(d, day)] == 0)

        # 5) hard: 固定不可曜日（毎週）
        for d, bad_wds in self.fixed_unavailable_weekdays.items():
            bad_wds_set = set(bad_wds)
            for day in days:
                wd = datetime.date(self.year, self.month, day).weekday()  # 0=Mon..6=Sun
                if wd in bad_wds_set:
                    self.model.Add(self.night_shifts[(d, day)] == 0)
                    self.model.Add(self.day_shifts[(d, day)] == 0)

        # 6) hard: 4日間隔（勤務したら次の4日(1..4)は勤務禁止）
        for d in doctors:
            for day in days:
                for k in range(1, 5):
                    if day + k <= self.num_days:
                        # work[day] + work[day+k] <= 1
                        self.model.Add(self.work[(d, day)] + self.work[(d, day + k)] <= 1)

        # 7) hard: 月跨ぎ4日間隔（前月末勤務がある場合）
        # prev_month_worked_days: doctor -> [prev_day]
        # prev_month_last_day: 28/29/30/31
        if self.prev_month_last_day is not None:
            prev_last = int(self.prev_month_last_day)
            for d, prev_days in self.prev_month_worked_days.items():
                for prev_day in prev_days:
                    # 当月1日までの空き日数
                    # prev_last=31, prev_day=30 -> dist=2? ではなく「経過日数」を明確に
                    # 仕様は「最低4日空ける」なので、
                    # 前月の勤務日が月末に近いほど当月の初日が禁止される。
                    # dist_to_start = (prev_last - prev_day) + 1  （前月勤務日の翌日を1と数える）
                    dist_to_start = (prev_last - int(prev_day)) + 1
                    if 1 <= dist_to_start <= 4:
                        block_until = 5 - dist_to_start  # dist=1 -> 1..4禁止, dist=4 -> 1..1禁止
                        for day in range(1, block_until + 1):
                            if 1 <= day <= self.num_days:
                                self.model.Add(self.work[(d, day)] == 0)

        # 8) hard: 土曜当直 月1回まで
        saturdays = [day for day in days if self.is_saturday(day)]
        for d in doctors:
            self.model.Add(sum(self.night_shifts[(d, day)] for day in saturdays) <= 1)

        # 9) hard: 月間スコア上下限（*10整数）
        doctor_scores: List[cp_model.IntVar] = []
        for d in doctors:
            score_expr = 0
            for day in days:
                if self.is_sunday_or_holiday(day):
                    score_expr += self.day_shifts[(d, day)] * self.W_SUNHOL_DAY
                    score_expr += self.night_shifts[(d, day)] * self.W_SUNHOL_NIGHT
                elif self.is_saturday(day):
                    score_expr += self.night_shifts[(d, day)] * self.W_SAT_NIGHT
                else:
                    score_expr += self.night_shifts[(d, day)] * self.W_WEEKDAY_NIGHT

            doc_score = self.model.NewIntVar(0, 2000, f"score_d{d}")
            self.model.Add(doc_score == score_expr)

            # enforce bounds
            self.model.Add(doc_score >= self.score_min_int)
            self.model.Add(doc_score <= self.score_max_int)

            doctor_scores.append(doc_score)

        self.doctor_scores = doctor_scores

        # 10) 목적: 公平性 + 過去補正
        max_score = self.model.NewIntVar(0, 2000, "max_score")
        min_score = self.model.NewIntVar(0, 2000, "min_score")
        self.model.AddMaxEquality(max_score, doctor_scores)
        self.model.AddMinEquality(min_score, doctor_scores)
        fairness = self.model.NewIntVar(0, 2000, "fairness")
        self.model.Add(fairness == max_score - min_score)

        # 過去土曜補正： (過去 + 今月土曜当直回数) のmax-min
        sat_totals: List[cp_model.IntVar] = []
        for d in doctors:
            sat_count = self.model.NewIntVar(0, 10, f"sat_count_d{d}")
            self.model.Add(sat_count == sum(self.night_shifts[(d, day)] for day in saturdays))

            base = self._get_past(self.past_sat_counts, d)
            total = self.model.NewIntVar(0, 999, f"sat_total_d{d}")
            self.model.Add(total == sat_count + base)
            sat_totals.append(total)

        sat_max = self.model.NewIntVar(0, 999, "sat_max")
        sat_min = self.model.NewIntVar(0, 999, "sat_min")
        self.model.AddMaxEquality(sat_max, sat_totals)
        self.model.AddMinEquality(sat_min, sat_totals)
        sat_gap = self.model.NewIntVar(0, 999, "sat_gap")
        self.model.Add(sat_gap == sat_max - sat_min)

        # 過去日祝補正： (過去 + 今月日祝担当回数) のmax-min
        sunhol_days = [day for day in days if self.is_sunday_or_holiday(day)]
        sunhol_totals: List[cp_model.IntVar] = []
        for d in doctors:
            # 日祝の担当回数：日直 + 当直 を回数として合算（仕様は「日祝担当回数」補正なのでここはTODOで見直し可）
            sh_count = self.model.NewIntVar(0, 62, f"sunhol_count_d{d}")
            self.model.Add(sh_count == sum(self.day_shifts[(d, day)] + self.night_shifts[(d, day)] for day in sunhol_days))

            base = self._get_past(self.past_sunhol_counts, d)
            total = self.model.NewIntVar(0, 999, f"sunhol_total_d{d}")
            self.model.Add(total == sh_count + base)
            sunhol_totals.append(total)

        sh_max = self.model.NewIntVar(0, 999, "sunhol_max")
        sh_min = self.model.NewIntVar(0, 999, "sunhol_min")
        self.model.AddMaxEquality(sh_max, sunhol_totals)
        self.model.AddMinEquality(sh_min, sunhol_totals)
        sunhol_gap = self.model.NewIntVar(0, 999, "sunhol_gap")
        self.model.Add(sunhol_gap == sh_max - sh_min)

        # Minimize（当月公平 > 過去土曜 > 過去日祝）
        w = self.objective_weights
        self.model.Minimize(
            w.month_fairness * fairness
            + w.past_sat_gap * sat_gap
            + w.past_sunhol_gap * sunhol_gap
        )

        self.max_score = max_score
        self.min_score = min_score

    def solve(self, time_limit_seconds: float = 10.0) -> Dict:
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(time_limit_seconds)

        status = solver.Solve(self.model)

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            schedule = []
            for day in range(1, self.num_days + 1):
                day_data = {
                    "day": day,
                    "is_sunhol": self.is_sunday_or_holiday(day),
                    "day_shift": None,
                    "night_shift": None,
                }

                night_doc = next(d for d in range(self.num_doctors) if solver.Value(self.night_shifts[(d, day)]))
                day_data["night_shift"] = night_doc

                if self.is_sunday_or_holiday(day):
                    day_doc = next(d for d in range(self.num_doctors) if solver.Value(self.day_shifts[(d, day)]))
                    day_data["day_shift"] = day_doc

                schedule.append(day_data)

            scores = {d: solver.Value(self.doctor_scores[d]) / 10.0 for d in range(self.num_doctors)}

            return {
                "success": True,
                "status": "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
                "schedule": schedule,
                "scores": scores,
            }

        return {
            "success": False,
            "message": "条件が厳しすぎて解が見つかりませんでした。休み希望などを減らしてください。",
        }


if __name__ == "__main__":
    # 簡易手動テスト
    test_holidays = [29]
    test_unavailable = {0: [1, 2, 3], 1: [29, 30]}
    test_fixed_weekdays = {2: [0]}  # doctor2 月曜不可
    optimizer = OnCallOptimizer(
        num_doctors=10,
        year=2024,
        month=4,
        holidays=test_holidays,
        unavailable=test_unavailable,
        fixed_unavailable_weekdays=test_fixed_weekdays,
        prev_month_worked_days={0: [30]},  # 前月末30日に勤務していた想定
        prev_month_last_day=31,
        score_min=0.5,
        score_max=4.5,
        past_sat_counts=[0] * 10,
        past_sunhol_counts=[0] * 10,
        objective_weights={"month_fairness": 100, "past_sat_gap": 10, "past_sunhol_gap": 5},
    )
    optimizer.build_model()
    print(optimizer.solve())