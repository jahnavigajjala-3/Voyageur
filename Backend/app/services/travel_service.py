import pandas as pd
import os
import json
import httpx
import asyncio

# Telangana districts that were part of Andhra Pradesh in the dataset
TELANGANA_DISTRICTS = [
    "Adilabad", "Hyderabad City", "Karimnagar", "Khammam",
    "Mahaboobnagar", "Medak", "Nalgonda", "Nizamabad", "Warangal"
]

# Load CSV once when server starts
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "../../data/processed_crime_data.csv")
DISTRICT_CENTROIDS_PATH = os.path.join(BASE_DIR, "../../data/district_centroids.json")


def load_district_centroids(path: str) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as file:
            centroids = json.load(file)
        print(f"[TRAVEL SERVICE] Loaded {len(centroids)} district centroids")
        return centroids
    except Exception as e:
        print(f"[TRAVEL SERVICE] Failed to load district centroids: {e}")
        return {}

DISTRICT_CENTROIDS = load_district_centroids(DISTRICT_CENTROIDS_PATH)

try:
    crime_df = pd.read_csv(CSV_PATH)
    crime_df['STATE']    = crime_df['STATE'].str.title().str.strip()
    crime_df['DISTRICT'] = crime_df['DISTRICT'].str.title().str.strip()
    print(f"[TRAVEL SERVICE] Crime data loaded: {len(crime_df)} districts")
except Exception as e:
    crime_df = None
    print(f"[TRAVEL SERVICE] Failed to load crime data: {e}")


def get_state_from_district(district: str) -> str:
    """
    Returns the correct state for a district, handling the Telangana/Andhra Pradesh split.
    For districts in Telangana, returns 'Telangana'.
    For other districts, returns the state from the crime dataset.
    """
    if not district or crime_df is None:
        return ""
    
    district_clean = district.strip().title()
    
    # Check if district is in Telangana list (case-insensitive)
    for telangana_district in TELANGANA_DISTRICTS:
        if telangana_district.lower() == district_clean.lower():
            return "Telangana"
    
    # For non-Telangana districts, find the state in the dataset
    district_matches = crime_df[crime_df['DISTRICT'].str.strip().str.lower() == district_clean.lower()]
    if not district_matches.empty:
        return district_matches.iloc[0]['STATE'].strip().title()
    
    # Fallback to Andhra Pradesh for unknown districts (maintains backward compatibility)
    return "Andhra Pradesh"


def get_crime_data_by_state(state: str, df):
    """
    If state == 'Telangana':
        return rows where DISTRICT is in TELANGANA_DISTRICTS
    If state == 'Andhra Pradesh':
        return rows where DISTRICT is NOT in TELANGANA_DISTRICTS
    """
    if df is None or df.empty:
        return pd.DataFrame()
    
    state_clean = state.strip().title()
    
    if state_clean == "Telangana":
        # Filter for Telangana districts
        telangana_mask = df['DISTRICT'].str.strip().str.title().isin(
            [d.title() for d in TELANGANA_DISTRICTS]
        )
        return df[telangana_mask]
    elif state_clean == "Andhra Pradesh":
        # Filter out Telangana districts
        telangana_mask = df['DISTRICT'].str.strip().str.title().isin(
            [d.title() for d in TELANGANA_DISTRICTS]
        )
        return df[~telangana_mask]
    else:
        # For other states, return as-is
        return df[df['STATE'].str.strip().str.title() == state_clean]


def clean_district_name(district: str) -> str:
    """
    Clean district names by removing common suffixes and standardizing.
    Examples: "Hyderabad City" → "Hyderabad", "Bangalore Commr." → "Bangalore"
    """
    if not district:
        return district
    
    district_clean = district.strip().title()
    
    # Remove common suffixes
    suffixes_to_remove = [
        " City", " Commr.", " District", " Rural", " Urban",
        " Corporation", " Municipality", " Taluk", " Division"
    ]
    
    for suffix in suffixes_to_remove:
        if district_clean.endswith(suffix):
            district_clean = district_clean[:-len(suffix)].strip()
    
    return district_clean


async def reverse_geocode(lat: float, lng: float) -> dict:
    """Convert lat/lng to state and district using Nominatim with retry logic and coordinate fallback."""
    max_retries = 2
    retry_delay = 0.5
    
    for attempt in range(max_retries):
        try:
            url = "https://nominatim.openstreetmap.org/reverse"
            params = {
                "lat": lat,
                "lon": lng,
                "format": "json",
                "addressdetails": 1,
                "zoom": 10
            }
            headers = {"User-Agent": "AmigoTravelApp/1.0"}

            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url, params=params, headers=headers)
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        address = data.get("address", {})
                        
                        district = (
                            address.get("county") or
                            address.get("state_district") or
                            address.get("district") or
                            address.get("city") or
                            address.get("town") or
                            address.get("village") or
                            ""
                        ).strip()

                        state = address.get("state", "").strip()

                        if district and state:
                            # Clean common suffixes
                            for suffix in [" District", " Taluk", " Division"]:
                                district = district.replace(suffix, "").strip()

                            print(f"[REVERSE GEOCODE] Nominatim success → District: {district}, State: {state}")
                            return {"district": district.title(), "state": state.title()}
                    except Exception as parse_err:
                        print(f"[REVERSE GEOCODE] JSON parse error on attempt {attempt + 1}: {parse_err}")
                        
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay)
        except Exception as e:
            print(f"[REVERSE GEOCODE] Request error on attempt {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay)
    
    # Fallback: Use coordinate-based lookup for known districts
    print(f"[REVERSE GEOCODE] Nominatim failed, using coordinate-based fallback for {lat}, {lng}")
    return find_district_by_coordinates(lat, lng)


def find_district_by_coordinates(lat: float, lng: float) -> dict:
    """Find nearest district using coordinate distance calculation."""
    if crime_df is None:
        return {"district": "", "state": ""}
    
    min_distance = float('inf')
    nearest_district = None
    nearest_state = None
    nearest_csv_district = None
    
    # Get all districts that exist in the crime dataset
    crime_districts = set(crime_df['DISTRICT'].str.strip().str.title().unique())
    
    for city, centroid in DISTRICT_CENTROIDS.items():
        city_lat = centroid.get("lat")
        city_lng = centroid.get("lng")
        state = centroid.get("state", "")
        csv_district = centroid.get("csv_district", city)

        if city_lat is None or city_lng is None:
            continue

        # Only consider districts that exist in the crime dataset
        if csv_district.title() not in crime_districts:
            continue
            
        # Calculate simple distance
        distance = ((lat - city_lat) ** 2 + (lng - city_lng) ** 2) ** 0.5
        if distance < min_distance:
            min_distance = distance
            nearest_district = city
            nearest_state = state
            nearest_csv_district = csv_district
    
    if nearest_district and min_distance < 2.0:  # Within ~200km (increased from 1.0)
        print(f"[REVERSE GEOCODE] Using fallback: {nearest_district}, {nearest_state} (distance: {min_distance:.2f})")
        return {"district": nearest_csv_district, "state": nearest_state}
    
    print(f"[REVERSE GEOCODE] Could not determine location (closest match {min_distance:.2f} degrees away)")
    return {"district": "", "state": ""}


def lookup_crime(district: str, state: str) -> dict:
    """Look up crime risk from CSV by district."""
    if crime_df is None:
        return {"error": "Crime data not loaded"}

    if not district:
        return {"error": "District not detected"}

    # Clean input
    district_clean = clean_district_name(district.strip().title())
    
    # For Telangana/Andhra Pradesh split, determine the correct state based on district
    if state and state.strip().title() in ["Andhra Pradesh", "Telangana"]:
        actual_state = get_state_from_district(district_clean)
    else:
        actual_state = state.strip().title() if state else ""
    
    # Try exact match first with cleaned district name
    district_mask = crime_df['DISTRICT'].str.strip().str.lower() == district_clean.lower()
    match = crime_df[district_mask]
    
    # If no exact match, try with original district name
    if match.empty:
        district_mask = crime_df['DISTRICT'].str.strip().str.lower() == district.strip().title().lower()
        match = crime_df[district_mask]
    
    # If still no match, try partial matching
    if match.empty:
        input_lower = district_clean.lower()
        best_match = None
        best_score = 0
        
        for _, row in crime_df.iterrows():
            csv_district = clean_district_name(row['DISTRICT'].strip()).lower()
            # Check if input is contained in CSV district name or vice versa
            if input_lower in csv_district or csv_district in input_lower:
                # Prefer longer matches (more specific)
                score = max(len(input_lower), len(csv_district))
                if score > best_score:
                    best_score = score
                    best_match = row['DISTRICT']
        
        if best_match:
            match = crime_df[crime_df['DISTRICT'].str.strip().str.lower() == best_match.lower()]

    if match.empty:
        return {"error": f"District '{district}' not found in dataset"}

    row = match.iloc[0]
    
    # Determine the display state (handle Telangana split)
    display_state = get_state_from_district(row['DISTRICT'])
    
    return {
        "district": row['DISTRICT'],
        "state": display_state,
        "risk_score": round(row['RISK_SCORE'], 2),
        "risk_level": row['RISK_LEVEL'],
        "marker_color": row['MARKER_COLOR'],
        "source": "district_match"
    }


async def get_crime_risk_by_coords(lat: float, lng: float) -> dict:
    """Main function: takes GPS coords, returns crime risk."""
    location = await reverse_geocode(lat, lng)

    district = location.get("district", "")
    state    = location.get("state", "")

    print(f"[TRAVEL SERVICE] Detected → District: '{district}', State: '{state}'")

    if not district or not state:
        return {
            "error": "Could not detect location. Nominatim API may be rate-limited.",
            "detected_district": district,
            "detected_state": state
        }

    crime_data = lookup_crime(district, state)
    
    # If district lookup failed, try coordinate-based fallback to find nearest district
    if "error" in crime_data:
        print(f"[TRAVEL SERVICE] District '{district}' not found, using coordinate fallback")
        fallback_location = find_district_by_coordinates(lat, lng)
        fallback_district = fallback_location.get("district", "")
        fallback_state = fallback_location.get("state", "")
        
        if fallback_district and fallback_state:
            print(f"[TRAVEL SERVICE] Using nearest district: '{fallback_district}', State: '{fallback_state}'")
            crime_data = lookup_crime(fallback_district, fallback_state)
            if "error" not in crime_data:
                crime_data["note"] = f"Using data for nearest district '{fallback_district}' (original district '{district}' not found)"
                crime_data["original_district"] = district
                crime_data["original_state"] = state
        else:
            crime_data["note"] = f"Could not find crime data for '{district}' or any nearby districts"
    
    crime_data["detected_district"] = district
    crime_data["detected_state"]    = state

    return crime_data


async def get_crime_risk(state: str) -> dict:
    """Legacy function: look up by state name (used by ai_service.py)."""
    if crime_df is None:
        return {"error": "Crime data not loaded"}

    # Use the new function to properly handle Telangana/Andhra Pradesh split
    match = get_crime_data_by_state(state, crime_df)

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


async def get_districts_in_state(lat: float, lng: float) -> list:
    """Get all districts in the state of the given coordinates."""
    if crime_df is None:
        return []
    
    # Detect which state the coordinates are in
    location = await reverse_geocode(lat, lng)
    state = location.get("state", "")
    
    if not state:
        return []
    
    print(f"[TRAVEL SERVICE] Fetching all districts in state: {state}")
    
    # Use the new function to properly handle Telangana/Andhra Pradesh split
    state_districts = get_crime_data_by_state(state, crime_df)
    
    if state_districts.empty:
        return []
    
    # Group by district and get the latest/mean values
    districts_grouped = state_districts.groupby('DISTRICT').agg({
        'RISK_SCORE': 'mean',
        'RISK_LEVEL': lambda x: x.mode()[0] if not x.mode().empty else 'UNKNOWN',
        'MARKER_COLOR': 'first',
        'STATE': 'first'
    }).reset_index()
    
    result = []
    for _, row in districts_grouped.iterrows():
        # For display purposes, show correct state for Telangana districts
        display_state = get_state_from_district(row['DISTRICT'])
        result.append({
            'district': row['DISTRICT'],
            'state': display_state,
            'risk_score': round(row['RISK_SCORE'], 2),
            'risk_level': row['RISK_LEVEL'],
            'marker_color': row['MARKER_COLOR']
        })
    
    return sorted(result, key=lambda x: x['risk_score'], reverse=True)