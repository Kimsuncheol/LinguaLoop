"""Read-only adapter for the configured, shared Chinese lesson scraper."""
from datetime import date, datetime
import re
from urllib.parse import quote
from zoneinfo import ZoneInfo

from .lessons import LessonsUnavailable, fetch, safe_image_url, safe_url

SEOUL = ZoneInfo("Asia/Seoul")


def _clean_str(value):
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _publication_date(record):
    url = str(record.get("url") or "")
    match = re.search(r"/national/nie/chinese/(\d{4})/(\d{2})/(\d{2})/", url)
    if match:
        try:
            return date.fromisoformat("-".join(match.groups())).isoformat()
        except ValueError:
            pass
    published_at = record.get("published_at")
    if isinstance(published_at, str) and published_at.strip():
        raw = published_at.strip()
        try:
            return date.fromisoformat(raw[:10]).isoformat()
        except ValueError:
            pass
        try:
            normalized = raw[:-1] + "+00:00" if raw.endswith("Z") else raw
            dt = datetime.fromisoformat(normalized)
            if dt.tzinfo is not None:
                dt = dt.astimezone(SEOUL)
            return dt.date().isoformat()
        except ValueError:
            pass
    return None


def _format_reading(expr):
    pinyin = _clean_str(expr.get("pinyin"))
    simplified = _clean_str(expr.get("simplified"))
    traditional = _clean_str(expr.get("traditional"))
    if traditional and traditional != simplified:
        return f"{pinyin} ({traditional})" if pinyin else traditional
    return pinyin


def _format_meanings(meanings_raw):
    if not isinstance(meanings_raw, list):
        return None
    parts = []
    for item in meanings_raw:
        if isinstance(item, str):
            text = _clean_str(item)
        elif isinstance(item, dict):
            text = _clean_str(item.get("korean_meaning") or item.get("meaning"))
        else:
            raise LessonsUnavailable()
        if text:
            parts.append(text)
    return ", ".join(parts) if parts else None


def _format_conversations(conversations_raw):
    if not isinstance(conversations_raw, list):
        return None, None, []
    dialogue_lines = []
    translation_lines = []
    examples = []
    for idx, turn in enumerate(conversations_raw):
        if not isinstance(turn, dict):
            raise LessonsUnavailable()
        chinese = _clean_str(turn.get("chinese"))
        if not chinese:
            continue
        speaker = _clean_str(turn.get("speaker")) or ("A" if idx % 2 == 0 else "B")
        pinyin = _clean_str(turn.get("pinyin"))
        korean_pron = _clean_str(turn.get("korean_pronunciation"))
        translation = _clean_str(turn.get("translation"))

        turn_lines = [f"{speaker}: {chinese}"]
        if pinyin:
            turn_lines.append(f"({pinyin})")
        if korean_pron:
            turn_lines.append(f"[{korean_pron}]")
        dialogue_lines.append("\n".join(turn_lines))

        if translation:
            translation_lines.append(f"{speaker}: {translation}")

        reading_parts = [p for p in (pinyin, korean_pron) if p]
        examples.append({
            "text": chinese,
            "reading": " · ".join(reading_parts) if reading_parts else None,
            "meaning": translation,
        })

    dialogue = "\n".join(dialogue_lines) if dialogue_lines else None
    translation_text = "\n".join(translation_lines) if translation_lines else None
    return dialogue, translation_text, examples


def _format_vocabulary(vocab_raw):
    if not isinstance(vocab_raw, list):
        return []
    items = []
    for entry in vocab_raw:
        if not isinstance(entry, dict):
            raise LessonsUnavailable()
        word = _clean_str(entry.get("word"))
        if not word:
            raise LessonsUnavailable()
        items.append({
            "text": word,
            "reading": _clean_str(entry.get("pinyin")),
            "meaning": _clean_str(entry.get("meaning")),
            "explanation": None,
            "examples": [],
        })
    return items


def normalize(record):
    if not isinstance(record, dict):
        raise LessonsUnavailable()
    raw_id = record.get("id") if record.get("id") is not None else record.get("article_id")
    if raw_id is None or str(raw_id).strip() == "":
        raise LessonsUnavailable()
    record_id = str(raw_id).strip()

    expr = record.get("expression")
    if expr is not None and not isinstance(expr, dict):
        raise LessonsUnavailable()
    expr = expr or {}

    expression_text = _clean_str(expr.get("simplified"))
    reading = _format_reading(expr)
    explanation = _clean_str(expr.get("explanation"))
    meaning = _format_meanings(record.get("meanings") or [])
    dialogue, translation, examples = _format_conversations(record.get("conversations") or [])
    vocab_raw = record.get("vocabulary")
    if vocab_raw is None:
        vocab_raw = record.get("vocabularies") or []
    vocabulary = _format_vocabulary(vocab_raw)

    expressions = (
        [{
            "text": expression_text,
            "reading": reading,
            "meaning": meaning,
            "explanation": explanation,
            "examples": examples,
        }]
        if expression_text
        else []
    )

    return {
        "id": record_id,
        "language": "zh",
        "title": _clean_str(record.get("title")),
        "date": _publication_date(record),
        "sourceUrl": safe_url(record.get("url")),
        "imageUrl": safe_image_url(record.get("image_url")),
        "expression": expression_text,
        "meaning": meaning,
        "reading": reading,
        "explanation": explanation,
        "dialogue": dialogue,
        "translation": translation,
        "words": None,
        "expressions": expressions,
        "vocabulary": vocabulary,
        "notes": [],
        "partial": not bool(expression_text and meaning),
    }


def detail(article_id):
    if article_id.isdigit():
        path = "/api/articles/" + quote(article_id, safe="")
    else:
        path = "/api/articles/by-article-id/" + quote(article_id, safe="")
    record = fetch("zh", path)
    if not isinstance(record, dict):
        raise LessonsUnavailable()
    matched = (
        (record.get("id") is not None and str(record.get("id")) == article_id)
        or (record.get("article_id") is not None and str(record.get("article_id")) == article_id)
    )
    if not matched:
        raise LessonsUnavailable()
    return normalize(record)


def page(offset):
    page_number, start = divmod(offset, 10)
    listing = fetch("zh", "/api/articles", {"page": page_number + 1, "per_page": 10})
    raw_items = listing["items"] if "items" in listing else listing["articles"]
    items = [normalize(record) for record in raw_items[start:]]
    next_offset = offset + len(items)
    return {
        "items": items,
        "nextOffset": next_offset if items and next_offset < listing["total"] else None,
    }
