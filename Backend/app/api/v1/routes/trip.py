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
    },
    "delhi": {
        "airport": "Indira Gandhi International Airport",
        "railway": "New Delhi Railway Station",
        "bus": "Kashmiri Gate ISBT",
    },
    "bengaluru": {
        "airport": "Kempegowda International Airport",
        "railway": "KSR Bengaluru City Junction",
        "bus": "Kempegowda Bus Station",
    },
    "bangalore": {
        "airport": "Kempegowda International Airport",
        "railway": "KSR Bengaluru City Junction",
        "bus": "Kempegowda Bus Station",
    },
    "hyderabad": {
        "airport": "Rajiv Gandhi International Airport",
        "railway": "Secunderabad Junction",
        "bus": "Mahatma Gandhi Bus Station",
    },
    "chennai": {
        "airport": "Chennai International Airport",
        "railway": "MGR Chennai Central Railway Station",
        "bus": "Chennai Mofussil Bus Terminus",
    },
    "kolkata": {
        "airport": "Netaji Subhas Chandra Bose International Airport",
        "railway": "Howrah Junction",
        "bus": "Esplanade Bus Terminus",
    },
    "pune": {
        "airport": "Pune International Airport",
        "railway": "Pune Junction",
        "bus": "Swargate Bus Stand",
    },
    "goa": {
        "airport": "Manohar International Airport, Mopa",
        "railway": "Madgaon Junction",
        "bus": "Panaji Bus Stand",
    },
}

BUDGET_COPY = {
    "economy": {
        "flight": "₹3,000-₹7,000",
        "train": "₹600-₹1,800",
        "bus": "₹500-₹1,500",
        "stay": ("Backpacker Hub", "Hostel", "₹700-₹1,800"),
        "reason": "keeps costs low with hostels, public transit, shared buses, and sleeper/second-sitting train options",
    },
    "midrange": {
        "flight": "₹6,000-₹12,000",
        "train": "₹1,200-₹3,000",
        "bus": "₹1,000-₹2,500",
        "stay": ("Comfort City Stay", "Hotel", "₹2,500-₹5,500"),
        "reason": "balances comfort and price with AC trains, reliable buses, standard flights, and 3-star hotels",
    },
    "luxury": {
        "flight": "₹12,000-₹35,000",
        "train": "₹3,000-₹7,000",
        "bus": "₹2,500-₹6,000",
        "stay": ("Signature Grand Resort", "Resort", "₹9,000-₹25,000"),
        "reason": "prioritizes premium cabins, flexible flights, private transfers, and luxury stays",
    },
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
    budget_key = _budget_key(request.budget_scale)
    budget = BUDGET_COPY[budget_key]

    return {
        "departure_hub": _nearest_hub(request.from_location, request.transit_preference),
        "destination_visuals": _visual_keywords(destination, request.feed_preference),
        "travel_suggestions": [
            {
                "mode": "Flight",
                "estimated_price": budget["flight"],
                "reason": f"Best when time matters; {budget['reason']}.",
            },
            {
                "mode": "Train",
                "estimated_price": budget["train"],
                "reason": f"Good balance for Indian city travel; {budget['reason']}.",
            },
            {
                "mode": "Bus",
                "estimated_price": budget["bus"],
                "reason": f"Useful for short or direct routes; {budget['reason']}.",
            },
        ],
        "stay_suggestions": [
            {
                "hotel_name": f"{destination} {budget['stay'][0]}",
                "type": budget["stay"][1],
                "price_per_night": budget["stay"][2],
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
