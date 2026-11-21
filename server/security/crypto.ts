import crypto from 'crypto';
import type { UserRole } from '../../src/shared/types.ts';

function resolveSigningSecret(envName: string): string {
  const configured = process.env[envName]?.trim();
  if (
    configured &&
    configured.length >= 16 &&
    !configured.startsWith('replace-with-')
  ) {
    return configured;
  }
  return crypto.randomBytes(32).toString('hex');
}

const SESSION_SECRET = resolveSigningSecret('SESSION_SECRET');
const VIDEO_TOKEN_SECRET = resolveSigningSecret('VIDEO_TOKEN_SECRET');

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const VIDEO_TOKEN_TTL_SECONDS = 60 * 5; // 5 minutes short-lived token

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(`${ip}:${SESSION_SECRET}`).digest('hex').slice(0, 24);
}

/**
 * Generates a cryptographically random URL-safe token and its SHA-256 hash.
 * Only the hash is stored in SQLite; the raw token is never persisted or logged.
 */
export function generateOneTimeToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashOneTimeToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashOneTimeToken(rawToken: string): string {
  return crypto.createHash('sha256').update(`${rawToken}:${SESSION_SECRET}`).digest('hex');
}

interface SessionPayload {
  userId: string;
  role: UserRole;
  sessionVersion: number;
  exp: number;
}

export function signSessionToken(
  userId: string,
  role: UserRole,
  sessionVersion = 1
): string {
  const payload: SessionPayload = {
    userId,
    role,
    sessionVersion,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (
      !parsed.userId ||
      !parsed.role ||
      typeof parsed.sessionVersion !== 'number' ||
      parsed.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

interface VideoStreamTokenPayload {
  userId: string;
  role: UserRole;
  submissionId: string;
  exp: number;
}

export function signVideoStreamToken(
  userId: string,
  role: UserRole,
  submissionId: string
): { token: string; expiresAt: string } {
  const exp = Math.floor(Date.now() / 1000) + VIDEO_TOKEN_TTL_SECONDS;
  const payload: VideoStreamTokenPayload = { userId, role, submissionId, exp };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', VIDEO_TOKEN_SECRET)
    .update(encoded)
    .digest('base64url');
  return {
    token: `${encoded}.${sig}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function verifyVideoStreamToken(token: string | undefined): VideoStreamTokenPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', VIDEO_TOKEN_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as VideoStreamTokenPayload;
    if (
      !parsed.userId ||
      !parsed.submissionId ||
      parsed.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Validates actual binary video file magic bytes and enforces MIME-to-container match
 * to prevent spoofed Content-Type or disguised file uploads.
 */
export function validateVideoMagicBytes(buffer: Buffer, declaredMime?: string): boolean {
  if (buffer.length < 12) return false;
  const isWebm =
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3;
  const boxType = buffer.subarray(4, 8).toString('ascii');
  const isMp4OrMov =
    boxType === 'ftyp' || boxType === 'moov' || boxType === 'mdat' || boxType === 'wide';

  if (declaredMime === 'video/webm') {
    return isWebm;
  }
  if (declaredMime === 'video/mp4' || declaredMime === 'video/quicktime') {
    return isMp4OrMov;
  }
  return isWebm || isMp4OrMov;
}

/**
 * Validates actual binary image magic bytes (JPEG, PNG, WebP) for optional profile photos.
 */
export function validateImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const isWebp =
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return isJpeg || isPng || isWebp;
}
