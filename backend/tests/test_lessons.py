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


def japanese_record(article_id="j1", status="ready"):
    return {"id": article_id, "status": status, "title": "Japanese lesson", "date": "2026-11-10",
            "url": "https://www.chosun.com/national/nie/japanese/test/",
            "images": ["https://cloudfront-ap-northeast-1.images.arcpublishing.com/chosun/image.jpg"],
            "provider_secret": "hidden",
            "lesson": {"expressions": [{"japanese": "なるほど", "reading": "なるほど", "translation": "그렇군요",
                         "examples": [{"japanese": "なるほど。", "translation": "그렇군요."}]}],
                       "vocabulary": [{"japanese": "最後", "reading": "さいご", "translation": "마지막", "explanation": "끝"}],
                       "notes": ["最後 (さいご) — 마지막 — 끝", "Keep this note"], "uncertain_text": ["uncertain"]}}


def japanese_client():
    api = create_app({"TESTING": True, "SECRET_KEY": "test", "JAPANESE_SCRAPER_API_URL": "https://japanese.example",
                      "JAPANESE_SCRAPER_API_TOKEN": "japanese-token", "SCRAPER_API_TOKEN": "english-token"}).test_client()
    sign_in(api)
    return api


def test_all_language_routes_require_session(monkeypatch):
    get = Mock()
    monkeypatch.setattr(lessons.requests, 'get', get)
    api = client()
    for path in ['/api/lessons?language=ja', '/api/lessons/en/abc', '/api/lessons/ja/j1']:
        assert api.get(path).status_code == 401
    get.assert_not_called()


def test_languages_and_ids_validated_before_upstream(monkeypatch):
    get = Mock()
    monkeypatch.setattr(lessons.requests, 'get', get)
    api = japanese_client()
    for path in ['/api/lessons?language=de', '/api/lessons/de/j1', '/api/lessons/ja/a.b', '/api/lessons?offset=100001']:
        assert api.get(path).status_code == 400
    get.assert_not_called()


def test_japanese_pagination_and_serialization(monkeypatch):
    def get(url, **kwargs):
        assert url == 'https://japanese.example/api/articles'
        assert kwargs['params'] == {'page': 2, 'status': 'ready'}
        assert kwargs['headers'] == {'Authorization': 'Bearer japanese-token'}
        assert kwargs['timeout'] == (3, 15) and kwargs['allow_redirects'] is False
        return Mock(status_code=200, json=lambda: {'articles': [japanese_record('j'+str(i)) for i in range(10)], 'total': 25})
    monkeypatch.setattr(lessons.requests, 'get', get)
    response = japanese_client().get('/api/lessons?language=ja&offset=12')
    assert response.status_code == 200
    assert len(response.json['items']) == 8 and response.json['nextOffset'] == 20
    item = response.json['items'][0]
    assert item['id'] == 'j2' and item['language'] == 'ja'
    assert item['reading'] == 'なるほど'
    assert item['expressions'][0]['examples'][0]['meaning'] == '그렇군요.'
    assert item['notes'] == ['Keep this note'] and item['vocabulary'][0]['text'] == '最後'
    assert item['partial'] is True and item['imageUrl'].endswith('/chosun/image.jpg')
    assert 'provider_secret' not in response.text and 'hidden' not in response.text
    assert response.headers['Cache-Control'] == 'no-store'


def test_detail_not_found_pending_mismatch_and_sanitized_errors(monkeypatch):
    api = japanese_client()
    for response, expected in [(Mock(status_code=404), 404),
                               (Mock(status_code=200, json=lambda: japanese_record(status='pending')), 404),
                               (Mock(status_code=200, json=lambda: japanese_record('wrong')), 503),
                               (Mock(status_code=200, json=lambda: {'id': 'j1', 'status': 'ready', 'lesson': {'expressions': [None]}}), 503),
                               (Mock(status_code=500), 503)]:
        monkeypatch.setattr(lessons.requests, 'get', Mock(return_value=response))
        result = api.get('/api/lessons/ja/j1')
        assert result.status_code == expected and result.headers['Cache-Control'] == 'no-store'
    monkeypatch.setattr(lessons.requests, 'get', Mock(return_value=Mock(status_code=200, json=lambda: japanese_record())))
    assert api.get('/api/lessons/ja/j1').json['expressions'][0]['text'] == 'なるほど'


def test_japanese_final_page_and_missing_configuration(monkeypatch):
    monkeypatch.setattr(lessons.requests, 'get', Mock(return_value=Mock(status_code=200, json=lambda: {'articles': [japanese_record()], 'total': 21})))
    assert japanese_client().get('/api/lessons?language=ja&offset=20').json['nextOffset'] is None
    api = create_app({'TESTING': True, 'SECRET_KEY': 'test', 'JAPANESE_SCRAPER_API_URL': ''}).test_client()
    sign_in(api)
    assert api.get('/api/lessons?language=ja').status_code == 503
    assert api.get('/api/lessons/ja/j1').status_code == 503


def test_english_detail_and_independent_tokens(monkeypatch):
    def get(url, **kwargs):
        assert url == 'https://english.example/api/v1/articles/abc'
        assert kwargs['headers'] == {'Authorization': 'Bearer new-english-token'}
        return Mock(status_code=200, json=lambda: {'id': 'abc', 'payload': {'lesson': {'fields': {'expression': {'text': 'Try again.'}, 'korean_meaning': {'text': '다시 해봐.'}}}}})
    monkeypatch.setattr(lessons.requests, 'get', get)
    api = create_app({'TESTING': True, 'SECRET_KEY': 'test', 'ENGLISH_SCRAPER_API_URL': 'https://english.example', 'ENGLISH_SCRAPER_API_TOKEN': 'new-english-token', 'JAPANESE_SCRAPER_API_TOKEN': 'private-japanese'}).test_client()
    sign_in(api)
    result = api.get('/api/lessons/en/abc')
    assert result.status_code == 200 and result.json['expressions'][0]['meaning'] == '다시 해봐.'


def test_image_links_reject_untrusted_hosts():
    for url in ['javascript:alert(1)', 'https://evil.example/image.jpg', 'https://www.chosun.com.evil.example/image.jpg', 'https://user@www.chosun.com/image.jpg', 'https://cloudfront-ap-northeast-1.images.arcpublishing.com/other/image.jpg']:
        assert lessons.safe_image_url(url) is None
