import React from 'react';

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  meta?: string;
}

export interface SidebarProps {
  title?: string;
  subtitle?: string;
  items: SidebarNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  footer?: React.ReactNode;
  className?: string;
}

export function Sidebar({
  title,
  subtitle,
  items,
  activeId,
  onSelect,
  footer,
  className = '',
}: SidebarProps) {
  return (
    <aside
      aria-label={title || 'Section navigation'}
      className={`w-full lg:w-64 shrink-0 rounded-xl border border-border bg-surface p-3 flex flex-col justify-between gap-4 ${className}`}
    >
      <div className="space-y-3">
        {(title || subtitle) && (
          <div className="px-3 pt-2 pb-2 border-b border-border">
            {title && (
              <p className="font-display text-sm font-semibold text-charcoal">{title}</p>
            )}
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
        )}

        <nav className="space-y-1">
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelect(item.id)}
                className={`w-full min-h-[44px] px-3 py-2 rounded-lg flex items-center justify-between gap-2.5 text-sm transition-colors cursor-pointer ${
                  active
                    ? 'bg-sage-soft text-sage font-semibold'
                    : 'text-muted hover:bg-cream hover:text-charcoal font-medium'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="shrink-0" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </span>
                {item.meta && (
                  <span className="font-mono text-xs tabular-nums text-muted shrink-0">
                    {item.meta}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {footer && <div className="pt-3 border-t border-border px-2">{footer}</div>}
    </aside>
  );
}
