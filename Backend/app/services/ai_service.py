"""
AI Service — Amigo travel companion powered by Gemini.

Context pipeline (request → Gemini):
  1. Location context  — current lat/lng + live crime risk at that point
  2. Nearby POIs       — hospitals, pharmacies, hotels, restaurants (OpenStreetMap / Overpass)
  3. Destination context — city mentioned in the message + crime risk (Indian city dictionary)
  4. Trip context      — destination, dates, notes from the DB trip record
  5. Route context     — planned_route summary (distance, duration, waypoints)
  6. Safety context    — route safety score + risk level from scoring service
  7. Prompt assembly   — all blocks merged into a clean system instruction
"""

from google import genai
from google.genai import types
import math
import os
import re
import json
import asyncio
from typing import Dict, List, Optional
from dotenv import load_dotenv
import httpx

from app.core.logging import get_logger
from app.services.travel_service import get_crime_risk_by_coords
from app.services.route_scoring_service import get_route_scoring_service, Coordinate

load_dotenv()

logger = get_logger(__name__)
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """
You are Voyageur AI, a real-time travel safety companion for India. Your name is Voyageur AI — always refer to yourself as Voyageur AI.

Rules:
- The user's current location and crime risk data are provided in the CONTEXT section below — use them as background knowledge only
- NEVER proactively announce the crime risk score or safety score of the user's current location unless they explicitly ask about it
- Only mention location risk if the user asks "is it safe here?", "what's the risk?", or similar direct questions
- If DESTINATION SAFETY data is provided in context, use it to answer questions about that city's safety
- Always use the safety data provided in context — never guess or invent numbers
- Be concise, friendly, and helpful
- If a planned route is present, focus on route safety feedback — mention high-risk segments along the route if relevant
- Suggest safer alternatives when the route passes through high-risk districts
- If no location context is available, say so briefly and continue helping
- When the user asks for nearby hospitals, hotels, restaurants, or pharmacies/medical stores,
  use ONLY the NEARBY PLACES (OSM) list in CONTEXT if present — do not invent names or addresses.
  Note that listings may be incomplete; suggest verification in maps apps when appropriate
- When CONTEXT includes a block titled "Trip planner session" (or similar trip details from the app),
  behave as an expert trip guide for India: use that block to tailor advice on transport, stays,
  pacing, neighborhoods, food, and day-by-day flow. Prefer concrete, actionable suggestions
  (numbered or short bullets). If the user is vague ("suggest something", "help me plan"),
  offer 2–4 specific ideas that match their budget, duration, and trip style from context.
  Do not contradict explicit itinerary or booking hints already in context unless the user asks for alternatives.
"""

WORKING_MODEL = None

# ---------------------------------------------------------------------------
# Indian city → approximate coordinates for geocoding fallback
# ---------------------------------------------------------------------------
INDIA_CITY_COORDS = {
    "mumbai": (19.0760, 72.8777),
    "delhi": (28.6139, 77.2090),
    "bangalore": (12.9716, 77.5946),
    "bengaluru": (12.9716, 77.5946),
    "hyderabad": (17.3850, 78.4867),
    "chennai": (13.0827, 80.2707),
    "kolkata": (22.5726, 88.3639),
    "pune": (18.5204, 73.8567),
    "ahmedabad": (23.0225, 72.5714),
    "jaipur": (26.9124, 75.7873),
    "surat": (21.1702, 72.8311),
    "lucknow": (26.8467, 80.9462),
    "kanpur": (26.4499, 80.3319),
    "nagpur": (21.1458, 79.0882),
    "indore": (22.7196, 75.8577),
    "bhopal": (23.2599, 77.4126),
    "patna": (25.5941, 85.1376),
    "vadodara": (22.3072, 73.1812),
    "goa": (15.2993, 74.1240),
    "kochi": (9.9312, 76.2673),
    "coimbatore": (11.0168, 76.9558),
    "visakhapatnam": (17.6868, 83.2185),
    "agra": (27.1767, 78.0081),
    "varanasi": (25.3176, 82.9739),
    "amritsar": (31.6340, 74.8723),
    "chandigarh": (30.7333, 76.7794),
}


def extract_mentioned_city(message: str) -> Optional[tuple]:
    """
    Check if the user's message mentions a known Indian city.
    Returns (lat, lng, city_name) or None.
    """
    msg_lower = message.lower()
    for city, coords in INDIA_CITY_COORDS.items():
        if city in msg_lower:
            return coords[0], coords[1], city.title()
    return None


# ===========================================================================
# Gemini call with model fallback
# ===========================================================================

def generate_with_fallback(client, contents, config):
    global WORKING_MODEL

    models = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-flash-latest",
    ]

    for m in models:
        try:
            response = client.models.generate_content(
                model=m,
                contents=contents,
                config=config,
            )
            WORKING_MODEL = m
            logger.info("AI using model: %s", m)
            if not response:
                raise Exception("Empty response from Gemini")
            return response
        except Exception as e:
            logger.warning("AI model %s failed: %s", m, e)

    raise Exception("All Gemini models failed")


# ===========================================================================
# Context builders — each returns a plain string block or empty string
# ===========================================================================

def extract_coords_from_context(trip_context: str):
    """Parse lat/lng from trip_context string e.g. 'lat=12.34, lng=77.56'"""
    lat_match = re.search(r'lat=([\-\d.]+)', trip_context)
    lng_match = re.search(r'lng=([\-\d.]+)', trip_context)
    if lat_match and lng_match:
        try:
            return float(lat_match.group(1)), float(lng_match.group(1))
        except ValueError:
            pass
    return None, None


async def build_location_context(lat: Optional[float], lng: Optional[float]) -> str:
    """
    Fetch live crime risk for the user's current GPS position.
    Called with the coordinates sent by the frontend on every message,
    so the result is always fresh and matches the user's actual location.
    Returns a formatted string block, or empty string on failure.
    """
    if lat is None or lng is None:
        return ""

    try:
        crime_data = await get_crime_risk_by_coords(lat, lng)
        if "error" in crime_data:
            logger.warning("Crime lookup error: %s", crime_data.get("error"))
            return ""

        district   = crime_data.get("detected_district") or crime_data.get("district", "")
        state_name = crime_data.get("detected_state")    or crime_data.get("state", "")
        risk_level = crime_data.get("risk_level", "UNKNOWN")
        norm_score = crime_data.get("normalized_score", "N/A")

        logger.info("Location context → %s, %s | %s", district, state_name, risk_level)
        return (
            f"[User Location — background context only, do not announce unprompted]\n"
            f"District: {district}, {state_name}\n"
            f"Crime Risk Level: {risk_level}\n"
            f"Safety Score: {norm_score}/10 (10 = safest)\n"
        )
    except Exception as e:
        logger.error("build_location_context failed: %s", e, exc_info=True)
        return ""


async def build_destination_context(message: str) -> str:
    """
    If the user's message mentions a known Indian city, fetch its crime risk
    and return a context block so the AI can answer safety questions about it.
    """
    result = extract_mentioned_city(message)
    if not result:
        return ""

    lat, lng, city_name = result
    try:
        crime_data = await get_crime_risk_by_coords(lat, lng)
        if "error" in crime_data:
            return ""

        district   = crime_data.get("detected_district") or crime_data.get("district", city_name)
        state_name = crime_data.get("detected_state")    or crime_data.get("state", "")
        risk_level = crime_data.get("risk_level", "UNKNOWN")
        norm_score = crime_data.get("normalized_score", "N/A")

        logger.info("Destination context → %s (%s, %s) | %s", city_name, district, state_name, risk_level)
        return (
            f"[Destination Safety — {city_name}]\n"
            f"District: {district}, {state_name}\n"
            f"Crime Risk Level: {risk_level}\n"
            f"Safety Score: {norm_score}/10 (10 = safest)\n"
        )
    except Exception as e:
        logger.error("build_destination_context failed: %s", e, exc_info=True)
        return ""


OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter"


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p = math.pi / 180
    a = 0.5 - math.cos((lat2 - lat1) * p) / 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2
    return round(2 * r * math.asin(math.sqrt(a)), 2)


def _classify_osm_poi(tags: Dict) -> Optional[str]:
    if not tags:
        return None
    amenity = tags.get("amenity")
    shop = tags.get("shop")
    tourism = tags.get("tourism")

    if (
        amenity in ("hospital", "clinic", "doctors")
        or tags.get("healthcare") == "hospital"
        or tags.get("amenity") == "health_centre"
    ):
        return "hospital"
    if amenity == "pharmacy" or shop == "chemist":
        return "pharmacy"
    if tourism == "hotel" or amenity in ("hotel", "motel", "guest_house"):
        return "hotel"
    if amenity in ("restaurant", "fast_food", "cafe", "food_court"):
        return "restaurant"
    return None


def _format_poi_lines(items: List[Dict], per_category: int) -> List[str]:
    lines: List[str] = []
    for it in items[:per_category]:
        name = it.get("name") or "Unnamed"
        d = it.get("dist_km")
        if d is not None:
            lines.append(f"- {name} (~{d} km away)")
        else:
            lines.append(f"- {name}")
    return lines


async def build_nearby_pois_context(
    lat: Optional[float],
    lng: Optional[float],
    radius_m: int = 3500,
    per_category: int = 7,
) -> str:
    """
    Query OpenStreetMap (Overpass) for hospitals/clinics, pharmacies/chemists,
    hotels, and restaurants near the user's coordinates.

    Returned text is factual listing data only; failures return empty string.
    """
    if lat is None or lng is None:
        return ""

    query = (
        "[out:json][timeout:22];\n"
        "(\n"
        f'  node["amenity"="hospital"](around:{radius_m},{lat},{lng});\n'
        f'  node["amenity"="clinic"](around:{radius_m},{lat},{lng});\n'
        f'  node["amenity"="doctors"](around:{radius_m},{lat},{lng});\n'
        f'  node["amenity"="pharmacy"](around:{radius_m},{lat},{lng});\n'
        f'  node["shop"="chemist"](around:{radius_m},{lat},{lng});\n'
        f'  node["tourism"="hotel"](around:{radius_m},{lat},{lng});\n'
        f'  node["amenity"="hotel"](around:{radius_m},{lat},{lng});\n'
        f'  node["amenity"="motel"](around:{radius_m},{lat},{lng});\n'
        f'  node["amenity"="guest_house"](around:{radius_m},{lat},{lng});\n'
        f'  node["amenity"="restaurant"](around:{radius_m},{lat},{lng});\n'
        f'  node["amenity"="fast_food"](around:{radius_m},{lat},{lng});\n'
        f'  node["amenity"="cafe"](around:{radius_m},{lat},{lng});\n'
        ");\n"
        "out 120;\n"
    )

    try:
        async with httpx.AsyncClient(timeout=24.0) as client:
            res = await client.post(
                OVERPASS_ENDPOINT,
                content=query,
                headers={
                    "Content-Type": "text/plain; charset=utf-8",
                    "User-Agent": "VoyageurTravelApp/1.0 (nearby POI context)",
                },
            )
            res.raise_for_status()
            data = res.json()
    except Exception as e:
        logger.warning("Overpass nearby POI fetch failed: %s", e)
        return ""

    elements = data.get("elements") or []
    buckets: Dict[str, List[Dict]] = {
        "hospital": [],
        "pharmacy": [],
        "hotel": [],
        "restaurant": [],
    }
    seen: set = set()

    for el in elements:
        if el.get("type") != "node":
            continue
        plat, plon = el.get("lat"), el.get("lon")
        if plat is None or plon is None:
            continue
        tags = el.get("tags") or {}
        cat = _classify_osm_poi(tags)
        if not cat:
            continue
        name = (tags.get("name") or tags.get("name:en") or "").strip() or "Unnamed"
        dedupe_key = (cat, round(plat, 4), round(plon, 4), name.lower())
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        dist_km = _haversine_km(lat, lng, float(plat), float(plon))
        buckets[cat].append({"name": name, "dist_km": dist_km})

    for key in buckets:
        buckets[key].sort(key=lambda x: x["dist_km"])

    sections: List[str] = []
    h = _format_poi_lines(buckets["hospital"], per_category)
    if h:
        sections.append("[Nearby — Hospitals & clinics (OpenStreetMap, within ~%.1f km)]\n%s" % (radius_m / 1000, "\n".join(h)))
    ph = _format_poi_lines(buckets["pharmacy"], per_category)
    if ph:
        sections.append("[Nearby — Pharmacies & medical shops (OpenStreetMap)]\n%s" % "\n".join(ph))
    ht = _format_poi_lines(buckets["hotel"], per_category)
    if ht:
        sections.append("[Nearby — Hotels & guest lodging (OpenStreetMap)]\n%s" % "\n".join(ht))
    rs = _format_poi_lines(buckets["restaurant"], per_category)
    if rs:
        sections.append("[Nearby — Restaurants, cafés & fast food (OpenStreetMap)]\n%s" % "\n".join(rs))

    if not sections:
        return ""

    return (
        "[NEARBY PLACES — factual listing only; dataset may omit venues or contain errors]\n"
        + "\n\n".join(sections)
        + "\n"
    )


def build_trip_context(trip) -> str:
    """
    Format a Trip ORM object (or dict) into a context block.
    Accepts None gracefully — returns empty string.
    """
    if trip is None:
        return ""

    try:
        # Support both ORM objects and plain dicts
        if isinstance(trip, dict):
            destination = trip.get("destination", "Unknown")
            start_date  = trip.get("start_date", "")
            end_date    = trip.get("end_date", "")
            notes       = trip.get("notes") or ""
        else:
            destination = getattr(trip, "destination", "Unknown")
            start_date  = getattr(trip, "start_date", "")
            end_date    = getattr(trip, "end_date", "")
            notes       = getattr(trip, "notes", "") or ""

        lines = [
            "[Trip Details]",
            f"Destination: {destination}",
            f"Travel Dates: {start_date} → {end_date}",
        ]
        if notes:
            lines.append(f"Notes: {notes}")

        return "\n".join(lines) + "\n"
    except Exception as e:
        logger.error("build_trip_context failed: %s", e, exc_info=True)
        return ""


def build_route_context(planned_route: Optional[str]) -> str:
    """
    Parse the planned_route field (stored as JSON string from the OSRM response)
    and extract a human-readable summary for the prompt.

    planned_route is expected to be a JSON string with keys like:
      { "distance": 12345, "duration": 3600, "summary": "...", "steps": [...] }
    Falls back to treating it as a plain text description if JSON parsing fails.
    """
    if not planned_route:
        return ""

    try:
        route_data = json.loads(planned_route)

        distance_m  = route_data.get("distance", 0)
        duration_s  = route_data.get("duration", 0)
        summary     = route_data.get("summary", "")

        distance_km = round(distance_m / 1000, 1) if distance_m else None
        duration_min = round(duration_s / 60, 0) if duration_s else None

        lines = ["[Planned Route]"]
        if summary:
            lines.append(f"Summary: {summary}")
        if distance_km is not None:
            lines.append(f"Distance: {distance_km} km")
        if duration_min is not None:
            lines.append(f"Estimated Duration: {int(duration_min)} minutes")

        # Include first few step names as waypoints if available
        steps = route_data.get("steps", [])
        if steps:
            waypoint_names = [
                s.get("name") or s.get("ref", "")
                for s in steps[:5]
                if s.get("name") or s.get("ref")
            ]
            if waypoint_names:
                lines.append(f"Key Roads: {', '.join(waypoint_names)}")

        return "\n".join(lines) + "\n"

    except (json.JSONDecodeError, TypeError):
        # planned_route is a plain text description — use it directly
        return f"[Planned Route]\n{planned_route}\n"
    except Exception as e:
        logger.error("build_route_context failed: %s", e, exc_info=True)
        return ""


async def build_safety_context(planned_route: Optional[str]) -> str:
    """
    Score the planned route using the existing RouteScoringService and return
    a formatted safety summary block.

    Expects planned_route to be a JSON string containing a 'polyline' key
    (list of [lng, lat] coordinate pairs from OSRM).
    """
    if not planned_route:
        return ""

    try:
        route_data = json.loads(planned_route)
        raw_coords = route_data.get("polyline") or route_data.get("coordinates")

        if not raw_coords:
            return ""

        # Convert [lng, lat] pairs → Coordinate(lat, lng) objects
        scoring_coords = [
            Coordinate(lat=float(c[1]), lng=float(c[0]))
            for c in raw_coords
            if len(c) >= 2
        ]

        if not scoring_coords:
            return ""

        # Encode to polyline string and score
        scoring_service = get_route_scoring_service()
        polyline_str    = scoring_service.encode_polyline(scoring_coords)
        route_score     = await scoring_service.score_route(polyline_str)

        risk_level   = route_score.risk_level
        safety_score = route_score.normalized_score
        high_risk_n  = route_score.high_risk_segments
        total_n      = route_score.segment_count
        distance_km  = round(route_score.total_distance_km, 1)

        lines = [
            "[Route Safety Analysis]",
            f"Overall Safety Score: {safety_score}/10 (10 = safest)",
            f"Risk Level: {risk_level.upper()}",
            f"Route Length: {distance_km} km ({total_n} segments analysed)",
        ]

        if high_risk_n > 0:
            lines.append(
                f"⚠️  High-Risk Segments: {high_risk_n} out of {total_n} "
                f"({round(high_risk_n / total_n * 100)}% of route)"
            )

            # Pull district names from high-risk segments for the AI to reference
            high_risk_districts = []
            for ss in route_score.segment_scores:
                if ss.is_high_risk and ss.segment.safety_data:
                    d = ss.segment.safety_data.district
                    if d and d not in high_risk_districts:
                        high_risk_districts.append(d)

            if high_risk_districts:
                lines.append(f"High-Risk Districts: {', '.join(high_risk_districts)}")
        else:
            lines.append("✅ No high-risk segments detected on this route.")

        logger.info(
            "Safety context → score=%s/10, risk=%s, high_risk_segments=%s",
            safety_score, risk_level, high_risk_n,
        )
        return "\n".join(lines) + "\n"

    except (json.JSONDecodeError, TypeError):
        return ""
    except Exception as e:
        logger.error("build_safety_context failed: %s", e, exc_info=True)
        return ""


# ===========================================================================
# Prompt assembler
# ===========================================================================

def assemble_system_prompt(
    location_ctx: str,
    trip_ctx: str,
    route_ctx: str,
    safety_ctx: str,
    destination_ctx: str = "",
) -> str:
    """
    Combine all context blocks into a single, structured system instruction.
    Empty blocks are omitted cleanly.
    """
    sections = [SYSTEM_PROMPT.strip()]

    context_blocks = [location_ctx, destination_ctx, trip_ctx, route_ctx, safety_ctx]
    filled = [b.strip() for b in context_blocks if b and b.strip()]

    if filled:
        sections.append("\n--- CONTEXT ---\n" + "\n\n".join(filled))

    return "\n\n".join(sections)


# ===========================================================================
# Main entry point
# ===========================================================================

async def get_ai_response(
    history,
    new_message: str,
    trip_context: str,           # legacy plain-text context (kept for compatibility)
    trip=None,                   # Trip ORM object or dict (optional)
    planned_route: Optional[str] = None,  # JSON string from OSRM (optional)
    current_lat: Optional[float] = None,
    current_lng: Optional[float] = None,
) -> str:
    """
    Build full context, assemble the prompt, and call Gemini.

    Parameters
    ----------
    history       : list of Message objects (role + content)
    new_message   : the user's latest chat message
    trip_context  : legacy free-text context string (still supported)
    trip          : Trip ORM object or dict — used for structured trip context
    planned_route : JSON string of the OSRM route (distance, duration, polyline)
    current_lat   : user's current latitude
    current_lng   : user's current longitude
    """
    try:
        # ── 1. Extract coords (new explicit params take priority over legacy string) ──
        lat, lng = current_lat, current_lng
        if lat is None or lng is None:
            lat, lng = extract_coords_from_context(trip_context)

        # ── 2. Gather all context blocks concurrently ──────────────────────
        location_ctx, nearby_ctx, safety_ctx, destination_ctx = await asyncio.gather(
            build_location_context(lat, lng),
            build_nearby_pois_context(lat, lng),
            build_safety_context(planned_route),
            build_destination_context(new_message),
        )

        trip_ctx = build_trip_context(trip)
        route_ctx = build_route_context(planned_route)

        # Frontend sends rich planner notes (Trip Guide, weather on Dashboard, etc.) via trip_context.
        # Previously only used for coord fallback — merge into trip_ctx so the model can use them.
        planner_notes = (trip_context or "").strip()
        if planner_notes:
            planner_block = (
                "[Trip planner session — current screen / form state from the app; prioritize for travel advice]\n"
                f"{planner_notes}\n"
            )
            trip_ctx = (trip_ctx + "\n" if trip_ctx else "") + planner_block

        location_blocks = [b for b in (location_ctx.strip(), nearby_ctx.strip()) if b]
        location_combined = "\n\n".join(location_blocks) if location_blocks else ""

        # ── 3. Assemble system prompt ──────────────────────────────────────
        system_instruction = assemble_system_prompt(
            location_combined, trip_ctx, route_ctx, safety_ctx, destination_ctx
        )

        # ── 4. Build conversation history for Gemini ───────────────────────
        contents = []
        if history:
            for msg in history:
                if not msg or not msg.content:
                    continue
                role = "model" if msg.role == "assistant" else msg.role
                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part(text=str(msg.content))],
                    )
                )

        contents.append(
            types.Content(
                role="user",
                parts=[types.Part(text=new_message)],
            )
        )

        # ── 5. Call Gemini ─────────────────────────────────────────────────
        config = types.GenerateContentConfig(
            system_instruction=system_instruction
        )

        response = generate_with_fallback(client, contents, config)

        try:
            return response.text
        except Exception:
            return str(response)

    except Exception as e:
        logger.error("FATAL AI ERROR: %s", e, exc_info=True)
        return "Sorry, something went wrong. Please try again."
