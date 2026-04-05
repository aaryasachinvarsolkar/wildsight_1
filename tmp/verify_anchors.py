import os
import sys
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parent.parent / "backend"))

from app.services.biometric import BiometricService

def verify_anchors():
    service = BiometricService()
    test_cases = [
        ("Leopard", "Panthera pardus"),
        ("Lion", "Panthera leo"),
        ("Tiger", "Panthera tigris"),
        ("Elephant", "Elephas maximus"),
        ("Nilgiri Tahr", "Hemitragus hylocrius"),
        ("Peacock", "Pavo cristatus")
    ]
    
    print("\n--- Verifying Census Anchors (Iconic 30) ---")
    for common, scien in test_cases:
        anchor = service._resolve_census_anchor(common, scien)
        if anchor:
            print(f"SUCCESS: '{common}' anchored to {anchor['species_name']} ({anchor['national_census']})")
        else:
            print(f"FAILED: '{common}' ({scien}) - No anchor found!")

if __name__ == "__main__":
    verify_anchors()
