from google import genai
from google.genai import types
import os
from dotenv import load_dotenv

WORKING_MODEL = None

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

SYSTEM_PROMPT = """
You are Amigo, a real-time travel companion AI. You are monitoring the user's 
trip and proactively helping them. You have access to their trip details like 
destination, start date, end date, and budget.

Your job is to:
- Warn about traffic on their route
- Alert about safety concerns or high crime areas
- Remind them if they are running late
- Suggest better routes
- Help book tickets if needed
- Answer any travel questions

Be concise, friendly, and proactive. Always respond as if you are actively 
watching over their journey.
"""

def build_gemini_history(messages: list) -> list:
    contents = []
    for msg in messages:
        contents.append(
            types.Content(
                role = "model" if msg.role == "assistant" else msg.role,
                parts=[types.Part(text=msg.content)]
            )
        )
    return contents

def generate_with_fallback(client, contents, config):
    global WORKING_MODEL

    models = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-flash-latest"
    ]

    if WORKING_MODEL:
        try:
            return client.models.generate_content(
                model=WORKING_MODEL,
                contents=contents,
                config=config
            )
        except:
            WORKING_MODEL = None

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

def get_ai_response(history: list, new_message: str, trip_context: str) -> str:
    contents = build_gemini_history(history)
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part(text=new_message)]
        )
    )
    
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT + "\n\nTrip context:\n" + trip_context
    )

    response = generate_with_fallback(client, contents, config)

    return response.text