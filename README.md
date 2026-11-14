# LinguaLoop

Vue 3 PWA + Flask + Kakao Login + Firebase Cloud Firestore, with backend adapters for Notion and Google Drive.

```text
frontend/                 Vue 3 + TypeScript + Vite PWA
  src/services/           Same-origin Flask API client
  public/                 Install icons
backend/
  app/routes/             Health and Kakao authentication endpoints
  app/services/           Firestore, Notion, Google Drive adapters
  tests/                  Offline HTTP/auth tests
firebase/                 Deny-all browser Firestore rules
docs/                    Architecture and integration decisions
AGENTS.md                 Instructions for coding agents
```

## Local setup

Requirements: Node.js 22.12+ and Python 3.11+.

```sh
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env`. Generate `SECRET_KEY` with `.venv/bin/python -c 'import secrets; print(secrets.token_hex(32))'`. Then start Flask from `backend/`:

```sh
.venv/bin/flask --app app:create_app run --port 5000 --debug
```

In another terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to Flask. Health and the anonymous landing page work without provider credentials; login requires Kakao and Firebase configuration.

## Provider setup

1. **Kakao:** create an application in Kakao Developers, enable Kakao Login, and register exactly `http://localhost:5173/api/auth/kakao/callback` as a redirect URI. Set its REST API key and client secret in `backend/.env`. Nickname is optional; the app falls back to “Learner”. The UI says “Continue with KakaoTalk”; authentication uses Kakao Account's web OAuth flow, whose available sign-in methods are controlled by Kakao.
2. **Firebase:** create a project and Firestore database. Set `FIREBASE_PROJECT_ID` and configure Application Default Credentials with `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service account JSON file outside the repo. Grant only necessary Firestore IAM permissions. Deploy browser-denying rules with `firebase deploy --only firestore:rules --project YOUR_PROJECT_ID` using the Firebase CLI. Flask's Admin SDK bypasses these rules, so backend authorization is mandatory.
3. **Notion:** create an internal integration, give it read access, share intended pages with it, and set `NOTION_TOKEN`. The adapter pins API version `2025-09-03`. No content routes are exposed yet.
4. **Google Drive:** enable the Drive API, create a separate service account, share intended resources with its email, and set `GOOGLE_DRIVE_CREDENTIALS` to its JSON path outside the repo. The adapter uses read-only scopes. Personal Drive accounts require an additional user OAuth flow; Kakao login does not grant Drive access.

Do not put credentials in frontend environment variables. Do not commit JSON keys or `.env` files.

## Checks

```sh
cd frontend
npm run build
npm run preview
```

```sh
cd backend
.venv/bin/python -m pytest
```

PWA caching applies to the static app shell in production builds. API responses remain network-only. To test login with a production build locally, serve the build and `/api` behind the same reverse proxy; `vite preview` has no API proxy configured. PWA installation requires HTTPS outside localhost. Automated checks do not validate live provider credentials or device installation.

## Production

Every production build generates `/app-release.json`. The update banner shows
`frontend/release-notes.json` once per release until dismissed on that browser.
Update that file with a brief user-facing summary whenever the app changes.
Open tabs check for releases every minute while visible and when returning to
the app, focusing its window, or reconnecting. Each new release displays an
“Update recommended” banner with an “Update now” action, even if a previous
release was dismissed. After updating, the banner confirms the update is installed.
Offline checks do not interrupt learning. The manifest is network-only and
contains no user data.

Deploy to **Firebase Hosting**, with `/api` rewritten to the Flask container on **Cloud Run** (`lingualoop-api`, `asia-east1`). Both use the same public HTTPS origin. Firebase Hosting forwards the `__session` cookie used by Flask.

See [Firebase deployment](docs/deployment.md) for project setup, secrets, deployment order, and verification. The Firebase project is `lingualoop-kr-2026` (LinguaLoop), recorded in `.firebaserc`. The intended public origin is `https://lingualoop-kr-2026.web.app`.

## References

- [Kakao REST login](https://developers.kakao.com/docs/en/kakaologin/rest-api)
- [Firebase Admin setup](https://firebase.google.com/docs/admin/setup)
- [Google Drive Python setup](https://developers.google.com/workspace/drive/api/quickstart/python)
- [Notion API versioning](https://developers.notion.com/reference/versioning)
- [Vite PWA guide](https://vite-pwa-org.netlify.app/guide/)

## Lesson cards

Set `SCRAPER_API_URL` in the Flask environment to the trusted base origin of the
English scraper (for example `http://127.0.0.1:8000` locally, HTTPS in production).
Optionally set `SCRAPER_API_TOKEN` if the upstream accepts a Bearer token. These
settings stay server-side. The user must sign in with Kakao before `/api/lessons`
can read the shared lesson collection. No scraper mutations are exposed.

The library opens a lesson's dialogue, explanation and vocabulary. Practice
reveals Korean meanings and moves through expressions on the loaded page; it
does not persist scores or progress. Missing fields remain unavailable, with
links to the original Chosun lesson image and article. All initial and paginated
loads use skeletons; provider failures have a retry action.

The scraper's `/api/v1/articles` summaries omit expressions, so the adapter uses
at most six concurrent detail requests per page. A future upstream summary
endpoint can replace that bounded fan-out. Live provider configuration and
production access control for the scraper must be verified before deployment.

## English and Japanese library

The signed-in library has independent English and Japanese tabs, a desktop
reader with a lesson sidebar, and a mobile expression practice view. Japanese
lessons preserve supplied readings, Korean meanings, examples, glossary and
notes. Practice uses the loaded expressions; scores/progress are not persisted.

Server-only configuration (trusted base origins, without API paths):

- `ENGLISH_SCRAPER_API_URL`: English API origin; falls back to `SCRAPER_API_URL`.
- `ENGLISH_SCRAPER_API_TOKEN`: optional Bearer token; falls back to `SCRAPER_API_TOKEN`.
- `JAPANESE_SCRAPER_API_URL`: Japanese API origin.
- `JAPANESE_SCRAPER_API_TOKEN`: optional, independent Bearer token.

The documented hosted origins are `https://english-scrapper.onrender.com` and
`https://japanese-scraper.onrender.com`. These are external read-only sources;
LinguaLoop does not trigger ingestion or access their separate Firebase projects.
Render cold starts may require retrying a request. Requests have bounded timeouts.

Authenticated endpoints, all network-only and `Cache-Control: no-store`:

- `GET /api/lessons?language=en&offset=0`: English cards, up to six per request.
- `GET /api/lessons?language=ja&offset=0`: Japanese ready lessons, up to ten.
- `GET /api/lessons/en/:id` and `GET /api/lessons/ja/:id`: full lesson content.

The list returns `{items, nextOffset}`. Use the returned offset, or stop when
it is null. Language defaults to English for existing clients. Japanese offsets
map to upstream ten-record pages; English uses upstream offset pagination and
bounded detail fan-out. Invalid language/offset/ID returns 400, signed-out access
401, absent/unready detail 404, and provider/configuration failures a sanitized
503. Detail IDs must use letters, digits, underscores or hyphens (max 200).
No upstream provenance, credentials or arbitrary image hosts are exposed.
