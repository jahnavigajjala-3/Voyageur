from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ChatRequest(BaseModel):
    trip_id: int
    message: str
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None

class ChatResponse(BaseModel):
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}

class LocationUpdate(BaseModel):
    trip_id: int
    lat: float
    lng: float


class ChatMessageCreate(BaseModel):
    trip_id: int
    role: str
    content: str


class ChatMessageResponse(BaseModel):
    id: int
    trip_id: int
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}
