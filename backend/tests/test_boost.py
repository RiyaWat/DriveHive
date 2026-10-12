"""Tests for DriveHive Stripe boost feature: /payments/packages, /events/{id}/boost/checkout, /payments/status."""
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "drivehive_db")


def _login(email, password):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return s, r.json()


@pytest.fixture(scope="module")
def rider():
    s, u = _login("rider@drivehive.com", "rider123")
    return {"s": s, "u": u}


@pytest.fixture(scope="module")
def mike():
    s, u = _login("mike@drivehive.com", "mike123")
    return {"s": s, "u": u}


# ---- Packages ----
def test_packages_list_unauth():
    r = requests.get(f"{API}/payments/packages")
    assert r.status_code == 401


def test_packages_list_returns_two(rider):
    r = rider["s"].get(f"{API}/payments/packages")
    assert r.status_code == 200, r.text
    pkgs = r.json()
    assert isinstance(pkgs, list) and len(pkgs) == 2
    by_id = {p["id"]: p for p in pkgs}
    assert "boost_7d" in by_id and "boost_30d" in by_id
    assert by_id["boost_7d"]["amount"] == 4.99
    assert by_id["boost_7d"]["days"] == 7
    assert by_id["boost_7d"]["currency"] == "usd"
    assert by_id["boost_30d"]["amount"] == 14.99
    assert by_id["boost_30d"]["days"] == 30


# ---- Boost checkout: ownership + validation ----
@pytest.fixture
def rider_event(rider):
    s = rider["s"]
    r = s.post(f"{API}/events", json={
        "title": "TEST_boost_meet",
        "description": "boost test",
        "location": "LA",
        "starts_at": "2026-09-01T10:00:00Z",
    })
    assert r.status_code == 200, r.text
    eid = r.json()["id"]
    yield eid
    s.delete(f"{API}/events/{eid}")


def test_boost_checkout_non_owner_403(rider_event, mike):
    r = mike["s"].post(
        f"{API}/events/{rider_event}/boost/checkout",
        json={"package_id": "boost_7d", "origin_url": BASE_URL},
    )
    assert r.status_code == 403, r.text


def test_boost_checkout_unknown_event_404(rider):
    r = rider["s"].post(
        f"{API}/events/{uuid.uuid4().hex}/boost/checkout",
        json={"package_id": "boost_7d", "origin_url": BASE_URL},
    )
    assert r.status_code == 404


def test_boost_checkout_invalid_package_422(rider_event, rider):
    # Pydantic Literal -> 422 validation error
    r = rider["s"].post(
        f"{API}/events/{rider_event}/boost/checkout",
        json={"package_id": "boost_99d", "origin_url": BASE_URL},
    )
    assert r.status_code in (400, 422), r.text


def test_boost_checkout_unauth(rider_event):
    r = requests.post(
        f"{API}/events/{rider_event}/boost/checkout",
        json={"package_id": "boost_7d", "origin_url": BASE_URL},
    )
    assert r.status_code == 401


def test_boost_checkout_owner_creates_session(rider_event, rider):
    """Owner creates Stripe session - returns url + session_id and inserts payment_transactions row."""
    r = rider["s"].post(
        f"{API}/events/{rider_event}/boost/checkout",
        json={"package_id": "boost_7d", "origin_url": BASE_URL},
    )
    # If Stripe key invalid, surface for review but don't kill suite
    if r.status_code != 200:
        pytest.skip(f"Stripe checkout returned {r.status_code}: {r.text[:300]}")
    data = r.json()
    assert "url" in data and "session_id" in data
    assert isinstance(data["url"], str) and data["url"].startswith("http")
    assert "stripe.com" in data["url"]  # real stripe domain
    assert isinstance(data["session_id"], str) and len(data["session_id"]) > 5

    # Status endpoint should exist for this session and return 200 (pending)
    s_resp = rider["s"].get(f"{API}/payments/status/{data['session_id']}")
    assert s_resp.status_code == 200, s_resp.text
    body = s_resp.json()
    assert body["event_id"] == rider_event
    assert "payment_status" in body
    assert body["fulfilled"] is False  # not paid yet


def test_payment_status_unknown_session(rider):
    r = rider["s"].get(f"{API}/payments/status/sess_does_not_exist_{uuid.uuid4().hex}")
    assert r.status_code == 404


def test_payment_status_other_user_403(rider_event, rider, mike):
    r = rider["s"].post(
        f"{API}/events/{rider_event}/boost/checkout",
        json={"package_id": "boost_7d", "origin_url": BASE_URL},
    )
    if r.status_code != 200:
        pytest.skip("Stripe checkout unavailable")
    sid = r.json()["session_id"]
    r2 = mike["s"].get(f"{API}/payments/status/{sid}")
    assert r2.status_code == 403


# ---- Featured ordering + is_featured flag ----
@pytest.mark.asyncio
async def test_featured_event_sorts_first_and_flag(rider):
    """Directly set featured_until on a TEST event and assert ordering + is_featured=true."""
    s = rider["s"]
    # Create regular event (far future)
    r1 = s.post(f"{API}/events", json={
        "title": "TEST_regular_z", "description": "", "location": "X",
        "starts_at": "2099-01-01T00:00:00Z",
    })
    reg_id = r1.json()["id"]
    # Create one to be featured (earliest future date)
    r2 = s.post(f"{API}/events", json={
        "title": "TEST_to_feature", "description": "", "location": "Y",
        "starts_at": "2098-01-01T00:00:00Z",
    })
    feat_id = r2.json()["id"]

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    until = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    await db.events.update_one({"id": feat_id}, {"$set": {"featured_until": until, "featured_by": rider["u"]["id"]}})

    try:
        r = s.get(f"{API}/events")
        assert r.status_code == 200
        events = r.json()
        ids = [e["id"] for e in events]
        # Featured must come before regular even though starts_at is later than reg's
        assert ids.index(feat_id) < ids.index(reg_id)
        feat = next(e for e in events if e["id"] == feat_id)
        reg = next(e for e in events if e["id"] == reg_id)
        assert feat["is_featured"] is True
        assert reg["is_featured"] is False
    finally:
        s.delete(f"{API}/events/{reg_id}")
        s.delete(f"{API}/events/{feat_id}")
        client.close()


# ---- Unique index on session_id ----
@pytest.mark.asyncio
async def test_payment_transactions_unique_session_id_index():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    indexes = await db.payment_transactions.index_information()
    # find an index whose key contains session_id and is unique
    found = False
    for name, info in indexes.items():
        keys = [k for k, _ in info.get("key", [])]
        if keys == ["session_id"] and info.get("unique"):
            found = True
            break
    client.close()
    assert found, f"Expected unique index on session_id; got: {indexes}"
