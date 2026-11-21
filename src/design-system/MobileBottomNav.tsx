import React from 'react';

export interface MobileBottomNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export interface MobileBottomNavProps {
  items: MobileBottomNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** Render fixed to viewport bottom (default on mobile) or inline for design system preview */
  fixed?: boolean;
  className?: string;
}

/**
 * Touch-first bottom navigation bar for primary parent screens on mobile viewports (320px+).
 * Maintains >= 44px hitboxes and compact height to stay well under the 15% mobile sticky cap.
 */
export function MobileBottomNav({
  items,
  activeId,
  onSelect,
  fixed = true,
  className = '',
}: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Mobile primary navigation"
      className={`${
        fixed ? 'fixed bottom-0 left-0 right-0 z-40 lg:hidden pb-safe' : 'rounded-xl border border-border'
      } bg-surface/95 backdrop-blur-md border-t border-border ${className}`}
    >
      <div
        className="grid items-center h-16 max-w-lg mx-auto px-1"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onSelect(item.id)}
              className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-1 px-1 transition-colors cursor-pointer ${
                active ? 'text-sage font-semibold' : 'text-muted hover:text-charcoal font-medium'
              }`}
            >
              <span
                aria-hidden="true"
                className={`p-1 rounded-lg transition-colors ${active ? 'bg-sage-soft' : ''}`}
              >
                {item.icon}
              </span>
              <span className="text-[11px] leading-none truncate max-w-full">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
