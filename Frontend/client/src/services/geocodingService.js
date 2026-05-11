/**
 * Geocoding Service for Voyageur Travel App
 * 
 * Provides reverse geocoding to convert coordinates to location names
 * using Nominatim OpenStreetMap API with caching.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/reverse';

// Cache for geocoding results
const geocodingCache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Reverse geocode coordinates to get location name
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<{city: string, state: string, country: string, displayName: string}>}
 */
export async function reverseGeocode(lat, lng) {
  // Check cache first
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = geocodingCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const response = await fetch(
      `${NOMINATIM_BASE}?` + new URLSearchParams({
        lat: lat.toString(),
        lon: lng.toString(),
        format: 'json',
        addressdetails: '1',
        zoom: '10', // City-level detail
        'accept-language': 'en' // Force English names
      }),
      {
        headers: {
          'User-Agent': 'VoyageurTravelApp/1.0',
          'Accept': 'application/json',
          'Accept-Language': 'en'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract location information from address
    const address = data.address || {};
    const result = {
      city: address.city || address.town || address.village || address.county || '',
      state: address.state || address.region || '',
      country: address.country || '',
      displayName: data.display_name || '',
      raw: data
    };

    // Cache the result
    geocodingCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    
    // Return fallback with coordinates
    const fallback = {
      city: '',
      state: '',
      country: '',
      displayName: `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      isFallback: true
    };
    
    // Cache fallback too to prevent repeated failed requests
    geocodingCache.set(cacheKey, {
      data: fallback,
      timestamp: Date.now()
    });
    
    return fallback;
  }
}

/**
 * Get a display name for coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string>} Display name
 */
export async function getLocationDisplayName(lat, lng) {
  try {
    const location = await reverseGeocode(lat, lng);

    if (location.city) {
      return location.city;
    }
    if (location.state) {
      return location.state;
    }
    // Nominatim often omits `city` for rural areas — use first segments of display_name for Unsplash-friendly queries
    if (location.displayName) {
      const parts = location.displayName.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0]}, ${parts[1]}`;
      }
      if (parts[0]) {
        return parts[0];
      }
    }
    return `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`;
  } catch (error) {
    console.error("Failed to get location name:", error);
    return `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`;
  }
}

/**
 * Clear the geocoding cache
 */
export function clearGeocodingCache() {
  geocodingCache.clear();
}

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export function getGeocodingCacheStats() {
  return {
    size: geocodingCache.size,
    entries: Array.from(geocodingCache.entries()).map(([key, value]) => ({
      key,
      timestamp: value.timestamp,
      age: Date.now() - value.timestamp
    }))
  };
}