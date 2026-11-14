"""Read-only adapter for the configured, shared lesson scraper."""
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote, urlparse

import requests
from flask import current_app


class LessonsUnavailable(Exception):
    pass


class LessonNotFound(Exception):
    pass


def safe_url(value):
    if not isinstance(value, str):
        return None
    parsed = urlparse(value)
    if parsed.scheme == "https" and parsed.hostname and (parsed.hostname == "chosun.com" or parsed.hostname.endswith(".chosun.com")) and not parsed.username:
        return value
    return None


def safe_image_url(value):
    if safe_url(value):
        return value
    if not isinstance(value, str):
        return None
    parsed = urlparse(value)
    if parsed.scheme == "https" and parsed.hostname == "cloudfront-ap-northeast-1.images.arcpublishing.com" and parsed.path.startswith("/chosun/") and not parsed.username:
        return value
    return None


def normalize(record):
    payload = record.get("payload") or {}
    article = payload.get("article") or {}
    lesson = payload.get("lesson") or {}
    fields = lesson.get("fields") or {}
    def field(name):
        value = fields.get(name) or {}
        return value.get("text") if isinstance(value.get("text"), str) else None
    return {
        "id": record["id"], "language": "en", "reading": None, "title": article.get("title"),
        "date": article.get("published_at"), "sourceUrl": safe_url(article.get("url")),
        "imageUrl": safe_image_url((payload.get("lesson_image") or {}).get("url")),
        "expression": field("expression"), "meaning": field("korean_meaning"),
        "explanation": field("korean_explanation"), "dialogue": field("english_dialogue"),
        "translation": field("korean_dialogue_translation"), "words": field("vocabulary_notes"),
        "expressions": [{"text": field("expression"), "reading": None, "meaning": field("korean_meaning"), "explanation": field("korean_explanation"), "examples": []}] if field("expression") else [],
        "vocabulary": [], "notes": [],
        "partial": (payload.get("processing") or {}).get("status") == "partial",
    }


def fetch(language, path, params=None):
    key = "ENGLISH" if language == "en" else "JAPANESE"
    base = current_app.config.get(key + "_SCRAPER_API_URL") or (current_app.config.get("SCRAPER_API_URL") if language == "en" else "")
    if not base:
        raise LessonsUnavailable()
    parsed = urlparse(base)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.query or parsed.fragment or parsed.path not in {"", "/"}:
        raise LessonsUnavailable()
    token = current_app.config.get(key + "_SCRAPER_API_TOKEN") or (current_app.config.get("SCRAPER_API_TOKEN") if language == "en" else "")
    response = requests.get(base.rstrip("/") + path, params=params,
                            headers={"Authorization": f"Bearer {token}"} if token else {},
                            timeout=(3, 15), allow_redirects=False)
    if response.status_code == 404:
        raise LessonNotFound()
    if response.status_code != 200:
        raise LessonsUnavailable()
    return response.json()


def detail(language, article_id):
    path = "/api/v1/articles/" if language == "en" else "/api/articles/"
    record = fetch(language, path + quote(article_id, safe=""))
    if record["id"] != article_id:
        raise LessonsUnavailable()
    if language == "ja":
        from .japanese_lessons import normalize as normalize_japanese
        if record.get("status") != "ready":
            raise LessonNotFound()
        return normalize_japanese(record)
    return normalize(record)


def page(offset, language="en"):
    if language == "ja":
        from .japanese_lessons import page as japanese_page
        return japanese_page(offset)
    listing = fetch("en", "/api/v1/articles", {"limit": 6, "offset": offset})
    ids = [item["id"] for item in listing["items"]]
    # Capture configuration while the Flask context is available; worker threads
    # need their own application context for the shared fetch adapter.
    app = current_app._get_current_object()
    def load(article_id):
        with app.app_context():
            return detail("en", article_id)
    with ThreadPoolExecutor(max_workers=6) as pool:
        items = list(pool.map(load, ids))
    next_offset = offset + len(items)
    return {"items": items, "nextOffset": next_offset if items and next_offset < listing["total"] else None}
