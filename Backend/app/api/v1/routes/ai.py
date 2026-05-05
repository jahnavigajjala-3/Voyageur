from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from app.services.ai_service import get_ai_response

router = APIRouter()


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    history: List[Message]
    message: str
    trip_context: str
    planned_route: Optional[str] = None


@router.post("/chat")
async def chat(request: ChatRequest):
    try:
        full_context = request.trip_context
        if request.planned_route:
            full_context += f"\nPlanned Route: {request.planned_route}"
        response = await get_ai_response(
            history=request.history,
            new_message=request.message,
            trip_context=full_context
        )
        return {"response": response}
    except Exception as e:
        print("[AI ERROR]", e)
        return {"response": "Server error. Try again."}
