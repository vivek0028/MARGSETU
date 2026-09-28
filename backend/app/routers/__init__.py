from app.routers.health import router as health_router
from app.routers.auth import router as auth_router
from app.routers.assets import router as assets_router
from app.routers.tasks import router as tasks_router, maintenance_alias_router, requests_router
from app.routers.block_windows import router as block_windows_router
from app.routers.timetable import router as timetable_router, movements_alias_router
from app.routers.movements import router as movements_router
from app.routers.resources import router as resources_router
from app.routers.data_sources import router as data_sources_router
from app.routers.conflicts import router as conflicts_router
from app.routers.optimization import router as optimization_router
from app.routers.execution import router as execution_router
from app.routers.analytics import router as analytics_router
from app.routers.reports import router as reports_router
from app.routers.notifications import router as notifications_router
from app.routers.admin import router as admin_router
from app.routers.departments import router as departments_router
from app.routers.search import router as search_router
from app.routers.simulation import router as simulation_router
from app.routers.compatibility import router as compatibility_router
from app.routers.priority import router as priority_router
from app.routers.dashboard import router as dashboard_router
from app.routers.audit import router as audit_router, audit_alias_router

__all__ = [
    "health_router",
    "auth_router",
    "assets_router",
    "tasks_router",
    "maintenance_alias_router",
    "requests_router",
    "block_windows_router",
    "timetable_router",
    "movements_router",
    "movements_alias_router",
    "resources_router",
    "data_sources_router",
    "conflicts_router",
    "optimization_router",
    "execution_router",
    "analytics_router",
    "reports_router",
    "notifications_router",
    "admin_router",
    "departments_router",
    "search_router",
    "simulation_router",
    "compatibility_router",
    "priority_router",
    "dashboard_router",
    "audit_router",
    "audit_alias_router"
]
