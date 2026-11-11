from app import create_app


def client():
    return create_app({"TESTING": True, "SECRET_KEY": "test-only", "SESSION_COOKIE_SECURE": False}).test_client()


def test_health_and_anonymous_session():
    api = client()
    assert api.get("/api/health").json["status"] == "ok"
    assert api.get("/api/auth/me").status_code == 401


def test_callback_rejects_missing_or_mismatched_state():
    api = client()
    assert api.get("/api/auth/kakao/callback?code=forged").status_code == 400
    with api.session_transaction() as session:
        session["oauth_state"] = "expected"
    assert api.get("/api/auth/kakao/callback?code=forged&state=wrong").status_code == 400


def test_logout_requires_csrf_header_and_clears_session():
    api = client()
    with api.session_transaction() as session:
        session["user"] = {"id": "kakao:123", "name": "Learner"}
    assert api.post("/api/auth/logout").status_code == 403
    assert api.get("/api/auth/me").status_code == 200
    assert api.post("/api/auth/logout", headers={"X-Requested-With": "LinguaLoop"}).status_code == 204
    assert api.get("/api/auth/me").status_code == 401


def test_successful_callback_keeps_tokens_out_of_session(monkeypatch):
    import time
    from unittest.mock import Mock
    from app.routes import auth
    monkeypatch.setenv("KAKAO_REST_API_KEY", "test-key")
    monkeypatch.setenv("KAKAO_REDIRECT_URI", "http://localhost/callback")
    token = Mock()
    token.json.return_value = {"access_token": "private-token"}
    profile = Mock()
    profile.json.return_value = {"id": 123}
    monkeypatch.setattr(auth.requests, "post", Mock(return_value=token))
    monkeypatch.setattr(auth.requests, "get", Mock(return_value=profile))
    saved = Mock()
    monkeypatch.setattr(auth, "save_user", saved)
    api = client()
    with api.session_transaction() as session:
        session["oauth_state"] = "valid-state"
        session["oauth_started"] = time.time()
    assert api.get("/api/auth/kakao/callback?code=valid&state=valid-state").status_code == 302
    saved.assert_called_once_with({"id": "kakao:123", "name": "Learner"})
    assert api.get("/api/auth/me").json["id"] == "kakao:123"
    with api.session_transaction() as session:
        assert "private-token" not in str(dict(session))
    assert api.get("/api/auth/kakao/callback?code=valid&state=valid-state").status_code == 400


def test_firebase_hosting_session_cookie(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("KAKAO_REST_API_KEY", "test-key")
    monkeypatch.setenv("KAKAO_REDIRECT_URI", "https://example.web.app/api/auth/kakao/callback")
    api = create_app({"TESTING": True, "SECRET_KEY": "test-only"}).test_client()
    response = api.get("/api/auth/kakao/login")
    assert response.status_code == 302
    cookie = response.headers["Set-Cookie"]
    assert cookie.startswith("__session=")
    assert "Secure" in cookie and "HttpOnly" in cookie and "SameSite=Lax" in cookie
    assert response.headers["Cache-Control"] == "no-store"
