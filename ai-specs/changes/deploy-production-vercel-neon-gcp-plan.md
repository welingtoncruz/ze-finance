# Production Deployment: Vercel + Neon + GCP Cloud Run

Deploy Zefa Finance with **Vercel** (frontend), **Neon** (PostgreSQL), and **GCP Cloud Run** (FastAPI backend).

---

## Architecture

```
Vercel (Next.js)  →  Cloud Run (FastAPI)  →  Neon (PostgreSQL)
                            ↓
                    External AI (Gemini/OpenAI/Anthropic)
```

---

## 1. One-time setup

Do this once per environment (production/staging).

### 1.1 Neon

1. [console.neon.tech](https://console.neon.tech) → New project (e.g. `ze-finance-prod`).
2. Copy **pooled** connection string. For asyncpg use:
   - `postgresql+asyncpg://user:pass@ep-xxx-pooler.REGION.aws.neon.tech/neondb?ssl=require`
3. Store it securely; you will put it in GCP Secret Manager.

### 1.2 GCP

**APIs and Artifact Registry**

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
gcloud artifacts repositories create zefa-backend --repository-format=docker --location=us-east1 --description="Zefa Backend"
```

**Secrets (Secret Manager)**

Create these in [Secret Manager](https://console.cloud.google.com/security/secret-manager). Paste the **value only** (no extra newline).

| Secret name     | Value / source |
|-----------------|----------------|
| `DATABASE_URL`  | Neon pooled URL (postgresql+asyncpg://...) |
| `SECRET_KEY`    | `openssl rand -hex 32` (or password generator) |
| `GEMINI_API_KEY`| Your Gemini API key (paste without trailing Enter) |

**Grant Cloud Run access to secrets**

```bash
# Replace PROJECT_ID; get project number: gcloud projects describe PROJECT_ID --format="value(projectNumber)"
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 1.3 Vercel

1. [vercel.com](https://vercel.com) → Import repo → **Root Directory**: `frontend`.
2. After first backend deploy, add env var:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://YOUR_CLOUD_RUN_URL` (no trailing slash)
3. Redeploy. Then set Cloud Run `ALLOWED_ORIGINS` to your Vercel URL (see §3).

---

## 2. Deploy backend (manual)

From repo root. Replace `YOUR_PROJECT_ID` and `YOUR_VERCEL_URL` (e.g. `https://ze-finance.vercel.app`).

**Build and push**

```bash
gcloud builds submit --tag us-east1-docker.pkg.dev/YOUR_PROJECT_ID/zefa-backend/zefa-api:latest ./backend
```

**Deploy to Cloud Run**

```bash
gcloud run deploy zefa-api \
  --image us-east1-docker.pkg.dev/YOUR_PROJECT_ID/zefa-backend/zefa-api:latest \
  --platform managed --region us-east1 --allow-unauthenticated \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,SECRET_KEY=SECRET_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --set-env-vars "ALLOWED_ORIGINS=[\"YOUR_VERCEL_URL\"],AI_PROVIDER=gemini,AI_MODEL_CHAT=gemini-3-flash-preview" \
  --memory 512Mi --cpu 1 --min-instances 0 --max-instances 10 \
  --startup-probe "tcpSocket.port=8080,initialDelaySeconds=30,failureThreshold=20,timeoutSeconds=5,periodSeconds=10"
```

**PowerShell (single line)**

```powershell
gcloud run deploy zefa-api --image us-east1-docker.pkg.dev/YOUR_PROJECT_ID/zefa-backend/zefa-api:latest --platform managed --region us-east1 --allow-unauthenticated --set-secrets="DATABASE_URL=DATABASE_URL:latest,SECRET_KEY=SECRET_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest" --set-env-vars "ALLOWED_ORIGINS=[`"YOUR_VERCEL_URL`"],AI_PROVIDER=gemini,AI_MODEL_CHAT=gemini-3-flash-preview" --memory 512Mi --cpu 1 --min-instances 0 --max-instances 10 --startup-probe "tcpSocket.port=8080,initialDelaySeconds=30,failureThreshold=20,timeoutSeconds=5,periodSeconds=10"
```

Note: `ALLOWED_ORIGINS` accepts JSON array or a single URL; backend normalizes trailing slash.

---

## 3. CI: automated backend deploy

Two options. Use one.

### Option A: Cloud Build trigger (recommended)

No GitHub secrets. Trigger runs in GCP.

1. In [Cloud Build](https://console.cloud.google.com/cloud-build/triggers) → **Create trigger**.
2. **Source**: Connect repo (GitHub/GitLab/etc.), select branch (e.g. `main`).
3. **Configuration**: Cloud Build configuration file; path `backend/cloudbuild.yaml`.
4. **Substitution variables** (optional):  
   - `_SERVICE_NAME` = `zefa-api`  
   - `_REGION` = `us-east1`  
   (Defaults are in `backend/cloudbuild.yaml`.)
5. On push to `main` (or when `backend/**` changes), Cloud Build builds the image, pushes to Artifact Registry, and deploys to Cloud Run. Existing env vars and secrets on the service are unchanged; only the image is updated.

### Option B: GitHub Actions

Use when you want deploy to run from GitHub and can store GCP credentials as repo secrets.

1. Create a **GCP service account** for CI with roles: **Cloud Build Editor** (to run builds), **Cloud Run Admin**, **Service Account User** (so Cloud Build can deploy as the runtime SA), **Artifact Registry Writer** (to push images). Create a JSON key and add the key contents as GitHub repo secret `GCP_SA_KEY`.
2. Add GitHub repo secrets: `GCP_PROJECT_ID` (e.g. `gen-lang-client-0808239767`). Cloud Run env and secrets are already set on the service; the workflow only builds and deploys the new image.
3. The workflow in `.github/workflows/deploy-backend.yml` runs on push to `main` when `backend/**` changes. It runs `gcloud builds submit --config backend/cloudbuild.yaml .`, which builds, pushes, and deploys in one go.

---

## 4. Environment variables reference

| Where | Variable | Example / note |
|-------|----------|----------------|
| **GCP Secret Manager** | `DATABASE_URL` | Neon pooled URL |
| | `SECRET_KEY` | 64-char hex |
| | `GEMINI_API_KEY` | No trailing newline |
| **Cloud Run (env)** | `ALLOWED_ORIGINS` | `["https://ze-finance.vercel.app"]` or single URL |
| | `AI_PROVIDER` | `gemini` |
| | `AI_MODEL_CHAT` | `gemini-3-flash-preview` |
| **Vercel** | `NEXT_PUBLIC_API_BASE_URL` | Cloud Run URL, no trailing slash |

---

## 5. Frontend deploy

Vercel deploys automatically when you push to the connected branch. Ensure `NEXT_PUBLIC_API_BASE_URL` is set and redeploy if you change it.

---

## 6. Post-deploy check

- Backend: `curl https://YOUR_CLOUD_RUN_URL/health` → `{"status":"healthy"}`
- Frontend: Open Vercel URL → login, add transaction, open chat
- Logs: Cloud Run → **Logs**; or Logs Explorer filtered by `resource.labels.service_name="zefa-api"`

---

## 7. Troubleshooting

| Issue | Action |
|-------|--------|
| CORS / Network Error | Set `ALLOWED_ORIGINS` to exact Vercel origin (no trailing slash). Backend normalizes; if still failing, check revision has new env. |
| 500 / InvalidHeader (API key) | Secret value has `\r\n` or spaces. Backend strips keys; create new secret version with value only (no Enter). |
| Container failed to start (PORT) | Image must use `PORT` (e.g. `run.py`). Rebuild from current `backend/`. |
| DB / sslmode error | Backend strips `ssl`/`sslmode` from URL and uses SSL for non-localhost. No change needed if using Neon URL as-is. |

---

## 8. Suggested order

1. Neon: create project, copy connection string.  
2. GCP: enable APIs, create Artifact Registry, create secrets, grant Secret Accessor.  
3. Deploy backend once (manual or CI), note Cloud Run URL.  
4. Vercel: import repo (root `frontend`), set `NEXT_PUBLIC_API_BASE_URL`, deploy.  
5. Cloud Run: set `ALLOWED_ORIGINS` to Vercel URL (if not already in deploy command).  
6. Enable CI (Cloud Build trigger or GitHub Actions) for future backend deploys.
