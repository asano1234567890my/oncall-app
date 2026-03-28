from __future__ import annotations
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict

class GuideInsightRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    hospital_id: UUID
    category: str
    summary: str
    feature_request: str | None
    user_message: str
    created_at: datetime

class GuideInsightWithHospital(GuideInsightRead):
    hospital_name: str | None = None

class CategoryCount(BaseModel):
    category: str
    count: int

class FeatureRequestRanking(BaseModel):
    summary: str
    count: int
    latest: datetime

class GuideInsightsSummary(BaseModel):
    total: int
    by_category: list[CategoryCount]
    feature_requests: list[FeatureRequestRanking]
