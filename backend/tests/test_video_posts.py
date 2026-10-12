"""Tests for video post + story video duration changes (iteration 8)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def rider():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": "rider@drivehive.com", "password": "rider123"})
    assert r.status_code == 200, r.text
    return {"session": s, "user": r.json()}


# ----- Posts: video media -----
def test_create_video_post_via_media_path(rider):
    s = rider["session"]
    fake_path = f"drivehive/test/{uuid.uuid4().hex}.mp4"
    r = s.post(f"{API}/posts", json={
        "caption": "TEST_video_post",
        "media_path": fake_path,
        "media_type": "video",
    })
    assert r.status_code == 200, r.text
    post = r.json()
    pid = post["id"]
    assert post["caption"] == "TEST_video_post"
    assert post["media_type"] == "video"
    assert post["media_path"] == fake_path
    # For video: image_path must be empty string
    assert post["image_path"] == ""

    # Verify in feed and persisted via GET feed
    r = s.get(f"{API}/posts/feed")
    assert r.status_code == 200
    found = next((p for p in r.json() if p["id"] == pid), None)
    assert found is not None
    assert found["media_type"] == "video"
    assert found["media_path"] == fake_path
    assert found["image_path"] == ""

    # Verify in user posts
    r = s.get(f"{API}/posts/user/{rider['user']['id']}")
    assert r.status_code == 200
    found = next((p for p in r.json() if p["id"] == pid), None)
    assert found is not None
    assert found["media_type"] == "video"

    # Cleanup
    s.delete(f"{API}/posts/{pid}")


def test_create_image_post_via_media_path(rider):
    s = rider["session"]
    fake_path = f"drivehive/test/{uuid.uuid4().hex}.jpg"
    r = s.post(f"{API}/posts", json={
        "caption": "TEST_image_via_media",
        "media_path": fake_path,
        "media_type": "image",
    })
    assert r.status_code == 200, r.text
    post = r.json()
    assert post["media_type"] == "image"
    assert post["media_path"] == fake_path
    # For image, image_path is also populated for back-compat
    assert post["image_path"] == fake_path
    s.delete(f"{API}/posts/{post['id']}")


def test_legacy_image_path_post_still_works(rider):
    """Old client sends image_path only — should default media_type=image."""
    s = rider["session"]
    fake_path = f"drivehive/test/{uuid.uuid4().hex}.jpg"
    r = s.post(f"{API}/posts", json={
        "caption": "TEST_legacy",
        "image_path": fake_path,
    })
    assert r.status_code == 200, r.text
    post = r.json()
    pid = post["id"]
    assert post["media_type"] == "image"
    assert post["media_path"] == fake_path
    assert post["image_path"] == fake_path

    # Feed back-compat
    r = s.get(f"{API}/posts/feed")
    found = next((p for p in r.json() if p["id"] == pid), None)
    assert found is not None
    assert found.get("media_type") == "image"
    assert found.get("media_path") == fake_path

    s.delete(f"{API}/posts/{pid}")


def test_caption_only_post(rider):
    """A pure-text post should still work (no media)."""
    s = rider["session"]
    r = s.post(f"{API}/posts", json={"caption": "TEST_text_only"})
    assert r.status_code == 200, r.text
    post = r.json()
    assert post["media_type"] == "image"  # default
    assert post["media_path"] == ""
    s.delete(f"{API}/posts/{post['id']}")


# ----- Stories: video still accepted (no behaviour change server-side) -----
def test_create_video_story(rider):
    s = rider["session"]
    fake_path = f"drivehive/test/{uuid.uuid4().hex}.mp4"
    r = s.post(f"{API}/stories", json={"media_path": fake_path, "media_type": "video"})
    assert r.status_code == 200, r.text
    story = r.json()
    assert story["media_type"] == "video"
    assert story["media_path"] == fake_path

    # Confirm appears in /stories listing
    r = s.get(f"{API}/stories")
    assert r.status_code == 200
    flat = [st for g in r.json() for st in g.get("stories", [])]
    assert any(st["id"] == story["id"] and st["media_type"] == "video" for st in flat)
