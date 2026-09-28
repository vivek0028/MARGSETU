from fastapi import APIRouter
from datetime import datetime

router = APIRouter(tags=["Health"])

@router.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "MARGSETU Backend",
        "version": "1.0.0",
        "environment": "Demo / Prototype",
        "mode": "DEMO DATA (Synthetic Indian Railways Corridor Alpha)",
        "timestamp": datetime.utcnow().isoformat()
    }
