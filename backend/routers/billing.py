"""Stripe課金API"""
from __future__ import annotations

import logging
import os
import uuid

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_hospital
from core.db import get_db
from models.hospital import Hospital
from schemas.billing import BillingStatus, CheckoutResponse, PortalResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["billing"])


def _get_stripe():
    """Initialize stripe with secret key. Raises 503 if not configured."""
    key = os.getenv("STRIPE_SECRET_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="課金機能は現在利用できません")
    stripe.api_key = key
    return stripe


# ── Billing Status ──


@router.get("/status", response_model=BillingStatus)
async def billing_status(
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
) -> BillingStatus:
    result = await db.execute(select(Hospital).where(Hospital.id == hospital_id))
    hospital = result.scalar_one_or_none()
    if not hospital:
        raise HTTPException(status_code=404, detail="アカウントが見つかりません")
    return BillingStatus(
        plan=hospital.plan,
        stripe_customer_id=hospital.stripe_customer_id,
        stripe_subscription_id=hospital.stripe_subscription_id,
        plan_expires_at=hospital.plan_expires_at,
    )


# ── Checkout Session ──


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    request: Request,
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
) -> CheckoutResponse:
    s = _get_stripe()
    price_id = os.getenv("STRIPE_PRICE_ID")
    if not price_id:
        raise HTTPException(status_code=503, detail="価格が設定されていません")

    # Get hospital for email
    result = await db.execute(select(Hospital).where(Hospital.id == hospital_id))
    hospital = result.scalar_one_or_none()
    if not hospital:
        raise HTTPException(status_code=404)

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    # Use first URL if comma-separated
    base_url = frontend_url.split(",")[0].strip().rstrip("/")

    # Reuse existing Stripe customer if available
    customer_kwargs = {}
    if hospital.stripe_customer_id:
        customer_kwargs["customer"] = hospital.stripe_customer_id
    elif hospital.email:
        customer_kwargs["customer_email"] = hospital.email

    session = s.checkout.Session.create(
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{base_url}/app?billing=success",
        cancel_url=f"{base_url}/app?billing=cancel",
        metadata={"hospital_id": str(hospital_id)},
        **customer_kwargs,
    )
    return CheckoutResponse(checkout_url=session.url)


# ── Customer Portal ──


@router.post("/portal", response_model=PortalResponse)
async def create_portal(
    hospital_id: uuid.UUID = Depends(get_current_hospital),
    db: AsyncSession = Depends(get_db),
) -> PortalResponse:
    s = _get_stripe()

    result = await db.execute(select(Hospital).where(Hospital.id == hospital_id))
    hospital = result.scalar_one_or_none()
    if not hospital or not hospital.stripe_customer_id:
        raise HTTPException(
            status_code=400,
            detail="課金情報がありません。先にアップグレードしてください。",
        )

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    base_url = frontend_url.split(",")[0].strip().rstrip("/")

    session = s.billing_portal.Session.create(
        customer=hospital.stripe_customer_id,
        return_url=f"{base_url}/app",
    )
    return PortalResponse(portal_url=session.url)


# ── Webhook ──


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Stripe Webhookハンドラ（認証不要・署名検証あり）"""
    s = _get_stripe()
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = s.Webhook.construct_event(payload, sig_header, webhook_secret)
    except s.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.exception("Webhook parse error")
        raise HTTPException(status_code=400, detail=str(e))

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(db, data)
    elif event_type == "customer.subscription.updated":
        await _handle_subscription_updated(db, data)
    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(db, data)
    elif event_type == "invoice.payment_failed":
        logger.warning("Payment failed for customer: %s", data.get("customer"))

    return {"status": "ok"}


async def _handle_checkout_completed(db: AsyncSession, session: dict) -> None:
    """Checkout完了 → plan更新"""
    hospital_id_str = session.get("metadata", {}).get("hospital_id")
    if not hospital_id_str:
        logger.warning("Checkout completed without hospital_id metadata")
        return

    hospital_id = uuid.UUID(hospital_id_str)
    result = await db.execute(select(Hospital).where(Hospital.id == hospital_id))
    hospital = result.scalar_one_or_none()
    if not hospital:
        logger.warning("Hospital not found: %s", hospital_id)
        return

    hospital.plan = "pro"
    hospital.stripe_customer_id = session.get("customer")
    hospital.stripe_subscription_id = session.get("subscription")
    await db.commit()
    logger.info("Plan upgraded to pro: hospital=%s", hospital_id)


async def _handle_subscription_updated(db: AsyncSession, subscription: dict) -> None:
    """サブスク更新 → plan反映"""
    customer_id = subscription.get("customer")
    if not customer_id:
        return

    result = await db.execute(
        select(Hospital).where(Hospital.stripe_customer_id == customer_id)
    )
    hospital = result.scalar_one_or_none()
    if not hospital:
        logger.warning("Hospital not found for customer: %s", customer_id)
        return

    status = subscription.get("status")
    if status == "active":
        # Check price to determine plan
        items = subscription.get("items", {}).get("data", [])  # noqa: F841
        hospital.stripe_subscription_id = subscription.get("id")
        # For now, any active subscription = pro
        hospital.plan = "pro"
    elif status in ("canceled", "unpaid", "past_due"):
        hospital.plan = "free"
        hospital.stripe_subscription_id = None

    # Update expiration
    current_period_end = subscription.get("current_period_end")
    if current_period_end:
        from datetime import datetime, timezone

        hospital.plan_expires_at = datetime.fromtimestamp(
            current_period_end, tz=timezone.utc
        )

    await db.commit()


async def _handle_subscription_deleted(db: AsyncSession, subscription: dict) -> None:
    """サブスク削除 → freeに戻す"""
    customer_id = subscription.get("customer")
    if not customer_id:
        return

    result = await db.execute(
        select(Hospital).where(Hospital.stripe_customer_id == customer_id)
    )
    hospital = result.scalar_one_or_none()
    if not hospital:
        return

    hospital.plan = "free"
    hospital.stripe_subscription_id = None
    hospital.plan_expires_at = None
    await db.commit()
    logger.info("Plan downgraded to free: hospital=%s", hospital.id)
