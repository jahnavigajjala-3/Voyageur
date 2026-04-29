/**
 * Type definitions for route data structures
 * 
 * These types match the backend response from /routes/safe endpoint
 * and are used by both CrimeMap and RouteSafetyDisplay components.
 */

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface RouteSegment {
  coordinates: Coordinate[];
  safety_score: number;
  risk_level: 'low' | 'medium' | 'high';
  has_data: boolean;
  distance_km: number;
}

export interface RouteResponse {
  id?: string;
  type: 'safest' | 'fastest' | 'alternative';
  geometry: {
    type: string;
    coordinates: number[][];
  };
  distance: number; // meters
  duration: number; // seconds
  safety_score: number; // 0-100
  risk_level: 'low' | 'medium' | 'high';
  is_fastest: boolean;
  summary?: string;
  segments?: RouteSegment[];
}

export interface RouteComparison {
  safety_difference: number;
  time_penalty: number; // seconds
  distance_penalty: number; // meters
  safety_per_time_ratio?: number;
}

export interface SafeRouteResponse {
  routes: RouteResponse[];
  comparison?: RouteComparison;
  request_id?: string;
  processing_time_ms?: number;
}

export interface SafeRouteRequest {
  origin: Coordinate;
  destination: Coordinate;
  alternatives?: number;
  preference?: 'safety' | 'balanced' | 'speed';
  time_of_day?: 'day' | 'night';
}

/**
 * Route card props for RouteSafetyDisplay component
 */
export interface RouteCardProps {
  route: RouteResponse;
  isActive: boolean;
  onSelect: () => void;
  rank: number;
  isSafest: boolean;
  isFastest: boolean;
}

/**
 * RouteSafetyDisplay component props
 */
export interface RouteSafetyDisplayProps {
  routes: RouteResponse[];
  onRouteSelect?: (routeId: string) => void;
  activeRouteId?: string | null;
  isLoading?: boolean;
}