import calendar
import datetime

from services.optimizer import OnCallOptimizer


SEED = 123


def _collect_assignments(schedule):
    out = []
    for row in schedule:
        day = row["day"]
        if row.get("night_shift") is not None:
            out.append((row["night_shift"], day))
        if row.get("day_shift") is not None:
            out.append((row["day_shift"], day))
    return out


def _count_weekend_holiday_works(schedule, year, month, num_doctors):
    counts = {d: 0 for d in range(num_doctors)}
    for row in schedule:
        day = row["day"]
        weekday = datetime.date(year, month, day).weekday()
        if row["is_sunhol"]:
            counts[row["night_shift"]] += 1
            if row["day_shift"] is not None:
                counts[row["day_shift"]] += 1
        elif weekday == 5 and row["night_shift"] is not None:
            counts[row["night_shift"]] += 1
    return counts


def test_fill_all_slots_weekday_only():
    opt = OnCallOptimizer(num_doctors=6, year=2024, month=4, holidays=[], score_max=100.0)
    opt.build_model()
    res = opt.solve(random_seed=SEED)
    assert res["success"] is True
    assert len(res["schedule"]) == calendar.monthrange(2024, 4)[1]
    for row in res["schedule"]:
        assert row["night_shift"] is not None

def test_objective_weights_accepts_month_fairness():
    opt = OnCallOptimizer(
        num_doctors=6,
        year=2024,
        month=4,
        holidays=[],
        objective_weights={"month_fairness": 123},
    )
    assert opt.objective_weights.month_fairness == 123

def test_sun_holiday_has_day_and_night_and_not_same_doctor():
    opt = OnCallOptimizer(num_doctors=8, year=2024, month=4, holidays=[29])
    opt.build_model()
    res = opt.solve(random_seed=SEED)
    assert res["success"] is True

    for row in res["schedule"]:
        day = row["day"]
        is_sun = datetime.date(2024, 4, day).weekday() == 6
        is_hol = day == 29
        if is_sun or is_hol:
            assert row["day_shift"] is not None
            assert row["night_shift"] is not None
            assert row["day_shift"] != row["night_shift"]
        else:
            assert row["day_shift"] is None


def test_unavailable_blocks_assignments():
    opt = OnCallOptimizer(
        num_doctors=6,
        year=2024,
        month=4,
        holidays=[],
        unavailable={0: [5]},
        score_max=100.0,
    )
    opt.build_model()
    res = opt.solve(random_seed=SEED)
    assert res["success"] is True

    row5 = next(r for r in res["schedule"] if r["day"] == 5)
    assert row5["night_shift"] != 0
    assert row5["day_shift"] is None


def test_fixed_unavailable_weekday_blocks_all_matching_dates():
    opt = OnCallOptimizer(
        num_doctors=8,
        year=2024,
        month=4,
        fixed_unavailable_weekdays={0: [0]},
    )
    opt.build_model()
    res = opt.solve(random_seed=SEED)
    assert res["success"] is True

    for row in res["schedule"]:
        day = row["day"]
        wd = datetime.date(2024, 4, day).weekday()
        if wd == 0:
            assert row["night_shift"] != 0
            if row["day_shift"] is not None:
                assert row["day_shift"] != 0


def test_unavailable_dict_format_blocks_target_shift_only():
    opt = OnCallOptimizer(
        num_doctors=6,
        year=2024,
        month=4,
        holidays=[7],
        unavailable={0: [{"date": 7, "target_shift": "night", "is_soft_penalty": False}]},
        score_max=100.0,
    )
    opt.build_model()
    res = opt.solve(random_seed=SEED)
    assert res["success"] is True

    row = next(r for r in res["schedule"] if r["day"] == 7)
    assert row["night_shift"] != 0


def test_fixed_unavailable_weekday_dict_format_blocks_matching_night_shifts():
    opt = OnCallOptimizer(
        num_doctors=8,
        year=2024,
        month=4,
        fixed_unavailable_weekdays={0: [{"day_of_week": 0, "target_shift": "night", "is_soft_penalty": False}]},
    )
    opt.build_model()
    res = opt.solve(random_seed=SEED)
    assert res["success"] is True

    for row in res["schedule"]:
        day = row["day"]
        wd = datetime.date(2024, 4, day).weekday()
        if wd == 0:
            assert row["night_shift"] != 0


def test_fixed_unavailable_weekday_no_longer_blocks_previous_day():
    opt = OnCallOptimizer(
        num_doctors=10,
        year=2024,
        month=4,
        fixed_unavailable_weekdays={0: [{"day_of_week": 0, "target_shift": "all", "is_soft_penalty": False}]},
        locked_shifts=[{"date": 7, "shift_type": "night", "doctor_idx": 0}],
    )
    opt.build_model()
    res = opt.solve(random_seed=SEED)
    assert res["success"] is True

    row7 = next(r for r in res["schedule"] if r["day"] == 7)
    assert row7["night_shift"] == 0


def test_spacing_rule_min_4_days_apart():
    opt = OnCallOptimizer(num_doctors=12, year=2024, month=4, holidays=[29])
    opt.build_model()
    res = opt.solve(random_seed=SEED)
    assert res["success"] is True

    assigns = _collect_assignments(res["schedule"])
    by_doc = {}
    for d, day in assigns:
        by_doc.setdefault(d, []).append(day)

    for days in by_doc.values():
        days_sorted = sorted(days)
        for i in range(len(days_sorted) - 1):
            gap = days_sorted[i + 1] - days_sorted[i]
            assert gap >= 5


def test_month_cross_spacing_blocks_early_days():
    opt = OnCallOptimizer(
        num_doctors=10,
        year=2024,
        month=4,
        prev_month_last_day=31,
        prev_month_worked_days={0: [31]},
    )
    opt.build_model()
    res = opt.solve(random_seed=SEED)
    assert res["success"] is True

    for day in range(1, 5):
        row = next(r for r in res["schedule"] if r["day"] == day)
        assert row["night_shift"] != 0
        if row["day_shift"] is not None:
            assert row["day_shift"] != 0



def test_month_cross_spacing_accepts_previous_month_shifts_payload():
    opt = OnCallOptimizer(
        num_doctors=10,
        year=2024,
        month=4,
        prev_month_last_day=31,
        previous_month_shifts=[
            {"date": "2024-03-31", "shift_type": "night", "doctor_idx": 0},
        ],
    )
    opt.build_model()
    res = opt.solve(random_seed=SEED)
    assert res["success"] is True

    for day in range(1, 5):
        row = next(r for r in res["schedule"] if r["day"] == day)
        assert row["night_shift"] != 0
        if row["day_shift"] is not None:
            assert row["day_shift"] != 0

def test_score_bounds_enforced_or_infeasible():
    opt = OnCallOptimizer(
        num_doctors=8,
        year=2024,
        month=4,
        score_min=2.0,
        score_max=2.0,
    )
    opt.build_model()
    res = opt.solve(random_seed=SEED)
    if res["success"]:
        for s in res["scores"].values():
            assert abs(s - 2.0) < 1e-9
    else:
        assert res["message"]


def test_sunhol_fairness_keeps_monthly_gap_within_one_when_evenly_feasible():
    opt = OnCallOptimizer(num_doctors=10, year=2024, month=4, holidays=[29])
    opt.build_model()
    res = opt.solve(random_seed=SEED)
    assert res["success"] is True

    counts = {d: 0 for d in range(10)}
    for row in res["schedule"]:
        if not row["is_sunhol"]:
            continue
        counts[row["night_shift"]] += 1
        if row["day_shift"] is not None:
            counts[row["day_shift"]] += 1

    spread = max(counts.values()) - min(counts.values())
    assert spread <= 1


def test_hard_constraints_can_disable_spacing_rule():
    opt = OnCallOptimizer(
        num_doctors=10,
        year=2024,
        month=4,
        hard_constraints={"interval_days": 0},
        locked_shifts=[
            {"date": 1, "shift_type": "night", "doctor_idx": 0},
            {"date": 5, "shift_type": "night", "doctor_idx": 0},
        ],
    )
    opt.build_model()
    res = opt.solve(random_seed=SEED)

    assert res["success"] is True
    row1 = next(r for r in res["schedule"] if r["day"] == 1)
    row5 = next(r for r in res["schedule"] if r["day"] == 5)
    assert row1["night_shift"] == 0
    assert row5["night_shift"] == 0



def test_hard_constraints_zero_can_skip_new_monthly_caps():
    opt = OnCallOptimizer(
        num_doctors=10,
        year=2024,
        month=4,
        hard_constraints={
            "interval_days": 0,
            "max_saturday_nights": 0,
            "max_sunhol_days": 0,
            "max_sunhol_works": 0,
        },
        locked_shifts=[
            {"date": 6, "shift_type": "night", "doctor_idx": 0},
            {"date": 13, "shift_type": "night", "doctor_idx": 0},
            {"date": 7, "shift_type": "day", "doctor_idx": 0},
            {"date": 14, "shift_type": "day", "doctor_idx": 0},
            {"date": 21, "shift_type": "day", "doctor_idx": 0},
            {"date": 28, "shift_type": "night", "doctor_idx": 0},
        ],
    )
    opt.build_model()
    res = opt.solve(random_seed=SEED)

    assert res["success"] is True
    for date, shift_type in [
        (6, "night_shift"),
        (13, "night_shift"),
        (7, "day_shift"),
        (14, "day_shift"),
        (21, "day_shift"),
        (28, "night_shift"),
    ]:
        row = next(r for r in res["schedule"] if r["day"] == date)
        assert row[shift_type] == 0


def test_hard_constraints_can_allow_same_doctor_for_sunhol_day_and_night():
    opt = OnCallOptimizer(
        num_doctors=8,
        year=2024,
        month=4,
        holidays=[29],
        hard_constraints={"prevent_sunhol_consecutive": False},
        locked_shifts=[
            {"date": 29, "shift_type": "day", "doctor_idx": 0},
            {"date": 29, "shift_type": "night", "doctor_idx": 0},
        ],
    )
    opt.build_model()
    res = opt.solve(random_seed=SEED)

    assert res["success"] is True
    row = next(r for r in res["schedule"] if r["day"] == 29)
    assert row["day_shift"] == 0
    assert row["night_shift"] == 0


def test_hard_constraints_can_ignore_unavailable_day_rules():
    opt = OnCallOptimizer(
        num_doctors=8,
        year=2024,
        month=4,
        unavailable={0: [8]},
        fixed_unavailable_weekdays={0: [0]},
        hard_constraints={"respect_unavailable_days": False},
        locked_shifts=[{"date": 8, "shift_type": "night", "doctor_idx": 0}],
    )
    opt.build_model()
    res = opt.solve(random_seed=SEED)

    assert res["success"] is True
    row = next(r for r in res["schedule"] if r["day"] == 8)
    assert row["night_shift"] == 0


def test_respect_unavailable_days_flag_does_not_disable_previous_month_spacing():
    opt = OnCallOptimizer(
        num_doctors=10,
        year=2024,
        month=4,
        prev_month_last_day=31,
        prev_month_worked_days={0: [31]},
        hard_constraints={"respect_unavailable_days": False},
        locked_shifts=[{"date": 1, "shift_type": "night", "doctor_idx": 0}],
    )
    opt.build_model()
    res = opt.solve(random_seed=SEED)

    assert res["success"] is False
    assert res["message"]


def test_hard_constraints_can_cap_combined_weekend_holiday_works():
    opt = OnCallOptimizer(
        num_doctors=10,
        year=2024,
        month=4,
        hard_constraints={"max_weekend_holiday_works": 2},
        locked_shifts=[
            {"date": 6, "shift_type": "night", "doctor_idx": 0},
            {"date": 7, "shift_type": "day", "doctor_idx": 0},
            {"date": 14, "shift_type": "night", "doctor_idx": 0},
        ],
    )
    opt.build_model()
    res = opt.solve(random_seed=SEED)

    assert res["success"] is False


def test_weekend_hol_3rd_penalty_avoids_three_or_more_when_evenly_feasible():
    opt = OnCallOptimizer(
        num_doctors=7,
        year=2024,
        month=4,
        holidays=[29],
        objective_weights={
            "month_fairness": 0,
            "past_sat_gap": 0,
            "past_sunhol_gap": 0,
            "ideal_gap_weight": 0,
            "ideal_gap_extra": 0,
            "sat_consec": 0,
            "score_balance": 0,
            "target": 0,
            "sunhol_fairness": 0,
            "sunhol_3rd": 0,
            "weekend_hol_3rd": 200,
            "soft_unavailable": 0,
        },
    )
    opt.build_model()
    res = opt.solve(random_seed=SEED)

    assert res["success"] is True
    counts = _count_weekend_holiday_works(res["schedule"], 2024, 4, 7)
    assert max(counts.values()) <= 2

def test_fixed_unavailable_holiday_only_blocks_matching_night_shifts():
    opt = OnCallOptimizer(
        num_doctors=8,
        year=2024,
        month=4,
        holidays=[29],
        fixed_unavailable_weekdays={0: [{"day_of_week": 7, "target_shift": "night", "is_soft_penalty": False}]},
    )
    opt.build_model()
    res = opt.solve(random_seed=SEED)
    assert res["success"] is True

    row = next(r for r in res["schedule"] if r["day"] == 29)
    assert row["night_shift"] != 0


def test_fixed_unavailable_weekday_numeric_shift_code_blocks_matching_night_shifts():
    opt = OnCallOptimizer(
        num_doctors=8,
        year=2024,
        month=4,
        holidays=[29],
        fixed_unavailable_weekdays={0: [{"day_of_week": 7, "target_shift": 2, "is_soft_penalty": False}]},
    )
    opt.build_model()
    res = opt.solve(random_seed=SEED)
    assert res["success"] is True

    row = next(r for r in res["schedule"] if r["day"] == 29)
    assert row["night_shift"] != 0
