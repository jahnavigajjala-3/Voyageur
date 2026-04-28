import requests

def get_weather(lat, lon):
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}&current_weather=true"
    )

    response = requests.get(url)

    if response.status_code != 200:
        return {"error": "Weather API failed"}

    data = response.json()

    current = data.get("current_weather", {})

    return {
        "temperature": current.get("temperature"),
        "windspeed": current.get("windspeed"),
        "weathercode": current.get("weathercode")
    }