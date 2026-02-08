# Production Deployment Plan: Vercel + Neon + GCP

Plan for deploying Zefa Finance to production using:
- **Vercel** – Next.js frontend
- **Neon** – Serverless PostgreSQL database
- **GCP** – FastAPI backend (Cloud Run)

---

## 1. Architecture Overview

```
┌─────────────────┐     ┌─────────────────────────┐     ┌──────────────────┐
│     Vercel      │────▶│   GCP Cloud Run         │────▶│      Neon        │
│  (Next.js UI)   │     │  (FastAPI Backend)      │     │  (PostgreSQL)    │
└─────────────────┘     └─────────────────────────┘     └──────────────────┘
         │                           │
         │                           │  AI APIs (OpenAI/Anthropic/Gemini)
         │                           ▼
         │                   ┌───────────────┐
         └──────────────────▶│  External AI  │
                             └───────────────┘
```

---

## 2. Prerequisites

- [ ] **Vercel** account (free tier ok)
- [ ] **Neon** account (neon.tech, free tier ok)
- [ ] **GCP** account with billing enabled (Cloud Run free tier: 2M requests/month)
- [ ] **Git** repository (GitHub, GitLab, or Bitbucket) connected to Vercel
- [ ] **Docker** installed locally (for building backend image)
- [ ] **gcloud CLI** installed and authenticated

---

## 3. Phase 1: Neon (Database)

### 3.1 Create Neon Project

1. Go to [console.neon.tech](https://console.neon.tech)
2. Create a new project (e.g. `ze-finance-prod`)
3. Select region closest to your Cloud Run region (e.g. `us-east-1` or `sa-east-1` for Brazil)
4. Copy the connection string from the dashboard

### 3.2 Connection String Format

Neon provides connection strings in two forms:

- **Direct**: `postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`
- **Pooled** (recommended for serverless): `postgresql://user:pass@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require`

For SQLAlchemy + asyncpg, use:

```bash
DATABASE_URL=postgresql+asyncpg://user:pass@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?ssl=require
```

**Note**: Replace `?sslmode=require` with `?ssl=require` for asyncpg compatibility. Neon supports both.

### 3.3 Database Setup

- Neon creates an empty database. Tables are created by FastAPI on first startup via `Base.metadata.create_all()`.
- **Optional (recommended for production)**: Add Alembic migrations before deploy and run migrations as a release step.

### 3.4 Checklist

- [ ] Create Neon project
- [ ] Copy pooled connection string
- [ ] Store in a secure place (will be used in Phase 3)

---

## 4. Phase 2: GCP Cloud Run (Backend)

### 4.1 Enable APIs

```bash
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### 4.2 Create Artifact Registry Repository

```bash
gcloud artifacts repositories create zefa-backend \
  --repository-format=docker \
  --location=us-east1 \
  --description="Ze Finance Backend"
```

### 4.3 Build and Push Docker Image

From the repo root:

```bash
# Authenticate Docker to Artifact Registry
gcloud auth configure-docker us-east1-docker.pkg.dev

# Build (from backend directory)
cd backend
docker build -t us-east1-docker.pkg.dev/gen-lang-client-0808239767/zefa-backend/zefa-api:latest .

# Push
docker push us-east1-docker.pkg.dev/gen-lang-client-0808239767/zefa-backend/zefa-api:latest
```

Replace `YOUR_PROJECT_ID` with your GCP project ID.

**Optional – Cloud Build** (CI/CD):

Create `cloudbuild.yaml` in `backend/`:

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'us-east1-docker.pkg.dev/gen-lang-client-0808239767/zefa-backend/zefa-api:$SHORT_SHA', '.']
    dir: backend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-east1-docker.pkg.dev/gen-lang-client-0808239767/zefa-backend/zefa-api:$SHORT_SHA']
```

### 4.4 Deploy to Cloud Run

Configure environment variables per **Section 6** (Secret Manager + Cloud Run Variables) before deploying.

**Quick deploy (after creating secrets in Secret Manager):**

```bash
gcloud run deploy zefa-api \
  --image us-east1-docker.pkg.dev/YOUR_PROJECT_ID/zefa-backend/zefa-api:latest \
  --platform managed \
  --region us-east1 \
  --allow-unauthenticated \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,SECRET_KEY=SECRET_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest" \
  --set-env-vars "ALLOWED_ORIGINS=[\"https://your-app.vercel.app\"],AI_PROVIDER=openai,AI_MODEL_CHAT=gpt-4o-mini" \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10
```

Replace `your-app.vercel.app` with your actual Vercel domain. For full env var setup, see **Section 6**.

### 4.5 Get Cloud Run URL

After deploy, note the service URL, e.g.:

```
https://zefa-api-xxxxxxxxxx-ue.a.run.app
```

### 4.6 Checklist

- [ ] Enable required GCP APIs
- [ ] Create Artifact Registry repo
- [ ] Build and push Docker image
- [ ] Deploy to Cloud Run
- [ ] Store API URL for frontend (Phase 5)
- [ ] Configure CORS `ALLOWED_ORIGINS` with final Vercel URL

---

## 5. Phase 3: Vercel (Frontend)

### 5.1 Connect Repository

1. Go to [vercel.com](https://vercel.com) and import your Git repo
2. Set **Root Directory** to `frontend`
3. Framework Preset: Next.js (auto-detected)

### 5.2 Environment Variables

In Vercel Project Settings → Environment Variables, add:

| Variable                    | Value                                              | Environment |
|----------------------------|----------------------------------------------------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://zefa-api-xxx-ue.a.run.app` (Cloud Run URL) | Production  |

Use the same for Preview if you want preview deploys to hit production API, or a separate Cloud Run service for staging.

### 5.3 Build Configuration

- **Build Command**: `npm run build` (default)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install` (default)

### 5.4 Deploy

```bash
cd frontend
vercel --prod
```

Or push to main branch if auto-deploy is enabled.

### 5.5 Update Backend CORS

After first deploy, note your Vercel URL (e.g. `https://zefa-finance.vercel.app`) and update Cloud Run env:

```bash
gcloud run services update zefa-api \
  --region us-east1 \
  --update-env-vars "ALLOWED_ORIGINS=[\"https://zefa-finance.vercel.app\"]"
```

### 5.6 Checklist

- [ ] Import repo to Vercel
- [ ] Set `NEXT_PUBLIC_API_BASE_URL`
- [ ] Deploy
- [ ] Update backend CORS with final Vercel URL

---

## 6. Environment Variables – Where and How to Configure

### 6.1 Overview

| Platform   | Where to Configure                                      | URL |
|------------|---------------------------------------------------------|-----|
| **GCP Secret Manager** | Sensitive vars (DB, JWT, API keys)              | https://console.cloud.google.com/security/secret-manager |
| **GCP Cloud Run**      | Env vars + reference secrets from Secret Manager | https://console.cloud.google.com/run → service → Edit |
| **Vercel**             | Frontend env vars                                    | https://vercel.com → Project → Settings → Environment Variables |

### 6.2 GCP Secret Manager (Sensitive Variables)

Create secrets first, then reference them in Cloud Run.

**Console:** [Secret Manager](https://console.cloud.google.com/security/secret-manager)

| Secret Name       | Value Example | When to Use |
|-------------------|---------------|-------------|
| `DATABASE_URL`    | `postgresql+asyncpg://user:pass@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?ssl=require` | Always |
| `SECRET_KEY`      | 64-char hex (e.g. `openssl rand -hex 32`) | Always |
| `OPENAI_API_KEY`  | `sk-proj-...` | If AI_PROVIDER=openai |
| `GEMINI_API_KEY`  | `AIza...`     | If AI_PROVIDER=gemini |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | If AI_PROVIDER=anthropic |

**CLI (PowerShell):**

```powershell
# DATABASE_URL - replace with your Neon pooled URL
"postgresql+asyncpg://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?ssl=require" | gcloud secrets create DATABASE_URL --data-file=-

# SECRET_KEY - generate with openssl (if available) or use a password generator
# openssl rand -hex 32
"your-64-char-hex-secret" | gcloud secrets create SECRET_KEY --data-file=-

# OPENAI_API_KEY
"sk-proj-your-key" | gcloud secrets create OPENAI_API_KEY --data-file=-
```

**Or create via Console:** Secret Manager → Create Secret → Name + Secret value.

### 6.3 GCP Cloud Run – Variables & Secrets

**Console:** Cloud Run → select `zefa-api` → **Edit & Deploy New Revision** → **Variables & Secrets**.

**Secrets (Reference a secret):**

| Env var name     | Secret reference    |
|------------------|---------------------|
| `DATABASE_URL`   | `DATABASE_URL:latest` |
| `SECRET_KEY`     | `SECRET_KEY:latest`   |
| `OPENAI_API_KEY` | `OPENAI_API_KEY:latest` (if using OpenAI) |

**Variables (plain text, non-sensitive):**

| Name                      | Value (exact format) |
|---------------------------|----------------------|
| `ALLOWED_ORIGINS`         | `["https://your-app.vercel.app"]` |
| `AI_PROVIDER`             | `openai` or `gemini` or `anthropic` |
| `AI_MODEL_CHAT`           | `gpt-4o-mini` or `gemini-2.0-flash-exp` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `ALGORITHM`               | `HS256` |

**Important:** `ALLOWED_ORIGINS` must be valid JSON. Single URL: `["https://zefa-finance.vercel.app"]`. Multiple: `["https://a.vercel.app","https://b.vercel.app"]`.

**CLI deploy with secrets + vars:**

```bash
gcloud run deploy zefa-api \
  --image us-east1-docker.pkg.dev/YOUR_PROJECT_ID/zefa-backend/zefa-api:latest \
  --region us-east1 \
  --allow-unauthenticated \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,SECRET_KEY=SECRET_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest" \
  --set-env-vars "ALLOWED_ORIGINS=[\"https://your-app.vercel.app\"],AI_PROVIDER=openai,AI_MODEL_CHAT=gpt-4o-mini"
```

### 6.4 Vercel (Frontend)

**Console:** Vercel → Project → **Settings** → **Environment Variables**.

| Name                       | Value                             | Environment |
|----------------------------|-----------------------------------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://zefa-api-xxx-ue.a.run.app` | Production  |

Add the same for **Preview** if preview deploys should use production API.

### 6.5 Local Dev (.env files)

**Backend:**

```bash
cd backend
cp .env.example .env
# .env is gitignored. Defaults work with: docker compose up -d db
```

**Frontend:**

```bash
cd frontend
cp .env.example .env.local
# .env.local is gitignored. Default points to http://localhost:8000
```

**Local dev flow:** `docker compose up -d db` → start backend (`uvicorn`) → start frontend (`npm run dev`). No env changes needed.

---

## 7. Post-Deploy Verification

1. **Health check**: `curl https://YOUR_CLOUD_RUN_URL/health`
2. **API docs**: `https://YOUR_CLOUD_RUN_URL/docs`
3. **Frontend**: Open Vercel URL, log in, create a transaction
4. **Database**: Check Neon dashboard for tables and data

---

## 8. Optional: Staging vs Production

| Environment | Vercel         | Cloud Run        | Neon        |
|-------------|----------------|------------------|-------------|
| Production  | Main branch    | zefa-api         | prod DB     |
| Staging     | Preview deploy | zefa-api-staging | staging DB  |

Create separate Neon projects and Cloud Run services for staging. Use Vercel preview env vars to point to staging API.

---

## 9. Cost Estimates (Free Tiers)

| Service   | Free Tier                         | Notes                        |
|-----------|-----------------------------------|------------------------------|
| Vercel    | 100GB bandwidth, unlimited deploys| Generous for MVP             |
| Neon      | 0.5 GB storage, 190 compute hours| Pooled connections included  |
| Cloud Run | 2M requests/month, 360K vCPU-sec  | Scales to zero when idle     |

---

## 10. Security Checklist

- [ ] Use GCP Secret Manager for `DATABASE_URL`, `SECRET_KEY`, API keys
- [ ] Restrict `ALLOWED_ORIGINS` to your Vercel domain(s) only
- [ ] Generate a strong `SECRET_KEY` (e.g. `openssl rand -hex 32`)
- [ ] Ensure Neon connection uses SSL (`ssl=require`)
- [ ] Consider Cloud Run IAM if you need to restrict access later

---

## 11. Troubleshooting

| Issue                    | Solution                                                                 |
|--------------------------|--------------------------------------------------------------------------|
| CORS errors              | Ensure `ALLOWED_ORIGINS` includes exact Vercel URL (with https)          |
| DB connection refused    | Use Neon **pooled** connection string; check `postgresql+asyncpg`        |
| 502 on Cloud Run         | Check logs: `gcloud run services logs read zefa-api --region us-east1`   |
| Frontend 404 on API call | Verify `NEXT_PUBLIC_*` vars are set in Vercel and redeploy               |

---

## 12. Suggested Order of Execution

1. **Neon**: Create project, copy connection string  
2. **GCP**: Build image, deploy Cloud Run with Neon URL  
3. **Vercel**: Import repo, set API URL, deploy  
4. **Final**: Update CORS on Cloud Run with Vercel URL

---

*Document created for Zefa Finance deployment. Update as needed when infrastructure or env vars change.*
