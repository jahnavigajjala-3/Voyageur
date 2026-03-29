from google import genai
from google.genai import types
import os
from dotenv import load_dotenv

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
                role=msg.role,
                parts=[types.Part(text=msg.content)]
            )
        )
    return contents

def get_ai_response(history: list, new_message: str, trip_context: str) -> str:
    contents = build_gemini_history(history)
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part(text=new_message)]
        )
    )
    
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT + "\n\nTrip context:\n" + trip_context
        ),
        contents=contents
    )
    return response.text