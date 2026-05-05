import requests
from app.core.logging import get_logger

logger = get_logger(__name__)


def get_weather(lat: float, lon: float) -> dict:
    """Fetch current weather from Open-Meteo for the given coordinates."""
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}&current_weather=true"
    )

    try:
        response = requests.get(url, timeout=5)
    except requests.RequestException as e:
        logger.error("Weather API request failed: %s", e)
        return {"error": "Weather API request failed"}

    if response.status_code != 200:
        logger.warning("Weather API returned status %d", response.status_code)
        return {"error": "Weather API failed"}

    current = response.json().get("current_weather", {})
    return {
        "temperature": current.get("temperature"),
        "windspeed":   current.get("windspeed"),
        "weathercode": current.get("weathercode"),
    }
