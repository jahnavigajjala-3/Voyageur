import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import CrimeMap from "../components/CrimeMap";
import { useNavigate } from "react-router-dom";
import { createTrip } from "../api/api";

export default function Dashboard() {
  const { user, logout } = useContext(AuthContext);
  const navigate         = useNavigate();

  const [tripForm, setTripForm] = useState({
    from: "",
    to: "",
    start_date: "",
    end_date: "",
  });
  const [tripSaved, setTripSaved]   = useState(false);
  const [tripError, setTripError]   = useState("");
  const [saving, setSaving]         = useState(false);

  const handleTripChange = (e) => {
    setTripForm({ ...tripForm, [e.target.name]: e.target.value });
  };

  const handleTripSubmit = async () => {
    if (!tripForm.from || !tripForm.to || !tripForm.start_date || !tripForm.end_date) {
      setTripError("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    setTripError("");

    try {
      await createTrip({
        user_id: user?.id || 1,
        destination: tripForm.to,
        start_date: new Date(tripForm.start_date).toISOString(),
        end_date: new Date(tripForm.end_date).toISOString(),
        notes: `From: ${tripForm.from}`,
      });
      setTripSaved(true);
    } catch (err) {
      setTripError("Failed to save trip. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">

      {/* Top Bar */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Amigo 🌍</h1>
        <button
          onClick={logout}
          className="bg-black text-white px-4 py-2 rounded-lg"
        >
          Logout
        </button>
      </div>

      {/* Welcome Card */}
      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <h2 className="text-xl font-semibold">Welcome {user?.email} 👋</h2>
        <p className="text-gray-500 mt-1 text-sm">Your smart travel companion is active 🚀</p>
      </div>

      {/* Trip Planner */}
      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">Plan Your Trip 🗺️</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 uppercase font-semibold">From</label>
            <input
              name="from"
              value={tripForm.from}
              onChange={handleTripChange}
              placeholder="e.g. Bengaluru"
              className="w-full border rounded-lg px-4 py-2 mt-1 text-sm outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase font-semibold">To</label>
            <input
              name="to"
              value={tripForm.to}
              onChange={handleTripChange}
              placeholder="e.g. Mumbai"
              className="w-full border rounded-lg px-4 py-2 mt-1 text-sm outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase font-semibold">Departure Date</label>
            <input
              name="start_date"
              type="date"
              value={tripForm.start_date}
              onChange={handleTripChange}
              className="w-full border rounded-lg px-4 py-2 mt-1 text-sm outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase font-semibold">Return Date</label>
            <input
              name="end_date"
              type="date"
              value={tripForm.end_date}
              onChange={handleTripChange}
              className="w-full border rounded-lg px-4 py-2 mt-1 text-sm outline-none focus:ring-2 focus:ring-black"
            />
          </div>

        </div>

        {tripError && <p className="text-red-500 text-sm mt-3">{tripError}</p>}
        {tripSaved && <p className="text-green-600 text-sm mt-3">✅ Trip saved successfully!</p>}

        <button
          onClick={handleTripSubmit}
          disabled={saving}
          className="mt-4 bg-black text-white px-6 py-2 rounded-xl text-sm disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Trip →"}
        </button>
      </div>

      {/* Live Map */}
      <div className="bg-white p-4 rounded-xl shadow mb-6">
        <h2 className="text-lg font-semibold mb-3">Live Location & Crime Risk</h2>
        <CrimeMap />
      </div>

      {/* AI Chat */}
      <div className="text-center">
        <button
          onClick={() => navigate("/chat")}
          className="bg-black text-white px-6 py-3 rounded-xl"
        >
          Open AI Assistant 🤖
        </button>
      </div>

    </div>
  );
}