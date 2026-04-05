import os
import sys
import json
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parent.parent / "backend"))

# Mock Environmental Data
class MockEnv:
    def __init__(self):
        self.ndvi = 0.6
        self.evi = 0.5
        self.ndwi = 0.1
        self.human_development_index = 0.3
        self.fire_radiative_power = 0.0

from app.services.biometric import BiometricService

def test_estimations():
    service = BiometricService()
    species_to_test = [
        "Nilgiri Tahr",
        "Bengal Tiger",
        "Indian Peafowl",
        "Common Myna"
    ]
    
    env = MockEnv()
    
    for species in species_to_test:
        print(f"\n--- Testing: {species} ---")
        # Simulate a typical number of sightings
        raw_count = 50 if "Tahr" in species else 200
        unique_cells = 5 if "Tahr" in species else 40
        
        res = service._calculate_scientific_error(
            species, 
            raw_count, 
            unique_h_count=unique_cells,
            env_data=env,
            status="Endangered" if "Tahr" in species or "Tiger" in species else "Least Concern",
            taxonomy={"class": "Mammalia" if "Tahr" in species or "Tiger" in species else "Aves"}
        )
        
        print(json.dumps(res, indent=2))

if __name__ == "__main__":
    test_estimations()
