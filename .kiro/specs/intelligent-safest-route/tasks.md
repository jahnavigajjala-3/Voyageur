# Tasks Document

## Overview
Implementation tasks for intelligent safest route feature in Voyageur travel app.

## Task List

### 1. Backend Safety Data Infrastructure
- [x] **1.1 Create SafetyDataIndex class**
  - Implement KD-tree spatial indexing for crime data
  - Add grid-based fallback index for approximate lookups
  - Build index from processed_crime_data.csv
  - Add nearest neighbor search within max distance

- [x] **1.2 Create RouteScoringService class**
  - Implement polyline decoding (Google Polyline Algorithm)
  - Add route segmentation logic (~1km segments)
  - Implement weighted scoring algorithm
  - Add penalty calculations (high-risk, isolation)
  - Implement score normalization (0-100 range)
  - Add risk level determination (low/medium/high)

- [x] **1.3 Enhance travel_service.py for multi-route generation**
  - Modify get_multiple_routes function to request alternatives from OSRM
  - Parse OSRM response with multiple route alternatives
  - Preserve existing single-route functionality
  - Add error handling for OSRM failures

### 2. Backend API Endpoints
- [x] **2.1 Create /routes/safe endpoint**
  - Add POST endpoint to travel.py router
  - Implement request validation with Pydantic schemas
  - Integrate multi-route generation and scoring
  - Format response with route comparisons
  - Add error handling and rate limiting

- [x] **2.2 Create route schemas**
  - Define Coordinate, SafeRouteRequest, RouteSegment Pydantic models
  - Create RouteScore and RouteResponse models
  - Add validation for coordinate ranges
  - Include optional parameters (time_of_day, preference)

- [x] **2.3 Add dependency injection for services**
  - Create get_route_scoring_service dependency
  - Add safety_data_index singleton initialization
  - Implement service lifecycle management
  - Add configuration for external API timeouts

### 3. Frontend Route Display Components
- [x] **3.1 Create RouteSafetyDisplay component**
  - Implement route card UI with safety scores
  - Add tabbed interface (Safest/Fastest/Balanced)
  - Create comparison metrics display
  - Add route selection callbacks
  - Implement responsive design for mobile/desktop

- [x] **3.2 Enhance CrimeMap component for multi-route display**
  - Modify RoutingMachine to handle multiple polylines
  - Add route styling (green for safest, grey/blue for others)
  - Implement route highlighting on selection
  - Add popups with safety information
  - Preserve existing single-route functionality

- [x] **3.3 Create route filtering controls**
  - Add toggle buttons for route preferences
  - Implement real-time route filtering
  - Add safety score visualization (progress bars, color coding)
  - Create legend component explaining safety levels

### 4. Frontend API Integration
- [x] **4.1 Add safe route API calls to api.js**
  - Create getSafeRoutes function with origin/destination parameters
  - Add error handling for API failures
  - Implement loading states and retry logic
  - Add request cancellation for rapid user input

- [x] **4.2 Create route state management**
  - Implement route selection state in CrimeMap
  - Add route comparison state management
  - Create safety score caching mechanism
  - Add user preference persistence (safety vs speed)

- [x] **4.3 Enhance dashboard.jsx for route planning**
  - Add safe route planning UI to dashboard
  - Integrate with existing location input components
  - Add safety visualization panel
  - Implement route history and favorites

### 5. Advanced Features
- [ ] **5.1 Implement time-based safety adjustments**
  - Add time_of_day parameter to scoring algorithm
  - Create night-time penalty multipliers
  - Implement timezone-aware time detection
  - Add UI toggle for day/night mode

- [ ] **5.2 Add safety heatmap overlay**
  - Create heatmap layer component for CrimeMap
  - Implement gradient coloring based on safety scores
  - Add toggle control for heatmap visibility
  - Optimize heatmap rendering performance

- [ ] **5.3 Create route export and sharing**
  - Add route sharing functionality
  - Implement route export as GPX/GeoJSON
  - Add safety report generation
  - Create shareable route links

### 6. Testing and Quality Assurance
- [ ] **6.1 Write unit tests for scoring algorithm**
  - Test score normalization and bounds
  - Test penalty calculations
  - Test edge cases (no data, all high risk)
  - Test consistency properties

- [ ] **6.2 Write integration tests for API endpoints**
  - Test /routes/safe endpoint with mock data
  - Test error handling and validation
  - Test performance under load
  - Test backward compatibility

- [ ] **6.3 Write property-based tests**
  - Round-trip property: decode → score → encode consistency
  - Monotonicity: Adding safe segments shouldn't decrease score
  - Bounds: Scores always 0-100
  - Idempotence: Same input → same output

- [ ] **6.4 Performance testing**
  - Test route computation time (< 3 seconds)
  - Test memory usage with large datasets
  - Test concurrent user handling
  - Test browser rendering performance

### 7. Documentation and Deployment
- [ ] **7.1 Update API documentation**
  - Document /routes/safe endpoint in OpenAPI/Swagger
  - Add examples for request/response
  - Document error codes and troubleshooting
  - Update README with new features

- [ ] **7.2 Create user documentation**
  - Add safety scoring explanation to UI tooltips
  - Create help section for route planning
  - Add tutorial for new safety features
  - Document data sources and limitations

- [ ] **7.3 Deployment preparation**
  - Update requirements.txt with new dependencies
  - Add environment variables for configuration
  - Create database migrations if needed
  - Update deployment scripts

- [ ] **7.4 Monitoring and analytics**
  - Add metrics for route computation times
  - Track safety feature usage
  - Monitor error rates and performance
  - Add user feedback collection

## Task Dependencies
```
1.1 → 1.2 → 1.3 → 2.1 → 2.2 → 2.3
1.1 → 3.2 → 3.1 → 3.3 → 4.1 → 4.2 → 4.3
5.1 → 5.2 → 5.3
6.1 → 6.2 → 6.3 → 6.4
7.1 → 7.2 → 7.3 → 7.4
```

## Success Criteria
- All requirements from requirements.md are implemented
- Design specifications from design.md are followed
- Backward compatibility maintained with existing routing
- Performance targets met (< 3s response time)
- Test coverage > 80% for new code
- No breaking changes to existing APIs
- User documentation complete and accurate