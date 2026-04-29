# Design Document

## Introduction

This document outlines the technical design for implementing intelligent safest route computation in the Voyageur travel app. The design builds upon existing routing infrastructure while adding sophisticated safety scoring and multi-route comparison capabilities.

## System Architecture

### Current Architecture Overview
- **Frontend**: React with Leaflet/React-Leaflet for mapping, OSRM for routing
- **Backend**: FastAPI with modular services (travel_service.py handles safety data)
- **Data**: Crime/safety scores stored in processed_crime_data.csv
- **Routing**: OSRM API for route generation

### Enhanced Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend       │    │   Backend API   │    │   External      │
│   (React)        │◄──►│   (FastAPI)     │◄──►│   Services      │
│                 │    │                 │    │                 │
│  • CrimeMap     │    │  • /routes/safe │    │  • OSRM Routing │
│  • RouteDisplay │    │  • RouteScoring │    │  • Nominatim    │
│  • SafetyUI     │    │  • SafetyService│    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Data Layer    │
                       │                 │
                       │  • Crime CSV    │
                       │  • In-memory    │
                       │    Index        │
                       └─────────────────┘
```

## Component Design

### 1. Backend Route Scoring Service

**New Module**: `app/services/route_scoring_service.py`

```python
class RouteScoringService:
    """Core service for scoring route safety"""
    
    def __init__(self, crime_data_service):
        self.crime_service = crime_data_service
        self.segment_length = 0.01  # ~1km segments for analysis
        
    async def score_route(self, polyline: str, route_metadata: dict) -> RouteScore:
        """Score a single route based on safety data"""
        # Decode polyline to coordinates
        coordinates = self.decode_polyline(polyline)
        
        # Split into segments
        segments = self.split_into_segments(coordinates)
        
        # Score each segment
        segment_scores = []
        for segment in segments:
            score = await self.score_segment(segment)
            segment_scores.append(score)
        
        # Compute weighted final score
        total_score = self.compute_weighted_score(segment_scores, route_metadata)
        
        # Apply penalties
        total_score = self.apply_penalties(total_score, segment_scores)
        
        # Normalize to 0-100 range
        normalized_score = self.normalize_score(total_score)
        
        return RouteScore(
            raw_score=total_score,
            normalized_score=normalized_score,
            risk_level=self.determine_risk_level(normalized_score),
            segment_details=segment_scores
        )
    
    async def score_segment(self, segment: RouteSegment) -> SegmentScore:
        """Score a single route segment"""
        # Find nearest safety data points
        safety_data = await self.find_nearest_safety_data(segment.midpoint)
        
        # Calculate base safety score
        base_score = safety_data.normalized_score if safety_data else 50  # Default
        
        # Adjust for segment length (longer exposure = higher weight)
        weighted_score = base_score * segment.length_weight
        
        return SegmentScore(
            coordinates=segment.coordinates,
            safety_data=safety_data,
            base_score=base_score,
            weighted_score=weighted_score,
            has_data=bool(safety_data)
        )
```

### 2. Multi-Route Generator

**Enhanced Module**: `app/services/travel_service.py` (additions)

```python
async def get_multiple_routes(
    origin_lat: float, 
    origin_lng: float,
    dest_lat: float, 
    dest_lng: float,
    alternatives: int = 3
) -> List[RouteAlternative]:
    """Get multiple route alternatives from OSRM"""
    
    # Build OSRM request for multiple alternatives
    coords = f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
    url = f"https://router.project-osrm.org/route/v1/driving/{coords}"
    
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "true",
        "alternatives": str(alternatives)
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params)
        data = response.json()
    
    routes = []
    for i, route_data in enumerate(data.get("routes", [])):
        route = RouteAlternative(
            geometry=route_data["geometry"],
            distance=route_data["distance"],
            duration=route_data["duration"],
            polyline=route_data.get("geometry", {}).get("coordinates", []),
            is_fastest=(i == 0)  # OSRM returns fastest first
        )
        routes.append(route)
    
    return routes
```

### 3. Safety Data Index

**New Module**: `app/services/safety_data_index.py`

```python
class SafetyDataIndex:
    """Efficient spatial index for safety data lookup"""
    
    def __init__(self):
        self.kd_tree = None  # KD-tree for nearest neighbor search
        self.grid_index = {}  # Grid-based index for faster lookups
        self.data_points = []  # List of (lat, lng, safety_score)
        
    def build_index(self, crime_df: pd.DataFrame):
        """Build spatial index from crime data"""
        # Extract points with coordinates
        for _, row in crime_df.iterrows():
            # Use district centroids or approximate coordinates
            point = self.get_coordinates_for_district(row['DISTRICT'])
            if point:
                self.data_points.append({
                    'lat': point[0],
                    'lng': point[1],
                    'score': row['RISK_SCORE'],
                    'normalized': row['NORMALIZED_SCORE'],
                    'level': row['RISK_LEVEL']
                })
        
        # Build KD-tree for nearest neighbor searches
        if self.data_points:
            points = [(p['lat'], p['lng']) for p in self.data_points]
            self.kd_tree = KDTree(points)
            
        # Build grid index (10km grid cells)
        self.build_grid_index()
    
    def find_nearest(self, lat: float, lng: float, max_distance_km: float = 50):
        """Find nearest safety data point within max distance"""
        if not self.kd_tree:
            return None
            
        # Query KD-tree
        distances, indices = self.kd_tree.query([(lat, lng)], k=1)
        
        if distances[0] < max_distance_km / 111.32:  # Convert km to degrees
            return self.data_points[indices[0]]
        return None
    
    def build_grid_index(self):
        """Build grid-based index for faster approximate lookups"""
        grid_size = 0.09  # ~10km grid cells
        
        for point in self.data_points:
            grid_key = (
                int(point['lat'] / grid_size),
                int(point['lng'] / grid_size)
            )
            
            if grid_key not in self.grid_index:
                self.grid_index[grid_key] = []
            self.grid_index[grid_key].append(point)
```

### 4. Frontend Route Display Component

**New Component**: `Frontend/client/src/components/RouteSafetyDisplay.jsx`

```jsx
const RouteSafetyDisplay = ({ routes, onRouteSelect, activeRouteId }) => {
    const [selectedTab, setSelectedTab] = useState('safest');
    
    // Sort routes by safety score
    const sortedRoutes = [...routes].sort((a, b) => 
        b.safety_score - a.safety_score
    );
    
    const safestRoute = sortedRoutes[0];
    const fastestRoute = routes.find(r => r.is_fastest);
    
    return (
        <div className="route-safety-container">
            <div className="route-tabs">
                <button 
                    className={`tab ${selectedTab === 'safest' ? 'active' : ''}`}
                    onClick={() => setSelectedTab('safest')}
                >
                    🛡️ Safest
                </button>
                <button 
                    className={`tab ${selectedTab === 'fastest' ? 'active' : ''}`}
                    onClick={() => setSelectedTab('fastest')}
                >
                    ⚡ Fastest
                </button>
                <button 
                    className={`tab ${selectedTab === 'balanced' ? 'active' : ''}`}
                    onClick={() => setSelectedTab('balanced')}
                >
                    ⚖️ Balanced
                </button>
            </div>
            
            <div className="route-list">
                {sortedRoutes.map((route, index) => (
                    <RouteCard 
                        key={route.id}
                        route={route}
                        isActive={route.id === activeRouteId}
                        onSelect={() => onRouteSelect(route.id)}
                        rank={index + 1}
                        isSafest={index === 0}
                        isFastest={route.is_fastest}
                    />
                ))}
            </div>
            
            <div className="safety-info">
                <div className="info-item">
                    <span className="label">Safety Score:</span>
                    <span className={`value score-${safestRoute.risk_level}`}>
                        {safestRoute.safety_score}/100
                    </span>
                </div>
                <div className="info-item">
                    <span className="label">Risk Level:</span>
                    <span className={`value risk-${safestRoute.risk_level}`}>
                        {safestRoute.risk_level.toUpperCase()}
                    </span>
                </div>
                <div className="info-item">
                    <span className="label">Trade-off:</span>
                    <span className="value">
                        {safestRoute.duration > fastestRoute.duration * 1.3 
                            ? `+${Math.round((safestRoute.duration / fastestRoute.duration - 1) * 100)}% longer`
                            : 'Minimal time penalty'
                        }
                    </span>
                </div>
            </div>
        </div>
    );
};
```

### 5. API Endpoint Design

**New Endpoint**: `/api/v1/routes/safe` (add to travel.py)

```python
@router.post("/routes/safe")
async def compute_safe_routes(
    request: SafeRouteRequest,
    route_scoring_service: RouteScoringService = Depends(get_route_scoring_service)
):
    """
    Compute safest route between two points with alternatives.
    
    Request:
    {
        "origin": {"lat": 17.385044, "lng": 78.486671},
        "destination": {"lat": 17.448117, "lng": 78.391129},
        "alternatives": 3,
        "preference": "safety"  # safety|balanced|speed
    }
    
    Response:
    {
        "routes": [
            {
                "type": "safest",
                "geometry": {...},
                "distance": 12345,
                "duration": 1800,
                "safety_score": 82,
                "risk_level": "low",
                "is_fastest": false,
                "summary": "Safest route with minimal risk zones"
            },
            {
                "type": "fastest",
                "geometry": {...},
                "distance": 9876,
                "duration": 1500,
                "safety_score": 65,
                "risk_level": "medium",
                "is_fastest": true,
                "summary": "Fastest route passes through moderate risk areas"
            }
        ],
        "comparison": {
            "safety_difference": 17,
            "time_penalty": 300,
            "distance_penalty": 2469
        }
    }
    """
    
    # Get multiple route alternatives
    routes = await get_multiple_routes(
        request.origin.lat, request.origin.lng,
        request.destination.lat, request.destination.lng,
        request.alternatives
    )
    
    # Score each route
    scored_routes = []
    for route in routes:
        score = await route_scoring_service.score_route(
            route.polyline,
            {"distance": route.distance, "duration": route.duration}
        )
        
        scored_route = {
            **route.to_dict(),
            "safety_score": score.normalized_score,
            "risk_level": score.risk_level,
            "segment_details": score.segment_details
        }
        scored_routes.append(scored_route)
    
    # Sort by safety score
    scored_routes.sort(key=lambda x: x["safety_score"], reverse=True)
    
    # Identify route types
    fastest_idx = next(i for i, r in enumerate(scored_routes) if r["is_fastest"])
    safest_idx = 0  # First after sorting
    
    # Add type labels
    scored_routes[safest_idx]["type"] = "safest"
    scored_routes[fastest_idx]["type"] = "fastest"
    
    # Generate comparison metrics
    comparison = {
        "safety_difference": scored_routes[safest_idx]["safety_score"] - scored_routes[fastest_idx]["safety_score"],
        "time_penalty": scored_routes[safest_idx]["duration"] - scored_routes[fastest_idx]["duration"],
        "distance_penalty": scored_routes[safest_idx]["distance"] - scored_routes[fastest_idx]["distance"]
    }
    
    return {
        "routes": scored_routes,
        "comparison": comparison
    }
```

## Data Models

### Pydantic Schemas

```python
# app/schemas/route.py
from pydantic import BaseModel
from typing import List, Optional, Literal

class Coordinate(BaseModel):
    lat: float
    lng: float

class SafeRouteRequest(BaseModel):
    origin: Coordinate
    destination: Coordinate
    alternatives: int = 3
    preference: Literal["safety", "balanced", "speed"] = "safety"
    time_of_day: Optional[str] = None  # "day" or "night"

class RouteSegment(BaseModel):
    coordinates: List[Coordinate]
    safety_score: float
    risk_level: str
    has_data: bool

class RouteScore(BaseModel):
    raw_score: float
    normalized_score: float  # 0-100
    risk_level: Literal["low", "medium", "high"]
    segment_details: List[RouteSegment]

class RouteResponse(BaseModel):
    type: Literal["safest", "fastest", "alternative"]
    geometry: dict  # GeoJSON geometry
    distance: float  # meters
    duration: float  # seconds
    safety_score: float
    risk_level: str
    is_fastest: bool
    summary: str
    segments: Optional[List[RouteSegment]] = None
```

## Algorithm Details

### Safety Scoring Algorithm

```
Algorithm: compute_route_safety_score
Input: polyline (encoded coordinates), route_metadata
Output: normalized_score (0-100), risk_level

1. DECODE polyline to list of (lat, lng) points
2. SPLIT points into segments of length ~1km
3. FOR EACH segment:
   a. FIND nearest safety data point within 50km
   b. IF found: base_score = normalized_safety_score
      ELSE: base_score = 50 (neutral), mark_uncertainty
   c. weighted_score = base_score × segment_length_weight
   d. STORE segment_score
4. COMPUTE total_score = Σ(weighted_scores)
5. APPLY penalties:
   a. high_risk_penalty = count(high_risk_segments) × 10
   b. isolation_penalty = count(no_data_segments) × 5
6. NORMALIZE to 0-100 range using min-max scaling
7. DETERMINE risk_level:
   IF normalized_score ≥ 80: "low"
   ELSE IF normalized_score ≥ 50: "medium"
   ELSE: "high"
8. RETURN normalized_score, risk_level, segment_details
```

### Segment Weighting Formula

```
segment_length_weight = 1 + (segment_length / total_route_length) × 2

Rationale: Longer segments have proportionally more influence on overall score.
Doubling factor ensures significant routes aren't diluted by many small segments.
```

## Performance Considerations

1. **Spatial Indexing**: Use KD-tree for O(log n) nearest neighbor lookups
2. **Caching**: Cache safety data index in memory (singleton pattern)
3. **Batch Processing**: Process multiple route alternatives in parallel
4. **Lazy Loading**: Only compute segment details when requested
5. **Response Size**: Limit segment details in default response, provide optional detail parameter

## Error Handling

1. **Routing Service Failure**: Fall back to single route with warning
2. **Missing Safety Data**: Mark segments as uncertain, continue scoring
3. **Invalid Coordinates**: Return descriptive error with validation details
4. **Rate Limiting**: Implement exponential backoff for external API calls

## Testing Strategy

### Unit Tests
- Route scoring algorithm with mock safety data
- Spatial index correctness
- Edge cases (no data, all high risk, very short routes)

### Integration Tests
- End-to-end route computation
- OSRM API integration
- Frontend-backend data flow

### Property-Based Tests
- Round-trip: decode(polyline) → score → encode should preserve properties
- Monotonicity: Adding safe segments should not decrease score
- Bounds: Scores always between 0-100
- Consistency: Same route always gets same score

## Dependencies

### New Backend Dependencies
```
# requirements.txt additions
scipy>=1.10.0  # For KD-tree implementation
numpy>=1.24.0  # For numerical operations
```

### Frontend Dependencies
```
# package.json additions (if not already present)
leaflet-routing-machine  # For alternative route display
react-leaflet>=4.0.0    # Ensure compatibility
```

## Migration Plan

1. **Phase 1**: Implement backend scoring service and API endpoint
2. **Phase 2**: Enhance frontend to display multiple routes
3. **Phase 3**: Add safety scoring visualization and UI controls
4. **Phase 4**: Implement advanced features (time-based adjustments, heatmap)

Each phase is independently deployable and backward compatible.

## Assumptions and Constraints

1. **Data Coverage**: Safety data covers major districts but may have gaps
2. **Performance**: Route computation should complete within 3 seconds
3. **Scale**: Designed for single-region deployment (India/Andhra Pradesh/Telangana)
4. **External Services**: Relies on OSRM and Nominatim which have rate limits
5. **Browser Support**: Requires modern browsers with WebGL for advanced visualizations