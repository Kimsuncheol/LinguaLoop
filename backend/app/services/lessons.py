"""Read-only adapter for the configured, shared lesson scraper."""
from urllib.parse import quote, urlparse
from datetime import date
import re

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


def publication_date(record, article):
    value = record.get("issue_date")
    match = re.search(r"/national/nie/english/(\d{4})/(\d{2})/(\d{2})/", str(article.get("url") or ""))
    if match:
        value = "-".join(match.groups())
    if isinstance(value, str):
        try:
            return date.fromisoformat(value).isoformat()
        except ValueError:
            pass
    return article.get("published_at")


def normalize(record):
    payload = record.get("payload") or {}
    article = payload.get("article") or {}
    lesson = payload.get("lesson") or {}
    fields = lesson.get("fields") or {}
    sections = {section.get("key"): section.get("text")
                for section in (payload.get("content") or {}).get("sections", [])
                if isinstance(section, dict)}
    def field(name):
        value = fields.get(name) or {}
        text = value.get("text")
        if isinstance(text, str) and text.strip():
            return text
        fallback = sections.get(name)
        return fallback if isinstance(fallback, str) and fallback.strip() else None
    return {
        "id": record["id"], "language": "en", "reading": None, "title": article.get("title"),
        "date": publication_date(record, article), "sourceUrl": safe_url(article.get("url")),
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
    # The generic /api/v1/articles feed sorts by import time. The scraper's
    # saved series feed paginates by publication date and includes lesson fields.
    try:
        listing = fetch("en", "/_dev/test-site/series/saved", {"limit": 6, "offset": offset})
    except LessonNotFound as exc:
        raise LessonsUnavailable() from exc
    items = [normalize({"id": record["id"], "issue_date": record.get("issue_date"), "payload": {
        "article": record.get("article"), "lesson": record.get("lesson"),
        "lesson_image": record.get("lesson_image"),
        "processing": {"status": record.get("processing_status")},
    }}) for record in listing["items"]]
    return {"items": items, "nextOffset": listing["next_offset"]}
