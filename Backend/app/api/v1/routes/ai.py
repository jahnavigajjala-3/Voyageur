from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from app.services.ai_service import get_ai_response
from app.services.travel_service import get_crime_risk
from app.services.ai_service import analyze_crime
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.chat_message import ChatMessage
from app.schemas.chat import ChatMessageCreate, ChatMessageResponse
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
    try:
        response = await get_ai_response(
            history=request.history,
            new_message=request.message,
            trip_context=request.trip_context
        )
        return {"response": response}

    except Exception as e:
        print("[ROUTE ERROR]", e)
        return {"response": "Server error. Try again."}

@router.post("/chat-messages", response_model=ChatMessageResponse)
def create_chat_message(message: ChatMessageCreate, db: Session = Depends(get_db)):
    new_message = ChatMessage(**message.dict())
    db.add(new_message)
    db.commit()
    db.refresh(new_message)
    return new_message


@router.get("/chat-messages", response_model=list[ChatMessageResponse])
def get_chat_messages(trip_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(ChatMessage)
    if trip_id is not None:
        query = query.filter(ChatMessage.trip_id == trip_id)
    return query.all()


@router.get("/crime-warning/{state}")
async def get_crime_warning(state: str):
    crime_data = await get_crime_risk(state)
    warning = await analyze_crime(state, crime_data)

    return {
        "state": state,
        "crime_data": crime_data,
        "ai_warning": warning
    }