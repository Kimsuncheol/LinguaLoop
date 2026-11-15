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
        assert url == "https://scraper.example/_dev/test-site/series/saved"
        assert kwargs['timeout'] == (3, 15)
        assert kwargs['allow_redirects'] is False
        return Mock(status_code=200, json=lambda: {"items": [{"id": "abc", "article": {"url": "https://www.chosun.com/lesson/"}, "lesson_image": {"url": "javascript:alert(1)"}, "lesson": {"fields": {"expression": {"text": "Don't sweat it."}}}, "secret": "not-for-browser"}], "next_offset": 1})
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
    for path in ['/api/lessons?language=ja', '/api/lessons?language=zh', '/api/lessons/en/abc', '/api/lessons/ja/j1', '/api/lessons/zh/1']:
        assert api.get(path).status_code == 401
    get.assert_not_called()


def test_languages_and_ids_validated_before_upstream(monkeypatch):
    get = Mock()
    monkeypatch.setattr(lessons.requests, 'get', get)
    api = japanese_client()
    for path in ['/api/lessons?language=de', '/api/lessons/de/j1', '/api/lessons/ja/a.b', '/api/lessons/zh/a.b', '/api/lessons?offset=100001']:
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


def test_publication_feed_preserves_pagination_and_does_not_fan_out(monkeypatch):
    def get(url, **kwargs):
        assert url.endswith("/_dev/test-site/series/saved")
        assert kwargs["params"]["limit"] == 6
        offset = kwargs["params"]["offset"]
        dates = ["2026-11-12", "2026-11-09"] if offset == 0 else ["2026-11-08"]
        return Mock(status_code=200, json=lambda: {
            "items": [{"id": date, "article": {"published_at": date},
                       "lesson": {"fields": {}}, "processing_status": "partial",
                       "saved_at": "2000-01-01"} for date in dates],
            "next_offset": 6 if offset == 0 else None})
    mocked = Mock(side_effect=get)
    monkeypatch.setattr(lessons.requests, "get", mocked)
    api = client(); sign_in(api)
    first = api.get('/api/lessons?language=en').json
    second = api.get('/api/lessons?language=en&offset=6').json
    assert first['nextOffset'] == 6 and second['nextOffset'] is None
    assert [item['date'] for item in first['items'] + second['items']] == ['2026-11-12', '2026-11-09', '2026-11-08']
    assert first['items'][0]['partial'] is True
    assert mocked.call_count == 2


def test_unavailable_date_ordered_feed_fails_without_unsorted_fallback(monkeypatch):
    api = client(); sign_in(api)
    for status in [404, 503]:
        get = Mock(return_value=Mock(status_code=status))
        monkeypatch.setattr(lessons.requests, 'get', get)
        assert api.get('/api/lessons').status_code == 503
        assert get.call_count == 1


def test_english_issue_date_uses_article_day_not_previous_day_timestamp():
    from app.services.lessons import normalize
    record = {"id": "dated", "payload": {"article": {
        "url": "https://www.chosun.com/national/nie/english/2026/11/11/EXAMPLE/",
        "published_at": "2026-11-10T12:00:00Z"}}}
    assert normalize(record)["date"] == "2026-11-11"


def test_english_content_sections_supply_missing_legacy_fields():
    from app.services.lessons import normalize
    record = {"id": "organized", "payload": {"lesson": {"fields": {}},
        "content": {"sections": [{"key": "korean_meaning", "text": "뜻"},
                                 {"key": "english_dialogue", "text": "A Hello."}]}}}
    value = normalize(record)
    assert value["meaning"] == "뜻"
    assert value["dialogue"] == "A Hello."


def chinese_record(record_id=1, article_id="DGQRPKYZCFCBLEA4EF3EVPL4FQ"):
    return {
        "id": record_id,
        "url": "https://www.chosun.com/national/nie/chinese/2026/11/13/DGQRPKYZCFCBLEA4EF3EVPL4FQ/",
        "article_id": article_id,
        "title": "[매일매일 중국어 한마디] 플러스 요인, 가산점 요소",
        "image_url": "https://cloudfront-ap-northeast-1.images.arcpublishing.com/chosun/5DU5IBH6OJDNRCJVRLKIWW3LJE.jpg",
        "episode_number": 5042,
        "published_at": "2026-11-12T15:00:00Z",
        "raw_ocr_text": "internal ocr dump",
        "expression": {
            "id": 10,
            "simplified": "加分项",
            "traditional": "加分項",
            "pinyin": "jiāfēn xiàng",
            "episode_number": 5042,
            "explanation": "'加分项(jiāfēn xiàng)'은 유리한 요소를 뜻한다.",
        },
        "meanings": [
            {"id": 1, "korean_meaning": "플러스 요인", "order": 0},
            {"id": 2, "korean_meaning": "가산점 요소", "order": 1},
        ],
        "conversations": [
            {
                "id": 1,
                "turn_order": 0,
                "speaker": "A",
                "chinese": "这房子带个朝南的小阳台。",
                "pinyin": "Zhè fángzi dài ge cháo nán de xiǎo yángtái.",
                "korean_pronunciation": "저 팡 쯔 따이 거 차오 난 더 샤오 양 타이",
                "translation": "이 집은 남향의 작은 베란다가 딸려 있어요.",
            },
            {
                "id": 2,
                "turn_order": 1,
                "speaker": "B",
                "chinese": "是啊，这绝对是个加分项。",
                "pinyin": "Shì a, zhè juéduì shì ge jiāfēn xiàng.",
                "korean_pronunciation": "스 아 저 쥐에뚜이 스 거 지아 펀 시앙",
                "translation": "맞아요, 이건 확실히 플러스 요인이에요.",
            },
        ],
        "vocabulary": [
            {"id": 1, "order": 0, "word": "朝南", "pinyin": "cháo nán", "meaning": "남향"},
            {"id": 2, "order": 1, "word": "阳台", "pinyin": "yángtái", "meaning": "발코니, 베란다"},
        ],
    }


def chinese_client():
    api = create_app({
        "TESTING": True,
        "SECRET_KEY": "test",
        "CHINESE_SCRAPER_API_URL": "https://chinese.example",
        "CHINESE_SCRAPER_API_TOKEN": "chinese-token",
        "SCRAPER_API_TOKEN": "english-token",
    }).test_client()
    sign_in(api)
    return api


def test_chinese_pagination_and_serialization(monkeypatch):
    def get(url, **kwargs):
        assert url == "https://chinese.example/api/articles"
        assert kwargs["params"] == {"page": 2, "per_page": 10}
        assert kwargs["headers"] == {"Authorization": "Bearer chinese-token"}
        assert kwargs["timeout"] == (3, 15) and kwargs["allow_redirects"] is False
        return Mock(
            status_code=200,
            json=lambda: {
                "items": [chinese_record(i, f"CHOSUN_{i}") for i in range(10)],
                "page": 2,
                "per_page": 10,
                "total": 25,
                "pages": 3,
            },
        )
    monkeypatch.setattr(lessons.requests, "get", get)
    response = chinese_client().get("/api/lessons?language=zh&offset=12")
    assert response.status_code == 200
    assert len(response.json["items"]) == 8 and response.json["nextOffset"] == 20
    item = response.json["items"][0]
    assert item["id"] == "2" and item["language"] == "zh"
    assert item["date"] == "2026-11-13"
    assert item["expression"] == "加分项"
    assert item["reading"] == "jiāfēn xiàng (加分項)"
    assert item["meaning"] == "플러스 요인, 가산점 요소"
    assert item["explanation"] == "'加分项(jiāfēn xiàng)'은 유리한 요소를 뜻한다."
    assert "A: 这房子带个朝南的小阳台。" in item["dialogue"]
    assert "(Zhè fángzi dài ge cháo nán de xiǎo yángtái.)" in item["dialogue"]
    assert "[저 팡 쯔 따이 거 차오 난 더 샤오 양 타이]" in item["dialogue"]
    assert item["translation"] == "A: 이 집은 남향의 작은 베란다가 딸려 있어요.\nB: 맞아요, 이건 확실히 플러스 요인이에요."
    assert item["vocabulary"][0] == {
        "text": "朝南",
        "reading": "cháo nán",
        "meaning": "남향",
        "explanation": None,
        "examples": [],
    }
    assert item["expressions"][0]["examples"][1]["meaning"] == "맞아요, 이건 확실히 플러스 요인이에요."
    assert item["partial"] is False
    assert item["imageUrl"].endswith("/chosun/5DU5IBH6OJDNRCJVRLKIWW3LJE.jpg")
    assert "internal ocr dump" not in response.text
    assert response.headers["Cache-Control"] == "no-store"


def test_chinese_detail_numeric_and_external_id_and_errors(monkeypatch):
    api = chinese_client()
    calls = []

    def get(url, **kwargs):
        calls.append(url)
        return Mock(status_code=200, json=lambda: chinese_record(42, "DGQRPKYZCFCBLEA4EF3EVPL4FQ"))

    monkeypatch.setattr(lessons.requests, "get", get)
    res_num = api.get("/api/lessons/zh/42")
    assert res_num.status_code == 200 and res_num.json["id"] == "42"
    assert calls[-1] == "https://chinese.example/api/articles/42"

    res_ext = api.get("/api/lessons/zh/DGQRPKYZCFCBLEA4EF3EVPL4FQ")
    assert res_ext.status_code == 200 and res_ext.json["expression"] == "加分项"
    assert calls[-1] == "https://chinese.example/api/articles/by-article-id/DGQRPKYZCFCBLEA4EF3EVPL4FQ"

    for response, expected in [
        (Mock(status_code=404), 404),
        (Mock(status_code=200, json=lambda: chinese_record(99, "WRONG_ID")), 503),
        (Mock(status_code=500), 503),
    ]:
        monkeypatch.setattr(lessons.requests, "get", Mock(return_value=response))
        result = api.get("/api/lessons/zh/42")
        assert result.status_code == expected

    unconfigured = create_app({"TESTING": True, "SECRET_KEY": "test", "CHINESE_SCRAPER_API_URL": ""}).test_client()
    sign_in(unconfigured)
    assert unconfigured.get("/api/lessons?language=zh").status_code == 503
    assert unconfigured.get("/api/lessons/zh/42").status_code == 503

