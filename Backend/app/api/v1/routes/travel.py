import httpx
import os
from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.get("/crime/{state}")
async def get_crime_data(state: str):
    api_key = os.getenv("DATA_GOV_API_KEY")
    
    url = "https://api.data.gov.in/resource/15150682-a9ed-475d-b0e3-67b292e90d22"
    
    params = {
        "api-key": api_key,
        "format": "json",
        "filters[state_ut]": state,
        "limit": 10
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch crime data")
        
        return response.json()