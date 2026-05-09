/**
 * Unsplash Image Service for Voyageur Travel App
 * 
 * Provides dynamic location-based image fetching from Unsplash API
 * with caching, error handling, and fallback UI support.
 */

const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
const UNSPLASH_API_BASE = 'https://api.unsplash.com';

// Cache for image URLs to prevent unnecessary API calls
const imageCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Generate search queries for location-based images
 * @param {string} locationName - City or location name
 * @returns {string[]} Array of search query strings
 */
function generateSearchQueries(locationName) {
  if (!locationName || locationName.trim() === '') {
    return ['travel landscape', 'city skyline', 'urban exploration'];
  }

  const cleanName = locationName.trim();
  const queries = [
    `${cleanName} skyline`,
    `${cleanName} aerial view`,
    `${cleanName} city night`,
    `${cleanName} landscape`,
    `${cleanName} travel`,
    `${cleanName} urban`,
    `${cleanName} architecture`
  ];

  // Add more generic queries for better fallback
  queries.push(
    'travel destination',
    'cityscape',
    'urban photography',
    'landscape photography'
  );

  return queries;
}

/**
 * Fetch image from Unsplash API for a given location
 * @param {string} locationName - City or location name
 * @param {Object} options - Additional options
 * @param {number} options.width - Desired image width (default: 400)
 * @param {number} options.height - Desired image height (default: 300)
 * @param {string} options.orientation - Image orientation (landscape, portrait, squarish)
 * @returns {Promise<{url: string, alt: string, author: string, location: string}>}
 */
export async function fetchLocationImage(locationName, options = {}) {
  const {
    width = 400,
    height = 300,
    orientation = 'landscape'
  } = options;

  // Check cache first
  const cacheKey = `${locationName || 'default'}_${width}x${height}_${orientation}`;
  const cached = imageCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  // Validate API key
  if (!UNSPLASH_ACCESS_KEY) {
    console.warn('Unsplash API key not configured. Using fallback image.');
    return getFallbackImage(locationName);
  }

  const queries = generateSearchQueries(locationName);
  
  // Try each query until we get a result
  for (const query of queries) {
    try {
      const response = await fetch(
        `${UNSPLASH_API_BASE}/search/photos?` + new URLSearchParams({
          query,
          per_page: 1,
          orientation,
          client_id: UNSPLASH_ACCESS_KEY
        }),
        {
          headers: {
            'Accept-Version': 'v1'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          throw new Error('Invalid or missing Unsplash API key');
        }
        if (response.status === 429) {
          console.warn('Unsplash API rate limit reached');
          break;
        }
        continue; // Try next query
      }

      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const image = data.results[0];
        const result = {
          url: `${image.urls.raw}&w=${width}&h=${height}&fit=crop&crop=entropy`,
          alt: image.alt_description || `Image of ${locationName || 'travel destination'}`,
          author: image.user.name || 'Unknown photographer',
          authorUrl: image.user.links?.html || '#',
          location: locationName || 'Travel destination',
          source: 'unsplash'
        };

        // Cache the result
        imageCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });

        return result;
      }
    } catch (error) {
      console.error(`Unsplash API error for query "${query}":`, error);
      // Continue to next query
    }
  }

  // If all queries fail, return fallback
  return getFallbackImage(locationName);
}

/**
 * Get fallback image when Unsplash API fails or no images found
 * @param {string} locationName - City or location name
 * @returns {Object} Fallback image data
 */
function getFallbackImage(locationName) {
  // Create a gradient-based placeholder that matches Voyageur aesthetic
  const gradients = [
    'linear-gradient(135deg, rgba(14,30,80,0.8) 0%, rgba(7,20,55,0.9) 100%)',
    'linear-gradient(135deg, rgba(56,189,248,0.15) 0%, rgba(99,102,241,0.2) 100%)',
    'linear-gradient(135deg, rgba(8,12,28,0.9) 0%, rgba(14,30,80,0.8) 100%)'
  ];

  const randomGradient = gradients[Math.floor(Math.random() * gradients.length)];
  
  return {
    url: '', // Empty URL indicates fallback UI should be shown
    alt: locationName ? `Placeholder for ${locationName}` : 'Travel destination placeholder',
    author: 'Voyageur AI',
    authorUrl: '#',
    location: locationName || 'Unknown location',
    source: 'fallback',
    gradient: randomGradient
  };
}

/**
 * Clear the image cache
 */
export function clearImageCache() {
  imageCache.clear();
}

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  return {
    size: imageCache.size,
    entries: Array.from(imageCache.entries()).map(([key, value]) => ({
      key,
      timestamp: value.timestamp,
      age: Date.now() - value.timestamp
    }))
  };
}