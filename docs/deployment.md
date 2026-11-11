# Firebase Hosting deployment

## Topology

Firebase Hosting serves the Vue PWA from `frontend/dist`. Requests matching `/api` or `/api/**` go to the Cloud Run service `lingualoop-api` in `asia-east1`; all other routes fall back to `index.html`. API rewrites precede SPA fallback. The service keeps the original `/api` path. Hosting pins the backend revision with `pinTag` for coordinated rollbacks.

Flask uses the `__session` cookie because Firebase Hosting strips other incoming cookies from requests to Cloud Run. API responses set `Cache-Control: no-store`. Static hashed assets are immutable; HTML and the service worker revalidate.

Cloud Run requires a billing-enabled Firebase project (Blaze). The frontend and backend must be in the same project. The selected Firebase project is `lingualoop-kr-2026` (display name: LinguaLoop), recorded in `.firebaserc`. Use Node 22.12+ (`nvm use` in `frontend/` if available), Firebase CLI, and gcloud CLI.

## Selected project

- Firebase project: `lingualoop-kr-2026` (LinguaLoop).
- Public origin: `https://lingualoop-kr-2026.web.app`.
- Cloud Run and Firestore region: `asia-east1`.
- Runtime account: `lingualoop-api@lingualoop-kr-2026.iam.gserviceaccount.com`.
- Session signing key: Secret Manager `lingualoop-session-key`, version 1.
- Backend revision: `lingualoop-api-00001-2kl`.
- Hosting and Firestore rules deployed successfully.
- Public smoke checks passed: landing page, SPA fallback, API health, anonymous session, manifest, service worker, logout CSRF, and secure `__session` cookie deletion.
- Kakao, Notion, and Drive credentials still need configuration. Kakao login currently returns `503 kakao_not_configured`.

## Project preparation

Use an explicit project ID on every deployment command. Do not use the machine's unrelated gcloud default project.

1. Select/create the intended Firebase project and enable billing.
2. Enable Cloud Run, Cloud Build, Artifact Registry, Firestore, and Secret Manager APIs.
3. Create Firestore in the intended location if it does not already exist.
4. Create a dedicated Cloud Run runtime service account with `roles/datastore.user`. Cloud Run's attached identity supplies Firebase Application Default Credentials; do not upload a Firebase service account key.
5. Store a strong Flask signing key in Secret Manager as `lingualoop-session-key`. Grant the runtime service account Secret Accessor on that secret. Store Kakao credentials in separate secrets (`lingualoop-kakao-key` and `lingualoop-kakao-secret`) and grant the same scoped access when ready.

## Runtime configuration

Create the gitignored `backend/deploy.env.yaml`, replacing `YOUR_PROJECT_ID`:

```yaml
APP_ENV: production
FIREBASE_PROJECT_ID: YOUR_PROJECT_ID
FRONTEND_URL: https://YOUR_PROJECT_ID.web.app
KAKAO_REDIRECT_URI: https://YOUR_PROJECT_ID.web.app/api/auth/kakao/callback
NOTION_VERSION: '2025-09-03'
```

Register that exact callback URI in Kakao Developers. For a custom domain or non-default Hosting site, use its origin for both URLs. The initial backend can serve health/session endpoints with only the signing secret; Kakao login returns 503 until Kakao credentials are configured.

Set `NOTION_TOKEN` through Secret Manager when enabling Notion. Drive's current adapter expects a separate credential file: mount its secret at a file path and set `GOOGLE_DRIVE_CREDENTIALS` to that path. No integration credentials belong in the image or frontend build.

## Deploy backend, then frontend

From the repository root, after provisioning the runtime account and session secret:

```sh
CLOUDSDK_METRICS_ENVIRONMENT=datacloud.codex gcloud run deploy lingualoop-api \
  --project YOUR_PROJECT_ID \
  --region asia-east1 \
  --source backend \
  --service-account lingualoop-api@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 0 \
  --max-instances 3 \
  --env-vars-file backend/deploy.env.yaml \
  --set-secrets SECRET_KEY=lingualoop-session-key:1
```

Use the actual immutable secret version number. When enabling Kakao, include its configured secret versions in the same `--set-secrets` mapping. Cloud Run is publicly invocable to support Hosting rewrites; Flask must enforce all application authentication/authorization. The build service account needs `roles/run.builder` on the project. This project uses the default build account `477056818023-compute@developer.gserviceaccount.com`; the runtime identity remains the separate `lingualoop-api` account.

```sh
npm --prefix frontend ci
firebase deploy --only hosting --project YOUR_PROJECT_ID
```

The Hosting predeploy hook runs the frontend build. Run Firebase CLI under Node 22.12+ as well. Deploy Firestore rules separately after reviewing impact on the target database:

```sh
firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
```

## Verification

- Visit `https://YOUR_PROJECT_ID.web.app` and a nested SPA path.
- `/api/health` must return JSON with `status: ok`, not the SPA HTML.
- `/api/auth/me` must return 401 before signing in.
- After configuring Kakao, verify login sets the secure HttpOnly `__session` cookie, writes the Firestore user document, and returns to the Hosting origin.
- Verify logout clears the session.
- Check the production manifest, service worker, and installation on a supported device. Auth and APIs require a network.

References: [Hosting with Cloud Run](https://firebase.google.com/docs/hosting/cloud-run), [Hosting session-cookie behavior](https://firebase.google.com/docs/hosting/manage-cache#using_cookies).
