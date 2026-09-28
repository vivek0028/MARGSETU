# MARGSETU

### AI-Assisted Maintenance Block Planning for Indian Railways
**Smart India Hackathon 2026 — Problem Statement 26027**

---

## 1. Overview & Problem Statement

Railway maintenance for fixed infrastructure (Engineering, Signal & Telecommunication, and Traction Distribution departments) has historically been planned independently in divisional operations. Disconnected planning leads to corridor congestion, under-utilized traffic blocks, and scheduling conflicts with scheduled passenger and freight services.

**MARGSETU** is a constraint-aware, AI-assisted decision-support platform designed for Indian Railways operations planners and Senior Divisional Operations Managers (Sr. DOM). It aggregates cross-departmental maintenance requisitions, detects 5-dimensional operational conflicts, and generates optimal block allocations using deterministic integer programming.

> [!NOTE]
> **DEMO DATA PROTOTYPE DISCLAIMER**  
> MARGSETU is an AI-assisted decision-support system for demonstration and hackathon evaluation. All corridor timetables, maintenance requests, and resources are synthetic demo data. It does not claim direct connectivity to live internal Indian Railways production systems (e.g., live FOIS/COA) and does not perform autonomous train dispatching or interlocking control.

---

## 2. Core Architecture & Optimization Engines

MARGSETU uses a decoupled, full-stack client-server architecture:

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide React, and Recharts.
- **Backend**: Python 3.9+, FastAPI, Pydantic v2, SQLAlchemy, and SQLite.
- **Mathematical Solver**: **Google OR-Tools CP-SAT** (Constraint Programming - Satisfiability).

### Optimization Strategies (CP-SAT Multi-Objective Formulation)

1. **Plan A — Maximum Critical Coverage**:
   - Maximizes the scheduling of safety-critical and overdue infrastructure demands.
   - Ideal during pre-monsoon preparedness and safety compliance cycles.

2. **Plan B — Minimum Operational Conflict**:
   - Strictly avoids blocks that intersect with scheduled passenger and freight paths (e.g., strictly avoids window BLK-102 due to Shatabdi Express movements).
   - Minimizes train punctuality impact and secondary line-haul delays.

3. **Plan C — Maximum Task Bundling**:
   - Encourages compatible multi-departmental co-work (Engineering track tamping + S&T signal tuning + Traction OHE inspection in a single traffic block).
   - Maximizes corridor asset utilization and minimizes cumulative traffic disconnection hours.

---

## 3. Human-in-the-Loop & Append-Only Audit Trail

RailBlock Advisor adheres strictly to **Human-in-the-Loop (HITL)** railway safety principles:

- The mathematical solver acts purely as an advisor, recommending feasible block windows with full rule-based explainability (no black-box AI).
- Formal block sanction, corridor possession, and electrical isolation remain under the authority of designated operating personnel (Sr. DOM / Dy. COM).
- **Append-Only Audit Trail**:
  - The audit trail records approval and workflow events for the prototype.
  - Every planner interaction, scenario modification, task creation, and approval decision is immutably appended to the audit trail with authorizer role, timestamp, and detailed justification.

---

## 4. Getting Started & Local Setup

### Prerequisites
- **Python**: 3.9 or higher
- **Node.js**: 18.x or higher, with `npm`

---

### Step 1: Backend Setup (FastAPI & OR-Tools CP-SAT)

1. Open a terminal and navigate to the `backend/` directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate    # On Windows: venv\Scripts\activate
   ```

3. Install all dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Initialize and seed synthetic corridor datasets (BDMS tasks, timetable paths, block windows, resources):
   ```bash
   python seed_data.py
   ```

5. Launch the FastAPI development server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

- **Backend API Base**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **Backend Health Check**: `http://localhost:8000/api/health`

---

### Step 2: Frontend Setup (React, TypeScript & Vite)

1. Open a second terminal and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```

2. Install client dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev -- --host 0.0.0.0 --port 5173
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

---

### Step 3: Running Automated Test Suites

- **Backend Unit & Constraint Tests (16/16)**:
  ```bash
  cd backend
  source venv/bin/activate
  pytest -q
  ```

- **Frontend Production Build**:
  ```bash
  cd frontend
  npm run build
  ```

- **Complete End-to-End Headless Chrome & API Flow**:
  ```bash
  backend/venv/bin/python scripts/e2e_full_test.py
  ```

---

## 5. Environment Variables & Production Deployment

### Environment Configuration

Both backend and frontend support environment-driven configuration for seamless local development and production hosting:

#### Backend Environment (`backend/.env`)
Copy the template file to `.env`:
```bash
cp backend/.env.example backend/.env
```
Key variables:
- `FRONTEND_ORIGIN`: Allowed origins for CORS (e.g., `https://railblock-advisor-frontend.vercel.app` or `http://localhost:5173`). Supports comma-separated origins.
- `HOST`: Server host binding (default: `0.0.0.0`).
- `PORT`: Server port (default: `8000`).
- `CORS_ALLOW_ALL`: Set to `false` for production, `true` for unrestricted local testing.

#### Frontend Environment (`frontend/.env`)
Copy the template file to `.env`:
```bash
cp frontend/.env.example frontend/.env
```
Key variables:
- `VITE_API_BASE_URL`: URL of the deployed FastAPI backend (e.g., `https://railblock-advisor.onrender.com`). If unset in dev, defaults to `http://localhost:8000`. In production, defaults to `https://railblock-advisor.onrender.com`.

---

### Production Deployment Instructions

#### 1. Backend Deployment (Render)
- **Runtime**: Python 3.10+
- **Build Command**: `pip install -r requirements.txt && python seed_data.py`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Environment Variables**:
  - `FRONTEND_ORIGIN`: `https://railblock-advisor-frontend.vercel.app,http://localhost:5173`
  - `CORS_ALLOW_ALL`: `false`

#### 2. Frontend Deployment (Vercel)
- **Framework Preset**: Vite
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_API_BASE_URL`: `https://railblock-advisor.onrender.com`

---

## 6. Synthetic Demo Data & Disclaimer

- **Synthetic Corridor Alpha**: All data files located in `data/` (`maintenance_tasks.json`, `train_movements.json`, `block_windows.json`, `resources.json`) represent synthetic operational data for demonstration purposes only.
- **Decision-Support Scope**: RailBlock Advisor provides AI-assisted, constraint-aware scheduling recommendations for operations planners. It does not replace human authorization or execute automated train dispatching.
- **Append-Only Audit Trail**: The audit trail records approval and workflow events for the prototype.
