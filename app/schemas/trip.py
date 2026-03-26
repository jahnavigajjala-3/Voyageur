from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class TripCreate(BaseModel):
    user_id: int
    destination: str
    start_date: datetime
    end_date: datetime
    budget: Optional[float] = None
    notes: Optional[str] = None


class TripResponse(BaseModel):
    id: int
    user_id: int
    destination: str
    start_date: datetime
    end_date: datetime

    model_config = {
    "from_attributes": True
}