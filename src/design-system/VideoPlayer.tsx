import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, Pause, Play, RotateCcw } from 'lucide-react';
import { EditorialImage } from '../components/EditorialImage';

export interface VideoGuideChapter {
  id: string;
  stepNumber: number;
  title: string;
  caption: string;
}

export interface VideoPlayerProps {
  title: string;
  posterUrl: string;
  /** Optional direct or signed stream URL for real HTML5 video playback */
  videoSrc?: string | null;
  /** Optional interactive step-paced demonstration chapters when no MP4/WebM stream is attached */
  chapters?: VideoGuideChapter[];
  privacyNote?: string;
  retentionLabel?: string;
  disableDownload?: boolean;
}

/**
 * Unified LittleSteps VideoPlayer supporting both private signed video streams
 * and calm step-paced caregiver demonstration guides.
 */
export function VideoPlayer({
  title,
  posterUrl,
  videoSrc,
  chapters = [],
  privacyNote,
  retentionLabel,
  disableDownload = true,
}: VideoPlayerProps) {
  const [chapterIndex, setChapterIndex] = useState(0);
  const [playingGuide, setPlayingGuide] = useState(false);

  useEffect(() => {
    if (!playingGuide || chapters.length <= 1) return;
    const timer = window.setInterval(() => {
      setChapterIndex((prev) => {
        if (prev >= chapters.length - 1) {
          setPlayingGuide(false);
          return prev;
        }
        return prev + 1;
      });
    }, 4500);
    return () => window.clearInterval(timer);
  }, [playingGuide, chapters.length]);

  const activeChapter = chapters[chapterIndex];

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {videoSrc ? (
        <div className="aspect-video bg-charcoal">
          <video
            src={videoSrc}
            poster={posterUrl}
            controls
            controlsList={disableDownload ? 'nodownload' : undefined}
            disablePictureInPicture={disableDownload}
            playsInline
            onContextMenu={disableDownload ? (e) => e.preventDefault() : undefined}
            className="w-full h-full object-contain bg-black"
          />
        </div>
      ) : (
        <>
          <div className="relative aspect-video bg-cream overflow-hidden">
            <EditorialImage src={posterUrl} alt={title} aspectClassName="w-full h-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10 p-4 sm:p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-3 text-xs text-white/90 font-mono tabular-nums">
                <span>
                  {chapters.length > 0
                    ? `Step ${chapterIndex + 1} of ${chapters.length}`
                    : 'Instructional Preview'}
                </span>
                <span>{playingGuide ? 'Playing' : 'Ready'}</span>
              </div>

              {activeChapter && (
                <div className="max-w-xl space-y-1">
                  <p className="font-display text-base sm:text-xl font-semibold text-white">
                    {String(activeChapter.stepNumber).padStart(2, '0')}. {activeChapter.title}
                  </p>
                  <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
                    {activeChapter.caption}
                  </p>
                </div>
              )}
            </div>
          </div>

          {chapters.length > 0 && (
            <div className="px-4 py-3 border-t border-border bg-surface flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPlayingGuide((p) => !p)}
                  className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-lg bg-sage text-white text-xs sm:text-sm font-medium hover:bg-sage-hover transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {playingGuide ? (
                    <>
                      <Pause className="w-4 h-4" aria-hidden="true" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" aria-hidden="true" />
                      Play Guide
                    </>
                  )}
                </button>

                <button
                  type="button"
                  aria-label="Previous step"
                  disabled={chapterIndex === 0}
                  onClick={() => {
                    setPlayingGuide(false);
                    setChapterIndex((prev) => Math.max(0, prev - 1));
                  }}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-border text-charcoal hover:bg-cream disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  aria-label="Next step"
                  disabled={chapterIndex >= chapters.length - 1}
                  onClick={() => {
                    setPlayingGuide(false);
                    setChapterIndex((prev) => Math.min(chapters.length - 1, prev + 1));
                  }}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-border text-charcoal hover:bg-cream disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  aria-label="Restart guide"
                  onClick={() => {
                    setChapterIndex(0);
                    setPlayingGuide(true);
                  }}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-border text-muted hover:text-charcoal hover:bg-cream cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-1 min-w-[120px] max-w-xs">
                {chapters.map((ch, idx) => (
                  <button
                    key={ch.id}
                    type="button"
                    aria-label={`Jump to step ${idx + 1}`}
                    onClick={() => {
                      setPlayingGuide(false);
                      setChapterIndex(idx);
                    }}
                    className={`h-2 flex-1 rounded-full transition-colors cursor-pointer ${
                      idx <= chapterIndex ? 'bg-sage' : 'bg-cream border border-border'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {(privacyNote || retentionLabel) && (
        <div className="px-4 py-2.5 border-t border-border bg-cream/60 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-sage shrink-0" aria-hidden="true" />
            <span>{privacyNote ?? 'Private signed playback'}</span>
          </span>
          {retentionLabel && (
            <span className="font-mono tabular-nums text-charcoal">{retentionLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
