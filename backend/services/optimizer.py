# backend/services/optimizer.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Any

from ortools.sat.python import cp_model
import calendar
import datetime

@dataclass
class ObjectiveWeights:
    # スキーマから既に整数(100, 50など)で渡ってくるため、そのまま受け取る
    month_fairness: int = 100
    past_sat_gap: int = 10
    past_sunhol_gap: int = 5
    gap5: int = 100
    gap6: int = 50
    pre_clinic: int = 100
    sat_consec: int = 80
    score_balance: int = 30
    target: int = 10
    sunhol_3rd: int = 80

class OnCallOptimizer:
    """
    統合版仕様
    - 平日: 当直1 / 土曜: 当直1 / 日祝: 日直1 + 当直1（同日兼務不可）
    ハード制約:
    - 枠充足 / 日祝同日兼務禁止 / 個別不可日 / 固定不可曜日 / 4日間隔 / 月跨ぎ4日間隔 / 月間スコア上下限 / 土曜当直 月1回まで
    - [追加] 日直回数 上限2回
    - [追加] 研究日前日の勤務禁止
    ソフト制約（目的関数）:
    - 当月総スコア公平 / 過去ギャップ補正
    - [追加] gap5, gap6 回避
    - [追加] 外来前日の当直回避
    - [追加] 土曜2ヶ月連続回避
    """

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
        fixed_unavailable_weekdays: Optional[Dict[int, List[int]]] = None,
        prev_month_worked_days: Optional[Dict[int, List[int]]] = None,
        prev_month_last_day: Optional[int] = None,
        score_min: float = 0.5,
        score_max: float = 4.5,
        past_sat_counts: Optional[List[int]] = None,
        past_sunhol_counts: Optional[List[int]] = None,
        # --- 統合版仕様：追加パラメータ ---
        min_score_by_doctor: Optional[Dict[int, float]] = None,
        max_score_by_doctor: Optional[Dict[int, float]] = None,
        target_score_by_doctor: Optional[Dict[int, float]] = None,
        past_total_scores: Optional[Dict[int, float]] = None,
        sat_prev: Optional[Dict[int, bool]] = None,
        objective_weights: Optional[Dict[str, Any]] = None,
    ):
        self.num_doctors = num_doctors
        self.year = year
        self.month = month
        self.num_days = calendar.monthrange(year, month)[1]

        self.holidays = holidays or []
        self.unavailable = unavailable or {}
        self.fixed_unavailable_weekdays = fixed_unavailable_weekdays or {}
        
        self.prev_month_worked_days = prev_month_worked_days or {}
        self.prev_month_last_day = prev_month_last_day

        # 全体デフォルトスコア
        self.score_min_float = score_min
        self.score_max_float = score_max

        self.past_sat_counts = past_sat_counts or []
        self.past_sunhol_counts = past_sunhol_counts or []
        
        # 追加データ群
        self.min_score_by_doctor = min_score_by_doctor or {}
        self.max_score_by_doctor = max_score_by_doctor or {}
        self.target_score_by_doctor = target_score_by_doctor or {}
        self.past_total_scores = past_total_scores or {}
        self.sat_prev = sat_prev or {}
        
        # [バックエンド供給] 外来曜日のモック定義 (doctor_id -> [0=Mon..6=Sun])
        # TODO: 将来的にDB保持・UI連携。当面はコード上で定義。
        # 例：医師0は火曜(1)、医師1は水曜(2)が外来日とする。空ならペナルティ発生せず。
        self.clinic_weekdays = {0: [1], 1: [2]} 

        ow = objective_weights or {}
        self.objective_weights = ObjectiveWeights(
            month_fairness=int(ow.get("month_fairness", 100)),
            past_sat_gap=int(ow.get("past_sat_gap", 10)),
            past_sunhol_gap=int(ow.get("past_sunhol_gap", 5)),
            gap5=int(ow.get("gap5", 100)),
            gap6=int(ow.get("gap6", 50)),
            pre_clinic=int(ow.get("pre_clinic", 100)),
            sat_consec=int(ow.get("sat_consec", 80)),
            score_balance=int(ow.get("score_balance", 30)),
            target=int(ow.get("target", 10)),
            sunhol_3rd=int(ow.get("sunhol_3rd", 80)),
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
                self.model.Add(self.work[(d, day)] == self.night_shifts[(d, day)] + self.day_shifts[(d, day)])

        # 2) slot fulfillment
        for day in days:
            self.model.AddExactlyOne(self.night_shifts[(d, day)] for d in doctors)
            if self.is_sunday_or_holiday(day):
                self.model.AddExactlyOne(self.day_shifts[(d, day)] for d in doctors)
            else:
                for d in doctors:
                    self.model.Add(self.day_shifts[(d, day)] == 0)

        # 3) hard: 日祝同日兼務禁止
        for d in doctors:
            for day in days:
                self.model.Add(self.night_shifts[(d, day)] + self.day_shifts[(d, day)] <= 1)

        # 4) hard: 個別不可日
        for d, bad_days in self.unavailable.items():
            for day in bad_days:
                if 1 <= day <= self.num_days:
                    self.model.Add(self.work[(d, day)] == 0)

        # 5) hard: 固定不可曜日（毎週）+ 6) [追加] 研究日前日の勤務禁止
        for d, bad_wds in self.fixed_unavailable_weekdays.items():
            bad_wds_set = set(bad_wds)
            for day in days:
                wd = datetime.date(self.year, self.month, day).weekday()
                if wd in bad_wds_set:
                    # 研究日当日の勤務禁止
                    self.model.Add(self.work[(d, day)] == 0)
                    # 研究日前日の勤務禁止 (当月内のみ適用)
                    if day > 1:
                        self.model.Add(self.work[(d, day - 1)] == 0)

        # 7) hard: 4日間隔
        for d in doctors:
            for day in days:
                for k in range(1, 5):
                    if day + k <= self.num_days:
                        self.model.Add(self.work[(d, day)] + self.work[(d, day + k)] <= 1)

        # 8) hard: 月跨ぎ4日間隔
        if self.prev_month_last_day is not None:
            prev_last = int(self.prev_month_last_day)
            for d, prev_days in self.prev_month_worked_days.items():
                for prev_day in prev_days:
                    dist_to_start = (prev_last - int(prev_day)) + 1
                    if 1 <= dist_to_start <= 4:
                        block_until = 5 - dist_to_start
                        for day in range(1, block_until + 1):
                            if 1 <= day <= self.num_days:
                                self.model.Add(self.work[(d, day)] == 0)

        # 9) hard: 土曜当直 月1回まで
        saturdays = [day for day in days if self.is_saturday(day)]
        for d in doctors:
            self.model.Add(sum(self.night_shifts[(d, day)] for day in saturdays) <= 1)

        # 10) hard: [追加] 日直回数 上限2回
        sunhol_days = [day for day in days if self.is_sunday_or_holiday(day)]
        for d in doctors:
            self.model.Add(sum(self.day_shifts[(d, day)] for day in sunhol_days) <= 2)

        # 10.5) hard: 日祝勤務(日直+当直) 上限3回
        for d in doctors:
            self.model.Add(sum(self.day_shifts[(d, day)] + self.night_shifts[(d, day)] for day in sunhol_days) <= 3)

        # 11) hard: 月間スコア上下限（個別設定に対応）
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

            # 個別スコアが設定されていれば適用、なければ全体設定
            d_min = int(round(self.min_score_by_doctor.get(d, self.score_min_float) * 10))
            d_max = int(round(self.max_score_by_doctor.get(d, self.score_max_float) * 10))
            self.model.Add(doc_score >= d_min)
            self.model.Add(doc_score <= d_max)
            
            doctor_scores.append(doc_score)
            
        self.doctor_scores = doctor_scores

        # --- ここからソフト制約（目的関数） ---
        
        # A. gap5, gap6 回避ペナルティ
        gap5_vars = []
        gap6_vars = []
        for d in doctors:
            for day in days:
                if day + 5 <= self.num_days:
                    gap5_bool = self.model.NewBoolVar(f"gap5_d{d}_day{day}")
                    # 5日後に勤務したらペナルティ (和が2の時のみ gap5_bool が 1 になる)
                    self.model.Add(self.work[(d, day)] + self.work[(d, day + 5)] - 1 <= gap5_bool)
                    gap5_vars.append(gap5_bool)
                if day + 6 <= self.num_days:
                    gap6_bool = self.model.NewBoolVar(f"gap6_d{d}_day{day}")
                    self.model.Add(self.work[(d, day)] + self.work[(d, day + 6)] - 1 <= gap6_bool)
                    gap6_vars.append(gap6_bool)

        gap5_sum = self.model.NewIntVar(0, 1000, "gap5_sum")
        self.model.Add(gap5_sum == sum(gap5_vars))
        gap6_sum = self.model.NewIntVar(0, 1000, "gap6_sum")
        self.model.Add(gap6_sum == sum(gap6_vars))

        # B. 外来前日の当直回避ペナルティ
        pre_clinic_vars = []
        for d, clinic_wds in self.clinic_weekdays.items():
            c_wds_set = set(clinic_wds)
            for day in days:
                wd = datetime.date(self.year, self.month, day).weekday()
                if wd in c_wds_set and day > 1:
                    # 外来日の前日が当直(night)ならペナルティ加算
                    pre_clinic_vars.append(self.night_shifts[(d, day - 1)])

        pre_clinic_sum = self.model.NewIntVar(0, 1000, "pre_clinic_sum")
        self.model.Add(pre_clinic_sum == sum(pre_clinic_vars))

        # C. 土曜2ヶ月連続の回避
        sat_consec_vars = []
        for d in doctors:
            if self.sat_prev.get(d, False):
                sat_month_bool = self.model.NewBoolVar(f"sat_month_bool_d{d}")
                # 今月の土曜のいずれかで当直したら1
                self.model.AddMaxEquality(sat_month_bool, [self.night_shifts[(d, sat)] for sat in saturdays])
                sat_consec_vars.append(sat_month_bool)

        sat_consec_sum = self.model.NewIntVar(0, 1000, "sat_consec_sum")
        self.model.Add(sat_consec_sum == sum(sat_consec_vars))

        # D. 個別ターゲットへの近似ペナルティ
        target_penalties = []
        for d in doctors:
            if d in self.target_score_by_doctor:
                t_score = int(round(self.target_score_by_doctor[d] * 10))
                diff = self.model.NewIntVar(-2000, 2000, f"diff_target_d{d}")
                abs_diff = self.model.NewIntVar(0, 2000, f"abs_diff_target_d{d}")
                self.model.Add(diff == doctor_scores[d] - t_score)
                self.model.AddAbsEquality(abs_diff, diff)
                target_penalties.append(abs_diff)
        
        target_sum = self.model.NewIntVar(0, 10000, "target_sum")
        self.model.Add(target_sum == sum(target_penalties))

        # E. 当月公平・過去補正
        max_score = self.model.NewIntVar(0, 2000, "max_score")
        min_score = self.model.NewIntVar(0, 2000, "min_score")
        self.model.AddMaxEquality(max_score, doctor_scores)
        self.model.AddMinEquality(min_score, doctor_scores)
        fairness = self.model.NewIntVar(0, 2000, "fairness")
        self.model.Add(fairness == max_score - min_score)

        # 過去土曜補正
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

        # 過去日祝補正
        sunhol_totals: List[cp_model.IntVar] = []
        for d in doctors:
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

        # F. 日祝3回目ペナルティ
        sunhol_3rd_vars = []
        for d in doctors:
            sh_total = sum(self.day_shifts[(d, day)] + self.night_shifts[(d, day)] for day in sunhol_days)
            is_3rd = self.model.NewIntVar(0, 1, f"is_3rd_sh_d{d}")
            self.model.Add(is_3rd >= sh_total - 2)
            sunhol_3rd_vars.append(is_3rd)

        sunhol_3rd_sum = self.model.NewIntVar(0, 1000, "sunhol_3rd_sum")
        self.model.Add(sunhol_3rd_sum == sum(sunhol_3rd_vars))
        
        # 最適化実行（全ての重みを合算）
        w = self.objective_weights
        self.model.Minimize(
            w.month_fairness * fairness
            + w.past_sat_gap * sat_gap
            + w.past_sunhol_gap * sunhol_gap
            + w.gap5 * gap5_sum
            + w.gap6 * gap6_sum
            + w.pre_clinic * pre_clinic_sum
            + w.sat_consec * sat_consec_sum
            + w.target * target_sum
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
                day_data["night_shift"] = next((d for d in range(self.num_doctors) if solver.Value(self.night_shifts[(d, day)])), None)
                
                if self.is_sunday_or_holiday(day):
                    day_data["day_shift"] = next((d for d in range(self.num_doctors) if solver.Value(self.day_shifts[(d, day)])), None)
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
    optimizer = OnCallOptimizer(
        num_doctors=10, year=2024, month=4, holidays=[29],
        unavailable={0: [1, 2, 3]}, fixed_unavailable_weekdays={2: [0]},
        prev_month_worked_days={0: [30]}, prev_month_last_day=31,
        sat_prev={0: True}
    )
    optimizer.build_model()
    print(optimizer.solve())