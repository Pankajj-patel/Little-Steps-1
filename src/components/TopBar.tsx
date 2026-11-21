import React from 'react';

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
    <header className="sticky top-0 z-30 bg-chalk/95 backdrop-blur-sm border-b border-stone">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={onBrandClick}
          className="font-serif text-xl font-medium tracking-tight text-ink whitespace-nowrap shrink-0 cursor-pointer"
        >
          LittleSteps
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-5 sm:gap-7 overflow-x-auto"
        >
          {navItems.map((item) => {
            const isActive = item.id === activeNavId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectNav(item.id)}
                className={`text-sm py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-eucalyptus text-ink font-semibold'
                    : 'border-transparent text-olive hover:text-ink font-medium'
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
            className="px-4 py-2 text-sm font-medium rounded-lg border border-stone bg-linen text-ink hover:bg-oat transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {primaryActionLabel}
          </button>
        </div>
      </div>
    </header>
  );
}
