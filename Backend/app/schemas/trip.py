from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class TripCreate(BaseModel):
    destination: str
    start_date: datetime
    end_date: datetime
    notes: Optional[str] = None
    planned_route: Optional[str] = None


class TripUpdate(BaseModel):
    destination: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    notes: Optional[str] = None
    planned_route: Optional[str] = None


class TripResponse(BaseModel):
    id: int
    user_id: int
    destination: str
    start_date: datetime
    end_date: datetime
    notes: Optional[str] = None
    planned_route: Optional[str] = None

    model_config = {"from_attributes": True}


class TripGuidanceRequest(BaseModel):
    from_location: str
    transit_preference: str
    destination: str
    feed_preference: str
    budget_scale: str
    duration: int


class TravelSuggestion(BaseModel):
    mode: str
    estimated_price: str
    reason: str


class StaySuggestion(BaseModel):
    hotel_name: str
    type: str
    price_per_night: str


class ItineraryDay(BaseModel):
    day: int
    theme: str
    activities: List[str]


class TripGuidanceResponse(BaseModel):
    departure_hub: str
    destination_visuals: List[str]
    travel_suggestions: List[TravelSuggestion]
    stay_suggestions: List[StaySuggestion]
    itinerary: List[ItineraryDay]
