import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { translate } from '../shared/i18n';
import type { ActivityStep, LocaleCode } from '../shared/types';
import { EditorialImage } from './EditorialImage';

interface InstructionalGuidePlayerProps {
  posterUrl: string;
  activityTitle: string;
  steps: ActivityStep[];
  locale?: LocaleCode;
}

/**
 * Interactive step-paced instructional walkthrough allowing caregivers to preview
 * the exact rhythm and sequence of an activity before practicing with their baby.
 */
export function InstructionalGuidePlayer({
  posterUrl,
  activityTitle,
  steps,
  locale = 'en',
}: InstructionalGuidePlayerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying || steps.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [isPlaying, steps.length]);

  const currentStep = steps[activeIndex] ?? steps[0];

  const handleRestart = () => {
    setActiveIndex(0);
    setIsPlaying(true);
  };

  const stepHeaderLabel =
    locale === 'hi'
      ? `${translate('hi', 'player.guidedDemo')} · चरण ${activeIndex + 1} / ${steps.length}`
      : `${translate('en', 'player.guidedDemo')} · Step ${activeIndex + 1} of ${steps.length}`;

  return (
    <div className="rounded-xl border border-stone bg-linen overflow-hidden">
      <div className="relative aspect-[16/9] bg-oat overflow-hidden">
        <EditorialImage
          src={posterUrl}
          alt={activityTitle}
          aspectClassName="w-full h-full"
        />
        {/* Measured scrim ensuring >= 4.5:1 text contrast over editorial photography */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10 flex flex-col justify-between p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4 text-xs text-white/90">
            <span className="font-mono tabular-nums">{stepHeaderLabel}</span>
            <span className="font-mono tabular-nums">
              {isPlaying ? translate(locale, 'player.playing') : translate(locale, 'player.paused')}
            </span>
          </div>

          {currentStep && (
            <div className="max-w-2xl">
              <p className="font-serif text-lg sm:text-xl text-white font-medium mb-1">
                {String(currentStep.stepNumber).padStart(2, '0')}. {currentStep.title}
              </p>
              <p className="text-sm text-white/90 leading-relaxed">
                {currentStep.instructionText}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Walkthrough playback controls */}
      <div className="px-4 py-3 bg-linen border-t border-stone flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-eucalyptus text-white text-sm font-medium hover:bg-eucalyptus-hover transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" aria-hidden="true" />
                {translate(locale, 'player.pauseGuide')}
              </>
            ) : (
              <>
                <Play className="w-4 h-4" aria-hidden="true" />
                {translate(locale, 'player.playGuide')}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setActiveIndex((prev) => Math.max(0, prev - 1));
            }}
            disabled={activeIndex === 0}
            aria-label="Previous step"
            className="p-2 rounded-lg border border-stone text-ink hover:bg-oat disabled:opacity-40 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setActiveIndex((prev) => Math.min(steps.length - 1, prev + 1));
            }}
            disabled={activeIndex >= steps.length - 1}
            aria-label="Next step"
            className="p-2 rounded-lg border border-stone text-ink hover:bg-oat disabled:opacity-40 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleRestart}
            aria-label="Restart step guide"
            className="p-2 rounded-lg border border-stone text-olive hover:text-ink hover:bg-oat transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Step progress bars */}
        <div className="flex items-center gap-1.5 flex-1 max-w-xs">
          {steps.map((step, idx) => (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setActiveIndex(idx);
              }}
              aria-label={`Jump to step ${idx + 1}`}
              className={`h-1.5 flex-1 rounded-full transition-colors cursor-pointer ${
                idx <= activeIndex ? 'bg-eucalyptus' : 'bg-stone'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
