import React from 'react';

export interface NavbarItem {
  id: string;
  label: string;
}

export interface NavbarProps {
  brandLabel?: string;
  items: NavbarItem[];
  activeId: string;
  onSelect: (id: string) => void;
  action?: React.ReactNode;
  onBrandClick?: () => void;
  sticky?: boolean;
}

/**
 * Reusable LittleSteps Navigation Bar following a calm 3-zone contract:
 * [Brand wordmark] — [Single-line links] — [1 primary action]
 */
export function Navbar({
  brandLabel = 'LittleSteps',
  items,
  activeId,
  onSelect,
  action,
  onBrandClick,
  sticky = true,
}: NavbarProps) {
  return (
    <header
      className={`${
        sticky ? 'sticky top-0 z-30' : ''
      } bg-offwhite/95 backdrop-blur-sm border-b border-border`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-6 sm:gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={onBrandClick}
          className="font-display text-xl font-bold tracking-tight text-charcoal whitespace-nowrap shrink-0 min-h-[44px] flex items-center cursor-pointer"
        >
          {brandLabel}
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 lg:gap-7 overflow-x-auto"
        >
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelect(item.id)}
                className={`min-h-[44px] px-1 text-sm border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'border-sage text-charcoal font-semibold'
                    : 'border-transparent text-muted hover:text-charcoal font-medium'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
