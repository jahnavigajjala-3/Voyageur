from google import genai
from google.genai import types
import os
from dotenv import load_dotenv

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
            return response
        except Exception as e:
            print(f"[AI] Failed {m}: {e}")

    raise Exception("All Gemini models failed")


async def analyze_crime(state: str, crime_data: dict):

    if "error" in crime_data:
        return f"Crime data for {state} is not available."

    try:
        prompt = f"""
        The user is traveling to {state}, India.
        
        Crime Data:
        - Total Crimes (2022): {crime_data['crimes_2022']}
        - Crime Rate per lakh: {crime_data['crime_rate_per_lakh']}
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