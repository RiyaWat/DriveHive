"""Iteration 6 tests: video uploads, stories (media_path/media_type, view/like),
post share, /users/me/connections, story listing & ordering, backward compat."""
import os
import io
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


def _session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(email, pw):
    s = _session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return s, r.json()


@pytest.fixture(scope="module")
def rider():
    s, u = _login("rider@drivehive.com", "rider123")
    return {"session": s, "user": u}


@pytest.fixture(scope="module")
def mike():
    s, u = _login("mike@drivehive.com", "mike123")
    return {"session": s, "user": u}


@pytest.fixture(scope="module")
def sara():
    s, u = _login("sara@drivehive.com", "sara123")
    return {"session": s, "user": u}


def _png_bytes():
    return bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154"
        "789c6300010000000500010d0a2db40000000049454e44ae426082"
    )


def _fake_mp4_bytes():
    """Minimal-ish fake mp4 with ftyp box (server doesn't deeply validate, just by extension)."""
    # ftyp box: size (8) + 'ftyp' + brand 'isom' + minor + compat
    body = b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41" + b"\x00" * 64
    return body


# -------- Upload: image still works, returns media_type='image' --------
def test_upload_image_returns_media_type_image(rider):
    s = rider["session"]
    files = {"file": ("t.png", io.BytesIO(_png_bytes()), "image/png")}
    headers = {k: v for k, v in s.headers.items() if k != "Content-Type"}
    r = requests.post(f"{API}/upload", files=files, cookies=s.cookies, headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "path" in data and "url" in data
    assert data.get("media_type") == "image"


# -------- Upload: mp4 video accepted, returns media_type='video' --------
def test_upload_video_mp4(rider):
    s = rider["session"]
    payload = _fake_mp4_bytes()
    files = {"file": ("clip.mp4", io.BytesIO(payload), "video/mp4")}
    headers = {k: v for k, v in s.headers.items() if k != "Content-Type"}
    r = requests.post(f"{API}/upload", files=files, cookies=s.cookies, headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("media_type") == "video"
    assert data["path"].endswith(".mp4")
    # GET file back
    r2 = requests.get(f"{BASE_URL}{data['url']}")
    assert r2.status_code == 200
    return data


def test_upload_rejects_unsupported_ext(rider):
    s = rider["session"]
    files = {"file": ("bad.exe", io.BytesIO(b"hello"), "application/octet-stream")}
    headers = {k: v for k, v in s.headers.items() if k != "Content-Type"}
    r = requests.post(f"{API}/upload", files=files, cookies=s.cookies, headers=headers)
    assert r.status_code == 400


# -------- Stories: create video story --------
def test_create_video_story(rider):
    s = rider["session"]
    r = s.post(f"{API}/stories", json={"media_path": "drivehive/test/clip.mp4", "media_type": "video"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["media_type"] == "video"
    assert data["media_path"] == "drivehive/test/clip.mp4"
    assert data["likes"] == []
    assert data["viewed_by"] == []


# -------- Stories: view + has_unviewed grouping --------
def test_stories_grouping_unviewed_first_and_view_marks_seen(rider, mike):
    rs = rider["session"]
    ms = mike["session"]
    # Rider creates a fresh story
    r = rs.post(f"{API}/stories", json={"media_path": "drivehive/test/s1.jpg", "media_type": "image"})
    assert r.status_code == 200
    story_id = r.json()["id"]

    # Mike fetches list - rider's group should have has_unviewed=True
    r = ms.get(f"{API}/stories")
    assert r.status_code == 200
    groups = r.json()
    rider_group = next((g for g in groups if g["user"]["id"] == rider["user"]["id"]), None)
    assert rider_group is not None
    assert rider_group["has_unviewed"] is True

    # All unviewed groups should appear before viewed groups
    seen_viewed = False
    for g in groups:
        if g["has_unviewed"]:
            assert not seen_viewed, "Unviewed group appeared after viewed group"
        else:
            seen_viewed = True

    # Mike views rider's story
    r = ms.post(f"{API}/stories/{story_id}/view")
    assert r.status_code == 200
    assert r.json()["ok"] is True

    # Idempotent
    r = ms.post(f"{API}/stories/{story_id}/view")
    assert r.status_code == 200

    # Mike re-fetches; rider's group has_unviewed should be False (assuming this was the only one)
    r = ms.get(f"{API}/stories")
    rider_group = next((g for g in r.json() if g["user"]["id"] == rider["user"]["id"]), None)
    # If only one story for rider and we viewed it, has_unviewed=False
    # (other tests may have created stories; check viewed_by for our specific story)
    target = next((s for s in rider_group["stories"] if s["id"] == story_id), None)
    assert target is not None
    assert mike["user"]["id"] in target.get("viewed_by", [])


# -------- Stories: like toggling + notification on like only --------
def test_story_like_toggle_and_notification(rider, mike):
    rs = rider["session"]
    ms = mike["session"]
    r = rs.post(f"{API}/stories", json={"media_path": "drivehive/test/s2.jpg", "media_type": "image"})
    sid = r.json()["id"]

    # Rider clears notifications
    rs.post(f"{API}/notifications/read")

    # Mike likes
    r = ms.post(f"{API}/stories/{sid}/like")
    assert r.status_code == 200
    body = r.json()
    assert body["liked"] is True
    assert mike["user"]["id"] in body["likes"]

    # Rider should have a 'like' notification of type 'like' for this story
    r = rs.get(f"{API}/notifications")
    assert any(
        n["type"] == "like" and n["entity_id"] == sid
        and n.get("from_user", {}).get("email") == "mike@drivehive.com"
        for n in r.json()
    ), "Expected like notification for story owner"

    # Clear and unlike — should NOT create a new notification
    rs.post(f"{API}/notifications/read")
    r = ms.post(f"{API}/stories/{sid}/like")
    assert r.status_code == 200
    assert r.json()["liked"] is False

    r = rs.get(f"{API}/notifications")
    new_unread = [n for n in r.json() if n["type"] == "like" and n["entity_id"] == sid and not n.get("read")]
    assert new_unread == [], "Unlike should not create a new notification"


def test_story_like_self_no_notification(rider):
    s = rider["session"]
    r = s.post(f"{API}/stories", json={"media_path": "drivehive/test/own.jpg", "media_type": "image"})
    sid = r.json()["id"]
    s.post(f"{API}/notifications/read")
    r = s.post(f"{API}/stories/{sid}/like")
    assert r.status_code == 200
    r = s.get(f"{API}/notifications")
    own_likes = [n for n in r.json() if n["type"] == "like" and n["entity_id"] == sid and not n.get("read")]
    assert own_likes == [], "Self-like must not generate notification"


def test_story_view_404(rider):
    r = rider["session"].post(f"{API}/stories/nonexistent-id/view")
    assert r.status_code == 404


# -------- Backward compat: legacy stories with image_path (no media_path) --------
def test_legacy_story_image_path_compat():
    """Insert a doc directly in mongo with image_path only and verify GET /stories returns it
    with media_path filled in and media_type='image'. Skipped if pymongo not available."""
    try:
        from pymongo import MongoClient
        from datetime import datetime, timezone, timedelta
        import uuid as _uuid
    except Exception:
        pytest.skip("pymongo not available")

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not (mongo_url and db_name):
        pytest.skip("MONGO_URL/DB_NAME not configured")

    client = MongoClient(mongo_url)
    db = client[db_name]

    rider_doc = db.users.find_one({"email": "rider@drivehive.com"})
    assert rider_doc is not None
    legacy_id = str(_uuid.uuid4())
    db.stories.insert_one({
        "id": legacy_id,
        "user_id": rider_doc["id"],
        "image_path": "drivehive/legacy/old.jpg",  # legacy field
        "likes": [],
        "viewed_by": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
    })

    s, _ = _login("mike@drivehive.com", "mike123")
    try:
        r = s.get(f"{API}/stories")
        assert r.status_code == 200
        groups = r.json()
        rider_group = next((g for g in groups if g["user"]["id"] == rider_doc["id"]), None)
        assert rider_group is not None
        legacy = next((st for st in rider_group["stories"] if st["id"] == legacy_id), None)
        assert legacy is not None, "Legacy story not returned"
        assert legacy.get("media_path") == "drivehive/legacy/old.jpg"
        assert legacy.get("media_type") == "image"
    finally:
        db.stories.delete_one({"id": legacy_id})
        client.close()


# -------- Post share --------
def test_post_share_increments_and_notifies(rider, mike):
    rs = rider["session"]
    ms = mike["session"]
    r = rs.post(f"{API}/posts", json={"caption": "TEST_share_me"})
    pid = r.json()["id"]

    rs.post(f"{API}/notifications/read")

    # Mike shares
    r = ms.post(f"{API}/posts/{pid}/share")
    assert r.status_code == 200, r.text
    assert r.json()["shares"] == 1

    r = ms.post(f"{API}/posts/{pid}/share")
    assert r.json()["shares"] == 2

    # Rider gets share notification
    r = rs.get(f"{API}/notifications")
    assert any(
        n["type"] == "share" and n["entity_id"] == pid
        and n.get("from_user", {}).get("email") == "mike@drivehive.com"
        for n in r.json()
    )

    rs.delete(f"{API}/posts/{pid}")


def test_share_404(rider):
    r = rider["session"].post(f"{API}/posts/no-such-post/share")
    assert r.status_code == 404


# -------- Connections --------
def test_connections_dedup_sorted_excludes_self(rider, mike, sara):
    rs = rider["session"]
    ms = mike["session"]

    rider_id = rider["user"]["id"]
    mike_id = mike["user"]["id"]
    sara_id = sara["user"]["id"]

    # Rider follows mike
    rs.delete(f"{API}/users/{mike_id}/follow")
    rs.delete(f"{API}/users/{sara_id}/follow")
    ms.delete(f"{API}/users/{rider_id}/follow")

    rs.post(f"{API}/users/{mike_id}/follow")     # rider -> mike
    ms.post(f"{API}/users/{rider_id}/follow")    # mike -> rider (mutual)
    rs.post(f"{API}/users/{sara_id}/follow")     # rider -> sara

    r = rs.get(f"{API}/users/me/connections")
    assert r.status_code == 200
    items = r.json()
    ids = [u["id"] for u in items]
    # No duplicates
    assert len(ids) == len(set(ids))
    # Self excluded
    assert rider_id not in ids
    # Both mike & sara present
    assert mike_id in ids
    assert sara_id in ids
    # Sorted by name asc
    names = [u.get("name", "") for u in items]
    assert names == sorted(names)

    # Cleanup
    rs.delete(f"{API}/users/{mike_id}/follow")
    rs.delete(f"{API}/users/{sara_id}/follow")
    ms.delete(f"{API}/users/{rider_id}/follow")


def test_connections_unauth():
    r = requests.get(f"{API}/users/me/connections")
    assert r.status_code == 401
