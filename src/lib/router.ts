import { useCallback, useEffect, useState } from 'react';

export type PublicRoute =
  | '/'
  | '/about'
  | '/how-it-works'
  | '/our-approach'
  | '/contact'
  | '/privacy'
  | '/terms'
  | '/login'
  | '/register'
  | '/forgot-password'
  | '/reset-password'
  | '/verify-email'
  | '/design-system';

export type NavigateTarget = PublicRoute | `${PublicRoute}?${string}`;

const VALID_ROUTES: ReadonlySet<string> = new Set<PublicRoute>([
  '/',
  '/about',
  '/how-it-works',
  '/our-approach',
  '/contact',
  '/privacy',
  '/terms',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/design-system',
]);

function normalizePath(pathname: string): PublicRoute {
  const cleaned = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return VALID_ROUTES.has(cleaned) ? (cleaned as PublicRoute) : '/';
}

export function usePublicRouter() {
  const [route, setRoute] = useState<PublicRoute>(() => normalizePath(window.location.pathname));
  const [search, setSearch] = useState<string>(() => window.location.search);

  useEffect(() => {
    const onPopState = () => {
      setRoute(normalizePath(window.location.pathname));
      setSearch(window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((target: NavigateTarget) => {
    const [rawPath, rawQuery] = target.split('?');
    const normalized = normalizePath(rawPath);
    const nextSearch = rawQuery ? `?${rawQuery}` : '';
    const nextFull = `${normalized}${nextSearch}`;
    if (`${window.location.pathname}${window.location.search}` !== nextFull) {
      window.history.pushState({}, '', nextFull);
    }
    setRoute(normalized);
    setSearch(nextSearch);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const getQueryParam = useCallback(
    (name: string): string | null => {
      return new URLSearchParams(search).get(name);
    },
    [search]
  );

  return { route, search, getQueryParam, navigate };
}

