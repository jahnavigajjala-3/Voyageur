import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bus, CalendarDays, Hotel, Image, IndianRupee, MapPin, Mountain, Plane, Search, Train } from "lucide-react";
import { getTripGuidance } from "../api/api";

const FEEDS = ["Mountains", "Beaches", "Urban", "Nature", "Culture", "Adventure"];
const BUDGETS = ["economy", "midrange", "luxury"];
const TRANSITS = [
  { value: "airport", label: "Nearest airport" },
  { value: "railway", label: "Nearest railway" },
  { value: "bus", label: "Nearest bus stand" },
];
const quickPlaces = ["Goa", "Mumbai", "Bengaluru", "Jaipur", "Kochi", "Delhi"];

const iconsByMode = { Flight: Plane, Train, Bus };

const makeSearchUrl = (base, query) => `${base}${encodeURIComponent(query)}`;
const makeImageUrl = (keyword) => `https://source.unsplash.com/1200x800/?${encodeURIComponent(keyword || "travel")}`;

function makeBookingLinks(destination, guidance) {
  const stay = guidance?.stay_suggestions?.[0];
  return [
    {
      label: "Flights",
      icon: Plane,
      tone: "#38bdf8",
      detail: "Compare live airfares",
      url: makeSearchUrl("https://www.google.com/travel/flights?q=", `flights to ${destination}`),
    },
    {
      label: "Trains",
      icon: Train,
      tone: "#a78bfa",
      detail: "Search rail options",
      url: makeSearchUrl("https://www.google.com/search?q=", `book train to ${destination}`),
    },
    {
      label: "Buses",
      icon: Bus,
      tone: "#34d399",
      detail: "Open bus booking",
      url: makeSearchUrl("https://www.redbus.in/search?toCityName=", destination),
    },
    {
      label: "Hotels",
      icon: Hotel,
      tone: "#fbbf24",
      detail: stay ? `${stay.type} · ${stay.price_per_night}` : "Compare stays",
      url: makeSearchUrl("https://www.booking.com/searchresults.html?ss=", destination),
    },
  ];
}

export default function TripGuide() {
  const [form, setForm] = useState({
    from_location: "Current Location",
    transit_preference: "airport",
    destination: "Goa",
    feed_preference: "Beaches",
    budget_scale: "midrange",
    duration: 3,
  });
  const [draftDestination, setDraftDestination] = useState("Goa");
  const [guidance, setGuidance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const imageKeywords = guidance?.destination_visuals?.length
    ? guidance.destination_visuals
    : [`${form.destination} ${form.feed_preference}`, `${form.destination} travel`, `${form.destination} hotel`];
  const links = useMemo(() => makeBookingLinks(form.destination, guidance), [form.destination, guidance]);

  const fetchGuidance = async (payload = form) => {
    setLoading(true);
    setError("");
    try {
      const data = await getTripGuidance({
        ...payload,
        duration: Number(payload.duration) || 1,
      });
      setGuidance(data);
    } catch (err) {
      console.error("Trip guidance failed:", err);
      setError(err.message || "Could not generate trip guidance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuidance(form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGuidance(form);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.from_location, form.transit_preference, form.feed_preference, form.budget_scale, form.duration, form.destination]);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const destination = draftDestination.trim() || form.destination;
    const next = { ...form, destination };
    setForm(next);
    fetchGuidance(next);
  };

  const applyQuickPlace = (destination) => {
    setDraftDestination(destination);
    const next = { ...form, destination };
    setForm(next);
    fetchGuidance(next);
  };

  const primaryKeyword = imageKeywords[0];

  return (
    <div className="min-h-screen w-full"
      style={{
        background: "radial-gradient(ellipse at 20% 15%, rgba(14,165,233,0.18), transparent 40%), radial-gradient(ellipse at 85% 20%, rgba(168,85,247,0.13), transparent 38%), #04060f",
        color: "#fff",
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}>
      <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-5 px-5 py-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="ctrl-btn flex items-center justify-center rounded-xl"
              style={{ width: "38px", height: "38px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.72)" }}>
              <ArrowLeft size={18} />
            </Link>
            <div>
              <p className="text-[10px] font-semibold uppercase" style={{ color: "rgba(125,211,252,0.72)", letterSpacing: "0.14em" }}>Trip guidance</p>
              <h1 className="text-2xl font-bold" style={{ color: "rgba(255,255,255,0.92)" }}>{form.destination}</h1>
            </div>
          </div>
          {loading && <span className="rounded-full px-3 py-1 text-xs" style={{ background: "rgba(56,189,248,0.1)", color: "#7dd3fc", border: "1px solid rgba(56,189,248,0.2)" }}>Generating...</span>}
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.35fr_0.9fr]">
          <div className="overflow-hidden rounded-2xl voyageour-panel">
            <div style={{ height: "360px", position: "relative", background: "rgba(255,255,255,0.04)" }}>
              <img
                key={primaryKeyword}
                src={makeImageUrl(primaryKeyword)}
                alt={primaryKeyword}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                onError={(e) => { e.currentTarget.src = `https://dummyimage.com/1200x800/111827/ffffff&text=${encodeURIComponent(form.destination)}`; }}
              />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 28%, rgba(4,6,15,0.9))" }} />
              <div className="absolute bottom-5 left-5 right-5">
                <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"
                  style={{ background: "rgba(4,6,15,0.72)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(14px)" }}>
                  <MapPin size={13} />
                  {guidance?.departure_hub || "Choosing departure hub"}
                </div>
                <h2 className="mt-3 text-3xl font-bold">{form.feed_preference} trip to {form.destination}</h2>
                <p className="mt-2 max-w-2xl text-sm" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>
                  Budget: {form.budget_scale}. Duration: {form.duration} days. The plan adapts transport, stays, visuals, and daily activities to your preferences.
                </p>
              </div>
            </div>

            <div className="grid gap-3 p-5 md:grid-cols-3">
              {imageKeywords.map((keyword) => (
                <div key={keyword} className="overflow-hidden rounded-xl" style={{ minHeight: "148px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <img
                    src={makeImageUrl(keyword)}
                    alt={keyword}
                    style={{ width: "100%", height: "108px", objectFit: "cover", display: "block" }}
                    onError={(e) => { e.currentTarget.src = `https://dummyimage.com/600x400/111827/ffffff&text=${encodeURIComponent(keyword)}`; }}
                  />
                  <div className="flex items-center gap-2 px-3 py-2 text-xs" style={{ color: "rgba(255,255,255,0.62)" }}>
                    <Image size={13} style={{ color: "#7dd3fc" }} />
                    <span className="truncate">{keyword}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 border-t p-5" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <Panel title="Travel Suggestions">
                <div className="flex gap-3 overflow-x-auto pb-1">
                {(guidance?.travel_suggestions || []).map((item) => {
                  const Icon = iconsByMode[item.mode] || Plane;
                  return (
                    <div key={item.mode} className="rounded-xl p-3" style={{ minWidth: "240px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm font-semibold"><Icon size={16} style={{ color: "#7dd3fc" }} />{item.mode}</span>
                        <span className="text-xs font-bold" style={{ color: "#86efac" }}>{item.estimated_price}</span>
                      </div>
                      <p className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.48)", lineHeight: 1.6 }}>{item.reason}</p>
                    </div>
                  );
                })}
                </div>
              </Panel>

              <Panel title="Itinerary">
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {(guidance?.itinerary || []).map((day) => (
                    <div key={day.day} className="rounded-xl p-3" style={{ minWidth: "250px", maxWidth: "280px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Day {day.day}</span>
                        <span className="text-[10px]" style={{ color: "#7dd3fc" }}>{day.theme}</span>
                      </div>
                      <ul className="mt-2 list-disc pl-4 text-xs" style={{ color: "rgba(255,255,255,0.56)", lineHeight: 1.7 }}>
                        {day.activities.map((activity) => <li key={activity}>{activity}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <form onSubmit={handleSubmit} className="rounded-2xl p-5 voyageour-panel">
              <p className="text-[10px] font-semibold uppercase" style={{ color: "rgba(255,255,255,0.36)", letterSpacing: "0.13em" }}>Trip constraints</p>
              <div className="mt-4 grid gap-3">
                <Field label="From">
                  <input value={form.from_location} onChange={(e) => updateForm("from_location", e.target.value)}
                    className="glass-input w-full rounded-xl px-3 py-2.5 text-xs"
                    style={inputStyle} />
                </Field>

                <Field label="Destination">
                  <div className="flex gap-2">
                    <input value={draftDestination} onChange={(e) => setDraftDestination(e.target.value)}
                      className="glass-input min-w-0 flex-1 rounded-xl px-3 py-2.5 text-xs"
                      style={inputStyle} />
                    <button className="ctrl-btn flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold"
                      style={{ background: "rgba(56,189,248,0.14)", border: "1px solid rgba(56,189,248,0.28)", color: "#7dd3fc" }}>
                      <Search size={13} /> Go
                    </button>
                  </div>
                </Field>

                <Field label="Transit preference">
                  <Segmented options={TRANSITS} value={form.transit_preference} onChange={(value) => updateForm("transit_preference", value)} />
                </Field>

                <Field label="Feed preference">
                  <div className="grid grid-cols-2 gap-2">
                    {FEEDS.map((feed) => (
                      <button key={feed} type="button" onClick={() => updateForm("feed_preference", feed)}
                        className="ctrl-btn flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
                        style={choiceStyle(form.feed_preference === feed)}>
                        <Mountain size={13} />
                        {feed}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Budget scale">
                  <div className="grid grid-cols-3 gap-2">
                    {BUDGETS.map((budget) => (
                      <button key={budget} type="button" onClick={() => updateForm("budget_scale", budget)}
                        className="ctrl-btn rounded-xl px-3 py-2 text-xs font-semibold capitalize"
                        style={choiceStyle(form.budget_scale === budget)}>
                        {budget}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Duration">
                  <div className="flex items-center gap-3 rounded-xl px-3 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <CalendarDays size={16} style={{ color: "#7dd3fc" }} />
                    <input type="range" min="1" max="10" value={form.duration}
                      onChange={(e) => updateForm("duration", Number(e.target.value))}
                      className="flex-1" />
                    <span className="text-sm font-bold tabular-nums">{form.duration}d</span>
                  </div>
                </Field>
              </div>
              {error && <p className="mt-3 text-xs" style={{ color: "#fca5a5" }}>{error}</p>}
            </form>

            <Panel title="Stay Suggestions">
              {(guidance?.stay_suggestions || []).map((stay) => (
                <div key={stay.hotel_name} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center gap-2 text-sm font-semibold"><Hotel size={16} style={{ color: "#fbbf24" }} />{stay.hotel_name}</div>
                  <p className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.52)" }}>{stay.type} · {stay.price_per_night}</p>
                </div>
              ))}
            </Panel>

            <Panel title="Booking Redirects">
              {links.map(({ label, icon: Icon, tone, detail, url }) => (
                <a key={label} href={url} target="_blank" rel="noreferrer"
                  className="ctrl-btn flex items-center gap-3 rounded-xl p-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "inherit", textDecoration: "none" }}>
                  <span className="flex items-center justify-center rounded-lg"
                    style={{ width: "34px", height: "34px", background: `${tone}18`, color: tone, border: `1px solid ${tone}38`, flexShrink: 0 }}>
                    <Icon size={17} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold" style={{ color: "rgba(255,255,255,0.86)" }}>{label}</span>
                    <span className="block text-xs" style={{ color: "rgba(255,255,255,0.42)" }}>{detail}</span>
                  </span>
                  <span className="text-xs" style={{ color: "rgba(125,211,252,0.78)" }}>Open</span>
                </a>
              ))}
            </Panel>

            <div className="rounded-2xl p-4 voyageour-panel">
              <p className="text-[10px] font-semibold uppercase" style={{ color: "rgba(255,255,255,0.36)", letterSpacing: "0.13em" }}>Quick places</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {quickPlaces.map((item) => (
                  <button key={item} type="button" onClick={() => applyQuickPlace(item)}
                    className="ctrl-btn rounded-full px-3 py-1.5 text-xs"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.62)" }}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.88)",
};

function choiceStyle(active) {
  return {
    background: active ? "rgba(56,189,248,0.16)" : "rgba(255,255,255,0.04)",
    border: active ? "1px solid rgba(56,189,248,0.36)" : "1px solid rgba(255,255,255,0.08)",
    color: active ? "#7dd3fc" : "rgba(255,255,255,0.58)",
  };
}

function Field({ label, children }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs" style={{ color: "rgba(255,255,255,0.52)" }}>{label}</span>
      {children}
    </label>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl p-5 voyageour-panel">
      <p className="mb-4 text-[10px] font-semibold uppercase" style={{ color: "rgba(255,255,255,0.36)", letterSpacing: "0.13em" }}>{title}</p>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="grid gap-2">
      {options.map((option) => (
        <button key={option.value} type="button" onClick={() => onChange(option.value)}
          className="ctrl-btn rounded-xl px-3 py-2 text-left text-xs font-semibold"
          style={choiceStyle(value === option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
