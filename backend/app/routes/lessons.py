import re
import requests
from flask import Blueprint, jsonify, request, session
from ..services.lessons import LessonNotFound, LessonsUnavailable, detail, page

lessons = Blueprint("lessons", __name__)


def unavailable(operation):
    try:
        return jsonify(operation())
    except LessonNotFound:
        return jsonify(error="lesson_not_found"), 404
    except (LessonsUnavailable, requests.RequestException, ValueError, KeyError, TypeError, AttributeError):
        return jsonify(error="lessons_unavailable"), 503


@lessons.get("/lessons")
def list_lessons():
    if "user" not in session:
        return jsonify(error="unauthenticated"), 401
    language = request.args.get("language", "en")
    if language not in {"en", "ja"}:
        return jsonify(error="invalid_language"), 400
    try:
        offset = int(request.args.get("offset", "0"))
        if not 0 <= offset <= 100000:
            raise ValueError()
    except ValueError:
        return jsonify(error="invalid_offset"), 400
    return unavailable(lambda: page(offset, language))


@lessons.get("/lessons/<language>/<article_id>")
def lesson_detail(language, article_id):
    if "user" not in session:
        return jsonify(error="unauthenticated"), 401
    if language not in {"en", "ja"}:
        return jsonify(error="invalid_language"), 400
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,200}", article_id):
        return jsonify(error="invalid_lesson_id"), 400
    return unavailable(lambda: detail(language, article_id))
