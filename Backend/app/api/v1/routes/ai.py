from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from app.services.ai_service import get_ai_response

router = APIRouter()


# 🔸 Define request schema
class Message(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    history: List[Message]
    message: str
    trip_context: str


@router.post("/chat")
def chat(request: ChatRequest):
    response = get_ai_response(
        history=request.history,
        new_message=request.message,
        trip_context=request.trip_context
    )

    return {"response": response}