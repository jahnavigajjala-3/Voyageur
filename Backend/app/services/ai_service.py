from google import genai
from google.genai import types
import os
import re
from dotenv import load_dotenv
from app.services.travel_service import get_crime_risk_by_coords

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

SYSTEM_PROMPT = """
You are Amigo, a real-time travel companion AI for India.

- Warn about safety concerns or high crime areas using the crime data provided in context
- Be concise, friendly, and proactive
- If the user provides a Planned Route in the trip context, refer to it and provide relevant suggestions or feedback
- Always use the safety data provided in the trip context — do not guess or make up numbers
"""

WORKING_MODEL = None


def generate_with_fallback(client, contents, config):
    global WORKING_MODEL

    models = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-flash-latest",
    ]

    for m in models:
        try:
            response = client.models.generate_content(
                model=m,
                contents=contents,
                config=config,
            )
            WORKING_MODEL = m
            print(f"[AI] Using model: {m}")
            if not response:
                raise Exception("Empty response from Gemini")
            return response
        except Exception as e:
            print(f"[AI] Failed {m}: {e}")

    raise Exception("All Gemini models failed")


def extract_coords_from_context(trip_context: str):
    """Parse lat/lng from trip_context string e.g. 'lat=12.34, lng=77.56'"""
    lat_match = re.search(r'lat=([\-\d.]+)', trip_context)
    lng_match = re.search(r'lng=([\-\d.]+)', trip_context)
    if lat_match and lng_match:
        try:
            return float(lat_match.group(1)), float(lng_match.group(1))
        except ValueError:
            pass
    return None, None


async def get_ai_response(history, new_message, trip_context):
    try:
        crime_info_text = ""

        # Step 1: Extract coords from trip_context
        lat, lng = extract_coords_from_context(trip_context)

        if lat is not None and lng is not None:
            # Step 2: Auto-fetch crime risk via reverse geocoding
            try:
                crime_data = await get_crime_risk_by_coords(lat, lng)
                if "error" not in crime_data:
                    district   = crime_data.get("detected_district") or crime_data.get("district", "")
                    state_name = crime_data.get("detected_state")    or crime_data.get("state", "")
                    risk_level = crime_data.get("risk_level", "UNKNOWN")
                    norm_score = crime_data.get("normalized_score", "N/A")
                    risk_score = crime_data.get("risk_score", "N/A")
                    crime_info_text = (
                        f"\n[Live Crime Data] Location: {district}, {state_name} | "
                        f"Risk Level: {risk_level} | Safety Score: {norm_score}/10 "
                        f"(raw score: {risk_score})\n"
                    )
                    print(f"[AI] Crime data -> {district}, {state_name} | {risk_level}")
                else:
                    print(f"[AI] Crime lookup error: {crime_data.get('error')}")
            except Exception as e:
                print(f"[AI] Crime lookup failed: {e}")
        else:
            print("[AI] No coords in trip_context — skipping crime lookup")

        # Step 3: Build conversation history
        contents = []

        if history:
            for msg in history:
                if not msg or not msg.content:
                    continue
                role = "model" if msg.role == "assistant" else msg.role
                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part(text=str(msg.content))],
                    )
                )

        # Inject crime data into the user message
        user_message_with_context = new_message
        if crime_info_text:
            user_message_with_context = (
                f"{new_message}\n"
                f"{crime_info_text}"
            ).strip()

        contents.append(
            types.Content(
                role="user",
                parts=[types.Part(text=user_message_with_context)],
            )
        )

        # Step 4: Generate AI response
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT + "\n\nTrip context:\n" + trip_context
        )

        response = generate_with_fallback(client, contents, config)

        try:
            return response.text
        except Exception:
            return str(response)

    except Exception as e:
        print("[FATAL AI ERROR]", e)
        return "Sorry, something went wrong. Please try again."