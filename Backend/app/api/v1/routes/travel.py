from fastapi import APIRouter
from app.services.travel_service import get_crime_risk_by_coords, get_all_district_risks, get_districts_in_state
from app.services.hospital_service import get_nearby_hospitals

router = APIRouter()

@router.get("/crime-risk")
async def crime_risk_by_coords(lat: float, lng: float):
    return await get_crime_risk_by_coords(lat, lng)

@router.get("/districts-in-state")
async def districts_in_state(lat: float, lng: float):
    """Get all districts in the detected state with their crime data."""
    return await get_districts_in_state(lat, lng)

@router.get("/districts")
async def all_districts():
    return get_all_district_risks()

@router.get("/hospitals")
async def nearby_hospitals(lat: float, lng: float, radius: float = 10, limit: int = 5):
    return get_nearby_hospitals(lat, lng, radius, limit)