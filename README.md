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

Deploy to **Firebase Hosting**, with `/api` rewritten to the Flask container on **Cloud Run** (`lingualoop-api`, `asia-east1`). Both use the same public HTTPS origin. Firebase Hosting forwards the `__session` cookie used by Flask.

See [Firebase deployment](docs/deployment.md) for project setup, secrets, deployment order, and verification. The Firebase project is `lingualoop-kr-2026` (LinguaLoop), recorded in `.firebaserc`. The intended public origin is `https://lingualoop-kr-2026.web.app`.

## References

- [Kakao REST login](https://developers.kakao.com/docs/en/kakaologin/rest-api)
- [Firebase Admin setup](https://firebase.google.com/docs/admin/setup)
- [Google Drive Python setup](https://developers.google.com/workspace/drive/api/quickstart/python)
- [Notion API versioning](https://developers.notion.com/reference/versioning)
- [Vite PWA guide](https://vite-pwa-org.netlify.app/guide/)
