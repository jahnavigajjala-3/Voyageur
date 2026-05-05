from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
import time
import uuid
from app.services.travel_service import (
    get_crime_risk_by_coords, 
    get_all_district_risks, 
    get_districts_in_state,
    get_multiple_routes,
)
from app.services.hospital_service import get_nearby_hospitals
from app.services.route_scoring_service import get_route_scoring_service, RouteScoringService
from app.schemas.route import (
    SafeRouteRequest,
    SafeRouteResponse,
    RouteResponse,
    RouteComparison,
    RouteErrorResponse,
)
from app.api.v1.dependencies import get_current_user

router = APIRouter()

@router.get("/crime-risk")
async def crime_risk_by_coords(lat: float, lng: float):
    return await get_crime_risk_by_coords(lat, lng)

@router.get("/districts-in-state")
async def districts_in_state(lat: float, lng: float):
    """Get all districts in the detected state with their crime data."""
    return await get_districts_in_state(lat, lng)

@router.get("/districts")
async def all_districts():
    return get_all_district_risks()

@router.get("/hospitals")
async def nearby_hospitals(lat: float, lng: float, radius: float = 30, limit: int = 5):
    return get_nearby_hospitals(lat, lng, radius, limit)

@router.post(
    "/routes/safe",
    response_model=SafeRouteResponse,
    responses={
        400: {"model": RouteErrorResponse, "description": "Invalid request parameters"},
        422: {"model": RouteErrorResponse, "description": "Validation error"},
        500: {"model": RouteErrorResponse, "description": "Internal server error"},
        503: {"model": RouteErrorResponse, "description": "Service unavailable"},
    }
)
async def compute_safe_routes(
    request: SafeRouteRequest,
    route_scoring_service: RouteScoringService = Depends(get_route_scoring_service),
    current_user = Depends(get_current_user)
):
    """
    Compute safest route between two points with alternatives.
    
    This endpoint analyzes multiple route alternatives, scores them based on safety data,
    and returns ranked routes with safety information.
    
    Request body should include origin and destination coordinates, with optional
    parameters for number of alternatives and route preference.
    
    Rate limiting: This endpoint is subject to rate limiting (10 requests per minute per user).
    """
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
                    summary=summary,
                    steps=getattr(route, 'steps', None) or [],
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
        
        # ── Two routes: Normal (fastest from OSRM) + Safest (lowest risk score) ──
        # Score is 1–10: 1 = lowest risk (safest), 10 = highest risk
        # Sort ascending: lowest risk score first
        scored_routes.sort(key=lambda x: x.safety_score)

        # Normal route = shortest duration
        normal_route = min(scored_routes, key=lambda r: r.duration)
        normal_route.type = "alternative"
        normal_route.summary = f"Normal route ({normal_route.duration / 60:.1f} min)"

        # Safest route = lowest risk score (first after ascending sort)
        safest_route = scored_routes[0]
        safest_route.type = "safest"
        safest_route.summary = f"Safest route (risk: {safest_route.safety_score}/10)"

        # Deduplicate: treat routes as the same if distance differs by <3%
        # (handles via-point alternatives that end up on the same road)
        def routes_are_same(r1, r2) -> bool:
            if r1 is r2:
                return True
            max_dist = max(r1.distance, r2.distance, 1)
            return abs(r1.distance - r2.distance) / max_dist < 0.03

        if routes_are_same(safest_route, normal_route):
            final_routes = [safest_route]
        else:
            final_routes = [safest_route, normal_route]

        # Generate comparison metrics
        comparison = None
        if len(final_routes) == 2:
            s, n = final_routes[0], final_routes[1]
            comparison = RouteComparison(
                safety_difference=s.safety_score - n.safety_score,
                time_penalty=s.duration - n.duration,
                distance_penalty=s.distance - n.distance,
                safety_per_time_ratio=(
                    (s.safety_score - n.safety_score) / (s.duration - n.duration)
                    if s.duration != n.duration else None
                )
            )

        processing_time = (time.time() - start_time) * 1000

        print(f"[SAFE ROUTES] Request {request_id} completed in {processing_time:.0f}ms: "
              f"{len(final_routes)} routes, safest risk: {safest_route.safety_score}/10")

        return SafeRouteResponse(
            routes=final_routes,
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