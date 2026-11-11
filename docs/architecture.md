# Architecture

The browser calls Flask over `/api` on the same origin. Vite supplies the proxy in development; the deployment reverse proxy supplies it in production. Flask owns identity, authorization, Firestore access, and third-party API calls.

## Authentication

`GET /api/auth/kakao/login` generates a cryptographic state value and redirects to Kakao. `GET /api/auth/kakao/callback` validates the one-time state and its ten-minute lifetime, exchanges the code, retrieves a profile, and upserts `users/kakao:{id}` in Firestore. The cookie stores a minimal signed user profile; it is signed, not encrypted. Provider access tokens are used only for the profile request and are not persisted.

`GET /api/auth/me` returns the session profile or 401. `POST /api/auth/logout` clears the local session and requires the `X-Requested-With: LinguaLoop` header. Same-origin policy, no CORS grants, and the custom header protect mutations against browser CSRF. Logout does not unlink the Kakao account or invalidate other devices' cookies. Signed cookies expire after eight hours; centralized session revocation would require server-side sessions.

## Data

Firestore starts with a single `users/{provider:id}` document containing `id`, `name`, and `last_login_at`. Add learning-domain collections after requirements exist, with ownership checks at every backend boundary. Browser Firestore access is denied; Firebase Authentication is not part of the initial identity flow.

Notion and Google Drive adapters are intentionally backend-only foundations, not public content endpoints. Their credentials represent shared application resources. Exposing data requires a resource allowlist and authorization policy. Per-user Notion/Drive integrations need separate provider consent flows and encrypted token storage. Never infer those permissions from Kakao identity.

## PWA

The generated service worker precaches build assets and the app shell. `/api` is excluded from navigation fallback; no API runtime caching is configured. Offline learning data, background sync, and push notifications are future features. The initial screen still renders offline after precaching, but sign-in and session lookup require a network.
