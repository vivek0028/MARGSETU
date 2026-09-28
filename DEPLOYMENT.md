# Deployment Guide: MARGSETU on Render & Vercel

This repository is configured for modern, free-tier-friendly cloud deployment:
- **Backend + Database**: Hosted on [Render](https://render.com) (FastAPI + Managed PostgreSQL + Google OR-Tools)
- **Frontend**: Hosted on [Vercel](https://vercel.com) (React 19 + Vite SPA)

---

## 1. Deploy Backend on Render

### Method A: One-Click Blueprint (Recommended)
1. Go to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** and select **Blueprint**.
3. Connect your GitHub repository: `vivek0028/MARGSETU`.
4. Render will detect [`render.yaml`](./render.yaml) and automatically create:
   - A free **PostgreSQL Database** (`margsetu-db`).
   - A Python **Web Service** (`margsetu-backend`) with all environment variables wired up.
5. Click **Apply**.
6. Once deployed, copy your backend URL (e.g., `https://margsetu-backend.onrender.com`).
7. Test the health endpoint: `https://margsetu-backend.onrender.com/api/health`.

### Method B: Manual Web Service Setup
If creating manually:
1. **Create PostgreSQL Database** on Render:
   - Name: `margsetu-db`
   - Database: `railoptiblock`
   - User: `postgres`
   - Plan: **Free**
   - Copy the **Internal Database URL**.
2. **Create Web Service**:
   - Repository: `vivek0028/MARGSETU`
   - Root Directory: `backend`
   - Runtime: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Plan: **Free**
3. **Environment Variables**:
   | Variable | Value |
   | :--- | :--- |
   | `DATABASE_URL` | *Your Render PostgreSQL Connection String* |
   | `PYTHON_VERSION` | `3.11.8` |
   | `JWT_SECRET` | `super-secret-margsetu-production-jwt-key-2026` |
   | `CORS_ALLOW_ALL` | `true` |
4. Click **Create Web Service**.

> **Note on Data Seeding:** The backend runs `create_all()` and `seed_database(force=False)` automatically on startup. All 10 users, 105 maintenance tasks, 22 block windows, and 28 train movements are seeded into PostgreSQL on the very first boot.

---

## 2. Deploy Frontend on Vercel

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** > **Project**.
3. Import the `vivek0028/MARGSETU` repository.
4. **Project Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Leave as `./` (or select `frontend` if preferred)
   - If Root Directory is `./`, the included [`vercel.json`](./vercel.json) handles building `frontend/dist` automatically.
5. **Environment Variables**:
   Add this environment variable:
   | Key | Value |
   | :--- | :--- |
   | `VITE_API_BASE_URL` | `https://<your-render-backend-url>.onrender.com` |
   *(Example: `https://margsetu-backend.onrender.com` without trailing slash or `/api`)*
6. Click **Deploy**.
7. Your app is live with full SPA routing enabled!

---

## 3. Verify Full Integration

1. Visit your live Vercel URL (e.g., `https://margsetu.vercel.app`).
2. Log in with any demo role:
   - **Administrator**: `admin@railoptiblock.local` (Password: any or `admin123`)
   - **Operations Planner**: `planner@railoptiblock.local`
   - **Chief Controller**: `control@railoptiblock.local`
3. Navigate to:
   - `/dashboard` — Live KPI metrics and Gantt charts.
   - `/optimization` — Run CP-SAT solver live in cloud.
   - `/conflicts` — 5D conflict detection matrix.
   - `/explainability` — AI-assisted decision attribution audit cards.
