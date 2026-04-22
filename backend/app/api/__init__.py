from fastapi import APIRouter
from app.api import eco_ranger

router = APIRouter()

@router.get("/health")
def health_check():
    return {"status": "healthy"}

router.include_router(eco_ranger.router, prefix="/eco-ranger", tags=["eco-ranger"])

try:
    from app.api import species

    router.include_router(species.router, prefix="/species", tags=["species"])
except Exception:
    species = None

try:
    from app.api import v1_analytics

    router.include_router(v1_analytics.router, prefix="/analytics", tags=["analytics"])
except Exception:
    v1_analytics = None
