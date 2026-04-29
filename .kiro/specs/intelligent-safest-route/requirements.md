# Requirements Document

## Introduction

The Voyageur travel app currently provides basic routing functionality with safety data overlays. This feature upgrade introduces intelligent safest route computation that analyzes multiple alternative routes, scores them based on safety data, and presents users with the safest route option alongside traditional fastest routes.

## Glossary

- **System**: The Voyageur application backend and frontend components
- **Route_Provider**: External routing service (OSRM/Leaflet) that generates route alternatives
- **Safety_Dataset**: Crime/safety scores by location stored in processed_crime_data.csv
- **Route_Segment**: Small portion of a route defined by consecutive coordinate points
- **Safety_Score**: Normalized score (0-100) representing route safety, where higher is safer
- **Risk_Level**: Categorical classification (low/medium/high) based on safety score
- **Polyline**: Encoded sequence of latitude/longitude points representing a route
- **Weighted_Scoring**: Algorithm that combines segment safety scores with length-based weights
- **Uncertainty_Marker**: Indicator for areas with missing safety dataset coverage

## Requirements

### Requirement 1: Multi-Route Generation

**User Story:** As a traveler, I want to see multiple route alternatives between two points, so that I can choose the safest option rather than just the fastest.

#### Acceptance Criteria

1. WHEN a user requests a route between origin and destination, THE Route_Provider SHALL generate 2-3 alternative routes
2. FOR EACH generated route, THE Route_Provider SHALL include complete polyline/coordinate data
3. THE System SHALL preserve existing routing functionality while adding multi-route capability

### Requirement 2: Route Safety Scoring Algorithm

**User Story:** As a safety-conscious traveler, I want routes to be scored based on safety data, so I can understand which route is safest.

#### Acceptance Criteria

1. WHEN a route is generated, THE System SHALL decode its polyline into a list of latitude/longitude points
2. THE System SHALL split each route into small segments for granular safety analysis
3. FOR EACH segment, THE System SHALL map to the nearest safety dataset value using nearest-neighbor or grid mapping
4. THE System SHALL assign a safety score to each segment based on mapped safety data
5. THE System SHALL compute final route score using weighted scoring: RouteScore = Σ (segment_safety × segment_length_weight) + high_risk_penalty + isolation_penalty
6. THE System SHALL normalize all safety scores to a consistent range (0-100)
7. THE System SHALL heavily penalize routes passing through high-risk zones
8. THE System SHALL weight longer exposure to unsafe areas more than short exposure
9. IF safety dataset coverage is missing for an area, THE System SHALL mark it with uncertainty
10. THE System SHALL NOT assume unknown areas are safe

### Requirement 3: Route Selection and Ranking

**User Story:** As a user, I want to see ranked route options with clear safety information, so I can make informed travel decisions.

#### Acceptance Criteria

1. THE System SHALL rank all generated routes by safety score (highest to lowest)
2. THE System SHALL identify the safest route among alternatives
3. THE System SHALL identify the fastest route from routing API data
4. IF the safest route is significantly longer than the fastest route, THE System SHALL still show both options with comparative information
5. THE System SHALL provide route metadata including distance, duration, safety_score, and risk_level

### Requirement 4: Backend Safe Route Endpoint

**User Story:** As a frontend developer, I need a dedicated API endpoint for safe route computation, so I can integrate intelligent routing into the UI.

#### Acceptance Criteria

1. THE System SHALL create/extend endpoint: `/routes/safe` with POST method
2. WHEN the endpoint receives origin and destination coordinates, THE System SHALL return response format: { "routes": [ { "type": "safest", "geometry": [...], "distance": ..., "duration": ..., "safety_score": ..., "risk_level": "low/medium/high" }, { "type": "fastest", ... } ] }
3. THE System SHALL keep scoring logic modular in a separate service
4. THE System SHALL maintain backward compatibility with existing routing endpoints

### Requirement 5: Frontend Route Visualization

**User Story:** As a user, I want to visually compare route safety on the map, so I can easily identify the safest path.

#### Acceptance Criteria

1. THE System SHALL display multiple routes simultaneously on the map
2. THE System SHALL highlight the safest route with distinctive styling (green)
3. THE System SHALL display other routes with secondary styling (grey/blue)
4. FOR EACH displayed route, THE System SHALL show safety score (e.g., 82/100)
5. THE System SHALL label routes clearly: "Safest route" and "Faster but less safe"
6. THE System SHALL add toggle/filter controls: Fastest / Balanced / Safest
7. THE System SHALL add tooltip or info panel explaining: "Safety is estimated based on available data (road type, activity, risk zones)"

### Requirement 6: Advanced Safety Features

**User Story:** As a security-focused traveler, I want advanced safety considerations in routing, so I can travel more securely.

#### Acceptance Criteria

1. WHERE time-based adjustments are configured, THE System SHALL adjust safety scoring for day vs night travel
2. WHERE custom weighting is enabled, THE System SHALL penalize unsafe areas during route selection
3. THE System SHALL provide optional heatmap overlay of unsafe areas
4. THE System SHALL include legend explaining safety color coding (green → safe, red → risky)

### Requirement 7: Performance and Constraints

**User Story:** As a system administrator, I want the safest route feature to be performant and non-breaking, so existing users aren't affected.

#### Acceptance Criteria

1. THE System SHALL NOT break existing routing functionality
2. THE System SHALL optimize performance to avoid excessive API calls
3. THE System SHALL handle large safety datasets efficiently
4. THE System SHALL implement clean, modular, production-ready code
5. THE System SHALL maintain response times under 3 seconds for route computation
6. THE System SHALL implement proper error handling for routing service failures

### Requirement 8: Data Integration and Parser

**User Story:** As a data engineer, I need reliable parsing and integration of safety data with route geometry, so scoring is accurate.

#### Acceptance Criteria

1. THE Safety_Data_Parser SHALL parse processed_crime_data.csv into accessible data structures
2. THE Geometry_Mapper SHALL map route segments to nearest safety data points
3. THE Pretty_Printer SHALL format safety scores and risk levels for display
4. FOR ALL valid route segments, parsing then mapping then scoring SHALL produce consistent results (round-trip property)
5. WHEN invalid safety data is encountered, THE Parser SHALL return descriptive errors
6. THE System SHALL handle edge cases where safety data coverage is incomplete