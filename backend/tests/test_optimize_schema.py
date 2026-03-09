from schemas.optimize import OptimizeRequest


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
