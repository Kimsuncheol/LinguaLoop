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

Every production build generates `/app-release.json`. The fixed-bottom update snackbar shows
`frontend/release-notes.json` once per release until dismissed on that browser.
Update that file with a brief user-facing summary whenever the app changes.
Open tabs check for releases every minute while visible and when returning to
the app, focusing its window, or reconnecting. Each new release displays an
“Update recommended” snackbar with an “Update now” action, even if a previous
release was dismissed. After updating, the snackbar confirms the update is installed.
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

English lists use the scraper's read-only `/_dev/test-site/series/saved` feed
with `limit=6` and `offset`. Despite its legacy path, this is the existing saved
lesson feed used by the scraper website: it sorts by lesson publication date
before pagination and includes full lesson fields. The configured English
service must have that route enabled (verified on the current hosted service).
The generic `/api/v1/articles` feed sorts by import time and is deliberately not
used as a fallback. Detail requests still use `/api/v1/articles/:id`.
Cards from all loaded pages are also sorted by their displayed publication dates,
with missing/invalid dates last and stable ID ordering for equal dates.

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
map to upstream ten-record pages; English uses upstream publication-ordered offset pagination without
extra detail fan-out. Invalid language/offset/ID returns 400, signed-out access
401, absent/unready detail 404, and provider/configuration failures a sanitized
503. Detail IDs must use letters, digits, underscores or hyphens (max 200).
No upstream provenance, credentials or arbitrary image hosts are exposed.

## System Back navigation

The dashboard is the root of the app's browser history. Opening a lesson or
practice adds a view entry; system Back, browser Back/Forward, and the on-screen
Back buttons restore the previous view. Language changes, section chips, retries,
and practice reveals do not add Back steps. The logo returns to the existing
dashboard entry instead of adding another root page.

Navigation entries store only language, lesson IDs, view type and scroll position,
not lesson text or credentials. Reloading a lesson/practice restores it through
Flask's authenticated read endpoints. Practice position remains available when
returning during the current session; it is not persisted across reloads.

Back from the dashboard opens a themed “Leave LinguaLoop?” confirmation.
Stay (also Escape/cancel) keeps the dashboard open. A single history boundary is
reused, so dismissing the confirmation does not accumulate extra Back steps.
Leave returns to the previous page when available. On a fresh installed launch,
the app requests window closure; if the browser blocks it, the confirmation is
disarmed and an accessible status asks for one more native Back press to exit.
Browser/Android owns the final window close. Installed Android hardware Back
still needs a device check; confirmation and history behavior are automated.

Run the offline browser navigation checks with `cd frontend && npm run test:navigation`.
Install the test browser once with `npx playwright install chromium`. All login
and lesson API responses in this suite are fixtures; no provider credentials
are used.

## Meaning and dialogue presentation

Meaning explanations are separated into readable paragraphs without rewriting
source wording. Dialogue recognizes explicit A/B labels: character A is left,
character B is right. Korean translation is grouped with a turn only when both
the number of turns and character sequence match; otherwise it remains below
the conversation. Unlabelled or unsupported character formats retain the
original text rather than inventing speakers.

The dialogue uses the requested [`vue-bubble-chat`](https://github.com/vadymsem/vue-bubble-chat)
1.1.2 package, which ships a Vue 2 renderer. A lazy, isolated Vue 3 `@vue/compat`
3.5.45 mount supports it; the main app keeps standard Vue 3 without a global
compatibility alias. Keep the compat version aligned with the locked Vue version.
The adapter disables the floating launcher, composer, auto-scroll and vendor
style injection; semantic app styles provide a read-only, themed lesson thread.
No chat messages are sent or stored.

Checks: `npm run test:lesson-text` covers paragraph/character parsing and
`npm run test:lesson-ui` covers the actual package renderer, alignment, themes,
translation grouping, safe text rendering and cleanup. All API data is mocked.
