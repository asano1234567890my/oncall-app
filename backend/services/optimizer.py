# backend/services/optimizer.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Any

from ortools.sat.python import cp_model
import calendar
import datetime
import random


@dataclass
class ObjectiveWeights:
    # Objective weights. Larger values penalize the corresponding violations more strongly.
    # Active: target score + weekend/holiday equalization
    target: int = 100
    score_balance: int = 30
    sunhol_fairness: int = 100
    sat_month_fairness: int = 100
    past_sunhol_gap: int = 50
    past_sat_gap: int = 50
    # Deactivated (to be redesigned: auto-follow hard constraints)
    month_fairness: int = 0
    gap5: int = 0
    gap6: int = 0
    sat_consec: int = 0
    sunhol_3rd: int = 0
    weekend_hol_3rd: int = 0
    soft_unavailable: int = 0


class OnCallOptimizer:
    """CP-SAT model for monthly on-call schedule generation."""

    # Default score weights (×10 for integer arithmetic in CP-SAT)
    W_WEEKDAY_NIGHT = 10  # 1.0
    W_SAT_NIGHT = 15      # 1.5
    W_SUNHOL_DAY = 5      # 0.5
    W_SUNHOL_NIGHT = 10   # 1.0
    W_DAY_NIGHT = 15      # 1.5 (combined 日当直 on sun/holiday)

    def __init__(
        self,
        num_doctors: int,
        year: int,
        month: int,
        holidays: Optional[List[int]] = None,
        unavailable: Optional[Dict[int, List[Dict[str, Any]]]] = None,
        fixed_unavailable_weekdays: Optional[Dict[int, List[Dict[str, Any]]]] = None,
        prev_month_worked_days: Optional[Dict[int, List[int]]] = None,
        prev_month_last_day: Optional[int] = None,
        previous_month_shifts: Optional[List[Dict[str, Any]]] = None,
        score_min: float = 0.5,
        score_max: float = 4.5,
        past_sat_counts: Optional[List[int]] = None,
        past_sunhol_counts: Optional[List[int]] = None,
        min_score_by_doctor: Optional[Dict[int, float]] = None,
        max_score_by_doctor: Optional[Dict[int, float]] = None,
        target_score_by_doctor: Optional[Dict[int, float]] = None,
        past_total_scores: Optional[Dict[int, float]] = None,
        sat_prev: Optional[Dict[int, bool]] = None,
        objective_weights: Optional[Dict[str, Any]] = None,
        hard_constraints: Optional[Dict[str, Any]] = None,
        max_saturday_nights: Optional[Any] = None,
        max_sunhol_days: Optional[Any] = None,
        max_sunhol_works: Optional[Any] = None,
        prevent_sunhol_consecutive: Optional[Any] = None,
        respect_unavailable_days: Optional[Any] = None,
        locked_shifts: Optional[List[Dict[str, Any]]] = None,
        shift_scores: Optional[Dict[str, float]] = None,
    ):
        self.num_doctors = num_doctors
        self.year = year
        self.month = month
        self.num_days = calendar.monthrange(year, month)[1]

        self.holidays = holidays or []
        self.unavailable = unavailable or {}
        self.fixed_unavailable_weekdays = fixed_unavailable_weekdays or {}

        self.prev_month_worked_days = dict(prev_month_worked_days or {})
        self.prev_month_last_day = prev_month_last_day
        self.previous_month_shifts = list(previous_month_shifts or [])

        self.score_min_float = score_min
        self.score_max_float = score_max

        self.past_sat_counts = list(past_sat_counts or [])
        self.past_sunhol_counts = list(past_sunhol_counts or [])

        self.min_score_by_doctor = min_score_by_doctor or {}
        self.max_score_by_doctor = max_score_by_doctor or {}
        self.target_score_by_doctor = target_score_by_doctor or {}
        self.past_total_scores = past_total_scores or {}
        self.sat_prev = dict(sat_prev or {})
        self.hard_constraints = dict(hard_constraints or {})
        direct_hard_constraints = {
            "max_saturday_nights": max_saturday_nights,
            "max_sunhol_days": max_sunhol_days,
            "max_sunhol_works": max_sunhol_works,
            "prevent_sunhol_consecutive": prevent_sunhol_consecutive,
            "respect_unavailable_days": respect_unavailable_days,
        }
        for key, value in direct_hard_constraints.items():
            if value is not None:
                self.hard_constraints[key] = value

        # locked_shifts are normalized to doctor_idx at the router boundary.
        self.locked_shifts = locked_shifts or []

        # Apply configurable shift scores (override class defaults)
        ss = shift_scores or {}
        if "weekday_night" in ss:
            self.W_WEEKDAY_NIGHT = int(round(float(ss["weekday_night"]) * 10))
        if "saturday_night" in ss:
            self.W_SAT_NIGHT = int(round(float(ss["saturday_night"]) * 10))
        if "holiday_day" in ss:
            self.W_SUNHOL_DAY = int(round(float(ss["holiday_day"]) * 10))
        if "holiday_night" in ss:
            self.W_SUNHOL_NIGHT = int(round(float(ss["holiday_night"]) * 10))
        # combined day+night = holiday_day + holiday_night
        self.W_DAY_NIGHT = self.W_SUNHOL_DAY + self.W_SUNHOL_NIGHT

        ow = objective_weights or {}
        self.objective_weights = ObjectiveWeights(
            # Active
            target=int(ow.get("target", 100)),
            score_balance=int(ow.get("score_balance", 30)),
            sunhol_fairness=int(ow.get("sunhol_fairness", 100)),
            sat_month_fairness=int(ow.get("sat_month_fairness", 100)),
            past_sunhol_gap=int(ow.get("past_sunhol_gap", 50)),
            past_sat_gap=int(ow.get("past_sat_gap", 50)),
            # Deactivated
            month_fairness=int(ow.get("month_fairness", 0)),
            gap5=int(ow.get("gap5", 0)),
            gap6=int(ow.get("gap6", 0)),
            sat_consec=int(ow.get("sat_consec", 0)),
            sunhol_3rd=int(ow.get("sunhol_3rd", 0)),
            weekend_hol_3rd=int(ow.get("weekend_hol_3rd", 0)),
            soft_unavailable=1000,  # 固定値: ソフト化した不可日はほぼハード制約として扱う
        )

        self.model = cp_model.CpModel()

        self.night_shifts: Dict[Tuple[int, int], cp_model.IntVar] = {}
        self.day_shifts: Dict[Tuple[int, int], cp_model.IntVar] = {}
        self.work: Dict[Tuple[int, int], cp_model.IntVar] = {}

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

    def _parse_locked_day(self, raw_date: Any) -> Optional[int]:
        """Normalize current-month dates to a day-of-month integer."""
        day: Optional[int] = None
        if isinstance(raw_date, int):
            day = raw_date
        elif isinstance(raw_date, str):
            s = raw_date.strip()
            if s.isdigit():
                day = int(s)
            else:
                try:
                    parsed = datetime.date.fromisoformat(s)
                    if parsed.year == self.year and parsed.month == self.month:
                        day = parsed.day
                except ValueError:
                    return None
        elif isinstance(raw_date, datetime.datetime):
            if raw_date.year == self.year and raw_date.month == self.month:
                day = raw_date.day
        elif isinstance(raw_date, datetime.date):
            if raw_date.year == self.year and raw_date.month == self.month:
                day = raw_date.day

        if day is None:
            return None
        if 1 <= day <= self.num_days:
            return day
        return None

    def _normalize_shift_type(self, raw_shift_type: Any) -> Optional[str]:
        s = str(raw_shift_type).strip().lower()
        if s in {"night", "night_shift"}:
            return "night"
        if s in {"day", "day_shift"}:
            return "day"
        return None

    def _normalize_target_shift(self, raw_target_shift: Any) -> str:
        if raw_target_shift is None:
            return "all"
        if isinstance(raw_target_shift, bool):
            return "all"
        if isinstance(raw_target_shift, (int, float)):
            value = int(raw_target_shift)
            if value == 1:
                return "day"
            if value == 2:
                return "night"
            if value == 0:
                return "all"

        s = str(raw_target_shift).strip().lower()
        if s in {"1", "day", "day_shift"}:
            return "day"
        if s in {"2", "night", "night_shift"}:
            return "night"
        if s == "all":
            return "all"
        return "all"

    def _normalize_unavailable_entry(self, item: Any) -> Optional[Dict[str, Any]]:
        if isinstance(item, int):
            if 1 <= item <= self.num_days:
                return {"date": item, "target_shift": "all", "is_soft_penalty": False}
            return None

        if not isinstance(item, dict):
            return None

        day = self._parse_locked_day(item.get("date"))
        if day is None:
            return None

        return {
            "date": day,
            "target_shift": self._normalize_target_shift(item.get("target_shift", "all")),
            "is_soft_penalty": bool(item.get("is_soft_penalty", False)),
        }

    def _normalize_fixed_weekday_entry(self, item: Any) -> Optional[Dict[str, Any]]:
        if isinstance(item, int):
            if 0 <= item <= 7:
                return {"day_of_week": item, "target_shift": "all", "is_soft_penalty": False}
            return None

        if not isinstance(item, dict):
            return None

        raw_day_of_week = item.get("day_of_week", item.get("weekday"))
        try:
            day_of_week = int(raw_day_of_week)
        except (TypeError, ValueError):
            return None

        if not (0 <= day_of_week <= 7):
            return None

        return {
            "day_of_week": day_of_week,
            "target_shift": self._normalize_target_shift(item.get("target_shift", "all")),
            "is_soft_penalty": bool(item.get("is_soft_penalty", False)),
        }

    def _matches_fixed_unavailable_weekday(self, day: int, day_of_week: int) -> bool:
        if day_of_week == 7:
            # Match frontend DnD semantics: 7 means holiday-only, excluding Sundays.
            return self.is_holiday(day) and not self.is_sunday(day)
        return datetime.date(self.year, self.month, day).weekday() == day_of_week

    def _parse_previous_month_day(self, raw_date: Any) -> Optional[int]:
        prev_year = self.year if self.month > 1 else self.year - 1
        prev_month = self.month - 1 if self.month > 1 else 12
        prev_num_days = int(self.prev_month_last_day or calendar.monthrange(prev_year, prev_month)[1])

        day: Optional[int] = None
        if isinstance(raw_date, int):
            day = raw_date
        elif isinstance(raw_date, str):
            s = raw_date.strip()
            if s.isdigit():
                day = int(s)
            else:
                try:
                    parsed = datetime.date.fromisoformat(s)
                except ValueError:
                    return None
                if parsed.year == prev_year and parsed.month == prev_month:
                    day = parsed.day
        elif isinstance(raw_date, datetime.datetime):
            if raw_date.year == prev_year and raw_date.month == prev_month:
                day = raw_date.day
        elif isinstance(raw_date, datetime.date):
            if raw_date.year == prev_year and raw_date.month == prev_month:
                day = raw_date.day

        if day is None:
            return None
        if 1 <= day <= prev_num_days:
            return day
        return None

    def _build_previous_month_state(self) -> Tuple[Dict[int, List[int]], Optional[int]]:
        prev_year = self.year if self.month > 1 else self.year - 1
        prev_month = self.month - 1 if self.month > 1 else 12
        effective_last_day = int(self.prev_month_last_day or calendar.monthrange(prev_year, prev_month)[1])

        prev_days_map: Dict[int, set[int]] = {}
        for doctor_key, prev_days in (self.prev_month_worked_days or {}).items():
            try:
                doctor_idx = int(doctor_key)
            except (TypeError, ValueError):
                continue
            if not (0 <= doctor_idx < self.num_doctors):
                continue

            day_set = prev_days_map.setdefault(doctor_idx, set())
            for raw_day in prev_days or []:
                try:
                    day = int(raw_day)
                except (TypeError, ValueError):
                    continue
                if 1 <= day <= effective_last_day:
                    day_set.add(day)

        exact_prev_days_map: Dict[int, set[int]] = {}
        for item in self.previous_month_shifts:
            if not isinstance(item, dict):
                continue
            if self._normalize_shift_type(item.get("shift_type")) is None:
                continue
            try:
                doctor_idx = int(item.get("doctor_idx"))
            except (TypeError, ValueError):
                continue
            if not (0 <= doctor_idx < self.num_doctors):
                continue
            day = self._parse_previous_month_day(item.get("date"))
            if day is None:
                continue
            exact_prev_days_map.setdefault(doctor_idx, set()).add(day)

        for doctor_idx, exact_days in exact_prev_days_map.items():
            prev_days_map[doctor_idx] = set(exact_days)

        return (
            {doctor_idx: sorted(days) for doctor_idx, days in prev_days_map.items()},
            effective_last_day,
        )

    def _coerce_positive_int(self, raw: Any) -> Optional[int]:
        if raw is None:
            return None
        if isinstance(raw, bool):
            return 1 if raw else None
        if isinstance(raw, (int, float)):
            value = int(raw)
            return value if value > 0 else None
        if isinstance(raw, str):
            s = raw.strip().lower()
            if not s or s in {"0", "false", "off", "none", "null"}:
                return None
            try:
                value = int(float(s))
            except ValueError:
                return None
            return value if value > 0 else None
        if isinstance(raw, dict):
            enabled = raw.get("enabled", raw.get("is_enabled", raw.get("active", raw.get("on"))))
            if enabled is False:
                return None
            for key in ("value", "limit", "max", "count", "days"):
                if key in raw:
                    return self._coerce_positive_int(raw.get(key))
        return None

    def _is_explicitly_enabled(self, raw: Any) -> bool:
        if raw is True:
            return True
        if isinstance(raw, (int, float)):
            return int(raw) > 0
        if isinstance(raw, str):
            return raw.strip().lower() in {"true", "on", "enabled"}
        if isinstance(raw, dict):
            enabled = raw.get("enabled", raw.get("is_enabled", raw.get("active", raw.get("on"))))
            return enabled is True
        return False

    def _is_explicitly_disabled(self, raw: Any) -> bool:
        if raw is False:
            return True
        if isinstance(raw, (int, float)):
            return int(raw) <= 0
        if isinstance(raw, str):
            return raw.strip().lower() in {"0", "false", "off", "none", "null"}
        if isinstance(raw, dict):
            enabled = raw.get("enabled", raw.get("is_enabled", raw.get("active", raw.get("on"))))
            if enabled is not None:
                return self._is_explicitly_disabled(enabled)
        return False

    def _get_hard_constraint_value(
        self,
        default: Optional[int],
        *keys: str,
        flag_keys: Tuple[str, ...] = (),
    ) -> Optional[int]:
        for flag_key in flag_keys:
            if flag_key in self.hard_constraints and self._is_explicitly_disabled(self.hard_constraints[flag_key]):
                return None

        for key in keys:
            if key not in self.hard_constraints:
                continue

            raw = self.hard_constraints[key]
            value = self._coerce_positive_int(raw)
            if value is not None:
                return value
            if self._is_explicitly_enabled(raw):
                return default
            return None

        return default

    def pre_validate(self) -> List[Dict[str, Any]]:
        """Run fast arithmetic checks before building the CP-SAT model.

        Returns a list of diagnostic dicts (empty = OK).
        Each dict: {id, name_ja, current_value?, suggestion_ja?}
        """
        errors: List[Dict[str, Any]] = []
        days = range(1, self.num_days + 1)

        holiday_shift_mode = str(self.hard_constraints.get("holiday_shift_mode", "split")).strip().lower()
        combined_mode = holiday_shift_mode == "combined"
        respect_unavailable_days = not self._is_explicitly_disabled(
            self.hard_constraints.get("respect_unavailable_days", True)
        )
        spacing_days = self._get_hard_constraint_value(
            4, "interval_days", "min_interval_days", "spacing_days",
            "min_gap_days", "work_interval_days",
        )

        # --- Check 1: doctors vs slots with spacing ---
        # Total slots: night every day + day on sun/holidays (split mode)
        sunhol_days = [day for day in days if self.is_sunday_or_holiday(day)]
        night_slots = self.num_days
        day_slots = 0 if combined_mode else len(sunhol_days)
        total_slots = night_slots + day_slots

        if spacing_days is not None and spacing_days > 0:
            import math
            max_per_doctor = math.ceil(self.num_days / (spacing_days + 1))
            total_capacity = max_per_doctor * self.num_doctors
            if total_capacity < total_slots:
                # Recommended interval: find max that works, then subtract 1 for margin
                recommended_interval = 0
                for try_interval in range(spacing_days - 1, -1, -1):
                    cap = math.ceil(self.num_days / (try_interval + 1)) * self.num_doctors
                    if cap >= total_slots:
                        recommended_interval = max(0, try_interval - 1)
                        break
                # Minimum doctors: add 1 for margin
                min_doctors = math.ceil(total_slots / max_per_doctor) + 1

                errors.append({
                    "id": "insufficient_capacity",
                    "name_ja": "医師数と勤務間隔",
                    "current_value": f"現在: 医師{self.num_doctors}名・間隔{spacing_days}日",
                    "suggestion_ja": f"→ 間隔を{recommended_interval}日以下にするか、勤務可能な医師を{min_doctors}名以上にしてください",
                })

        # --- Check 2: sun/holiday staffing ---
        # For each sun/holiday, check that enough doctors are available
        for day in sunhol_days:
            available_night = set(range(self.num_doctors))
            available_day = set(range(self.num_doctors))

            if respect_unavailable_days:
                for d in range(self.num_doctors):
                    for item in self.unavailable.get(d, []):
                        normalized = self._normalize_unavailable_entry(item)
                        if normalized is None:
                            continue
                        if normalized["date"] != day:
                            continue
                        if normalized["is_soft_penalty"]:
                            continue
                        ts = normalized["target_shift"]
                        if ts in ("all", "night"):
                            available_night.discard(d)
                        if ts in ("all", "day"):
                            available_day.discard(d)

                    for item in self.fixed_unavailable_weekdays.get(d, []):
                        normalized = self._normalize_fixed_weekday_entry(item)
                        if normalized is None:
                            continue
                        if not self._matches_fixed_unavailable_weekday(day, normalized["day_of_week"]):
                            continue
                        if normalized["is_soft_penalty"]:
                            continue
                        ts = normalized["target_shift"]
                        if ts in ("all", "night"):
                            available_night.discard(d)
                        if ts in ("all", "day"):
                            available_day.discard(d)

            needed = 1 if combined_mode else 2  # night + day
            date_str = f"{self.year}/{self.month}/{day}"
            dt = datetime.date(self.year, self.month, day)
            weekday_ja = ["月", "火", "水", "木", "金", "土", "日"][dt.weekday()]

            if combined_mode:
                if len(available_night) < 1:
                    errors.append({
                        "id": "insufficient_doctors_for_day",
                        "name_ja": "勤務可能な医師の不足",
                        "current_value": f"{date_str}（{weekday_ja}）: 勤務可能0名",
                        "suggestion_ja": "→ この日の不可日を減らすか、勤務可能な医師を増やしてください",
                    })
            else:
                # Need at least 1 for night, 1 for day, and they must be different
                # (if prevent_consecutive is on)
                if len(available_night) < 1:
                    errors.append({
                        "id": "insufficient_doctors_for_day",
                        "name_ja": "勤務可能な医師の不足",
                        "current_value": f"{date_str}（{weekday_ja}）: 当直可能0名",
                        "suggestion_ja": "→ この日の不可日を減らすか、勤務可能な医師を増やしてください",
                    })
                if len(available_day) < 1:
                    errors.append({
                        "id": "insufficient_doctors_for_day",
                        "name_ja": "勤務可能な医師の不足",
                        "current_value": f"{date_str}（{weekday_ja}）: 日直可能0名",
                        "suggestion_ja": "→ この日の不可日を減らすか、勤務可能な医師を増やしてください",
                    })
                # Need at least 2 distinct doctors for day+night on same day
                available_either = available_night | available_day
                if len(available_either) < 2 and len(available_night) >= 1 and len(available_day) >= 1:
                    errors.append({
                        "id": "insufficient_doctors_for_day",
                        "name_ja": "勤務可能な医師の不足",
                        "current_value": f"{date_str}（{weekday_ja}）: 日直と当直に別の医師が必要ですが、1名しか勤務可能ではありません",
                        "suggestion_ja": "→ この日の不可日を減らすか、勤務可能な医師を増やしてください",
                    })

        # Also check weekday nights
        for day in days:
            if self.is_sunday_or_holiday(day):
                continue  # already checked above
            if not respect_unavailable_days:
                continue
            available_night = set(range(self.num_doctors))
            for d in range(self.num_doctors):
                for item in self.unavailable.get(d, []):
                    normalized = self._normalize_unavailable_entry(item)
                    if normalized is None:
                        continue
                    if normalized["date"] != day or normalized["is_soft_penalty"]:
                        continue
                    if normalized["target_shift"] in ("all", "night"):
                        available_night.discard(d)
                for item in self.fixed_unavailable_weekdays.get(d, []):
                    normalized = self._normalize_fixed_weekday_entry(item)
                    if normalized is None:
                        continue
                    if not self._matches_fixed_unavailable_weekday(day, normalized["day_of_week"]):
                        continue
                    if normalized["is_soft_penalty"]:
                        continue
                    if normalized["target_shift"] in ("all", "night"):
                        available_night.discard(d)

            if len(available_night) < 1:
                dt = datetime.date(self.year, self.month, day)
                weekday_ja = ["月", "火", "水", "木", "金", "土", "日"][dt.weekday()]
                errors.append({
                    "id": "insufficient_doctors_for_day",
                    "name_ja": "勤務可能な医師の不足",
                    "current_value": f"{self.year}/{self.month}/{day}（{weekday_ja}）: 当直可能0名",
                    "suggestion_ja": "→ この日の不可日を減らすか、勤務可能な医師を増やしてください",
                })

        # --- Check 3: score range contradiction ---
        total_score_in_month = 0
        for day in days:
            if self.is_sunday_or_holiday(day):
                if combined_mode:
                    total_score_in_month += self.W_DAY_NIGHT
                else:
                    total_score_in_month += self.W_SUNHOL_DAY + self.W_SUNHOL_NIGHT
            elif self.is_saturday(day):
                total_score_in_month += self.W_SAT_NIGHT
            else:
                total_score_in_month += self.W_WEEKDAY_NIGHT

        sum_min = sum(
            int(round(self.min_score_by_doctor.get(d, self.score_min_float) * 10))
            for d in range(self.num_doctors)
        )
        sum_max = sum(
            int(round(self.max_score_by_doctor.get(d, self.score_max_float) * 10))
            for d in range(self.num_doctors)
        )

        if sum_min > total_score_in_month:
            import math
            # Margin: 10% below the even split
            even_split = total_score_in_month / self.num_doctors / 10
            recommended_min = math.floor(even_split * 0.9 * 10) / 10
            errors.append({
                "id": "score_min_exceeds_total",
                "name_ja": "スコア下限が高すぎます",
                "current_value": f"現在の下限: {self.score_min_float:.1f}",
                "suggestion_ja": f"→ スコア下限を{recommended_min:.1f}以下にしてください",
            })
        if sum_max < total_score_in_month:
            import math
            # Margin: 10% above the even split
            even_split = total_score_in_month / self.num_doctors / 10
            recommended_max = math.ceil(even_split * 1.1 * 10) / 10
            errors.append({
                "id": "score_max_below_total",
                "name_ja": "スコア上限が低すぎます",
                "current_value": f"現在の上限: {self.score_max_float:.1f}",
                "suggestion_ja": f"→ スコア上限を{recommended_max:.1f}以上にしてください",
            })

        # --- Check 4: locked shift vs unavailable day conflict ---
        for item in self.locked_shifts:
            if not isinstance(item, dict):
                continue
            doctor_idx = item.get("doctor_idx")
            if doctor_idx is None:
                continue
            try:
                d = int(doctor_idx)
            except (TypeError, ValueError):
                continue
            if d < 0 or d >= self.num_doctors:
                continue

            day = self._parse_locked_day(item.get("date"))
            if day is None:
                continue
            shift = self._normalize_shift_type(item.get("shift_type"))
            if shift is None:
                continue

            if not respect_unavailable_days:
                continue

            # Check date-based unavailable
            for ua_item in self.unavailable.get(d, []):
                normalized = self._normalize_unavailable_entry(ua_item)
                if normalized is None:
                    continue
                if normalized["date"] != day or normalized["is_soft_penalty"]:
                    continue
                ts = normalized["target_shift"]
                if ts == "all" or ts == shift:
                    dt = datetime.date(self.year, self.month, day)
                    weekday_ja = ["月", "火", "水", "木", "金", "土", "日"][dt.weekday()]
                    errors.append({
                        "id": "locked_vs_unavailable",
                        "name_ja": "ロック済みシフトと不可日の衝突",
                        "current_value": f"{self.year}/{self.month}/{day}（{weekday_ja}）の{('日直' if shift == 'day' else '当直')}がロックされていますが、医師{d + 1}の不可日です",
                        "suggestion_ja": "→ ロックを解除するか、不可日を外してください",
                    })

            # Check fixed weekday unavailable
            for fw_item in self.fixed_unavailable_weekdays.get(d, []):
                normalized = self._normalize_fixed_weekday_entry(fw_item)
                if normalized is None:
                    continue
                if not self._matches_fixed_unavailable_weekday(day, normalized["day_of_week"]):
                    continue
                if normalized["is_soft_penalty"]:
                    continue
                ts = normalized["target_shift"]
                if ts == "all" or ts == shift:
                    dt = datetime.date(self.year, self.month, day)
                    weekday_ja = ["月", "火", "水", "木", "金", "土", "日"][dt.weekday()]
                    errors.append({
                        "id": "locked_vs_unavailable",
                        "name_ja": "ロック済みシフトと不可曜日の衝突",
                        "current_value": f"{self.year}/{self.month}/{day}（{weekday_ja}）の{('日直' if shift == 'day' else '当直')}がロックされていますが、医師{d + 1}の不可曜日です",
                        "suggestion_ja": "→ ロックを解除するか、不可曜日を外してください",
                    })

        # --- Check 5: month-cross spacing blocks early days ---
        prev_month_worked_days, prev_last = self._build_previous_month_state()
        if spacing_days is not None and spacing_days > 0 and prev_last is not None:
            # Build set of blocked (doctor, day) pairs from previous month spillover
            cross_blocked: Dict[int, set] = {}  # day -> set of blocked doctor indices
            for d, prev_days_set in prev_month_worked_days.items():
                for prev_day in prev_days_set:
                    dist_to_start = (prev_last - int(prev_day)) + 1
                    if 1 <= dist_to_start <= spacing_days:
                        block_until = spacing_days + 1 - dist_to_start
                        for day in range(1, min(block_until, self.num_days) + 1):
                            cross_blocked.setdefault(day, set()).add(d)

            for day in range(1, min(spacing_days + 1, self.num_days + 1)):
                blocked_docs = cross_blocked.get(day, set())
                if not blocked_docs:
                    continue

                # Count available doctors for night shift on this day
                available_night = set(range(self.num_doctors)) - blocked_docs
                available_day = set(range(self.num_doctors)) - blocked_docs

                # Also subtract unavailable doctors
                if respect_unavailable_days:
                    for d_idx in list(available_night):
                        if self._is_doctor_unavailable_on_day(d_idx, day, "night"):
                            available_night.discard(d_idx)
                    for d_idx in list(available_day):
                        if self._is_doctor_unavailable_on_day(d_idx, day, "day"):
                            available_day.discard(d_idx)

                dt = datetime.date(self.year, self.month, day)
                weekday_ja = ["月", "火", "水", "木", "金", "土", "日"][dt.weekday()]
                date_str = f"{self.year}/{self.month}/{day}"

                if len(available_night) < 1:
                    errors.append({
                        "id": "cross_month_blocked",
                        "name_ja": "前月の勤務間隔による月初の人手不足",
                        "current_value": f"{date_str}（{weekday_ja}）: 前月末の勤務間隔により当直可能な医師が0名",
                        "suggestion_ja": "→ 勤務間隔を短くするか、前月末のシフトを調整してください",
                    })
                if self.is_sunday_or_holiday(day) and not combined_mode:
                    if len(available_day) < 1:
                        errors.append({
                            "id": "cross_month_blocked",
                            "name_ja": "前月の勤務間隔による月初の人手不足",
                            "current_value": f"{date_str}（{weekday_ja}）: 前月末の勤務間隔により日直可能な医師が0名",
                            "suggestion_ja": "→ 勤務間隔を短くするか、前月末のシフトを調整してください",
                        })

        # --- Check 6: weekend/holiday work cap vs required slots ---
        max_weekend_holiday_works = self._get_hard_constraint_value(
            None,
            "max_weekend_holiday_works",
            "weekend_holiday_work_max",
            "weekend_hol_work_max",
            "max_weekend_holiday_count",
            "weekend_holiday_total_max",
            "weekend_hol_total_max",
            "max_shifts",
            flag_keys=("strict_weekend_hol_max",),
        )
        saturdays = [day for day in days if self.is_saturday(day)]

        if max_weekend_holiday_works is not None:
            # Total weekend/holiday slots that need filling
            wh_slots = len(saturdays)  # saturday nights
            for day in sunhol_days:
                if combined_mode:
                    wh_slots += 1  # night only
                else:
                    wh_slots += 2  # day + night
            total_wh_capacity = max_weekend_holiday_works * self.num_doctors
            if total_wh_capacity < wh_slots:
                import math
                recommended = math.ceil(wh_slots / self.num_doctors)
                errors.append({
                    "id": "weekend_holiday_cap_exceeded",
                    "name_ja": "土日祝の勤務回数上限が低すぎます",
                    "current_value": f"現在: 上限{max_weekend_holiday_works}回/人 × {self.num_doctors}名 = 最大{total_wh_capacity}枠（必要: {wh_slots}枠）",
                    "suggestion_ja": f"→ 上限を{recommended}回以上にするか、勤務可能な医師を増やしてください",
                })

        # --- Check 7: saturday night cap vs saturday count ---
        max_saturday_nights = self._get_hard_constraint_value(
            1,
            "max_saturday_nights",
            "max_sat_nights",
            "sat_night_max",
            "saturday_night_max",
        )
        if max_saturday_nights is not None and len(saturdays) > 0:
            total_sat_capacity = max_saturday_nights * self.num_doctors
            if total_sat_capacity < len(saturdays):
                import math
                recommended = math.ceil(len(saturdays) / self.num_doctors)
                errors.append({
                    "id": "saturday_cap_exceeded",
                    "name_ja": "土曜当直の上限が低すぎます",
                    "current_value": f"現在: 上限{max_saturday_nights}回/人 × {self.num_doctors}名 = 最大{total_sat_capacity}枠（土曜: {len(saturdays)}日）",
                    "suggestion_ja": f"→ 上限を{recommended}回以上にしてください",
                })

        return errors

    def _is_doctor_unavailable_on_day(self, doctor_idx: int, day: int, shift: str) -> bool:
        """Check if a doctor is hard-unavailable on a specific day for a specific shift."""
        for item in self.unavailable.get(doctor_idx, []):
            normalized = self._normalize_unavailable_entry(item)
            if normalized is None:
                continue
            if normalized["date"] != day or normalized["is_soft_penalty"]:
                continue
            ts = normalized["target_shift"]
            if ts == "all" or ts == shift:
                return True
        for item in self.fixed_unavailable_weekdays.get(doctor_idx, []):
            normalized = self._normalize_fixed_weekday_entry(item)
            if normalized is None:
                continue
            if not self._matches_fixed_unavailable_weekday(day, normalized["day_of_week"]):
                continue
            if normalized["is_soft_penalty"]:
                continue
            ts = normalized["target_shift"]
            if ts == "all" or ts == shift:
                return True
        return False

    def build_model(self) -> None:
        doctors = range(self.num_doctors)
        days = range(1, self.num_days + 1)
        holiday_shift_mode = str(self.hard_constraints.get("holiday_shift_mode", "split")).strip().lower()
        combined_mode = holiday_shift_mode == "combined"
        prevent_sunhol_consecutive = not combined_mode and not self._is_explicitly_disabled(
            self.hard_constraints.get("prevent_sunhol_consecutive", True)
        )
        respect_unavailable_days = not self._is_explicitly_disabled(
            self.hard_constraints.get("respect_unavailable_days", True)
        )

        spacing_days = self._get_hard_constraint_value(
            4,
            "interval_days",
            "min_interval_days",
            "spacing_days",
            "min_gap_days",
            "work_interval_days",
        )
        max_saturday_nights = self._get_hard_constraint_value(
            1,
            "max_saturday_nights",
            "max_sat_nights",
            "sat_night_max",
            "saturday_night_max",
        )
        max_sunhol_days = self._get_hard_constraint_value(
            2,
            "max_sunhol_days",
            "sunhol_day_max",
            "max_holiday_days",
            "max_sunday_holiday_days",
        )
        max_sunhol_works = self._get_hard_constraint_value(
            3,
            "max_sunhol_works",
            "sunhol_work_max",
            "max_holiday_works",
            "max_sunday_holiday_works",
        )
        max_weekend_holiday_works = self._get_hard_constraint_value(
            None,
            "max_weekend_holiday_works",
            "weekend_holiday_work_max",
            "weekend_hol_work_max",
            "max_weekend_holiday_count",
            "weekend_holiday_total_max",
            "weekend_hol_total_max",
            "max_shifts",
            flag_keys=("strict_weekend_hol_max",),
        )

        def weekend_holiday_work_expr(doctor_idx: int):
            return sum(
                self.day_shifts[(doctor_idx, day)] + self.night_shifts[(doctor_idx, day)]
                if self.is_sunday_or_holiday(day)
                else self.night_shifts[(doctor_idx, day)]
                for day in days
                if self.is_sunday_or_holiday(day) or self.is_saturday(day)
            )

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
            if self.is_sunday_or_holiday(day) and not combined_mode:
                self.model.AddExactlyOne(self.day_shifts[(d, day)] for d in doctors)
            else:
                for d in doctors:
                    self.model.Add(self.day_shifts[(d, day)] == 0)

        # 3) hard: prevent same-day day/night double assignment
        if prevent_sunhol_consecutive:
            for d in doctors:
                for day in days:
                    self.model.Add(self.night_shifts[(d, day)] + self.day_shifts[(d, day)] <= 1)

        # 3.5) hard: enforce locked shifts fixed at the router boundary
        for item in self.locked_shifts:
            if not isinstance(item, dict):
                continue

            doctor_idx = item.get("doctor_idx")
            if doctor_idx is None:
                continue
            try:
                d = int(doctor_idx)
            except (TypeError, ValueError):
                continue
            if d < 0 or d >= self.num_doctors:
                continue

            day = self._parse_locked_day(item.get("date"))
            if day is None:
                continue

            shift = self._normalize_shift_type(item.get("shift_type"))
            if shift is None:
                continue

            if shift == "night":
                self.model.Add(self.night_shifts[(d, day)] == 1)
            else:
                # In combined mode, "day" locks on sun/holiday are treated as "night" (combined)
                if combined_mode and self.is_sunday_or_holiday(day):
                    self.model.Add(self.night_shifts[(d, day)] == 1)
                else:
                    self.model.Add(self.day_shifts[(d, day)] == 1)

        # === apply unavailable constraints ===
        soft_unavail_penalties = []
        # Track metadata for each soft penalty var: (doctor_idx, day, shift_type)
        self._soft_unavail_vars_meta: list[tuple] = []

        # 4) hard/soft: apply date-based unavailable constraints
        # When respect_unavailable_days=False, all entries become soft penalties
        # (the soft_unavailable weight then controls how strongly they are respected)
        for d, items in self.unavailable.items():
            for item in items:
                normalized = self._normalize_unavailable_entry(item)
                if normalized is None:
                    continue

                day = normalized["date"]
                shift_type = normalized["target_shift"]
                # Force soft when global respect flag is off
                is_soft = normalized["is_soft_penalty"] or not respect_unavailable_days

                vars_to_constrain = []
                if shift_type in ["day", "all"]:
                    vars_to_constrain.append(self.day_shifts[(d, day)])
                if shift_type in ["night", "all"]:
                    vars_to_constrain.append(self.night_shifts[(d, day)])

                for var in vars_to_constrain:
                    if is_soft:
                        p_var = self.model.NewBoolVar(f"soft_unavail_d{d}_day{day}_{shift_type}")
                        self.model.Add(p_var == var)
                        soft_unavail_penalties.append(p_var)
                        self._soft_unavail_vars_meta.append((d, day, shift_type, p_var))
                    else:
                        self.model.Add(var == 0)

        # 5) fixed unavailable weekdays
        for d, items in self.fixed_unavailable_weekdays.items():
            for item in items:
                normalized = self._normalize_fixed_weekday_entry(item)
                if normalized is None:
                    continue

                target_dow = normalized["day_of_week"]
                shift_type = normalized["target_shift"]
                is_soft = normalized["is_soft_penalty"] or not respect_unavailable_days

                for day in days:
                    if not self._matches_fixed_unavailable_weekday(day, target_dow):
                        continue

                    vars_to_constrain = []
                    if shift_type in ["day", "all"]:
                        vars_to_constrain.append(self.day_shifts[(d, day)])
                    if shift_type in ["night", "all"]:
                        vars_to_constrain.append(self.night_shifts[(d, day)])

                    for var in vars_to_constrain:
                        if is_soft:
                            p_var = self.model.NewBoolVar(f"soft_dow_d{d}_day{day}_{shift_type}")
                            self.model.Add(p_var == var)
                            soft_unavail_penalties.append(p_var)
                            self._soft_unavail_vars_meta.append((d, day, shift_type, p_var))
                        else:
                            self.model.Add(var == 0)

        # 7) hard: spacing rule
        if spacing_days is not None:
            for d in doctors:
                for day in days:
                    for k in range(1, spacing_days + 1):
                        if day + k <= self.num_days:
                            self.model.Add(self.work[(d, day)] + self.work[(d, day + k)] <= 1)

        # 8) hard: month-cross spacing rule
        prev_month_worked_days, prev_last = self._build_previous_month_state()
        if spacing_days is not None and prev_last is not None:
            for d, prev_days in prev_month_worked_days.items():
                for prev_day in prev_days:
                    dist_to_start = (prev_last - int(prev_day)) + 1
                    if 1 <= dist_to_start <= spacing_days:
                        block_until = spacing_days + 1 - dist_to_start
                        for day in range(1, block_until + 1):
                            if 1 <= day <= self.num_days:
                                self.model.Add(self.work[(d, day)] == 0)

        saturdays = [day for day in days if self.is_saturday(day)]
        sunhol_days = [day for day in days if self.is_sunday_or_holiday(day)]

        # 9) hard: saturday night monthly cap
        if max_saturday_nights is not None:
            for d in doctors:
                self.model.Add(sum(self.night_shifts[(d, day)] for day in saturdays) <= max_saturday_nights)

        # 10) hard: sun/holiday day-shift monthly cap
        if max_sunhol_days is not None:
            for d in doctors:
                self.model.Add(sum(self.day_shifts[(d, day)] for day in sunhol_days) <= max_sunhol_days)

        # 10.5) hard: sun/holiday total-work monthly cap
        if max_sunhol_works is not None:
            for d in doctors:
                self.model.Add(
                    sum(self.day_shifts[(d, day)] + self.night_shifts[(d, day)] for day in sunhol_days) <= max_sunhol_works
                )

        # 10.6) hard: combined saturday-night + sun/holiday-work monthly cap
        if max_weekend_holiday_works is not None:
            for d in doctors:
                self.model.Add(weekend_holiday_work_expr(d) <= max_weekend_holiday_works)

        # 11) hard: compute monthly scores and enforce per-doctor min/max
        doctor_scores: List[cp_model.IntVar] = []
        for d in doctors:
            score_expr = 0
            for day in days:
                if self.is_sunday_or_holiday(day):
                    if combined_mode:
                        score_expr += self.night_shifts[(d, day)] * self.W_DAY_NIGHT
                    else:
                        score_expr += self.day_shifts[(d, day)] * self.W_SUNHOL_DAY
                        score_expr += self.night_shifts[(d, day)] * self.W_SUNHOL_NIGHT
                elif self.is_saturday(day):
                    score_expr += self.night_shifts[(d, day)] * self.W_SAT_NIGHT
                else:
                    score_expr += self.night_shifts[(d, day)] * self.W_WEEKDAY_NIGHT

            doc_score = self.model.NewIntVar(0, 2000, f"score_d{d}")
            self.model.Add(doc_score == score_expr)

            d_min = int(round(self.min_score_by_doctor.get(d, self.score_min_float) * 10))
            d_max = int(round(self.max_score_by_doctor.get(d, self.score_max_float) * 10))
            self.model.Add(doc_score >= d_min)
            self.model.Add(doc_score <= d_max)

            doctor_scores.append(doc_score)

        self.doctor_scores = doctor_scores

                # --- soft constraints ---

        # gap_near / gap_far: penalize shifts that are just above the hard spacing floor
        # e.g. spacing_days=4 → penalize 5-day gap (just passing) and 6-day gap
        # If spacing_days is None (disabled), fall back to 5/6
        _base = spacing_days if spacing_days is not None else 4
        gap_near = _base + 1
        gap_far  = _base + 2

        gap5_vars = []
        gap6_vars = []
        for d in doctors:
            for day in days:
                if day + gap_near <= self.num_days:
                    gap5_bool = self.model.NewBoolVar(f"gap5_d{d}_day{day}")
                    self.model.Add(self.work[(d, day)] + self.work[(d, day + gap_near)] - 1 <= gap5_bool)
                    gap5_vars.append(gap5_bool)
                if day + gap_far <= self.num_days:
                    gap6_bool = self.model.NewBoolVar(f"gap6_d{d}_day{day}")
                    self.model.Add(self.work[(d, day)] + self.work[(d, day + gap_far)] - 1 <= gap6_bool)
                    gap6_vars.append(gap6_bool)

        gap5_sum = self.model.NewIntVar(0, 1000, "gap5_sum")
        self.model.Add(gap5_sum == sum(gap5_vars))
        gap6_sum = self.model.NewIntVar(0, 1000, "gap6_sum")
        self.model.Add(gap6_sum == sum(gap6_vars))

        sat_consec_vars = []
        for d in doctors:
            if self.sat_prev.get(d, False):
                sat_month_bool = self.model.NewBoolVar(f"sat_month_bool_d{d}")
                self.model.AddMaxEquality(sat_month_bool, [self.night_shifts[(d, sat)] for sat in saturdays])
                sat_consec_vars.append(sat_month_bool)

        sat_consec_sum = self.model.NewIntVar(0, 1000, "sat_consec_sum")
        self.model.Add(sat_consec_sum == sum(sat_consec_vars))

        # Soft penalty: reaching the saturday-night hard ceiling (Nth occurrence)
        # Reuses sat_consec weight to discourage reaching the limit when alternatives exist
        sat_nth_vars = []
        if max_saturday_nights is not None and max_saturday_nights > 0:
            for d in doctors:
                sat_count_soft = self.model.NewIntVar(0, 10, f"sat_nth_count_d{d}")
                self.model.Add(sat_count_soft == sum(self.night_shifts[(d, day)] for day in saturdays))
                is_at_sat_limit = self.model.NewBoolVar(f"sat_at_limit_d{d}")
                self.model.Add(sat_count_soft >= max_saturday_nights).OnlyEnforceIf(is_at_sat_limit)
                self.model.Add(sat_count_soft <= max_saturday_nights - 1).OnlyEnforceIf(is_at_sat_limit.Not())
                sat_nth_vars.append(is_at_sat_limit)

        sat_nth_sum = self.model.NewIntVar(0, 1000, "sat_nth_sum")
        self.model.Add(sat_nth_sum == sum(sat_nth_vars))

        target_penalties = []
        for d in doctors:
            if d in self.target_score_by_doctor and self.target_score_by_doctor[d] > 0:
                t_score = int(round(self.target_score_by_doctor[d] * 10))
                diff = self.model.NewIntVar(-2000, 2000, f"diff_target_d{d}")
                abs_diff = self.model.NewIntVar(0, 2000, f"abs_diff_target_d{d}")
                self.model.Add(diff == doctor_scores[d] - t_score)
                self.model.AddAbsEquality(abs_diff, diff)
                target_penalties.append(abs_diff)

        target_sum = self.model.NewIntVar(0, 10000, "target_sum")
        self.model.Add(target_sum == sum(target_penalties))

        max_score = self.model.NewIntVar(0, 2000, "max_score")
        min_score = self.model.NewIntVar(0, 2000, "min_score")
        self.model.AddMaxEquality(max_score, doctor_scores)
        self.model.AddMinEquality(min_score, doctor_scores)
        fairness = self.model.NewIntVar(0, 2000, "fairness")
        self.model.Add(fairness == max_score - min_score)

        sat_month_counts: List[cp_model.IntVar] = []
        sat_totals: List[cp_model.IntVar] = []
        for d in doctors:
            sat_count = self.model.NewIntVar(0, 10, f"sat_count_d{d}")
            self.model.Add(sat_count == sum(self.night_shifts[(d, day)] for day in saturdays))
            sat_month_counts.append(sat_count)
            base = self._get_past(self.past_sat_counts, d)
            total = self.model.NewIntVar(0, 999, f"sat_total_d{d}")
            self.model.Add(total == sat_count + base)
            sat_totals.append(total)

        # Current-month saturday gap (fairness within this month)
        sat_month_max = self.model.NewIntVar(0, 10, "sat_month_max")
        sat_month_min = self.model.NewIntVar(0, 10, "sat_month_min")
        self.model.AddMaxEquality(sat_month_max, sat_month_counts)
        self.model.AddMinEquality(sat_month_min, sat_month_counts)
        sat_month_gap = self.model.NewIntVar(0, 10, "sat_month_gap")
        self.model.Add(sat_month_gap == sat_month_max - sat_month_min)

        # Cumulative (past + current) saturday gap
        sat_max = self.model.NewIntVar(0, 999, "sat_max")
        sat_min = self.model.NewIntVar(0, 999, "sat_min")
        self.model.AddMaxEquality(sat_max, sat_totals)
        self.model.AddMinEquality(sat_min, sat_totals)
        sat_gap = self.model.NewIntVar(0, 999, "sat_gap")
        self.model.Add(sat_gap == sat_max - sat_min)

        sunhol_shift_counts: List[cp_model.IntVar] = []
        for d in doctors:
            sh_count = self.model.NewIntVar(0, 62, f"sunhol_count_d{d}")
            self.model.Add(
                sh_count == sum(self.day_shifts[(d, day)] + self.night_shifts[(d, day)] for day in sunhol_days)
            )
            sunhol_shift_counts.append(sh_count)

        sunhol_month_max = self.model.NewIntVar(0, 62, "sunhol_month_max")
        sunhol_month_min = self.model.NewIntVar(0, 62, "sunhol_month_min")
        self.model.AddMaxEquality(sunhol_month_max, sunhol_shift_counts)
        self.model.AddMinEquality(sunhol_month_min, sunhol_shift_counts)
        sunhol_month_gap = self.model.NewIntVar(0, 62, "sunhol_month_gap")
        self.model.Add(sunhol_month_gap == sunhol_month_max - sunhol_month_min)

        sunhol_totals: List[cp_model.IntVar] = []
        for d in doctors:
            base = self._get_past(self.past_sunhol_counts, d)
            total = self.model.NewIntVar(0, 999, f"sunhol_total_d{d}")
            self.model.Add(total == sunhol_shift_counts[d] + base)
            sunhol_totals.append(total)

        sunhol_total_max = self.model.NewIntVar(0, 999, "sunhol_total_max")
        sunhol_total_min = self.model.NewIntVar(0, 999, "sunhol_total_min")
        self.model.AddMaxEquality(sunhol_total_max, sunhol_totals)
        self.model.AddMinEquality(sunhol_total_min, sunhol_totals)
        sunhol_gap = self.model.NewIntVar(0, 999, "sunhol_gap")
        self.model.Add(sunhol_gap == sunhol_total_max - sunhol_total_min)

        total_score_with_past: List[cp_model.IntVar] = []
        for d in doctors:
            past_total = int(round(self.past_total_scores.get(d, 0.0) * 10))
            total = self.model.NewIntVar(0, 100000, f"total_score_with_past_d{d}")
            self.model.Add(total == doctor_scores[d] + past_total)
            total_score_with_past.append(total)

        score_balance_max = self.model.NewIntVar(0, 100000, "score_balance_max")
        score_balance_min = self.model.NewIntVar(0, 100000, "score_balance_min")
        self.model.AddMaxEquality(score_balance_max, total_score_with_past)
        self.model.AddMinEquality(score_balance_min, total_score_with_past)
        score_balance_gap = self.model.NewIntVar(0, 100000, "score_balance_gap")
        self.model.Add(score_balance_gap == score_balance_max - score_balance_min)

        sunhol_3rd_vars = []
        for d in doctors:
            sh_total = sum(self.day_shifts[(d, day)] + self.night_shifts[(d, day)] for day in sunhol_days)
            is_3rd = self.model.NewIntVar(0, 1, f"is_3rd_sh_d{d}")
            self.model.Add(is_3rd >= sh_total - 2)
            sunhol_3rd_vars.append(is_3rd)

        sunhol_3rd_sum = self.model.NewIntVar(0, 1000, "sunhol_3rd_sum")
        self.model.Add(sunhol_3rd_sum == sum(sunhol_3rd_vars))

        weekend_hol_3rd_vars = []
        if max_weekend_holiday_works is None:
            for d in doctors:
                weekend_hol_total = self.model.NewIntVar(0, 62, f"weekend_hol_count_d{d}")
                self.model.Add(weekend_hol_total == weekend_holiday_work_expr(d))
                is_3rd_weekend_hol = self.model.NewBoolVar(f"is_3rd_weekend_hol_d{d}")
                self.model.Add(weekend_hol_total >= 3).OnlyEnforceIf(is_3rd_weekend_hol)
                self.model.Add(weekend_hol_total <= 2).OnlyEnforceIf(is_3rd_weekend_hol.Not())
                weekend_hol_3rd_vars.append(is_3rd_weekend_hol)

        weekend_hol_3rd_sum = self.model.NewIntVar(0, 1000, "weekend_hol_3rd_sum")
        self.model.Add(weekend_hol_3rd_sum == sum(weekend_hol_3rd_vars))

        soft_unavail_sum = self.model.NewIntVar(0, 10000, "soft_unavail_sum")
        if soft_unavail_penalties:
            self.model.Add(soft_unavail_sum == sum(soft_unavail_penalties))
        else:
            self.model.Add(soft_unavail_sum == 0)

        w = self.objective_weights
        self.model.Minimize(
            w.month_fairness * fairness
            + w.sat_month_fairness * sat_month_gap
            + w.past_sat_gap * sat_gap
            + w.past_sunhol_gap * sunhol_gap
            + w.sunhol_fairness * sunhol_month_gap
            + w.gap5 * gap5_sum
            + w.gap6 * gap6_sum
            + w.sat_consec * (sat_consec_sum + sat_nth_sum)
            + w.score_balance * score_balance_gap
            + w.target * target_sum
            + w.sunhol_3rd * sunhol_3rd_sum
            + w.weekend_hol_3rd * weekend_hol_3rd_sum
            + w.soft_unavailable * soft_unavail_sum
        )
        self.max_score = max_score
        self.min_score = min_score

    def solve(self, time_limit_seconds: float = 5.0, random_seed: Optional[int] = None) -> Dict:
        holiday_shift_mode = str(self.hard_constraints.get("holiday_shift_mode", "split")).strip().lower()
        combined_mode = holiday_shift_mode == "combined"

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(time_limit_seconds)
        seed = int(random_seed) if random_seed is not None else random.SystemRandom().randint(1, 2**31 - 1)
        solver.parameters.random_seed = seed
        if hasattr(solver.parameters, "randomize_search"):
            solver.parameters.randomize_search = True
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
                day_data["night_shift"] = next(
                    (d for d in range(self.num_doctors) if solver.Value(self.night_shifts[(d, day)])), None
                )

                if self.is_sunday_or_holiday(day):
                    if combined_mode:
                        # Combined mode: same doctor handles both day and night (日当直)
                        day_data["day_shift"] = day_data["night_shift"]
                    else:
                        day_data["day_shift"] = next(
                            (d for d in range(self.num_doctors) if solver.Value(self.day_shifts[(d, day)])), None
                        )
                schedule.append(day_data)

            scores = {d: solver.Value(self.doctor_scores[d]) / 10.0 for d in range(self.num_doctors)}

            # Check which soft unavailable constraints were violated
            soft_unavail_violations = []
            for d_idx, day, shift_type, p_var in getattr(self, "_soft_unavail_vars_meta", []):
                if solver.Value(p_var) == 1:
                    soft_unavail_violations.append({
                        "doctor_idx": d_idx,
                        "day": day,
                        "shift_type": shift_type,
                    })

            result = {
                "success": True,
                "status": "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
                "schedule": schedule,
                "scores": scores,
            }
            if soft_unavail_violations:
                result["soft_unavail_violations"] = soft_unavail_violations
            return result

        return {
            "success": False,
            "message": "現在の設定では解が見つかりませんでした。ルールや不可日を見直してください。",
        }


    # ── P1-2 Phase 2: Constraint Diagnosis ──────────────────────

    def diagnose(
        self,
        doctor_names: Optional[Dict[int, str]] = None,
        time_limit_seconds: float = 5.0,
    ) -> Dict[str, Any]:
        """Run constraint diagnosis to identify why the model is infeasible.

        Returns a dict with:
          - conflict_groups: list of ConflictGroup-like dicts
          - specific_violations: list of human-readable strings
          - human_insights: list of statistical observations
          - phase_completed: int (1, 2, or 3)
        """
        self.doctor_names = doctor_names or {i: f"医師{i+1}" for i in range(self.num_doctors)}

        # Phase 1: Build diagnosis model with assumptions → find conflicting groups
        conflict_groups, assumption_map, diag_model = self._diagnose_phase1(time_limit_seconds)
        if not conflict_groups:
            # Phase 1 で特定できなかった場合でも、管理者設定の探索は実行
            solvable_removals = self._diagnose_try_settings(time_limit_per_try=2.0)
            staffing_violations = self._diagnose_staffing_shortage()

            specific = staffing_violations or (
                [] if solvable_removals else ["制約の競合を特定できませんでした。"]
            )
            return {
                "conflict_groups": [],
                "specific_violations": specific,
                "solvable_removals": solvable_removals,
                "human_insights": self._build_human_insights(),
                "phase_completed": 1,
            }

        # Phase 2: Soften conflicting groups → find specific violations
        specific_violations = self._diagnose_phase2(conflict_groups, time_limit_seconds)

        # Phase 2b: 管理者設定を変えて解けるか試行 → 最小変更値を探索
        solvable_removals = self._diagnose_try_settings(
            time_limit_per_try=min(time_limit_seconds, 2.0),
        )

        return {
            "conflict_groups": conflict_groups,
            "specific_violations": specific_violations,
            "solvable_removals": solvable_removals,
            "human_insights": self._build_human_insights(),
            "phase_completed": 2,
        }

    def _diagnose_staffing_shortage(self) -> List[str]:
        """日別に当直・日直可能な医師数を計算し、人手不足の日を特定する。"""
        doctors = range(self.num_doctors)
        days = range(1, self.num_days + 1)
        weekday_ja = ["月", "火", "水", "木", "金", "土", "日"]

        holiday_shift_mode = str(self.hard_constraints.get("holiday_shift_mode", "split")).strip().lower()
        combined_mode = holiday_shift_mode == "combined"
        spacing_days = self._get_hard_constraint_value(
            4, "interval_days", "min_interval_days", "spacing_days", "min_gap_days", "work_interval_days"
        )

        violations: List[str] = []
        critical_days: List[Dict[str, Any]] = []

        for day in days:
            date_obj = datetime.date(self.year, self.month, day)
            dow_label = weekday_ja[date_obj.weekday()]
            is_sunhol = self.is_sunday_or_holiday(day)
            needs_day_shift = is_sunhol and not combined_mode

            night_available: List[str] = []
            day_available: List[str] = []

            for d in doctors:
                night_blocked = False
                day_blocked = False

                # 個別不可日チェック
                for item in self.unavailable.get(d, []):
                    normalized = self._normalize_unavailable_entry(item)
                    if normalized is None:
                        continue
                    if normalized["date"] == day:
                        shift = normalized["target_shift"]
                        if shift in ("all", "night"):
                            night_blocked = True
                        if shift in ("all", "day"):
                            day_blocked = True

                # 固定不可曜日チェック
                for item in self.fixed_unavailable_weekdays.get(d, []):
                    normalized = self._normalize_fixed_weekday_entry(item)
                    if normalized is None:
                        continue
                    if self._matches_fixed_unavailable_weekday(day, normalized["day_of_week"]):
                        shift = normalized["target_shift"]
                        if shift in ("all", "night"):
                            night_blocked = True
                        if shift in ("all", "day"):
                            day_blocked = True

                doc_name = self.doctor_names.get(d, f"医師{d+1}")
                if not night_blocked:
                    night_available.append(doc_name)
                if not day_blocked:
                    day_available.append(doc_name)

            if len(night_available) == 0:
                violations.append(
                    f"{self.month}/{day}（{dow_label}）は当直可能な医師がいません"
                )
                critical_days.append({"day": day, "night": 0, "day_shift": len(day_available)})
            elif len(night_available) <= 2:
                violations.append(
                    f"{self.month}/{day}（{dow_label}）は当直可能な医師が{len(night_available)}名のみです（{', '.join(night_available)}）"
                )
                critical_days.append({"day": day, "night": len(night_available), "day_shift": len(day_available)})

            if needs_day_shift and len(day_available) == 0:
                violations.append(
                    f"{self.month}/{day}（{dow_label}）は日直可能な医師がいません"
                )
            elif needs_day_shift and len(day_available) <= 2:
                violations.append(
                    f"{self.month}/{day}（{dow_label}）は日直可能な医師が{len(day_available)}名のみです（{', '.join(day_available)}）"
                )

        # interval制約との組み合わせで詰む可能性を報告
        if critical_days and spacing_days and spacing_days > 0:
            for i in range(len(critical_days) - 1):
                gap = critical_days[i + 1]["day"] - critical_days[i]["day"]
                if gap <= spacing_days:
                    violations.append(
                        f"{self.month}/{critical_days[i]['day']}日と{critical_days[i+1]['day']}日が{gap}日差で、"
                        f"勤務間隔{spacing_days}日ルールと合わせると同じ医師が両方に入れません"
                    )

        return violations

    def _diagnose_phase1(
        self, time_limit_seconds: float = 5.0
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any], cp_model.CpModel]:
        """Phase 1: Build model with assumption literals, find MUS (minimal unsatisfiable subset)."""
        model = cp_model.CpModel()
        doctors = range(self.num_doctors)
        days = range(1, self.num_days + 1)

        holiday_shift_mode = str(self.hard_constraints.get("holiday_shift_mode", "split")).strip().lower()
        combined_mode = holiday_shift_mode == "combined"
        prevent_sunhol_consecutive = not combined_mode and not self._is_explicitly_disabled(
            self.hard_constraints.get("prevent_sunhol_consecutive", True)
        )
        respect_unavailable_days = not self._is_explicitly_disabled(
            self.hard_constraints.get("respect_unavailable_days", True)
        )

        spacing_days = self._get_hard_constraint_value(4, "interval_days", "min_interval_days", "spacing_days", "min_gap_days", "work_interval_days")
        max_saturday_nights = self._get_hard_constraint_value(1, "max_saturday_nights", "max_sat_nights", "sat_night_max", "saturday_night_max")
        max_sunhol_days = self._get_hard_constraint_value(2, "max_sunhol_days", "sunhol_day_max", "max_holiday_days", "max_sunday_holiday_days")
        max_sunhol_works = self._get_hard_constraint_value(3, "max_sunhol_works", "sunhol_work_max", "max_holiday_works", "max_sunday_holiday_works")
        max_weekend_holiday_works = self._get_hard_constraint_value(
            None, "max_weekend_holiday_works", "weekend_holiday_work_max", "weekend_hol_work_max",
            "max_weekend_holiday_count", "weekend_holiday_total_max", "weekend_hol_total_max", "max_shifts",
            flag_keys=("strict_weekend_hol_max",),
        )

        # --- Create variables (same as build_model) ---
        night_shifts: Dict[Tuple[int, int], cp_model.IntVar] = {}
        day_shifts: Dict[Tuple[int, int], cp_model.IntVar] = {}
        work: Dict[Tuple[int, int], cp_model.IntVar] = {}

        for d in doctors:
            for day in days:
                night_shifts[(d, day)] = model.NewBoolVar(f"night_d{d}_day{day}")
                day_shifts[(d, day)] = model.NewBoolVar(f"day_d{d}_day{day}")
                work[(d, day)] = model.NewBoolVar(f"work_d{d}_day{day}")
                model.Add(work[(d, day)] == night_shifts[(d, day)] + day_shifts[(d, day)])

        # --- Slot fulfillment (NOT wrapped — always enforced) ---
        for day in days:
            model.AddExactlyOne(night_shifts[(d, day)] for d in doctors)
            if self.is_sunday_or_holiday(day) and not combined_mode:
                model.AddExactlyOne(day_shifts[(d, day)] for d in doctors)
            else:
                for d in doctors:
                    model.Add(day_shifts[(d, day)] == 0)

        # --- Prevent same-day double (NOT wrapped — structural) ---
        if prevent_sunhol_consecutive:
            for d in doctors:
                for day in days:
                    model.Add(night_shifts[(d, day)] + day_shifts[(d, day)] <= 1)

        # --- Build assumption-wrapped constraints ---
        assumption_map: Dict[str, Dict[str, Any]] = {}  # assumption_name -> metadata

        def make_assumption(group_id: str, category: str, doctor_idx: Optional[int], description_ja: str):
            lit = model.NewBoolVar(f"assume_{group_id}")
            assumption_map[group_id] = {
                "literal": lit,
                "category": category,
                "doctor_idx": doctor_idx,
                "doctor_name": self.doctor_names.get(doctor_idx) if doctor_idx is not None else None,
                "description_ja": description_ja,
            }
            return lit

        # A) Locked shifts
        for item in self.locked_shifts:
            if not isinstance(item, dict):
                continue
            doctor_idx = item.get("doctor_idx")
            if doctor_idx is None:
                continue
            try:
                d = int(doctor_idx)
            except (TypeError, ValueError):
                continue
            if d < 0 or d >= self.num_doctors:
                continue
            day = self._parse_locked_day(item.get("date"))
            if day is None:
                continue
            shift = self._normalize_shift_type(item.get("shift_type"))
            if shift is None:
                continue

            shift_label = "当直" if shift == "night" else "日直"
            group_id = f"locked_d{d}_day{day}_{shift}"
            date_obj = datetime.date(self.year, self.month, day)
            weekday_ja = ["月", "火", "水", "木", "金", "土", "日"][date_obj.weekday()]
            lit = make_assumption(group_id, "locked", d, f"{self.doctor_names.get(d, f'医師{d+1}')}の{self.month}/{day}（{weekday_ja}）{shift_label}ロック")

            if shift == "night":
                model.Add(night_shifts[(d, day)] == 1).OnlyEnforceIf(lit)
            else:
                if combined_mode and self.is_sunday_or_holiday(day):
                    model.Add(night_shifts[(d, day)] == 1).OnlyEnforceIf(lit)
                else:
                    model.Add(day_shifts[(d, day)] == 1).OnlyEnforceIf(lit)

        # B) Unavailable days (hard only)
        for d, items in self.unavailable.items():
            for item in items:
                normalized = self._normalize_unavailable_entry(item)
                if normalized is None:
                    continue
                is_soft = normalized["is_soft_penalty"] or not respect_unavailable_days
                if is_soft:
                    continue  # skip soft in diagnosis

                day = normalized["date"]
                shift_type = normalized["target_shift"]
                date_obj = datetime.date(self.year, self.month, day)
                weekday_ja = ["月", "火", "水", "木", "金", "土", "日"][date_obj.weekday()]
                group_id = f"unavail_d{d}_day{day}"
                lit = make_assumption(group_id, "unavailable", d,
                    f"{self.doctor_names.get(d, f'医師{d+1}')}の{self.month}/{day}（{weekday_ja}）不可日")

                if shift_type in ["day", "all"]:
                    model.Add(day_shifts[(d, day)] == 0).OnlyEnforceIf(lit)
                if shift_type in ["night", "all"]:
                    model.Add(night_shifts[(d, day)] == 0).OnlyEnforceIf(lit)

        # C) Fixed weekday unavailable (hard only)
        weekday_names_ja = ["月曜", "火曜", "水曜", "木曜", "金曜", "土曜", "日曜", "祝日(日曜以外)"]
        for d, items in self.fixed_unavailable_weekdays.items():
            for item in items:
                normalized = self._normalize_fixed_weekday_entry(item)
                if normalized is None:
                    continue
                is_soft = normalized["is_soft_penalty"] or not respect_unavailable_days
                if is_soft:
                    continue

                target_dow = normalized["day_of_week"]
                shift_type = normalized["target_shift"]
                dow_label = weekday_names_ja[target_dow] if target_dow < len(weekday_names_ja) else f"曜日{target_dow}"
                group_id = f"fixdow_d{d}_dow{target_dow}"
                lit = make_assumption(group_id, "unavailable", d,
                    f"{self.doctor_names.get(d, f'医師{d+1}')}の{dow_label}固定不可")

                for day in days:
                    if not self._matches_fixed_unavailable_weekday(day, target_dow):
                        continue
                    if shift_type in ["day", "all"]:
                        model.Add(day_shifts[(d, day)] == 0).OnlyEnforceIf(lit)
                    if shift_type in ["night", "all"]:
                        model.Add(night_shifts[(d, day)] == 0).OnlyEnforceIf(lit)

        # D) Spacing rule (global)
        if spacing_days is not None:
            lit = make_assumption("interval_global", "interval", None, f"勤務間隔 {spacing_days}日ルール")
            for d in doctors:
                for day in days:
                    for k in range(1, spacing_days + 1):
                        if day + k <= self.num_days:
                            model.Add(work[(d, day)] + work[(d, day + k)] <= 1).OnlyEnforceIf(lit)

        # E) Month-cross spacing
        prev_month_worked_days, prev_last = self._build_previous_month_state()
        if spacing_days is not None and prev_last is not None:
            for d, prev_days_list in prev_month_worked_days.items():
                blocked_days = []
                for prev_day in prev_days_list:
                    dist_to_start = (prev_last - int(prev_day)) + 1
                    if 1 <= dist_to_start <= spacing_days:
                        block_until = spacing_days + 1 - dist_to_start
                        for bd in range(1, block_until + 1):
                            if 1 <= bd <= self.num_days:
                                blocked_days.append(bd)
                if blocked_days:
                    group_id = f"cross_month_d{d}"
                    lit = make_assumption(group_id, "cross_month", d,
                        f"{self.doctor_names.get(d, f'医師{d+1}')}の前月末勤務による月初ブロック（{min(blocked_days)}〜{max(blocked_days)}日）")
                    for bd in blocked_days:
                        model.Add(work[(d, bd)] == 0).OnlyEnforceIf(lit)

        saturdays = [day for day in days if self.is_saturday(day)]
        sunhol_days = [day for day in days if self.is_sunday_or_holiday(day)]

        # F) Saturday night cap (per doctor)
        if max_saturday_nights is not None:
            for d in doctors:
                group_id = f"sat_cap_d{d}"
                lit = make_assumption(group_id, "cap", d,
                    f"{self.doctor_names.get(d, f'医師{d+1}')}の土曜当直上限（月{max_saturday_nights}回）")
                model.Add(sum(night_shifts[(d, day)] for day in saturdays) <= max_saturday_nights).OnlyEnforceIf(lit)

        # G) Sun/holiday day cap (per doctor)
        if max_sunhol_days is not None:
            for d in doctors:
                group_id = f"sunhol_day_cap_d{d}"
                lit = make_assumption(group_id, "cap", d,
                    f"{self.doctor_names.get(d, f'医師{d+1}')}の日祝日直上限（月{max_sunhol_days}回）")
                model.Add(sum(day_shifts[(d, day)] for day in sunhol_days) <= max_sunhol_days).OnlyEnforceIf(lit)

        # H) Sun/holiday total work cap (per doctor)
        if max_sunhol_works is not None:
            for d in doctors:
                group_id = f"sunhol_work_cap_d{d}"
                lit = make_assumption(group_id, "cap", d,
                    f"{self.doctor_names.get(d, f'医師{d+1}')}の日祝合計上限（月{max_sunhol_works}回）")
                model.Add(sum(day_shifts[(d, day)] + night_shifts[(d, day)] for day in sunhol_days) <= max_sunhol_works).OnlyEnforceIf(lit)

        # I) Weekend/holiday total cap (per doctor)
        if max_weekend_holiday_works is not None:
            for d in doctors:
                group_id = f"wh_cap_d{d}"
                wh_expr = sum(
                    day_shifts[(d, day)] + night_shifts[(d, day)]
                    if self.is_sunday_or_holiday(day)
                    else night_shifts[(d, day)]
                    for day in days
                    if self.is_sunday_or_holiday(day) or self.is_saturday(day)
                )
                lit = make_assumption(group_id, "cap", d,
                    f"{self.doctor_names.get(d, f'医師{d+1}')}の土日祝合計上限（月{max_weekend_holiday_works}回）")
                model.Add(wh_expr <= max_weekend_holiday_works).OnlyEnforceIf(lit)

        # J) Score min/max (per doctor)
        for d in doctors:
            score_expr = 0
            for day in days:
                if self.is_sunday_or_holiday(day):
                    if combined_mode:
                        score_expr += night_shifts[(d, day)] * self.W_DAY_NIGHT
                    else:
                        score_expr += day_shifts[(d, day)] * self.W_SUNHOL_DAY
                        score_expr += night_shifts[(d, day)] * self.W_SUNHOL_NIGHT
                elif self.is_saturday(day):
                    score_expr += night_shifts[(d, day)] * self.W_SAT_NIGHT
                else:
                    score_expr += night_shifts[(d, day)] * self.W_WEEKDAY_NIGHT

            doc_score = model.NewIntVar(0, 2000, f"diag_score_d{d}")
            model.Add(doc_score == score_expr)

            d_min = int(round(self.min_score_by_doctor.get(d, self.score_min_float) * 10))
            d_max = int(round(self.max_score_by_doctor.get(d, self.score_max_float) * 10))

            lit_min = make_assumption(f"score_min_d{d}", "score", d,
                f"{self.doctor_names.get(d, f'医師{d+1}')}のスコア下限（{d_min/10:.1f}点）")
            model.Add(doc_score >= d_min).OnlyEnforceIf(lit_min)

            lit_max = make_assumption(f"score_max_d{d}", "score", d,
                f"{self.doctor_names.get(d, f'医師{d+1}')}のスコア上限（{d_max/10:.1f}点）")
            model.Add(doc_score <= d_max).OnlyEnforceIf(lit_max)

        # --- Solve with assumptions ---
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(time_limit_seconds)

        all_assumptions = [info["literal"] for info in assumption_map.values()]
        model.AddAssumptions(all_assumptions)

        status = solver.Solve(model)

        if status == cp_model.INFEASIBLE:
            sufficient = solver.SufficientAssumptionsForInfeasibility()
            sufficient_set = set(sufficient)

            conflict_groups = []
            for group_id, info in assumption_map.items():
                if info["literal"].Index() in sufficient_set:
                    conflict_groups.append({
                        "group_id": group_id,
                        "category": info["category"],
                        "doctor_name": info["doctor_name"],
                        "description_ja": info["description_ja"],
                    })
            if conflict_groups:
                return conflict_groups, assumption_map, model
            # INFEASIBLEだがsufficient_setが空 → フォールバックへ

        # 解けた（人手不足ではない）orタイムアウトor原因不明 → 人手不足チェックへ
        return [], assumption_map, model

    def _diagnose_try_settings(
        self,
        time_limit_per_try: float = 2.0,
    ) -> List[Dict[str, Any]]:
        """管理者設定を1つずつ外して再ソルブし、解ける設定の最小変更値を探す。

        流れ:
        1. 各設定（interval, wh_max, sat_max）を外してモデル再構築→ソルブ
        2. 解ければ、元の値から段階的に変えて「どの値で解けるか」を探索
        3. 「土日祝上限を2→3にすれば解けます」のように具体的に返す
        """
        results: List[Dict[str, Any]] = []

        # 現在の設定値を取得
        current_interval = self._get_hard_constraint_value(
            4, "interval_days", "min_interval_days", "spacing_days", "min_gap_days", "work_interval_days"
        )
        current_wh_max = self._get_hard_constraint_value(
            None, "max_weekend_holiday_works", "weekend_holiday_work_max", "weekend_hol_work_max",
            "max_weekend_holiday_count", "weekend_holiday_total_max", "weekend_hol_total_max", "max_shifts",
            flag_keys=("strict_weekend_hol_max",),
        )
        current_sat_max = self._get_hard_constraint_value(
            1, "max_saturday_nights", "max_sat_nights", "sat_night_max", "saturday_night_max"
        )

        # 試す設定: (名前, キー, 現在値, 外した値, 探索方向, ラベル)
        settings_to_try = []
        if current_interval is not None and current_interval > 0:
            settings_to_try.append({
                "name": "interval_days",
                "current": current_interval,
                "removed_value": 0,  # 外す = 間隔なし
                "search_range": list(range(current_interval - 1, -1, -1)),  # 現在値-1 → 0
                "label": "勤務間隔",
                "unit": "日",
                "direction": "decrease",
            })
        if current_wh_max is not None:
            num_wh_days = sum(1 for day in range(1, self.num_days + 1) if self.is_sunday_or_holiday(day) or self.is_saturday(day))
            settings_to_try.append({
                "name": "max_weekend_holiday_works",
                "current": current_wh_max,
                "removed_value": None,  # 外す = 上限なし
                "search_range": list(range(current_wh_max + 1, min(current_wh_max + 6, num_wh_days + 1))),
                "label": "土日祝合算上限",
                "unit": "回",
                "direction": "increase",
            })
        if current_sat_max is not None:
            num_sats = sum(1 for day in range(1, self.num_days + 1) if self.is_saturday(day))
            settings_to_try.append({
                "name": "max_saturday_nights",
                "current": current_sat_max,
                "removed_value": None,  # 外す = 上限なし
                "search_range": list(range(current_sat_max + 1, min(current_sat_max + 4, num_sats + 1))),
                "label": "土曜当直上限",
                "unit": "回",
                "direction": "increase",
            })

        def try_solve_with(overrides: Dict[str, Any]) -> bool:
            """設定を変えてモデル再構築→ソルブ。"""
            hc = dict(self.hard_constraints)
            hc.update(overrides)
            trial = OnCallOptimizer(
                num_doctors=self.num_doctors,
                year=self.year,
                month=self.month,
                holidays=self.holidays,
                unavailable=self.unavailable,
                fixed_unavailable_weekdays=self.fixed_unavailable_weekdays,
                prev_month_worked_days=self.prev_month_worked_days,
                prev_month_last_day=self.prev_month_last_day,
                previous_month_shifts=self.previous_month_shifts,
                hard_constraints=hc,
                locked_shifts=self.locked_shifts,
            )
            trial.build_model()
            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = time_limit_per_try
            status = solver.Solve(trial.model)
            return status in (cp_model.FEASIBLE, cp_model.OPTIMAL)

        for setting in settings_to_try:
            name = setting["name"]
            current = setting["current"]

            # Step 1: 設定を外して解けるか
            override_removed = {name: setting["removed_value"]}
            if not try_solve_with(override_removed):
                continue  # この設定を外しても解けない → スキップ

            # Step 2: 最小変更値を探索
            found_value = setting["removed_value"]
            for try_value in setting["search_range"]:
                if try_solve_with({name: try_value}):
                    found_value = try_value
                    break

            # 結果を追加
            if found_value is not None:
                if setting["direction"] == "decrease":
                    desc = f"{setting['label']}を{current}{setting['unit']}→{found_value}{setting['unit']}に下げれば解けます"
                else:
                    desc = f"{setting['label']}を{current}{setting['unit']}→{found_value}{setting['unit']}に上げれば解けます"
            else:
                desc = f"{setting['label']}の制限を外せば解けます"

            results.append({
                "group_id": f"setting_{name}",
                "category": "admin_setting",
                "doctor_name": None,
                "description_ja": desc,
                "is_admin_setting": True,
                "setting_name": name,
                "current_value": current,
                "suggested_value": found_value,
            })

        return results

    def _diagnose_phase2(
        self, conflict_groups: List[Dict[str, Any]], time_limit_seconds: float = 5.0
    ) -> List[str]:
        """Phase 2: Generate specific actionable suggestions based on conflict groups."""
        violations: List[str] = []

        # Count by category
        categories = {}
        for g in conflict_groups:
            cat = g["category"]
            categories.setdefault(cat, []).append(g)

        if "interval" in categories:
            spacing_days = self._get_hard_constraint_value(4, "interval_days", "min_interval_days", "spacing_days", "min_gap_days", "work_interval_days")
            if spacing_days and spacing_days > 1:
                violations.append(f"勤務間隔を{spacing_days}日→{spacing_days - 1}日に緩和すると解ける可能性があります")

        if "unavailable" in categories:
            unavail_groups = categories["unavailable"]
            for g in unavail_groups[:5]:
                violations.append(f"{g['description_ja']}を解除すると解ける可能性があります")

        if "score" in categories:
            score_groups = categories["score"]
            min_groups = [g for g in score_groups if "下限" in g["description_ja"]]
            max_groups = [g for g in score_groups if "上限" in g["description_ja"]]
            if min_groups:
                violations.append(f"スコア下限を下げると解ける可能性があります（対象: {', '.join(g.get('doctor_name', '?') for g in min_groups)}）")
            if max_groups:
                violations.append(f"スコア上限を上げると解ける可能性があります（対象: {', '.join(g.get('doctor_name', '?') for g in max_groups)}）")

        if "cap" in categories:
            cap_groups = categories["cap"]
            # Group by constraint type (strip doctor name prefix)
            cap_by_type: Dict[str, List[str]] = {}
            for g in cap_groups:
                desc = g["description_ja"]
                doctor_name = g.get("doctor_name", "")
                # Extract constraint label: "医師Xの土曜当直上限（月1回）" → "土曜当直上限（月1回）"
                constraint_label = desc
                if doctor_name and "の" in desc:
                    constraint_label = desc.split("の", 1)[1]
                cap_by_type.setdefault(constraint_label, []).append(doctor_name)
            for label, names in cap_by_type.items():
                if len(names) <= 3:
                    violations.append(f"{label}を引き上げると解ける可能性があります（{', '.join(names)}）")
                else:
                    violations.append(f"{label}を引き上げると解ける可能性があります（{len(names)}名が該当）")

        if "locked" in categories:
            locked_groups = categories["locked"]
            for g in locked_groups:
                violations.append(f"{g['description_ja']}を解除すると解ける可能性があります")

        if "cross_month" in categories:
            violations.append("前月末の勤務により月初の割当可能枠が不足しています")

        if not violations:
            violations.append("制約の競合を特定しましたが、具体的な解決策を生成できませんでした")

        return violations

    def _build_human_insights(self) -> List[str]:
        """Build statistical observations that a human scheduler would notice."""
        insights: List[str] = []
        days = range(1, self.num_days + 1)

        # 1) Same-day unavailable concentration (deduplicate per doctor per day)
        day_unavail_doctors: Dict[int, set] = {}
        for d, items in self.unavailable.items():
            name = self.doctor_names.get(d, f"医師{d+1}")
            for item in items:
                normalized = self._normalize_unavailable_entry(item)
                if normalized is None or normalized["is_soft_penalty"]:
                    continue
                day_unavail_doctors.setdefault(normalized["date"], set()).add(name)
        # Also include fixed weekday unavailable (expand to actual dates)
        for d, items in self.fixed_unavailable_weekdays.items():
            name = self.doctor_names.get(d, f"医師{d+1}")
            for item in items:
                normalized = self._normalize_fixed_weekday_entry(item)
                if normalized is None or normalized["is_soft_penalty"]:
                    continue
                for day in days:
                    if self._matches_fixed_unavailable_weekday(day, normalized["day_of_week"]):
                        day_unavail_doctors.setdefault(day, set()).add(name)

        # Only show days where >60% of doctors are unavailable (truly critical), top 5
        threshold = max(2, self.num_doctors * 0.6)
        critical_days = []
        for day in sorted(day_unavail_doctors.keys()):
            names = sorted(day_unavail_doctors[day])
            if len(names) >= threshold:
                date_obj = datetime.date(self.year, self.month, day)
                weekday_ja = ["月", "火", "水", "木", "金", "土", "日"][date_obj.weekday()]
                holiday_tag = "・祝" if self.is_holiday(day) else ""
                critical_days.append((len(names), day,
                    f"{self.month}/{day}（{weekday_ja}{holiday_tag}）に{self.num_doctors}人中{len(names)}人が不可"
                ))
        # Sort by severity (most unavailable first), take top 5
        critical_days.sort(key=lambda x: -x[0])
        for _, _, msg in critical_days[:5]:
            insights.append(msg)

        # 2) Doctors with very high unavailable ratio (>60%), top 3
        high_unavail_doctors: List[Tuple[float, int, int]] = []
        for d in range(self.num_doctors):
            unavail_days: set = set()
            for item in self.unavailable.get(d, []):
                normalized = self._normalize_unavailable_entry(item)
                if normalized and not normalized["is_soft_penalty"]:
                    unavail_days.add(normalized["date"])
            for item in self.fixed_unavailable_weekdays.get(d, []):
                normalized = self._normalize_fixed_weekday_entry(item)
                if normalized and not normalized["is_soft_penalty"]:
                    for day in days:
                        if self._matches_fixed_unavailable_weekday(day, normalized["day_of_week"]):
                            unavail_days.add(day)

            hard_count = len(unavail_days)
            ratio = hard_count / self.num_days if self.num_days > 0 else 0
            if ratio > 0.60:
                high_unavail_doctors.append((ratio, d, hard_count))

        # Sort by severity, show top 3
        high_unavail_doctors.sort(key=lambda x: -x[0])
        for ratio, d, hard_count in high_unavail_doctors[:3]:
            insights.append(
                f"{self.doctor_names.get(d, f'医師{d+1}')}: {self.num_days}日中{hard_count}日が不可（不可率{ratio:.0%}）"
            )

        # 3) Many holidays
        if len(self.holidays) >= 4:
            insights.append(f"祝日が{len(self.holidays)}日（通常月は1〜2日）")

        # 4) Weekend/holiday slot pressure
        sunhol_days = [day for day in days if self.is_sunday_or_holiday(day)]
        saturdays = [day for day in days if self.is_saturday(day)]
        total_wh_slots = len(sunhol_days) * 2 + len(saturdays)  # day+night for sunhol, night for sat

        max_wh = self._get_hard_constraint_value(
            None, "max_weekend_holiday_works", "weekend_holiday_work_max", "weekend_hol_work_max",
            "max_weekend_holiday_count", "weekend_holiday_total_max", "weekend_hol_total_max", "max_shifts",
            flag_keys=("strict_weekend_hol_max",),
        )
        if max_wh is not None:
            capacity = max_wh * self.num_doctors
            if capacity < total_wh_slots:
                insights.append(f"土日祝スロット{total_wh_slots}枠に対し上限合計{capacity}枠（不足{total_wh_slots - capacity}枠）")
            elif capacity - total_wh_slots <= 2:
                insights.append(f"土日祝スロット{total_wh_slots}枠に対し上限合計{capacity}枠（余裕わずか{capacity - total_wh_slots}枠）")

        # 5) Score range tightness
        score_min = self.score_min_float
        score_max = self.score_max_float
        if score_max - score_min <= 1.5:
            insights.append(f"スコア許容幅が{score_min}〜{score_max}（幅{score_max - score_min:.1f}点）と狭い")

        # 6) Fixed weekday unavailable concentration (deduplicate per doctor per weekday)
        dow_doctors: Dict[int, set] = {}
        for d, items in self.fixed_unavailable_weekdays.items():
            name = self.doctor_names.get(d, f"医師{d+1}")
            for item in items:
                normalized = self._normalize_fixed_weekday_entry(item)
                if normalized and not normalized["is_soft_penalty"]:
                    dow_doctors.setdefault(normalized["day_of_week"], set()).add(name)
        weekday_names = ["月曜", "火曜", "水曜", "木曜", "金曜", "土曜", "日曜"]
        for dow, names in sorted(dow_doctors.items()):
            if dow < 7 and len(names) > self.num_doctors * 0.5:
                insights.append(
                    f"{weekday_names[dow]}の当直に{self.num_doctors}人中{len(names)}人が固定不可（外来日？）"
                )

        # 7) Spacing vs doctor count margin
        spacing_days = self._get_hard_constraint_value(4, "interval_days", "min_interval_days", "spacing_days", "min_gap_days", "work_interval_days")
        if spacing_days is not None and spacing_days > 0:
            import math
            max_per_doc = math.ceil(self.num_days / (spacing_days + 1))
            total_capacity = max_per_doc * self.num_doctors
            total_slots = self.num_days  # night shifts every day
            if total_capacity - total_slots <= 2:
                insights.append(
                    f"間隔{spacing_days}日・医師{self.num_doctors}人 → 最大{total_capacity}枠、必要{total_slots}枠（ギリギリ）"
                )

        return insights


if __name__ == "__main__":
    # 簡易動作確認用
    optimizer = OnCallOptimizer(
        num_doctors=10,
        year=2024,
        month=4,
        holidays=[29],
        unavailable={0: [{"date": 1, "target_shift": "all", "is_soft_penalty": False}]},
        fixed_unavailable_weekdays={2: [{"day_of_week": 0, "target_shift": "all", "is_soft_penalty": False}]},
        prev_month_worked_days={0: [30]},
        prev_month_last_day=31,
        sat_prev={0: True},
    )
    optimizer.build_model()
    print(optimizer.solve())



