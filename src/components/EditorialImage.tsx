import React, { useState } from 'react';
import { Sprout } from 'lucide-react';

interface EditorialImageProps {
  src: string;
  alt: string;
  className?: string;
  aspectClassName?: string;
  priority?: boolean;
}

/**
 * Resilient editorial photograph wrapper adhering to the Zero-Broken-Image Policy.
 */
export function EditorialImage({
  src,
  alt,
  className = '',
  aspectClassName = 'aspect-[4/3]',
  priority = false,
}: EditorialImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (failed || !src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`${aspectClassName} ${className} bg-gradient-to-br from-oat via-chalk to-eucalyptus-soft flex flex-col items-center justify-center p-6 text-center`}
      >
        <Sprout className="w-7 h-7 text-eucalyptus/60 mb-2" aria-hidden="true" />
        <span className="font-serif text-sm text-olive max-w-xs">{alt}</span>
      </div>
    );
  }

  return (
    <div className={`${aspectClassName} relative overflow-hidden bg-oat ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 bg-oat animate-pulse flex items-center justify-center pointer-events-none">
          <Sprout className="w-6 h-6 text-stone/80" aria-hidden="true" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
