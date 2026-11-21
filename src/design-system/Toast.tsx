import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  notify: (toast: Omit<ToastMessage, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { container: string; icon: React.ReactNode }> = {
  info: {
    container: 'bg-surface border-border text-charcoal',
    icon: <Info className="w-4 h-4 text-sage shrink-0 mt-0.5" aria-hidden="true" />,
  },
  success: {
    container: 'bg-sage-soft border-sage-border text-charcoal',
    icon: <CheckCircle2 className="w-4 h-4 text-sage shrink-0 mt-0.5" aria-hidden="true" />,
  },
  warning: {
    container: 'bg-warning-soft border-warning/30 text-charcoal',
    icon: <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />,
  },
  error: {
    container: 'bg-danger-soft border-danger/30 text-charcoal',
    icon: <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" aria-hidden="true" />,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);
      window.setTimeout(() => {
        dismiss(id);
      }, 4500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ notify, dismiss }}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        className="fixed bottom-20 md:bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-50 space-y-2 pointer-events-none"
      >
        {toasts.map((item) => {
          const style = TONE_STYLES[item.tone];
          return (
            <div
              key={item.id}
              className={`pointer-events-auto rounded-xl border p-4 flex items-start gap-3 ${style.container}`}
            >
              {style.icon}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-charcoal">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-muted mt-0.5 leading-relaxed">{item.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="min-h-[32px] min-w-[32px] -mr-1 -mt-1 flex items-center justify-center rounded-md text-muted hover:text-charcoal cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
