"""
Route schemas for intelligent safest route feature.

Validates: Requirements 4 (Backend Safe Route Endpoint)
Validates: Requirements 3 (Route Selection and Ranking)
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Literal, Dict, Any
from enum import Enum


class Coordinate(BaseModel):
    """Geographic coordinate with validation"""
    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude between -90 and 90")
    lng: float = Field(..., ge=-180.0, le=180.0, description="Longitude between -180 and 180")
    
    @validator('lat', 'lng')
    def check_coordinate_precision(cls, v):
        """Ensure coordinates have reasonable precision"""
        if abs(v) > 180:
            raise ValueError(f"Coordinate value {v} is outside valid range")
        return round(v, 6)  # Limit to 6 decimal places (~0.1m precision)


class TimeOfDay(str, Enum):
    """Time of day for safety adjustments"""
    DAY = "day"
    NIGHT = "night"


class RoutePreference(str, Enum):
    """User preference for route selection"""
    SAFETY = "safety"
    BALANCED = "balanced"
    SPEED = "speed"


class SafeRouteRequest(BaseModel):
    """Request model for safe route computation"""
    origin: Coordinate
    destination: Coordinate
    alternatives: int = Field(default=3, ge=1, le=5, description="Number of alternative routes (1-5)")
    preference: RoutePreference = Field(default=RoutePreference.SAFETY, description="Route selection preference")
    time_of_day: Optional[TimeOfDay] = Field(default=None, description="Time of day for safety adjustments")
    
    @validator('origin', 'destination')
    def check_valid_coordinates(cls, v):
        """Ensure coordinates are valid geographic points"""
        # Check for obviously invalid coordinates (like 0,0 in the middle of the ocean)
        if abs(v.lat) < 0.1 and abs(v.lng) < 0.1:
            raise ValueError("Coordinates appear to be at null island (0,0)")
        return v
    
    @validator('alternatives')
    def check_alternatives(cls, v):
        """Ensure alternatives is reasonable"""
        if v < 1:
            raise ValueError("At least 1 alternative route must be requested")
        if v > 5:
            raise ValueError("Maximum 5 alternative routes allowed for performance")
        return v


class RouteSegment(BaseModel):
    """Safety data for a route segment"""
    coordinates: List[Coordinate]
    safety_score: float = Field(..., ge=0.0, le=100.0, description="Segment safety score 0-100")
    risk_level: Literal["low", "medium", "high"]
    has_data: bool = Field(..., description="Whether safety data was available for this segment")
    distance_km: float = Field(..., ge=0.0, description="Segment length in kilometers")


class RouteScore(BaseModel):
    """Complete score for a route"""
    raw_score: float = Field(..., description="Raw computed score before normalization")
    normalized_score: float = Field(..., ge=0.0, le=10.0, description="Risk score 1-10 (1=safest, 10=most dangerous)")
    risk_level: Literal["low", "medium", "high"] = Field(..., description="Overall route risk level")
    segment_details: Optional[List[RouteSegment]] = Field(default=None, description="Detailed segment scores")
    high_risk_segments: int = Field(default=0, ge=0, description="Number of high-risk segments")
    uncertain_segments: int = Field(default=0, ge=0, description="Number of segments without safety data")


class RouteResponse(BaseModel):
    """Response model for a single route"""
    type: Literal["safest", "fastest", "balanced", "alternative"] = Field(..., description="Route type classification")
    geometry: Dict[str, Any] = Field(..., description="GeoJSON geometry object")
    distance: float = Field(..., ge=0.0, description="Route distance in meters")
    duration: float = Field(..., ge=0.0, description="Route duration in seconds")
    safety_score: float = Field(..., ge=0.0, le=10.0, description="Risk score 1-10 (1=safest, 10=most dangerous)")
    risk_level: Literal["low", "medium", "high"] = Field(..., description="Overall risk level")
    is_fastest: bool = Field(..., description="Whether this is the fastest route")
    summary: str = Field(..., description="Brief route summary")
    segments: Optional[List[RouteSegment]] = Field(default=None, description="Detailed segment information")
    steps: Optional[List[Dict[str, Any]]] = Field(default=None, description="OSRM turn-by-turn steps")

    @validator('safety_score')
    def check_safety_score_range(cls, v):
        """Ensure risk score is in valid range"""
        if v < 0 or v > 10:
            raise ValueError(f"Risk score {v} must be between 0 and 10")
        return v


class RouteComparison(BaseModel):
    """Comparison metrics between safest and fastest routes"""
    safety_difference: float = Field(..., description="Difference in safety scores (safest - fastest)")
    time_penalty: float = Field(..., description="Additional time for safest route (seconds)")
    distance_penalty: float = Field(..., description="Additional distance for safest route (meters)")
    safety_per_time_ratio: Optional[float] = Field(default=None, description="Safety gain per second of time penalty")
    
    @validator('safety_per_time_ratio')
    def calculate_safety_per_time(cls, v, values):
        """Calculate safety gain per time penalty if not provided"""
        if v is None and 'time_penalty' in values and values['time_penalty'] > 0:
            safety_diff = values.get('safety_difference', 0)
            time_penalty = values['time_penalty']
            return safety_diff / time_penalty if time_penalty > 0 else 0
        return v


class SafeRouteResponse(BaseModel):
    """Complete response for safe route computation"""
    routes: List[RouteResponse] = Field(..., description="List of scored route alternatives")
    comparison: Optional[RouteComparison] = Field(default=None, description="Comparison between routes")
    request_id: Optional[str] = Field(default=None, description="Unique identifier for this request")
    processing_time_ms: Optional[float] = Field(default=None, description="Time taken to compute routes")
    
    @validator('routes')
    def check_routes_not_empty(cls, v):
        """Ensure at least one route is returned"""
        if not v:
            raise ValueError("At least one route must be returned")
        return v


class RouteErrorResponse(BaseModel):
    """Error response for route computation failures"""
    error: str = Field(..., description="Error message")
    error_code: str = Field(..., description="Error code for client handling")
    suggestion: Optional[str] = Field(default=None, description="Suggested action or workaround")
    request_id: Optional[str] = Field(default=None, description="Request identifier for debugging")
    
    class Config:
        schema_extra = {
            "example": {
                "error": "Failed to connect to routing service",
                "error_code": "ROUTING_SERVICE_UNAVAILABLE",
                "suggestion": "Please try again in a few moments",
                "request_id": "req_123456789"
            }
        }