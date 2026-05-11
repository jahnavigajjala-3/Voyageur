/**
 * Geocoding Service for Voyageur Travel App
 *
 * Uses BigDataCloud reverse-geocoding API:
 *  - Free, no API key required
 *  - No strict rate limits for client-side use
 *  - Always returns English names
 *  - https://www.bigdatacloud.com/geocoding-apis/free-reverse-geocode-to-city-api
 *
 * Place name resolution strategy (most → least specific):
 *   1. Highest-order administrative entry (neighbourhood / locality)
 *   2. data.city
 *   3. data.locality
 *   4. data.principalSubdivision (state)
 */

const BDC_BASE =
  "https://api.bigdatacloud.net/data/reverse-geocode-client";

// In-memory cache — survives the session, reset on hard reload
const geocodingCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Noise words that appear in admin names but aren't useful place labels
const NOISE_PATTERNS = [
  /\bdistrict\b/i,
  /\btaluk\b/i,
  /\bcorporation\b/i,
  /\bmetropolitan\b/i,
  /\bregion\b/i,
  /\bauthority\b/i,
  /\bdevelopment\b/i,
  /\bcouncil\b/i,
  /\bassembly\b/i,
  /\bconstituency\b/i,
  /\burban\b/i,
  /\brailway\b/i,
  /\bzonal\b/i,
  /\bbasin\b/i,
  /\bsubcontinent\b/i,
];

function isNoisyName(name) {
  return NOISE_PATTERNS.some((re) => re.test(name));
}

/**
 * Pick the most specific, human-friendly name from the administrative array.
 * Prefers the highest-order entry that isn't a noisy admin label.
 */
function pickBestAdminName(administrative = []) {
  // Sort descending by order (highest = most specific)
  const sorted = [...administrative].sort((a, b) => (b.order ?? 0) - (a.order ?? 0));

  for (const entry of sorted) {
    const name = (entry.name || "").trim();
    if (!name || /^\d+$/.test(name)) continue; // skip postcodes
    if (isNoisyName(name)) continue;           // skip admin jargon
    return name;
  }
  return null;
}

/**
 * Reverse geocode coordinates → structured location object.
 */
export async function reverseGeocode(lat, lng) {
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = geocodingCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const url = `${BDC_BASE}?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const response = await fetch(url);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    const administrative = data?.localityInfo?.administrative ?? [];
    const specificName = pickBestAdminName(administrative);

    const result = {
      specific: specificName || "",          // e.g. "Kundalahalli", "Koramangala"
      city: data.city || data.locality || "", // e.g. "Bengaluru"
      state: data.principalSubdivision || "",
      country: data.countryName || "",
      postcode: data.postcode || "",
    };

    geocodingCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (err) {
    console.warn("Reverse geocoding failed:", err.message);
    return null; // never cache failures — allow retry
  }
}

/**
 * Get a short human-readable place name for coordinates.
 *
 * Returns the most specific name available:
 *   "Koramangala, Bengaluru"  →  if neighbourhood differs from city
 *   "Bengaluru"               →  if neighbourhood == city or unavailable
 *   null                      →  if geocoding failed entirely
 */
export async function getLocationDisplayName(lat, lng) {
  const loc = await reverseGeocode(lat, lng);
  if (!loc) return null;

  const { specific, city } = loc;

  // If we have a specific neighbourhood AND it's different from the city name
  if (specific && city && specific.toLowerCase() !== city.toLowerCase()) {
    return `${specific}, ${city}`;
  }

  if (specific) return specific;
  if (city) return city;
  if (loc.state) return loc.state;
  return null;
}

/** Clear the in-memory cache. */
export function clearGeocodingCache() {
  geocodingCache.clear();
}

export function getGeocodingCacheStats() {
  return {
    size: geocodingCache.size,
    entries: Array.from(geocodingCache.entries()).map(([key, value]) => ({
      key,
      timestamp: value.timestamp,
      age: Date.now() - value.timestamp,
    })),
  };
}
