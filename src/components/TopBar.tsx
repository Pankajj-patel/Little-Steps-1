import React from 'react';
import { BrandLogo } from './BrandLogo';

export interface TopBarNavItem {
  id: string;
  label: string;
}

interface TopBarProps {
  navItems: TopBarNavItem[];
  activeNavId: string;
  onSelectNav: (id: string) => void;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  onBrandClick?: () => void;
}

/**
 * Strict 3-zone Top Bar Contract:
 * [Single-element Brand wordmark] — [Concise single-line nav links] — [1 primary action]
 */
export function TopBar({
  navItems,
  activeNavId,
  onSelectNav,
  primaryActionLabel,
  onPrimaryAction,
  onBrandClick,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-offwhite/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={onBrandClick}
          className="font-display text-xl font-semibold tracking-tight text-charcoal whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-2.5 min-h-[44px]"
        >
          <BrandLogo size="md" />
          <span>LittleSteps</span>
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-4 sm:gap-7 overflow-x-auto"
        >
          {navItems.map((item) => {
            const isActive = item.id === activeNavId;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectNav(item.id)}
                className={`min-h-[44px] text-sm py-2 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
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
        <div className="shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-lg border border-border-strong bg-surface text-charcoal hover:bg-cream transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {primaryActionLabel}
          </button>
        </div>
      </div>
    </header>
  );
}
