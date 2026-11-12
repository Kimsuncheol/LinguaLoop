from unittest.mock import Mock
from app import create_app
from app.services import lessons


def client():
    return create_app({"TESTING": True, "SECRET_KEY": "test", "SCRAPER_API_URL": "https://scraper.example"}).test_client()


def sign_in(api):
    with api.session_transaction() as session:
        session["user"] = {"id": "kakao:1", "name": "Learner"}


def test_lessons_require_session(monkeypatch):
    get = Mock()
    monkeypatch.setattr(lessons.requests, "get", get)
    response = client().get('/api/lessons')
    assert response.status_code == 401
    assert response.headers['Cache-Control'] == 'no-store'
    get.assert_not_called()


def test_validation_and_missing_configuration():
    api = create_app({"TESTING": True, "SECRET_KEY": "test", "SCRAPER_API_URL": ""}).test_client()
    sign_in(api)
    assert api.get('/api/lessons?offset=-1').status_code == 400
    assert api.get('/api/lessons?offset=no').status_code == 400
    assert api.get('/api/lessons').status_code == 503


def test_adapter_serializes_only_lesson_content(monkeypatch):
    def get(url, **kwargs):
        assert kwargs['timeout'] == (3, 15)
        assert kwargs['allow_redirects'] is False
        if url.endswith('/articles'):
            return Mock(status_code=200, json=lambda: {"items": [{"id": "abc"}], "total": 2})
        return Mock(status_code=200, json=lambda: {"id": "abc", "payload": {"article": {"url": "https://www.chosun.com/lesson/"}, "lesson_image": {"url": "javascript:alert(1)"}, "lesson": {"fields": {"expression": {"text": "Don't sweat it."}}}, "secret": "not-for-browser"}})
    monkeypatch.setattr(lessons.requests, 'get', get)
    api = client(); sign_in(api)
    response = api.get('/api/lessons')
    assert response.status_code == 200
    assert response.json['nextOffset'] == 1
    lesson = response.json['items'][0]
    assert lesson['expression'] == "Don't sweat it."
    assert lesson['meaning'] is None and lesson['imageUrl'] is None
    assert 'not-for-browser' not in response.text


def test_upstream_failure_is_sanitized(monkeypatch):
    monkeypatch.setattr(lessons.requests, 'get', Mock(side_effect=lessons.requests.Timeout('private token')))
    api = client(); sign_in(api)
    response = api.get('/api/lessons')
    assert response.status_code == 503
    assert 'private token' not in response.text
