from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.trip import Trip
from app.schemas.trip import TripCreate, TripResponse

router = APIRouter()

@router.post("/trips", response_model=TripResponse)
def create_trip(trip: TripCreate, db: Session = Depends(get_db)):
    new_trip = Trip(**trip.dict())
    db.add(new_trip)
    db.commit()
    db.refresh(new_trip)
    return new_trip


@router.get("/trips", response_model=list[TripResponse])
def get_trips(db: Session = Depends(get_db)):
    return db.query(Trip).all()