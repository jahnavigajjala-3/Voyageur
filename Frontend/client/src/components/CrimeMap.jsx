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

  // Expose imperative API to parent
  useImperativeHandle(ref, () => ({
    triggerRoute: async (fromInput, toInput) => {
      if (!fromInput || !toInput) { alert("Please enter both locations"); return; }
      try {
        const resolve = async (input) => {
          // Already a resolved coords object (from map pick)
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
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => {
            setShowHospitals(!showHospitals);
            if (!showHospitals && hospitals.length === 0) {
              fetchHospitals();
            }
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            showHospitals ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          🏥 {showHospitals ? 'Hide' : 'Show'} Hospitals
        </button>

        <button
          onClick={showRoute ? clearRoute : () => setShowRoute(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            showRoute ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          🛣️ {showRoute ? 'Clear Route' : 'Plan Route'}
        </button>

        <button
          onClick={checkCurrentLocationCrime}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700"
        >
          📊 Check Crime Rate Here
        </button>

        {clickedLocation && (
          <>
            <button
              onClick={() => setShowClickedLocationDetails(!showClickedLocationDetails)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                showClickedLocationDetails ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              📍 {showClickedLocationDetails ? 'Hide' : 'Show'} Location Details
            </button>
            <button
              onClick={() => {
                setShowClickedHospitals(!showClickedHospitals);
                if (!showClickedHospitals && clickedHospitals.length === 0) {
                  fetchClickedHospitals();
                }
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                showClickedHospitals ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              🏥 {showClickedHospitals ? 'Hide' : 'Show'} Hospitals Here
            </button>
          </>
        )}
      </div>

      {clickedLocation && showClickedLocationDetails && (
        <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm font-semibold text-yellow-800 mb-2">
            📍 Crime rate for clicked location
          </p>
          <p className="text-sm text-gray-700">
            Latitude: {clickedLocation.lat.toFixed(5)}, Longitude: {clickedLocation.lng.toFixed(5)}
          </p>
          {clickError && (
            <p className="text-sm text-red-600 mt-2">{clickError}</p>
          )}
          {clickedCrimeRisk && !clickedCrimeRisk.error && (
            <div className="mt-2 text-sm text-gray-700">
              <p>
                <span className="font-semibold">District:</span> {clickDisplayDistrict}
              </p>
              <p>
                <span className="font-semibold">State:</span> {clickDisplayState}
              </p>
              <p>
                <span className="font-semibold">Risk Level:</span> {clickedCrimeRisk.risk_level}
              </p>
              <p>
                <span className="font-semibold">Score:</span> {clickedCrimeRisk.risk_score}
              </p>
            </div>
          )}
          {clickedCrimeRisk && clickedCrimeRisk.error && (
            <p className="text-sm text-red-600 mt-2">{clickedCrimeRisk.error}</p>
          )}

          <p className="mt-3 text-xs text-gray-500">
            Click anywhere on the map to check crime rate for that district.
          </p>
        </div>
      )}

      {/* Route Input */}
      {showRoute && !routeWaypoints.length && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border">
          <p className="text-sm text-blue-700 mb-2">
            📍 Enter locations to plan a driving route
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="md:col-span-2 flex gap-2">
              <input
                type="text"
                value={routeFrom}
                onChange={(e) => setRouteFrom(e.target.value)}
                placeholder="From (or click 'Use Current')"
                className="flex-1 px-3 py-2 border rounded text-sm"
              />
              <button
                onClick={useCurrentLocationAsFrom}
                className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 whitespace-nowrap"
                title="Use current location as starting point"
              >
                📍 Use Current
              </button>
            </div>
            <input
              type="text"
              value={routeTo}
              onChange={(e) => setRouteTo(e.target.value)}
              placeholder="To (e.g. Mumbai)"
              className="px-3 py-2 border rounded text-sm"
            />
            <button
              onClick={handleShowRoute}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              {loading ? 'Finding...' : 'Show Route'}
            </button>
          </div>
        </div>
      )}

      {/* Risk Badge */}
      {crimeRisk && !crimeRisk.error && (
        <div
          className="mb-3 px-4 py-2 rounded-lg text-white text-sm font-semibold inline-block"
          style={{ backgroundColor: riskColor }}
        >
          {displayDistrict}, {displayState} —{" "}
          {crimeRisk.risk_level} RISK
          <span className="ml-2 font-normal opacity-80">
            (Score: {crimeRisk.risk_score})
          </span>
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

        {/* Current location marker */}
        <Marker position={[location.lat, location.lng]}>
          <Popup>
            <strong>You are here</strong>
            {crimeRisk && !crimeRisk.error && (
              <><br />{displayDistrict}{displayState ? `, ${displayState}` : ""}<br />Risk: {crimeRisk.risk_level}</>
            )}
          </Popup>
        </Marker>

        {clickedLocation && showClickedLocationDetails && (
          <Marker position={[clickedLocation.lat, clickedLocation.lng]}>
            <Popup>
              📍 Selected spot<br />
              {clickedCrimeRisk ? (
                <>
                  Risk: {clickedCrimeRisk.risk_level}<br />
                  Score: {clickedCrimeRisk.risk_score}
                </>
              ) : (
                'Fetching crime rate...'
              )}
            </Popup>
          </Marker>
        )}

        {/* Risk overlay circle for current location */}
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

        {/* Clicked location marker — always shown when a location is selected */}
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

      {/* Hospital counts */}
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
