from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class TripCreate(BaseModel):
    destination: str
    start_date: datetime
    end_date: datetime
    notes: Optional[str] = None
    planned_route: Optional[str] = None


class TripUpdate(BaseModel):
    destination: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    notes: Optional[str] = None
    planned_route: Optional[str] = None


class TripResponse(BaseModel):
    id: int
    user_id: int
    destination: str
    start_date: datetime
    end_date: datetime
    notes: Optional[str] = None
    planned_route: Optional[str] = None

    model_config = {"from_attributes": True}
