import React, { useEffect, useState } from 'react';
import { Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { formatDaysUntilExpiry } from '../shared/domain';
import type { VideoStorageMode } from '../shared/types';

interface SecureVideoPlayerProps {
  submissionId: string;
  hasActiveVideo: boolean;
  expiresAt: string;
  deletionReason?: string | null;
  storageMode?: VideoStorageMode;
}

/**
 * Plays private child-activity videos strictly via short-lived (5-min) HMAC-signed
 * streaming tokens. Never caches publicly and disables download affordances.
 */
export function SecureVideoPlayer({
  submissionId,
  hasActiveVideo,
  expiresAt,
  deletionReason,
  storageMode = 'demo_local_vault',
}: SecureVideoPlayerProps) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadToken = async () => {
    if (!hasActiveVideo) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getVideoStreamToken(submissionId);
      setStreamUrl(res.streamUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load private video stream.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setStreamUrl(null);
    if (hasActiveVideo) {
      void loadToken();
    }
  }, [submissionId, hasActiveVideo]);

  if (!hasActiveVideo) {
    return (
      <div className="rounded-xl border border-border bg-cream/70 p-6 text-center">
        <ShieldCheck className="w-6 h-6 text-sage mx-auto mb-2" aria-hidden="true" />
        <p className="text-sm font-semibold text-charcoal mb-1">
          Video Permanently Removed from Storage
        </p>
        <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
          {deletionReason === 'retention_30d'
            ? 'This video was automatically deleted after the 30-day privacy retention window. Written caregiver feedback remains preserved.'
            : 'This video was deleted from storage. Written caregiver coaching notes and rubric scores remain saved.'}
        </p>
      </div>
    );
  }

  const daysLeft = formatDaysUntilExpiry(expiresAt);

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="aspect-video bg-charcoal flex items-center justify-center relative">
        {loading && (
          <p className="text-sm text-white/80">Preparing signed video stream...</p>
        )}
        {!loading && error && (
          <div className="p-6 text-center">
            <p role="alert" className="text-sm text-white/90 mb-3">
              {error}
            </p>
            <button
              type="button"
              onClick={() => void loadToken()}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/15 text-white text-xs font-medium hover:bg-white/25 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Refresh Signed Stream
            </button>
          </div>
        )}
        {!loading && !error && streamUrl && (
          <video
            key={streamUrl}
            src={streamUrl}
            aria-label="Private caregiver activity practice video"
            preload="metadata"
            controls
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            playsInline
            onContextMenu={(e) => e.preventDefault()}
            className="w-full h-full object-contain bg-black"
          />
        )}
      </div>
      <div className="px-4 py-2.5 bg-cream/70 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-sage" aria-hidden="true" />
          {storageMode === 'production_object_storage'
            ? 'Private cloud signed stream · Access audited · Non-downloadable'
            : 'Demo isolated vault · Short-lived signed URL · Access audited'}
        </span>
        <span className="font-mono tabular-nums">
          Auto-deletes in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
        </span>
      </div>
    </div>
  );
}

