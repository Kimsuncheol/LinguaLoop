from flask import Blueprint, jsonify, request, session
from ..services.lessons import LessonsUnavailable, page

lessons = Blueprint("lessons", __name__)


@lessons.get("/lessons")
def list_lessons():
    if "user" not in session:
        return jsonify(error="unauthenticated"), 401
    try:
        offset = int(request.args.get("offset", "0"))
        if not 0 <= offset <= 100000:
            raise ValueError()
    except ValueError:
        return jsonify(error="invalid_offset"), 400
    try:
        return jsonify(page(offset))
    except LessonsUnavailable:
        return jsonify(error="lessons_unavailable"), 503
