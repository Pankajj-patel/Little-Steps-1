import React from 'react';

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-lg bg-cream animate-pulse motion-reduce:animate-none ${className}`}
    />
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2.5" role="status" aria-label="Loading content">
      {Array.from({ length: lines }).map((_, idx) => (
        <Skeleton
          key={idx}
          className={`h-3.5 ${idx === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
      <span className="sr-only">Loading content...</span>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div
      role="status"
      aria-label="Loading activity card"
      className="rounded-xl border border-border bg-surface p-5 space-y-4"
    >
      <Skeleton className="h-36 w-full rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3.5 w-full" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <span className="sr-only">Loading activity card...</span>
    </div>
  );
}
