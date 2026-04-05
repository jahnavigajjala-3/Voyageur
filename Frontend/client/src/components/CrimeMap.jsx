import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import useLocation from "../hooks/useLocation";
import { getCrimeRiskByCoords } from "../api/api";

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

export default function CrimeMap() {
  const { location, error }   = useLocation();
const [crimeRisk, setCrimeRisk] = useState(null);
const [hasFetched, setHasFetched] = useState(false);

useEffect(() => {
  if (!location || hasFetched) return;

  const fetchRisk = async () => {
    try {
      const data = await getCrimeRiskByCoords(location.lat, location.lng);
      setCrimeRisk(data);
      setHasFetched(true);
    } catch (err) {
      console.error("Crime risk fetch failed:", err);
    }
  };

  fetchRisk();
}, [location, hasFetched]);

  if (error)    return <p className="text-red-500">Location error: {error}</p>;
  if (!location) return <p className="text-gray-500">Fetching location...</p>;

  const riskColor = RISK_COLORS[crimeRisk?.risk_level] || RISK_COLORS.UNKNOWN;

  return (
    <div>
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

        {/* Live location marker */}
        <Marker position={[location.lat, location.lng]}>
          <Popup>
            📍 You are here
            {crimeRisk && !crimeRisk.error && (
              <><br />{crimeRisk.detected_district}<br />Risk: {crimeRisk.risk_level}</>
            )}
          </Popup>
        </Marker>

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
      </MapContainer>
    </div>
  );
}