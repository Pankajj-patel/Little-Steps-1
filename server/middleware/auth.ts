import type { CookieOptions, NextFunction, Request, Response } from 'express';
import type { UserProfile, UserRole } from '../../src/shared/types.ts';
import type { LittleStepsRepository } from '../repositories/index.ts';
import { verifySessionToken } from '../security/crypto.ts';

export const SESSION_COOKIE_NAME = 'ls_session';
export const CSRF_HEADER_NAME = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'LittleSteps';

export interface AuthenticatedRequest extends Request {
  authUser?: UserProfile;
}

/**
 * Builds secure session cookie options that work reliably in both
 * HTTPS cross-site preview iframes (SameSite=None; Secure; Partitioned)
 * and plain HTTP localhost development (SameSite=Lax).
 */
export function buildSessionCookieOptions(req: Request, maxAge?: number): CookieOptions {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const isHttps = req.secure || forwardedProto === 'https' || process.env.NODE_ENV === 'production';

  const base: CookieOptions & { partitioned?: boolean } = {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    path: '/',
    ...(isHttps ? { partitioned: true } : {}),
  };

  if (typeof maxAge === 'number') {
    base.maxAge = maxAge;
  }

  return base;
}

/**
 * Defense-in-depth CSRF protection for cookie-authenticated state-changing endpoints.
 * Rejects cross-origin Origin headers unconditionally and requires either our custom
 * X-Requested-With header or a verified same-origin Origin/Referer header on mutations.
 */
export function requireCsrfProtection(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }

  const rawHost = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase();

  const origin = req.headers.origin;
  let sameOriginVerified = false;

  if (typeof origin === 'string' && origin.length > 0) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (!rawHost || originHost !== rawHost) {
        res.status(403).json({ error: 'Cross-origin request blocked by CSRF protection.' });
        return;
      }
      sameOriginVerified = true;
    } catch {
      res.status(403).json({ error: 'Invalid Origin header.' });
      return;
    }
  }

  const customHeader = String(req.headers[CSRF_HEADER_NAME] || '').trim();
  if (customHeader === CSRF_HEADER_VALUE || sameOriginVerified) {
    next();
    return;
  }

  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer.length > 0) {
    try {
      const refererHost = new URL(referer).host.toLowerCase();
      if (rawHost && refererHost === rawHost) {
        next();
        return;
      }
    } catch {
      // fall through to 403
    }
  }

  res.status(403).json({ error: 'Missing required CSRF verification header.' });
}

export function createAuthMiddleware(repo: LittleStepsRepository) {
  return function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    const payload = verifySessionToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }
    const authRecord = repo.findUserAuthById(payload.userId);
    if (!authRecord || !authRecord.user.isActive || authRecord.sessionVersion !== payload.sessionVersion) {
      res.clearCookie(SESSION_COOKIE_NAME, buildSessionCookieOptions(req));
      res.status(401).json({ error: 'Session expired or no longer valid. Please sign in again.' });
      return;
    }
    req.authUser = authRecord.user;
    next();
  };
}

export function requireRole(...allowedRoles: UserRole[]) {
  return function roleGuard(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      res.status(403).json({ error: 'You do not have permission to access this resource.' });
      return;
    }
    next();
  };
}

/**
 * Lightweight in-memory sliding-window rate limiter for auth and upload endpoints.
 */
export function createRateLimiter(windowMs: number, maxRequests: number) {
  const buckets = new Map<string, number[]>();
  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const key = `${req.ip || 'local'}:${req.path}`;
    const now = Date.now();
    const recent = (buckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxRequests) {
      res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
      return;
    }
    recent.push(now);
    buckets.set(key, recent);
    next();
  };
}
