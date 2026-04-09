from google import genai
from google.genai import types
import os
from dotenv import load_dotenv
from app.services.travel_service import get_crime_risk

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

SYSTEM_PROMPT = """
You are Amigo, a real-time travel companion AI.

- Warn about safety concerns or high crime areas
- Be concise, friendly, and proactive
"""
WORKING_MODEL = None


def generate_with_fallback(client, contents, config):
    global WORKING_MODEL

    models = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-flash-latest"
    ]

    for m in models:
        try:
            response = client.models.generate_content(
                model=m,
                contents=contents,
                config=config
            )
            WORKING_MODEL = m
            print(f"[AI] Using model: {m}")
            if not response:
                raise Exception("Empty response from Gemini")
            return response
        except Exception as e:
            print(f"[AI] Failed {m}: {e}")

    raise Exception("All Gemini models failed")

def extract_state(text: str) -> str:
    states = [
        "Karnataka", "Maharashtra", "Delhi", "Tamil Nadu",
        "Kerala", "Goa", "Rajasthan", "Uttar Pradesh",
        "Gujarat", "West Bengal"
    ]

    for state in states:
        if state.lower() in text.lower():
            return state
    return None

async def extract_state_with_ai(text: str):

    prompt = f"""
    Extract the Indian state from this text.

    Text: "{text}"

    Only return the state name. No explanation.
    """

    contents = [
        types.Content(
            role="user",
            parts=[types.Part(text=prompt)]
        )
    ]

    config = types.GenerateContentConfig()

    response = generate_with_fallback(client, contents, config)

    if not response or not response.text:
        return None

    return response.text.strip()

async def analyze_crime(state: str, crime_data: dict):

    if "error" in crime_data:
        return f"Crime data for {state} is not available."

    try:
        prompt = f"""
            The user is traveling to {state}, India.

            Crime Data:
            - Total Crimes: {crime_data['total_crime']}
            - Risk Level: {crime_data['risk']}

            Give a short safety warning (2 sentences).
            """

        contents = [
            types.Content(
                role="user",
                parts=[types.Part(text=prompt)]
            )
        ]

        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT
        )

        response = generate_with_fallback(client, contents, config)
        return response.text

    except Exception as e:
        print("[AI ERROR]", e)
        return f"{state} has {crime_data['risk']} crime risk. Stay alert and avoid unsafe areas."
    
async def get_ai_response(history, new_message, trip_context):
    try:
        state = extract_state(trip_context) or extract_state(new_message)

        if not state:
            print("[INFO] Trying AI to detect state...")
            state = await extract_state_with_ai(new_message)
            if state:
                state = state.replace("\n", "").replace(".", "").strip()
                state = state.split()[-1]
                state = state.title()

        print("[STATE DETECTED]:", state)

        crime_info_text = ""

        if state:
            try:
                crime_data = await get_crime_risk(state)
                warning = await analyze_crime(state, crime_data)
                crime_info_text = f"\nSafety Info: {warning}\n"
            except Exception as e:
                print("[CRIME ERROR]", e)

        contents = []

        # ✅ SAFE history handling
        if history:
            for msg in history:
                if not msg or not msg.content:
                    continue

                role = "model" if msg.role == "assistant" else msg.role

                contents.append(
                    types.Content(
                        role=role,
                        parts=[types.Part(text=str(msg.content))]
                    )
                )

        contents.append(
            types.Content(
                role="user",
                parts=[types.Part(
                    text=f"{new_message}\n{crime_info_text}".strip()
                )]
            )
        )

        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT + "\n\nTrip context:\n" + trip_context
        )

        response = generate_with_fallback(client, contents, config)

        # ✅ SAFE response extraction
        try:
            return response.text
        except:
            return str(response)

    except Exception as e:
        print("[FATAL AI ERROR]", e)
        return "Sorry, something went wrong. Please try again."