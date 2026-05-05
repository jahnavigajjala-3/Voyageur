"""
AI chat route — /api/v1/ai/chat

Accepts an optional trip_id so the AI can pull structured trip + route data
from the database and build a richer, context-aware response.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.session import get_db
from app.models.trip import Trip
from app.services.ai_service import get_ai_response
from app.api.v1.dependencies import get_current_user

router = APIRouter()
logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    history: List[Message]
    message: str

    # Legacy free-text context (still accepted for backward compatibility)
    trip_context: str = ""

    # Structured context — preferred over trip_context when provided
    trip_id: Optional[int] = None          # DB trip to load
    current_lat: Optional[float] = None    # User's GPS latitude
    current_lng: Optional[float] = None    # User's GPS longitude
    planned_route: Optional[str] = None    # JSON route payload from frontend (overrides DB trip route)


# ---------------------------------------------------------------------------
# Route handler
# ---------------------------------------------------------------------------

@router.post("/chat")
async def chat(
    request: ChatRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Context pipeline:
      1. If trip_id is provided → load Trip from DB (verifies ownership)
      2. Resolve planned_route: frontend payload > DB trip route
      3. Pass everything to get_ai_response which builds the full prompt
    """
    try:
        trip = None
        planned_route: Optional[str] = None

        # ── Load trip from DB if requested ────────────────────────────────
        if request.trip_id is not None:
            db_trip = (
                db.query(Trip)
                .filter(
                    Trip.id == request.trip_id,
                    Trip.user_id == current_user.id,
                )
                .first()
            )
            if db_trip:
                trip = db_trip
                planned_route = db_trip.planned_route
                logger.info(
                    "Loaded trip %d: %s (route=%s)",
                    db_trip.id, db_trip.destination,
                    "yes" if planned_route else "no",
                )
            else:
                logger.warning(
                    "Trip %d not found for user %d",
                    request.trip_id, current_user.id,
                )

        # ── Resolve planned_route: frontend payload takes priority ─────────
        if request.planned_route:
            planned_route = request.planned_route
            logger.debug("Using frontend-supplied route payload")
        elif trip and trip.planned_route:
            planned_route = trip.planned_route
            logger.debug("Using DB trip route for trip %d", trip.id)

        # ── Call AI service with full context ─────────────────────────────
        response = await get_ai_response(
            history=request.history,
            new_message=request.message,
            trip_context=request.trip_context,
            trip=trip,
            planned_route=planned_route,
            current_lat=request.current_lat,
            current_lng=request.current_lng,
        )

        return {"response": response}

    except Exception as e:
        logger.error("Chat endpoint error: %s", e, exc_info=True)
        return {"response": "Server error. Try again."}