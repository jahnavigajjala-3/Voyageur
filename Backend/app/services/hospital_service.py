import pandas as pd
import os
import math

from app.core.logging import get_logger

logger = get_logger(__name__)

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
HOSPITAL_CSV = os.path.join(BASE_DIR, "../../data/processed_hospital_directory.csv")
DISTRICT_CSV = os.path.join(BASE_DIR, "../../data/hospital_district_summary.csv")

try:
    hospital_df = pd.read_csv(HOSPITAL_CSV, dtype=str)
    coords = hospital_df["Location_Coordinates"].str.extract(
        r'([+-]?\d+(?:\.\d+)?),\s*([+-]?\d+(?:\.\d+)?)'
    )
    hospital_df["Latitude"]  = pd.to_numeric(coords[0], errors="coerce")
    hospital_df["Longitude"] = pd.to_numeric(coords[1], errors="coerce")
    hospital_df["Sr_No"]     = pd.to_numeric(hospital_df["Sr_No"], errors="coerce").fillna(0).astype(int)
    logger.info("Loaded %d hospitals", len(hospital_df))
except Exception as e:
    hospital_df = None
    logger.error("Failed to load hospitals: %s", e)

try:
    if os.path.exists(DISTRICT_CSV):
        district_df = pd.read_csv(DISTRICT_CSV)
        logger.info("Loaded %d hospital district summaries", len(district_df))
    else:
        district_df = None
        logger.warning("No hospital district summary file found at %s", DISTRICT_CSV)
except Exception as e:
    district_df = None
    logger.error("Failed to load hospital district summary: %s", e)


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in kilometres between two points."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


def get_nearby_hospitals(lat: float, lng: float, radius_km: float = 30, top_n: int = 5) -> list:
    """Return up to top_n hospitals within radius_km of the given coordinates."""
    if hospital_df is None:
        return []

    df = hospital_df.copy()
    df["distance_km"] = df.apply(
        lambda row: haversine(lat, lng, row["Latitude"], row["Longitude"]), axis=1
    )

    nearby = df[df["distance_km"] <= radius_km].sort_values("distance_km").head(top_n)

    return [
        {
            "id":          int(row["Sr_No"]),
            "city":        row.get("Hospital_Name", row.get("Location", "")),
            "state":       row.get("State", ""),
            "district":    row.get("District", ""),
            "latitude":    row["Latitude"],
            "longitude":   row["Longitude"],
            "rating":      0,
            "reviews":     0,
            "distance_km": round(float(row["distance_km"]), 2) if pd.notna(row["distance_km"]) else None,
        }
        for _, row in nearby.iterrows()
    ]
