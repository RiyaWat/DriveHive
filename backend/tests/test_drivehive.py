import os
import io
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


def _session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def rider():
    s = _session()
    r = s.post(f"{API}/auth/login", json={"email": "rider@drivehive.com", "password": "rider123"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["email"] == "rider@drivehive.com"
    assert "id" in data
    return {"session": s, "user": data}


@pytest.fixture(scope="module")
def mike():
    s = _session()
    r = s.post(f"{API}/auth/login", json={"email": "mike@drivehive.com", "password": "mike123"})
    assert r.status_code == 200, r.text
    return {"session": s, "user": r.json()}


# -------- Auth --------
def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"email": "rider@drivehive.com", "password": "wrong"})
    assert r.status_code == 401


def test_seeded_logins():
    for email, pw in [("admin@drivehive.com", "admin123"), ("rider@drivehive.com", "rider123"),
                      ("mike@drivehive.com", "mike123"), ("sara@drivehive.com", "sara123")]:
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 200, f"{email} failed: {r.text}"
        assert r.json()["email"] == email
        assert "access_token" in r.cookies


def test_me_with_cookie(rider):
    r = rider["session"].get(f"{API}/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == "rider@drivehive.com"


def test_me_unauth():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_register_and_duplicate():
    email = f"test_{uuid.uuid4().hex[:8]}@drivehive.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass123", "name": "Test U", "role": "user"})
    assert r.status_code == 200, r.text
    assert r.json()["email"] == email
    # duplicate
    r2 = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass123", "name": "X", "role": "user"})
    assert r2.status_code == 400


def test_logout(rider):
    s = _session()
    s.post(f"{API}/auth/login", json={"email": "rider@drivehive.com", "password": "rider123"})
    r = s.post(f"{API}/auth/logout")
    assert r.status_code == 200


# -------- Mechanics --------
def test_mechanics_only_mechanics(rider):
    r = rider["session"].get(f"{API}/mechanics")
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 3
    for m in items:
        assert m["role"] == "mechanic"
    emails = {m["email"] for m in items}
    assert {"mike@drivehive.com", "sara@drivehive.com", "leo@drivehive.com"}.issubset(emails)


# -------- Posts CRUD --------
def test_post_create_feed_like_delete(rider):
    s = rider["session"]
    r = s.post(f"{API}/posts", json={"caption": "TEST_post hello", "image_path": ""})
    assert r.status_code == 200, r.text
    post = r.json()
    pid = post["id"]
    assert post["caption"] == "TEST_post hello"
    assert post.get("author", {}).get("email") == "rider@drivehive.com"

    r = s.get(f"{API}/posts/feed")
    assert r.status_code == 200
    assert any(p["id"] == pid for p in r.json())

    r = s.get(f"{API}/posts/user/{rider['user']['id']}")
    assert r.status_code == 200
    assert any(p["id"] == pid for p in r.json())

    r = s.post(f"{API}/posts/{pid}/like")
    assert r.status_code == 200
    assert r.json()["liked"] is True
    r = s.post(f"{API}/posts/{pid}/like")
    assert r.json()["liked"] is False

    r = s.delete(f"{API}/posts/{pid}")
    assert r.status_code == 200


def test_delete_others_post_forbidden(rider, mike):
    r = rider["session"].post(f"{API}/posts", json={"caption": "TEST_mine"})
    pid = r.json()["id"]
    r2 = mike["session"].delete(f"{API}/posts/{pid}")
    assert r2.status_code == 403
    rider["session"].delete(f"{API}/posts/{pid}")


# -------- Stories --------
def test_stories_create_list(rider):
    s = rider["session"]
    r = s.post(f"{API}/stories", json={"media_path": "drivehive/test/story.jpg", "media_type": "image"})
    assert r.status_code == 200
    r = s.get(f"{API}/stories")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# -------- Events --------
def test_event_create_list_delete(rider):
    s = rider["session"]
    r = s.post(f"{API}/events", json={"title": "TEST_meet", "description": "d", "location": "LA", "starts_at": "2026-06-01T10:00:00Z"})
    assert r.status_code == 200
    eid = r.json()["id"]
    r = s.get(f"{API}/events")
    assert r.status_code == 200
    assert any(e["id"] == eid for e in r.json())
    r = s.delete(f"{API}/events/{eid}")
    assert r.status_code == 200


# -------- Messages --------
def test_messages_flow(rider, mike):
    s = rider["session"]
    mike_id = mike["user"]["id"]
    r = s.post(f"{API}/messages", json={"to_user_id": mike_id, "text": "TEST_hello mike"})
    assert r.status_code == 200
    r = s.get(f"{API}/messages/{mike_id}")
    assert r.status_code == 200
    msgs = r.json()
    assert any(m["text"] == "TEST_hello mike" for m in msgs)
    r = s.get(f"{API}/messages/conversations")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# -------- Users / Profile --------
def test_get_user_and_patch_me(rider):
    s = rider["session"]
    uid = rider["user"]["id"]
    r = s.get(f"{API}/users/{uid}")
    assert r.status_code == 200
    assert r.json()["id"] == uid

    r = s.patch(f"{API}/users/me", json={"bio": "TEST_bio updated"})
    assert r.status_code == 200
    assert r.json()["bio"] == "TEST_bio updated"

    r = s.get(f"{API}/auth/me")
    assert r.json()["bio"] == "TEST_bio updated"


# -------- Upload --------
def test_upload_image(rider):
    s = rider["session"]
    # Minimal PNG
    png = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000000500010d0a2db40000000049454e44ae426082")
    files = {"file": ("t.png", io.BytesIO(png), "image/png")}
    headers = {k: v for k, v in s.headers.items() if k != "Content-Type"}
    r = requests.post(f"{API}/upload", files=files, cookies=s.cookies, headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "path" in data and "url" in data
    # GET file back
    r2 = requests.get(f"{BASE_URL}{data['url']}")
    assert r2.status_code == 200
    assert r2.content == png


def test_upload_rejects_non_image(rider):
    s = rider["session"]
    files = {"file": ("t.txt", io.BytesIO(b"hi"), "text/plain")}
    headers = {k: v for k, v in s.headers.items() if k != "Content-Type"}
    r = requests.post(f"{API}/upload", files=files, cookies=s.cookies, headers=headers)
    assert r.status_code == 400


# -------- Comments --------
def test_comments_create_list_and_notification(rider, mike):
    rs = rider["session"]
    ms = mike["session"]
    # rider creates a post
    r = rs.post(f"{API}/posts", json={"caption": "TEST_comment_target"})
    assert r.status_code == 200
    pid = r.json()["id"]

    # mike marks notifs read first to simplify check
    ms.post(f"{API}/notifications/read")

    # empty list
    r = rs.get(f"{API}/posts/{pid}/comments")
    assert r.status_code == 200
    assert r.json() == []

    # mike comments on rider's post
    r = ms.post(f"{API}/posts/{pid}/comments", json={"text": "TEST_nice_post"})
    assert r.status_code == 200, r.text
    c = r.json()
    assert c["text"] == "TEST_nice_post"
    assert c["post_id"] == pid
    assert c.get("author", {}).get("email") == "mike@drivehive.com"

    # empty comment rejected
    r = ms.post(f"{API}/posts/{pid}/comments", json={"text": "   "})
    assert r.status_code == 400

    # rider sees the comment
    r = rs.get(f"{API}/posts/{pid}/comments")
    assert r.status_code == 200
    items = r.json()
    assert any(x["text"] == "TEST_nice_post" for x in items)
    assert items[0]["author"]["email"] == "mike@drivehive.com"

    # rider should have a 'comment' notification from mike
    r = rs.get(f"{API}/notifications")
    assert r.status_code == 200
    notifs = r.json()
    assert any(n["type"] == "comment" and n["entity_id"] == pid and
               n.get("from_user", {}).get("email") == "mike@drivehive.com" for n in notifs)

    # cleanup
    rs.delete(f"{API}/posts/{pid}")


def test_comment_on_missing_post(rider):
    r = rider["session"].post(f"{API}/posts/does-not-exist/comments", json={"text": "hi"})
    assert r.status_code == 404


# -------- Follows --------
def test_follow_unfollow_stats_and_notification(rider, mike):
    rs = rider["session"]
    ms = mike["session"]
    rider_id = rider["user"]["id"]
    mike_id = mike["user"]["id"]

    # ensure clean state
    rs.delete(f"{API}/users/{mike_id}/follow")

    # cannot follow self
    r = rs.post(f"{API}/users/{rider_id}/follow")
    assert r.status_code == 400

    # follow
    r = rs.post(f"{API}/users/{mike_id}/follow")
    assert r.status_code == 200
    assert r.json()["following"] is True

    # idempotent
    r = rs.post(f"{API}/users/{mike_id}/follow")
    assert r.status_code == 200
    assert r.json()["following"] is True

    # stats from rider (is_following True for mike)
    r = rs.get(f"{API}/users/{mike_id}/stats")
    assert r.status_code == 200
    s = r.json()
    assert s["followers"] >= 1
    assert s["is_following"] is True
    assert isinstance(s["following"], int)

    # stats from mike about himself: is_following False (self)
    r = ms.get(f"{API}/users/{mike_id}/stats")
    assert r.json()["is_following"] is False
    assert r.json()["followers"] >= 1

    # mike has follow notification from rider
    r = ms.get(f"{API}/notifications")
    notifs = r.json()
    assert any(n["type"] == "follow" and n.get("from_user", {}).get("email") == "rider@drivehive.com"
               for n in notifs)

    # unfollow
    r = rs.delete(f"{API}/users/{mike_id}/follow")
    assert r.status_code == 200
    assert r.json()["following"] is False

    r = rs.get(f"{API}/users/{mike_id}/stats")
    assert r.json()["is_following"] is False


def test_follow_missing_user(rider):
    r = rider["session"].post(f"{API}/users/{uuid.uuid4().hex}/follow")
    assert r.status_code == 404


# -------- Like notification --------
def test_like_creates_notification_only_on_like(rider, mike):
    rs = rider["session"]
    ms = mike["session"]

    r = rs.post(f"{API}/posts", json={"caption": "TEST_like_target"})
    pid = r.json()["id"]

    # mark rider's notifs as read first
    rs.post(f"{API}/notifications/read")

    # mike likes -> rider should get notification
    r = ms.post(f"{API}/posts/{pid}/like")
    assert r.status_code == 200
    # NOTE: server.py doesn't appear to call create_notification on like;
    # this test asserts current behavior expected by the spec.
    r = rs.get(f"{API}/notifications")
    has_like = any(n["type"] == "like" and n["entity_id"] == pid and
                   n.get("from_user", {}).get("email") == "mike@drivehive.com"
                   for n in r.json())

    # mike unlikes -> no new like notification should be created
    ms.post(f"{API}/posts/{pid}/like")

    rs.delete(f"{API}/posts/{pid}")
    assert has_like, "Like did not create a 'like' notification for the post author"


# -------- Messages notification --------
def test_message_creates_notification(rider, mike):
    rs = rider["session"]
    ms = mike["session"]
    # mike clears notifs first
    ms.post(f"{API}/notifications/read")
    r = rs.post(f"{API}/messages", json={"to_user_id": mike["user"]["id"], "text": "TEST_notif_msg"})
    assert r.status_code == 200
    r = ms.get(f"{API}/notifications")
    assert any(n["type"] == "message" and n.get("from_user", {}).get("email") == "rider@drivehive.com"
               for n in r.json())


# -------- Notifications list/read --------
def test_notifications_sorted_and_read(rider, mike):
    rs = rider["session"]
    # generate a couple of notifications: mike follows rider, then unfollows
    ms = mike["session"]
    rider_id = rider["user"]["id"]
    ms.delete(f"{API}/users/{rider_id}/follow")
    ms.post(f"{API}/users/{rider_id}/follow")

    r = rs.get(f"{API}/notifications")
    assert r.status_code == 200
    notifs = r.json()
    assert len(notifs) >= 1
    # sorted desc by created_at
    timestamps = [n["created_at"] for n in notifs]
    assert timestamps == sorted(timestamps, reverse=True)
    for n in notifs:
        assert "from_user" in n

    # mark all read
    r = rs.post(f"{API}/notifications/read")
    assert r.status_code == 200
    r = rs.get(f"{API}/notifications")
    assert all(n["read"] is True for n in r.json())

    ms.delete(f"{API}/users/{rider_id}/follow")


# -------- Search --------
def test_search_users_and_posts(rider):
    s = rider["session"]
    # create an identifiable post
    unique = f"TEST_search_{uuid.uuid4().hex[:6]}"
    r = s.post(f"{API}/posts", json={"caption": f"hello {unique} world"})
    pid = r.json()["id"]

    # empty q
    r = s.get(f"{API}/search", params={"q": ""})
    assert r.status_code == 200
    assert r.json() == {"users": [], "posts": []}

    # search by user name (case-insensitive)
    r = s.get(f"{API}/search", params={"q": "MIKE"})
    assert r.status_code == 200
    data = r.json()
    assert any(u["email"] == "mike@drivehive.com" for u in data["users"])

    # search by specialty
    r = s.get(f"{API}/search", params={"q": "Suspension"})
    assert any(u["email"] == "sara@drivehive.com" for u in r.json()["users"])

    # search by caption
    r = s.get(f"{API}/search", params={"q": unique})
    posts = r.json()["posts"]
    assert any(p["id"] == pid for p in posts)
    assert posts[0].get("author", {}).get("email") == "rider@drivehive.com"

    s.delete(f"{API}/posts/{pid}")


def test_search_unauth():
    r = requests.get(f"{API}/search", params={"q": "mike"})
    assert r.status_code == 401
