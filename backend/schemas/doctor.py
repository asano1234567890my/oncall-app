from __future__ import annotations

from datetime import date
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UnavailableDayBase(BaseModel):
    # 1日単位の不可日（任意）
    date: Optional[date] = None

    # 固定不可曜日（任意）: 0=月曜〜6=日曜
    day_of_week: Optional[int] = None

    # 固定設定かどうか（必須）
    is_fixed: bool


class UnavailableDayCreate(UnavailableDayBase):
    doctor_id: UUID


class UnavailableDayRead(UnavailableDayBase):
    id: UUID
    doctor_id: UUID

    model_config = ConfigDict(from_attributes=True)


class DoctorBase(BaseModel):
    name: str
    experience_years: int
    is_active: bool = True

    # スコア
    min_score: Optional[float] = None
    max_score: Optional[float] = None
    target_score: Optional[float] = None


class DoctorCreate(DoctorBase):
    pass


class DoctorUpdate(BaseModel):
    # PUT更新で「送られてきた項目だけ」更新できるよう Optional にする
    name: Optional[str] = None
    experience_years: Optional[int] = None
    is_active: Optional[bool] = None

    # スコア
    min_score: Optional[float] = None
    max_score: Optional[float] = None
    target_score: Optional[float] = None

    # 休み希望（管理側PUTで受け取る）
    unavailable_dates: Optional[List[date]] = None  # 特定の日付のリスト
    fixed_weekdays: Optional[List[int]] = None      # 0=月曜〜6=日曜


# ★追加：公開画面用（休み希望のみ更新可能）
class PublicDoctorUpdate(BaseModel):
    unavailable_dates: Optional[List[date]] = None
    fixed_weekdays: Optional[List[int]] = None


class DoctorRead(DoctorBase):
    id: UUID

    # ★追加（要件: レスポンスにaccess_tokenを含める）
    access_token: str

    unavailable_days: List[UnavailableDayRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)