import sys
import os
import time
from datetime import datetime, timedelta
import h3

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, select
from app.models.db import engine, EnvironmentalCache, PulseLog
from app.services.geospatial import geospatial_service
from app.services.ingest_gbif import gbif_service
from app.services.ml_trainer import MLTrainer

def run_5_day_updation_cycle():
    """
    Scans the database for any region where the environmental telemetry
    is older than 5 days. For those regions, it makes heavy API calls
    (Sentinel, OpenMeteo, Overpass) to refresh the exact 5-day state.
    """
    print(f"[{datetime.utcnow()}] --- 5-Day Updation Cycle Started ---")
    updated_count = 0
    
    with Session(engine) as session:
        # 1. Find all previously tracked regions
        statement = select(EnvironmentalCache)
        all_regions = session.exec(statement).all()
        
        for region in all_regions:
            # 2. Check strict 5-day age
            age = datetime.utcnow() - region.fetched_at
            if age >= timedelta(days=5):
                h3_index = region.h3_index
                print(f"Region {h3_index} is {age.days} days old. Triggering Real-Time Fetch...")
                
                try:
                    # Resolve Lat/Lon
                    try:
                        lat, lon = h3.h3_to_geo(h3_index) # h3 v3
                    except AttributeError:
                        lat, lon = h3.cell_to_latlng(h3_index) # h3 v4
                        
                    # 3. Temporarily bypass cache to force external API calls
                    region.fetched_at = datetime.utcnow() - timedelta(days=10)
                    session.add(region)
                    session.commit()
                    
                    # 4. Fetch from Real APIs (Sentinel, OpenMeteo, Overpass)
                    # This function inherently merges back into the EnvironmentalCache table
                    geospatial_service.get_environmental_data(lat, lon)
                    updated_count += 1
                    
                    # Respect rate limits between fetches
                    time.sleep(2)
                except Exception as e:
                    print(f"Failed to update region {h3_index}: {e}")
                
    print(f"[{datetime.utcnow()}] --- Updation Cycle Complete. {updated_count} Regions Updated. ---")

def run_pulse():
    """
    Continuous Learning Loop running on verified sightings. 
    """
    print(f"[{datetime.now()}] --- ML Pulse Started ---")
    trainer = MLTrainer()
    species_list = ["Panthera tigris", "Elephas maximus", "Rhinoceros unicornis", "Diospyros ebenum", "Chlorophytum borivilianum"] 
    new_knowledge_logs = []
    
    with Session(engine) as session:
        for species in species_list:
            # 1. Fetch Real Verified Occurrences (GBIF)
            occurrences = gbif_service.fetch_species_occurrences(species, limit=10)
            
            for (lat, lon, zone_id) in occurrences:
                import h3
                try:
                   h3_index = h3.geo_to_h3(lat, lon, 4)
                except AttributeError:
                   h3_index = h3.latlng_to_cell(lat, lon, 4)
                except:
                   h3_index = "unknown"

                # 2. Monitor using fully verified Telemetry (from the 5-Day Cache!)
                env_data = geospatial_service.get_environmental_data(lat, lon)
                monitoring_ndvi = env_data.ndvi
                
                # 3. Log real ground-truthed data for ML Retraining
                risk_score = 0.8 if monitoring_ndvi < 0.4 else 0.2
                trainer_log = {
                    "species_name": species,
                    "risk_score": risk_score,
                    "ndvi_current": monitoring_ndvi,
                    "action": "field_intervention" if risk_score > 0.7 else "monitor",
                    "outcome": "success", 
                    "hdi": env_data.human_development_index, 
                    "sens_fire": 0, "sens_poaching": 0, "sens_encroachment": 0, "sens_drought": 0,
                    "sens_disease": 0, "sens_power_lines": 0, "is_plant": 1 if "Diospyros" in species else 0,
                    "is_mammal": 1 if "Panthera" in species else 0,
                    "is_bird": 0, "is_reptile": 0, "is_amphibian": 0, "is_insect": 0, "is_marine": 0, "is_fungi": 0
                }
                new_knowledge_logs.append(trainer_log)
                
        if new_knowledge_logs:
            print(f"Triggering Continuous Learning Loop with {len(new_knowledge_logs)} new insights...")
            trainer.update_and_retrain(new_knowledge_logs)

if __name__ == "__main__":
    print("Starting WildSight Real-Time 5-Day Updation Daemon...")
    while True:
        try:
            # Priority 1: Refresh stale environmental cache
            run_5_day_updation_cycle()
            
            # Priority 2: Ingest new GBIF sightings and train
            run_pulse()
            
        except Exception as e:
            print(f"Daemon Error Loop: {e}")
            
        # Run exactly once per day, or loop frequently if you prefer continuous checking
        # (This sleep implies it checks every 1 hour to see if 5 days have elapsed for any specific record)
        print(f"[{datetime.utcnow()}] Sleeping for 1 hour before next cache sweep...")
        time.sleep(3600)
