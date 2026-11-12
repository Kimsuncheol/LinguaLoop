"""Read-only adapter for the configured, shared lesson scraper."""
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote, urlparse

import requests
from flask import current_app


class LessonsUnavailable(Exception):
    pass


def safe_url(value):
    if not isinstance(value, str):
        return None
    parsed = urlparse(value)
    if parsed.scheme == "https" and parsed.hostname and (parsed.hostname == "chosun.com" or parsed.hostname.endswith(".chosun.com")) and not parsed.username:
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
        "id": record["id"], "title": article.get("title"),
        "date": article.get("published_at"), "sourceUrl": safe_url(article.get("url")),
        "imageUrl": safe_url((payload.get("lesson_image") or {}).get("url")),
        "expression": field("expression"), "meaning": field("korean_meaning"),
        "explanation": field("korean_explanation"), "dialogue": field("english_dialogue"),
        "translation": field("korean_dialogue_translation"), "words": field("vocabulary_notes"),
        "partial": (payload.get("processing") or {}).get("status") == "partial",
    }


def page(offset):
    base = current_app.config.get("SCRAPER_API_URL", "").rstrip("/")
    if not base:
        raise LessonsUnavailable()
    token = current_app.config.get("SCRAPER_API_TOKEN")
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    def get(path, params=None):
        response = requests.get(base + path, params=params, headers=headers, timeout=(3, 15), allow_redirects=False)
        if response.status_code != 200:
            raise LessonsUnavailable()
        return response.json()
    try:
        listing = get("/api/v1/articles", {"limit": 6, "offset": offset})
        ids = [item["id"] for item in listing["items"]]
        def detail(article_id):
            record = get("/api/v1/articles/" + quote(article_id, safe=""))
            if record["id"] != article_id:
                raise LessonsUnavailable()
            return normalize(record)
        # The scraper's generic list omits lesson fields. Bound fan-out to six.
        with ThreadPoolExecutor(max_workers=6) as pool:
            items = list(pool.map(detail, ids))
        next_offset = offset + len(items)
        return {"items": items, "nextOffset": next_offset if items and next_offset < listing["total"] else None}
    except (requests.RequestException, ValueError, KeyError, TypeError, AttributeError) as exc:
        raise LessonsUnavailable() from exc
