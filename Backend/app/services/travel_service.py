import pandas as pd
import os
import json
import httpx
import asyncio
from typing import Optional, List, Any, Dict
from dataclasses import dataclass

# Telangana districts that were part of Andhra Pradesh in the dataset
TELANGANA_DISTRICTS = [
    "Adilabad", "Hyderabad City", "Karimnagar", "Khammam",
    "Mahaboobnagar", "Medak", "Nalgonda", "Nizamabad", "Warangal"
]

# Load CSV once when server starts
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "../../data/processed_crime_data.csv")
DISTRICT_CENTROIDS_PATH = os.path.join(BASE_DIR, "../../data/district_centroids.json")

# Safety Data Index for spatial queries
SAFETY_INDEX_AVAILABLE = False
try:
    # Try relative import first
    from .safety_data_index import get_safety_data_index
    SAFETY_INDEX_AVAILABLE = True
except ImportError:
    try:
        # Try absolute import
        from safety_data_index import get_safety_data_index
        SAFETY_INDEX_AVAILABLE = True
    except ImportError as e:
        SAFETY_INDEX_AVAILABLE = False
        print(f"[TRAVEL SERVICE] Warning: safety_data_index module not available: {e}")


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
    
    # Calculate min/max for normalization
    RISK_SCORE_MIN = crime_df['RISK_SCORE'].min()
    RISK_SCORE_MAX = crime_df['RISK_SCORE'].max()
    
    print(f"[TRAVEL SERVICE] Crime data loaded: {len(crime_df)} districts")
    print(f"[TRAVEL SERVICE] Risk score range: {RISK_SCORE_MIN:.2f} - {RISK_SCORE_MAX:.2f}")
    
    # Build safety data index if available
    if SAFETY_INDEX_AVAILABLE:
        safety_index = get_safety_data_index(crime_df)
        stats = safety_index.get_stats()
        print(f"[TRAVEL SERVICE] Safety data index built: {stats}")
except Exception as e:
    crime_df = None
    RISK_SCORE_MIN = 0
    RISK_SCORE_MAX = 1000
    print(f"[TRAVEL SERVICE] Failed to load crime data: {e}")


def normalize_risk_score(score: float) -> float:
    """Normalize risk score to 1-10 scale (10 = lowest risk/safest, 1 = highest risk/most dangerous)."""
    if RISK_SCORE_MAX == RISK_SCORE_MIN:
        return 5.0  # Default if all scores are the same
    normalized = 1 + 9 * (score - RISK_SCORE_MIN) / (RISK_SCORE_MAX - RISK_SCORE_MIN)
    return round(11 - normalized, 1)  # Invert so 10 = safest, 1 = most dangerous


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
        "normalized_score": normalize_risk_score(row['RISK_SCORE']),
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
        "normalized_score": normalize_risk_score(avg_score),
        "total_crime": int(match['RISK_SCORE'].sum())
    }


def get_all_district_risks() -> list:
    """Return all districts with risk data for map overlay."""
    if crime_df is None:
        return []

    return crime_df[['STATE', 'DISTRICT', 'RISK_LEVEL', 'RISK_SCORE', 'MARKER_COLOR']]\
        .dropna()\
        .assign(normalized_score=lambda df: df['RISK_SCORE'].apply(normalize_risk_score))\
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
            'normalized_score': normalize_risk_score(row['RISK_SCORE']),
            'risk_level': row['RISK_LEVEL'],
            'marker_color': row['MARKER_COLOR']
        })
    
    return sorted(result, key=lambda x: x['risk_score'], reverse=True)


# ============================================================================
# New functions for spatial safety data queries using SafetyDataIndex
# ============================================================================

def get_safety_index() -> Optional[Any]:
    """Get the safety data index instance if available"""
    if not SAFETY_INDEX_AVAILABLE or crime_df is None:
        return None
    
    try:
        return get_safety_data_index(crime_df)
    except Exception as e:
        print(f"[TRAVEL SERVICE] Failed to get safety index: {e}")
        return None


async def find_nearest_safety_data(lat: float, lng: float, max_distance_km: float = 50.0) -> Optional[dict]:
    """
    Find nearest safety data point using spatial index.
    
    Args:
        lat: Latitude
        lng: Longitude
        max_distance_km: Maximum search distance in kilometers
        
    Returns:
        Dictionary with safety data if found, None otherwise
    """
    safety_index = get_safety_index()
    if safety_index is None:
        return None
    
    try:
        point, distance = safety_index.find_nearest_with_distance(lat, lng, max_distance_km)
        
        if point:
            return {
                "district": point.district,
                "state": point.state,
                "lat": point.lat,
                "lng": point.lng,
                "risk_score": point.risk_score,
                "normalized_score": point.normalized_score,
                "risk_level": point.risk_level,
                "marker_color": point.marker_color,
                "distance_km": round(distance, 2),
                "source": "spatial_index"
            }
    except Exception as e:
        print(f"[TRAVEL SERVICE] Error finding nearest safety data: {e}")
    
    return None


async def find_all_safety_data_within(lat: float, lng: float, radius_km: float = 50.0) -> List[dict]:
    """
    Find all safety data points within a given radius.
    
    Args:
        lat: Latitude
        lng: Longitude
        radius_km: Search radius in kilometers
        
    Returns:
        List of safety data points within radius
    """
    safety_index = get_safety_index()
    if safety_index is None:
        return []
    
    try:
        results = safety_index.find_all_within(lat, lng, radius_km)
        
        formatted_results = []
        for point, distance in results:
            formatted_results.append({
                "district": point.district,
                "state": point.state,
                "lat": point.lat,
                "lng": point.lng,
                "risk_score": point.risk_score,
                "normalized_score": point.normalized_score,
                "risk_level": point.risk_level,
                "marker_color": point.marker_color,
                "distance_km": round(distance, 2)
            })
        
        return formatted_results
    except Exception as e:
        print(f"[TRAVEL SERVICE] Error finding safety data within radius: {e}")
        return []


async def get_safety_data_for_coordinates(lat: float, lng: float) -> dict:
    """
    Get safety data for coordinates using spatial index as primary method,
    with fallback to traditional district lookup.
    
    This is the recommended function for route scoring.
    """
    # First try spatial index lookup
    spatial_result = await find_nearest_safety_data(lat, lng)
    
    if spatial_result:
        return {
            **spatial_result,
            "detected_district": spatial_result["district"],
            "detected_state": spatial_result["state"],
            "method": "spatial_index"
        }
    
    # Fallback to traditional district-based lookup
    print(f"[TRAVEL SERVICE] Spatial index found no data for ({lat}, {lng}), falling back to district lookup")
    return await get_crime_risk_by_coords(lat, lng)


def get_safety_index_stats() -> dict:
    """Get statistics about the safety data index"""
    safety_index = get_safety_index()
    if safety_index is None:
        return {"available": False, "error": "Safety index not available"}
    
    try:
        stats = safety_index.get_stats()
        return {
            "available": True,
            **stats
        }
    except Exception as e:
        return {"available": False, "error": str(e)}
# ============================================================================
# Multi-Route Generation Functions for OSRM Integration
# ============================================================================

@dataclass
class RouteAlternative:
    """Represents a route alternative from OSRM"""
    geometry: dict  # GeoJSON geometry
    distance: float  # meters
    duration: float  # seconds
    polyline: List[List[float]]  # List of [lng, lat] coordinates
    is_fastest: bool = False  # Whether this is the fastest route
    steps: List[dict] = None  # OSRM step objects

    def __post_init__(self):
        if self.steps is None:
            self.steps = []

    def to_dict(self) -> dict:
        """Convert to dictionary for API response"""
        return {
            "geometry": self.geometry,
            "distance": self.distance,
            "duration": self.duration,
            "polyline": self.polyline,
            "is_fastest": self.is_fastest,
            "steps": self.steps,
        }


async def _fetch_osrm_route(
    origin_lng: float, origin_lat: float,
    dest_lng: float, dest_lat: float,
    via_lng: float = None, via_lat: float = None,
    timeout: float = 10.0
) -> Optional["RouteAlternative"]:
    """Fetch a single OSRM route, optionally via a waypoint."""
    if via_lng is not None and via_lat is not None:
        coords = f"{origin_lng},{origin_lat};{via_lng},{via_lat};{dest_lng},{dest_lat}"
    else:
        coords = f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"

    url = f"https://router.project-osrm.org/route/v1/driving/{coords}"
    params = {"overview": "full", "geometries": "geojson", "steps": "true"}

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url, params=params)
            if response.status_code != 200:
                return None
            data = response.json()
            if data.get("code") != "Ok":
                return None
            routes_data = data.get("routes", [])
            if not routes_data:
                return None
            route_data = routes_data[0]
            geometry = route_data.get("geometry", {})
            coordinates = geometry.get("coordinates", [])
            polyline = [[float(c[0]), float(c[1])] for c in coordinates if len(c) >= 2]
            return RouteAlternative(
                geometry=geometry,
                distance=float(route_data.get("distance", 0)),
                duration=float(route_data.get("duration", 0)),
                polyline=polyline,
                is_fastest=False,
            )
    except Exception as e:
        print(f"[TRAVEL SERVICE] OSRM fetch error: {e}")
        return None


async def get_multiple_routes(
    origin_lat: float, 
    origin_lng: float,
    dest_lat: float, 
    dest_lng: float,
    alternatives: int = 3,
    timeout: float = 10.0
) -> List[RouteAlternative]:
    """
    Get exactly 2 route alternatives from OSRM:
      - Route 0: OSRM's fastest (direct)
      - Route 1: OSRM alternative (if available) OR a via-point detour
    Both routes include full step data.
    """
    print(f"[TRAVEL SERVICE] Requesting 2 route alternatives from OSRM")
    print(f"  Origin: ({origin_lat}, {origin_lng})")
    print(f"  Destination: ({dest_lat}, {dest_lng})")

    routes: List[RouteAlternative] = []

    # ── Request OSRM with alternatives=true ──────────────────────────────
    coords = f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
    url = f"https://router.project-osrm.org/route/v1/driving/{coords}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "true",
        "alternatives": "true",
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                if data.get("code") == "Ok":
                    for i, route_data in enumerate(data.get("routes", [])):
                        if len(routes) >= 2:
                            break
                        geometry = route_data.get("geometry", {})
                        coordinates = geometry.get("coordinates", [])
                        polyline = [[float(c[0]), float(c[1])] for c in coordinates if len(c) >= 2]
                        # Extract steps from legs
                        steps = []
                        for leg in route_data.get("legs", []):
                            for step in leg.get("steps", []):
                                steps.append(step)
                        route = RouteAlternative(
                            geometry=geometry,
                            distance=float(route_data.get("distance", 0)),
                            duration=float(route_data.get("duration", 0)),
                            polyline=polyline,
                            is_fastest=(i == 0),
                        )
                        route.steps = steps  # attach steps directly
                        routes.append(route)
    except Exception as e:
        print(f"[TRAVEL SERVICE] OSRM alternatives request failed: {e}")

    if not routes:
        raise ValueError("No routes returned from OSRM")

    # ── If only 1 route, generate a via-point alternative ────────────────
    if len(routes) < 2:
        mid_lat = (origin_lat + dest_lat) / 2
        mid_lng = (origin_lng + dest_lng) / 2
        dlat = dest_lat - origin_lat
        dlng = dest_lng - origin_lng
        length = (dlat ** 2 + dlng ** 2) ** 0.5

        if length > 0:
            perp_lat = -dlng / length
            perp_lng =  dlat / length
            for offset in [0.045, -0.045, 0.09, -0.09]:
                via_lat = mid_lat + perp_lat * offset
                via_lng = mid_lng + perp_lng * offset
                via_route = await _fetch_osrm_route(
                    origin_lng, origin_lat,
                    dest_lng, dest_lat,
                    via_lng=via_lng, via_lat=via_lat,
                    timeout=timeout,
                )
                if via_route:
                    is_dup = abs(routes[0].distance - via_route.distance) / max(routes[0].distance, 1) < 0.05
                    if not is_dup:
                        via_route.steps = []  # no steps for via-point routes
                        routes.append(via_route)
                        break

    # Mark fastest
    if routes:
        fastest = min(routes, key=lambda r: r.duration)
        for r in routes:
            r.is_fastest = (r is fastest)

    # Cap at 2
    routes = routes[:2]

    print(f"[TRAVEL SERVICE] Retrieved {len(routes)} route alternatives")
    for i, route in enumerate(routes):
        print(f"  Route {i+1}: {route.distance:.0f}m, {route.duration:.0f}s, fastest: {route.is_fastest}")

    return routes


async def get_single_route(
    origin_lat: float, 
    origin_lng: float,
    dest_lat: float, 
    dest_lng: float,
    timeout: float = 10.0
) -> Optional[RouteAlternative]:
    """
    Get a single route from OSRM (preserves existing functionality).
    
    This function maintains backward compatibility with existing code
    that expects single-route functionality.
    
    Args:
        origin_lat: Origin latitude
        origin_lng: Origin longitude
        dest_lat: Destination latitude
        dest_lng: Destination longitude
        timeout: Request timeout in seconds
        
    Returns:
        Single RouteAlternative or None if no route found
    """
    try:
        routes = await get_multiple_routes(
            origin_lat, origin_lng,
            dest_lat, dest_lng,
            alternatives=1,
            timeout=timeout
        )
        
        if routes:
            return routes[0]
        return None
        
    except Exception as e:
        print(f"[TRAVEL SERVICE] Failed to get single route: {e}")
        return None