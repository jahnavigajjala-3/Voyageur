import { createElement, useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bus, CalendarDays, ChevronLeft, ChevronRight, Hotel, Image, MapPin, Mountain, Plane, Search, Train } from "lucide-react";
import { getTripGuidance } from "../api/api";
import { fetchLocationImage } from "../services/unsplashService";
import useLocation from "../hooks/useLocation";
import { getLocationDisplayName } from "../services/geocodingService";

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

function makeBookingLinks(destination, guidance) {
  const travelSuggestions = guidance?.travel_suggestions || [];
  const stay = guidance?.stay_suggestions?.[0];
  
  // Find prices from travel suggestions
  const flightPrice = travelSuggestions.find(t => t.mode === "Flight")?.estimated_price || "Compare prices";
  const trainPrice = travelSuggestions.find(t => t.mode === "Train")?.estimated_price || "Compare prices";
  const busPrice = travelSuggestions.find(t => t.mode === "Bus")?.estimated_price || "Compare prices";
  const hotelPrice = stay?.price_per_night || "Compare stays";
  
  return [
    {
      label: "Flights",
      icon: Plane,
      tone: "#38bdf8",
      detail: flightPrice,
      url: makeSearchUrl("https://www.google.com/travel/flights?q=", `flights to ${destination}`),
    },
    {
      label: "Trains",
      icon: Train,
      tone: "#a78bfa",
      detail: trainPrice,
      url: makeSearchUrl("https://www.google.com/search?q=", `book train to ${destination}`),
    },
    {
      label: "Buses",
      icon: Bus,
      tone: "#34d399",
      detail: busPrice,
      url: makeSearchUrl("https://www.redbus.in/search?toCityName=", destination),
    },
    {
      label: "Hotels",
      icon: Hotel,
      tone: "#fbbf24",
      detail: hotelPrice,
      url: makeSearchUrl("https://www.booking.com/searchresults.html?ss=", destination),
    },
  ];
}

export default function TripGuide() {
  const { location } = useLocation();
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
  const [images, setImages] = useState({});
  const [loadingImages, setLoadingImages] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [actualFromLocation, setActualFromLocation] = useState("Current Location");
  const carouselRef = useRef(null);

  const imageKeywords = guidance?.destination_visuals?.length
    ? guidance.destination_visuals
    : [`${form.destination} ${form.feed_preference}`, `${form.destination} travel`, `${form.destination} hotel`];
  const links = useMemo(() => makeBookingLinks(form.destination, guidance), [form.destination, guidance]);

  // Get actual location name when GPS coordinates are available
  useEffect(() => {
    const fetchActualLocation = async () => {
      if (location?.lat && location?.lng && form.from_location.toLowerCase().includes("current")) {
        try {
          const cityName = await getLocationDisplayName(location.lat, location.lng);
          setActualFromLocation(cityName);
        } catch (err) {
          console.error("Failed to get location name:", err);
          setActualFromLocation("Current Location");
        }
      } else if (!form.from_location.toLowerCase().includes("current")) {
        setActualFromLocation(form.from_location);
      }
    };
    fetchActualLocation();
  }, [location, form.from_location]);

  // Fetch images from Unsplash API
  useEffect(() => {
    const loadImages = async () => {
      setLoadingImages(true);
      const newImages = {};
      
      for (const keyword of imageKeywords) {
        try {
          const imageData = await fetchLocationImage(keyword, {
            width: keyword === imageKeywords[0] ? 1200 : 600,
            height: keyword === imageKeywords[0] ? 800 : 400,
            orientation: 'landscape'
          });
          newImages[keyword] = imageData;
        } catch (err) {
          console.error(`Failed to load image for ${keyword}:`, err);
          newImages[keyword] = {
            url: `https://dummyimage.com/1200x800/f8fafc/0f172a&text=${encodeURIComponent(keyword)}`,
            alt: keyword,
            source: 'fallback'
          };
        }
      }
      
      setImages(newImages);
      setLoadingImages(false);
    };

    if (imageKeywords.length > 0) {
      loadImages();
    }
  }, [imageKeywords]);

  const fetchGuidance = async (payload = form) => {
    setLoading(true);
    setError("");
    try {
      // If from_location is "Current Location" and we have GPS, use actual city name
      let fromLocation = payload.from_location;
      if (fromLocation.toLowerCase().includes("current") && location?.lat && location?.lng) {
        try {
          fromLocation = await getLocationDisplayName(location.lat, location.lng);
        } catch (err) {
          console.warn("Could not get location name, using 'Current Location'");
        }
      }
      
      const data = await getTripGuidance({
        ...payload,
        from_location: fromLocation,
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

  const itineraryDays = guidance?.itinerary || [];
  const totalSlides = itineraryDays.length;

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  // Reset carousel when guidance changes
  useEffect(() => {
    setCurrentSlide(0);
  }, [guidance]);

  const primaryKeyword = imageKeywords[0];

  return (
    <div className="voyageur-page-bg min-h-screen w-full font-sans pb-10" style={{ 
      color: 'rgb(var(--text-primary))',
    }}>
      <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-5 px-5 py-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="flex items-center justify-center rounded-xl w-10 h-10 border shadow-sm transition-colors" style={{
              background: 'rgb(var(--bg-secondary))',
              borderColor: 'rgb(var(--border-primary))',
              color: 'rgb(var(--text-secondary))',
            }}>
              <ArrowLeft size={18} />
            </Link>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgb(var(--accent-cyan))' }}>Trip guidance</p>
              <h1 className="text-2xl font-bold font-serif" style={{ color: 'rgb(var(--text-primary))' }}>{form.destination}</h1>
            </div>
          </div>
          {loading && <span className="rounded-full px-3 py-1 text-xs font-medium border" style={{
            background: 'rgb(var(--accent-cyan) / 0.1)',
            color: 'rgb(var(--accent-cyan))',
            borderColor: 'rgb(var(--accent-cyan) / 0.2)',
          }}>Generating...</span>}
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.35fr_0.9fr]">
          <div className="overflow-hidden rounded-2xl border shadow-sm flex flex-col" style={{
            background: 'rgb(var(--bg-elevated))',
            borderColor: 'rgb(var(--border-primary))',
          }}>
            <div className="h-[360px] relative bg-slate-100 dark:bg-slate-900 flex-shrink-0">
              {loadingImages ? (
                <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-xs text-slate-500">Loading image...</p>
                  </div>
                </div>
              ) : images[primaryKeyword]?.url ? (
                <img
                  key={primaryKeyword}
                  src={images[primaryKeyword].url}
                  alt={images[primaryKeyword].alt}
                  className="w-full h-full object-cover block"
                  onError={(e) => { e.currentTarget.src = `https://dummyimage.com/1200x800/f8fafc/0f172a&text=${encodeURIComponent(form.destination)}`; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{
                  background: images[primaryKeyword]?.gradient || 'linear-gradient(135deg, rgba(14,30,80,0.8) 0%, rgba(7,20,55,0.9) 100%)'
                }}>
                  <p className="text-white text-2xl font-bold">{form.destination}</p>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium bg-white/20 backdrop-blur-md border border-white/30 text-white shadow-sm">
                  <MapPin size={13} />
                  {guidance?.departure_hub || `From ${actualFromLocation}`}
                </div>
                <h2 className="mt-3 text-3xl font-bold font-serif">{form.feed_preference} trip to {form.destination}</h2>
                <p className="mt-2 max-w-2xl text-sm text-white/90 leading-relaxed font-medium">
                  Budget: <span className="capitalize">{form.budget_scale}</span>. Duration: {form.duration} days. The plan adapts transport, stays, visuals, and daily activities to your preferences.
                </p>
              </div>
            </div>

            <div className="grid gap-3 p-5 md:grid-cols-3">
              {imageKeywords.map((keyword) => (
                <div key={keyword} className="overflow-hidden rounded-xl bg-slate-50 border border-slate-200 shadow-sm flex flex-col dark:bg-slate-900/40 dark:border-white/10">
                  {loadingImages ? (
                    <div className="w-full h-[108px] flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                      <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : images[keyword]?.url ? (
                    <img
                      src={images[keyword].url}
                      alt={images[keyword].alt}
                      className="w-full h-[108px] object-cover block"
                      onError={(e) => { e.currentTarget.src = `https://dummyimage.com/600x400/f8fafc/0f172a&text=${encodeURIComponent(keyword)}`; }}
                    />
                  ) : (
                    <div className="w-full h-[108px] flex items-center justify-center" style={{
                      background: images[keyword]?.gradient || 'linear-gradient(135deg, rgba(56,189,248,0.15) 0%, rgba(99,102,241,0.2) 100%)'
                    }}>
                      <Image size={24} className="text-white/50" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-slate-600 font-medium bg-white border-t border-slate-100 dark:bg-slate-900/70 dark:border-white/10 dark:text-slate-300">
                    <Image size={13} className="text-teal-500 dark:text-cyan-300" />
                    <span className="truncate">{keyword}</span>
                  </div>
                  {images[keyword]?.author && images[keyword]?.source === 'unsplash' && (
                    <div className="px-3 py-1.5 text-[9px] text-slate-400 border-t border-slate-100 dark:border-white/10">
                      Photo by <a href={images[keyword].authorUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-teal-500">{images[keyword].author}</a>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="grid gap-4 border-t border-slate-100 p-5 bg-slate-50 flex-1 dark:border-white/10 dark:bg-slate-950/20">
              <Panel title="Itinerary">
                {totalSlides > 0 ? (
                  <div className="relative">
                    {/* Carousel Container */}
                    <div className="overflow-hidden rounded-xl" ref={carouselRef}>
                      <div 
                        className="flex transition-transform duration-500 ease-out"
                        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                      >
                        {itineraryDays.map((day) => (
                          <div key={day.day} className="w-full flex-shrink-0 px-2">
                            <div className="rounded-xl p-5 bg-white border border-slate-200 shadow-sm dark:bg-slate-900/55 dark:border-white/10">
                              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-white/10">
                                <span className="text-lg font-bold text-slate-800 dark:text-slate-100">Day {day.day}</span>
                                <span className="text-xs font-bold text-teal-600 bg-teal-50 px-3 py-1 rounded-full border border-teal-100 dark:bg-cyan-400/10 dark:border-cyan-400/20 dark:text-cyan-300">
                                  {day.theme}
                                </span>
                              </div>
                              <ul className="list-disc pl-5 text-sm text-slate-600 leading-relaxed font-medium space-y-2 dark:text-slate-300">
                                {day.activities.map((activity, idx) => (
                                  <li key={idx}>{activity}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Navigation Controls */}
                    {totalSlides > 1 && (
                      <>
                        {/* Previous Button */}
                        <button
                          onClick={prevSlide}
                          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-10 h-10 flex items-center justify-center rounded-full bg-white border-2 border-slate-200 shadow-lg hover:bg-slate-50 hover:scale-110 transition-all z-10 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
                          aria-label="Previous day"
                        >
                          <ChevronLeft size={20} className="text-slate-700 dark:text-slate-200" />
                        </button>

                        {/* Next Button */}
                        <button
                          onClick={nextSlide}
                          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-10 h-10 flex items-center justify-center rounded-full bg-white border-2 border-slate-200 shadow-lg hover:bg-slate-50 hover:scale-110 transition-all z-10 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700"
                          aria-label="Next day"
                        >
                          <ChevronRight size={20} className="text-slate-700 dark:text-slate-200" />
                        </button>

                        {/* Dots Indicator */}
                        <div className="flex items-center justify-center gap-2 mt-4">
                          {itineraryDays.map((_, index) => (
                            <button
                              key={index}
                              onClick={() => goToSlide(index)}
                              className={`transition-all rounded-full ${
                                index === currentSlide
                                  ? 'w-8 h-2 bg-teal-500 dark:bg-cyan-400'
                                  : 'w-2 h-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500'
                              }`}
                              aria-label={`Go to day ${index + 1}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No itinerary available</p>
                )}
              </Panel>
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <form onSubmit={handleSubmit} className="rounded-2xl p-5 bg-white border border-slate-200 shadow-sm dark:bg-slate-900/60 dark:border-white/10">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider dark:text-slate-400">Trip constraints</p>
              <div className="mt-4 grid gap-3.5">
                <Field label="From">
                  <input value={form.from_location} onChange={(e) => updateForm("from_location", e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-400 transition-colors dark:bg-slate-950/55 dark:border-white/10 dark:text-slate-100 dark:focus:border-cyan-400"
                  />
                </Field>

                <Field label="Destination">
                  <div className="flex gap-2">
                    <input value={draftDestination} onChange={(e) => setDraftDestination(e.target.value)}
                      className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-teal-400 transition-colors dark:bg-slate-950/55 dark:border-white/10 dark:text-slate-100 dark:focus:border-cyan-400"
                    />
                    <button className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold bg-teal-600 text-white shadow-sm hover:bg-teal-500 hover:-translate-y-0.5 transition-all">
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
                        className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors border ${
                          form.feed_preference === feed ? "bg-teal-50 border-teal-200 text-teal-700 shadow-sm dark:bg-cyan-400/10 dark:border-cyan-400/25 dark:text-cyan-300" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-950/35 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800/70"
                        }`}>
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
                        className={`rounded-xl px-3 py-2 text-xs font-semibold capitalize transition-colors border ${
                          form.budget_scale === budget ? "bg-teal-50 border-teal-200 text-teal-700 shadow-sm dark:bg-cyan-400/10 dark:border-cyan-400/25 dark:text-cyan-300" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-950/35 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800/70"
                        }`}>
                        {budget}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Duration">
                  <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-white border border-slate-200 shadow-sm dark:bg-slate-950/35 dark:border-white/10">
                    <CalendarDays size={16} className="text-teal-500 dark:text-cyan-300" />
                    <input type="range" min="1" max="10" value={form.duration}
                      onChange={(e) => updateForm("duration", Number(e.target.value))}
                      className="flex-1 accent-teal-500" />
                    <span className="text-sm font-bold text-slate-700 tabular-nums w-6 text-right dark:text-slate-200">{form.duration}d</span>
                  </div>
                </Field>
              </div>
              {error && <p className="mt-3 text-xs text-rose-500 font-medium">{error}</p>}
            </form>

            <Panel title="Booking Redirects">
              {links.map(({ label, icon: Icon, tone, detail, url }) => (
                <a key={label} href={url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl p-3 bg-white border border-slate-200 shadow-sm hover:shadow hover:-translate-y-0.5 transition-all group dark:bg-slate-900/55 dark:border-white/10 dark:hover:border-white/20">
                  <span className="flex items-center justify-center rounded-lg w-[34px] h-[34px] flex-shrink-0"
                    style={{ background: `${tone}15`, color: tone, border: `1px solid ${tone}30` }}>
                    {createElement(Icon, { size: 17 })}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-bold text-slate-800 group-hover:text-slate-900 transition-colors dark:text-slate-100 dark:group-hover:text-white">{label}</span>
                    <span className="block text-xs text-slate-500 font-medium mt-0.5 dark:text-slate-300">{detail}</span>
                  </span>
                  <span className="text-[10px] font-bold text-teal-600 bg-teal-50 border border-teal-100 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity dark:bg-cyan-400/10 dark:border-cyan-400/20 dark:text-cyan-300">Open ↗</span>
                </a>
              ))}
            </Panel>

            <div className="rounded-2xl p-5 bg-white border border-slate-200 shadow-sm dark:bg-slate-900/60 dark:border-white/10">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider dark:text-slate-400">Quick places</p>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {quickPlaces.map((item) => (
                  <button key={item} type="button" onClick={() => applyQuickPlace(item)}
                    className="rounded-full px-3.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors dark:bg-slate-950/35 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white">
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

function Field({ label, children }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold ml-1" style={{ color: 'rgb(var(--text-secondary))' }}>{label}</span>
      {children}
    </label>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-2xl p-5 border shadow-sm flex flex-col gap-3 bg-white border-slate-200 dark:bg-slate-900/60 dark:border-white/10">
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'rgb(var(--text-tertiary))' }}>{title}</p>
      {children}
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="grid gap-2">
      {options.map((option) => (
        <button key={option.value} type="button" onClick={() => onChange(option.value)}
          className={`rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors border ${
            value === option.value ? "bg-teal-50 border-teal-200 text-teal-700 shadow-sm dark:bg-cyan-400/10 dark:border-cyan-400/25 dark:text-cyan-300" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-950/35 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800/70"
          }`}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
