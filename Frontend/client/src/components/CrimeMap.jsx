import { useEffect, useState, useRef, forwardRef, useImperativeHandle, useContext } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import useLocation from "../hooks/useLocation";
import { getCrimeRiskByCoords, getNearbyHospitals, getSafeRoutes, getSafeRoutesDebounced } from "../api/api";
import { useRouteContext } from "../context/RouteContext";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const hospitalIcon = new L.Icon({
  iconUrl:    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl:  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25,41], iconAnchor: [12,41], popupAnchor: [1,-34], shadowSize: [41,41],
});

const clickedIcon = new L.Icon({
  iconUrl:    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl:  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25,41], iconAnchor: [12,41], popupAnchor: [1,-34], shadowSize: [41,41],
});

const routeIcon = new L.Icon({
  iconUrl:    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl:  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25,41], iconAnchor: [12,41], popupAnchor: [1,-34], shadowSize: [41,41],
});

const stepIcon = new L.DivIcon({
  className: "",
  html: `<div style="
    width:14px;height:14px;border-radius:50%;
    background:rgba(139,92,246,0.9);
    border:2px solid #fff;
    box-shadow:0 0 10px rgba(139,92,246,0.8);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const RISK_CIRCLE_COLORS = {
  HIGH: "#ef4444", MEDIUM: "#eab308", LOW: "#22c55e", UNKNOWN: "#64748b",
};

function RoutingMachine({ waypoints, isActive, onRouteDirections, onStepCoords }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!waypoints || waypoints.length < 2 || !isActive || !map) return;
    let cancelled = false;

    const formatInstruction = (step) => {
      const { maneuver = {}, name = "" } = step;
      const road = name ? ` onto ${name}` : "";
      const modifier = maneuver.modifier ? ` ${maneuver.modifier}` : "";
      const type = maneuver.type || "continue";
      if (type === "turn")        return `Turn${modifier}${road}`;
      if (type === "depart")      return `Depart${road}`;
      if (type === "arrive")      return `Arrive at${road}`;
      if (type === "merge")       return `Merge${modifier}${road}`;
      if (type === "roundabout")  return `Enter roundabout${road}`;
      if (type === "rotary")      return `rotary${modifier}${road}`;
      if (type === "exit rotary") return `exit rotary${modifier}${road}`;
      if (type === "fork")        return `Take the fork${modifier}${road}`;
      if (type === "end of road") return `end of road${modifier}${road}`;
      return `${type.replace(/_/g, " ")}${modifier}${road}`.trim();
    };

    const run = async () => {
      try {
        const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(";");
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`
        );
        if (!res.ok) throw new Error(`OSRM ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        if (data.routes?.length > 0) {
          const route = data.routes[0];
          const instructions = [];
          const stepCoords = [];

          route.legs.forEach((leg) => {
            leg.steps.forEach((step) => {
              instructions.push({
                text:     formatInstruction(step),
                distance: step.distance,
                duration: step.duration,
              });
              const [lng, lat] = step.maneuver.location;
              stepCoords.push({ lat, lng });
            });
          });

          if (onRouteDirections) onRouteDirections(instructions);
          if (onStepCoords)      onStepCoords(stepCoords);

          layerRef.current = L.geoJSON(route.geometry, {
            style: { color: "#818cf8", weight: 5, opacity: 0.9 },
          }).addTo(map);

          try {
            const bounds = layerRef.current.getBounds();
            if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
          } catch (_) {}

        } else {
          if (onRouteDirections) onRouteDirections([]);
          if (onStepCoords)      onStepCoords([]);
        }
      } catch (e) {
        console.error("Route error:", e);
        if (!cancelled) {
          if (onRouteDirections) onRouteDirections([]);
          if (onStepCoords)      onStepCoords([]);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
      if (layerRef.current && map) {
        try { map.removeLayer(layerRef.current); } catch (_) {}
        layerRef.current = null;
      }
    };
  }, [waypoints, isActive, map, onRouteDirections, onStepCoords]);

  return null;
}

function MultiRouteMachine({ routes, activeRouteId, onRouteSelect }) {
  const map = useMap();
  const layerRefs = useRef([]);

  useEffect(() => {
    if (!routes || routes.length === 0 || !map) return;
    
    // Clear previous layers
    layerRefs.current.forEach(layer => {
      if (layer && map) {
        try { map.removeLayer(layer); } catch (_) {}
      }
    });
    layerRefs.current = [];

    // Add each route to the map
    routes.forEach((route, index) => {
      if (!route.geometry) return;
      
      // Determine route styling based on type and selection
      const isSafest = route.type === "safest";
      const isFastest = route.type === "fastest";
      const isActive = route.id === activeRouteId;
      
      let color = "#64748b"; // Default grey for alternatives
      let weight = 4;
      let opacity = 0.7;
      
      if (isSafest) {
        color = "#22c55e"; // Green for safest
        weight = 6;
        opacity = 0.9;
      } else if (isFastest) {
        color = "#3b82f6"; // Blue for fastest
        weight = 5;
        opacity = 0.8;
      }
      
      if (isActive) {
        weight += 1;
        opacity = 1.0;
      }

      // Create the route layer
      const layer = L.geoJSON(route.geometry, {
        style: { 
          color, 
          weight, 
          opacity,
          dashArray: isActive ? null : "5, 5"
        }
      }).addTo(map);

      // Add click handler for route selection
      layer.on('click', () => {
        if (onRouteSelect) onRouteSelect(route.id);
      });

      // Add popup with safety information
      layer.bindPopup(`
        <div style="font-family: sans-serif; padding: 8px; min-width: 200px;">
          <strong>${route.type.toUpperCase()} ROUTE</strong><br/>
          <div style="margin-top: 8px;">
            <div><strong>Safety Score:</strong> ${route.safety_score.toFixed(0)}/100</div>
            <div><strong>Risk Level:</strong> <span style="color: ${
              route.risk_level === 'low' ? '#22c55e' : 
              route.risk_level === 'medium' ? '#eab308' : '#ef4444'
            }">${route.risk_level.toUpperCase()}</span></div>
            <div><strong>Distance:</strong> ${(route.distance / 1000).toFixed(1)} km</div>
            <div><strong>Duration:</strong> ${Math.round(route.duration / 60)} min</div>
            ${route.summary ? `<div style="margin-top: 8px; font-style: italic;">${route.summary}</div>` : ''}
          </div>
        </div>
      `);

      layerRefs.current[index] = layer;
    });

    // Fit map to show all routes
    try {
      const bounds = L.latLngBounds([]);
      routes.forEach(route => {
        if (route.geometry?.coordinates) {
          route.geometry.coordinates.forEach(coord => {
            if (Array.isArray(coord) && coord.length >= 2) {
              bounds.extend([coord[1], coord[0]]); // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
            }
          });
        }
      });
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    } catch (_) {}

    return () => {
      // Cleanup layers
      layerRefs.current.forEach(layer => {
        if (layer && map) {
          try { map.removeLayer(layer); } catch (_) {}
        }
      });
      layerRefs.current = [];
    };
  }, [routes, activeRouteId, map, onRouteSelect]);

  return null;
}

function MapClickHandler({ onMapClick }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const h = (e) => onMapClick(e.latlng.lat, e.latlng.lng);
    map.on("click", h);
    return () => map.off("click", h);
  }, [map, onMapClick]);
  return null;
}

function FlyToLocation({ target }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], target.zoom || 15, { duration: 1.0, easeLinearity: 0.25 });
  }, [target, map]);
  return null;
}

function RecenterButton({ lat, lng }) {
  const map = useMap();
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: "absolute", bottom: "24px", right: "12px", zIndex: 1000 }}>
      <button
        onClick={() => map.flyTo([lat, lng], map.getZoom(), { duration: 1.2 })}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title="Recenter"
        style={{
          width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer",
          background: hovered ? "rgba(139,92,246,0.35)" : "rgba(10,10,20,0.7)",
          backdropFilter: "blur(12px)",
          border: hovered ? "1px solid rgba(139,92,246,0.6)" : "1px solid rgba(255,255,255,0.15)",
          boxShadow: hovered ? "0 0 14px rgba(139,92,246,0.4)" : "0 4px 12px rgba(0,0,0,0.4)",
          color: hovered ? "rgba(167,139,250,1)" : "rgba(255,255,255,0.7)",
          fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s ease", transform: hovered ? "scale(1.08)" : "scale(1)",
        }}
      >◎</button>
    </div>
  );
}

const CrimeMap = forwardRef(function CrimeMap(
  { onRiskUpdate, onClickedRiskUpdate, pickingFor, onRoutePick, onHospitalsChange, onRouteDirections },
  ref
) {
  const { location, error } = useLocation();
  const [crimeRisk, setCrimeRisk]     = useState(null);
  const [hasFetched, setHasFetched]   = useState(false);
  const [routeWaypoints, setRouteWaypoints] = useState([]);
  const [routeActive, setRouteActive]       = useState(false);
  const [stepCoords, setStepCoords]         = useState([]);
  const [activeStepIdx, setActiveStepIdx]   = useState(null);
  const [flyTarget, setFlyTarget]           = useState(null);
  const [selectedLocation, setSelectedLocation]   = useState(null);
  const [selectedCrimeRisk, setSelectedCrimeRisk] = useState(null);
  const [hospitals, setHospitals]           = useState([]);
  const [showHospitals, setShowHospitals]   = useState(false);
  const [hospitalCenter, setHospitalCenter] = useState(null);
  
  // Use route context for state management
  const {
    selectedRouteId,
    routes: safeRoutes,
    isLoadingRoutes,
    setSelectedRouteId,
    setRoutes: setSafeRoutes,
    setIsLoadingRoutes,
    addToHistory,
    getCachedRoutes,
    cacheRoutes,
    userPreferences
  } = useRouteContext();

  useImperativeHandle(ref, () => ({
    triggerRoute: async (fromInput, toInput, useSafeRoutes = true) => {
      if (!fromInput || !toInput) { alert("Please enter both locations"); return; }
      try {
        const resolve = async (input) => {
          if (typeof input === "object" && input.lat) return input;
          if (input === "Current Location" && location)
            return { lat: location.lat, lng: location.lng, name: "Current Location" };
          return await geocode(input);
        };
        const [from, to] = await Promise.all([resolve(fromInput), resolve(toInput)]);
        if (from && to) {
          setStepCoords([]);
          setActiveStepIdx(null);
          setRouteWaypoints([from, to]);
          
          if (useSafeRoutes) {
            // Use the new safe routes API with caching
            setIsLoadingRoutes(true);
            setSafeRoutes([]);
            setSelectedRouteId(null);
            
            // Check cache first
            const cached = getCachedRoutes(from, to);
            if (cached && cached.expiresAt > Date.now()) {
              // Use cached routes
              const routesWithIds = cached.routes.map((route, index) => ({
                ...route,
                id: `route-${index}-${Date.now()}`
              }));
              setSafeRoutes(routesWithIds);
              // Auto-select based on user preference
              let preferredRoute = null;
              if (routesWithIds.length > 0) {
                preferredRoute = routesWithIds.find(r => r.type === userPreferences.preference) || 
                                 routesWithIds.find(r => r.type === "safest") || 
                                 routesWithIds[0];
                setSelectedRouteId(preferredRoute.id);
              }
              setRouteActive(true);
              setIsLoadingRoutes(false);
              
              // Add to history
              addToHistory({
                origin: from,
                destination: to,
                selectedRouteId: preferredRoute?.id,
                routes: routesWithIds
              });
            } else {
              // Fetch fresh routes
              try {
                const response = await getSafeRoutesDebounced(
                  from, 
                  to, 
                  userPreferences.alternatives, 
                  userPreferences.preference
                );
                // Add unique IDs to routes for selection
                const routesWithIds = response.routes.map((route, index) => ({
                  ...route,
                  id: `route-${index}-${Date.now()}`
                }));
                setSafeRoutes(routesWithIds);
                
                // Cache the routes
                cacheRoutes(from, to, routesWithIds);
                
                // Auto-select based on user preference
                let preferredRoute = null;
                if (routesWithIds.length > 0) {
                  preferredRoute = routesWithIds.find(r => r.type === userPreferences.preference) || 
                                   routesWithIds.find(r => r.type === "safest") || 
                                   routesWithIds[0];
                  setSelectedRouteId(preferredRoute.id);
                }
                setRouteActive(true);
                
                // Add to history
                addToHistory({
                  origin: from,
                  destination: to,
                  selectedRouteId: preferredRoute?.id,
                  routes: routesWithIds
                });
              } catch (e) {
                console.error("Safe routes API error:", e);
                alert("Error computing safe routes. Falling back to basic routing.");
                // Fall back to basic routing
                setRouteActive(true);
              } finally {
                setIsLoadingRoutes(false);
              }
            }
          } else {
            // Use basic routing (backward compatibility)
            setRouteActive(true);
          }
        } else {
          alert("Could not find one or both locations.");
        }
      } catch (e) {
        console.error("Route error:", e);
        alert("Error finding locations. Check your connection and try again.");
      }
    },

    clearRoute: () => {
      setRouteActive(false);
      setRouteWaypoints([]);
      setStepCoords([]);
      setActiveStepIdx(null);
      setSafeRoutes([]);
      setSelectedRouteId(null);
      setIsLoadingRoutes(false);
      if (onRouteDirections) onRouteDirections([]);
    },

    focusStep: (index) => {
      if (!stepCoords || stepCoords.length === 0) return;
      const coord = stepCoords[index];
      if (!coord) return;
      setActiveStepIdx(index);
      setFlyTarget({ lat: coord.lat, lng: coord.lng, zoom: 16, _ts: Date.now() });
    },

    focusMap: (type) => {
      const target = type === "live" ? location : selectedLocation;
      if (target) setFlyTarget({ lat: target.lat, lng: target.lng, _ts: Date.now() });
    },

    showHospitalsFor: async (type) => {
      if (showHospitals) {
        setShowHospitals(false);
        setHospitals([]);
        setHospitalCenter(null);
        if (onHospitalsChange) onHospitalsChange(null);
        return;
      }
      const loc = type === "live" ? location : selectedLocation;
      if (!loc) return;
      setHospitalCenter({ lat: loc.lat, lng: loc.lng });
      setShowHospitals(true);
      if (onHospitalsChange) onHospitalsChange(type);
      try {
        const data = await getNearbyHospitals(loc.lat, loc.lng, 30, 10);
        setHospitals(data);
      } catch (e) { console.error("Hospital fetch failed:", e); }
    },

    clearAll: () => {
      setSelectedLocation(null);
      setSelectedCrimeRisk(null);
      setHospitals([]);
      setShowHospitals(false);
      setHospitalCenter(null);
      setRouteActive(false);
      setRouteWaypoints([]);
      setStepCoords([]);
      setActiveStepIdx(null);
      setSafeRoutes([]);
      setSelectedRouteId(null);
      setIsLoadingRoutes(false);
      if (onHospitalsChange) onHospitalsChange(null);
    },

    selectRoute: (routeId) => {
      setSelectedRouteId(routeId);
    },
  }));

  useEffect(() => {
    if (!location || hasFetched) return;
    const run = async () => {
      try {
        const risk = await getCrimeRiskByCoords(location.lat, location.lng);
        setCrimeRisk(risk);
        setHasFetched(true);
        if (onRiskUpdate) onRiskUpdate(risk);
      } catch (e) { console.error("Crime risk fetch failed:", e); }
    };
    run();
  }, [location, hasFetched, onRiskUpdate]);

  const geocode = async (query) => {
    const res  = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en`);
    const data = await res.json();
    const feat = data?.features?.[0];
    if (feat) {
      const [lng, lat] = feat.geometry.coordinates;
      return { lat, lng, name: feat.properties.name || feat.properties.city || query };
    }
    throw new Error("Location not found");
  };

  const handleMapClick = async (lat, lng) => {
    if (pickingFor && onRoutePick) {
      onRoutePick({ lat, lng, name: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
      return;
    }
    const loc = { lat, lng };
    setSelectedLocation(loc);
    setSelectedCrimeRisk(null);
    setHospitals([]);
    setShowHospitals(false);
    setHospitalCenter(null);
    try {
      const risk = await getCrimeRiskByCoords(lat, lng);
      setSelectedCrimeRisk(risk);
      if (onClickedRiskUpdate) onClickedRiskUpdate(risk);
    } catch (e) { console.error("Map click crime lookup failed:", e); }
  };

  if (error)     return <p style={{ color: "#fca5a5", padding: "16px", fontSize: "13px" }}>Location error: {error}</p>;
  if (!location) return <p style={{ color: "rgba(255,255,255,0.3)", padding: "16px", fontSize: "13px" }}>Fetching location...</p>;

  const displayDistrict = crimeRisk?.detected_district || crimeRisk?.district || "Unknown";
  const displayState    = crimeRisk?.detected_state    || crimeRisk?.state    || "";
  const selDistrict     = selectedCrimeRisk?.detected_district || selectedCrimeRisk?.district || "Unknown";
  const selState        = selectedCrimeRisk?.detected_state    || selectedCrimeRisk?.state    || "";
  const activeStepCoord = activeStepIdx !== null ? stepCoords[activeStepIdx] : null;

  const handleRouteSelect = (routeId) => {
    setSelectedRouteId(routeId);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <MapContainer
        center={[location.lat, location.lng]}
        zoom={12}
        style={{ flex: 1, width: "100%", minHeight: "300px", cursor: pickingFor ? "crosshair" : undefined }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onMapClick={handleMapClick} />
        <RecenterButton lat={location.lat} lng={location.lng} />
        <FlyToLocation target={flyTarget} />

        <Marker position={[location.lat, location.lng]}>
          <Popup>
            <strong>You are here</strong>
            {crimeRisk && !crimeRisk.error && (
              <><br />{displayDistrict}{displayState ? `, ${displayState}` : ""}<br />Risk: {crimeRisk.risk_level}</>
            )}
          </Popup>
        </Marker>
        {crimeRisk && !crimeRisk.error && (
          <Circle
            center={[location.lat, location.lng]}
            radius={5000}
            pathOptions={{
              color: RISK_CIRCLE_COLORS[crimeRisk.risk_level] || RISK_CIRCLE_COLORS.UNKNOWN,
              fillColor: RISK_CIRCLE_COLORS[crimeRisk.risk_level] || RISK_CIRCLE_COLORS.UNKNOWN,
              fillOpacity: 0.08, weight: 2, opacity: 0.6,
            }}
          />
        )}

        {selectedLocation && (
          <Marker position={[selectedLocation.lat, selectedLocation.lng]} icon={clickedIcon}>
            <Popup>
              <strong>Selected spot</strong><br />
              {selectedCrimeRisk && !selectedCrimeRisk.error
                ? <>{selDistrict}{selState ? `, ${selState}` : ""}<br />Risk: {selectedCrimeRisk.risk_level}<br />Score: {selectedCrimeRisk.risk_score}</>
                : "Fetching crime data..."}
            </Popup>
          </Marker>
        )}

        {showHospitals && hospitals
          .filter(h => h.latitude != null && h.longitude != null)
          .map((h, i) => (
            <Marker key={`hosp-${i}`} position={[h.latitude, h.longitude]} icon={hospitalIcon}>
              <Popup><strong>{h.city}</strong><br />{h.district}, {h.state}<br />Distance: {h.distance_km} km</Popup>
            </Marker>
          ))}
        {showHospitals && hospitalCenter && (
          <Circle
            center={[hospitalCenter.lat, hospitalCenter.lng]}
            radius={30000}
            pathOptions={{
              color: "#22c55e", fillColor: "#22c55e",
              fillOpacity: 0.04, weight: 1, opacity: 0.3, dashArray: "6 4",
            }}
          />
        )}

        {routeActive && routeWaypoints.length >= 2 && (
          <>
            {safeRoutes.length > 0 ? (
              // Display multiple safe routes
              <>
                <MultiRouteMachine
                  routes={safeRoutes}
                  activeRouteId={selectedRouteId}
                  onRouteSelect={handleRouteSelect}
                />
                <Marker position={[routeWaypoints[0].lat, routeWaypoints[0].lng]} icon={routeIcon}>
                  <Popup>Start: {routeWaypoints[0].name}</Popup>
                </Marker>
                <Marker position={[routeWaypoints[routeWaypoints.length - 1].lat, routeWaypoints[routeWaypoints.length - 1].lng]} icon={routeIcon}>
                  <Popup>Destination: {routeWaypoints[routeWaypoints.length - 1].name}</Popup>
                </Marker>
                {isLoadingRoutes && (
                  <div style={{
                    position: "absolute",
                    top: "10px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(0,0,0,0.7)",
                    color: "white",
                    padding: "8px 16px",
                    borderRadius: "4px",
                    zIndex: 1000,
                    fontSize: "14px"
                  }}>
                    Computing safe routes...
                  </div>
                )}
              </>
            ) : (
              // Fall back to basic single route (backward compatibility)
              <>
                <RoutingMachine
                  waypoints={routeWaypoints}
                  isActive={routeActive}
                  onRouteDirections={onRouteDirections}
                  onStepCoords={setStepCoords}
                />
                <Marker position={[routeWaypoints[0].lat, routeWaypoints[0].lng]} icon={routeIcon}>
                  <Popup>Start: {routeWaypoints[0].name}</Popup>
                </Marker>
                <Marker position={[routeWaypoints[routeWaypoints.length - 1].lat, routeWaypoints[routeWaypoints.length - 1].lng]} icon={routeIcon}>
                  <Popup>Destination: {routeWaypoints[routeWaypoints.length - 1].name}</Popup>
                </Marker>
              </>
            )}
          </>
        )}

        {activeStepCoord && (
          <Marker position={[activeStepCoord.lat, activeStepCoord.lng]} icon={stepIcon}>
            <Popup>Step {activeStepIdx + 1}</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
});

export default CrimeMap;