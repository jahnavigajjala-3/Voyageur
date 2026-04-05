from fastapi import APIRouter
from app.services.travel_service import get_crime_risk_by_coords, get_all_district_risks

router = APIRouter()

@router.get("/crime-risk")
async def crime_risk_by_coords(lat: float, lng: float):
    return await get_crime_risk_by_coords(lat, lng)

@router.get("/districts")
async def all_districts():
    return get_all_district_risks()