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

// ── Custom glowing DivIcons ──────────────────────────────────────────────
const makeGlowIcon = (color, size = 14, pulseColor) => new L.DivIcon({
  className: "",
  html: `<div style="
    position:relative;
    width:${size}px;height:${size}px;
  ">
    ${pulseColor ? `<div style="
      position:absolute;inset:-6px;border-radius:50%;
      border:1.5px solid ${pulseColor};
      animation:leaflet-pulse 2s ease-out infinite;
      opacity:0;
    "></div>` : ""}
    <div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};
      border:2px solid rgba(255,255,255,0.9);
      box-shadow:0 0 10px ${color},0 0 20px ${color}80;
    "></div>
  </div>`,
  iconSize: [size, size],
  iconAnchor: [size / 2, size / 2],
  popupAnchor: [0, -(size / 2 + 4)],
});

// User location — cyan pulse
const userLocIcon = makeGlowIcon("#38bdf8", 14, "#38bdf8");
// Route start — green
const routeStartIcon = makeGlowIcon("#22c55e", 13);
// Route end — red/orange
const routeEndIcon = makeGlowIcon("#f97316", 13);
// Clicked spot — amber
const clickedIcon = makeGlowIcon("#fbbf24", 12);
// Hospital — emerald
const hospitalIcon = makeGlowIcon("#10b981", 11);
// Route waypoint (legacy)
const routeIcon = routeStartIcon;
// Step marker — cyan small
const stepIcon = makeGlowIcon("#38bdf8", 10);

import { getRiskColorsByLevel, getRiskColor } from "../utils/riskColors";

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
            style: { color: "#38bdf8", weight: 5, opacity: 0.95, lineCap: "round", lineJoin: "round" },
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
      
      let color = "#475569"; // Default grey for alternatives
      let weight = 4;
      let opacity = 0.65;
      
      if (isSafest) {
        color = "#22c55e"; // Green for safest
        weight = 5;
        opacity = 0.95;
      } else if (isFastest) {
        color = "#38bdf8"; // Cyan for fastest
        weight = 5;
        opacity = 0.85;
      }
      
      if (isActive) {
        weight += 2;
        opacity = 1.0;
      }

      // Create the route layer
      const layer = L.geoJSON(route.geometry, {
        style: { 
          color, 
          weight, 
          opacity,
          dashArray: isActive ? null : "6, 5",
          lineCap: "round",
          lineJoin: "round",
        }
      }).addTo(map);

      // Add click handler for route selection
      layer.on('click', () => {
        if (onRouteSelect) onRouteSelect(route.id);
      });

      // Add popup with safety information
      layer.bindPopup(`
        <div style="
          font-family:'Inter','Segoe UI',sans-serif;
          padding:10px 12px;
          min-width:180px;
          background:rgba(5,8,20,0.97);
          color:rgba(255,255,255,0.85);
          border-radius:10px;
          font-size:12px;
          line-height:1.6;
        ">
          <div style="font-weight:700;font-size:11px;letter-spacing:0.1em;color:${
            route.type === 'safest' ? '#86efac' : route.type === 'fastest' ? '#7dd3fc' : '#94a3b8'
          };margin-bottom:6px;">${route.type.toUpperCase()} ROUTE</div>
          <div style="display:flex;flex-direction:column;gap:3px;">
            <div style="display:flex;justify-content:space-between;">
              <span style="color:rgba(255,255,255,0.4);">Safety</span>
              <span style="font-weight:600;color:${
                getRiskColor(route.safety_score)
              };">${route.safety_score.toFixed(1)}/10</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:rgba(255,255,255,0.4);">Risk</span>
              <span style="font-weight:600;color:${
                getRiskColorsByLevel(route.risk_level).text
              };">${route.risk_level.toUpperCase()}</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:rgba(255,255,255,0.4);">Distance</span>
              <span>${(route.distance / 1000).toFixed(1)} km</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:rgba(255,255,255,0.4);">Duration</span>
              <span>${Math.round(route.duration / 60)} min</span>
            </div>
            ${route.summary ? `<div style="margin-top:6px;font-style:italic;color:rgba(255,255,255,0.35);font-size:11px;">${route.summary}</div>` : ''}
          </div>
        </div>
      `, { className: "voyageour-popup" });

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
          background: hovered ? "rgba(56,189,248,0.2)" : "rgba(5,8,20,0.8)",
          backdropFilter: "blur(12px)",
          border: hovered ? "1px solid rgba(56,189,248,0.5)" : "1px solid rgba(255,255,255,0.1)",
          boxShadow: hovered ? "0 0 14px rgba(56,189,248,0.35)" : "0 4px 12px rgba(0,0,0,0.5)",
          color: hovered ? "#7dd3fc" : "rgba(255,255,255,0.55)",
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
  // Independent marker state for picked from/to — shown immediately on map click,
  // before route calculation happens
  const [pickedFrom, setPickedFrom] = useState(null); // { lat, lng }
  const [pickedTo, setPickedTo]     = useState(null); // { lat, lng }
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
          // Keep pick markers in sync with the resolved coordinates
          setPickedFrom({ lat: from.lat, lng: from.lng });
          setPickedTo({ lat: to.lat, lng: to.lng });
          
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
      setPickedFrom(null);
      setPickedTo(null);
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
      setPickedFrom(null);
      setPickedTo(null);
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
      const coords = { lat, lng, name: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
      // Place marker immediately — independent of route calculation
      if (pickingFor === "from") setPickedFrom({ lat, lng });
      if (pickingFor === "to")   setPickedTo({ lat, lng });
      onRoutePick(coords);
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

        {/* Immediate pick markers — shown as soon as user clicks, before route calculation */}
        {pickedFrom && (
          <Marker position={[pickedFrom.lat, pickedFrom.lng]} icon={routeStartIcon}>
            <Popup className="voyageour-popup">
              <div style={{ fontFamily:"'Inter','Segoe UI',sans-serif", padding:"8px 10px", background:"rgba(5,8,20,0.97)", color:"rgba(255,255,255,0.85)", borderRadius:"10px", fontSize:"12px", lineHeight:1.6 }}>
                <div style={{ fontWeight:700, fontSize:"11px", letterSpacing:"0.1em", color:"#22c55e", marginBottom:"3px" }}>START</div>
                <div style={{ color:"rgba(255,255,255,0.5)", fontSize:"11px" }}>{pickedFrom.lat.toFixed(5)}, {pickedFrom.lng.toFixed(5)}</div>
              </div>
            </Popup>
          </Marker>
        )}
        {pickedTo && (
          <Marker position={[pickedTo.lat, pickedTo.lng]} icon={routeEndIcon}>
            <Popup className="voyageour-popup">
              <div style={{ fontFamily:"'Inter','Segoe UI',sans-serif", padding:"8px 10px", background:"rgba(5,8,20,0.97)", color:"rgba(255,255,255,0.85)", borderRadius:"10px", fontSize:"12px", lineHeight:1.6 }}>
                <div style={{ fontWeight:700, fontSize:"11px", letterSpacing:"0.1em", color:"#f97316", marginBottom:"3px" }}>DESTINATION</div>
                <div style={{ color:"rgba(255,255,255,0.5)", fontSize:"11px" }}>{pickedTo.lat.toFixed(5)}, {pickedTo.lng.toFixed(5)}</div>
              </div>
            </Popup>
          </Marker>
        )}

        <Marker position={[location.lat, location.lng]} icon={userLocIcon}>
          <Popup className="voyageour-popup">
            <div style={{
              fontFamily:"'Inter','Segoe UI',sans-serif", padding:"8px 10px",
              background:"rgba(5,8,20,0.97)", color:"rgba(255,255,255,0.85)",
              borderRadius:"10px", fontSize:"12px", lineHeight:1.6, minWidth:"140px",
            }}>
              <div style={{ fontWeight:700, fontSize:"11px", letterSpacing:"0.1em", color:"#38bdf8", marginBottom:"4px" }}>YOU ARE HERE</div>
              {crimeRisk && !crimeRisk.error && (
                <div style={{ color:"rgba(255,255,255,0.5)", fontSize:"11px" }}>
                  {displayDistrict}{displayState ? `, ${displayState}` : ""}<br />
                  <span style={{ color: getRiskColorsByLevel(crimeRisk.risk_level).text }}>
                    {crimeRisk.risk_level} RISK
                  </span>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
        {crimeRisk && !crimeRisk.error && (
          <Circle
            center={[location.lat, location.lng]}
            radius={5000}
            pathOptions={{
              color: getRiskColorsByLevel(crimeRisk.risk_level).accent,
              fillColor: getRiskColorsByLevel(crimeRisk.risk_level).accent,
              fillOpacity: 0.08, weight: 2, opacity: 0.6,
            }}
          />
        )}

        {selectedLocation && (
          <Marker position={[selectedLocation.lat, selectedLocation.lng]} icon={clickedIcon}>
            <Popup className="voyageour-popup">
              <div style={{
                fontFamily:"'Inter','Segoe UI',sans-serif", padding:"8px 10px",
                background:"rgba(5,8,20,0.97)", color:"rgba(255,255,255,0.85)",
                borderRadius:"10px", fontSize:"12px", lineHeight:1.6, minWidth:"140px",
              }}>
                <div style={{ fontWeight:700, fontSize:"11px", letterSpacing:"0.1em", color:"#fbbf24", marginBottom:"4px" }}>SELECTED SPOT</div>
                {selectedCrimeRisk && !selectedCrimeRisk.error
                  ? <div style={{ color:"rgba(255,255,255,0.5)", fontSize:"11px" }}>
                      {selDistrict}{selState ? `, ${selState}` : ""}<br />
                      <span style={{ color: getRiskColorsByLevel(selectedCrimeRisk.risk_level).text }}>
                        {selectedCrimeRisk.risk_level} RISK
                      </span> · Score: {selectedCrimeRisk.risk_score}
                    </div>
                  : <div style={{ color:"rgba(255,255,255,0.35)", fontSize:"11px" }}>Fetching crime data...</div>}
              </div>
            </Popup>
          </Marker>
        )}

        {showHospitals && hospitals
          .filter(h => h.latitude != null && h.longitude != null)
          .map((h, i) => (
            <Marker key={`hosp-${i}`} position={[h.latitude, h.longitude]} icon={hospitalIcon}>
              <Popup className="voyageour-popup">
                <div style={{
                  fontFamily:"'Inter','Segoe UI',sans-serif", padding:"8px 10px",
                  background:"rgba(5,8,20,0.97)", color:"rgba(255,255,255,0.85)",
                  borderRadius:"10px", fontSize:"12px", lineHeight:1.6, minWidth:"140px",
                }}>
                  <div style={{ fontWeight:700, fontSize:"11px", letterSpacing:"0.1em", color:"#10b981", marginBottom:"4px" }}>HOSPITAL</div>
                  <div style={{ color:"rgba(255,255,255,0.7)", fontWeight:600 }}>{h.city}</div>
                  <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"11px" }}>{h.district}, {h.state}</div>
                  <div style={{ color:"#38bdf8", fontSize:"11px", marginTop:"3px" }}>{h.distance_km} km away</div>
                </div>
              </Popup>
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
                <Marker position={[routeWaypoints[0].lat, routeWaypoints[0].lng]} icon={routeStartIcon}>
                  <Popup className="voyageour-popup">
                    <div style={{ fontFamily:"'Inter','Segoe UI',sans-serif", padding:"8px 10px", background:"rgba(5,8,20,0.97)", color:"rgba(255,255,255,0.85)", borderRadius:"10px", fontSize:"12px", lineHeight:1.6 }}>
                      <div style={{ fontWeight:700, fontSize:"11px", letterSpacing:"0.1em", color:"#22c55e", marginBottom:"3px" }}>START</div>
                      <div style={{ color:"rgba(255,255,255,0.6)" }}>{routeWaypoints[0].name}</div>
                    </div>
                  </Popup>
                </Marker>
                <Marker position={[routeWaypoints[routeWaypoints.length - 1].lat, routeWaypoints[routeWaypoints.length - 1].lng]} icon={routeEndIcon}>
                  <Popup className="voyageour-popup">
                    <div style={{ fontFamily:"'Inter','Segoe UI',sans-serif", padding:"8px 10px", background:"rgba(5,8,20,0.97)", color:"rgba(255,255,255,0.85)", borderRadius:"10px", fontSize:"12px", lineHeight:1.6 }}>
                      <div style={{ fontWeight:700, fontSize:"11px", letterSpacing:"0.1em", color:"#f97316", marginBottom:"3px" }}>DESTINATION</div>
                      <div style={{ color:"rgba(255,255,255,0.6)" }}>{routeWaypoints[routeWaypoints.length - 1].name}</div>
                    </div>
                  </Popup>
                </Marker>
                {isLoadingRoutes && (
                  <div style={{
                    position: "absolute",
                    top: "10px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(5,8,20,0.9)",
                    backdropFilter: "blur(12px)",
                    color: "rgba(125,211,252,0.9)",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid rgba(56,189,248,0.2)",
                    zIndex: 1000,
                    fontSize: "12px",
                    fontFamily: "'Inter','Segoe UI',sans-serif",
                    letterSpacing: "0.05em",
                  }}>
                    Computing safe routes…
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
                <Marker position={[routeWaypoints[0].lat, routeWaypoints[0].lng]} icon={routeStartIcon}>
                  <Popup className="voyageour-popup">
                    <div style={{ fontFamily:"'Inter','Segoe UI',sans-serif", padding:"8px 10px", background:"rgba(5,8,20,0.97)", color:"rgba(255,255,255,0.85)", borderRadius:"10px", fontSize:"12px", lineHeight:1.6 }}>
                      <div style={{ fontWeight:700, fontSize:"11px", letterSpacing:"0.1em", color:"#22c55e", marginBottom:"3px" }}>START</div>
                      <div style={{ color:"rgba(255,255,255,0.6)" }}>{routeWaypoints[0].name}</div>
                    </div>
                  </Popup>
                </Marker>
                <Marker position={[routeWaypoints[routeWaypoints.length - 1].lat, routeWaypoints[routeWaypoints.length - 1].lng]} icon={routeEndIcon}>
                  <Popup className="voyageour-popup">
                    <div style={{ fontFamily:"'Inter','Segoe UI',sans-serif", padding:"8px 10px", background:"rgba(5,8,20,0.97)", color:"rgba(255,255,255,0.85)", borderRadius:"10px", fontSize:"12px", lineHeight:1.6 }}>
                      <div style={{ fontWeight:700, fontSize:"11px", letterSpacing:"0.1em", color:"#f97316", marginBottom:"3px" }}>DESTINATION</div>
                      <div style={{ color:"rgba(255,255,255,0.6)" }}>{routeWaypoints[routeWaypoints.length - 1].name}</div>
                    </div>
                  </Popup>
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
