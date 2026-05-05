"""
Route Scoring Service for Voyageur Travel App

This service implements intelligent route safety scoring using:
1. Google Polyline Algorithm decoding
2. Route segmentation for granular analysis
3. Weighted scoring with safety data integration
4. Penalty calculations for high-risk and isolated areas
5. Score normalization and risk level determination

Validates: Requirements 2 (Route Safety Scoring Algorithm)
Validates: Requirements 8 (Data Integration and Parser)
"""

import math
from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass
import asyncio

try:
    from .safety_data_index import SafetyDataPoint, get_safety_data_index
    SAFETY_INDEX_AVAILABLE = True
except ImportError:
    # Create a stub for SafetyDataPoint if not available
    class SafetyDataPoint:
        """Stub for SafetyDataPoint when safety_data_index is not available"""
        def __init__(self):
            self.lat = 0.0
            self.lng = 0.0
            self.normalized_score = 5.0
            self.district = ""
            self.state = ""
            self.risk_score = 0.0
            self.risk_level = "medium"
            self.marker_color = "#FFA500"
    
    SAFETY_INDEX_AVAILABLE = False
    print("[ROUTE SCORING] Warning: safety_data_index module not available")


@dataclass
class Coordinate:
    """Represents a geographic coordinate"""
    lat: float
    lng: float


@dataclass
class RouteSegment:
    """Represents a segment of a route for scoring"""
    coordinates: List[Coordinate]
    length_km: float
    midpoint: Coordinate
    safety_data: Optional[SafetyDataPoint] = None
    has_safety_data: bool = False
    distance_to_safety_data_km: float = float('inf')


@dataclass
class SegmentScore:
    """Score for a single route segment"""
    segment: RouteSegment
    base_score: float  # Raw safety score from data (0-100 scale)
    weighted_score: float  # Score adjusted by segment length weight
    is_high_risk: bool = False
    is_uncertain: bool = False  # No safety data available


@dataclass
class RouteScore:
    """Complete score for a route"""
    raw_score: float
    normalized_score: float  # 0-100 range
    risk_level: str  # "low", "medium", or "high"
    segment_scores: List[SegmentScore]
    total_distance_km: float
    segment_count: int
    high_risk_segments: int
    uncertain_segments: int
    penalties_applied: Dict[str, float]


class RouteScoringService:
    """Core service for scoring route safety"""
    
    def __init__(self, safety_data_index=None):
        """
        Initialize RouteScoringService
        
        Args:
            safety_data_index: Optional SafetyDataIndex instance. If None,
                              will try to get from singleton.
        """
        self.safety_index = safety_data_index
        if self.safety_index is None and SAFETY_INDEX_AVAILABLE:
            try:
                self.safety_index = get_safety_data_index()
            except Exception as e:
                print(f"[ROUTE SCORING] Failed to get safety index: {e}")
        
        # Configuration
        self.segment_length_km = 1.0  # Target segment length in km
        self.max_search_distance_km = 50.0  # Max distance to search for safety data
        self.high_risk_threshold = 30.0  # Scores below this are high risk
        self.medium_risk_threshold = 50.0  # Scores below this are medium risk
        
        # Penalty weights
        self.high_risk_penalty_weight = 10.0
        self.isolation_penalty_weight = 5.0
        self.uncertainty_penalty_weight = 3.0
        
        print(f"[ROUTE SCORING] Service initialized with segment length: {self.segment_length_km}km")
    
    def decode_polyline(self, polyline: str) -> List[Coordinate]:
        """
        Decode Google Polyline Algorithm encoded string.
        
        Implementation of Google's Polyline Algorithm Format:
        - Coordinates are encoded using ASCII characters
        - Each coordinate is encoded as a series of 5-bit chunks
        - Latitude and longitude are encoded separately
        - Each value is multiplied by 1e5, rounded, and encoded
        
        Args:
            polyline: Encoded polyline string
            
        Returns:
            List of Coordinate objects
            
        Raises:
            ValueError: If polyline is invalid or empty
        """
        if not polyline:
            raise ValueError("Polyline cannot be empty")
        
        coordinates = []
        index = 0
        lat = 0
        lng = 0
        
        while index < len(polyline):
            # Decode latitude
            b = 0
            shift = 0
            result = 0
            
            while True:
                if index >= len(polyline):
                    raise ValueError("Invalid polyline: incomplete latitude encoding")
                b = ord(polyline[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            
            # Two's complement handling
            if result & 1:
                delta = ~(result >> 1)
            else:
                delta = result >> 1
            
            lat += delta
            
            # Decode longitude
            b = 0
            shift = 0
            result = 0
            
            while True:
                if index >= len(polyline):
                    raise ValueError("Invalid polyline: incomplete longitude encoding")
                b = ord(polyline[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            
            # Two's complement handling
            if result & 1:
                delta = ~(result >> 1)
            else:
                delta = result >> 1
            
            lng += delta
            
            # Convert from 1e5 scale to decimal degrees
            coordinates.append(Coordinate(lat=lat / 1e5, lng=lng / 1e5))
        
        if not coordinates:
            raise ValueError("Failed to decode any coordinates from polyline")
        
        print(f"[ROUTE SCORING] Decoded {len(coordinates)} coordinates from polyline")
        return coordinates
    
    def _calculate_distance(self, coord1: Coordinate, coord2: Coordinate) -> float:
        """
        Calculate approximate distance between two coordinates in kilometers.
        
        Uses Haversine formula for accurate distance calculation.
        
        Args:
            coord1: First coordinate
            coord2: Second coordinate
            
        Returns:
            Distance in kilometers
        """
        # Earth radius in kilometers
        R = 6371.0
        
        lat1_rad = math.radians(coord1.lat)
        lat2_rad = math.radians(coord2.lat)
        delta_lat = math.radians(coord2.lat - coord1.lat)
        delta_lng = math.radians(coord2.lng - coord1.lng)
        
        a = (math.sin(delta_lat / 2) ** 2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * 
             math.sin(delta_lng / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    def split_into_segments(self, coordinates: List[Coordinate]) -> List[RouteSegment]:
        """
        Split route coordinates into segments of approximately target length.
        
        Args:
            coordinates: List of coordinates along the route
            
        Returns:
            List of RouteSegment objects
        """
        if len(coordinates) < 2:
            # For very short routes, create a single segment
            midpoint = coordinates[0] if coordinates else Coordinate(lat=0, lng=0)
            return [RouteSegment(
                coordinates=coordinates,
                length_km=0.0,
                midpoint=midpoint
            )]
        
        segments = []
        current_segment = [coordinates[0]]
        accumulated_distance = 0.0
        
        for i in range(1, len(coordinates)):
            prev_coord = coordinates[i - 1]
            curr_coord = coordinates[i]
            
            segment_distance = self._calculate_distance(prev_coord, curr_coord)
            accumulated_distance += segment_distance
            
            # Add current coordinate to segment
            current_segment.append(curr_coord)
            
            # If we've accumulated enough distance, finalize the segment
            if accumulated_distance >= self.segment_length_km:
                # Calculate segment midpoint (average of coordinates)
                mid_lat = sum(c.lat for c in current_segment) / len(current_segment)
                mid_lng = sum(c.lng for c in current_segment) / len(current_segment)
                
                segments.append(RouteSegment(
                    coordinates=current_segment.copy(),
                    length_km=accumulated_distance,
                    midpoint=Coordinate(lat=mid_lat, lng=mid_lng)
                ))
                
                # Start new segment with current coordinate
                current_segment = [curr_coord]
                accumulated_distance = 0.0
        
        # Add final segment if there are remaining coordinates
        if len(current_segment) > 1 or (segments and len(current_segment) == 1):
            # Calculate total distance for final segment
            final_distance = 0.0
            for i in range(1, len(current_segment)):
                final_distance += self._calculate_distance(
                    current_segment[i - 1], current_segment[i]
                )
            
            # Calculate midpoint
            mid_lat = sum(c.lat for c in current_segment) / len(current_segment)
            mid_lng = sum(c.lng for c in current_segment) / len(current_segment)
            
            segments.append(RouteSegment(
                coordinates=current_segment,
                length_km=final_distance,
                midpoint=Coordinate(lat=mid_lat, lng=mid_lng)
            ))
        
        print(f"[ROUTE SCORING] Split route into {len(segments)} segments")
        return segments
    
    def _get_safety_data_for_segment(self, segment: RouteSegment) -> Tuple[Optional[SafetyDataPoint], float]:
        """
        Get safety data for a route segment.
        
        Args:
            segment: RouteSegment to get safety data for
            
        Returns:
            Tuple of (SafetyDataPoint or None, distance in km)
        """
        if not self.safety_index:
            return None, float('inf')
        
        try:
            point, distance = self.safety_index.find_nearest_with_distance(
                segment.midpoint.lat,
                segment.midpoint.lng,
                self.max_search_distance_km
            )
            return point, distance
        except Exception as e:
            print(f"[ROUTE SCORING] Error getting safety data: {e}")
            return None, float('inf')
    
    async def score_segment(self, segment: RouteSegment, total_route_length: float) -> SegmentScore:
        """
        Score a single route segment.
        
        Args:
            segment: RouteSegment to score
            total_route_length: Total length of the route in km
            
        Returns:
            SegmentScore object
        """
        # Get safety data for segment
        safety_data, distance = self._get_safety_data_for_segment(segment)
        
        # Calculate base safety score
        if safety_data:
            # Use normalized score from safety data (already 0-100 scale)
            # Note: In safety_data_index, normalized_score is on 1-10 scale, 
            # but we need to convert to 0-100 for consistency
            base_score = safety_data.normalized_score * 10  # Convert 1-10 to 0-100
            has_data = True
            is_uncertain = False
        else:
            # No safety data available - use neutral score with uncertainty
            base_score = 50.0  # Neutral score on 0-100 scale
            has_data = False
            is_uncertain = True
        
        # Check if high risk
        is_high_risk = base_score < self.high_risk_threshold
        
        # Calculate segment weight based on length
        # Longer segments have more influence on overall score
        if total_route_length > 0:
            segment_weight = 1.0 + (segment.length_km / total_route_length) * 2.0
        else:
            segment_weight = 1.0
        
        # Calculate weighted score
        weighted_score = base_score * segment_weight
        
        # Update segment with safety data info
        segment.safety_data = safety_data
        segment.has_safety_data = has_data
        segment.distance_to_safety_data_km = distance
        
        return SegmentScore(
            segment=segment,
            base_score=base_score,
            weighted_score=weighted_score,
            is_high_risk=is_high_risk,
            is_uncertain=is_uncertain
        )

    async def score_route(self, polyline: str, route_metadata: Optional[Dict[str, Any]] = None) -> RouteScore:
        """
        Score a complete route.

        Returns a score on a 1–10 scale where:
          1 = lowest risk (safest)
          10 = highest risk (most dangerous)

        The score is stored in normalized_score for API compatibility.
        """
        print(f"[ROUTE SCORING] Starting route scoring for polyline length: {len(polyline)}")

        coordinates = self.decode_polyline(polyline)
        segments = self.split_into_segments(coordinates)
        total_distance = sum(s.length_km for s in segments)

        segment_scores = []
        for segment in segments:
            score = await self.score_segment(segment, total_distance)
            segment_scores.append(score)

        if not segment_scores:
            return RouteScore(
                raw_score=5.0,
                normalized_score=5.0,
                risk_level="medium",
                segment_scores=[],
                total_distance_km=total_distance,
                segment_count=0,
                high_risk_segments=0,
                uncertain_segments=0,
                penalties_applied={}
            )

        # ── Weighted average → safety score (higher = safer) ───────────────
        # base_score is 0–100 where 100 = safest (from safety_data.normalized_score * 10)
        # We keep it as a 1–10 safety score: 10 = safest, 1 = most dangerous
        total_weight = 0.0
        weighted_sum = 0.0
        for ss in segment_scores:
            w = max(ss.segment.length_km, 0.1)
            # base_score is 0–100; convert to 1–10 safety scale (10 = safest)
            safety_1_10 = max(1.0, min(10.0, ss.base_score / 10.0))
            weighted_sum += safety_1_10 * w
            total_weight += w

        safety_score = weighted_sum / total_weight if total_weight > 0 else 5.0
        safety_score = round(max(1.0, min(10.0, safety_score)), 1)

        risk_level = self._determine_risk_level_safety(safety_score)

        high_risk_count = sum(1 for ss in segment_scores if ss.is_high_risk)
        uncertain_count = sum(1 for ss in segment_scores if ss.is_uncertain)
        n = len(segment_scores)

        print(f"[ROUTE SCORING] Complete: {n} segments, {total_distance:.1f}km, "
              f"safety score: {safety_score}/10 ({risk_level}), "
              f"high-risk: {high_risk_count}, uncertain: {uncertain_count}")

        return RouteScore(
            raw_score=safety_score,
            normalized_score=safety_score,   # 1–10 safety scale (10 = safest)
            risk_level=risk_level,
            segment_scores=segment_scores,
            total_distance_km=total_distance,
            segment_count=n,
            high_risk_segments=high_risk_count,
            uncertain_segments=uncertain_count,
            penalties_applied={}
        )

    def _determine_risk_level_safety(self, score: float) -> str:
        """1–10 risk scale: 1–3.5 = low risk, 3.5–6.5 = medium, 6.5–10 = high"""
        if score <= 3.5:
            return "low"
        elif score <= 6.5:
            return "medium"
        else:
            return "high"
    
    def encode_polyline(self, coordinates: List[Coordinate]) -> str:
        """
        Encode coordinates to Google Polyline format.
        
        This is the inverse of decode_polyline, useful for testing.
        
        Args:
            coordinates: List of Coordinate objects
            
        Returns:
            Encoded polyline string
        """
        def _encode_number(value: int) -> str:
            """Encode a single number to polyline format"""
            value = value << 1
            if value < 0:
                value = ~value
            
            chunks = []
            while value >= 0x20:
                chunks.append(chr((0x20 | (value & 0x1F)) + 63))
                value >>= 5
            
            chunks.append(chr(value + 63))
            return ''.join(chunks)
        
        result = []
        prev_lat = 0
        prev_lng = 0
        
        for coord in coordinates:
            # Convert to 1e5 scale and round
            lat = int(round(coord.lat * 1e5))
            lng = int(round(coord.lng * 1e5))
            
            # Encode differences
            dlat = lat - prev_lat
            dlng = lng - prev_lng
            
            result.append(_encode_number(dlat))
            result.append(_encode_number(dlng))
            
            prev_lat = lat
            prev_lng = lng
        
        return ''.join(result)


# Singleton scoring service — built once with the loaded crime data
_scoring_service_instance: Optional["RouteScoringService"] = None


def get_route_scoring_service(safety_data_index=None) -> "RouteScoringService":
    """
    Return a singleton RouteScoringService that shares the loaded safety index.
    Creating a new instance per-request was causing the index to be empty.
    """
    global _scoring_service_instance
    if _scoring_service_instance is None:
        _scoring_service_instance = RouteScoringService(safety_data_index=safety_data_index)
    return _scoring_service_instance