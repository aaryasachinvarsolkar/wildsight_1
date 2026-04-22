from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api import router as api_router
from app.models.db import create_core_db_and_tables, create_eco_ranger_tables
import os

app = FastAPI(
    title="EcoGuard Geospatial Intelligence Platform",
    description="Advanced AI-powered Geospatial Intelligence Platform for Biodiversity Conservation",
    version="1.0.0"
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.on_event("startup")
def startup_db():
    create_core_db_and_tables()
    try:
        create_eco_ranger_tables()
    except Exception as exc:
        print(f"Eco Ranger DB init warning: {exc}")

# CORS Configuration
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

from fastapi import Request
import traceback
import sys

@app.middleware("http")
async def log_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        print(f"CRITICAL API ERROR: {e}")
        traceback.print_exc()
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500,
            content={"detail": str(e), "traceback": traceback.format_exc()}
        )

@app.get("/")
def read_root():
    return {"message": "Welcome to EcoGuard API"}

app.include_router(api_router, prefix="/api/v1")
