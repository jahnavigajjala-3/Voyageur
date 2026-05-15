import { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * RouteContext - Manages route selection, comparison, caching, and user preferences
 * 
 * Features:
 * 1. Route selection state management
 * 2. Route comparison state
 * 3. Safety score caching (LRU cache)
 * 4. User preference persistence (localStorage)
 * 5. Route history tracking
 */

// LRU Cache implementation for safety scores
class SafetyScoreCache {
  constructor(maxSize = 50) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  getKey(origin, destination) {
    return `${origin.lat},${origin.lng}|${destination.lat},${destination.lng}`;
  }

  get(origin, destination) {
    const key = this.getKey(origin, destination);
    if (!this.cache.has(key)) return null;
    
    // Move to front (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(origin, destination, routes) {
    const key = this.getKey(origin, destination);
    
    // If cache is full, remove least recently used
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      routes,
      timestamp: Date.now(),
      expiresAt: Date.now() + (30 * 60 * 1000) // 30 minutes
    });
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

// Create context
const RouteContext = createContext();

const getRouteHistoryId = (entry, index = 0) => {
  if (entry?.id != null) return String(entry.id);
  const origin = entry?.origin || {};
  const destination = entry?.destination || {};
  return [
    entry?.timestamp || "legacy",
    index,
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng,
  ].join("-");
};

const normalizeRouteHistory = (history) => {
  if (!Array.isArray(history)) return [];
  return history.map((entry, index) => ({
    ...entry,
    id: getRouteHistoryId(entry, index),
  }));
};

export const useRouteContext = () => {
  const context = useContext(RouteContext);
  if (!context) {
    throw new Error('useRouteContext must be used within a RouteProvider');
  }
  return context;
};

export const RouteProvider = ({ children }) => {
  // Route selection state
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  
  // Route comparison state
  const [comparisonMetrics, setComparisonMetrics] = useState(null);
  const [comparedRoutes, setComparedRoutes] = useState([]);
  
  // Safety score cache
  const [safetyScoreCache] = useState(() => new SafetyScoreCache());
  
  // User preferences
  const [userPreferences, setUserPreferences] = useState(() => {
    // Load from localStorage
    const saved = localStorage.getItem('route_preferences');
    return saved ? JSON.parse(saved) : {
      preference: 'safety', // 'safety', 'speed', or 'balanced'
      alternatives: 3,
      avoidHighRisk: true,
      minSafetyScore: 50,
      maxTimePenalty: 30,
      showOnlyVerified: false
    };
  });
  
  // Route history
  const [routeHistory, setRouteHistory] = useState(() => {
    const saved = localStorage.getItem('route_history');
    return saved ? normalizeRouteHistory(JSON.parse(saved)) : [];
  });

  // Save preferences to localStorage when they change
  useEffect(() => {
    localStorage.setItem('route_preferences', JSON.stringify(userPreferences));
  }, [userPreferences]);

  // Save history to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('route_history', JSON.stringify(routeHistory.slice(0, 20))); // Keep last 20 routes
  }, [routeHistory]);

  // Calculate comparison metrics when routes change
  useEffect(() => {
    if (routes.length < 2) {
      setComparisonMetrics(null);
      return;
    }

    const safestRoute = routes.find(r => r.type === 'safest') || routes[0];
    const fastestRoute = routes.find(r => r.type === 'fastest') || 
                         routes.reduce((fastest, route) => 
                           route.duration < fastest.duration ? route : fastest, routes[0]);

    if (safestRoute && fastestRoute && safestRoute.id !== fastestRoute.id) {
      const safetyDiff = safestRoute.safety_score - fastestRoute.safety_score;
      const timePenalty = safestRoute.duration - fastestRoute.duration;
      const distancePenalty = safestRoute.distance - fastestRoute.distance;
      
      setComparisonMetrics({
        safestRouteId: safestRoute.id,
        fastestRouteId: fastestRoute.id,
        safetyDifference: safetyDiff,
        timePenalty: timePenalty,
        distancePenalty: distancePenalty,
        safetyPerTimeRatio: timePenalty > 0 ? safetyDiff / (timePenalty / 60) : 0,
        totalRoutes: routes.length
      });
      
      // Set compared routes
      setComparedRoutes([safestRoute, fastestRoute]);
    } else {
      setComparisonMetrics(null);
      setComparedRoutes([]);
    }
  }, [routes]);

  // Add route to history
  const addToHistory = useCallback((routeData) => {
    const historyEntry = {
      id: Date.now().toString(),
      origin: routeData.origin,
      destination: routeData.destination,
      selectedRouteId: routeData.selectedRouteId,
      routes: routeData.routes,
      timestamp: Date.now(),
      preferences: { ...userPreferences }
    };

    setRouteHistory(prev => {
      const newHistory = [historyEntry, ...prev.filter(entry => 
        entry.origin.lat !== routeData.origin.lat || 
        entry.origin.lng !== routeData.origin.lng ||
        entry.destination.lat !== routeData.destination.lat ||
        entry.destination.lng !== routeData.destination.lng
      )].slice(0, 20); // Keep only 20 most recent
      return newHistory;
    });
  }, [userPreferences]);

  // Get cached routes
  const getCachedRoutes = useCallback((origin, destination) => {
    return safetyScoreCache.get(origin, destination);
  }, [safetyScoreCache]);

  // Cache routes
  const cacheRoutes = useCallback((origin, destination, routes) => {
    safetyScoreCache.set(origin, destination, routes);
  }, [safetyScoreCache]);

  // Clear cache
  const clearCache = useCallback(() => {
    safetyScoreCache.clear();
  }, [safetyScoreCache]);

  // Update user preferences
  const updatePreferences = useCallback((newPreferences) => {
    setUserPreferences(prev => ({
      ...prev,
      ...newPreferences
    }));
  }, []);

  // Clear route history
  const clearHistory = useCallback(() => {
    setRouteHistory([]);
    localStorage.removeItem('route_history');
  }, []);

  // Delete a single route from history by id
  const deleteRoute = useCallback((routeId) => {
    setRouteHistory(prev => prev.filter((route, index) => getRouteHistoryId(route, index) !== String(routeId)));
  }, []);

  // Full session reset — called on logout or when switching to guest mode.
  // Clears all in-memory state and localStorage keys so no data leaks between sessions.
  const resetSession = useCallback(() => {
    setSelectedRouteId(null);
    setRoutes([]);
    setIsLoadingRoutes(false);
    setComparisonMetrics(null);
    setComparedRoutes([]);
    setRouteHistory([]);
    safetyScoreCache.clear();
    localStorage.removeItem('route_history');
    localStorage.removeItem('route_preferences');
  }, [safetyScoreCache]);

  // Get route by ID
  const getRouteById = useCallback((routeId) => {
    return routes.find(route => route.id === routeId);
  }, [routes]);

  // Get selected route
  const getSelectedRoute = useCallback(() => {
    return routes.find(route => route.id === selectedRouteId);
  }, [routes, selectedRouteId]);

  const value = {
    // State
    selectedRouteId,
    routes,
    isLoadingRoutes,
    comparisonMetrics,
    comparedRoutes,
    userPreferences,
    routeHistory,

    // Cache helpers exposed at top level (used by CrimeMap)
    getCachedRoutes,
    cacheRoutes,
    clearCache,

    // Also available nested for backwards compatibility
    safetyScoreCache: {
      size: safetyScoreCache.size(),
      getCachedRoutes,
      cacheRoutes,
      clearCache
    },
    
    // Actions
    setSelectedRouteId,
    setRoutes,
    setIsLoadingRoutes,
    addToHistory,
    updatePreferences,
    clearHistory,
    deleteRoute,
    resetSession,
    getRouteById,
    getSelectedRoute,
    
    // Derived state
    selectedRoute: getSelectedRoute(),
    hasRoutes: routes.length > 0,
    hasComparison: comparisonMetrics !== null,
    cacheSize: safetyScoreCache.size()
  };

  return (
    <RouteContext.Provider value={value}>
      {children}
    </RouteContext.Provider>
  );
};

export default RouteContext;
