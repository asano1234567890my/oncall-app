import asyncio
import datetime
import uuid

import services.optimizer_history as optimizer_history


class DummyResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class DummySession:
    def __init__(self, rows):
        self._rows = rows

    async def execute(self, _stmt):
        return DummyResult(self._rows)


def test_score_historical_shift_uses_holiday_like_day_for_day_shift():
    holiday_dates = {datetime.date(2026, 1, 12)}
    day_shift = next(item for item in optimizer_history.DAY_SHIFT_TYPES if len(item) > 2)

    assert optimizer_history.score_historical_shift(
        shift_date=datetime.date(2026, 1, 12),
        shift_type=day_shift,
        holiday_dates=holiday_dates,
    ) == 0.5
    assert optimizer_history.score_historical_shift(
        shift_date=datetime.date(2026, 1, 13),
        shift_type=day_shift,
        holiday_dates=holiday_dates,
    ) == 0.0


def test_apply_history_score_baseline_averages_existing_doctors():
    doc1 = uuid.uuid4()
    doc2 = uuid.uuid4()
    doc3 = uuid.uuid4()

    corrected = optimizer_history.apply_history_score_baseline(
        raw_scores={doc1: 1.0, doc2: 1.5, doc3: 0.0},
        history_counts={doc1: 1, doc2: 2, doc3: 0},
    )

    assert corrected[doc1] == 1.0
    assert corrected[doc2] == 1.5
    assert corrected[doc3] == 1.25


def test_build_past_total_scores_applies_baseline_to_new_doctor(monkeypatch):
    doc1 = uuid.uuid4()
    doc2 = uuid.uuid4()
    doc3 = uuid.uuid4()
    night_shift = next(item for item in optimizer_history.NIGHT_SHIFT_TYPES if len(item) > 2)

    assert datetime.date(2026, 1, 3).weekday() == 5

    rows = [
        (doc1, datetime.date(2026, 1, 5), night_shift),
        (doc2, datetime.date(2026, 1, 3), night_shift),
    ]

    async def fake_get_custom_holidays(_db, _year):
        return {"manual_holidays": [], "ignored_holidays": []}

    monkeypatch.setattr(optimizer_history, "get_custom_holidays", fake_get_custom_holidays)
    monkeypatch.setattr(optimizer_history, "get_jp_holidays_for_year", lambda _year: [])

    scores = asyncio.run(
        optimizer_history.build_past_total_scores(
            DummySession(rows),
            doctor_ids=[doc1, doc2, doc3],
            target_year=2026,
            target_month=3,
        )
    )

    assert scores[doc1] == 1.0
    assert scores[doc2] == 1.5
    assert scores[doc3] == 1.25