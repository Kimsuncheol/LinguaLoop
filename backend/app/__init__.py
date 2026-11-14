import os
from datetime import timedelta
from flask import Flask, jsonify, request
from dotenv import load_dotenv
from requests import RequestException


def create_app(test_config=None):
    load_dotenv()
    app = Flask(__name__)
    app.config.from_mapping(
        SECRET_KEY=os.getenv("SECRET_KEY"),
        SCRAPER_API_URL=os.getenv("SCRAPER_API_URL", ""),
        SCRAPER_API_TOKEN=os.getenv("SCRAPER_API_TOKEN", ""),
        ENGLISH_SCRAPER_API_URL=os.getenv("ENGLISH_SCRAPER_API_URL", ""),
        ENGLISH_SCRAPER_API_TOKEN=os.getenv("ENGLISH_SCRAPER_API_TOKEN", ""),
        JAPANESE_SCRAPER_API_URL=os.getenv("JAPANESE_SCRAPER_API_URL", ""),
        JAPANESE_SCRAPER_API_TOKEN=os.getenv("JAPANESE_SCRAPER_API_TOKEN", ""),
        FRONTEND_URL=os.getenv("FRONTEND_URL", "http://localhost:5173"),
        # Firebase Hosting forwards only this cookie to Cloud Run.
        SESSION_COOKIE_NAME="__session",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.getenv("APP_ENV") != "development",
        PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
        MAX_CONTENT_LENGTH=1024 * 1024,
    )
    if test_config:
        app.config.update(test_config)
    if not app.config["SECRET_KEY"] or app.config["SECRET_KEY"] == "replace-with-a-long-random-secret":
        raise RuntimeError("Set SECRET_KEY to a long random value in backend/.env")

    @app.before_request
    def protect_requests():
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            if request.headers.get("X-Requested-With") != "LinguaLoop":
                return jsonify(error="csrf_check_failed"), 403

    @app.after_request
    def private_responses(response):
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.errorhandler(RequestException)
    def upstream_error(error):
        app.logger.warning("External API request failed: %s", type(error).__name__)
        return jsonify(error="upstream_unavailable"), 502

    from .routes.auth import auth
    from .routes.health import health
    from .routes.lessons import lessons
    app.register_blueprint(lessons, url_prefix="/api")
    app.register_blueprint(auth, url_prefix="/api/auth")
    app.register_blueprint(health, url_prefix="/api")
    return app
