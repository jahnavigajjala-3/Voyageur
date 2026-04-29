import pandas as pd
import numpy as np
import json
import os
from typing import Optional, Dict, List, Tuple, Any
from dataclasses import dataclass

try:
    from scipy.spatial import KDTree
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    print("[SAFETY DATA INDEX] Warning: scipy not available, using fallback distance calculation")


@dataclass
class SafetyDataPoint:
    """Represents a safety data point with coordinates and risk information"""
    lat: float
    lng: float
    district: str
    state: str
    risk_score: float
    normalized_score: float
    risk_level: str
    marker_color: str


class SafetyDataIndex:
    """Efficient spatial index for safety data lookup with KD-tree and grid-based fallback"""
    
    def __init__(self):
        self.kd_tree: Optional[Any] = None
        self.grid_index: Dict[Tuple[int, int], List[SafetyDataPoint]] = {}
        self.data_points: List[SafetyDataPoint] = []
        self.district_centroids: Dict[str, Dict[str, Any]] = {}
        self._grid_size = 0.09  # ~10km grid cells (in degrees)
        self._max_distance_km = 50.0  # Maximum search distance in km
        
        # Load district centroids
        self._load_district_centroids()
    
    def _load_district_centroids(self):
        """Load district centroids from JSON file"""
        try:
            base_dir = os.path.dirname(os.path.abspath(__file__))
            centroids_path = os.path.join(base_dir, "../../data/district_centroids.json")
            
            with open(centroids_path, "r", encoding="utf-8") as file:
                self.district_centroids = json.load(file)
            print(f"[SAFETY DATA INDEX] Loaded {len(self.district_centroids)} district centroids")
        except Exception as e:
            print(f"[SAFETY DATA INDEX] Failed to load district centroids: {e}")
            self.district_centroids = {}
    
    def _get_coordinates_for_district(self, district: str) -> Optional[Tuple[float, float]]:
        """Get coordinates for a district name"""
        # Clean district name
        district_clean = district.strip().title()
        
        # Try exact match first
        if district_clean in self.district_centroids:
            centroid = self.district_centroids[district_clean]
            return (centroid.get("lat"), centroid.get("lng"))
        
        # Try partial matching
        for city, centroid in self.district_centroids.items():
            csv_district = centroid.get("csv_district", city)
            if (district_clean.lower() in csv_district.lower() or 
                csv_district.lower() in district_clean.lower()):
                return (centroid.get("lat"), centroid.get("lng"))
        
        return None
    
    def build_index(self, crime_df: pd.DataFrame):
        """Build spatial index from crime data DataFrame"""
        if crime_df is None or crime_df.empty:
            print("[SAFETY DATA INDEX] No crime data to build index")
            return
        
        print(f"[SAFETY DATA INDEX] Building index from {len(crime_df)} crime records")
        
        # Clear existing data
        self.data_points = []
        self.grid_index = {}
        
        # Calculate min/max for normalization
        self._risk_score_min = crime_df['RISK_SCORE'].min()
        self._risk_score_max = crime_df['RISK_SCORE'].max()
        print(f"[SAFETY DATA INDEX] Risk score range: {self._risk_score_min:.2f} - {self._risk_score_max:.2f}")
        
        # Process each row in the crime DataFrame
        for _, row in crime_df.iterrows():
            district = row['DISTRICT']
            coordinates = self._get_coordinates_for_district(district)
            
            if coordinates:
                lat, lng = coordinates
                
                # Create safety data point
                point = SafetyDataPoint(
                    lat=lat,
                    lng=lng,
                    district=district,
                    state=row['STATE'],
                    risk_score=float(row['RISK_SCORE']),
                    normalized_score=self._normalize_risk_score(float(row['RISK_SCORE'])),
                    risk_level=row['RISK_LEVEL'],
                    marker_color=row['MARKER_COLOR']
                )
                self.data_points.append(point)
        
        print(f"[SAFETY DATA INDEX] Built {len(self.data_points)} data points with coordinates")
        
        # Build KD-tree if scipy is available and we have data points
        if self.data_points and SCIPY_AVAILABLE:
            points = [(p.lat, p.lng) for p in self.data_points]
            self.kd_tree = KDTree(points)
            print(f"[SAFETY DATA INDEX] Built KD-tree with {len(points)} points")
        elif self.data_points:
            print("[SAFETY DATA INDEX] scipy not available, using fallback distance calculation")
        
        # Build grid index
        self._build_grid_index()
    
    def _normalize_risk_score(self, score: float) -> float:
        """Normalize risk score to match travel_service.py normalization (1-10 scale, inverted)"""
        # This should match the normalize_risk_score function in travel_service.py
        # We need to get the min/max from the actual data
        if not hasattr(self, '_risk_score_min') or not hasattr(self, '_risk_score_max'):
            # Default values if not set
            return 5.0
        
        if self._risk_score_max == self._risk_score_min:
            return 5.0  # Default if all scores are the same
        
        normalized = 1 + 9 * (score - self._risk_score_min) / (self._risk_score_max - self._risk_score_min)
        return round(11 - normalized, 1)  # Invert so 10 = safest, 1 = most dangerous
    
    def _build_grid_index(self):
        """Build grid-based index for faster approximate lookups"""
        if not self.data_points:
            return
        
        for point in self.data_points:
            grid_key = self._get_grid_key(point.lat, point.lng)
            
            if grid_key not in self.grid_index:
                self.grid_index[grid_key] = []
            self.grid_index[grid_key].append(point)
        
        print(f"[SAFETY DATA INDEX] Built grid index with {len(self.grid_index)} cells")
    
    def _get_grid_key(self, lat: float, lng: float) -> Tuple[int, int]:
        """Convert coordinates to grid cell key"""
        return (
            int(lat / self._grid_size),
            int(lng / self._grid_size)
        )
    
    def _km_to_degrees(self, km: float) -> float:
        """Convert kilometers to approximate degrees (rough approximation)"""
        return km / 111.32  # 1 degree ≈ 111.32 km at equator
    
    def _calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate approximate distance in kilometers between two points"""
        # Simple Euclidean distance in degrees, converted to km
        lat_diff = lat1 - lat2
        lng_diff = lng1 - lng2
        distance_deg = (lat_diff ** 2 + lng_diff ** 2) ** 0.5
        return distance_deg * 111.32  # Convert to km
    
    def find_nearest(self, lat: float, lng: float, max_distance_km: Optional[float] = None) -> Optional[SafetyDataPoint]:
        """
        Find nearest safety data point within max distance.
        
        Args:
            lat: Latitude
            lng: Longitude
            max_distance_km: Maximum search distance in km (default: 50km)
            
        Returns:
            SafetyDataPoint if found within max distance, None otherwise
        """
        if not self.data_points:
            return None
        
        if max_distance_km is None:
            max_distance_km = self._max_distance_km
        
        max_distance_deg = self._km_to_degrees(max_distance_km)
        
        # First try grid-based lookup for faster approximate search
        grid_key = self._get_grid_key(lat, lng)
        candidates = []
        
        # Check current cell and neighboring cells
        for dlat in [-1, 0, 1]:
            for dlng in [-1, 0, 1]:
                neighbor_key = (grid_key[0] + dlat, grid_key[1] + dlng)
                if neighbor_key in self.grid_index:
                    candidates.extend(self.grid_index[neighbor_key])
        
        if candidates:
            # Find closest candidate
            closest_point = None
            min_distance = float('inf')
            
            for point in candidates:
                distance = self._calculate_distance(lat, lng, point.lat, point.lng)
                if distance < min_distance and distance <= max_distance_km:
                    min_distance = distance
                    closest_point = point
            
            if closest_point:
                return closest_point
        
        # If grid search didn't find anything or KD-tree is available, use it
        if self.kd_tree and SCIPY_AVAILABLE:
            try:
                distances, indices = self.kd_tree.query([(lat, lng)], k=1)
                if distances[0] < max_distance_deg:
                    return self.data_points[indices[0]]
            except Exception as e:
                print(f"[SAFETY DATA INDEX] KD-tree query error: {e}")
        
        # Fallback: linear search through all points
        closest_point = None
        min_distance = float('inf')
        
        for point in self.data_points:
            distance = self._calculate_distance(lat, lng, point.lat, point.lng)
            if distance < min_distance and distance <= max_distance_km:
                min_distance = distance
                closest_point = point
        
        return closest_point if min_distance <= max_distance_km else None
    
    def find_nearest_with_distance(self, lat: float, lng: float, max_distance_km: Optional[float] = None) -> Tuple[Optional[SafetyDataPoint], float]:
        """
        Find nearest safety data point and return it with the distance.
        
        Returns:
            Tuple of (SafetyDataPoint, distance_in_km) or (None, infinity)
        """
        point = self.find_nearest(lat, lng, max_distance_km)
        
        if point:
            distance = self._calculate_distance(lat, lng, point.lat, point.lng)
            return point, distance
        
        return None, float('inf')
    
    def find_all_within(self, lat: float, lng: float, radius_km: float) -> List[Tuple[SafetyDataPoint, float]]:
        """
        Find all safety data points within a given radius.
        
        Returns:
            List of tuples (SafetyDataPoint, distance_in_km)
        """
        if not self.data_points:
            return []
        
        results = []
        radius_deg = self._km_to_degrees(radius_km)
        
        # Use grid index to narrow down search
        center_grid_key = self._get_grid_key(lat, lng)
        search_cells = []
        
        # Determine how many grid cells to search based on radius
        cells_needed = int(np.ceil(radius_deg / self._grid_size))
        
        for dlat in range(-cells_needed, cells_needed + 1):
            for dlng in range(-cells_needed, cells_needed + 1):
                grid_key = (center_grid_key[0] + dlat, center_grid_key[1] + dlng)
                if grid_key in self.grid_index:
                    search_cells.extend(self.grid_index[grid_key])
        
        # Check each point in the search cells
        for point in search_cells:
            distance = self._calculate_distance(lat, lng, point.lat, point.lng)
            if distance <= radius_km:
                results.append((point, distance))
        
        return results
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the index"""
        return {
            "total_points": len(self.data_points),
            "grid_cells": len(self.grid_index),
            "has_kd_tree": self.kd_tree is not None and SCIPY_AVAILABLE,
            "grid_size_km": self._grid_size * 111.32,
            "max_search_distance_km": self._max_distance_km
        }


# Singleton instance for application-wide use
_safety_index_instance: Optional[SafetyDataIndex] = None


def get_safety_data_index(crime_df: Optional[pd.DataFrame] = None) -> SafetyDataIndex:
    """
    Get or create the singleton SafetyDataIndex instance.
    
    Args:
        crime_df: Optional DataFrame to build index from. If not provided,
                 the index will be uninitialized.
    
    Returns:
        SafetyDataIndex instance
    """
    global _safety_index_instance
    
    if _safety_index_instance is None:
        _safety_index_instance = SafetyDataIndex()
    
    if crime_df is not None and not _safety_index_instance.data_points:
        _safety_index_instance.build_index(crime_df)
    
    return _safety_index_instance