import pandas as pd
import os
import math

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
HOSPITAL_CSV = os.path.join(BASE_DIR, "../../data/processed_hospitals.csv")
DISTRICT_CSV = os.path.join(BASE_DIR, "../../data/hospital_district_summary.csv")

try:
    hospital_df = pd.read_csv(HOSPITAL_CSV)
    print(f"[HOSPITAL SERVICE] Loaded {len(hospital_df)} hospitals")
except Exception as e:
    hospital_df = None
    print(f"[HOSPITAL SERVICE] Failed to load hospitals: {e}")

try:
    district_df = pd.read_csv(DISTRICT_CSV)
    print(f"[HOSPITAL SERVICE] Loaded {len(district_df)} district summaries")
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


def get_nearby_hospitals(lat: float, lng: float, radius_km: float = 10, top_n: int = 5) -> list:
    if hospital_df is None:
        return []

    df = hospital_df.copy()
    df['distance_km'] = df.apply(
        lambda row: haversine(lat, lng, row['Latitude'], row['Longitude']),
        axis=1
    )

    nearby = df[df['distance_km'] <= radius_km].copy()
    nearby = nearby.sort_values(
        by=['Rating', 'distance_km'],
        ascending=[False, True]
    ).head(top_n)

    result = []
    for _, row in nearby.iterrows():
        result.append({
            "id":          row['id'],
            "city":        row['City'],
            "state":       row['State'],
            "district":    row['District'],
            "latitude":    row['Latitude'],
            "longitude":   row['Longitude'],
            "rating":      row['Rating'],
            "reviews":     int(row['Number of Reviews']),
            "distance_km": round(row['distance_km'], 2)
        })

    return result


def get_district_hospital_summary(district: str, state: str) -> dict:
    if district_df is None:
        return {"error": "Hospital district data not loaded"}

    match = district_df[
        district_df['District'].str.lower() == district.lower()
    ]

    if match.empty and state:
        match = district_df[
            district_df['State'].str.lower() == state.lower()
        ]

    if match.empty:
        return {"error": f"No hospital data for {district}"}

    row = match.iloc[0]
    return {
        "district":          row['District'],
        "state":             row['State'],
        "total_hospitals":   int(row['total_hospitals']),
        "avg_rating":        row['avg_rating'],
        "best_hospital_city": row['best_hospital_city'],
        "best_rating":       row['best_rating']
    }