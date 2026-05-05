from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import time
import uuid
from datetime import datetime, timedelta
from collections import defaultdict

from app.db.session import get_db
from app.models.trip import Trip
from app.models.user import User
from app.schemas.trip import TripCreate, TripResponse, TripUpdate
from app.api.v1.dependencies import get_current_user
from app.services.travel_service import get_multiple_routes, RouteAlternative
from app.services.route_scoring_service import get_route_scoring_service, RouteScoringService, RouteScore
from app.schemas.route import (
    SafeRouteRequest, SafeRouteResponse, RouteResponse,
    RouteComparison, RouteErrorResponse, RoutePreference
)

router = APIRouter()

_rate_limit_store = defaultdict(list)
_RATE_LIMIT_WINDOW = 60
_RATE_LIMIT_MAX_REQUESTS = 10


@router.post("/trips", response_model=TripResponse)
def create_trip(
    trip: TripCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_trip = Trip(**trip.dict(), user_id=current_user.id)
    db.add(new_trip)
    db.commit()
    db.refresh(new_trip)
    return TripResponse.from_orm(new_trip)


@router.get("/trips", response_model=list[TripResponse])
def get_trips(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trips = db.query(Trip).filter(Trip.user_id == current_user.id).all()
    return [TripResponse.from_orm(t) for t in trips]


@router.get("/trips/{trip_id}", response_model=TripResponse)
def get_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    if trip.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot access other users trips")
    return TripResponse.from_orm(trip)


@router.put("/trips/{trip_id}", response_model=TripResponse)
def update_trip(
    trip_id: int,
    trip_update: TripUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    if trip.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot update other users trips")
    if trip_update.destination is not None:
        trip.destination = trip_update.destination
    if trip_update.start_date is not None:
        trip.start_date = trip_update.start_date
    if trip_update.end_date is not None:
        trip.end_date = trip_update.end_date
    if trip_update.notes is not None:
        trip.notes = trip_update.notes
    if trip_update.planned_route is not None:
        trip.planned_route = trip_update.planned_route
    db.commit()
    db.refresh(trip)
    return TripResponse.from_orm(trip)


@router.delete("/trips/{trip_id}")
def delete_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")
    if trip.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete other users trips")
    db.delete(trip)
    db.commit()
    return {"detail": "Trip deleted"}


def check_rate_limit(user_id: int) -> bool:
    now = time.time()
    user_requests = _rate_limit_store[user_id]
    user_requests[:] = [r for r in user_requests if now - r < _RATE_LIMIT_WINDOW]
    if len(user_requests) >= _RATE_LIMIT_MAX_REQUESTS:
        return False
    user_requests.append(now)
    return True


@router.post("/routes/safe", response_model=SafeRouteResponse)
async def compute_safe_routes(
    request: SafeRouteRequest,
    route_scoring_service: RouteScoringService = Depends(get_route_scoring_service),
    current_user: User = Depends(get_current_user)
):
    if not check_rate_limit(current_user.id):
        raise HTTPException(status_code=429, detail={"error": "Rate limit exceeded", "error_code": "RATE_LIMIT_EXCEEDED", "suggestion": "Please wait a minute before making more requests", "request_id": f"req_{uuid.uuid4().hex[:12]}"})

    start_time = time.time()
    request_id = f"req_{uuid.uuid4().hex[:12]}"

    try:
        print(f"[SAFE ROUTES] Request {request_id}: {request.origin.lat},{request.origin.lng} to {request.destination.lat},{request.destination.lng}")

        try:
            routes = await get_multiple_routes(
                origin_lat=request.origin.lat, origin_lng=request.origin.lng,
                dest_lat=request.destination.lat, dest_lng=request.destination.lng,
                alternatives=request.alternatives, timeout=15.0
            )
        except ValueError as e:
            raise HTTPException(status_code=503, detail={"error": str(e), "error_code": "ROUTING_SERVICE_UNAVAILABLE", "suggestion": "Please try again in a few moments", "request_id": request_id})

        if not routes:
            raise HTTPException(status_code=400, detail={"error": "No routes found", "error_code": "NO_ROUTES_FOUND", "suggestion": "Check that the coordinates are valid", "request_id": request_id})

        def convert_to_scoring_coordinates(coords):
            from app.services.route_scoring_service import Coordinate as ScoringCoordinate
            return [ScoringCoordinate(lat=float(c[1]), lng=float(c[0])) for c in coords if len(c) >= 2]

        scored_routes = []
        for i, route in enumerate(routes):
            try:
                scoring_coords = convert_to_scoring_coordinates(route.polyline)
                if not scoring_coords:
                    continue
                polyline = route_scoring_service.encode_polyline(scoring_coords)
                score = await route_scoring_service.score_route(
                    polyline=polyline,
                    route_metadata={"distance": route.distance, "duration": route.duration, "coordinates": route.polyline}
                )
                route_type = "fastest" if route.is_fastest or i == 0 else "alternative"
                summary = f"Fastest route ({route.duration/60:.1f} min)" if route.is_fastest else "Alternative route"
                scored_routes.append(RouteResponse(
                    type=route_type, geometry=route.geometry,
                    distance=route.distance, duration=route.duration,
                    safety_score=score.normalized_score, risk_level=score.risk_level,
                    is_fastest=route.is_fastest, summary=summary
                ))
            except Exception as e:
                print(f"[SAFE ROUTES] Error scoring route {i}: {e}")
                continue

        if not scored_routes:
            raise HTTPException(status_code=500, detail={"error": "Failed to score any routes", "error_code": "SCORING_FAILED", "request_id": request_id})

        scored_routes.sort(key=lambda x: x.safety_score, reverse=True)
        fastest_route = next((r for r in scored_routes if r.is_fastest), scored_routes[0])
        safest_route = scored_routes[0]

        for i, route in enumerate(scored_routes):
            if route == safest_route:
                route.type = "safest"
                route.summary = f"Safest route (score: {route.safety_score:.0f}/100)"
            elif route == fastest_route and route != safest_route:
                route.type = "fastest"
                route.summary = f"Fastest route ({route.duration/60:.1f} min)"
            else:
                route.type = "alternative"
                route.summary = f"Alternative route (score: {route.safety_score:.0f}/100)"

        comparison = None
        if len(scored_routes) > 1 and safest_route != fastest_route:
            comparison = RouteComparison(
                safety_difference=safest_route.safety_score - fastest_route.safety_score,
                time_penalty=safest_route.duration - fastest_route.duration,
                distance_penalty=safest_route.distance - fastest_route.distance,
                safety_per_time_ratio=(
                    (safest_route.safety_score - fastest_route.safety_score) /
                    (safest_route.duration - fastest_route.duration)
                    if safest_route.duration > fastest_route.duration else None
                )
            )

        processing_time = (time.time() - start_time) * 1000
        print(f"[SAFE ROUTES] {request_id} done in {processing_time:.0f}ms: {len(scored_routes)} routes, safest: {safest_route.safety_score:.0f}/100")

        return SafeRouteResponse(
            routes=scored_routes, comparison=comparison,
            request_id=request_id, processing_time_ms=processing_time
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[SAFE ROUTES] Unexpected error {request_id}: {e}")
        raise HTTPException(status_code=500, detail={"error": "Internal server error", "error_code": "INTERNAL_SERVER_ERROR", "request_id": request_id})
