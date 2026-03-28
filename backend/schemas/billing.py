from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class CheckoutResponse(BaseModel):
    checkout_url: str


class PortalResponse(BaseModel):
    portal_url: str


class BillingStatus(BaseModel):
    plan: str
    stripe_customer_id: str | None = None
    stripe_subscription_id: str | None = None
    plan_expires_at: datetime | None = None
