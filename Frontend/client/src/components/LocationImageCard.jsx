import { useState, useEffect, useRef } from 'react';
import { MapPin, Image as ImageIcon, Globe, Loader2 } from 'lucide-react';
import { fetchLocationImage } from '../services/unsplashService';

/**
 * LocationImageCard Component
 * 
 * A modern, glassmorphic card that displays dynamic location-based images
 * with Unsplash API integration and elegant fallback UI.
 */
const LocationImageCard = ({ 
  locationName = '',
  locationType = 'current',
  width = '100%',
  height = '280px',
  showTitle = true,
  className = ''
}) => {
  const [imageData, setImageData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const mountedRef = useRef(true);

  // Determine card title based on location type
  const getCardTitle = () => {
    if (locationName) {
      return `${locationName} ${locationType === 'destination' ? 'Destination' : 'Location'}`;
    }
    return locationType === 'destination' ? 'Destination Preview' : 'Location Insights';
  };

  // Determine icon based on location type
  const getLocationIcon = () => {
    switch (locationType) {
      case 'destination':
        return <Globe size={14} />;
      case 'source':
        return <MapPin size={14} />;
      default:
        return <MapPin size={14} />;
    }
  };

  // Fetch image when location changes
  useEffect(() => {
    mountedRef.current = true;
    let isCancelled = false;

    const fetchImage = async () => {
      if (!mountedRef.current || isCancelled) return;

      setIsLoading(true);
      setError(null);
      setImageLoaded(false);

      try {
        const data = await fetchLocationImage(locationName, {
          width: 600,
          height: 400,
          orientation: 'landscape'
        });

        if (!mountedRef.current || isCancelled) return;

        setImageData(data);
        setError(null);
      } catch (err) {
        if (!mountedRef.current || isCancelled) return;
        console.error('Failed to fetch location image:', err);
        setError(err.message || 'Failed to load image');
      } finally {
        if (!mountedRef.current || isCancelled) return;
        setIsLoading(false);
      }
    };

    // Add a small delay to prevent rapid refetching
    const timer = setTimeout(fetchImage, 300);
    
    return () => {
      isCancelled = true;
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, [locationName, locationType, retryCount]);

  // Handle image load
  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  // Handle image error
  const handleImageError = () => {
    setImageLoaded(false);
    setError('Failed to load image');
  };

  // Handle retry
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  // Render loading skeleton
  const renderSkeleton = () => (
    <div className="relative overflow-hidden rounded-2xl" style={{ width, height }}>
      {/* Animated shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent animate-shimmer" />
      
      {/* Glassmorphic background */}
      <div 
        className="absolute inset-0 rounded-2xl"
        style={{
          background: 'rgba(8,12,28,0.72)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      />
      
      {/* Skeleton content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-full mb-4 flex items-center justify-center"
          style={{
            background: 'rgba(56,189,248,0.1)',
            border: '1px solid rgba(56,189,248,0.2)',
          }}>
          <Loader2 size={24} className="animate-spin" style={{ color: 'rgba(56,189,248,0.6)' }} />
        </div>
        <div className="h-4 w-32 rounded-full mb-2"
          style={{
            background: 'rgba(255,255,255,0.05)',
          }} />
        <div className="h-3 w-24 rounded-full"
          style={{
            background: 'rgba(255,255,255,0.03)',
          }} />
      </div>
    </div>
  );

  // Render fallback UI when no image is available
  const renderFallback = () => (
    <div 
      className="relative overflow-hidden rounded-2xl flex flex-col items-center justify-center"
      style={{ 
        width, 
        height,
        background: imageData?.gradient || 'linear-gradient(135deg, rgba(14,30,80,0.8) 0%, rgba(7,20,55,0.9) 100%)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, rgba(56,189,248,0.3) 2px, transparent 2px)`,
          backgroundSize: '30px 30px',
        }} />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center"
          style={{
            background: 'rgba(56,189,248,0.12)',
            border: '1px solid rgba(56,189,248,0.25)',
            boxShadow: '0 0 20px rgba(56,189,248,0.15)',
          }}>
          <ImageIcon size={28} style={{ color: 'rgba(125,211,252,0.8)' }} />
        </div>
        
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.9)' }}>
          {getCardTitle()}
        </h3>
        
        <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {locationName 
            ? `Visual preview for ${locationName}`
            : 'No location selected'
          }
        </p>
        
        <div className="flex items-center gap-2 text-[10px] px-3 py-1.5 rounded-full"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.5)',
          }}>
          {getLocationIcon()}
          <span>{locationType.toUpperCase()}</span>
        </div>
      </div>
      
      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-1/4 right-1/4 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.3), transparent)',
        }} />
    </div>
  );

  // Render image card
  const renderImageCard = () => (
    <div 
      className="relative overflow-hidden rounded-2xl group"
      style={{ 
        width, 
        height,
        background: 'rgba(8,12,28,0.72)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      {/* Image container */}
      <div className="absolute inset-0">
        {imageData?.url ? (
          <>
            {/* Blurred background for smooth transition */}
            <div 
              className="absolute inset-0 transition-opacity duration-500"
              style={{
                backgroundImage: `url(${imageData.url}&blur=50&w=100)`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: imageLoaded ? 0 : 0.5,
                filter: 'blur(20px)',
              }}
            />
            
            {/* Main image */}
            <img
              src={imageData.url}
              alt={imageData.alt}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
                imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
              }`}
              onLoad={handleImageLoad}
              onError={handleImageError}
              loading="lazy"
            />
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: imageData?.gradient }} />
        )}
        
        {/* Gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      </div>
      
      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col justify-end p-5">
        {/* Location badge */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
            {getLocationIcon()}
            <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {locationType.toUpperCase()}
            </span>
          </div>
          
          {imageData?.source === 'unsplash' && (
            <div className="text-[9px] px-2 py-1 rounded-full ml-auto"
              style={{
                background: 'rgba(56,189,248,0.15)',
                border: '1px solid rgba(56,189,248,0.25)',
                color: 'rgba(125,211,252,0.8)',
              }}>
              UNSPLASH
            </div>
          )}
        </div>
        
        {/* Location title */}
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.95)' }}>
          {getCardTitle()}
        </h3>
        
        {/* Photographer credit */}
        {imageData?.source === 'unsplash' && imageData?.author && (
          <p className="text-[10px] flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Photo by{' '}
            <a 
              href={imageData.authorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline transition-all"
              style={{ color: 'rgba(125,211,252,0.8)' }}
            >
              {imageData.author}
            </a>
            {' '}on Unsplash
          </p>
        )}
      </div>
      
      {/* Top accent line */}
      <div className="absolute top-0 left-1/4 right-1/4 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)',
        }} />
      
      {/* Hover effect overlay */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: 'radial-gradient(circle at center, rgba(56,189,248,0.05) 0%, transparent 70%)',
        }} />
    </div>
  );

  // Render error state
  const renderError = () => (
    <div 
      className="relative overflow-hidden rounded-2xl flex flex-col items-center justify-center"
      style={{ 
        width, 
        height,
        background: 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(8,12,28,0.9) 100%)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(239,68,68,0.2)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      <div className="relative z-10 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full mb-4 flex items-center justify-center"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
          }}>
          <ImageIcon size={24} style={{ color: 'rgba(252,165,165,0.8)' }} />
        </div>
        
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.9)' }}>
          Image Unavailable
        </h3>
        
        <p className="text-xs mb-4 max-w-[200px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {error || 'Unable to load location image'}
        </p>
        
        <button
          onClick={handleRetry}
          className="text-xs px-4 py-2 rounded-lg transition-all hover:scale-105 active:scale-95"
          style={{
            background: 'rgba(56,189,248,0.15)',
            border: '1px solid rgba(56,189,248,0.3)',
            color: 'rgba(125,211,252,0.9)',
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  );

  // Main render logic
  if (isLoading) {
    return renderSkeleton();
  }

  if (error) {
    return renderError();
  }

  if (!imageData || !imageData.url || imageData.source === 'fallback') {
    return renderFallback();
  }

  return renderImageCard();
};

export default LocationImageCard;