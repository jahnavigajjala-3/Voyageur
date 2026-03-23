from pydantic import BaseModel

class TripCreate(BaseModel):    
    destination: str
    start_date: str

class TripResponse(BaseModel):    
    id: int
    destination: str
    start_date: str