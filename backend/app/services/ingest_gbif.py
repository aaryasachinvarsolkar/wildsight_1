import requests
import random
from typing import List, Tuple, Dict

GBIF_API_URL = "https://api.gbif.org/v1/occurrence/search"

class GBIFService:
    def fetch_species_occurrences(self, species_name: str, limit: int = 100) -> List[Tuple[float, float, str]]:
        """
        Fetches recent occurrences of a species.
        Returns List of (lat, lon, zone_id)
        """
        params = {
            "scientificName": species_name,
            "hasCoordinate": "true",
            "limit": limit,
            "year": "2020,2025" # Recent years only as requested
        }
        
        try:
            res = requests.get(GBIF_API_URL, params=params, timeout=10.0)
            if res.status_code == 200:
                data = res.json()
                results = data.get("results", [])
                
                points = []
                for r in results:
                    lat = r.get("decimalLatitude")
                    lon = r.get("decimalLongitude")
                    date = r.get("eventDate", "unknown")
                    if lat and lon:
                        points.append((float(lat), float(lon), f"zone_{date}"))
                
                print(f"GBIF: Found {len(points)} occurrences for {species_name}")
                return points
            else:
                print(f"GBIF API Error: {res.status_code}")
            
        except Exception as e:
            print(f"GBIF Error: {e}")
            
        return []

gbif_service = GBIFService()
