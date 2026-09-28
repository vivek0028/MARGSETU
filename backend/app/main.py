import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.routers import (
    health_router,
    auth_router,
    assets_router,
    tasks_router,
    requests_router,
    block_windows_router,
    timetable_router,
    movements_router,
    movements_alias_router,
    resources_router,
    data_sources_router,
    conflicts_router,
    optimization_router,
    execution_router,
    analytics_router,
    reports_router,
    notifications_router,
    admin_router,
    departments_router,
    search_router,
    simulation_router,
    compatibility_router,
    priority_router,
    dashboard_router,
    audit_router,
    audit_alias_router
)
from seed_data import seed_database

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure PostgreSQL tables exist and seed production-grade dataset if empty
    Base.metadata.create_all(bind=engine)
    seed_database(force=False)
    yield

app = FastAPI(
    title="MARGSETU API",
    description=(
        "Enterprise Railway Maintenance & Block Planning Platform for Indian Railways.\n\n"
        "Integrates maintenance work-orders, dynamic rule-based priority scoring, "
        "5D operational conflict detection, Google OR-Tools CP-SAT multi-objective constraint optimization, "
        "candidate plan evaluation, human-in-the-loop sanctioning, live execution monitoring (Plan-vs-Actual), "
        "and immutable append-only audit logging."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "MARGSETU Backend",
        "version": "2.0.0",
        "mode": "Enterprise PostgreSQL Production"
    }

# Normalize duplicate /api/api/ paths if forwarded by clients or proxies
@app.middleware("http")
async def normalize_duplicate_api_prefix(request, call_next):
    path = request.scope.get("path", "")
    if path.startswith("/api/api/"):
        request.scope["path"] = path.replace("/api/api/", "/api/", 1)
    return await call_next(request)

# Configure CORS
default_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:4173",
    "https://railblock-advisor-frontend.vercel.app"
]

frontend_origin_env = os.getenv("FRONTEND_ORIGIN")
if frontend_origin_env:
    for origin in frontend_origin_env.split(","):
        cleaned = origin.strip().rstrip("/")
        if cleaned and cleaned not in default_origins:
            default_origins.append(cleaned)

allow_all = os.getenv("CORS_ALLOW_ALL", "false").lower() == "true"
cors_origins = ["*"] if allow_all else default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^(https://railblock-advisor-frontend.*\.vercel\.app|http://(localhost|127\.0\.0\.1)(:\d+)?)$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Route Aliases for deployment verification & backward compatibility
@app.get("/api/overview")
def get_overview_alias(db: Session = Depends(get_db)):
    from app.routers.dashboard import get_dashboard_summary
    return get_dashboard_summary(db)

# Mount All Enterprise Routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(assets_router)
app.include_router(tasks_router)
app.include_router(requests_router)
app.include_router(block_windows_router)
app.include_router(timetable_router)
app.include_router(movements_router)
app.include_router(movements_alias_router)
app.include_router(resources_router)
app.include_router(data_sources_router)
app.include_router(conflicts_router)
app.include_router(optimization_router)
app.include_router(execution_router)
app.include_router(analytics_router)
app.include_router(reports_router)
app.include_router(notifications_router)
app.include_router(admin_router)
app.include_router(departments_router)
app.include_router(search_router)
app.include_router(simulation_router)
app.include_router(compatibility_router)
app.include_router(priority_router)
app.include_router(audit_router)
app.include_router(audit_alias_router)

@app.get("/")
def root():
    return {
        "project": "MARGSETU",
        "subtitle": "Railway Maintenance & Block Planning Platform",
        "version": "2.0.0 (Production)",
        "database": "PostgreSQL 18 (Source of Truth)",
        "solver": "Google OR-Tools CP-SAT",
        "status": "Operational",
        "docs_url": "/docs",
        "data_mode": "SYNTHETIC OPERATIONAL DATA (Northern Railway Corridor Alpha)"
    }
