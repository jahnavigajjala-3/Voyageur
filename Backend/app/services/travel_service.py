import pandas as pd
import os
import httpx

# Load CSV once when server starts
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "../../data/processed_crime_data.csv")

try:
    crime_df = pd.read_csv(CSV_PATH)
    crime_df['STATE']    = crime_df['STATE'].str.title().str.strip()
    crime_df['DISTRICT'] = crime_df['DISTRICT'].str.title().str.strip()
    print(f"[TRAVEL SERVICE] Crime data loaded: {len(crime_df)} districts")
except Exception as e:
    crime_df = None
    print(f"[TRAVEL SERVICE] Failed to load crime data: {e}")


async def reverse_geocode(lat: float, lng: float) -> dict:
    """Convert lat/lng to state and district using Nominatim."""
    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {
            "lat": lat,
            "lon": lng,
            "format": "json",
            "addressdetails": 1
        }
        headers = {"User-Agent": "AmigoTravelApp/1.0"}

        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, headers=headers, timeout=10)
            data = response.json()

        address = data.get("address", {})

        district = (
            address.get("county") or
            address.get("state_district") or
            address.get("city") or
            address.get("town") or
            address.get("village") or
            ""
        ).strip()

        state = address.get("state", "").strip()

        # Clean common suffixes
        for suffix in [" District", " Taluk", " Division"]:
            district = district.replace(suffix, "").strip()

        return {"district": district.title(), "state": state.title()}

    except Exception as e:
        print(f"[GEOCODE ERROR] {e}")
        return {"district": "", "state": ""}


def lookup_crime(district: str, state: str) -> dict:
    """Look up crime risk from CSV by district, fallback to state average."""
    if crime_df is None:
        return {"error": "Crime data not loaded"}

    # Try exact district match first
    match = crime_df[crime_df['DISTRICT'].str.lower() == district.lower()]

    # Fallback: match by state average
    if match.empty and state:
        match = crime_df[crime_df['STATE'].str.lower() == state.lower()]
        if not match.empty:
            avg_score = match['RISK_SCORE'].mean()
            risk_level = match['RISK_LEVEL'].mode()[0] if not match.empty else "UNKNOWN"
            return {
                "district": f"{state} (state average)",
                "state": state,
                "risk_score": round(avg_score, 2),
                "risk_level": risk_level,
                "source": "state_average"
            }

    if match.empty:
        return {"error": f"No data found for {district}, {state}"}

    row = match.iloc[0]
    return {
        "district": row['DISTRICT'],
        "state": row['STATE'],
        "risk_score": round(row['RISK_SCORE'], 2),
        "risk_level": row['RISK_LEVEL'],
        "marker_color": row['MARKER_COLOR'],
        "source": "exact_match"
    }


async def get_crime_risk_by_coords(lat: float, lng: float) -> dict:
    """Main function: takes GPS coords, returns crime risk."""
    location = await reverse_geocode(lat, lng)

    district = location.get("district", "")
    state    = location.get("state", "")

    print(f"[TRAVEL SERVICE] Geocoded → District: {district}, State: {state}")

    crime_data = lookup_crime(district, state)
    crime_data["detected_district"] = district
    crime_data["detected_state"]    = state

    return crime_data


async def get_crime_risk(state: str) -> dict:
    """Legacy function: look up by state name (used by ai_service.py)."""
    if crime_df is None:
        return {"error": "Crime data not loaded"}

    match = crime_df[crime_df['STATE'].str.lower() == state.lower()]

    if match.empty:
        return {"error": f"No data for {state}", "risk": "UNKNOWN", "total_crime": 0}

    avg_score  = match['RISK_SCORE'].mean()
    risk_level = match['RISK_LEVEL'].mode()[0]

    return {
        "state": state,
        "risk": risk_level,
        "risk_score": round(avg_score, 2),
        "total_crime": int(match['RISK_SCORE'].sum())
    }


def get_all_district_risks() -> list:
    """Return all districts with risk data for map overlay."""
    if crime_df is None:
        return []

    return crime_df[['STATE', 'DISTRICT', 'RISK_LEVEL', 'RISK_SCORE', 'MARKER_COLOR']]\
        .dropna()\
        .to_dict(orient="records")