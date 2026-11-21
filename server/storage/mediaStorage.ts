import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_SIZE_BYTES,
  RETENTION_DAYS,
} from '../../src/shared/domain.ts';
import type { VideoStorageStatusResponse } from '../../src/shared/types.ts';

export interface MediaStorageAdapter {
  saveBuffer(buffer: Buffer, extension: string): Promise<string>;
  exists(storageKey: string): boolean;
  getSize(storageKey: string): number;
  openReadStream(storageKey: string, start?: number, end?: number): fs.ReadStream;
  deleteObject(storageKey: string): Promise<boolean>;
  getStorageStatus(): VideoStorageStatusResponse;
}

/**
 * LocalPrivateMediaStorage stores uploaded media strictly outside public/ and dist/
 * using opaque random UUID keys and strict path confinement.
 *
 * IMPORTANT: Because this prototype runs on local disk rather than a configured cloud
 * object store (GCS/S3 with KMS), getStorageStatus() explicitly reports 'demo_local_vault'
 * so the UI clearly discloses Demo Mode and advises against uploading real personal child videos.
 */
export class LocalPrivateMediaStorage implements MediaStorageAdapter {
  private readonly rootDir: string;

  constructor(rootDir?: string) {
    const isCloudRun = Boolean(process.env.K_SERVICE);
    const defaultMediaDir = isCloudRun
      ? path.join('/tmp', 'private_media')
      : path.join(process.cwd(), 'private_media');
    this.rootDir = path.resolve(
      rootDir || process.env.PRIVATE_MEDIA_DIR || defaultMediaDir
    );
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  private resolveSafePath(storageKey: string): string {
    const cleanKey = path.basename(storageKey);
    if (
      !cleanKey ||
      cleanKey !== storageKey ||
      cleanKey.includes('..') ||
      !/^[a-z0-9-]+\.[a-z0-9]{2,6}$/i.test(cleanKey)
    ) {
      throw new Error('Invalid storage key');
    }
    const resolved = path.resolve(this.rootDir, cleanKey);
    const rootBoundary = this.rootDir.endsWith(path.sep)
      ? this.rootDir
      : `${this.rootDir}${path.sep}`;
    if (!resolved.startsWith(rootBoundary)) {
      throw new Error('Storage key escapes private root boundary');
    }
    return resolved;
  }

  getStorageStatus(): VideoStorageStatusResponse {
    const configuredProvider = process.env.OBJECT_STORAGE_PROVIDER?.trim();
    const configuredBucket = process.env.OBJECT_STORAGE_BUCKET?.trim();
    const hasProdObjectStorage = Boolean(
      configuredProvider &&
        configuredBucket &&
        ['gcs', 's3', 'r2'].includes(configuredProvider.toLowerCase())
    );

    // Local adapter is active in this prototype build; never misrepresent local disk as cloud production storage
    return {
      mode: 'demo_local_vault',
      providerLabel:
        hasProdObjectStorage && configuredProvider
          ? `Demo Local Vault (cloud config ${configuredProvider.toUpperCase()} detected, adapter pending)`
          : 'Demo Local Vault (Isolated Prototype Storage)',
      isProductionConfigured: false,
      maxSizeBytes: MAX_VIDEO_SIZE_BYTES,
      maxDurationSeconds: MAX_VIDEO_DURATION_SECONDS,
      allowedMimeTypes: [...ALLOWED_VIDEO_MIME_TYPES],
      retentionDays: RETENTION_DAYS,
      warningNotice:
        'Demo Mode: Production private cloud object storage (GCS/S3) is not configured in this prototype. Clips are isolated outside public folders with signed short-lived links for testing, but please use the 3-second test clip or non-sensitive sample videos instead of real personal child recordings.',
    };
  }

  async saveBuffer(buffer: Buffer, extension: string): Promise<string> {
    const safeExt = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'webm';
    const storageKey = `${crypto.randomUUID()}.${safeExt}`;
    const targetPath = this.resolveSafePath(storageKey);
    await fs.promises.writeFile(targetPath, buffer, { mode: 0o600 });
    return storageKey;
  }

  exists(storageKey: string): boolean {
    if (!storageKey) return false;
    try {
      const targetPath = this.resolveSafePath(storageKey);
      return fs.existsSync(targetPath);
    } catch {
      return false;
    }
  }

  getSize(storageKey: string): number {
    const targetPath = this.resolveSafePath(storageKey);
    return fs.statSync(targetPath).size;
  }

  openReadStream(storageKey: string, start?: number, end?: number): fs.ReadStream {
    const targetPath = this.resolveSafePath(storageKey);
    return fs.createReadStream(targetPath, start !== undefined ? { start, end } : undefined);
  }

  async deleteObject(storageKey: string): Promise<boolean> {
    if (!storageKey) return false;
    try {
      const targetPath = this.resolveSafePath(storageKey);
      if (fs.existsSync(targetPath)) {
        await fs.promises.unlink(targetPath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

export const mediaStorage: MediaStorageAdapter = new LocalPrivateMediaStorage();

