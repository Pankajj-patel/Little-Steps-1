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
    <div className={`${aspectClassName} overflow-hidden bg-oat ${className}`}>
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
