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
    month_fairness: int = 100
    past_sat_gap: int = 10
    past_sunhol_gap: int = 5
    gap5: int = 100
    gap6: int = 50

    sat_consec: int = 80
    score_balance: int = 30
    target: int = 10
    sunhol_fairness: int = 200
    sunhol_3rd: int = 80
    weekend_hol_3rd: int = 0
    soft_unavailable: int = 100


class OnCallOptimizer:
    """CP-SAT model for monthly on-call schedule generation."""

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

        ow = objective_weights or {}
        self.objective_weights = ObjectiveWeights(
            month_fairness=int(ow.get("month_fairness", 100)),
            past_sat_gap=int(ow.get("past_sat_gap", 10)),
            past_sunhol_gap=int(ow.get("past_sunhol_gap", 5)),
            gap5=int(ow.get("gap5", 100)),
            gap6=int(ow.get("gap6", 50)),
            sat_consec=int(ow.get("sat_consec", 80)),
            score_balance=int(ow.get("score_balance", 30)),
            target=int(ow.get("target", 10)),
            sunhol_fairness=int(ow.get("sunhol_fairness", 200)),
            sunhol_3rd=int(ow.get("sunhol_3rd", 80)),
            weekend_hol_3rd=int(ow.get("weekend_hol_3rd", 0)),
            soft_unavailable=int(ow.get("soft_unavailable", 100)),
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

    def build_model(self) -> None:
        doctors = range(self.num_doctors)
        days = range(1, self.num_days + 1)
        prevent_sunhol_consecutive = not self._is_explicitly_disabled(
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
            if self.is_sunday_or_holiday(day):
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
                self.model.Add(self.day_shifts[(d, day)] == 1)

        # === apply unavailable constraints ===
        soft_unavail_penalties = []

        # 4) hard/soft: apply date-based unavailable constraints
        if respect_unavailable_days:
            for d, items in self.unavailable.items():
                for item in items:
                    normalized = self._normalize_unavailable_entry(item)
                    if normalized is None:
                        continue

                    day = normalized["date"]
                    shift_type = normalized["target_shift"]
                    is_soft = normalized["is_soft_penalty"]

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
                    is_soft = normalized["is_soft_penalty"]

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

        gap5_vars = []
        gap6_vars = []
        for d in doctors:
            for day in days:
                if day + 5 <= self.num_days:
                    gap5_bool = self.model.NewBoolVar(f"gap5_d{d}_day{day}")
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

        sat_consec_vars = []
        for d in doctors:
            if self.sat_prev.get(d, False):
                sat_month_bool = self.model.NewBoolVar(f"sat_month_bool_d{d}")
                self.model.AddMaxEquality(sat_month_bool, [self.night_shifts[(d, sat)] for sat in saturdays])
                sat_consec_vars.append(sat_month_bool)

        sat_consec_sum = self.model.NewIntVar(0, 1000, "sat_consec_sum")
        self.model.Add(sat_consec_sum == sum(sat_consec_vars))

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

        max_score = self.model.NewIntVar(0, 2000, "max_score")
        min_score = self.model.NewIntVar(0, 2000, "min_score")
        self.model.AddMaxEquality(max_score, doctor_scores)
        self.model.AddMinEquality(min_score, doctor_scores)
        fairness = self.model.NewIntVar(0, 2000, "fairness")
        self.model.Add(fairness == max_score - min_score)

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
            + w.past_sat_gap * sat_gap
            + w.past_sunhol_gap * sunhol_gap
            + w.sunhol_fairness * sunhol_month_gap
            + w.gap5 * gap5_sum
            + w.gap6 * gap6_sum
            + w.sat_consec * sat_consec_sum
            + w.score_balance * score_balance_gap
            + w.target * target_sum
            + w.sunhol_3rd * sunhol_3rd_sum
            + w.weekend_hol_3rd * weekend_hol_3rd_sum
            + w.soft_unavailable * soft_unavail_sum
        )
        self.max_score = max_score
        self.min_score = min_score

    def solve(self, time_limit_seconds: float = 10.0, random_seed: Optional[int] = None) -> Dict:
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
                    day_data["day_shift"] = next(
                        (d for d in range(self.num_doctors) if solver.Value(self.day_shifts[(d, day)])), None
                    )
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
            "message": "No feasible schedule found with the current hard constraints.",
        }


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



