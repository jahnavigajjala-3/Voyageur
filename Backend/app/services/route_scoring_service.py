"""
Route Scoring Service for Voyageur Travel App

Implements intelligent route safety scoring using:
1. Google Polyline Algorithm decoding
2. Route segmentation for granular analysis
3. Weighted scoring with safety data integration
4. Score normalization and risk level determination
"""

import math
from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass

from app.core.logging import get_logger

logger = get_logger(__name__)

try:
    from .safety_data_index import SafetyDataPoint, get_safety_data_index
    SAFETY_INDEX_AVAILABLE = True
except ImportError:
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
    logger.warning("safety_data_index module not available — route scoring will use neutral scores")


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
    base_score: float       # Raw safety score (0–100 scale)
    weighted_score: float   # Score adjusted by segment length weight
    is_high_risk: bool = False
    is_uncertain: bool = False  # No safety data available


@dataclass
class RouteScore:
    """Complete score for a route"""
    raw_score: float
    normalized_score: float     # 1–10 scale (10 = safest)
    risk_level: str             # "low", "medium", or "high"
    segment_scores: List[SegmentScore]
    total_distance_km: float
    segment_count: int
    high_risk_segments: int
    uncertain_segments: int
    penalties_applied: Dict[str, float]


class RouteScoringService:
    """Core service for scoring route safety"""

    # Distance threshold below which a segment is considered high-risk (0–100 scale)
    HIGH_RISK_THRESHOLD = 30.0
    # Target length for each route segment in km
    SEGMENT_LENGTH_KM = 1.0
    # Maximum distance to search for safety data
    MAX_SEARCH_DISTANCE_KM = 50.0

    def __init__(self, safety_data_index=None):
        self.safety_index = safety_data_index
        if self.safety_index is None and SAFETY_INDEX_AVAILABLE:
            try:
                self.safety_index = get_safety_data_index()
            except Exception as e:
                logger.error("Failed to get safety index: %s", e)

        logger.info("RouteScoringService initialised (segment_length=%.1fkm)", self.SEGMENT_LENGTH_KM)

    # ------------------------------------------------------------------
    # Polyline encode / decode
    # ------------------------------------------------------------------

    def decode_polyline(self, polyline: str) -> List[Coordinate]:
        """Decode a Google Polyline encoded string into Coordinate objects."""
        if not polyline:
            raise ValueError("Polyline cannot be empty")

        coordinates = []
        index = 0
        lat = 0
        lng = 0

        while index < len(polyline):
            # Decode latitude
            shift, result = 0, 0
            while True:
                if index >= len(polyline):
                    raise ValueError("Invalid polyline: incomplete latitude encoding")
                b = ord(polyline[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            lat += ~(result >> 1) if result & 1 else result >> 1

            # Decode longitude
            shift, result = 0, 0
            while True:
                if index >= len(polyline):
                    raise ValueError("Invalid polyline: incomplete longitude encoding")
                b = ord(polyline[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            lng += ~(result >> 1) if result & 1 else result >> 1

            coordinates.append(Coordinate(lat=lat / 1e5, lng=lng / 1e5))

        if not coordinates:
            raise ValueError("Failed to decode any coordinates from polyline")

        logger.debug("Decoded %d coordinates from polyline", len(coordinates))
        return coordinates

    def encode_polyline(self, coordinates: List[Coordinate]) -> str:
        """Encode Coordinate objects to Google Polyline format."""
        def _encode_number(value: int) -> str:
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
        prev_lat = prev_lng = 0
        for coord in coordinates:
            lat = int(round(coord.lat * 1e5))
            lng = int(round(coord.lng * 1e5))
            result.append(_encode_number(lat - prev_lat))
            result.append(_encode_number(lng - prev_lng))
            prev_lat, prev_lng = lat, lng
        return ''.join(result)

    # ------------------------------------------------------------------
    # Distance helpers
    # ------------------------------------------------------------------

    def _haversine(self, coord1: Coordinate, coord2: Coordinate) -> float:
        """Haversine distance between two coordinates in kilometres."""
        R = 6371.0
        lat1, lat2 = math.radians(coord1.lat), math.radians(coord2.lat)
        dlat = math.radians(coord2.lat - coord1.lat)
        dlng = math.radians(coord2.lng - coord1.lng)
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    # ------------------------------------------------------------------
    # Segmentation
    # ------------------------------------------------------------------

    def split_into_segments(self, coordinates: List[Coordinate]) -> List[RouteSegment]:
        """Split route coordinates into ~1 km segments."""
        if len(coordinates) < 2:
            midpoint = coordinates[0] if coordinates else Coordinate(lat=0, lng=0)
            return [RouteSegment(coordinates=coordinates, length_km=0.0, midpoint=midpoint)]

        segments: List[RouteSegment] = []
        current: List[Coordinate] = [coordinates[0]]
        accumulated = 0.0

        for i in range(1, len(coordinates)):
            current.append(coordinates[i])
            accumulated += self._haversine(coordinates[i - 1], coordinates[i])

            if accumulated >= self.SEGMENT_LENGTH_KM:
                mid_lat = sum(c.lat for c in current) / len(current)
                mid_lng = sum(c.lng for c in current) / len(current)
                segments.append(RouteSegment(
                    coordinates=current.copy(),
                    length_km=accumulated,
                    midpoint=Coordinate(lat=mid_lat, lng=mid_lng),
                ))
                current = [coordinates[i]]
                accumulated = 0.0

        # Final partial segment
        if len(current) > 1 or segments:
            final_dist = sum(
                self._haversine(current[j - 1], current[j])
                for j in range(1, len(current))
            )
            mid_lat = sum(c.lat for c in current) / len(current)
            mid_lng = sum(c.lng for c in current) / len(current)
            segments.append(RouteSegment(
                coordinates=current,
                length_km=final_dist,
                midpoint=Coordinate(lat=mid_lat, lng=mid_lng),
            ))

        logger.debug("Split route into %d segments", len(segments))
        return segments

    # ------------------------------------------------------------------
    # Scoring
    # ------------------------------------------------------------------

    def _get_safety_data_for_segment(
        self, segment: RouteSegment
    ) -> Tuple[Optional[SafetyDataPoint], float]:
        if not self.safety_index:
            return None, float('inf')
        try:
            return self.safety_index.find_nearest_with_distance(
                segment.midpoint.lat,
                segment.midpoint.lng,
                self.MAX_SEARCH_DISTANCE_KM,
            )
        except Exception as e:
            logger.error("Error getting safety data for segment: %s", e)
            return None, float('inf')

    async def score_segment(self, segment: RouteSegment, total_route_length: float) -> SegmentScore:
        """Score a single route segment."""
        safety_data, distance = self._get_safety_data_for_segment(segment)

        if safety_data:
            # normalized_score is 1–10; convert to 0–100 for internal consistency
            base_score = safety_data.normalized_score * 10
            has_data = True
            is_uncertain = False
        else:
            base_score = 50.0   # neutral when no data
            has_data = False
            is_uncertain = True

        is_high_risk = base_score < self.HIGH_RISK_THRESHOLD

        weight = (
            1.0 + (segment.length_km / total_route_length) * 2.0
            if total_route_length > 0 else 1.0
        )

        segment.safety_data = safety_data
        segment.has_safety_data = has_data
        segment.distance_to_safety_data_km = distance

        return SegmentScore(
            segment=segment,
            base_score=base_score,
            weighted_score=base_score * weight,
            is_high_risk=is_high_risk,
            is_uncertain=is_uncertain,
        )

    async def score_route(
        self, polyline: str, route_metadata: Optional[Dict[str, Any]] = None
    ) -> RouteScore:
        """
        Score a complete route.

        Returns a score on a 1–10 scale:
          1 = lowest risk (safest), 10 = highest risk (most dangerous)
        """
        logger.debug("Scoring route (polyline length=%d)", len(polyline))

        coordinates = self.decode_polyline(polyline)
        segments = self.split_into_segments(coordinates)
        total_distance = sum(s.length_km for s in segments)

        segment_scores: List[SegmentScore] = []
        for segment in segments:
            segment_scores.append(await self.score_segment(segment, total_distance))

        if not segment_scores:
            return RouteScore(
                raw_score=5.0, normalized_score=5.0, risk_level="medium",
                segment_scores=[], total_distance_km=total_distance,
                segment_count=0, high_risk_segments=0, uncertain_segments=0,
                penalties_applied={},
            )

        # Weighted average → 1–10 safety score
        total_weight = weighted_sum = 0.0
        for ss in segment_scores:
            w = max(ss.segment.length_km, 0.1)
            safety_1_10 = max(1.0, min(10.0, ss.base_score / 10.0))
            weighted_sum += safety_1_10 * w
            total_weight += w

        safety_score = round(
            max(1.0, min(10.0, weighted_sum / total_weight if total_weight > 0 else 5.0)), 1
        )
        risk_level = self._determine_risk_level(safety_score)

        high_risk_count = sum(1 for ss in segment_scores if ss.is_high_risk)
        uncertain_count = sum(1 for ss in segment_scores if ss.is_uncertain)
        n = len(segment_scores)

        logger.info(
            "Route scored: %d segments, %.1fkm, score=%.1f/10 (%s), high-risk=%d, uncertain=%d",
            n, total_distance, safety_score, risk_level, high_risk_count, uncertain_count,
        )

        return RouteScore(
            raw_score=safety_score,
            normalized_score=safety_score,
            risk_level=risk_level,
            segment_scores=segment_scores,
            total_distance_km=total_distance,
            segment_count=n,
            high_risk_segments=high_risk_count,
            uncertain_segments=uncertain_count,
            penalties_applied={},
        )

    def _determine_risk_level(self, score: float) -> str:
        """1–10 scale: ≤3.5 = low, 3.5–6.5 = medium, >6.5 = high"""
        if score <= 3.5:
            return "low"
        if score <= 6.5:
            return "medium"
        return "high"


# ---------------------------------------------------------------------------
# Singleton — built once so the KD-tree is shared across requests
# ---------------------------------------------------------------------------
_scoring_service_instance: Optional[RouteScoringService] = None


def get_route_scoring_service(safety_data_index=None) -> RouteScoringService:
    """Return the singleton RouteScoringService."""
    global _scoring_service_instance
    if _scoring_service_instance is None:
        _scoring_service_instance = RouteScoringService(safety_data_index=safety_data_index)
    return _scoring_service_instance
