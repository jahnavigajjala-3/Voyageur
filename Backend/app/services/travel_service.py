import httpx
import os

async def get_crime_risk(state: str):
    api_key = os.getenv("DATA_GOV_API_KEY")
    
    url = "https://api.data.gov.in/resource/15150682-a9ed-475d-b0e3-67b292e90d22"
    
    params = {
        "api-key": api_key,
        "format": "json",
        "filters[state_ut]": state,
        "limit": 1
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        data = response.json()
    
    records = data.get("records", [])
    if not records:
        return {"error": "State not found"}
    
    r = records[0]
    crime_rate = float(r.get("rate_of_cognizable_crimes__ipc___2022_", 0))
    crimes_2022 = int(r.get("_2022", 0))

    if crime_rate > 400:
        risk = "HIGH"
        color = "red"
    elif crime_rate > 200:
        risk = "MEDIUM"
        color = "orange"
    else:
        risk = "LOW"
        color = "green"
    
    return {
        "state": r["state_ut"],
        "crimes_2022": crimes_2022,
        "crime_rate_per_lakh": crime_rate,
        "risk": risk,
        "color": color
    }