import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import useLocation from "../hooks/useLocation";
import { getCrimeRiskByCoords, getNearbyHospitals } from "../api/api";

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

const RISK_CIRCLE_COLORS = {
  HIGH: "#ef4444", MEDIUM: "#eab308", LOW: "#22c55e", UNKNOWN: "#64748b",
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function RoutingMachine({ waypoints, isActive }) {
  const map = useMap();
  const layerRef = useRef(null);
  useEffect(() => {
    if (!waypoints || waypoints.length < 2 || !isActive || !map) return;
    let cancelled = false;
    const run = async () => {
      try {
        const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(";");
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
        if (!res.ok) throw new Error(`OSRM ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.routes?.length > 0) {
          layerRef.current = L.geoJSON(data.routes[0].geometry, {
            style: { color: "#16a34a", weight: 4, opacity: 0.85 },
          }).addTo(map);
        }
      } catch (e) { console.error("Route error:", e); }
    };
    run();
    return () => {
      cancelled = true;
      if (layerRef.current && map) {
        try { map.removeLayer(layerRef.current); } catch (_) { /* ignore */ }
        layerRef.current = null;
      }
    };
  }, [waypoints, isActive, map]);
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
    map.flyTo([target.lat, target.lng], 13, { duration: 1.2, easeLinearity: 0.25 });
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

// ── Main component ────────────────────────────────────────────────────────────

const CrimeMap = forwardRef(function CrimeMap(
  { onRiskUpdate, onClickedRiskUpdate, pickingFor, onRoutePick, onHospitalsChange },
  ref
) {
  const { location, error } = useLocation();
  const [crimeRisk, setCrimeRisk]   = useState(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Route state
  const [routeWaypoints, setRouteWaypoints] = useState([]);
  const [routeActive, setRouteActive]       = useState(false);

  // Fly-to trigger (timestamp ensures re-trigger on same coords)
  const [flyTarget, setFlyTarget] = useState(null);

  // Selected location — fully explicit, no implicit side effects
  const [selectedLocation, setSelectedLocation]   = useState(null);
  const [selectedCrimeRisk, setSelectedCrimeRisk] = useState(null);

  // Hospitals — only shown when explicitly requested
  const [hospitals, setHospitals]         = useState([]);
  const [showHospitals, setShowHospitals] = useState(false);
  const [hospitalCenter, setHospitalCenter] = useState(null); // {lat,lng} for radius circle

  // ── Imperative API ──────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    // Route planning
    triggerRoute: async (fromInput, toInput) => {
      if (!fromInput || !toInput) { alert("Please enter both locations"); return; }
      try {
        const resolve = async (input) => {
          if (typeof input === "object" && input.lat) return input;
          if (input === "Current Location" && location)
            return { lat: location.lat, lng: location.lng, name: "Current Location" };
          return await geocode(input);
        };
        const [from, to] = await Promise.all([resolve(fromInput), resolve(toInput)]);
        if (from && to) { setRouteWaypoints([from, to]); setRouteActive(true); }
        else alert("Could not find one or both locations.");
      } catch (e) {
        console.error("Route error:", e);
        alert("Error finding locations. Check your connection and try again.");
      }
    },
    clearRoute: () => { setRouteActive(false); setRouteWaypoints([]); },

    // Focus map on a location — NO hospital side effects
    focusMap: (type) => {
      const target = type === "live" ? location : selectedLocation;
      if (target) setFlyTarget({ lat: target.lat, lng: target.lng, _ts: Date.now() });
    },

    // Show/hide hospitals for a location — toggle behavior
    showHospitalsFor: async (type) => {
      // If already showing for this same type, hide them
      if (showHospitals) {
        setShowHospitals(false);
        setHospitals([]);
        setHospitalCenter(null);
        if (onHospitalsChange) onHospitalsChange(null);
        return;
      }
      // Otherwise show them for the requested type
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

    // Clear everything — called from confirmation modal
    clearAll: () => {
      setSelectedLocation(null);
      setSelectedCrimeRisk(null);
      setHospitals([]);
      setShowHospitals(false);
      setHospitalCenter(null);
      setRouteActive(false);
      setRouteWaypoints([]);
      if (onHospitalsChange) onHospitalsChange(null);
    },
  }));

  // Auto-fetch crime risk for current location on mount
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
    // Route pick mode — fill field, skip crime lookup
    if (pickingFor && onRoutePick) {
      onRoutePick({ lat, lng, name: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
      return;
    }
    // Normal click — set selected location, reset hospitals (never auto-show)
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

        {/* Current location + risk circle */}
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

        {/* Selected location marker */}
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

        {/* Hospital markers — ONLY when showHospitals = true */}
        {showHospitals && hospitals
          .filter(h => h.latitude != null && h.longitude != null)
          .map((h, i) => (
            <Marker key={`hosp-${i}`} position={[h.latitude, h.longitude]} icon={hospitalIcon}>
              <Popup><strong>{h.city}</strong><br />{h.district}, {h.state}<br />Distance: {h.distance_km} km</Popup>
            </Marker>
          ))}

        {/* Hospital radius circle — ONLY when hospitals are shown */}
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

        {/* Route */}
        {routeActive && routeWaypoints.length >= 2 && (
          <>
            <RoutingMachine waypoints={routeWaypoints} isActive={routeActive} />
            <Marker position={[routeWaypoints[0].lat, routeWaypoints[0].lng]} icon={routeIcon}>
              <Popup>Start: {routeWaypoints[0].name}</Popup>
            </Marker>
            <Marker position={[routeWaypoints[routeWaypoints.length - 1].lat, routeWaypoints[routeWaypoints.length - 1].lng]} icon={routeIcon}>
              <Popup>Destination: {routeWaypoints[routeWaypoints.length - 1].name}</Popup>
            </Marker>
          </>
        )}
      </MapContainer>

    </div>
  );
});

export default CrimeMap;
