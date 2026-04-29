/**
 * Example usage of RouteSafetyDisplay component with CrimeMap integration
 * 
 * This demonstrates how to integrate the RouteSafetyDisplay component
 * with the existing CrimeMap component for displaying safe routes.
 */

import { useState, useRef } from "react";
import CrimeMap from "./CrimeMap";
import RouteSafetyDisplay from "./RouteSafetyDisplay";
import { getSafeRoutes } from "../api/api";

/**
 * Example parent component that integrates CrimeMap and RouteSafetyDisplay
 */
function RoutePlanningExample() {
  const [routes, setRoutes] = useState([]);
  const [activeRouteId, setActiveRouteId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const crimeMapRef = useRef(null);

  // Example origin and destination coordinates
  const exampleOrigin = { lat: 17.385044, lng: 78.486671 }; // Hyderabad
  const exampleDestination = { lat: 17.448117, lng: 78.391129 }; // Secunderabad

  const handleFindSafeRoutes = async () => {
    setIsLoading(true);
    try {
      const response = await getSafeRoutes(
        exampleOrigin,
        exampleDestination,
        3, // alternatives
        "safety" // preference
      );
      
      // Add unique IDs to routes if not already present
      const routesWithIds = response.routes.map((route, index) => ({
        ...route,
        id: route.id || `route-${index}-${Date.now()}`
      }));
      
      setRoutes(routesWithIds);
      
      // Auto-select the safest route
      if (routesWithIds.length > 0) {
        const safestRoute = routesWithIds.find(r => r.type === 'safest') || routesWithIds[0];
        setActiveRouteId(safestRoute.id);
        
        // Trigger CrimeMap to display the routes
        if (crimeMapRef.current) {
          crimeMapRef.current.triggerRoute(exampleOrigin, exampleDestination, true);
        }
      }
    } catch (error) {
      console.error("Error fetching safe routes:", error);
      alert("Failed to compute safe routes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRouteSelect = (routeId) => {
    setActiveRouteId(routeId);
    
    // Highlight the selected route on the map
    if (crimeMapRef.current) {
      crimeMapRef.current.selectRoute(routeId);
    }
  };

  const handleClearRoutes = () => {
    setRoutes([]);
    setActiveRouteId(null);
    
    // Clear routes from the map
    if (crimeMapRef.current) {
      crimeMapRef.current.clearRoute();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Intelligent Route Planning</h1>
          <p className="text-gray-400">
            Find the safest routes between locations with real-time safety scoring
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Map */}
          <div className="bg-gray-800/30 rounded-2xl p-4 border border-gray-700/50">
            <div className="mb-4">
              <h2 className="text-xl font-semibold mb-2">Route Map</h2>
              <p className="text-gray-400 text-sm mb-4">
                Click on the map to select locations or use the example below
              </p>
              
              <div className="flex space-x-4 mb-4">
                <button
                  onClick={handleFindSafeRoutes}
                  disabled={isLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800/50 rounded-lg font-medium transition-colors"
                >
                  {isLoading ? 'Computing...' : 'Find Safe Routes'}
                </button>
                
                <button
                  onClick={handleClearRoutes}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
                >
                  Clear Routes
                </button>
              </div>
              
              <div className="text-sm text-gray-400 mb-2">
                <strong>Example:</strong> Hyderabad ({exampleOrigin.lat.toFixed(4)}, {exampleOrigin.lng.toFixed(4)}) 
                → Secunderabad ({exampleDestination.lat.toFixed(4)}, {exampleDestination.lng.toFixed(4)})
              </div>
            </div>
            
            <div className="h-[400px] rounded-xl overflow-hidden">
              <CrimeMap 
                ref={crimeMapRef}
                onRoutePick={(location) => console.log('Location picked:', location)}
              />
            </div>
          </div>

          {/* Right Column: Route Safety Display */}
          <div className="bg-gray-800/30 rounded-2xl p-4 border border-gray-700/50">
            <RouteSafetyDisplay 
              routes={routes}
              onRouteSelect={handleRouteSelect}
              activeRouteId={activeRouteId}
              isLoading={isLoading}
            />
            
            {/* Additional Information Panel */}
            <div className="mt-8 p-4 bg-gray-900/50 rounded-xl border border-gray-700/30">
              <h3 className="text-lg font-semibold mb-3">How Safety Scoring Works</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  <span>Scores are calculated based on crime data and route characteristics</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  <span>Higher scores (80-100) indicate safer routes with lower risk</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  <span>Routes are analyzed segment-by-segment for granular safety assessment</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  <span>Time penalties show the trade-off between safety and speed</span>
                </li>
              </ul>
              
              <div className="mt-4 pt-4 border-t border-gray-700/30">
                <p className="text-xs text-gray-500">
                  <strong>Note:</strong> Safety scores are estimates based on available data. 
                  Always exercise caution and follow local safety guidelines.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Route Details Table (Optional) */}
        {routes.length > 0 && (
          <div className="mt-8 bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50">
            <h3 className="text-xl font-semibold mb-4">Route Details</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4">Route Type</th>
                    <th className="text-left py-3 px-4">Safety Score</th>
                    <th className="text-left py-3 px-4">Risk Level</th>
                    <th className="text-left py-3 px-4">Distance</th>
                    <th className="text-left py-3 px-4">Duration</th>
                    <th className="text-left py-3 px-4">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((route, index) => (
                    <tr 
                      key={route.id} 
                      className={`border-b border-gray-800/50 hover:bg-gray-700/30 ${
                        activeRouteId === route.id ? 'bg-purple-900/20' : ''
                      }`}
                      onClick={() => handleRouteSelect(route.id)}
                    >
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          route.type === 'safest' ? 'bg-green-500/20 text-green-400' :
                          route.type === 'fastest' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {route.type?.toUpperCase() || 'ALTERNATIVE'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <div className="w-16 h-2 bg-gray-700 rounded-full mr-3 overflow-hidden">
                            <div 
                              className="h-full rounded-full"
                              style={{ 
                                width: `${route.safety_score}%`,
                                backgroundColor: route.safety_score >= 80 ? '#22c55e' : 
                                               route.safety_score >= 50 ? '#eab308' : '#ef4444'
                              }}
                            ></div>
                          </div>
                          <span className="font-medium">{Math.round(route.safety_score)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span style={{ 
                          color: route.risk_level === 'low' ? '#22c55e' : 
                                 route.risk_level === 'medium' ? '#eab308' : '#ef4444'
                        }}>
                          {route.risk_level?.toUpperCase() || 'UNKNOWN'}
                        </span>
                      </td>
                      <td className="py-3 px-4">{(route.distance / 1000).toFixed(1)} km</td>
                      <td className="py-3 px-4">{Math.round(route.duration / 60)} min</td>
                      <td className="py-3 px-4 text-gray-300">{route.summary || 'No summary available'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RoutePlanningExample;