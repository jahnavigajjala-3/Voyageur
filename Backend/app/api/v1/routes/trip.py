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
from app.services.travel_service import (
    get_multiple_routes,
    RouteAlternative
)
from app.services.route_scoring_service import get_route_scoring_service, RouteScoringService, RouteScore
from app.schemas.route import (
    SafeRouteRequest,
    SafeRouteResponse,
    RouteResponse,
    RouteComparison,
    RouteErrorResponse,
    RoutePreference
)

router = APIRouter()

# Simple in-memory rate limiter for demonstration
# In production, use Redis or a dedicated rate limiting library
_rate_limit_store = defaultdict(list)
_RATE_LIMIT_WINDOW = 60  # 1 minute window
_RATE_LIMIT_MAX_REQUESTS = 10  # 10 requests per minute per user


@router.post("/trips", response_model=TripResponse)
def create_trip(
    trip: TripCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a trip (requires authentication)"""
    # Associate trip with current user
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
    """Get all trips for current user"""
    trips = db.query(Trip).filter(Trip.user_id == current_user.id).all()
    return [TripResponse.from_orm(t) for t in trips]


@router.get("/trips/{trip_id}", response_model=TripResponse)
def get_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific trip (user can only see their own)"""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    # Authorization check
    if trip.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access other users' trips",
        )

    return TripResponse.from_orm(trip)


@router.put("/trips/{trip_id}", response_model=TripResponse)
def update_trip(
    trip_id: int,
    trip_update: TripUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a trip (user can only update their own)"""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    # Authorization check
    if trip.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update other users' trips",
        )

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
    """Delete a trip (user can only delete their own)"""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found",
        )

    # Authorization check
    if trip.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete other users' trips",
        )

    db.delete(trip)
    db.commit()
    return {"detail": "Trip deleted"}


def check_rate_limit(user_id: int) -> bool:
    """Check if user has exceeded rate limit"""
    now = time.time()
    user_requests = _rate_limit_store[user_id]
    
    # Remove old requests outside the time window
    user_requests[:] = [req_time for req_time in user_requests if now - req_time < _RATE_LIMIT_WINDOW]
    
    # Check if limit exceeded
    if len(user_requests) >= _RATE_LIMIT_MAX_REQUESTS:
        return False
    
    # Add current request
    user_requests.append(now)
    return True


@router.post(
    "/routes/safe",
    response_model=SafeRouteResponse,
    responses={
        400: {"model": RouteErrorResponse, "description": "Invalid request parameters"},
        422: {"model": RouteErrorResponse, "description": "Validation error"},
        429: {"model": RouteErrorResponse, "description": "Rate limit exceeded"},
        500: {"model": RouteErrorResponse, "description": "Internal server error"},
        503: {"model": RouteErrorResponse, "description": "Service unavailable"},
    }
)
async def compute_safe_routes(
    request: SafeRouteRequest,
    route_scoring_service: RouteScoringService = Depends(get_route_scoring_service),
    current_user: User = Depends(get_current_user)
):
    """
    Compute safest route between two points with alternatives.
    
    This endpoint analyzes multiple route alternatives, scores them based on safety data,
    and returns ranked routes with safety information.
    
    Request body should include origin and destination coordinates, with optional
    parameters for number of alternatives and route preference.
    
    Rate limiting: 10 requests per minute per user.
    """
    # Check rate limit
    if not check_rate_limit(current_user.id):
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Rate limit exceeded",
                "error_code": "RATE_LIMIT_EXCEEDED",
                "suggestion": "Please wait a minute before making more requests",
                "request_id": f"req_{uuid.uuid4().hex[:12]}"
            }
        )
    
    start_time = time.time()
    request_id = f"req_{uuid.uuid4().hex[:12]}"
    
    try:
        print(f"[SAFE ROUTES] Request {request_id}: Computing safe routes from "
              f"({request.origin.lat}, {request.origin.lng}) to "
              f"({request.destination.lat}, {request.destination.lng})")
        print(f"[SAFE ROUTES] User: {current_user.id}, Alternatives: {request.alternatives}, "
              f"Preference: {request.preference}, Time of day: {request.time_of_day}")
        
        # Get multiple route alternatives from OSRM
        try:
            routes = await get_multiple_routes(
                origin_lat=request.origin.lat,
                origin_lng=request.origin.lng,
                dest_lat=request.destination.lat,
                dest_lng=request.destination.lng,
                alternatives=request.alternatives,
                timeout=15.0  # Increased timeout for multiple routes
            )
        except ValueError as e:
            raise HTTPException(
                status_code=503,
                detail={
                    "error": str(e),
                    "error_code": "ROUTING_SERVICE_UNAVAILABLE",
                    "suggestion": "Please try again in a few moments",
                    "request_id": request_id
                }
            )
        
        if not routes:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "No routes found between the specified points",
                    "error_code": "NO_ROUTES_FOUND",
                    "suggestion": "Check that the coordinates are valid and not too close together",
                    "request_id": request_id
                }
            )
        
        # Helper function to convert OSRM coordinates to RouteScoringService Coordinate objects
        def convert_to_scoring_coordinates(coords):
            """Convert list of [lng, lat] coordinates to RouteScoringService Coordinate objects"""
            from app.services.route_scoring_service import Coordinate as ScoringCoordinate
            
            scoring_coords = []
            for coord in coords:
                if len(coord) >= 2:
                    # OSRM returns [lng, lat], but Coordinate expects (lat, lng)
                    lat = float(coord[1])
                    lng = float(coord[0])
                    scoring_coords.append(ScoringCoordinate(lat=lat, lng=lng))
            return scoring_coords
        
        # Score each route
        scored_routes = []
        for i, route in enumerate(routes):
            try:
                # Convert OSRM coordinates to scoring service coordinates
                scoring_coords = convert_to_scoring_coordinates(route.polyline)
                
                if not scoring_coords:
                    print(f"[SAFE ROUTES] Warning: Route {i} has no valid coordinates")
                    continue
                
                # Encode coordinates to polyline using the scoring service
                polyline = route_scoring_service.encode_polyline(scoring_coords)
                
                # Score the route
                score = await route_scoring_service.score_route(
                    polyline=polyline,
                    route_metadata={
                        "distance": route.distance,
                        "duration": route.duration,
                        "coordinates": route.polyline
                    }
                )
                
                # Determine route type and summary
                route_type = "alternative"
                summary = "Alternative route"
                
                if route.is_fastest:
                    route_type = "fastest"
                    summary = f"Fastest route ({route.duration/60:.1f} min)"
                elif i == 0:  # First route from OSRM is typically fastest
                    route_type = "fastest"
                    summary = f"Fastest route ({route.duration/60:.1f} min)"
                
                # Create route response
                route_response = RouteResponse(
                    type=route_type,
                    geometry=route.geometry,
                    distance=route.distance,
                    duration=route.duration,
                    safety_score=score.normalized_score,
                    risk_level=score.risk_level,
                    is_fastest=route.is_fastest,
                    summary=summary
                )
                
                scored_routes.append(route_response)
                
            except Exception as e:
                print(f"[SAFE ROUTES] Error scoring route {i}: {e}")
                # Continue with other routes even if one fails
                continue
        
        if not scored_routes:
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "Failed to score any routes",
                    "error_code": "SCORING_FAILED",
                    "suggestion": "Please try again with different coordinates",
                    "request_id": request_id
                }
            )
        
        # Sort routes by safety score (highest first)
        scored_routes.sort(key=lambda x: x.safety_score, reverse=True)
        
        # Identify route types after sorting
        fastest_route = next((r for r in scored_routes if r.is_fastest), scored_routes[0])
        safest_route = scored_routes[0]  # First after sorting by safety score
        
        # Update route types based on sorting
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
        
        # Generate comparison metrics
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
        
        processing_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        
        print(f"[SAFE ROUTES] Request {request_id} completed in {processing_time:.0f}ms: "
              f"{len(scored_routes)} routes scored, safest: {safest_route.safety_score:.0f}/100")
        
        return SafeRouteResponse(
            routes=scored_routes,
            comparison=comparison,
            request_id=request_id,
            processing_time_ms=processing_time
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"[SAFE ROUTES] Unexpected error for request {request_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal server error while computing routes",
                "error_code": "INTERNAL_SERVER_ERROR",
                "suggestion": "Please try again later",
                "request_id": request_id
            }
        )
