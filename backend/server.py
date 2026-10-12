from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import asyncio
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Form, Query, Header
from fastapi.responses import Response as FastAPIResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from stripe_checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    CheckoutStatusResponse,
)
from storage import init_storage, put_object, get_object, APP_NAME

# -----------------------------------------------------------------------------
# DB / Logging
# -----------------------------------------------------------------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("drivehive")

# -----------------------------------------------------------------------------
# Auth helpers
# -----------------------------------------------------------------------------
JWT_ALGORITHM = "HS256"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60 * 24),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, user_id: str, email: str):
    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=60 * 60 * 24, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=60 * 60 * 24 * 7, path="/")
    return access


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class RegisterReq(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=60)
    role: Literal["user", "mechanic"] = "user"
    bio: Optional[str] = None
    specialty: Optional[str] = None  # for mechanics


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    role: str
    bio: Optional[str] = None
    specialty: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: str


class PostCreate(BaseModel):
    caption: str = ""
    image_path: Optional[str] = None  # legacy alias — set media_path instead
    media_path: Optional[str] = None
    media_type: Literal["image", "video"] = "image"


class StoryCreate(BaseModel):
    media_path: str
    media_type: Literal["image", "video"] = "image"


class EventCreate(BaseModel):
    title: str
    description: str = ""
    location: str
    starts_at: str  # ISO
    image_path: Optional[str] = None


class MessageCreate(BaseModel):
    to_user_id: str
    text: str


class CommentCreate(BaseModel):
    text: str


class BoostCheckoutReq(BaseModel):
    package_id: Literal["boost_7d", "boost_30d"]
    origin_url: str


# Feature boost packages (price is fixed server-side).
BOOST_PACKAGES = {
    "boost_7d":  {"amount": 4.99,  "currency": "usd", "days": 7,  "label": "7-day boost"},
    "boost_30d": {"amount": 14.99, "currency": "usd", "days": 30, "label": "30-day boost"},
}


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    specialty: Optional[str] = None
    avatar_url: Optional[str] = None


# -----------------------------------------------------------------------------
# App
# -----------------------------------------------------------------------------
app = FastAPI()
api = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def conversation_id(a: str, b: str) -> str:
    return ":".join(sorted([a, b]))


# ---------------------- Auth ----------------------
@api.post("/auth/register")
async def register(req: RegisterReq, response: Response):
    email = req.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(req.password),
        "name": req.name,
        "role": req.role,
        "bio": req.bio or "",
        "specialty": req.specialty or "",
        "avatar_url": "",
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    set_auth_cookies(response, user_id, email)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


@api.post("/auth/login")
async def login(req: LoginReq, response: Response):
    email = req.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    set_auth_cookies(response, user["id"], email)
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------------------- Files / Storage ----------------------
@api.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = (file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "bin").lower()
    image_exts = {"png", "jpg", "jpeg", "webp", "gif"}
    video_exts = {"mp4", "webm", "mov", "m4v"}
    allowed = image_exts | video_exts
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Only image/video uploads allowed")
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    limit = 10 * 1024 * 1024 if ext in image_exts else 60 * 1024 * 1024
    if len(data) > limit:
        raise HTTPException(status_code=413, detail="File too large")
    if ext in video_exts:
        content_type = file.content_type or ("video/mp4" if ext in ("mp4", "m4v") else f"video/{ext}")
    else:
        content_type = file.content_type or f"image/{'jpeg' if ext == 'jpg' else ext}"
    result = await asyncio.to_thread(put_object, path, data, content_type)
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "storage_path": result["path"],
        "original_filename": file.filename or "",
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": now_iso(),
    })
    media_type = "video" if ext in video_exts else "image"
    return {"path": result["path"], "url": f"/api/files/{result['path']}", "media_type": media_type}


@api.get("/files/{path:path}")
async def download_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        data, content_type = await asyncio.to_thread(get_object, path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    return FastAPIResponse(content=data, media_type=record.get("content_type") or content_type)


# ---------------------- Users / Profile ----------------------
async def public_user(uid: str) -> Optional[dict]:
    u = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
    return u


@api.get("/users/{user_id}")
async def get_user(user_id: str, _u: dict = Depends(get_current_user)):
    u = await public_user(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return u


@api.patch("/users/me")
async def update_me(req: ProfileUpdate, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in req.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    return await public_user(user["id"])


@api.get("/mechanics")
async def list_mechanics(_u: dict = Depends(get_current_user)):
    items = await db.users.find({"role": "mechanic"}, {"_id": 0, "password_hash": 0}).to_list(200)
    return items


# ---------------------- Posts ----------------------
@api.post("/posts")
async def create_post(req: PostCreate, user: dict = Depends(get_current_user)):
    media_path = req.media_path or req.image_path or ""
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "caption": req.caption,
        "image_path": media_path if req.media_type == "image" else "",
        "media_path": media_path,
        "media_type": req.media_type,
        "likes": [],
        "shares": 0,
        "created_at": now_iso(),
    }
    await db.posts.insert_one(doc)
    doc.pop("_id", None)
    doc["author"] = await public_user(user["id"])
    return doc


@api.get("/posts/feed")
async def feed(_u: dict = Depends(get_current_user)):
    posts = await db.posts.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    user_ids = list({p["user_id"] for p in posts})
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(200)
    by_id = {u["id"]: u for u in users}
    for p in posts:
        p["author"] = by_id.get(p["user_id"])
        # Back-compat: older posts only have image_path
        if "media_path" not in p:
            p["media_path"] = p.get("image_path") or ""
            p["media_type"] = "image"
    return posts


@api.get("/posts/user/{user_id}")
async def user_posts(user_id: str, _u: dict = Depends(get_current_user)):
    posts = await db.posts.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    author = await public_user(user_id)
    for p in posts:
        p["author"] = author
        if "media_path" not in p:
            p["media_path"] = p.get("image_path") or ""
            p["media_type"] = "image"
    return posts


@api.post("/posts/{post_id}/like")
async def like_post(post_id: str, user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    likes = set(post.get("likes", []))
    liked_now = user["id"] not in likes
    if user["id"] in likes:
        likes.remove(user["id"])
    else:
        likes.add(user["id"])
    await db.posts.update_one({"id": post_id}, {"$set": {"likes": list(likes)}})
    if liked_now:
        await create_notification(post["user_id"], user["id"], "like", post_id, "")
    return {"likes": list(likes), "liked": user["id"] in likes}


@api.post("/posts/{post_id}/share")
async def share_post(post_id: str, user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    await db.posts.update_one({"id": post_id}, {"$inc": {"shares": 1}})
    await create_notification(post["user_id"], user["id"], "share", post_id, "shared your post")
    updated = await db.posts.find_one({"id": post_id}, {"_id": 0})
    return {"shares": updated.get("shares", 0)}


@api.delete("/posts/{post_id}")
async def delete_post(post_id: str, user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your post")
    await db.posts.delete_one({"id": post_id})
    return {"ok": True}


# ---------------------- Stories ----------------------
@api.post("/stories")
async def create_story(req: StoryCreate, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "media_path": req.media_path,
        "media_type": req.media_type,
        "likes": [],
        "viewed_by": [],
        "created_at": now_iso(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
    }
    await db.stories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/stories")
async def list_stories(user: dict = Depends(get_current_user)):
    cutoff = datetime.now(timezone.utc).isoformat()
    stories = await db.stories.find({"expires_at": {"$gt": cutoff}}, {"_id": 0}).sort("created_at", 1).to_list(500)
    user_ids = list({s["user_id"] for s in stories})
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(500)
    by_id = {u["id"]: u for u in users}
    grouped: dict = {}
    for s in stories:
        # Back-compat for older docs (pre-rename from image_path → media_path)
        if "media_path" not in s and "image_path" in s:
            s["media_path"] = s.get("image_path") or ""
            s["media_type"] = "image"
        grouped.setdefault(s["user_id"], {"user": by_id.get(s["user_id"]), "stories": [], "has_unviewed": False})
        grouped[s["user_id"]]["stories"].append(s)
        if user["id"] not in (s.get("viewed_by") or []) and s["user_id"] != user["id"]:
            grouped[s["user_id"]]["has_unviewed"] = True
    # Groups with unviewed first, then alphabetical by name
    items = list(grouped.values())
    items.sort(key=lambda g: (0 if g["has_unviewed"] else 1, (g["user"] or {}).get("name", "")))
    return items


@api.post("/stories/{story_id}/view")
async def view_story(story_id: str, user: dict = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    if user["id"] not in (story.get("viewed_by") or []):
        await db.stories.update_one({"id": story_id}, {"$addToSet": {"viewed_by": user["id"]}})
    return {"ok": True}


@api.post("/stories/{story_id}/like")
async def like_story(story_id: str, user: dict = Depends(get_current_user)):
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    likes = set(story.get("likes", []))
    liked_now = user["id"] not in likes
    if liked_now:
        likes.add(user["id"])
    else:
        likes.remove(user["id"])
    await db.stories.update_one({"id": story_id}, {"$set": {"likes": list(likes)}})
    if liked_now and story["user_id"] != user["id"]:
        await create_notification(story["user_id"], user["id"], "like", story_id, "liked your story")
    return {"likes": list(likes), "liked": liked_now}


# ---------------------- Events ----------------------
@api.post("/events")
async def create_event(req: EventCreate, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "title": req.title,
        "description": req.description,
        "location": req.location,
        "starts_at": req.starts_at,
        "image_path": req.image_path or "",
        "created_at": now_iso(),
    }
    await db.events.insert_one(doc)
    doc.pop("_id", None)
    doc["author"] = await public_user(user["id"])
    return doc


@api.get("/events")
async def list_events(_u: dict = Depends(get_current_user)):
    events = await db.events.find({}, {"_id": 0}).sort("starts_at", 1).to_list(500)
    now_s = now_iso()
    user_ids = list({e["user_id"] for e in events})
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(500)
    by_id = {u["id"]: u for u in users}
    for e in events:
        e["author"] = by_id.get(e["user_id"])
        e["is_featured"] = bool(e.get("featured_until") and e["featured_until"] > now_s)
    # Featured first (preserve starts_at ordering within each group)
    events.sort(key=lambda e: (0 if e["is_featured"] else 1, e.get("starts_at", "")))
    return events


@api.delete("/events/{event_id}")
async def delete_event(event_id: str, user: dict = Depends(get_current_user)):
    ev = await db.events.find_one({"id": event_id})
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    if ev["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not yours")
    await db.events.delete_one({"id": event_id})
    return {"ok": True}


# ---------------------- Messages ----------------------
@api.post("/messages")
async def send_message(req: MessageCreate, user: dict = Depends(get_current_user)):
    target = await db.users.find_one({"id": req.to_user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Recipient not found")
    doc = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id(user["id"], req.to_user_id),
        "from_user_id": user["id"],
        "to_user_id": req.to_user_id,
        "text": req.text,
        "created_at": now_iso(),
    }
    await db.messages.insert_one(doc)
    doc.pop("_id", None)
    await create_notification(req.to_user_id, user["id"], "message", req.to_user_id, req.text[:80])
    return doc


@api.get("/messages/conversations")
async def list_conversations(user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"$or": [{"from_user_id": user["id"]}, {"to_user_id": user["id"]}]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$conversation_id",
            "last_message": {"$first": "$$ROOT"},
        }},
    ]
    cursor = db.messages.aggregate(pipeline)
    convs = []
    async for c in cursor:
        last = c["last_message"]
        last.pop("_id", None)
        other_id = last["to_user_id"] if last["from_user_id"] == user["id"] else last["from_user_id"]
        other = await public_user(other_id)
        convs.append({"other_user": other, "last_message": last})
    return convs


@api.get("/messages/{other_user_id}")
async def get_thread(other_user_id: str, user: dict = Depends(get_current_user)):
    cid = conversation_id(user["id"], other_user_id)
    msgs = await db.messages.find({"conversation_id": cid}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return msgs


# ---------------------- Notifications ----------------------
async def create_notification(user_id: str, from_user_id: str, ntype: str, entity_id: str = "", text: str = ""):
    if user_id == from_user_id:
        return
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "from_user_id": from_user_id,
        "type": ntype,
        "entity_id": entity_id,
        "text": text,
        "read": False,
        "created_at": now_iso(),
    })


@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    notifs = await db.notifications.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    from_ids = list({n["from_user_id"] for n in notifs if n.get("from_user_id")})
    users = await db.users.find({"id": {"$in": from_ids}}, {"_id": 0, "password_hash": 0}).to_list(500)
    by_id = {u["id"]: u for u in users}
    for n in notifs:
        n["from_user"] = by_id.get(n.get("from_user_id"))
    return notifs


@api.post("/notifications/read")
async def mark_notifications_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ---------------------- Comments ----------------------
@api.get("/posts/{post_id}/comments")
async def list_comments(post_id: str, _u: dict = Depends(get_current_user)):
    comments = await db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    user_ids = list({c["user_id"] for c in comments})
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(500)
    by_id = {u["id"]: u for u in users}
    for c in comments:
        c["author"] = by_id.get(c["user_id"])
    return comments


@api.post("/posts/{post_id}/comments")
async def add_comment(post_id: str, req: CommentCreate, user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Comment cannot be empty")
    doc = {
        "id": str(uuid.uuid4()),
        "post_id": post_id,
        "user_id": user["id"],
        "text": req.text.strip(),
        "created_at": now_iso(),
    }
    await db.comments.insert_one(doc)
    doc.pop("_id", None)
    doc["author"] = await public_user(user["id"])
    await create_notification(post["user_id"], user["id"], "comment", post_id, req.text.strip()[:80])
    return doc


# ---------------------- Follows ----------------------
@api.post("/users/{user_id}/follow")
async def follow_user(user_id: str, user: dict = Depends(get_current_user)):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = await db.follows.find_one({"follower_id": user["id"], "following_id": user_id})
    if existing:
        return {"following": True}
    await db.follows.insert_one({
        "id": str(uuid.uuid4()),
        "follower_id": user["id"],
        "following_id": user_id,
        "created_at": now_iso(),
    })
    await create_notification(user_id, user["id"], "follow", user["id"], "")
    return {"following": True}


@api.delete("/users/{user_id}/follow")
async def unfollow_user(user_id: str, user: dict = Depends(get_current_user)):
    await db.follows.delete_one({"follower_id": user["id"], "following_id": user_id})
    return {"following": False}


@api.get("/users/{user_id}/stats")
async def user_stats(user_id: str, user: dict = Depends(get_current_user)):
    followers = await db.follows.count_documents({"following_id": user_id})
    following = await db.follows.count_documents({"follower_id": user_id})
    is_following = False
    if user_id != user["id"]:
        is_following = bool(await db.follows.find_one({"follower_id": user["id"], "following_id": user_id}))
    return {"followers": followers, "following": following, "is_following": is_following}


@api.get("/users/me/connections")
async def list_connections(user: dict = Depends(get_current_user)):
    """People the current user follows + people who follow them (deduped)."""
    following_docs = await db.follows.find({"follower_id": user["id"]}, {"_id": 0}).to_list(500)
    follower_docs = await db.follows.find({"following_id": user["id"]}, {"_id": 0}).to_list(500)
    ids = {d["following_id"] for d in following_docs} | {d["follower_id"] for d in follower_docs}
    ids.discard(user["id"])
    users = await db.users.find({"id": {"$in": list(ids)}}, {"_id": 0, "password_hash": 0}).to_list(500)
    users.sort(key=lambda u: u.get("name", ""))
    return users


# ---------------------- Search ----------------------
@api.get("/search")
async def search(q: str = Query(""), _u: dict = Depends(get_current_user)):
    q = (q or "").strip()
    if not q:
        return {"users": [], "posts": []}
    regex = {"$regex": q, "$options": "i"}
    users = await db.users.find(
        {"$or": [{"name": regex}, {"email": regex}, {"specialty": regex}]},
        {"_id": 0, "password_hash": 0},
    ).limit(20).to_list(20)
    posts = await db.posts.find({"caption": regex}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    user_ids = list({p["user_id"] for p in posts})
    pusers = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(100)
    by_id = {u["id"]: u for u in pusers}
    for p in posts:
        p["author"] = by_id.get(p["user_id"])
    return {"users": users, "posts": posts}



# ---------------------- Payments / Feature boost ----------------------
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")


def _stripe_checkout(request: Request) -> StripeCheckout:
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Payments not configured")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)


@api.get("/payments/packages")
async def list_boost_packages(_u: dict = Depends(get_current_user)):
    return [
        {"id": pid, "amount": p["amount"], "currency": p["currency"],
         "days": p["days"], "label": p["label"]}
        for pid, p in BOOST_PACKAGES.items()
    ]


@api.post("/events/{event_id}/boost/checkout")
async def create_boost_checkout(
    event_id: str,
    req: BoostCheckoutReq,
    http_request: Request,
    user: dict = Depends(get_current_user),
):
    event = await db.events.find_one({"id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only boost your own events")
    if req.package_id not in BOOST_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")

    pkg = BOOST_PACKAGES[req.package_id]
    origin = req.origin_url.rstrip("/")
    success_url = f"{origin}/events?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/events"

    metadata = {
        "event_id": event_id,
        "user_id": user["id"],
        "package_id": req.package_id,
        "days": str(pkg["days"]),
        "purpose": "drivehive_event_boost",
    }
    checkout = _stripe_checkout(http_request)
    session: CheckoutSessionResponse = await checkout.create_checkout_session(
        CheckoutSessionRequest(
            amount=float(pkg["amount"]),
            currency=pkg["currency"],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata,
        )
    )

    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "event_id": event_id,
        "user_id": user["id"],
        "package_id": req.package_id,
        "amount": float(pkg["amount"]),
        "currency": pkg["currency"],
        "days": pkg["days"],
        "status": "initiated",
        "payment_status": "pending",
        "metadata": metadata,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "fulfilled": False,
    })
    return {"url": session.url, "session_id": session.session_id}


async def _fulfill_boost(session_id: str, status_obj: CheckoutStatusResponse):
    """Idempotently apply featured_until to the event after payment succeeds."""
    tx = await db.payment_transactions.find_one({"session_id": session_id})
    if not tx:
        return None
    # Always refresh tx status
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "status": status_obj.status,
            "payment_status": status_obj.payment_status,
            "updated_at": now_iso(),
        }},
    )
    if status_obj.payment_status == "paid" and not tx.get("fulfilled"):
        days = int(tx.get("days") or status_obj.metadata.get("days", 7))
        event_id = tx["event_id"]
        new_until = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
        # Extend if already featured in the future
        event = await db.events.find_one({"id": event_id})
        if event:
            current = event.get("featured_until") or ""
            if current > new_until:
                new_until = current  # keep the longer one; still extend from max(current, now)
            else:
                # Extend from the later of now or current
                base = max(
                    datetime.now(timezone.utc),
                    datetime.fromisoformat(current) if current else datetime.now(timezone.utc),
                )
                new_until = (base + timedelta(days=days)).isoformat()
            await db.events.update_one(
                {"id": event_id},
                {"$set": {"featured_until": new_until, "featured_by": tx["user_id"]}},
            )
        await db.payment_transactions.update_one(
            {"session_id": session_id}, {"$set": {"fulfilled": True}}
        )
    return status_obj


@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str, http_request: Request, user: dict = Depends(get_current_user)):
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your transaction")
    checkout = _stripe_checkout(http_request)
    try:
        status_obj: CheckoutStatusResponse = await checkout.get_checkout_status(session_id)
    except Exception as e:
        logger.warning(f"get_checkout_status failed for {session_id}: {e}")
        return {
            "status": tx.get("status", "unknown"),
            "payment_status": tx.get("payment_status", "pending"),
            "amount_total": None,
            "currency": tx.get("currency"),
            "event_id": tx.get("event_id"),
            "fulfilled": tx.get("fulfilled", False),
        }
    await _fulfill_boost(session_id, status_obj)
    refreshed = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    return {
        "status": status_obj.status,
        "payment_status": status_obj.payment_status,
        "amount_total": status_obj.amount_total,
        "currency": status_obj.currency,
        "event_id": tx.get("event_id"),
        "fulfilled": (refreshed or {}).get("fulfilled", False),
    }


@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature")
    if not STRIPE_API_KEY:
        return {"ok": False, "reason": "stripe not configured"}
    checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    try:
        evt = await checkout.handle_webhook(body, sig)
    except Exception as e:  # signature / parse failure
        logger.error(f"stripe webhook error: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook")
    if evt and getattr(evt, "session_id", None):
        # Re-query authoritative status and fulfill
        status_obj: CheckoutStatusResponse = await checkout.get_checkout_status(evt.session_id)
        await _fulfill_boost(evt.session_id, status_obj)
    return {"ok": True}



# -----------------------------------------------------------------------------
# Startup
# -----------------------------------------------------------------------------
SEED_USERS = [
    {"email": "rider@drivehive.com", "password": "rider123", "name": "Alex Rider", "role": "user",
     "bio": "JDM enthusiast. Daily a Civic Type R."},
    {"email": "mike@drivehive.com", "password": "mike123", "name": "Mike Torres", "role": "mechanic",
     "specialty": "Engine & Drivetrain", "bio": "ASE-certified. 12 years on Hondas, Subarus, Mazdas."},
    {"email": "sara@drivehive.com", "password": "sara123", "name": "Sara Lin", "role": "mechanic",
     "specialty": "Suspension & Brakes", "bio": "Track-day prep specialist. Coilovers, BBKs, alignments."},
    {"email": "leo@drivehive.com", "password": "leo123", "name": "Leo Park", "role": "mechanic",
     "specialty": "Electrical & Diagnostics", "bio": "EV + ECU tunes. OBD2 wizard."},
]


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@drivehive.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "DriveHive Admin",
            "role": "admin",
            "bio": "",
            "specialty": "",
            "avatar_url": "",
            "created_at": now_iso(),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    for u in SEED_USERS:
        if not await db.users.find_one({"email": u["email"]}):
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": u["email"],
                "password_hash": hash_password(u["password"]),
                "name": u["name"],
                "role": u["role"],
                "bio": u.get("bio", ""),
                "specialty": u.get("specialty", ""),
                "avatar_url": "",
                "created_at": now_iso(),
            })


@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.posts.create_index("user_id")
        await db.posts.create_index("created_at")
        await db.stories.create_index("expires_at")
        await db.events.create_index("starts_at")
        await db.messages.create_index("conversation_id")
        await db.comments.create_index("post_id")
        await db.follows.create_index([("follower_id", 1), ("following_id", 1)], unique=True)
        await db.notifications.create_index("user_id")
        await db.payment_transactions.create_index("session_id", unique=True)
        await db.payment_transactions.create_index("user_id")
        await db.events.create_index("featured_until")
        await seed_admin()
        logger.info("Startup OK")
    except Exception as e:
        logger.error(f"Startup error: {e}")
    try:
        init_storage()
        logger.info("File storage (GridFS) ready")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api)

# CORS — must allow credentials for cookie-based auth.
# Browser rejects "*" with allow_credentials=True. Use regex to allow any origin.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
