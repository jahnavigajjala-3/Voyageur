from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from app.services.ai_service import get_ai_response
from fastapi import APIRouter
from app.services.travel_service import get_crime_risk
from app.services.ai_service import analyze_crime
router = APIRouter()



class Message(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    history: List[Message]
    message: str
    trip_context: str


@router.post("/chat")
async def chat(request: ChatRequest):
    response = await get_ai_response(
        history=request.history,
        new_message=request.message,
        trip_context=request.trip_context
    )

    return {"response": response}
    response = get_ai_response(
        history=request.history,
        new_message=request.message,
        trip_context=request.trip_context
    )

    return {"response": response}
@router.get("/crime-warning/{state}")
async def get_crime_warning(state: str):
    
    crime_data = await get_crime_risk(state)
    warning = await analyze_crime(state, crime_data)

    return {
        "state": state,
        "crime_data": crime_data,
        "ai_warning": warning
    }