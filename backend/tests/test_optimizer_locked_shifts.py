import datetime

from services.optimizer import OnCallOptimizer


def test_locked_night_shift_is_forced_with_iso_date():
    opt = OnCallOptimizer(
        num_doctors=10,
        year=2024,
        month=4,
        locked_shifts=[
            {"date": "2024-04-05", "shift_type": "night", "doctor_idx": 0},
        ],
    )
    opt.build_model()
    res = opt.solve()

    assert res["success"] is True
    row = next(r for r in res["schedule"] if r["day"] == 5)
    assert row["night_shift"] == 0


def test_locked_day_shift_is_forced_on_sunday():
    # 2024-04-07 is Sunday
    assert datetime.date(2024, 4, 7).weekday() == 6

    opt = OnCallOptimizer(
        num_doctors=10,
        year=2024,
        month=4,
        locked_shifts=[
            {"date": 7, "shift_type": "day", "doctor_idx": 1},
        ],
    )
    opt.build_model()
    res = opt.solve()

    assert res["success"] is True
    row = next(r for r in res["schedule"] if r["day"] == 7)
    assert row["day_shift"] == 1


def test_empty_locked_shifts_keeps_existing_behavior():
    opt = OnCallOptimizer(num_doctors=8, year=2024, month=4, locked_shifts=[])
    opt.build_model()
    res = opt.solve()

    assert res["success"] is True
