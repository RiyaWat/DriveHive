"""Stripe Checkout helper (direct Stripe SDK).

Drop-in for the generated app's old payments wrapper: same class and model names,
backed by the official `stripe` package. Needs STRIPE_API_KEY, and STRIPE_WEBHOOK_SECRET
if you register the /api/webhook/stripe endpoint in the Stripe dashboard.
"""
import os
import asyncio
from typing import Dict, Optional

import stripe
from pydantic import BaseModel


class CheckoutSessionRequest(BaseModel):
    amount: float
    currency: str = "usd"
    success_url: str
    cancel_url: str
    metadata: Optional[Dict[str, str]] = None


class CheckoutSessionResponse(BaseModel):
    url: str
    session_id: str


class CheckoutStatusResponse(BaseModel):
    status: str
    payment_status: str
    amount_total: Optional[int] = None
    currency: Optional[str] = None
    metadata: Dict[str, str] = {}


class WebhookResponse(BaseModel):
    event_type: str
    event_id: str
    session_id: Optional[str] = None
    payment_status: Optional[str] = None
    metadata: Dict[str, str] = {}


class StripeCheckout:
    def __init__(self, api_key: str, webhook_url: str = ""):
        self.api_key = api_key
        self.webhook_url = webhook_url
        self.webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

    async def create_checkout_session(self, req: CheckoutSessionRequest) -> CheckoutSessionResponse:
        def _create():
            return stripe.checkout.Session.create(
                api_key=self.api_key,
                mode="payment",
                line_items=[{
                    "price_data": {
                        "currency": req.currency,
                        "unit_amount": int(round(req.amount * 100)),
                        "product_data": {"name": (req.metadata or {}).get("purpose", "Payment")},
                    },
                    "quantity": 1,
                }],
                success_url=req.success_url,
                cancel_url=req.cancel_url,
                metadata=req.metadata or {},
            )
        s = await asyncio.to_thread(_create)
        return CheckoutSessionResponse(url=s.url, session_id=s.id)

    async def get_checkout_status(self, session_id: str) -> CheckoutStatusResponse:
        s = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id, api_key=self.api_key)
        return CheckoutStatusResponse(
            status=s.status or "unknown",
            payment_status=s.payment_status or "unpaid",
            amount_total=s.amount_total,
            currency=s.currency,
            metadata=dict(s.metadata or {}),
        )

    async def handle_webhook(self, body: bytes, signature: Optional[str]) -> WebhookResponse:
        if self.webhook_secret:
            event = stripe.Webhook.construct_event(body, signature, self.webhook_secret)
        else:
            event = stripe.Event.construct_from(__import__("json").loads(body), stripe.api_key)
        obj = event["data"]["object"]
        is_session = obj.get("object") == "checkout.session"
        return WebhookResponse(
            event_type=event["type"],
            event_id=event["id"],
            session_id=obj.get("id") if is_session else None,
            payment_status=obj.get("payment_status") if is_session else None,
            metadata=dict(obj.get("metadata") or {}),
        )
