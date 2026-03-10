from schemas.optimize import HardConstraints, OptimizeRequest


def test_optimize_request_ignores_legacy_pre_clinic_weight():
    req = OptimizeRequest(
        year=2026,
        month=4,
        num_doctors=3,
        objective_weights={
            "gap5": 120,
            "pre_clinic": 999,
        },
    )

    dumped = req.objective_weights.model_dump()

    assert req.objective_weights.gap5 == 120
    assert "pre_clinic" not in dumped


def test_hard_constraints_model_has_expected_defaults():
    constraints = HardConstraints()

    assert constraints.max_saturday_nights == 1
    assert constraints.max_sunhol_days == 2
    assert constraints.max_sunhol_works == 3
    assert constraints.prevent_sunhol_consecutive is True
    assert constraints.respect_unavailable_days is True
    assert constraints.strict_weekend_hol_max is False
    assert constraints.max_weekend_holiday_works is None


def test_optimize_request_normalizes_hard_constraints_aliases():
    req = OptimizeRequest(
        year=2026,
        month=4,
        num_doctors=3,
        hard_constraints={
            "max_saturday_nights": 2,
            "max_sunhol_days": 2,
            "max_sunhol_works": 3,
            "prevent_sunhol_consecutive": False,
            "respect_unavailable_days": False,
            "strict_weekend_hol_max": True,
            "weekend_hol_max_count": 4,
        },
    )

    assert req.hard_constraints["max_saturday_nights"] == 2
    assert req.hard_constraints["max_sunhol_days"] == 2
    assert req.hard_constraints["max_sunhol_works"] == 3
    assert req.hard_constraints["prevent_sunhol_consecutive"] is False
    assert req.hard_constraints["respect_unavailable_days"] is False
    assert req.hard_constraints["strict_weekend_hol_max"] is True
    assert req.hard_constraints["max_weekend_holiday_works"] == 4
    assert "weekend_hol_max_count" not in req.hard_constraints


def test_optimize_request_normalizes_missing_previous_sat_data():
    req = OptimizeRequest(
        year=2026,
        month=4,
        num_doctors=3,
        past_sat_counts=None,
        sat_prev=None,
    )

    assert req.past_sat_counts == []
    assert req.sat_prev == {}


def test_optimize_request_ignores_legacy_previous_sat_field():
    req = OptimizeRequest(
        year=2026,
        month=4,
        num_doctors=3,
        past_sat_worked_doctors=[0, 1],
    )

    dumped = req.model_dump()

    assert "past_sat_worked_doctors" not in dumped
    assert req.past_sat_counts == []
    assert req.sat_prev == {}
