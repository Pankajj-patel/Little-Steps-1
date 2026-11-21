import React from 'react';

export const APP_LOGO_URL = '/assets/aistudio/Screenshot_2026-11-21_at_10.48.50_PM_996bc3b7.png';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-7 h-7 rounded-lg',
  md: 'w-9 h-9 rounded-xl',
  lg: 'w-14 h-14 rounded-2xl',
};

export function BrandLogo({ size = 'md', className = '' }: BrandLogoProps) {
  return (
    <img
      src={APP_LOGO_URL}
      alt="LittleSteps logo"
      width={size === 'lg' ? 56 : size === 'md' ? 36 : 28}
      height={size === 'lg' ? 56 : size === 'md' ? 36 : 28}
      className={`${SIZE_CLASSES[size]} object-cover shrink-0 shadow-xs ring-1 ring-border/70 ${className}`.trim()}
    />
  );
}
