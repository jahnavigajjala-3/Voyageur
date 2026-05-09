import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchLocationImage, clearImageCache } from '../services/unsplashService';

/**
 * Custom hook for managing location-based images with Unsplash API
 * 
 * Features:
 * - Automatic image fetching based on location changes
 * - Loading states and error handling
 * - Caching and performance optimization
 * - Retry logic for failed requests
 */
const useLocationImage = (locationName, locationType = 'current', options = {}) => {
  const [imageData, setImageData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const mountedRef = useRef(true);
  const fetchTimeoutRef = useRef(null);

  // Default options
  const {
    width = 600,
    height = 400,
    orientation = 'landscape',
    debounceMs = 500,
    autoFetch = true,
    maxRetries = 3
  } = options;

  // Clean up function
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  // Fetch image function with debouncing
  const fetchImage = useCallback(async () => {
    if (!mountedRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchLocationImage(locationName, {
        width,
        height,
        orientation
      });

      if (!mountedRef.current) return;

      setImageData(data);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      
      console.error('Failed to fetch location image:', err);
      setError(err.message || 'Failed to load image');
      
      // Auto-retry logic
      if (retryCount < maxRetries) {
        setTimeout(() => {
          if (mountedRef.current) {
            setRetryCount(prev => prev + 1);
          }
        }, 2000 * (retryCount + 1)); // Exponential backoff
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [locationName, width, height, orientation, retryCount, maxRetries]);

  // Auto-fetch when dependencies change
  useEffect(() => {
    if (!autoFetch) return;

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        fetchImage();
      }
    }, debounceMs);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [fetchImage, debounceMs, autoFetch]);

  // Manual fetch function
  const manualFetch = useCallback(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    setRetryCount(0);
    fetchImage();
  }, [fetchImage]);

  // Clear cache function
  const clearCache = useCallback(() => {
    clearImageCache();
    setImageData(null);
    setRetryCount(0);
  }, []);

  // Get location display name
  const getDisplayName = useCallback(() => {
    if (!locationName || locationName.trim() === '') {
      return locationType === 'destination' ? 'Destination' : 'Current Location';
    }
    return locationName;
  }, [locationName, locationType]);

  // Get location type label
  const getTypeLabel = useCallback(() => {
    switch (locationType) {
      case 'destination':
        return 'DESTINATION';
      case 'source':
        return 'START POINT';
      case 'waypoint':
        return 'WAYPOINT';
      default:
        return 'LOCATION';
    }
  }, [locationType]);

  return {
    // State
    imageData,
    isLoading,
    error,
    retryCount,
    
    // Functions
    fetchImage: manualFetch,
    clearCache,
    retry: () => setRetryCount(prev => prev + 1),
    
    // Derived data
    displayName: getDisplayName(),
    typeLabel: getTypeLabel(),
    hasImage: !isLoading && !error && imageData?.url,
    isFallback: imageData?.source === 'fallback',
    
    // Status flags
    isReady: !isLoading && !error,
    shouldRetry: error && retryCount < maxRetries
  };
};

export default useLocationImage;