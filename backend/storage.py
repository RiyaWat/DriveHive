"""File storage kept inside the app's own MongoDB (GridFS).

Replaces the hosted object-storage service the app was generated with, so the
backend needs nothing beyond MONGO_URL / DB_NAME. Same three functions as before:
init_storage(), put_object(path, data, content_type), get_object(path).
"""
import os
import logging
from typing import Optional, Tuple

import gridfs
from pymongo import MongoClient

log = logging.getLogger("storage")
APP_NAME = os.environ.get("APP_NAME", "drivehive")

_fs: Optional[gridfs.GridFS] = None


def init_storage() -> Optional[gridfs.GridFS]:
    """Open the GridFS bucket. Idempotent. Returns None if Mongo isn't configured."""
    global _fs
    if _fs is not None:
        return _fs
    url = os.environ.get("MONGO_URL")
    name = os.environ.get("DB_NAME")
    if not url or not name:
        log.warning("MONGO_URL / DB_NAME not set; file storage disabled")
        return None
    _fs = gridfs.GridFS(MongoClient(url)[name], collection="uploads")
    return _fs


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Store bytes under `path`. Returns {path, size}."""
    fs = init_storage()
    if fs is None:
        raise RuntimeError("file storage not configured (MONGO_URL / DB_NAME)")
    for old in fs.find({"filename": path}):
        fs.delete(old._id)
    fs.put(data, filename=path, content_type=content_type)
    return {"path": path, "size": len(data)}


def get_object(path: str) -> Tuple[bytes, str]:
    """Return (bytes, content_type) for `path`; raises FileNotFoundError if missing."""
    fs = init_storage()
    if fs is None:
        raise RuntimeError("file storage not configured (MONGO_URL / DB_NAME)")
    f = fs.find_one({"filename": path})
    if f is None:
        raise FileNotFoundError(path)
    return f.read(), (getattr(f, "content_type", None) or "application/octet-stream")
