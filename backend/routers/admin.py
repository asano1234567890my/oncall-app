"""開発者管理API — is_superadmin=True の病院のみアクセス可能"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_superadmin_dep
from core.db import get_db
from models.doctor import Doctor
from models.hospital import Hospital
from models.usage_event import UsageEvent

router = APIRouter(prefix="/api/admin", tags=["admin"])

require_superadmin = get_current_superadmin_dep(get_db)


@router.get("/hospitals")
async def list_hospitals(
    _: uuid.UUID = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """アカウント一覧（施設名・メアド・登録日・医師数・最終ログイン・月間生成回数）"""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # 医師数サブクエリ（内部・外部別）
    internal_count = (
        select(
            Doctor.hospital_id,
            func.count().label("internal_count"),
        )
        .where(Doctor.is_active == True, Doctor.is_external == False)  # noqa: E712
        .group_by(Doctor.hospital_id)
        .subquery()
    )
    external_count = (
        select(
            Doctor.hospital_id,
            func.count().label("external_count"),
        )
        .where(Doctor.is_active == True, Doctor.is_external == True)  # noqa: E712
        .group_by(Doctor.hospital_id)
        .subquery()
    )

    # 月間生成回数サブクエリ
    monthly_generate = (
        select(
            UsageEvent.hospital_id,
            func.count().label("generate_count"),
        )
        .where(
            UsageEvent.event_type == "generate",
            UsageEvent.created_at >= month_start,
        )
        .group_by(UsageEvent.hospital_id)
        .subquery()
    )

    stmt = (
        select(
            Hospital.id,
            Hospital.name,
            Hospital.email,
            Hospital.is_superadmin,
            Hospital.created_at,
            Hospital.last_login_at,
            func.coalesce(internal_count.c.internal_count, 0).label("internal_doctors"),
            func.coalesce(external_count.c.external_count, 0).label("external_doctors"),
            func.coalesce(monthly_generate.c.generate_count, 0).label("monthly_generates"),
        )
        .outerjoin(internal_count, Hospital.id == internal_count.c.hospital_id)
        .outerjoin(external_count, Hospital.id == external_count.c.hospital_id)
        .outerjoin(monthly_generate, Hospital.id == monthly_generate.c.hospital_id)
        .order_by(Hospital.created_at.desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        {
            "id": str(row.id),
            "name": row.name,
            "email": row.email,
            "is_superadmin": row.is_superadmin,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "last_login_at": row.last_login_at.isoformat() if row.last_login_at else None,
            "internal_doctors": row.internal_doctors,
            "external_doctors": row.external_doctors,
            "monthly_generates": row.monthly_generates,
        }
        for row in rows
    ]


@router.get("/usage/summary")
async def usage_summary(
    _: uuid.UUID = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """全体統計サマリー"""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    thirty_days_ago = now - timedelta(days=30)

    # 総アカウント数
    total_hospitals = (await db.execute(select(func.count(Hospital.id)))).scalar() or 0

    # アクティブ数（直近30日ログイン）
    active_hospitals = (
        await db.execute(
            select(func.count(Hospital.id)).where(
                Hospital.last_login_at >= thirty_days_ago
            )
        )
    ).scalar() or 0

    # 月間イベント数（種別ごと）
    event_counts_stmt = (
        select(
            UsageEvent.event_type,
            func.count().label("count"),
        )
        .where(UsageEvent.created_at >= month_start)
        .group_by(UsageEvent.event_type)
    )
    event_rows = (await db.execute(event_counts_stmt)).all()
    event_counts = {row.event_type: row.count for row in event_rows}

    # 月間生成したアカウント数
    generating_hospitals = (
        await db.execute(
            select(func.count(func.distinct(UsageEvent.hospital_id))).where(
                UsageEvent.event_type == "generate",
                UsageEvent.created_at >= month_start,
            )
        )
    ).scalar() or 0

    total_generates = event_counts.get("generate", 0)
    total_saves = event_counts.get("schedule_save", 0)

    return {
        "total_hospitals": total_hospitals,
        "active_hospitals_30d": active_hospitals,
        "generating_hospitals_this_month": generating_hospitals,
        "monthly_event_counts": event_counts,
        "avg_generates_per_active": (
            round(total_generates / generating_hospitals, 1)
            if generating_hospitals > 0
            else 0
        ),
        "avg_generates_per_save": (
            round(total_generates / total_saves, 1) if total_saves > 0 else 0
        ),
    }


@router.get("/usage/monthly")
async def usage_monthly(
    _: uuid.UUID = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
    months: int = Query(6, ge=1, le=12),
):
    """月別イベント推移（直近N ヶ月）"""
    now = datetime.now(timezone.utc)
    results = []

    for i in range(months):
        # i=0: 今月, i=1: 先月, ...
        y = now.year
        m = now.month - i
        while m <= 0:
            m += 12
            y -= 1
        m_start = datetime(y, m, 1, tzinfo=timezone.utc)
        if i == 0:
            m_end = now
        else:
            # 翌月1日
            ny, nm = (y, m + 1) if m < 12 else (y + 1, 1)
            m_end = datetime(ny, nm, 1, tzinfo=timezone.utc)

        stmt = (
            select(
                UsageEvent.event_type,
                func.count().label("count"),
            )
            .where(
                UsageEvent.created_at >= m_start,
                UsageEvent.created_at < m_end,
            )
            .group_by(UsageEvent.event_type)
        )
        rows = (await db.execute(stmt)).all()
        counts = {row.event_type: row.count for row in rows}
        results.append({
            "year": y,
            "month": m,
            "label": f"{y}-{m:02d}",
            "event_counts": counts,
        })

    return list(reversed(results))


@router.get("/usage/generate-ratio")
async def generate_ratio(
    _: uuid.UUID = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
    days: int = Query(90, ge=1, le=365),
):
    """アカウント別の生成/確定比率（課金ライン検討用）"""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # アカウントごとの generate / schedule_save 回数
    stmt = (
        select(
            UsageEvent.hospital_id,
            UsageEvent.event_type,
            func.count().label("count"),
        )
        .where(
            UsageEvent.created_at >= since,
            UsageEvent.event_type.in_(["generate", "schedule_save"]),
        )
        .group_by(UsageEvent.hospital_id, UsageEvent.event_type)
    )
    rows = (await db.execute(stmt)).all()

    # hospital_id → {generate: N, schedule_save: N}
    by_hospital: dict[uuid.UUID, dict[str, int]] = {}
    for row in rows:
        if row.hospital_id not in by_hospital:
            by_hospital[row.hospital_id] = {"generate": 0, "schedule_save": 0}
        by_hospital[row.hospital_id][row.event_type] = row.count

    # 名前を取得
    if by_hospital:
        name_stmt = select(Hospital.id, Hospital.name).where(
            Hospital.id.in_(list(by_hospital.keys()))
        )
        name_rows = (await db.execute(name_stmt)).all()
        names = {row.id: row.name for row in name_rows}
    else:
        names = {}

    result = []
    for hid, counts in by_hospital.items():
        gen = counts["generate"]
        save = counts["schedule_save"]
        result.append({
            "hospital_id": str(hid),
            "hospital_name": names.get(hid, "?"),
            "generates": gen,
            "saves": save,
            "ratio": round(gen / save, 1) if save > 0 else None,
        })

    result.sort(key=lambda x: x["generates"], reverse=True)
    return result


@router.get("/usage/events")
async def list_events(
    _: uuid.UUID = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
    event_type: str | None = Query(None),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(200, ge=1, le=1000),
):
    """イベント詳細（期間・event_type フィルタ付き）"""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(
            UsageEvent.id,
            UsageEvent.hospital_id,
            UsageEvent.event_type,
            UsageEvent.created_at,
            UsageEvent.metadata_,
            Hospital.name.label("hospital_name"),
        )
        .join(Hospital, UsageEvent.hospital_id == Hospital.id)
        .where(UsageEvent.created_at >= since)
    )
    if event_type:
        stmt = stmt.where(UsageEvent.event_type == event_type)
    stmt = stmt.order_by(UsageEvent.created_at.desc()).limit(limit)

    result = await db.execute(stmt)
    rows = result.all()

    return [
        {
            "id": str(row.id),
            "hospital_id": str(row.hospital_id),
            "hospital_name": row.hospital_name,
            "event_type": row.event_type,
            "created_at": row.created_at.isoformat(),
            "metadata": row.metadata_,
        }
        for row in rows
    ]


@router.get("/usage/hospital/{hospital_id}")
async def hospital_usage_detail(
    hospital_id: uuid.UUID,
    _: uuid.UUID = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
    days: int = Query(90, ge=1, le=365),
):
    """特定アカウントの利用詳細"""
    # アカウント情報
    hospital = (
        await db.execute(select(Hospital).where(Hospital.id == hospital_id))
    ).scalar_one_or_none()
    if not hospital:
        return {"error": "アカウントが見つかりません"}

    # 医師一覧
    doctors_result = await db.execute(
        select(
            Doctor.id, Doctor.name, Doctor.is_active, Doctor.is_locked, Doctor.is_external
        ).where(Doctor.hospital_id == hospital_id)
    )
    doctors = [
        {
            "id": str(d.id),
            "name": d.name,
            "is_active": d.is_active,
            "is_locked": d.is_locked,
            "is_external": d.is_external,
        }
        for d in doctors_result.all()
    ]

    # イベント集計（種別ごと）
    since = datetime.now(timezone.utc) - timedelta(days=days)
    event_counts_stmt = (
        select(
            UsageEvent.event_type,
            func.count().label("count"),
        )
        .where(
            UsageEvent.hospital_id == hospital_id,
            UsageEvent.created_at >= since,
        )
        .group_by(UsageEvent.event_type)
    )
    event_rows = (await db.execute(event_counts_stmt)).all()

    # 最近のイベント（直近50件）
    recent_events_stmt = (
        select(
            UsageEvent.event_type,
            UsageEvent.created_at,
            UsageEvent.metadata_,
        )
        .where(UsageEvent.hospital_id == hospital_id)
        .order_by(UsageEvent.created_at.desc())
        .limit(50)
    )
    recent_rows = (await db.execute(recent_events_stmt)).all()

    return {
        "hospital": {
            "id": str(hospital.id),
            "name": hospital.name,
            "email": hospital.email,
            "created_at": hospital.created_at.isoformat() if hospital.created_at else None,
            "last_login_at": hospital.last_login_at.isoformat() if hospital.last_login_at else None,
        },
        "doctors": doctors,
        "event_counts": {row.event_type: row.count for row in event_rows},
        "recent_events": [
            {
                "event_type": row.event_type,
                "created_at": row.created_at.isoformat(),
                "metadata": row.metadata_,
            }
            for row in recent_rows
        ],
    }
