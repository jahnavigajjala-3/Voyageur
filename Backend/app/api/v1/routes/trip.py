from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.models.trip import Trip
from app.models.user import User
from app.schemas.trip import TripCreate, TripGuidanceRequest, TripGuidanceResponse, TripResponse, TripUpdate
from app.api.v1.dependencies import get_current_user, get_optional_user

router = APIRouter()

HUBS = {
    "mumbai": {
        "airport": "Chhatrapati Shivaji Maharaj International Airport",
        "railway": "Chhatrapati Shivaji Maharaj Terminus",
        "bus": "Mumbai Central Bus Depot",
        "coords": (19.0760, 72.8777),
    },
    "delhi": {
        "airport": "Indira Gandhi International Airport",
        "railway": "New Delhi Railway Station",
        "bus": "Kashmiri Gate ISBT",
        "coords": (28.7041, 77.1025),
    },
    "bengaluru": {
        "airport": "Kempegowda International Airport",
        "railway": "KSR Bengaluru City Junction",
        "bus": "Kempegowda Bus Station",
        "coords": (12.9716, 77.5946),
    },
    "bangalore": {
        "airport": "Kempegowda International Airport",
        "railway": "KSR Bengaluru City Junction",
        "bus": "Kempegowda Bus Station",
        "coords": (12.9716, 77.5946),
    },
    "hyderabad": {
        "airport": "Rajiv Gandhi International Airport",
        "railway": "Secunderabad Junction",
        "bus": "Mahatma Gandhi Bus Station",
        "coords": (17.3850, 78.4867),
    },
    "chennai": {
        "airport": "Chennai International Airport",
        "railway": "MGR Chennai Central Railway Station",
        "bus": "Chennai Mofussil Bus Terminus",
        "coords": (13.0827, 80.2707),
    },
    "kolkata": {
        "airport": "Netaji Subhas Chandra Bose International Airport",
        "railway": "Howrah Junction",
        "bus": "Esplanade Bus Terminus",
        "coords": (22.5726, 88.3639),
    },
    "pune": {
        "airport": "Pune International Airport",
        "railway": "Pune Junction",
        "bus": "Swargate Bus Stand",
        "coords": (18.5204, 73.8567),
    },
    "goa": {
        "airport": "Manohar International Airport, Mopa",
        "railway": "Madgaon Junction",
        "bus": "Panaji Bus Stand",
        "coords": (15.2993, 74.1240),
    },
    "jaipur": {
        "airport": "Jaipur International Airport",
        "railway": "Jaipur Junction",
        "bus": "Sindhi Camp Bus Stand",
        "coords": (26.9124, 75.7873),
    },
    "kochi": {
        "airport": "Cochin International Airport",
        "railway": "Ernakulam Junction",
        "bus": "Ernakulam KSRTC Bus Stand",
        "coords": (9.9312, 76.2673),
    },
}

BUDGET_COPY = {
    "economy": {
        "flight_base": 3000,
        "flight_per_km": 0.8,
        "train_base": 600,
        "train_per_km": 0.3,
        "bus_base": 500,
        "bus_per_km": 0.25,
        "stay_base": 700,
        "stay_multiplier": 1.0,
        "stay_name": "Backpacker Hub",
        "stay_type": "Hostel",
        "reason": "keeps costs low with hostels, public transit, shared buses, and sleeper/second-sitting train options",
    },
    "midrange": {
        "flight_base": 6000,
        "flight_per_km": 1.5,
        "train_base": 1200,
        "train_per_km": 0.6,
        "bus_base": 1000,
        "bus_per_km": 0.5,
        "stay_base": 2500,
        "stay_multiplier": 1.0,
        "stay_name": "Comfort City Stay",
        "stay_type": "Hotel",
        "reason": "balances comfort and price with AC trains, reliable buses, standard flights, and 3-star hotels",
    },
    "luxury": {
        "flight_base": 12000,
        "flight_per_km": 3.0,
        "train_base": 3000,
        "train_per_km": 1.2,
        "bus_base": 2500,
        "bus_per_km": 1.0,
        "stay_base": 9000,
        "stay_multiplier": 1.0,
        "stay_name": "Signature Grand Resort",
        "stay_type": "Resort",
        "reason": "prioritizes premium cabins, flexible flights, private transfers, and luxury stays",
    },
}

# Destination popularity multipliers (tourist hotspots cost more)
DESTINATION_MULTIPLIERS = {
    "goa": 1.3,
    "mumbai": 1.2,
    "delhi": 1.15,
    "jaipur": 1.25,
    "udaipur": 1.3,
    "shimla": 1.35,
    "manali": 1.4,
    "kerala": 1.25,
    "kochi": 1.2,
    "ooty": 1.3,
    "darjeeling": 1.35,
    "andaman": 1.5,
    "leh": 1.6,
    "ladakh": 1.6,
}


def _calculate_distance(from_city: str, to_city: str) -> float:
    """Calculate approximate distance between two cities in kilometers."""
    from_lower = from_city.lower().strip()
    to_lower = to_city.lower().strip()
    
    # Find coordinates
    from_coords = None
    to_coords = None
    
    for city, data in HUBS.items():
        if city in from_lower or from_lower in city:
            from_coords = data.get("coords")
        if city in to_lower or to_lower in city:
            to_coords = data.get("coords")
    
    # If we can't find coordinates, estimate based on common routes
    if not from_coords or not to_coords:
        # Return average distance for unknown routes
        return 800.0
    
    # Simple Haversine-like distance calculation
    lat1, lon1 = from_coords
    lat2, lon2 = to_coords
    
    # Approximate distance using Pythagorean theorem (good enough for India)
    # 1 degree latitude ≈ 111 km
    # 1 degree longitude ≈ 111 km * cos(latitude)
    avg_lat = (lat1 + lat2) / 2
    import math
    lat_diff = (lat2 - lat1) * 111
    lon_diff = (lon2 - lon1) * 111 * math.cos(math.radians(avg_lat))
    distance = math.sqrt(lat_diff**2 + lon_diff**2)
    
    return max(distance, 50)  # Minimum 50km


def _calculate_prices(from_location: str, destination: str, budget_key: str) -> dict:
    """Calculate dynamic prices based on distance and destination popularity."""
    budget = BUDGET_COPY[budget_key]
    
    # Calculate distance
    distance = _calculate_distance(from_location, destination)
    
    # Get destination multiplier (tourist hotspots cost more)
    dest_lower = destination.lower().strip()
    dest_multiplier = 1.0
    for dest, multiplier in DESTINATION_MULTIPLIERS.items():
        if dest in dest_lower or dest_lower in dest:
            dest_multiplier = multiplier
            break
    
    # Calculate prices with distance and popularity
    flight_price = int((budget["flight_base"] + distance * budget["flight_per_km"]) * dest_multiplier)
    train_price = int((budget["train_base"] + distance * budget["train_per_km"]) * dest_multiplier)
    bus_price = int((budget["bus_base"] + distance * budget["bus_per_km"]) * dest_multiplier)
    stay_price = int(budget["stay_base"] * dest_multiplier * budget["stay_multiplier"])
    
    # Format as ranges (±20% variation)
    def format_range(price):
        low = int(price * 0.8)
        high = int(price * 1.2)
        return f"₹{low:,}-₹{high:,}"
    
    return {
        "flight": format_range(flight_price),
        "train": format_range(train_price),
        "bus": format_range(bus_price),
        "stay": format_range(stay_price),
        "stay_name": budget["stay_name"],
        "stay_type": budget["stay_type"],
        "reason": budget["reason"],
    }

FEED_ACTIVITIES = {
    "mountains": ["sunrise viewpoint", "guided ridge walk", "local cafe with valley views"],
    "beaches": ["beach walk", "sunset shack dinner", "water sports or island cruise"],
    "urban": ["heritage district walk", "street food crawl", "museum or nightlife zone"],
    "nature": ["botanical garden", "lake or forest trail", "wildlife-friendly viewpoint"],
    "culture": ["old town walk", "temple or fort visit", "local market and food tasting"],
    "adventure": ["guided outdoor activity", "viewpoint hike", "evening recovery meal"],
}

DESTINATION_ACTIVITY_BANK = {
    "goa": {
        "beaches": [
            ["Check in near Candolim or Calangute", "Relax at Candolim Beach", "Sunset dinner at a beach shack"],
            ["Fort Aguada viewpoint", "Sinquerim coastline walk", "Baga nightlife or quiet cafe evening"],
            ["South Goa beach hop: Colva, Benaulim, Palolem", "Seafood lunch by the coast", "Sunset at Cabo de Rama"],
            ["Dudhsagar Falls or spice plantation day trip", "Old Goa churches", "Latin Quarter walk in Fontainhas"],
        ],
        "culture": [
            ["Old Goa churches", "Fontainhas heritage walk", "Goan thali dinner"],
            ["Reis Magos Fort", "Museum of Goa", "Mandovi riverside evening"],
            ["Local market at Mapusa or Panaji", "Portuguese-era lanes", "Fado or live music dinner"],
        ],
    },
    "mumbai": {
        "urban": [
            ["Arrive and settle in South Mumbai", "Gateway of India and Colaba Causeway", "Marine Drive sunset"],
            ["Elephanta Caves ferry", "Kala Ghoda galleries", "Street food around Churchgate"],
            ["Bandra street art walk", "Carter Road promenade", "Rooftop or coastal dinner"],
            ["Crawford Market", "Chhatrapati Shivaji Terminus photo stop", "Juhu Beach evening"],
        ],
        "culture": [
            ["Gateway of India", "Prince of Wales Museum", "Colaba heritage walk"],
            ["Elephanta Caves", "Kala Ghoda art district", "Irani cafe stop"],
            ["Dharavi community tour with ethical operator", "Bandra villages", "Prithvi Theatre evening"],
        ],
    },
    "bengaluru": {
        "urban": [
            ["Arrive and settle near MG Road or Indiranagar", "Cubbon Park walk", "Church Street dinner"],
            ["Bangalore Palace", "Vidhana Soudha photo stop", "Brewery or cafe evening"],
            ["Lalbagh Botanical Garden", "KR Market colors", "Koramangala food crawl"],
        ],
        "nature": [
            ["Cubbon Park", "Lalbagh Botanical Garden", "Indiranagar cafe evening"],
            ["Nandi Hills sunrise", "Bhoga Nandeeshwara Temple", "Return for relaxed dinner"],
            ["Bannerghatta Biological Park", "Lake walk at Sankey Tank", "Local food stop"],
        ],
    },
    "jaipur": {
        "culture": [
            ["City Palace", "Jantar Mantar", "Hawa Mahal photo walk"],
            ["Amber Fort morning", "Panna Meena ka Kund", "Nahargarh sunset"],
            ["Johari Bazaar shopping", "Patrika Gate", "Rajasthani thali dinner"],
        ],
        "urban": [
            ["Pink City orientation", "Hawa Mahal", "Rooftop dinner with fort views"],
            ["Amber Fort and Jaigarh Fort", "Local textile market", "Nahargarh sunset"],
            ["City Palace", "Jantar Mantar", "Cafe and craft shopping"],
        ],
    },
    "kochi": {
        "culture": [
            ["Fort Kochi check-in", "Chinese fishing nets", "Kathakali performance"],
            ["Mattancherry Palace", "Jew Town and synagogue lane", "Spice market walk"],
            ["Kerala cafe breakfast", "Backwater day cruise", "Marine Drive evening"],
        ],
        "nature": [
            ["Fort Kochi waterfront", "Mangalavanam bird sanctuary", "Sunset by Chinese fishing nets"],
            ["Backwater cruise from Alleppey or Kumarakom", "Toddy shop lunch", "Return to Kochi"],
            ["Cherai Beach", "Village road cycle or walk", "Seafood dinner"],
        ],
    },
    "delhi": {
        "culture": [
            ["India Gate and Kartavya Path", "Humayun's Tomb", "Khan Market dinner"],
            ["Old Delhi walk", "Jama Masjid", "Chandni Chowk food trail"],
            ["Qutub Minar", "Mehrauli Archaeological Park", "Hauz Khas evening"],
        ],
        "urban": [
            ["Connaught Place orientation", "India Gate", "Cafe or market evening"],
            ["Lodhi Art District", "Humayun's Tomb", "Khan Market"],
            ["Cyber Hub or Aerocity", "Metro-powered city hops", "Live music or dining"],
        ],
    },
}


def _clean(value: str, fallback: str) -> str:
    value = (value or "").strip()
    return value if value else fallback


def _budget_key(value: str) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {"luxury", "premium"}:
        return "luxury"
    if normalized in {"economy", "budget"}:
        return "economy"
    return "midrange"


def _transit_key(value: str) -> str:
    normalized = (value or "").strip().lower()
    if "rail" in normalized or "train" in normalized:
        return "railway"
    if "bus" in normalized:
        return "bus"
    return "airport"


def _feed_key(value: str) -> str:
    normalized = (value or "").strip().lower()
    for key in FEED_ACTIVITIES:
        if key in normalized:
            return key
    return normalized or "urban"


def _nearest_hub(from_location: str, transit_preference: str) -> str:
    location = _clean(from_location, "Current Location")
    transit = _transit_key(transit_preference)
    if location.strip().lower() == "current location":
        label = {"airport": "airport", "railway": "railway station", "bus": "bus terminal"}[transit]
        return f"Nearest {label} to current location"

    location_lower = location.lower()
    for city, hubs in HUBS.items():
        if city in location_lower:
            return hubs[transit]

    pretty = {"airport": "Airport", "railway": "Railway Station", "bus": "Bus Terminal"}[transit]
    return f"Nearest {pretty} in {location.title()}"


def _visual_keywords(destination: str, feed: str) -> list[str]:
    dest = _clean(destination, "destination")
    feed_key = _feed_key(feed)
    if feed_key == "mountains":
        variants = ["mountain viewpoint", "trek trail", "misty hills"]
    elif feed_key == "beaches":
        variants = ["beach sunset", "coastline", "seafood shack"]
    elif feed_key == "nature":
        variants = ["green landscape", "lake view", "nature trail"]
    elif feed_key == "culture":
        variants = ["heritage architecture", "local market", "traditional food"]
    elif feed_key == "adventure":
        variants = ["adventure activity", "outdoor trail", "scenic viewpoint"]
    else:
        variants = ["city skyline", "street food", "landmark"]
    return [f"{dest} {variant}" for variant in variants]


def _itinerary(destination: str, feed: str, duration: int) -> list[dict]:
    dest = _clean(destination, "destination")
    feed_key = _feed_key(feed)
    destination_key = dest.lower()
    city_plan = None
    for city, feed_plans in DESTINATION_ACTIVITY_BANK.items():
        if city in destination_key:
            city_plan = feed_plans.get(feed_key) or feed_plans.get("urban") or feed_plans.get("culture")
            break
    generic_activities = FEED_ACTIVITIES.get(feed_key, FEED_ACTIVITIES["urban"])
    day_count = max(1, min(duration or 1, 10))
    plan = []
    for index in range(day_count):
        day = index + 1
        if city_plan:
            base = city_plan[index % len(city_plan)]
            if day == 1:
                acts = [f"Arrive in {dest}", *base[:2], base[2] if len(base) > 2 else "easy local dinner"]
            elif day == day_count:
                acts = [*base[:2], "keep a departure buffer and final local meal"]
            else:
                acts = base
        elif day == 1:
            acts = [f"Arrive in {dest}", f"{dest} {generic_activities[0]}", "easy evening orientation walk"]
        elif day == day_count:
            acts = [f"{dest} {generic_activities[-1]}", "souvenir stop", "depart with buffer time"]
        else:
            acts = [
                f"{dest} {generic_activities[index % len(generic_activities)]}",
                f"{dest} {generic_activities[(index + 1) % len(generic_activities)]}",
                "budget-matched dinner nearby",
            ]
        plan.append({"day": day, "theme": f"{feed_key.title()} focused day", "activities": acts})
    return plan


@router.post("/trip-guidance", response_model=TripGuidanceResponse)
def trip_guidance(
    request: TripGuidanceRequest,
    current_user=Depends(get_optional_user),
):
    destination = _clean(request.destination, "Destination")
    from_location = _clean(request.from_location, "Current Location")
    budget_key = _budget_key(request.budget_scale)
    
    # Calculate dynamic prices based on distance and destination
    prices = _calculate_prices(from_location, destination, budget_key)

    return {
        "departure_hub": _nearest_hub(request.from_location, request.transit_preference),
        "destination_visuals": _visual_keywords(destination, request.feed_preference),
        "travel_suggestions": [
            {
                "mode": "Flight",
                "estimated_price": prices["flight"],
                "reason": f"Best when time matters; {prices['reason']}.",
            },
            {
                "mode": "Train",
                "estimated_price": prices["train"],
                "reason": f"Good balance for Indian city travel; {prices['reason']}.",
            },
            {
                "mode": "Bus",
                "estimated_price": prices["bus"],
                "reason": f"Useful for short or direct routes; {prices['reason']}.",
            },
        ],
        "stay_suggestions": [
            {
                "hotel_name": f"{destination} {prices['stay_name']}",
                "type": prices["stay_type"],
                "price_per_night": prices["stay"],
            }
        ],
        "itinerary": _itinerary(destination, request.feed_preference, request.duration),
    }


@router.post("/trips", response_model=TripResponse)
def create_trip(
    trip: TripCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_trip = Trip(**trip.dict(), user_id=current_user.id)
    db.add(new_trip)
    db.commit()
    db.refresh(new_trip)
    return TripResponse.from_orm(new_trip)


@router.get("/trips", response_model=list[TripResponse])
def get_trips(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trips = db.query(Trip).filter(Trip.user_id == current_user.id).all()
    return [TripResponse.from_orm(t) for t in trips]


@router.get("/trips/{trip_id}", response_model=TripResponse)
def get_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    if trip.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access other users trips")
    return TripResponse.from_orm(trip)


@router.put("/trips/{trip_id}", response_model=TripResponse)
def update_trip(
    trip_id: int,
    trip_update: TripUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    if trip.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot update other users trips")
    if trip_update.destination is not None:
        trip.destination = trip_update.destination
    if trip_update.start_date is not None:
        trip.start_date = trip_update.start_date
    if trip_update.end_date is not None:
        trip.end_date = trip_update.end_date
    if trip_update.notes is not None:
        trip.notes = trip_update.notes
    if trip_update.planned_route is not None:
        trip.planned_route = trip_update.planned_route
    db.commit()
    db.refresh(trip)
    return TripResponse.from_orm(trip)


@router.delete("/trips/{trip_id}")
def delete_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    if trip.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete other users trips")
    db.delete(trip)
    db.commit()
    return {"detail": "Trip deleted"}
