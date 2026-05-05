import pandas as pd
import os
import math

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
HOSPITAL_CSV = os.path.join(BASE_DIR, "../../data/processed_hospital_directory.csv")
DISTRICT_CSV = os.path.join(BASE_DIR, "../../data/hospital_district_summary.csv")

try:
    hospital_df = pd.read_csv(HOSPITAL_CSV, dtype=str)
    coords = hospital_df["Location_Coordinates"].str.extract(r'([+-]?\d+(?:\.\d+)?),\s*([+-]?\d+(?:\.\d+)?)')
    hospital_df["Latitude"] = pd.to_numeric(coords[0], errors="coerce")
    hospital_df["Longitude"] = pd.to_numeric(coords[1], errors="coerce")
    hospital_df["Sr_No"] = pd.to_numeric(hospital_df["Sr_No"], errors="coerce").fillna(0).astype(int)
    print(f"[HOSPITAL SERVICE] Loaded {len(hospital_df)} hospitals")
except Exception as e:
    hospital_df = None
    print(f"[HOSPITAL SERVICE] Failed to load hospitals: {e}")

try:
    if os.path.exists(DISTRICT_CSV):
        district_df = pd.read_csv(DISTRICT_CSV)
        print(f"[HOSPITAL SERVICE] Loaded {len(district_df)} district summaries")
    else:
        district_df = None
        print("[HOSPITAL SERVICE] No hospital district summary file found")
except Exception as e:
    district_df = None
    print(f"[HOSPITAL SERVICE] Failed to load district summary: {e}")


def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat/2)**2 +
         math.cos(math.radians(lat1)) *
         math.cos(math.radians(lat2)) *
         math.sin(dlon/2)**2)
    return R * 2 * math.asin(math.sqrt(a))


def get_nearby_hospitals(lat: float, lng: float, radius_km: float = 30, top_n: int = 5) -> list:
    if hospital_df is None:
        return []

    df = hospital_df.copy()
    df['distance_km'] = df.apply(
        lambda row: haversine(lat, lng, row['Latitude'], row['Longitude']),
        axis=1
    )

    nearby = df[df['distance_km'] <= radius_km].copy()
    nearby = nearby.sort_values(by=['distance_km']).head(top_n)

    result = []
    for _, row in nearby.iterrows():
        result.append({
            "id":          int(row['Sr_No']),
            "city":        row.get('Hospital_Name', row.get('Location', '')),
            "state":       row.get('State', ''),
            "district":    row.get('District', ''),
            "latitude":    row['Latitude'],
            "longitude":   row['Longitude'],
            "rating":      0,
            "reviews":     0,
            "distance_km": round(float(row['distance_km']), 2) if pd.notna(row['distance_km']) else None
        })

    return result



