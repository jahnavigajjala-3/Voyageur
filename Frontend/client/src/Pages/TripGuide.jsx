import { createElement, useCallback, useEffect, useMemo, useState, useRef } from "react";
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

/**
 * Six curated picks (lighter than nine parallel Unsplash calls).
 * Preview images load lazily when each card nears the viewport — one API request at a time per card.
 */
const DESTINATION_SUGGESTIONS = [
  {
    name: "Jaipur",
    region: "Rajasthan",
    tagline: "Pink City forts & bazaars",
    highlights: ["Amer Fort & City Palace", "Heritage walks", "Rajasthani cuisine"],
    imageQuery: "Jaipur India Amber Fort",
  },
  {
    name: "Kochi",
    region: "Kerala",
    tagline: "Backwaters meet the Arabian Sea",
    highlights: ["Chinese fishing nets", "Spice markets", "Coastal sunsets"],
    imageQuery: "Kochi Kerala India waterfront",
  },
  {
    name: "Mumbai",
    region: "Maharashtra",
    tagline: "Maximum city energy",
    highlights: ["Marine Drive & art deco", "Street food trails", "Gateway of India"],
    imageQuery: "Mumbai India skyline Marine Drive",
  },
  {
    name: "Bengaluru",
    region: "Karnataka",
    tagline: "Gardens, tech & filter coffee",
    highlights: ["Cubbon Park & museums", "Café culture", "Weekend hill escapes"],
    imageQuery: "Bangalore India city park",
  },
  {
    name: "Goa",
    region: "West India",
    tagline: "Beaches & Portuguese lanes",
    highlights: ["Coastal drives", "Seafood & shacks", "Churches & chapels"],
    imageQuery: "Goa India beach palm",
  },
  {
    name: "Varanasi",
    region: "Uttar Pradesh",
    tagline: "Ghats, temples & dawn on the Ganges",
    highlights: ["Sunrise boat rides", "Evening aarti", "Silk & narrow lanes"],
    imageQuery: "Varanasi India Ganges ghats",
  },
];

const FALLBACK_GRADIENT =
  "linear-gradient(135deg, rgba(14,30,80,0.85) 0%, rgba(7,20,55,0.95) 100%)";

/** Loads Unsplash preview only after the card scrolls into view (reduces burst traffic vs. loading all at once). */
function DestinationSuggestionCard({ suggestion, imageData, isImageLoading, onSelect, onRequestImage }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    if (imageData !== undefined) return;
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      onRequestImage(suggestion);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onRequestImage(suggestion);
          io.disconnect();
        }
      },
      { root: null, rootMargin: "100px 0px", threshold: 0.06 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [suggestion, imageData, onRequestImage]);

  const busy = isImageLoading && imageData === undefined;

  return (
    <button
      type="button"
      onClick={() => onSelect(suggestion.name)}
      className="group flex flex-col overflow-hidden rounded-2xl border text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{
        background: "rgb(var(--bg-secondary))",
        borderColor: "rgb(var(--border-primary))",
      }}
    >
      <div ref={wrapRef} className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-900">
        {busy ? (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          </div>
        ) : imageData?.url ? (
          <img
            src={imageData.url}
            alt={imageData.alt || suggestion.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2 p-4"
            style={{
              background: imageData?.gradient || "linear-gradient(135deg, rgba(56,189,248,0.2) 0%, rgba(99,102,241,0.25) 100%)",
            }}
          >
            <Image size={28} className="text-white/70" />
            <span className="text-center text-sm font-semibold text-white/90">{suggestion.name}</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 text-white">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">{suggestion.region}</p>
          <p className="font-serif text-lg font-bold leading-tight">{suggestion.name}</p>
          <p className="mt-1 text-xs text-white/90">{suggestion.tagline}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <ul className="space-y-1.5 text-xs leading-relaxed" style={{ color: "rgb(var(--text-secondary))" }}>
          {suggestion.highlights.map((h) => (
            <li key={h} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-500" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
        <span className="mt-auto inline-flex items-center gap-1 text-xs font-bold" style={{ color: "rgb(var(--accent-cyan))" }}>
          Plan this trip →
        </span>
      </div>
    </button>
  );
}

const makeSearchUrl = (base, query) => `${base}${encodeURIComponent(query)}`;

function makeBookingLinks(destination, guidance) {
  const travelSuggestions = guidance?.travel_suggestions || [];
  const stay = guidance?.stay_suggestions?.[0];

  const flightPrice = travelSuggestions.find((t) => t.mode === "Flight")?.estimated_price || "Compare prices";
  const trainPrice = travelSuggestions.find((t) => t.mode === "Train")?.estimated_price || "Compare prices";
  const busPrice = travelSuggestions.find((t) => t.mode === "Bus")?.estimated_price || "Compare prices";
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
    destination: "",
    feed_preference: "Beaches",
    budget_scale: "midrange",
    duration: 3,
  });
  const [draftDestination, setDraftDestination] = useState("");
  const [guidance, setGuidance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState({});
  const [loadingImages, setLoadingImages] = useState(false);
  const [suggestionImages, setSuggestionImages] = useState({});
  const [suggestionImageLoading, setSuggestionImageLoading] = useState({});
  const [currentSlide, setCurrentSlide] = useState(0);
  const [actualFromLocation, setActualFromLocation] = useState("Current Location");
  const carouselRef = useRef(null);
  const suggestionInflightRef = useRef(new Set());

  const hasDestination = Boolean(form.destination?.trim());

  const imageKeywords = guidance?.destination_visuals?.length
    ? guidance.destination_visuals
    : hasDestination
      ? [`${form.destination} ${form.feed_preference}`, `${form.destination} travel`, `${form.destination} hotel`]
      : [];

  const links = useMemo(
    () => (hasDestination ? makeBookingLinks(form.destination, guidance) : []),
    [form.destination, guidance, hasDestination]
  );

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

  useEffect(() => {
    const loadImages = async () => {
      if (!hasDestination || imageKeywords.length === 0) return;
      setLoadingImages(true);
      const newImages = {};

      for (const keyword of imageKeywords) {
        try {
          const imageData = await fetchLocationImage(keyword, {
            width: keyword === imageKeywords[0] ? 1200 : 600,
            height: keyword === imageKeywords[0] ? 800 : 400,
            orientation: "landscape",
          });
          newImages[keyword] = imageData;
        } catch (err) {
          console.error(`Failed to load image for ${keyword}:`, err);
          newImages[keyword] = {
            url: `https://dummyimage.com/1200x800/f8fafc/0f172a&text=${encodeURIComponent(keyword)}`,
            alt: keyword,
            source: "fallback",
          };
        }
      }

      setImages(newImages);
      setLoadingImages(false);
    };

    loadImages();
  }, [imageKeywords, hasDestination]);

  const requestSuggestionImage = useCallback((suggestion) => {
    const name = suggestion.name;
    if (suggestionInflightRef.current.has(name)) return;
    suggestionInflightRef.current.add(name);
    setSuggestionImageLoading((prev) => ({ ...prev, [name]: true }));

    (async () => {
      try {
        const imageData = await fetchLocationImage(suggestion.imageQuery, {
          width: 560,
          height: 360,
          orientation: "landscape",
        });
        setSuggestionImages((prev) => ({ ...prev, [name]: imageData }));
      } catch (err) {
        console.error(`Suggestion image failed for ${name}:`, err);
        setSuggestionImages((prev) => ({
          ...prev,
          [name]: {
            url: "",
            alt: name,
            source: "fallback",
            gradient: FALLBACK_GRADIENT,
          },
        }));
      } finally {
        suggestionInflightRef.current.delete(name);
        setSuggestionImageLoading((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
      }
    })();
  }, []);

  const fetchGuidance = async (payload = form) => {
    if (!payload.destination?.trim()) {
      setGuidance(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
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
    if (!form.destination?.trim()) {
      setGuidance(null);
      return undefined;
    }
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
    const destination = draftDestination.trim();
    if (!destination) return;
    const next = { ...form, destination };
    setForm(next);
    fetchGuidance(next);
  };

  const selectDestination = (destination) => {
    setDraftDestination(destination);
    const next = { ...form, destination };
    setForm(next);
    fetchGuidance(next);
  };

  const clearDestination = () => {
    setForm((prev) => ({ ...prev, destination: "" }));
    setDraftDestination("");
    setGuidance(null);
    setError("");
    setCurrentSlide(0);
    setSuggestionImages({});
    setSuggestionImageLoading({});
    suggestionInflightRef.current.clear();
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

  useEffect(() => {
    setCurrentSlide(0);
  }, [guidance]);

  const primaryKeyword = imageKeywords[0];

  return (
    <div
      className="voyageur-page-bg min-h-screen w-full font-sans pb-10"
      style={{
        color: "rgb(var(--text-primary))",
      }}
    >
      <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-5 px-5 py-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-colors"
              style={{
                background: "rgb(var(--bg-secondary))",
                borderColor: "rgb(var(--border-primary))",
                color: "rgb(var(--text-secondary))",
              }}
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgb(var(--accent-cyan))" }}>
                Trip guidance
              </p>
              <h1 className="font-serif text-2xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
                {hasDestination ? form.destination : "Pick a destination"}
              </h1>
              {!hasDestination && (
                <p className="mt-1 max-w-xl text-sm" style={{ color: "rgb(var(--text-secondary))" }}>
                  Choose a suggested place below or enter your own. We will build routes, stays, and an itinerary once you
                  commit.
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasDestination && (
              <button
                type="button"
                onClick={clearDestination}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  background: "rgb(var(--bg-secondary))",
                  borderColor: "rgb(var(--border-primary))",
                  color: "rgb(var(--text-secondary))",
                }}
              >
                Browse places
              </button>
            )}
            {loading && (
              <span
                className="rounded-full border px-3 py-1 text-xs font-medium"
                style={{
                  background: "rgb(var(--accent-cyan) / 0.1)",
                  color: "rgb(var(--accent-cyan))",
                  borderColor: "rgb(var(--accent-cyan) / 0.2)",
                }}
              >
                Generating…
              </span>
            )}
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.35fr_0.9fr]">
          {!hasDestination ? (
            <div
              className="flex flex-col gap-5 overflow-hidden rounded-2xl border shadow-sm"
              style={{
                background: "rgb(var(--bg-elevated))",
                borderColor: "rgb(var(--border-primary))",
              }}
            >
              <div className="border-b p-5 md:p-6" style={{ borderColor: "rgb(var(--border-primary))" }}>
                <h2 className="font-serif text-xl font-semibold md:text-2xl" style={{ color: "rgb(var(--text-primary))" }}>
                  Suggested destinations
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "rgb(var(--text-secondary))" }}>
                  Six hand-picked ideas. Preview photos load as you scroll (easy on Unsplash rate limits)—tap a card for
                  full trip guidance.
                </p>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 md:p-5">
                {DESTINATION_SUGGESTIONS.map((s) => (
                  <DestinationSuggestionCard
                    key={s.name}
                    suggestion={s}
                    imageData={suggestionImages[s.name]}
                    isImageLoading={Boolean(suggestionImageLoading[s.name])}
                    onSelect={selectDestination}
                    onRequestImage={requestSuggestionImage}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col overflow-hidden rounded-2xl border shadow-sm"
              style={{
                background: "rgb(var(--bg-elevated))",
                borderColor: "rgb(var(--border-primary))",
              }}
            >
              <div className="relative flex h-[360px] shrink-0 flex-col bg-slate-100 dark:bg-slate-900">
                {loadingImages ? (
                  <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-900">
                    <div className="text-center">
                      <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                      <p className="text-xs text-slate-500">Loading image…</p>
                    </div>
                  </div>
                ) : images[primaryKeyword]?.url ? (
                  <img
                    key={primaryKeyword}
                    src={images[primaryKeyword].url}
                    alt={images[primaryKeyword].alt}
                    className="block h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = `https://dummyimage.com/1200x800/f8fafc/0f172a&text=${encodeURIComponent(form.destination)}`;
                    }}
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{
                      background:
                        images[primaryKeyword]?.gradient ||
                        "linear-gradient(135deg, rgba(14,30,80,0.8) 0%, rgba(7,20,55,0.9) 100%)",
                    }}
                  >
                    <p className="text-2xl font-bold text-white">{form.destination}</p>
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-xs font-medium text-white shadow-sm backdrop-blur-md">
                    <MapPin size={13} />
                    {guidance?.departure_hub || `From ${actualFromLocation}`}
                  </div>
                  <h2 className="mt-3 font-serif text-3xl font-bold">
                    {form.feed_preference} trip to {form.destination}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-white/90">
                    Budget: <span className="capitalize">{form.budget_scale}</span>. Duration: {form.duration} days. The
                    plan adapts transport, stays, visuals, and daily activities to your preferences.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 p-5 md:grid-cols-3">
                {imageKeywords.map((keyword) => (
                  <div
                    key={keyword}
                    className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm dark:border-white/10 dark:bg-slate-900/40"
                  >
                    {loadingImages ? (
                      <div className="flex h-[108px] w-full items-center justify-center bg-slate-100 dark:bg-slate-900">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                      </div>
                    ) : images[keyword]?.url ? (
                      <img
                        src={images[keyword].url}
                        alt={images[keyword].alt}
                        className="block h-[108px] w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = `https://dummyimage.com/600x400/f8fafc/0f172a&text=${encodeURIComponent(keyword)}`;
                        }}
                      />
                    ) : (
                      <div
                        className="flex h-[108px] w-full items-center justify-center"
                        style={{
                          background:
                            images[keyword]?.gradient ||
                            "linear-gradient(135deg, rgba(56,189,248,0.15) 0%, rgba(99,102,241,0.2) 100%)",
                        }}
                      >
                        <Image size={24} className="text-white/50" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-2.5 text-xs font-medium text-slate-600 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300">
                      <Image size={13} className="text-teal-500 dark:text-cyan-300" />
                      <span className="truncate">{keyword}</span>
                    </div>
                    {images[keyword]?.author && images[keyword]?.source === "unsplash" && (
                      <div className="border-t border-slate-100 px-3 py-1.5 text-[9px] text-slate-400 dark:border-white/10">
                        Photo by{" "}
                        <a
                          href={images[keyword].authorUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-teal-500"
                        >
                          {images[keyword].author}
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid flex-1 gap-4 border-t border-slate-100 bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-950/20">
                <Panel title="Itinerary">
                  {totalSlides > 0 ? (
                    <div className="relative px-1 sm:px-2">
                      <div className="overflow-hidden rounded-xl" ref={carouselRef}>
                        <div
                          className="flex transition-transform duration-500 ease-out"
                          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                        >
                          {itineraryDays.map((day) => (
                            <div key={day.day} className="w-full flex-shrink-0 px-2">
                              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/55">
                                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/10">
                                  <span className="text-lg font-bold text-slate-800 dark:text-slate-100">Day {day.day}</span>
                                  <span className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-600 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300">
                                    {day.theme}
                                  </span>
                                </div>
                                <ul className="list-disc space-y-2 pl-5 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                                  {day.activities.map((activity, idx) => (
                                    <li key={idx}>{activity}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {totalSlides > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={prevSlide}
                            className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-2 border-slate-200 bg-white shadow-lg transition-all hover:scale-110 hover:bg-slate-50 sm:left-3 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                            aria-label="Previous day"
                          >
                            <ChevronLeft size={20} className="text-slate-700 dark:text-slate-200" />
                          </button>

                          <button
                            type="button"
                            onClick={nextSlide}
                            className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-2 border-slate-200 bg-white shadow-lg transition-all hover:scale-110 hover:bg-slate-50 sm:right-3 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                            aria-label="Next day"
                          >
                            <ChevronRight size={20} className="text-slate-700 dark:text-slate-200" />
                          </button>

                          <div className="mt-4 flex items-center justify-center gap-2">
                            {itineraryDays.map((_, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => goToSlide(index)}
                                className={`rounded-full transition-all ${
                                  index === currentSlide
                                    ? "h-2 w-8 bg-teal-500 dark:bg-cyan-400"
                                    : "h-2 w-2 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-500"
                                }`}
                                aria-label={`Go to day ${index + 1}`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No itinerary available yet.</p>
                  )}
                </Panel>
              </div>
            </div>
          )}

          <aside className="flex flex-col gap-4">
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                Trip constraints
              </p>
              <div className="mt-4 grid gap-3.5">
                <Field label="From">
                  <input
                    value={form.from_location}
                    onChange={(e) => updateForm("from_location", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 transition-colors focus:border-teal-400 focus:outline-none dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-100 dark:focus:border-cyan-400"
                  />
                </Field>

                <Field label="Destination">
                  <div className="flex gap-2">
                    <input
                      value={draftDestination}
                      onChange={(e) => setDraftDestination(e.target.value)}
                      placeholder="e.g. Manali, Hampi…"
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 transition-colors placeholder:text-slate-400 focus:border-teal-400 focus:outline-none dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-400"
                    />
                    <button
                      type="submit"
                      className="flex shrink-0 items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-teal-500"
                    >
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
                      <button
                        key={feed}
                        type="button"
                        onClick={() => updateForm("feed_preference", feed)}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                          form.feed_preference === feed
                            ? "border-teal-200 bg-teal-50 text-teal-700 shadow-sm dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/35 dark:text-slate-300 dark:hover:bg-slate-800/70"
                        }`}
                      >
                        <Mountain size={13} />
                        {feed}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Budget scale">
                  <div className="grid grid-cols-3 gap-2">
                    {BUDGETS.map((budget) => (
                      <button
                        key={budget}
                        type="button"
                        onClick={() => updateForm("budget_scale", budget)}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                          form.budget_scale === budget
                            ? "border-teal-200 bg-teal-50 text-teal-700 shadow-sm dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/35 dark:text-slate-300 dark:hover:bg-slate-800/70"
                        }`}
                      >
                        {budget}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Duration">
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-slate-950/35">
                    <CalendarDays size={16} className="text-teal-500 dark:text-cyan-300" />
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={form.duration}
                      onChange={(e) => updateForm("duration", Number(e.target.value))}
                      className="flex-1 accent-teal-500"
                    />
                    <span className="w-6 text-right text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">
                      {form.duration}d
                    </span>
                  </div>
                </Field>
              </div>
              {error && <p className="mt-3 text-xs font-medium text-rose-500">{error}</p>}
            </form>

            {hasDestination && (
              <Panel title="Booking Redirects">
                {links.map(({ label, icon: Icon, tone, detail, url }) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow dark:border-white/10 dark:bg-slate-900/55 dark:hover:border-white/20"
                  >
                    <span
                      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${tone}15`, color: tone, border: `1px solid ${tone}30` }}
                    >
                      {createElement(Icon, { size: 17 })}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-bold text-slate-800 transition-colors group-hover:text-slate-900 dark:text-slate-100 dark:group-hover:text-white">
                        {label}
                      </span>
                      <span className="mt-0.5 block text-xs font-medium text-slate-500 dark:text-slate-300">{detail}</span>
                    </span>
                    <span className="rounded border border-teal-100 bg-teal-50 px-2 py-1 text-[10px] font-bold text-teal-600 opacity-0 transition-opacity group-hover:opacity-100 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300">
                      Open ↗
                    </span>
                  </a>
                ))}
              </Panel>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                {hasDestination ? "Switch quickly" : "Or jump to"}
              </p>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {DESTINATION_SUGGESTIONS.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => selectDestination(s.name)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-slate-950/35 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white"
                  >
                    {s.name}
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
      <span className="ml-1 text-xs font-semibold" style={{ color: "rgb(var(--text-secondary))" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Panel({ title, children }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgb(var(--text-tertiary))" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="grid gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
            value === option.value
              ? "border-teal-200 bg-teal-50 text-teal-700 shadow-sm dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/35 dark:text-slate-300 dark:hover:bg-slate-800/70"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
