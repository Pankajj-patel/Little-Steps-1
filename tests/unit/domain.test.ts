import { afterAll, describe, expect, test } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  ALLOWED_VIDEO_MIME_TYPES,
  CANONICAL_AGE_GROUPS,
  CANONICAL_LEARNING_DOMAINS,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_SIZE_BYTES,
  RETENTION_DAYS,
  calculateAgeInMonths,
  calculateInstructionMatchScore,
  formatDaysUntilExpiry,
  getRubricMultiplier,
  resolveAgeGroupSlug,
} from '../../src/shared/domain';
import {
  generateOneTimeToken,
  hashIp,
  hashOneTimeToken,
  hashPassword,
  signSessionToken,
  signVideoStreamToken,
  validateImageMagicBytes,
  validateVideoMagicBytes,
  verifyPassword,
  verifySessionToken,
  verifyVideoStreamToken,
} from '../../server/security/crypto';
import { LocalPrivateMediaStorage } from '../../server/storage/mediaStorage';

describe('Critical Business Rules — src/shared/domain.ts', () => {
  test('canonical platform constants match child-safety & curriculum rules', () => {
    expect(RETENTION_DAYS).toBe(30);
    expect(MAX_VIDEO_SIZE_BYTES).toBe(50 * 1024 * 1024);
    expect(MAX_VIDEO_DURATION_SECONDS).toBe(120);
    expect(ALLOWED_VIDEO_MIME_TYPES).toEqual(['video/mp4', 'video/webm', 'video/quicktime']);
    expect(CANONICAL_AGE_GROUPS).toHaveLength(8);
    expect(CANONICAL_LEARNING_DOMAINS).toHaveLength(6);
  });

  test('calculateAgeInMonths computes exact whole months and handles edge cases', () => {
    const ref = new Date('2026-11-21T00:00:00Z');
    expect(calculateAgeInMonths('2026-11-21', ref)).toBe(0);
    expect(calculateAgeInMonths('2026-08-21', ref)).toBe(3);
    // Day of month not yet reached -> still 2 completed months
    expect(calculateAgeInMonths('2026-08-25', ref)).toBe(2);
    expect(calculateAgeInMonths('2025-11-21', ref)).toBe(12);
    expect(calculateAgeInMonths('2024-11-21', ref)).toBe(24);
    // Future date clamps to 0
    expect(calculateAgeInMonths('2027-02-01', ref)).toBe(0);
    // Invalid date returns 0 safely
    expect(calculateAgeInMonths('not-a-date', ref)).toBe(0);
  });

  test('resolveAgeGroupSlug maps all 8 canonical 3-month bands accurately', () => {
    expect(resolveAgeGroupSlug(-2)).toBe('0-3m');
    expect(resolveAgeGroupSlug(0)).toBe('0-3m');
    expect(resolveAgeGroupSlug(2)).toBe('0-3m');
    expect(resolveAgeGroupSlug(3)).toBe('3-6m');
    expect(resolveAgeGroupSlug(5)).toBe('3-6m');
    expect(resolveAgeGroupSlug(6)).toBe('6-9m');
    expect(resolveAgeGroupSlug(9)).toBe('9-12m');
    expect(resolveAgeGroupSlug(12)).toBe('12-15m');
    expect(resolveAgeGroupSlug(15)).toBe('15-18m');
    expect(resolveAgeGroupSlug(18)).toBe('18-21m');
    expect(resolveAgeGroupSlug(21)).toBe('21-24m');
    expect(resolveAgeGroupSlug(24)).toBe('21-24m');
    expect(resolveAgeGroupSlug(36)).toBe('21-24m');
  });

  test('getRubricMultiplier enforces Met=1, Partially Met=0.5, Not Met=0, Not Assessable=null', () => {
    expect(getRubricMultiplier('met')).toBe(1);
    expect(getRubricMultiplier('partially_met')).toBe(0.5);
    expect(getRubricMultiplier('not_met')).toBe(0);
    expect(getRubricMultiplier('not_observed')).toBe(0);
    expect(getRubricMultiplier('not_assessable')).toBeNull();
  });

  test('calculateInstructionMatchScore computes exact weighted percentages and exclusions', () => {
    // 100% all met
    const full = calculateInstructionMatchScore([
      { weightPoints: 30, achievedLevel: 'met' },
      { weightPoints: 40, achievedLevel: 'met' },
      { weightPoints: 30, achievedLevel: 'met' },
    ]);
    expect(full).toEqual({
      isAssessable: true,
      scorePct: 100,
      earnedTotal: 100,
      applicableTotal: 100,
      maxTotal: 100,
      excludedCount: 0,
    });

    // Mixed: 40*1 + 30*0.5 + 30*0 = 55 / 100 = 55%
    const mixed = calculateInstructionMatchScore([
      { weightPoints: 40, achievedLevel: 'met' },
      { weightPoints: 30, achievedLevel: 'partially_met' },
      { weightPoints: 30, achievedLevel: 'not_met' },
    ]);
    expect(mixed.isAssessable).toBe(true);
    expect(mixed.scorePct).toBe(55);
    expect(mixed.earnedTotal).toBe(55);
    expect(mixed.applicableTotal).toBe(100);

    // One criterion excluded (not_assessable): (30*1 + 30*0.5) / 60 = 45/60 = 75%
    const excluded = calculateInstructionMatchScore([
      { weightPoints: 40, achievedLevel: 'not_assessable' },
      { weightPoints: 30, achievedLevel: 'met' },
      { weightPoints: 30, achievedLevel: 'partially_met' },
    ]);
    expect(excluded).toEqual({
      isAssessable: true,
      scorePct: 75,
      earnedTotal: 45,
      applicableTotal: 60,
      maxTotal: 100,
      excludedCount: 1,
    });

    // Exact 50% applicable weight boundary -> still assessable
    const boundary = calculateInstructionMatchScore([
      { weightPoints: 50, achievedLevel: 'not_assessable' },
      { weightPoints: 50, achievedLevel: 'met' },
    ]);
    expect(boundary.isAssessable).toBe(true);
    expect(boundary.scorePct).toBe(100);

    // Below 50% applicable weight -> Not Assessable (prevents misleading score)
    const insufficient = calculateInstructionMatchScore([
      { weightPoints: 60, achievedLevel: 'not_assessable' },
      { weightPoints: 40, achievedLevel: 'met' },
    ]);
    expect(insufficient.isAssessable).toBe(false);
    expect(insufficient.scorePct).toBeNull();
    expect(insufficient.excludedCount).toBe(1);

    // Empty rubric -> Not Assessable
    const empty = calculateInstructionMatchScore([]);
    expect(empty.isAssessable).toBe(false);
    expect(empty.scorePct).toBeNull();
  });

  test('formatDaysUntilExpiry clamps past timestamps to 0 and rounds future days up', () => {
    const inTenDays = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(formatDaysUntilExpiry(inTenDays)).toBeGreaterThanOrEqual(10);
    expect(formatDaysUntilExpiry(yesterday)).toBe(0);
  });
});

describe('Security Primitives — server/security/crypto.ts', () => {
  test('password hashing uses unique random salts and timing-safe verification', () => {
    const h1 = hashPassword('LittleSteps123!');
    const h2 = hashPassword('LittleSteps123!');
    expect(h1).not.toBe(h2);
    expect(verifyPassword('LittleSteps123!', h1)).toBe(true);
    expect(verifyPassword('WrongPassword!', h1)).toBe(false);
    expect(verifyPassword('LittleSteps123!', 'malformed-hash')).toBe(false);
  });

  test('one-time tokens and IP hashes are deterministic SHA-256 digests', () => {
    const { rawToken, tokenHash } = generateOneTimeToken();
    expect(rawToken.length).toBeGreaterThanOrEqual(32);
    expect(hashOneTimeToken(rawToken)).toBe(tokenHash);
    expect(hashIp('127.0.0.1')).toBe(hashIp('127.0.0.1'));
    expect(hashIp('127.0.0.1')).not.toBe(hashIp('10.0.0.1'));
  });

  test('session tokens verify validly and reject tampering, truncation, or expiry', () => {
    const token = signSessionToken('usr_123', 'parent', 2);
    const verified = verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe('usr_123');
    expect(verified?.role).toBe('parent');
    expect(verified?.sessionVersion).toBe(2);

    // Tamper signature
    const [payload, sig] = token.split('.');
    expect(verifySessionToken(`${payload}.${sig.slice(0, -1)}X`)).toBeNull();
    // Tamper payload
    const forgedPayload = Buffer.from(
      JSON.stringify({ userId: 'usr_123', role: 'admin', sessionVersion: 2, exp: 9999999999 })
    ).toString('base64url');
    expect(verifySessionToken(`${forgedPayload}.${sig}`)).toBeNull();
    // Missing or malformed
    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken('invalid.token.parts')).toBeNull();
  });

  test('video stream tokens enforce short-lived expiry and tamper resistance', () => {
    const { token, expiresAt } = signVideoStreamToken('usr_parent', 'parent', 'sub_999');
    const verified = verifyVideoStreamToken(token);
    expect(verified?.userId).toBe('usr_parent');
    expect(verified?.submissionId).toBe('sub_999');
    const ttlMs = new Date(expiresAt).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(240_000);
    expect(ttlMs).toBeLessThanOrEqual(305_000);

    expect(verifyVideoStreamToken(`${token}tampered`)).toBeNull();
    expect(verifyVideoStreamToken(undefined)).toBeNull();
    expect(verifyVideoStreamToken('badtoken')).toBeNull();
  });

  test('validateVideoMagicBytes enforces binary headers and MIME-to-container match', () => {
    const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x00, 0x00, 0x00]);
    const mp4 = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    const mov = Buffer.from([0x00, 0x00, 0x00, 0x14, 0x6d, 0x6f, 0x6f, 0x76, 0x00, 0x00, 0x00, 0x00]);
    const spoofedHtml = Buffer.from('<html><script>alert(1)</script></html>');

    expect(validateVideoMagicBytes(webm, 'video/webm')).toBe(true);
    expect(validateVideoMagicBytes(mp4, 'video/mp4')).toBe(true);
    expect(validateVideoMagicBytes(mov, 'video/quicktime')).toBe(true);
    expect(validateVideoMagicBytes(webm)).toBe(true);

    // MIME-to-container mismatch blocked
    expect(validateVideoMagicBytes(mp4, 'video/webm')).toBe(false);
    expect(validateVideoMagicBytes(webm, 'video/mp4')).toBe(false);
    // Disguised HTML & short buffers blocked
    expect(validateVideoMagicBytes(spoofedHtml, 'video/webm')).toBe(false);
    expect(validateVideoMagicBytes(Buffer.from([0x1a, 0x45]), 'video/webm')).toBe(false);
  });

  test('validateImageMagicBytes accepts JPEG/PNG/WebP and rejects SVG/HTML/text', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const webp = Buffer.from('RIFF\x24\x00\x00\x00WEBP', 'binary');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

    expect(validateImageMagicBytes(jpeg)).toBe(true);
    expect(validateImageMagicBytes(png)).toBe(true);
    expect(validateImageMagicBytes(webp)).toBe(true);
    expect(validateImageMagicBytes(svg)).toBe(false);
    expect(validateImageMagicBytes(Buffer.from([0xff, 0xd8]))).toBe(false);
  });
});

describe('Isolated Private Vault — server/storage/mediaStorage.ts', () => {
  const tempVaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'littlesteps-vault-test-'));
  const vault = new LocalPrivateMediaStorage(tempVaultDir);

  afterAll(() => {
    fs.rmSync(tempVaultDir, { recursive: true, force: true });
  });

  test('saves, reads, streams byte ranges, and deletes private objects safely', async () => {
    const content = Buffer.from('0123456789abcdefghij');
    const key = await vault.saveBuffer(content, 'webm');

    expect(key).toMatch(/^[a-f0-9-]+\.webm$/i);
    expect(vault.exists(key)).toBe(true);
    expect(vault.getSize(key)).toBe(content.length);

    const chunk = await new Promise<Buffer>((resolve, reject) => {
      const parts: Buffer[] = [];
      vault
        .openReadStream(key, 2, 7)
        .on('data', (d) => parts.push(Buffer.from(d)))
        .on('end', () => resolve(Buffer.concat(parts)))
        .on('error', reject);
    });
    expect(chunk.toString('utf8')).toBe('234567');

    expect(await vault.deleteObject(key)).toBe(true);
    expect(vault.exists(key)).toBe(false);
    expect(await vault.deleteObject(key)).toBe(false);
  });

  test('blocks path traversal and malformed storage keys', async () => {
    expect(vault.exists('../../etc/passwd')).toBe(false);
    expect(vault.exists('../package.json')).toBe(false);
    expect(vault.exists('bad\0key.webm')).toBe(false);
    expect(vault.exists('')).toBe(false);
    expect(() => vault.getSize('../../etc/passwd')).toThrow();
    expect(() => vault.openReadStream('../server.ts')).toThrow();
    expect(await vault.deleteObject('../../etc/passwd')).toBe(false);
  });

  test('getStorageStatus honestly discloses demo local vault mode', () => {
    const status = vault.getStorageStatus();
    expect(status.mode).toBe('demo_local_vault');
    expect(status.isProductionConfigured).toBe(false);
    expect(status.retentionDays).toBe(30);
    expect(status.warningNotice).toContain('Demo Mode');
  });
});
