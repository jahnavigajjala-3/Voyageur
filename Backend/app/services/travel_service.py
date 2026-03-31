import httpx
import os

async def get_crime_risk(state: str):
    api_key = os.getenv("DATA_GOV_API_KEY")

    original_input = state
    state = state.title()

    url = "https://api.data.gov.in/resource/15150682-a9ed-475d-b0e3-67b292e90d22"

    params = {
        "api-key": api_key,
        "format": "json",
        "filters[state_ut]": state,
        "limit": 1
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url, params=params)
            data = response.json()
    except httpx.RequestError as e:
        print("[API ERROR]", e)
        return {"error": "External API failed"}

    records = data.get("records", [])

    
    if not records:
        print("[INFO] Trying AI to detect state from:", original_input)
        
        from app.services.ai_service import extract_state_with_ai

        detected_state = await extract_state_with_ai(original_input)

        if detected_state:
            detected_state = detected_state.replace("\n", "").strip().title()

            print("[AI DETECTED STATE]:", detected_state)

            params["filters[state_ut]"] = detected_state

            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(url, params=params)
                    data = response.json()
            except httpx.RequestError as e:
                print("[API ERROR]", e)
                return {"error": "External API failed"}

            records = data.get("records", [])

            if records:
                state = detected_state

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
        "state": state,
        "crimes_2022": crimes_2022,
        "crime_rate_per_lakh": crime_rate,
        "risk": risk,
        "color": color
    }