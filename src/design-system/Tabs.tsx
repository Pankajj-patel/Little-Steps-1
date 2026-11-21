import React, { useRef } from 'react';

export interface TabOption {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: TabOption[];
  activeTabId: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
  className?: string;
}

export function Tabs({
  tabs,
  activeTabId,
  onChange,
  ariaLabel = 'Sections',
  className = '',
}: TabsProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = (idx + 1) % tabs.length;
      onChange(tabs[next].id);
      buttonRefs.current[next]?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = (idx - 1 + tabs.length) % tabs.length;
      onChange(tabs[prev].id);
      buttonRefs.current[prev]?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-cream border border-border max-w-full ${className}`}
    >
      {tabs.map((tab, idx) => {
        const selected = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              buttonRefs.current[idx] = el;
            }}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selected
                ? 'bg-surface text-charcoal border border-border/80'
                : 'text-muted hover:text-charcoal border border-transparent'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className="ml-1.5 font-mono text-xs text-muted tabular-nums">{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
