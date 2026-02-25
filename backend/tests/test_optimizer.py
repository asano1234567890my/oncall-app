# backend/tests/test_optimizer.py
import datetime
import calendar

import pytest

from services.optimizer import OnCallOptimizer


def _collect_assignments(schedule):
    # (doctor, day) list for work (day_shift or night_shift)
    out = []
    for row in schedule:
        day = row["day"]
        if row.get("night_shift") is not None:
            out.append((row["night_shift"], day))
        if row.get("day_shift") is not None:
            out.append((row["day_shift"], day))
    return out


def test_fill_all_slots_weekday_only():
    opt = OnCallOptimizer(num_doctors=6, year=2024, month=4, holidays=[], score_max=100.0)
    opt.build_model()
    res = opt.solve()
    assert res["success"] is True
    assert len(res["schedule"]) == calendar.monthrange(2024, 4)[1]
    for row in res["schedule"]:
        assert row["night_shift"] is not None


def test_sun_holiday_has_day_and_night_and_not_same_doctor():
    # 2024-04 has Sundays; set 29 as holiday too
    opt = OnCallOptimizer(num_doctors=8, year=2024, month=4, holidays=[29])
    opt.build_model()
    res = opt.solve()
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
    num_doctors=6, year=2024, month=4,
    holidays=[],
    unavailable={0: [5]},
    score_max=100.0
)
    opt.build_model()
    res = opt.solve()
    assert res["success"] is True

    row5 = next(r for r in res["schedule"] if r["day"] == 5)
    assert row5["night_shift"] != 0
    assert row5["day_shift"] is None  # weekday


def test_fixed_unavailable_weekday_blocks_all_matching_dates():
    # doctor0: Monday(0) unavailable
    opt = OnCallOptimizer(
        num_doctors=8, year=2024, month=4,
        fixed_unavailable_weekdays={0: [0]}
    )
    opt.build_model()
    res = opt.solve()
    assert res["success"] is True

    for row in res["schedule"]:
        day = row["day"]
        wd = datetime.date(2024, 4, day).weekday()
        if wd == 0:
            assert row["night_shift"] != 0
            if row["day_shift"] is not None:
                assert row["day_shift"] != 0


def test_spacing_rule_min_4_days_apart():
    opt = OnCallOptimizer(num_doctors=12, year=2024, month=4, holidays=[29])
    opt.build_model()
    res = opt.solve()
    assert res["success"] is True

    assigns = _collect_assignments(res["schedule"])
    by_doc = {}
    for d, day in assigns:
        by_doc.setdefault(d, []).append(day)

    for d, days in by_doc.items():
        days_sorted = sorted(days)
        for i in range(len(days_sorted) - 1):
            gap = days_sorted[i + 1] - days_sorted[i]
            assert gap >= 5  # "次の4日(1..4)は禁止" -> 最短でも差は5


def test_month_cross_spacing_blocks_early_days():
    # doctor0 worked on prev month last day (31), so month start day1..day4 should be blocked
    opt = OnCallOptimizer(
        num_doctors=10,
        year=2024, month=4,
        prev_month_last_day=31,
        prev_month_worked_days={0: [31]},
    )
    opt.build_model()
    res = opt.solve()
    assert res["success"] is True

    # day1..day4 should not assign doctor0 (either day or night if sun/holiday)
    for day in range(1, 5):
        row = next(r for r in res["schedule"] if r["day"] == day)
        assert row["night_shift"] != 0
        if row["day_shift"] is not None:
            assert row["day_shift"] != 0


def test_score_bounds_enforced_or_infeasible():
    # very tight bounds may become infeasible; then success False is acceptable
    opt = OnCallOptimizer(
        num_doctors=8, year=2024, month=4,
        score_min=2.0, score_max=2.0  # extremely tight
    )
    opt.build_model()
    res = opt.solve()
    if res["success"]:
        for s in res["scores"].values():
            assert abs(s - 2.0) < 1e-9
    else:
        assert "解が見つかりません" in res["message"]