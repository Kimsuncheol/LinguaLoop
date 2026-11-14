"""Read-only translation of Kotoba's public, ready lesson archive."""
from .lessons import fetch, safe_url, safe_image_url


def expression(value):
    return {"text": value["japanese"], "reading": value.get("reading") or None,
            "meaning": value.get("translation") or None,
            "explanation": value.get("explanation") or None,
            "examples": [{"text": e["japanese"], "reading": e.get("reading") or None,
                          "meaning": e.get("translation") or None} for e in value.get("examples", [])]}


def normalize(record):
    lesson = record.get("lesson") or {}
    expressions = [expression(e) for e in lesson.get("expressions", [])]
    vocabulary = [expression(e) for e in lesson.get("vocabulary", [])]
    # Upstream notes repeat structured vocabulary for older clients.
    copies = set()
    for e in lesson.get("vocabulary", []):
        label = e["japanese"] + (f" ({e['reading']})" if e.get("reading") else "")
        copies.add(label + (f" — {e['translation']}" if e.get("translation") else "")
                   + (f" — {e['explanation']}" if e.get("explanation") else ""))
    notes = [n for n in lesson.get("notes", []) if n not in copies]
    lead = expressions[0] if expressions else {}
    return {"id": record["id"], "language": "ja", "title": record.get("title"),
            "date": record.get("date"), "sourceUrl": safe_url(record.get("url")),
            "imageUrl": next((url for image in record.get("images", []) if (url := safe_image_url(image))), None),
            "expression": lead.get("text"), "meaning": lead.get("meaning"),
            "reading": lead.get("reading"), "explanation": lead.get("explanation"),
            "dialogue": None, "translation": None, "words": None,
            "expressions": expressions, "vocabulary": vocabulary, "notes": notes,
            "partial": bool(lesson.get("uncertain_text")) or record.get("status") != "ready"}


def page(offset):
    # Preserve the upstream page size, without dropping records at page boundaries.
    page_number, start = divmod(offset, 10)
    listing = fetch("ja", "/api/articles", {"page": page_number + 1, "status": "ready"})
    items = [normalize(record) for record in listing["articles"][start:]]
    next_offset = offset + len(items)
    return {"items": items, "nextOffset": next_offset if items and next_offset < listing["total"] else None}
