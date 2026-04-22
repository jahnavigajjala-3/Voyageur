import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import useLocation from "../hooks/useLocation";
import { getCrimeRiskByCoords, getNearbyHospitals } from "../api/api";

// Fix default leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const hospitalIcon = new L.Icon({
  iconUrl:    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl:  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize:   [25, 41],
  iconAnchor: [12, 41],
  popupAnchor:[1, -34],
  shadowSize: [41, 41],
});

const RISK_CIRCLE_COLORS = {
  HIGH:    "#ef4444",
  MEDIUM:  "#eab308",
  LOW:     "#22c55e",
  UNKNOWN: "#64748b",
};
const clickedIcon = new L.Icon({
  iconUrl:    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl:  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize:   [25, 41],
  iconAnchor: [12, 41],
  popupAnchor:[1, -34],
  shadowSize: [41, 41],
});

// Dark green marker for route start/end
const routeIcon = new L.Icon({
  iconUrl:    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl:  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize:   [25, 41],
  iconAnchor: [12, 41],
  popupAnchor:[1, -34],
  shadowSize: [41, 41],
});

function RoutingMachine({ waypoints, isActive }) {
  const map = useMap();
  const routeLayerRef = useRef(null);

  useEffect(() => {
    if (!waypoints || waypoints.length < 2 || !isActive || !map) return;
    let cancelled = false;

    const fetchRoute = async () => {
      try {
        const coords = waypoints.map((wp) => `${wp.lng},${wp.lat}`).join(";");
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
        );
        if (!res.ok) throw new Error(`OSRM ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.routes?.length > 0) {
          routeLayerRef.current = L.geoJSON(data.routes[0].geometry, {
            style: { color: "#16a34a", weight: 4, opacity: 0.85 },
          }).addTo(map);
        }
      } catch (err) {
        console.error("Route fetch error:", err);
      }
    };

    fetchRoute();
    return () => {
      cancelled = true;
      if (routeLayerRef.current && map) {
        try { map.removeLayer(routeLayerRef.current); } catch (_) { /* ignore */ }
        routeLayerRef.current = null;
      }
    };
  }, [waypoints, isActive, map]);

  return null;
}

function MapClickHandler({ onMapClick }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const handler = (e) => onMapClick(e.latlng.lat, e.latlng.lng);
    map.on("click", handler);
    return () => map.off("click", handler);
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

function RecenterButton({ lat, lng }) {  const map = useMap();
  const [hovered, setHovered] = useState(false);

  const handleClick = () => {
    map.flyTo([lat, lng], map.getZoom(), { duration: 1.2, easeLinearity: 0.25 });
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: "24px",
        right: "12px",
        zIndex: 1000,
      }}
    >
      <button
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title="Recenter to my location"
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: hovered
            ? "rgba(139,92,246,0.35)"
            : "rgba(10,10,20,0.7)",
          backdropFilter: "blur(12px)",
          border: hovered
            ? "1px solid rgba(139,92,246,0.6)"
            : "1px solid rgba(255,255,255,0.15)",
          boxShadow: hovered
            ? "0 0 14px rgba(139,92,246,0.4)"
            : "0 4px 12px rgba(0,0,0,0.4)",
          color: hovered ? "rgba(167,139,250,1)" : "rgba(255,255,255,0.7)",
          fontSize: "15px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s ease",
          transform: hovered ? "scale(1.08)" : "scale(1)",
        }}
      >
        ◎
      </button>
    </div>
  );
}

const CrimeMap = forwardRef(function CrimeMap(
  { embedded = false, onRiskUpdate, onClickedRiskUpdate, pickingFor, onRoutePick },
  ref
) {
  const { location, error } = useLocation();
  const [crimeRisk, setCrimeRisk]   = useState(null);
  const [hospitals, setHospitals]   = useState([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [showHospitals, setShowHospitals] = useState(false);
  const [routeWaypoints, setRouteWaypoints] = useState([]);
  const [routeActive, setRouteActive]       = useState(false);
  const [clickedLocation, setClickedLocation]   = useState(null);
  const [clickedCrimeRisk, setClickedCrimeRisk] = useState(null);
  const [clickedHospitals, setClickedHospitals] = useState([]);
  const [showClickedHospitals, setShowClickedHospitals] = useState(false);
  const [flyTarget, setFlyTarget] = useState(null);

  // Expose imperative API to parent
  useImperativeHandle(ref, () => ({
    triggerRoute: async (fromInput, toInput) => {
      if (!fromInput || !toInput) { alert("Please enter both locations"); return; }
      try {
        const resolve = async (input) => {
          if (typeof input === "object" && input.lat) return input;
          if (input === "Current Location" && location)
            return { lat: location.lat, lng: location.lng, name: "Current Location" };
          return await geocode(input);
        };
        const [fromResult, toResult] = await Promise.all([resolve(fromInput), resolve(toInput)]);
        if (fromResult && toResult) {
          setRouteWaypoints([fromResult, toResult]);
          setRouteActive(true);
        } else {
          alert("Could not find one or both locations.");
        }
      } catch (err) {
        console.error("Route error:", err);
        alert("Error finding locations. Check your connection and try again.");
      }
    },
    clearRoute: () => { setRouteActive(false); setRouteWaypoints([]); },
    toggleHospitals: () => {
      setShowHospitals((prev) => {
        if (!prev && hospitals.length === 0) fetchHospitals();
        return !prev;
      });
    },
    checkCrimeHere: async () => {
      if (!location) return;
      try {
        const riskData = await getCrimeRiskByCoords(location.lat, location.lng);
        if (onRiskUpdate) onRiskUpdate(riskData);
      } catch (err) {
        console.error("Crime check failed:", err);
      }
    },
    // Called when a risk card is clicked — fly to that location and show hospitals
    focusLocation: (type, risk) => {
      if (type === "live" && location) {
        setFlyTarget({ lat: location.lat, lng: location.lng });
        setShowHospitals(true);
        if (hospitals.length === 0) fetchHospitals();
      } else if (type === "clicked" && clickedLocation) {
        setFlyTarget({ lat: clickedLocation.lat, lng: clickedLocation.lng });
        setShowClickedHospitals(true);
        if (clickedHospitals.length === 0) fetchClickedHospitals(clickedLocation);
      }
    },
  }));

  // Auto-fetch crime risk on load
  useEffect(() => {
    if (!location || hasFetched) return;
    const run = async () => {
      try {
        const riskData = await getCrimeRiskByCoords(location.lat, location.lng);
        setCrimeRisk(riskData);
        setHasFetched(true);
        if (onRiskUpdate) onRiskUpdate(riskData);
      } catch (err) {
        console.error("Crime risk fetch failed:", err);
      }
    };
    run();
  }, [location, hasFetched, onRiskUpdate]);

  const fetchHospitals = async () => {
    if (!location) return;
    try {
      const data = await getNearbyHospitals(location.lat, location.lng, 30, 10);
      setHospitals(data);
    } catch (err) {
      console.error("Hospital fetch failed:", err);
    }
  };

  const fetchClickedHospitals = async (loc) => {
    try {
      const data = await getNearbyHospitals(loc.lat, loc.lng, 30, 10);
      setClickedHospitals(data);
    } catch (err) {
      console.error("Clicked hospital fetch failed:", err);
    }
  };

  const geocode = async (query) => {
    // Photon (OpenStreetMap-based) — CORS-friendly, no API key needed
    const res  = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en`
    );
    const data = await res.json();
    const feat = data?.features?.[0];
    if (feat) {
      const [lng, lat] = feat.geometry.coordinates;
      const name = feat.properties.name || feat.properties.city || query;
      return { lat, lng, name };
    }
    throw new Error("Location not found");
  };

  const handleMapClick = async (lat, lng) => {
    // If pick mode is active, pass coords directly — no reverse-geocode needed
    if (pickingFor && onRoutePick) {
      // Pass the actual coords object so triggerRoute can use them without geocoding
      onRoutePick({ lat, lng, name: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
      return;
    }

    // Normal map click — crime lookup
    const loc = { lat, lng };
    setClickedLocation(loc);
    setClickedCrimeRisk(null);
    setClickedHospitals([]);
    setShowClickedHospitals(false);
    try {
      const riskData = await getCrimeRiskByCoords(lat, lng);
      setClickedCrimeRisk(riskData);
      if (onClickedRiskUpdate) onClickedRiskUpdate(riskData);
    } catch (err) {
      console.error("Map click crime lookup failed:", err);
    }
  };

  if (error)    return <p style={{ color: "#fca5a5", padding: "16px", fontSize: "13px" }}>Location error: {error}</p>;
  if (!location) return <p style={{ color: "rgba(255,255,255,0.3)", padding: "16px", fontSize: "13px" }}>Fetching location...</p>;

  const displayDistrict = crimeRisk?.detected_district || crimeRisk?.district || "Unknown";
  const displayState    = crimeRisk?.detected_state    || crimeRisk?.state    || "";
  const clickDistrict   = clickedCrimeRisk?.detected_district || clickedCrimeRisk?.district || "Unknown";
  const clickState      = clickedCrimeRisk?.detected_state    || clickedCrimeRisk?.state    || "";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Hospitals at selection — only when a location is clicked */}
      {clickedLocation && (
        <div className="anim-fade-in flex flex-wrap gap-1.5 px-4 pt-3 pb-2">
          <button
            className="ctrl-btn px-3 py-1 rounded-lg text-xs font-medium"
            style={
              showClickedHospitals
                ? { background: "rgba(34,197,94,0.18)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac" }
                : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }
            }
            onClick={() => {
              setShowClickedHospitals((p) => {
                if (!p && clickedHospitals.length === 0) fetchClickedHospitals(clickedLocation);
                return !p;
              });
            }}
          >
            {showClickedHospitals ? "Hide Hospitals Here" : "Hospitals at Selection"}
          </button>
        </div>
      )}

      {/* Map */}
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

        {/* Current location marker */}
        <Marker position={[location.lat, location.lng]}>
          <Popup>
            <strong>You are here</strong>
            {crimeRisk && !crimeRisk.error && (
              <><br />{displayDistrict}{displayState ? `, ${displayState}` : ""}<br />Risk: {crimeRisk.risk_level}</>
            )}
          </Popup>
        </Marker>

        {/* Risk zone circle */}
        {crimeRisk && !crimeRisk.error && (
          <Circle
            center={[location.lat, location.lng]}
            radius={5000}
            pathOptions={{
              color: RISK_CIRCLE_COLORS[crimeRisk.risk_level] || RISK_CIRCLE_COLORS.UNKNOWN,
              fillColor: RISK_CIRCLE_COLORS[crimeRisk.risk_level] || RISK_CIRCLE_COLORS.UNKNOWN,
              fillOpacity: 0.08,
              weight: 2,
              opacity: 0.6,
            }}
          />
        )}

        {/* Clicked location marker */}
        {clickedLocation && (
          <Marker position={[clickedLocation.lat, clickedLocation.lng]} icon={clickedIcon}>
            <Popup>
              <strong>Selected spot</strong><br />
              {clickedCrimeRisk && !clickedCrimeRisk.error
                ? <>{clickDistrict}{clickState ? `, ${clickState}` : ""}<br />Risk: {clickedCrimeRisk.risk_level}<br />Score: {clickedCrimeRisk.risk_score}</>
                : "Fetching crime data..."}
            </Popup>
          </Marker>
        )}

        {/* Hospitals near current location */}
        {showHospitals && hospitals
          .filter((h) => h.latitude != null && h.longitude != null)
          .map((h, i) => (
            <Marker key={`h-${i}`} position={[h.latitude, h.longitude]} icon={hospitalIcon}>
              <Popup><strong>{h.city}</strong><br />{h.district}, {h.state}<br />Distance: {h.distance_km} km</Popup>
            </Marker>
          ))}

        {/* Hospitals near clicked location */}
        {showClickedHospitals && clickedHospitals
          .filter((h) => h.latitude != null && h.longitude != null)
          .map((h, i) => (
            <Marker key={`ch-${i}`} position={[h.latitude, h.longitude]} icon={hospitalIcon}>
              <Popup><strong>{h.city}</strong><br />{h.district}, {h.state}<br />Distance: {h.distance_km} km</Popup>
            </Marker>
          ))}

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

      {showHospitals && (
        <p className="anim-fade-in px-4 py-1.5 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          {hospitals.length} hospitals within 30 km of your location
        </p>
      )}
      {showClickedHospitals && clickedLocation && (
        <p className="anim-fade-in px-4 pb-2 text-xs" style={{ color: "rgba(134,239,172,0.7)" }}>
          {clickedHospitals.length} hospitals within 30 km of selected location
        </p>
      )}
    </div>
  );
});

export default CrimeMap;
