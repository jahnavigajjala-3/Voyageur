import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import useLocation from "../hooks/useLocation";

export default function CrimeMap() {
  const { location, error } = useLocation();

  if (error) return <p>Error: {error}</p>;
  if (!location) return <p>Fetching location...</p>;

  return (
    <MapContainer
      center={[location.lat, location.lng]}
      zoom={15}
      style={{ height: "500px", width: "100%" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[location.lat, location.lng]}>
        <Popup>You are here 📍</Popup>
      </Marker>
    </MapContainer>
  );
}