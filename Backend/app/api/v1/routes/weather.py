from fastapi import APIRouter, HTTPException
from app.services.weather_service import get_weather

router = APIRouter()

@router.get("/weather")
def weather(lat: float, lon: float):
    data = get_weather(lat, lon)

    if "error" in data:
        raise HTTPException(status_code=400, detail=data["error"])

    return data