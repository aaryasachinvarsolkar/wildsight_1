from datetime import datetime, timezone
import json
import os
from typing import List, Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import Session, select

from app.models.db import (
    RangerScan,
    RiskPrediction,
    SpeciesLog,
    ValidationRecord,
    get_eco_ranger_session,
)

router = APIRouter()


class RangerScanCreate(BaseModel):
    ranger_id: str
    ranger_name: str
    species_common_name: str
    species_scientific_name: str
    latitude: float
    longitude: float
    altitude_meters: Optional[float] = None
    health_status: str = Field(description="Healthy, At Risk, or Critical")
    growth_stage: str = Field(default="mature")
    leaf_discoloration_pct: float = 0.0
    disease_detected: bool = False
    physical_damage: bool = False
    notes: str = ""
    image_urls: List[str] = Field(default_factory=list)


class ValidationCreate(BaseModel):
    scan_id: int
    ranger_id: str
    validation_decision: str = Field(description="Correct, Incorrect, or Needs Review")
    ranger_input_condition: str
    ranger_notes: str = ""
    predicted_risk_pct: float = 0.0
    confidence_score: float = 0.0


class ScanAnalysisResult(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "propertyOrdering": [
                "species_common_name",
                "species_scientific_name",
                "species_type",
                "growth_stage",
                "health_status",
                "health_analysis",
                "leaf_discoloration_pct",
                "disease_detected",
                "physical_damage",
                "confidence",
                "ai_notes",
            ]
        }
    )

    species_common_name: str = Field(description="Common species name")
    species_scientific_name: str = Field(description="Scientific species name")
    species_type: str = Field(description="Plant, animal, fungus, insect, bird, reptile, amphibian, or unknown")
    growth_stage: Literal["sapling", "mature", "dying"] = Field(description="Observed growth stage")
    health_status: Literal["Healthy", "At Risk", "Critical"] = Field(description="Health condition")
    health_analysis: str = Field(description="Short explanation of the health assessment")
    leaf_discoloration_pct: float = Field(description="Percent leaf discoloration from 0 to 100")
    disease_detected: bool = Field(description="Whether disease is visible")
    physical_damage: bool = Field(description="Whether physical damage is visible")
    confidence: float = Field(description="Confidence between 0 and 1")
    ai_notes: str = Field(description="Internal notes or uncertainty context")


def _risk_to_health(risk_pct: float) -> str:
    if risk_pct >= 70:
        return "Critical"
    if risk_pct >= 40:
        return "At Risk"
    return "Healthy"


def _status_to_risk_pct(status: str) -> float:
    mapping = {
        "Healthy": 25.0,
        "At Risk": 60.0,
        "Critical": 85.0,
    }
    return mapping.get(status, 50.0)


def _extract_json_payload(text: str) -> dict:
    if not text:
        return {}
    cleaned = text.strip()
    if "```" in cleaned:
        cleaned = cleaned.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except Exception:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(cleaned[start : end + 1])
            except Exception:
                return {}
    return {}


def _env(*names: str) -> Optional[str]:
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return None


def _build_s3_image_reference(filename: str, ranger_id: str, content_type: Optional[str]) -> Optional[dict]:
    bucket = _env("ECO_RANGER_S3_BUCKET", "AWS_S3_BUCKET", "S3_BUCKET", "S3_BUCKET_NAME")
    if not bucket:
        return None

    prefix = os.getenv("ECO_RANGER_S3_PREFIX", "eco-ranger/scans").strip("/")
    region = _env("ECO_RANGER_S3_REGION", "AWS_REGION", "AWS_DEFAULT_REGION")
    endpoint_url = _env("ECO_RANGER_S3_ENDPOINT_URL", "AWS_ENDPOINT_URL")
    force_public_read = os.getenv("ECO_RANGER_S3_FORCE_PUBLIC_READ", "false").lower() in {"1", "true", "yes", "on"}
    presign_seconds = int(os.getenv("ECO_RANGER_S3_PRESIGN_SECONDS", "86400"))
    public_base_url = os.getenv("ECO_RANGER_S3_PUBLIC_BASE_URL")
    access_key_id = _env("AWS_ACCESS_KEY_ID", "AWS_ACCESS_KEY")
    secret_access_key = _env("AWS_SECRET_ACCESS_KEY", "AWS_SECRET_KEY")
    session_token = _env("AWS_SESSION_TOKEN")

    safe_filename = os.path.basename(filename or "scan.jpg") or "scan.jpg"
    extension = os.path.splitext(safe_filename)[1] or ".jpg"
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    key = f"{prefix}/{ranger_id}/{timestamp}-{uuid4().hex}{extension}"

    return {
        "bucket": bucket,
        "key": key,
        "region": region,
        "endpoint_url": endpoint_url,
        "force_public_read": force_public_read,
        "presign_seconds": presign_seconds,
        "public_base_url": public_base_url,
        "content_type": content_type or "image/jpeg",
        "access_key_id": access_key_id,
        "secret_access_key": secret_access_key,
        "session_token": session_token,
    }


def _upload_scan_image_to_s3(image_bytes: bytes, filename: str, content_type: Optional[str], ranger_id: str) -> Optional[dict]:
    storage = _build_s3_image_reference(filename, ranger_id, content_type)
    if not storage:
        return None

    from boto3 import client as boto3_client
    from boto3 import Session as Boto3Session

    session_kwargs = {}
    client_kwargs = {}
    if storage["region"]:
        session_kwargs["region_name"] = storage["region"]
    if storage["endpoint_url"]:
        client_kwargs["endpoint_url"] = storage["endpoint_url"]
    if storage["access_key_id"] and storage["secret_access_key"]:
        session_kwargs["aws_access_key_id"] = storage["access_key_id"]
        session_kwargs["aws_secret_access_key"] = storage["secret_access_key"]
        if storage["session_token"]:
            session_kwargs["aws_session_token"] = storage["session_token"]
        s3_client = Boto3Session(**session_kwargs).client("s3", **client_kwargs)
    else:
        s3_client = boto3_client("s3", **client_kwargs)

    put_object_kwargs = {
        "Bucket": storage["bucket"],
        "Key": storage["key"],
        "Body": image_bytes,
        "ContentType": storage["content_type"],
    }
    if storage["force_public_read"]:
        put_object_kwargs["ACL"] = "public-read"

    s3_client.put_object(**put_object_kwargs)

    url = None
    if storage["public_base_url"]:
        url = f"{storage['public_base_url'].rstrip('/')}/{storage['key']}"
    elif storage["force_public_read"] and storage["region"]:
        url = f"https://{storage['bucket']}.s3.{storage['region']}.amazonaws.com/{storage['key']}"
    else:
        try:
            url = s3_client.generate_presigned_url(
                ClientMethod="get_object",
                Params={"Bucket": storage["bucket"], "Key": storage["key"]},
                ExpiresIn=storage["presign_seconds"],
            )
        except Exception:
            url = f"s3://{storage['bucket']}/{storage['key']}"

    storage["url"] = url
    storage["uri"] = f"s3://{storage['bucket']}/{storage['key']}"
    return storage


def _save_scan_image_locally(image_bytes: bytes, filename: str, ranger_id: str) -> dict:
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    safe_filename = os.path.basename(filename or "scan.jpg") or "scan.jpg"
    extension = os.path.splitext(safe_filename)[1] or ".jpg"
    stored_name = f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid4().hex}{extension}"

    relative_parts = ["eco-ranger", "scans", ranger_id, stored_name]
    uploads_dir = os.path.join(backend_dir, "uploads", *relative_parts[:-1])
    os.makedirs(uploads_dir, exist_ok=True)

    file_path = os.path.join(uploads_dir, stored_name)
    with open(file_path, "wb") as output_file:
        output_file.write(image_bytes)

    public_base_url = _env("BACKEND_PUBLIC_BASE_URL", "ECO_RANGER_PUBLIC_BASE_URL") or "http://127.0.0.1:8000"
    relative_url = "/" + "/".join(["uploads", *relative_parts])
    return {
        "provider": "local",
        "path": file_path,
        "url": f"{public_base_url.rstrip('/')}{relative_url}",
        "uri": f"file://{file_path}",
    }


@router.post("/mobile/analyze-scan")
async def analyze_scan_image(
    image: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    altitude_meters: Optional[float] = Form(None),
    ranger_id: str = Form("ranger-001"),
    ranger_name: str = Form("Field Ranger"),
    notes: str = Form(""),
    session: Session = Depends(get_eco_ranger_session),
):
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Image content is empty")

    image_storage = _save_scan_image_locally(image_bytes, image.filename or "scan.jpg", ranger_id)
    image_storage_error = None
    try:
        s3_storage = _upload_scan_image_to_s3(image_bytes, image.filename or "scan.jpg", image.content_type, ranger_id)
        if s3_storage and s3_storage.get("url"):
            image_storage = s3_storage
    except Exception as exc:
        image_storage_error = f"Failed to upload scan image to S3: {exc}"

    analysis = {
        "species_common_name": "Unknown Species",
        "species_scientific_name": "Unknown scientific name",
        "species_type": "Unknown",
        "growth_stage": "mature",
        "health_status": "At Risk",
        "health_analysis": "Image processed but AI analysis unavailable; review manually.",
        "leaf_discoloration_pct": 30.0,
        "disease_detected": False,
        "physical_damage": False,
        "confidence": 0.55,
        "ai_notes": "Fallback mode",
    }
    analysis_source = "fallback"
    gemini_error = None

    api_key = _env("GOOGLE_API_KEY", "GEMINI_API_KEY")
    if api_key and "YOUR" not in api_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)
            prompt = (
                "You are a biodiversity field assistant. Analyze the uploaded species photo and return ONLY JSON with keys: "
                "species_common_name, species_scientific_name, species_type, growth_stage, health_status, "
                "health_analysis, leaf_discoloration_pct, disease_detected, physical_damage, confidence, ai_notes. "
                "Identify the most likely species using your best estimate when the subject is visible. "
                "Use 'Unknown Species' only when the subject is genuinely not identifiable due to severe blur/occlusion/no subject. "
                "health_status must be one of: Healthy, At Risk, Critical. growth_stage must be one of: sapling, mature, dying. "
                "leaf_discoloration_pct must be a number between 0 and 100. confidence must be between 0 and 1."
            )

            model_candidates = ["gemini-flash-latest", "gemini-2.0-flash", "gemini-2.5-flash"]
            last_model_error = None

            for model_name in model_candidates:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=[
                            types.Part.from_text(text=prompt),
                            types.Part.from_bytes(data=image_bytes, mime_type=image.content_type or "image/jpeg"),
                        ],
                        config={
                            "response_mime_type": "application/json",
                            "response_schema": ScanAnalysisResult.model_json_schema(),
                        },
                    )
                    raw_text = getattr(response, "text", "") or ""
                    parsed = {}
                    try:
                        parsed = ScanAnalysisResult.model_validate_json(raw_text).model_dump()
                    except Exception:
                        parsed = _extract_json_payload(raw_text)

                    if parsed:
                        analysis.update(parsed)
                        analysis_source = "gemini"
                        break
                except Exception as model_exc:
                    last_model_error = model_exc

            if analysis_source != "gemini" and last_model_error:
                raise last_model_error
        except Exception as exc:
            gemini_error = str(exc)
            analysis["ai_notes"] = f"AI fallback due to error: {exc}"
    else:
        gemini_error = "AI API key missing or placeholder"
        analysis["ai_notes"] = "AI fallback: API key missing"

    valid_status = {"Healthy", "At Risk", "Critical"}
    valid_growth = {"sapling", "mature", "dying"}
    health_status = analysis.get("health_status", "At Risk")
    growth_stage = analysis.get("growth_stage", "mature")

    if health_status not in valid_status:
        health_status = "At Risk"
    if growth_stage not in valid_growth:
        growth_stage = "mature"

    leaf_discoloration_pct = float(max(0.0, min(100.0, float(analysis.get("leaf_discoloration_pct", 30.0) or 30.0))))
    confidence = float(max(0.0, min(1.0, float(analysis.get("confidence", 0.55) or 0.55))))
    disease_detected = bool(analysis.get("disease_detected", False))
    physical_damage = bool(analysis.get("physical_damage", False))

    scan = RangerScan(
        ranger_id=ranger_id,
        ranger_name=ranger_name,
        species_common_name=str(analysis.get("species_common_name", "Unknown Species")),
        species_scientific_name=str(analysis.get("species_scientific_name", "Unknown scientific name")),
        latitude=latitude,
        longitude=longitude,
        altitude_meters=altitude_meters,
        health_status=health_status,
        growth_stage=growth_stage,
        leaf_discoloration_pct=leaf_discoloration_pct,
        disease_detected=disease_detected,
        physical_damage=physical_damage,
        notes=notes or str(analysis.get("health_analysis", "")),
        image_urls=[image_storage["url"]] if image_storage and image_storage.get("url") else [],
        source="mobile-gemini",
    )
    session.add(scan)
    session.commit()
    session.refresh(scan)

    risk_pct = _status_to_risk_pct(health_status)
    species_log = SpeciesLog(
        scan_id=scan.id,
        species_scientific_name=scan.species_scientific_name,
        satellite_health=health_status,
        satellite_ndvi_trend="declining" if risk_pct >= 60 else "stable",
        satellite_risk_pct=risk_pct,
        ranger_health=health_status,
        ranger_notes=scan.notes,
        confidence_score=confidence,
        mismatch=False,
    )
    session.add(species_log)
    session.commit()
    session.refresh(species_log)

    validation = ValidationRecord(
        scan_id=scan.id,
        species_log_id=species_log.id,
        ranger_id=ranger_id,
        validation_decision="Correct",
        ranger_input_condition=health_status,
        ranger_notes=scan.notes,
        predicted_risk_pct=risk_pct,
        confidence_score=confidence,
    )
    session.add(validation)
    session.commit()
    session.refresh(validation)

    return {
        "analysis": {
            "species_common_name": scan.species_common_name,
            "species_scientific_name": scan.species_scientific_name,
            "species_type": str(analysis.get("species_type", "Unknown")),
            "growth_stage": scan.growth_stage,
            "health_status": scan.health_status,
            "health_analysis": str(analysis.get("health_analysis", "Manual review recommended.")),
            "confidence": confidence,
            "ai_notes": str(analysis.get("ai_notes", "")),
        },
        "location": {
            "latitude": latitude,
            "longitude": longitude,
            "altitude_meters": altitude_meters,
        },
        "image_storage": image_storage,
        "image_storage_error": image_storage_error,
        "analysis_source": analysis_source,
        "gemini_error": gemini_error,
        "saved": {
            "scan_id": scan.id,
            "species_log_id": species_log.id,
            "validation_id": validation.id,
        },
    }


@router.get("/mobile/predictions")
def get_mobile_prediction(
    species_name: str,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    session: Session = Depends(get_eco_ranger_session),
):
    prediction = session.exec(
        select(RiskPrediction)
        .where(RiskPrediction.species_name == species_name)
        .order_by(RiskPrediction.created_at.desc())
    ).first()

    if prediction:
        risk_pct = round(prediction.confidence * 100, 2)
        satellite_health = _risk_to_health(risk_pct)
        ndvi_trend = "declining" if risk_pct >= 60 else "stable"
    else:
        risk_pct = 35.0
        satellite_health = "Healthy"
        ndvi_trend = "stable"

    return {
        "species_name": species_name,
        "satellite_prediction": {
            "health": satellite_health,
            "ndvi_trend": ndvi_trend,
            "risk_pct": risk_pct,
        },
        "location_hint": {"lat": lat, "lon": lon},
        "served_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/mobile/scans")
def create_mobile_scan(payload: RangerScanCreate, session: Session = Depends(get_eco_ranger_session)):
    scan = RangerScan(**payload.model_dump())
    session.add(scan)
    session.commit()
    session.refresh(scan)

    satellite_risk = max(0.0, min(100.0, payload.leaf_discoloration_pct * 1.6 + (20.0 if payload.disease_detected else 0.0)))
    mismatch = _risk_to_health(satellite_risk) != payload.health_status

    species_log = SpeciesLog(
        scan_id=scan.id,
        species_scientific_name=payload.species_scientific_name,
        satellite_health=_risk_to_health(satellite_risk),
        satellite_ndvi_trend="declining" if satellite_risk >= 60 else "stable",
        satellite_risk_pct=satellite_risk,
        ranger_health=payload.health_status,
        ranger_notes=payload.notes,
        confidence_score=max(0.0, 1.0 - abs(satellite_risk - (80 if payload.health_status == "Critical" else 50 if payload.health_status == "At Risk" else 20)) / 100),
        mismatch=mismatch,
    )
    session.add(species_log)
    session.commit()
    session.refresh(species_log)

    return {"scan": scan, "species_log": species_log}


@router.post("/mobile/validations")
def create_validation(payload: ValidationCreate, session: Session = Depends(get_eco_ranger_session)):
    scan = session.get(RangerScan, payload.scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    log = session.exec(
        select(SpeciesLog)
        .where(SpeciesLog.scan_id == payload.scan_id)
        .order_by(SpeciesLog.logged_at.desc())
    ).first()

    validation = ValidationRecord(
        scan_id=payload.scan_id,
        species_log_id=log.id if log else None,
        ranger_id=payload.ranger_id,
        validation_decision=payload.validation_decision,
        ranger_input_condition=payload.ranger_input_condition,
        ranger_notes=payload.ranger_notes,
        predicted_risk_pct=payload.predicted_risk_pct,
        confidence_score=payload.confidence_score,
    )
    session.add(validation)

    if log:
        log.ranger_health = payload.ranger_input_condition
        log.ranger_notes = payload.ranger_notes
        log.confidence_score = payload.confidence_score
        log.mismatch = payload.validation_decision in {"Incorrect", "Needs Review"}
        session.add(log)

    session.commit()
    session.refresh(validation)

    return {"validation": validation, "updated_species_log_id": log.id if log else None}


@router.get("/web/dashboard")
def get_web_dashboard(session: Session = Depends(get_eco_ranger_session), limit: int = Query(default=100, ge=1, le=500)):
    scans = session.exec(select(RangerScan).order_by(RangerScan.created_at.desc()).limit(limit)).all()
    logs = session.exec(select(SpeciesLog).order_by(SpeciesLog.logged_at.desc()).limit(limit)).all()
    validations = session.exec(
        select(ValidationRecord).order_by(ValidationRecord.created_at.desc()).limit(limit)
    ).all()

    total_scans = len(scans)
    monitored_species = len({s.species_scientific_name for s in scans})
    mismatches = [l for l in logs if l.mismatch]
    baseline_accuracy = 0.65
    observed_accuracy = 1.0 - (len(mismatches) / len(logs) if logs else 0.0)

    ranger_stats = {}
    for scan in scans:
        ranger_stats.setdefault(
            scan.ranger_id,
            {
                "ranger_id": scan.ranger_id,
                "ranger_name": scan.ranger_name,
                "scans": 0,
                "validations": 0,
                "badge": "Explorer",
            },
        )
        ranger_stats[scan.ranger_id]["scans"] += 1

    for validation in validations:
        if validation.ranger_id not in ranger_stats:
            ranger_stats[validation.ranger_id] = {
                "ranger_id": validation.ranger_id,
                "ranger_name": validation.ranger_id,
                "scans": 0,
                "validations": 0,
                "badge": "Explorer",
            }
        ranger_stats[validation.ranger_id]["validations"] += 1

    for stat in ranger_stats.values():
        contribution = stat["scans"] + stat["validations"]
        stat["badge"] = "Guardian" if contribution >= 25 else "Pathfinder" if contribution >= 10 else "Explorer"

    alerts = []
    for log in logs[:30]:
        if log.satellite_risk_pct >= 75 or log.ranger_health == "Critical" or log.mismatch:
            alerts.append(
                {
                    "species": log.species_scientific_name,
                    "severity": "high" if log.satellite_risk_pct >= 75 else "medium",
                    "message": "Critical issue flagged" if log.ranger_health == "Critical" else "Validation mismatch detected",
                    "timestamp": log.logged_at,
                }
            )

    timeline = []
    for log in sorted(logs, key=lambda x: x.logged_at):
        timeline.append(
            {
                "timestamp": log.logged_at,
                "species": log.species_scientific_name,
                "satellite_risk_pct": log.satellite_risk_pct,
                "ranger_health": log.ranger_health,
                "confidence_score": log.confidence_score,
                "mismatch": log.mismatch,
            }
        )

    return {
        "map_markers": [
            {
                "scan_id": s.id,
                "species_common_name": s.species_common_name,
                "species_scientific_name": s.species_scientific_name,
                "latitude": s.latitude,
                "longitude": s.longitude,
                "health_status": s.health_status,
                "growth_stage": s.growth_stage,
                "timestamp": s.created_at,
                "image_urls": s.image_urls,
                "notes": s.notes,
                "ranger_name": s.ranger_name,
            }
            for s in scans
        ],
        "species_logs": [
            {
                "id": l.id,
                "scan_id": l.scan_id,
                "species_scientific_name": l.species_scientific_name,
                "satellite_health": l.satellite_health,
                "satellite_ndvi_trend": l.satellite_ndvi_trend,
                "satellite_risk_pct": l.satellite_risk_pct,
                "ranger_health": l.ranger_health,
                "ranger_notes": l.ranger_notes,
                "confidence_score": l.confidence_score,
                "mismatch": l.mismatch,
                "logged_at": l.logged_at,
            }
            for l in logs
        ],
        "validations": [
            {
                "id": v.id,
                "scan_id": v.scan_id,
                "species_log_id": v.species_log_id,
                "ranger_id": v.ranger_id,
                "validation_decision": v.validation_decision,
                "ranger_input_condition": v.ranger_input_condition,
                "ranger_notes": v.ranger_notes,
                "predicted_risk_pct": v.predicted_risk_pct,
                "confidence_score": v.confidence_score,
                "created_at": v.created_at,
            }
            for v in validations
        ],
        "analytics": {
            "total_scans": total_scans,
            "species_monitored": monitored_species,
            "model_accuracy_improvement_pct": round(max(0.0, (observed_accuracy - baseline_accuracy) * 100), 2),
            "current_accuracy_pct": round(observed_accuracy * 100, 2),
            "ranger_activity_heatmap": [
                {"lat": s.latitude, "lon": s.longitude, "intensity": 1} for s in scans
            ],
        },
        "alerts": alerts,
        "ranger_profiles": list(ranger_stats.values()),
        "timeline": timeline,
    }


@router.get("/web/species/{scientific_name}")
def get_species_detail(scientific_name: str, session: Session = Depends(get_eco_ranger_session)):
    scans = session.exec(
        select(RangerScan)
        .where(RangerScan.species_scientific_name == scientific_name)
        .order_by(RangerScan.created_at.desc())
    ).all()
    logs = session.exec(
        select(SpeciesLog)
        .where(SpeciesLog.species_scientific_name == scientific_name)
        .order_by(SpeciesLog.logged_at.desc())
    ).all()

    if not scans and not logs:
        raise HTTPException(status_code=404, detail="No species records found")

    return {
        "scientific_name": scientific_name,
        "latest_scan": scans[0] if scans else None,
        "scan_logs": scans,
        "timeline": logs,
    }
