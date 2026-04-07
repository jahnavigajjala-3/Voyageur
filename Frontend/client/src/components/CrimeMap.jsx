import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import useLocation from "../hooks/useLocation";
import { getCrimeRiskByCoords, getNearbyHospitals } from "../api/api";

// Fix default leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const RISK_COLORS = {
  HIGH:    "#ef4444", // red
  MEDIUM:  "#f97316", // orange
  LOW:     "#22c55e", // green
  UNKNOWN: "#6b7280", // gray
};

// Hospital marker icon
const hospitalIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Routing component with OSRM API
function RoutingMachine({ waypoints, isActive }) {
  const map = useMap();
  const routeLayerRef = useRef(null);

  useEffect(() => {
    if (!waypoints || waypoints.length < 2 || !isActive || !map) return;

    let cancelled = false;

    const fetchRoute = async () => {
      try {
        console.log('Fetching route from OSRM...');
        const coordinates = waypoints.map(wp => `${wp.lng},${wp.lat}`).join(';');
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`
        );

        if (!response.ok) {
          throw new Error(`OSRM API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('OSRM response:', data);

        if (cancelled) {
          console.log('Route fetch cancelled before display');
          return;
        }

        if (data.routes && data.routes.length > 0) {
          const geometry = data.routes[0].geometry;

          routeLayerRef.current = L.geoJSON(geometry, {
            style: {
              color: '#2563eb',
              weight: 4,
              opacity: 0.8
            }
          }).addTo(map);

          console.log('Route displayed successfully');

          if (cancelled && routeLayerRef.current) {
            map.removeLayer(routeLayerRef.current);
            routeLayerRef.current = null;
          }
        } else {
          console.error('No routes found in OSRM response');
        }
      } catch (error) {
        console.error('Error fetching route:', error);
      }
    };

    fetchRoute();

    return () => {
      cancelled = true;
      if (routeLayerRef.current && map) {
        try {
          map.removeLayer(routeLayerRef.current);
        } catch (e) {
          console.error('Error removing route layer:', e);
        }
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

    const handleClick = (event) => {
      const { lat, lng } = event.latlng;
      onMapClick(lat, lng);
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, onMapClick]);

  return null;
}

export default function CrimeMap() {
  const { location, error } = useLocation();
  const [crimeRisk, setCrimeRisk] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [showHospitals, setShowHospitals] = useState(false);
  const [showRoute, setShowRoute] = useState(false);
  const [routeFrom, setRouteFrom] = useState('');
  const [routeTo, setRouteTo] = useState('');
  const [routeWaypoints, setRouteWaypoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clickedLocation, setClickedLocation] = useState(null);
  const [clickedCrimeRisk, setClickedCrimeRisk] = useState(null);
  const [clickError, setClickError] = useState(null);
  const [currentLocationCrime, setCurrentLocationCrime] = useState(null);
  const [currentLocationError, setCurrentLocationError] = useState(null);
  const [showClickedLocationDetails, setShowClickedLocationDetails] = useState(true);

  useEffect(() => {
    if (!location || hasFetched) return;

    const fetchData = async () => {
      try {
        const riskData = await getCrimeRiskByCoords(location.lat, location.lng);
        setCrimeRisk(riskData);
        setHasFetched(true);
      } catch (err) {
        console.error("Crime risk fetch failed:", err);
      }
    };

    fetchData();
  }, [location, hasFetched]);

  const fetchHospitals = async () => {
    if (!location) return;
    try {
      const hospitalData = await getNearbyHospitals(location.lat, location.lng, 20, 10);
      setHospitals(hospitalData);
    } catch (err) {
      console.error("Hospital fetch failed:", err);
    }
  };

  const geocodeLocation = async (location) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1&countrycodes=IN`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          name: data[0].display_name.split(',')[0] || location
        };
      }
      throw new Error('Location not found');
    } catch (error) {
      console.error('Geocoding error:', error);
      throw error;
    }
  };

  const handleShowRoute = async () => {
    if (!routeFrom || !routeTo) {
      alert('Please enter both from and to locations');
      return;
    }

    setLoading(true);
    try {
      console.log('Geocoding locations...');
      const [fromResult, toResult] = await Promise.all([
        geocodeLocation(routeFrom),
        geocodeLocation(routeTo)
      ]);

      console.log('Geocoding results:', fromResult, toResult);

      if (fromResult && toResult) {
        setRouteWaypoints([fromResult, toResult]);
        setShowRoute(true);
        console.log('Route waypoints set successfully');
      } else {
        alert('Could not find one or both locations. Please try more specific addresses.');
      }
    } catch (error) {
      console.error('Route planning error:', error);
      alert('Error finding locations. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearRoute = () => {
    setShowRoute(false);
    setRouteWaypoints([]);
    setRouteFrom('');
    setRouteTo('');
  };

  const handleMapClick = async (lat, lng) => {
    setClickedLocation({ lat, lng });
    setClickedCrimeRisk(null);
    setClickError(null);

    try {
      const riskData = await getCrimeRiskByCoords(lat, lng);
      setClickedCrimeRisk(riskData);
    } catch (err) {
      console.error('Map click crime lookup failed:', err);
      setClickError('Unable to fetch crime rate for this location. Please try again.');
    }
  };

  const checkCurrentLocationCrime = async () => {
    if (!location) return;

    setCurrentLocationCrime(null);
    setCurrentLocationError(null);

    try {
      const riskData = await getCrimeRiskByCoords(location.lat, location.lng);
      setCurrentLocationCrime(riskData);
    } catch (err) {
      console.error('Current location crime lookup failed:', err);
      setCurrentLocationError('Unable to fetch crime rate for your current location. Please try again.');
    }
  };

  if (error) return <p className="text-red-500">Location error: {error}</p>;
  if (!location) return <p className="text-gray-500">Fetching location...</p>;

  const riskColor = RISK_COLORS[crimeRisk?.risk_level] || RISK_COLORS.UNKNOWN;

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
          <button
            onClick={() => setShowClickedLocationDetails(!showClickedLocationDetails)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              showClickedLocationDetails ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            📍 {showClickedLocationDetails ? 'Hide' : 'Show'} Location Details
          </button>
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
                <span className="font-semibold">District:</span> {clickedCrimeRisk.detected_district}
              </p>
              <p>
                <span className="font-semibold">State:</span> {clickedCrimeRisk.detected_state}
              </p>
              <p>
                <span className="font-semibold">Risk Level:</span> {clickedCrimeRisk.risk_level}
              </p>
              <p>
                <span className="font-semibold">Score:</span> {clickedCrimeRisk.risk_score}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Click anywhere on the map to inspect crime rate for that spot.
              </p>
            </div>
          )}
          {clickedCrimeRisk && clickedCrimeRisk.error && (
            <p className="text-sm text-red-600 mt-2">{clickedCrimeRisk.error}</p>
          )}
        </div>
      )}

      {/* Route Input */}
      {showRoute && !routeWaypoints.length && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border">
          <p className="text-sm text-blue-700 mb-2">
            📍 Enter locations to plan a driving route
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              type="text"
              value={routeFrom}
              onChange={(e) => setRouteFrom(e.target.value)}
              placeholder="From (e.g. Bengaluru)"
              className="px-3 py-2 border rounded text-sm"
            />
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
          {crimeRisk.detected_district}, {crimeRisk.detected_state} —{" "}
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
        style={{ height: "450px", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onMapClick={handleMapClick} />

        {/* Live location marker */}
        <Marker position={[location.lat, location.lng]}>
          <Popup>
            📍 You are here
            {crimeRisk && !crimeRisk.error && (
              <><br />{crimeRisk.detected_district}<br />Risk: {crimeRisk.risk_level}</>
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

        {/* Risk overlay circle */}
        {crimeRisk && !crimeRisk.error && (
          <Circle
            center={[location.lat, location.lng]}
            radius={5000}
            pathOptions={{
              color: riskColor,
              fillColor: riskColor,
              fillOpacity: 0.15,
            }}
          />
        )}

        {/* Hospital markers */}
        {showHospitals && hospitals
          .filter((hospital) => hospital.latitude != null && hospital.longitude != null)
          .map((hospital, index) => (
            <Marker
              key={index}
              position={[hospital.latitude, hospital.longitude]}
              icon={hospitalIcon}
            >
              <Popup>
                🏥 <strong>{hospital.city}</strong><br />
                📍 {hospital.district}, {hospital.state}<br />
                ⭐ Rating: {hospital.rating}/5<br />
                📊 Reviews: {hospital.reviews}<br />
                ⛳ Distance: {hospital.distance_km} km
              </Popup>
            </Marker>
          ))}

        {/* Route */}
        {showRoute && routeWaypoints.length >= 2 && (
          <>
            <RoutingMachine waypoints={routeWaypoints} isActive={showRoute} />
            <Marker position={[routeWaypoints[0].lat, routeWaypoints[0].lng]}>
              <Popup>🚩 Start: {routeWaypoints[0].name}</Popup>
            </Marker>
            <Marker position={[routeWaypoints[routeWaypoints.length - 1].lat, routeWaypoints[routeWaypoints.length - 1].lng]}>
              <Popup>🏁 Destination: {routeWaypoints[routeWaypoints.length - 1].name}</Popup>
            </Marker>
          </>
        )}
      </MapContainer>

      {/* Hospital count */}
      {showHospitals && (
        <p className="mt-2 text-sm text-gray-600">
          Found {hospitals.length} hospitals within 20km
        </p>
      )}
    </div>
  );
}