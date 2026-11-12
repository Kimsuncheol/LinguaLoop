# LinguaLoop agent instructions

## Stack and boundaries
- Frontend: Vue 3 Composition API, TypeScript, Vite, installable PWA.
- Backend: Flask application factory and route blueprints.
- Identity: Kakao Login OAuth authorization-code flow handled by Flask.
- Database: Firebase Cloud Firestore through the backend Admin SDK.
- External content: Notion API and Google Drive API through backend service modules.
- Deployment: Firebase Hosting serves frontend/dist; /api routes to Flask on Cloud Run (lingualoop-api, asia-east1).
- Keep Flask's cookie name __session: Firebase Hosting strips other incoming cookies.
- Deploy Cloud Run before Hosting. Never deploy to an inferred or unrelated Firebase project.
- Preserve this stack unless the user explicitly requests a change.

## Layout
- `frontend/src/`: Vue views/components, browser-only services, styles.
- `backend/app/routes/`: HTTP validation, authentication, response serialization.
- `backend/app/services/`: persistence and external API adapters.
- `backend/tests/`: isolated tests; mock providers and Firestore.
- `firebase/`: database rules. `docs/`: architecture and integration notes.

## Development
- Show a skeleton UI matching the view layout while loading on every view, including session initialization and lesson details. Keep existing content visible during background refresh or pagination, expose an accessible loading status, and respect reduced-motion preferences.
- Read README.md and applicable nested AGENTS.md before changing code.
- Use npm and preserve frontend/package-lock.json. Node >=22.12 is required.
- Use backend/.venv and backend/requirements.txt; never install Python dependencies globally.
- Frontend check: `cd frontend && npm run build`.
- Backend check: `cd backend && .venv/bin/python -m pytest`.
- Keep dependency changes scoped and review lockfile changes.

## Security and integration rules
- Never commit .env files, service account credentials, OAuth tokens, or secrets.
- Never expose provider secrets in frontend code or VITE_* environment variables.
- Keep provider tokens out of URLs, logs, browser storage, and Flask cookie sessions.
- Validate one-time OAuth state and expiry before exchanging authorization codes.
- Session cookies are HttpOnly, SameSite=Lax, and Secure in production.
- Mutations must keep CSRF protection; do not enable permissive CORS.
- Authorize every user's resource access in Flask; Admin SDK bypasses Firestore rules.
- Never trust a client-supplied user ID. Scope user data to the authenticated session.
- Do not cache /api responses or authenticated content in the service worker.
- Set timeouts on network requests; return sanitized provider errors.
- Notion and Drive clients currently target server-owned shared resources. User-owned connections require separate OAuth, encrypted server-side token storage, revocation, and per-user authorization.

## Scope and completion
- Prefer small, readable modules and Vue `<script setup lang="ts">`.
- Do not invent learning-domain schemas or expose shared integration resources without requirements.
- Test auth and authorization behavior when changing it. Keep tests offline.
- Report checks run, configuration still needed, and any unverified provider behavior.

## GitHub auto-commit
- After completing a requested change and passing the applicable checks, automatically commit the task's changes with a clear, descriptive message and push the commit to the current branch's configured GitHub remote.
- Review the diff before committing, stage only files changed for the current task, and leave unrelated user changes untouched. Never commit secrets or generated artifacts that should be ignored.
- Do not force-push or push directly to a protected branch. If the remote, branch, authentication, or checks prevent committing or pushing, report the blocker and preserve the local changes.
