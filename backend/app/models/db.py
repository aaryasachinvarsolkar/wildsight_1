from typing import Optional, List, Dict
from sqlmodel import Field, SQLModel, create_engine, Session, JSON
from datetime import datetime
import os

# --- Database Setup ---
# Use absolute path for reliability in this environment
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "wildsight.db")
DATABASE_URL = os.getenv("WILDSIGHT_DATABASE_URL", f"sqlite:///{DB_PATH}")
ECO_RANGER_DATABASE_URL = os.getenv(
    "ECO_RANGER_DATABASE_URL",
    "postgresql://postgres:nNeGbxRSAGvqSYtdDEGwWisxJBGwNQxR@shinkansen.proxy.rlwy.net:59853/railway",
)


def _create_db_engine(url: str):
    if url.startswith("sqlite"):
        return create_engine(url, echo=False, connect_args={"check_same_thread": False})
    return create_engine(url, echo=False)


engine = _create_db_engine(DATABASE_URL)
eco_ranger_engine = _create_db_engine(ECO_RANGER_DATABASE_URL)

def get_session():
    with Session(engine) as session:
        yield session


def get_eco_ranger_session():
    with Session(eco_ranger_engine) as session:
        yield session

def create_db_and_tables():
    create_core_db_and_tables()


def create_core_db_and_tables():
    core_tables = [
        RiskPrediction.__table__,
        EnvironmentalCache.__table__,
        PulseLog.__table__,
        PlaceNameCache.__table__,
        EnvironmentalHistory.__table__,
    ]
    SQLModel.metadata.create_all(engine, tables=core_tables)


def create_eco_ranger_tables():
    eco_tables = [
        RangerScan.__table__,
        SpeciesLog.__table__,
        ValidationRecord.__table__,
    ]
    SQLModel.metadata.create_all(eco_ranger_engine, tables=eco_tables)

# --- Models ---

class RiskPrediction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    species_name: str = Field(index=True)
    h3_index: str = Field(index=True)
    
    # Risk Assessment
    risk_level: str  # Low, Medium, High
    confidence: float
    explanation: str
    
    # Context (Snapshot for debugging)
    features_snapshot: Dict = Field(default={}, sa_type=JSON) 
    
    # Metadata
    model_version: str = Field(default="1.0.0")
    prediction_source: str = Field(default="computed") # "cached" or "computed"
    created_at: datetime = Field(default_factory=datetime.utcnow) 

class EnvironmentalCache(SQLModel, table=True):
    """
    Cache for environmental data per H3 cell to avoid re-fetching constantly.
    """
    h3_index: str = Field(primary_key=True)
    ndvi: float
    evi: float = 0.5
    ndwi: float
    rainfall: float
    temperature: float
    human_development_index: float
    nightlights: float = 0.0
    fetched_at: datetime = Field(default_factory=datetime.utcnow) 
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class PulseLog(SQLModel, table=True):
    """
    Log of 5-day updates for species population and risk.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    species_name: str = Field(index=True)
    h3_index: Optional[str] = Field(default=None, index=True) # [Phase 3] Added for location-specific graphs
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    population_count: int
    risk_score: float
    data_source: str = "computed"

class PlaceNameCache(SQLModel, table=True):
    """
    Persistent cache for Nominatim Reverse Geocoding results.
    """
    h3_index: str = Field(primary_key=True)
    full_name: str
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class EnvironmentalHistory(SQLModel, table=True):
    """
    Historical time-series of environmental data per H3 cell.
    Populated by the continuous pulse pipeline.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    h3_index: str = Field(index=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    
    # Telemetry
    ndvi: float
    evi: float = 0.5
    ndwi: float
    temperature: float
    rainfall: float
    frp: float  # Fire Radiative Power
    hdi: float  # Human Development Index
    nightlights: float = 0.0


class RangerScan(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ranger_id: str = Field(index=True)
    ranger_name: str = Field(index=True)
    species_common_name: str = Field(index=True)
    species_scientific_name: str = Field(index=True)

    latitude: float = Field(index=True)
    longitude: float = Field(index=True)
    altitude_meters: Optional[float] = None

    health_status: str = Field(index=True)  # Healthy | At Risk | Critical
    growth_stage: str = Field(default="mature")  # sapling | mature | dying
    leaf_discoloration_pct: float = Field(default=0.0)
    disease_detected: bool = Field(default=False)
    physical_damage: bool = Field(default=False)

    notes: str = Field(default="")
    image_urls: List[str] = Field(default_factory=list, sa_type=JSON)
    source: str = Field(default="mobile")

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    synced_at: Optional[datetime] = None


class SpeciesLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    scan_id: Optional[int] = Field(default=None, index=True)
    species_scientific_name: str = Field(index=True)

    satellite_health: str = Field(default="Unknown")
    satellite_ndvi_trend: str = Field(default="stable")
    satellite_risk_pct: float = Field(default=0.0)

    ranger_health: str = Field(default="Unknown")
    ranger_notes: str = Field(default="")
    confidence_score: float = Field(default=0.0)
    mismatch: bool = Field(default=False, index=True)

    logged_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class ValidationRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    scan_id: int = Field(index=True)
    species_log_id: Optional[int] = Field(default=None, index=True)

    ranger_id: str = Field(index=True)
    validation_decision: str = Field(index=True)  # Correct | Incorrect | Needs Review
    ranger_input_condition: str = Field(default="Unknown")
    ranger_notes: str = Field(default="")

    predicted_risk_pct: float = Field(default=0.0)
    confidence_score: float = Field(default=0.0)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
