import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Camera,
  CheckCircle2,
  Clock,
  Film,
  Info,
  RefreshCw,
  RotateCcw,
  Shield,
  Square,
  Trash2,
  Upload,
  UploadCloud,
  Video,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  ProgressIndicator,
  type BadgeTone,
} from '../design-system';
import { api } from '../lib/api';
import { MAX_VIDEO_DURATION_SECONDS, MAX_VIDEO_SIZE_BYTES } from '../shared/domain';
import type {
  VideoStorageStatusResponse,
  VideoSubmissionSummary,
} from '../shared/types';

export type SubmissionUiState =
  | 'draft'
  | 'uploading'
  | 'submitted'
  | 'under_review'
  | 'reviewed'
  | 'changes_requested'
  | 'failed';

export function mapServerSubmissionToUiState(
  sub: VideoSubmissionSummary | null | undefined
): SubmissionUiState | null {
  if (!sub) return null;
  if (sub.review || sub.reviewStatus === 'reviewed') return 'reviewed';
  if (sub.reviewStatus === 'resubmit_requested') return 'changes_requested';
  if (sub.reviewStatus === 'in_review') return 'under_review';
  if (sub.reviewStatus === 'queued') return 'submitted';
  return null;
}

export function getSubmissionStateBadge(state: SubmissionUiState): {
  label: string;
  tone: BadgeTone;
  description: string;
  icon: React.ReactNode;
} {
  switch (state) {
    case 'draft':
      return {
        label: 'Draft',
        tone: 'neutral',
        description: 'Record or choose a short clip, preview it, and confirm consent before submitting.',
        icon: <Video className="w-3.5 h-3.5" aria-hidden="true" />,
      };
    case 'uploading':
      return {
        label: 'Uploading',
        tone: 'peach',
        description: 'Uploading your practice clip. Keep this tab open until progress reaches 100%.',
        icon: <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />,
      };
    case 'submitted':
      return {
        label: 'Submitted',
        tone: 'lavender',
        description: 'Your clip has been received and is waiting in the caregiver coaching queue.',
        icon: <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />,
      };
    case 'under_review':
      return {
        label: 'Under review',
        tone: 'lavender',
        description: 'A caregiver coach is currently reviewing your clip against the activity steps.',
        icon: <Clock className="w-3.5 h-3.5" aria-hidden="true" />,
      };
    case 'reviewed':
      return {
        label: 'Reviewed',
        tone: 'sage',
        description: 'Caregiver coaching feedback and instruction-match guidance are ready to read.',
        icon: <Award className="w-3.5 h-3.5" aria-hidden="true" />,
      };
    case 'changes_requested':
      return {
        label: 'Changes requested',
        tone: 'peach',
        description: 'Your reviewer asked for a clearer or updated clip. You can record or upload a new one below.',
        icon: <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />,
      };
    case 'failed':
      return {
        label: 'Failed',
        tone: 'danger',
        description: 'The upload did not complete. Your prepared clip is still here—tap Retry Upload or replace it.',
        icon: <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />,
      };
  }
}

interface VideoCaptureUploaderProps {
  childId: string;
  childName?: string;
  activityId: string;
  activityTitle: string;
  activityVersion?: number;
  initialMode?: 'record' | 'upload';
  existingSubmission?: VideoSubmissionSummary | null;
  onSubmitted: (submission: VideoSubmissionSummary) => void;
  onCancel: () => void;
}

export function VideoCaptureUploader({
  childId,
  childName = 'your baby',
  activityId,
  activityTitle,
  activityVersion = 1,
  initialMode,
  existingSubmission,
  onSubmitted,
  onCancel,
}: VideoCaptureUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<Blob | null>(null);
  const [filename, setFilename] = useState<string>('practice.webm');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number>(10);
  const [caregiverNotes, setCaregiverNotes] = useState('');
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [uiState, setUiState] = useState<SubmissionUiState>(
    existingSubmission?.reviewStatus === 'resubmit_requested' ? 'changes_requested' : 'draft'
  );
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [storageStatus, setStorageStatus] = useState<VideoStorageStatusResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const recordSecondsRef = useRef<number>(0);

  // Fetch honest storage mode status (Demo Local Vault vs Production Private Object Storage)
  useEffect(() => {
    let active = true;
    api
      .getVideoStorageStatus()
      .then((status) => {
        if (active) setStorageStatus(status);
      })
      .catch(() => {
        if (active) {
          setStorageStatus({
            mode: 'demo_local_vault',
            providerLabel: 'Demo Local Vault (Isolated Prototype Storage)',
            isProductionConfigured: false,
            maxSizeBytes: MAX_VIDEO_SIZE_BYTES,
            maxDurationSeconds: MAX_VIDEO_DURATION_SECONDS,
            allowedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
            retentionDays: 30,
            warningNotice:
              'Demo Mode: Production private cloud object storage (GCS/S3) is not configured in this prototype. Please use the 3-second test clip or non-sensitive sample videos rather than real personal child recordings.',
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const cleanupCamera = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      cleanupCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const setPreparedVideo = (blob: Blob, name: string, seconds: number) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(blob);
    setSelectedFile(blob);
    setFilename(name);
    setDurationSeconds(Math.max(1, Math.min(MAX_VIDEO_DURATION_SECONDS, Math.round(seconds))));
    setPreviewUrl(url);
    setError(null);
    setUiState('draft');
  };

  const handleRemoveVideo = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    setFilename('practice.webm');
    setError(null);
    setUploadProgress(0);
    setUiState(
      existingSubmission?.reviewStatus === 'resubmit_requested' ? 'changes_requested' : 'draft'
    );
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size === 0) {
      setError('The selected file appears to be empty. Please pick another video clip.');
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      setError('Please choose a video smaller than 50 MB.');
      return;
    }
    const normalized = file.type.split(';')[0].trim().toLowerCase();
    if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(normalized)) {
      setError('Only MP4, WebM, or MOV video files are supported.');
      return;
    }
    const tempUrl = URL.createObjectURL(file);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      const dur = Number.isFinite(probe.duration) ? probe.duration : 15;
      URL.revokeObjectURL(tempUrl);
      if (dur > MAX_VIDEO_DURATION_SECONDS) {
        setError('Please keep activity clips at 2 minutes (120 seconds) or shorter.');
        return;
      }
      setPreparedVideo(file, file.name, dur);
    };
    probe.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      setPreparedVideo(file, file.name, 15);
    };
    probe.src = tempUrl;
    e.target.value = '';
  };

  /**
   * Requests camera/audio ONLY when parent explicitly clicks "Record Activity".
   * Falls back to video-only if microphone is unavailable so no unnecessary permissions block recording.
   */
  const startCameraRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(
        'Camera recording is not supported in this browser. You can upload a video from your device or create a 3-second demo clip below.'
      );
      return;
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: true,
        });
      } catch {
        // Fallback to video-only if mic permission is declined or absent
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      streamRef.current = stream;
      setIsRecording(true);
      setRecordSeconds(0);
      recordSecondsRef.current = 0;

      // Wait a tick for the live video element to mount before attaching srcObject
      window.setTimeout(() => {
        if (liveVideoRef.current && streamRef.current) {
          liveVideoRef.current.srcObject = streamRef.current;
          void liveVideoRef.current.play().catch(() => {});
        }
      }, 30);

      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const recordedDur = Math.max(1, recordSecondsRef.current);
        cleanupCamera();
        setIsRecording(false);
        if (blob.size > 0) {
          setPreparedVideo(blob, `littlesteps-activity-${Date.now()}.webm`, recordedDur);
        }
      };

      recorder.start(250);
      timerRef.current = window.setInterval(() => {
        recordSecondsRef.current += 1;
        setRecordSeconds(recordSecondsRef.current);
        if (recordSecondsRef.current >= MAX_VIDEO_DURATION_SECONDS) {
          recorder.stop();
        }
      }, 1000);
    } catch {
      cleanupCamera();
      setIsRecording(false);
      setError(
        'Camera access was declined or unavailable. You can upload an existing video from your device or generate a 3-second demo sample clip.'
      );
    }
  };

  const stopCameraRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelCameraRecording = () => {
    chunksRef.current = [];
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        cleanupCamera();
        setIsRecording(false);
      };
      mediaRecorderRef.current.stop();
    } else {
      cleanupCamera();
      setIsRecording(false);
    }
  };

  /**
   * Generates a real binary WebM clip via Canvas + MediaRecorder for demo testing
   * without needing a camera or uploading real personal child footage in Demo Mode.
   */
  const recordSampleTestClip = async () => {
    setError(null);
    if (typeof MediaRecorder === 'undefined') {
      setError('Sample clip recording is unavailable in this browser. Please upload a video file instead.');
      return;
    }
    setIsGeneratingSample(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');

      const stream = canvas.captureStream(20);
      const mimeType = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: 'video/webm' }));
        };
      });

      recorder.start();
      let frame = 0;
      const drawInterval = window.setInterval(() => {
        frame += 1;
        ctx.fillStyle = '#FBF9F5';
        ctx.fillRect(0, 0, 640, 360);
        ctx.strokeStyle = '#E5DFD3';
        ctx.lineWidth = 2;
        ctx.strokeRect(24, 24, 592, 312);

        const radius = 34 + Math.sin(frame / 8) * 10;
        ctx.beginPath();
        ctx.arc(320, 140, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#E8EFE9';
        ctx.fill();
        ctx.strokeStyle = '#4A6B5D';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#2B2D2A';
        ctx.font = '600 20px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText(activityTitle.slice(0, 44), 320, 232);

        ctx.fillStyle = '#656963';
        ctx.font = '14px sans-serif';
        ctx.fillText(
          `Demo Practice Clip · 00:0${Math.min(3, Math.floor(frame / 20))}`,
          320,
          266
        );
        ctx.fillText('Non-sensitive sample clip for LittleSteps workflow preview', 320, 292);
      }, 50);

      await new Promise((r) => window.setTimeout(r, 3000));
      window.clearInterval(drawInterval);
      recorder.stop();
      const blob = await done;
      setPreparedVideo(blob, `demo-sample-${Date.now()}.webm`, 3);
    } catch {
      setError('Could not generate a sample clip in this browser. Please upload a video file instead.');
    } finally {
      setIsGeneratingSample(false);
    }
  };

  const executeUpload = async () => {
    if (!selectedFile) {
      setError('Please record or upload a practice video first.');
      return;
    }
    if (!consentConfirmed) {
      setError('Please confirm your consent checkbox before submitting for review.');
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setUiState('uploading');
    setUploadProgress(5);
    setError(null);

    try {
      const { submission } = await api.uploadSubmissionVideo(
        {
          childId,
          activityId,
          file: selectedFile,
          filename,
          durationSeconds,
          caregiverNotes,
          consentConfirmed,
        },
        (pct) => setUploadProgress(pct),
        controller.signal
      );
      abortControllerRef.current = null;
      setUiState('submitted');
      onSubmitted(submission);
    } catch (err) {
      abortControllerRef.current = null;
      setUiState('failed');
      setError(
        err instanceof Error
          ? err.message
          : 'Upload did not complete. Please check your connection and try again.'
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeUpload();
  };

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const stateBadge = getSubmissionStateBadge(uiState);
  const isUploading = uiState === 'uploading';
  const isDemoMode = !storageStatus || !storageStatus.isProductionConfigured;

  return (
    <Card padding="lg" className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Hidden shared file input for both initial Upload and Replace Video */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Choose a video file from your device"
        />

        {/* Header + Active Submission Status */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={stateBadge.tone} icon={stateBadge.icon}>
                {stateBadge.label}
              </Badge>
              <Badge tone="neutral">
                Activity v{activityVersion} · {childName}
              </Badge>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-charcoal">
              Submit Practice Video for Caregiver Feedback
            </h2>
            <p className="text-sm text-muted leading-relaxed max-w-2xl">
              {stateBadge.description}
            </p>
          </div>

          <Button
            type="button"
            variant="subtle"
            size="sm"
            disabled={isUploading}
            leftIcon={<X className="w-4 h-4" />}
            onClick={onCancel}
          >
            Close
          </Button>
        </div>

        {/* Honest Demo Storage Disclosure Banner when production object storage is not configured */}
        {isDemoMode && (
          <div
            role="note"
            className="rounded-xl border border-peach bg-peach-soft/60 p-4 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-peach-ink shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1 text-xs sm:text-sm">
              <p className="font-semibold text-charcoal">
                Demo Storage Mode Active · Prototype Environment
              </p>
              <p className="text-charcoal/85 leading-relaxed">
                {storageStatus?.warningNotice ||
                  'Production private cloud object storage (GCS/S3) is not configured in this prototype. Clips are isolated outside public folders with short-lived signed links for testing, but please use the 3-second demo test clip or non-sensitive sample videos instead of real personal child recordings.'}
              </p>
            </div>
          </div>
        )}

        {/* Reviewer Changes Requested Note (when resubmitting) */}
        {existingSubmission?.reviewStatus === 'resubmit_requested' &&
          existingSubmission.changeRequestNote && (
            <div className="rounded-xl border border-peach bg-cream p-4 space-y-1">
              <p className="text-xs font-semibold text-peach-ink uppercase tracking-wide">
                Reviewer Note · Changes Requested
              </p>
              <p className="text-sm text-charcoal leading-relaxed">
                {existingSubmission.changeRequestNote}
              </p>
            </div>
          )}

        {/* ================================================================= */}
        {/* STEP A: RECORD OR UPLOAD CHOOSER (NO UNNECESSARY PERMISSIONS)     */}
        {/* ================================================================= */}
        {!isRecording && !previewUrl && (
          <div className="space-y-4">
            {/* Large Recording Button + Upload from Device */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => void startCameraRecording()}
                className={`min-h-[120px] p-6 rounded-xl border-2 text-left flex flex-col justify-between gap-3 transition-colors cursor-pointer ${
                  initialMode === 'record'
                    ? 'border-sage bg-sage-soft/50 hover:bg-sage-soft'
                    : 'border-sage/70 bg-sage-soft/30 hover:bg-sage-soft/60'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="w-11 h-11 rounded-xl bg-sage text-white inline-flex items-center justify-center shrink-0">
                    <Camera className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <Badge tone="sage">Recommended</Badge>
                </div>
                <div className="space-y-0.5">
                  <p className="font-display text-lg font-semibold text-charcoal">
                    Record Activity
                  </p>
                  <p className="text-xs text-muted leading-relaxed">
                    Opens your camera only when you tap here. Keep clips calm and under 2 minutes.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`min-h-[120px] p-6 rounded-xl border text-left flex flex-col justify-between gap-3 transition-colors cursor-pointer ${
                  initialMode === 'upload'
                    ? 'border-sage bg-cream hover:bg-cream/80'
                    : 'border-border-strong bg-offwhite hover:bg-cream'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="w-11 h-11 rounded-xl bg-surface border border-border text-sage inline-flex items-center justify-center shrink-0">
                    <Upload className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-xs text-muted">MP4 · WebM · MOV</span>
                </div>
                <div className="space-y-0.5">
                  <p className="font-display text-lg font-semibold text-charcoal">
                    Upload from Device
                  </p>
                  <p className="text-xs text-muted leading-relaxed">
                    Select a clip you already recorded on your phone or computer.
                  </p>
                </div>
              </button>
            </div>

            {/* Safe Demo Sample Clip Generator + File Size & Format Guidance */}
            <div className="rounded-xl border border-border bg-offwhite p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-muted leading-relaxed">
                <Info className="w-4 h-4 text-sage shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-charcoal">
                    Format & Size Guidance
                  </p>
                  <p>
                    Accepted formats: <strong>MP4, WebM, MOV</strong> · Max file size:{' '}
                    <span className="font-mono tabular-nums">50 MB</span> · Max length:{' '}
                    <span className="font-mono tabular-nums">2 minutes</span>.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={isGeneratingSample}
                leftIcon={<Film className="w-4 h-4" />}
                onClick={() => void recordSampleTestClip()}
                className="shrink-0 self-start sm:self-center"
              >
                {isGeneratingSample ? 'Creating 3s Demo Clip...' : 'Use 3s Demo Test Clip'}
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* LIVE CAMERA RECORDING VIEW                                        */}
        {/* ================================================================= */}
        {isRecording && (
          <div className="space-y-4">
            <div className="aspect-video rounded-xl overflow-hidden bg-charcoal relative border border-border">
              <video
                ref={liveVideoRef}
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-charcoal/85 text-white text-xs font-mono tabular-nums inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-danger animate-pulse" aria-hidden="true" />
                Recording · {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:
                {String(recordSeconds % 60).padStart(2, '0')} / 02:00
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="danger"
                size="lg"
                leftIcon={<Square className="w-4 h-4" />}
                onClick={stopCameraRecording}
              >
                Stop & Preview Recording
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={cancelCameraRecording}
              >
                Cancel Recording
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* VIDEO PREVIEW WITH REPLACE & REMOVE ACTIONS                       */}
        {/* ================================================================= */}
        {previewUrl && !isRecording && (
          <div className="space-y-3">
            <div className="aspect-video rounded-xl overflow-hidden bg-charcoal border border-border">
              <video
                src={previewUrl}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            </div>

            <div className="rounded-xl border border-border bg-offwhite px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted min-w-0">
                <Video className="w-4 h-4 text-sage shrink-0" aria-hidden="true" />
                <span className="font-medium text-charcoal truncate">{filename}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{durationSeconds}s</span>
                {selectedFile && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isUploading}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Replace Video
                </Button>
                <Button
                  type="button"
                  variant="subtle"
                  size="sm"
                  disabled={isUploading}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={handleRemoveVideo}
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* OPTIONAL CAREGIVER NOTES                                          */}
        {/* ================================================================= */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="caregiver-video-note" className="block text-sm font-medium text-charcoal">
              Optional note for your reviewer
            </label>
            <span className="font-mono text-[11px] text-muted tabular-nums">
              {caregiverNotes.length}/600
            </span>
          </div>
          <textarea
            id="caregiver-video-note"
            rows={2}
            maxLength={600}
            disabled={isUploading}
            value={caregiverNotes}
            onChange={(e) => setCaregiverNotes(e.target.value)}
            placeholder="Example: Morning session after feeding, used a soft cotton cloth and smooth wooden spoon."
            className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-charcoal placeholder:text-muted/70 focus:border-sage disabled:opacity-60"
          />
        </div>

        {/* ================================================================= */}
        {/* EXPLICIT PRIVACY & CONSENT CHECKBOX                               */}
        {/* ================================================================= */}
        <div className="rounded-xl border border-border bg-cream/80 p-4 space-y-3">
          <div className="flex items-start gap-2.5 text-xs text-muted leading-relaxed">
            <Shield className="w-4 h-4 text-sage shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold text-charcoal">
                Private Access · Short-Lived Signed Links · 30-Day Auto-Deletion · Delete Anytime
              </p>
              <p>
                Videos are never publicly accessible. Only you and authorized reviewers can view
                your clip via short-lived signed URLs, and reviewers evaluate caregiver instruction
                steps only—never your baby’s development or health. A timestamped consent record is
                linked directly to your submission.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-3 text-sm text-charcoal cursor-pointer min-h-[44px] pt-1">
            <input
              type="checkbox"
              disabled={isUploading}
              checked={consentConfirmed}
              onChange={(e) => setConsentConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border-strong accent-sage shrink-0"
            />
            <span className="leading-relaxed">
              I consent to storing this video clip for caregiver activity coaching under the 30-day
              auto-deletion policy{isDemoMode ? ' (acknowledging Demo Storage Mode is currently active)' : ''}.
            </span>
          </label>
        </div>

        {/* ================================================================= */}
        {/* UPLOAD PROGRESS BAR + CANCEL UPLOAD                               */}
        {/* ================================================================= */}
        {isUploading && (
          <div className="rounded-xl border border-peach bg-peach-soft/40 p-4 space-y-3">
            <ProgressIndicator
              value={uploadProgress}
              max={100}
              label="Uploading practice clip..."
              sublabel={`${uploadProgress}%`}
              tone="sage"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCancelUpload}
              >
                Cancel Upload
              </Button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* CLEAR ERROR / FAILED STATE WITH RETRY ACTION                      */}
        {/* ================================================================= */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-danger/40 bg-danger-soft/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-danger flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
            {uiState === 'failed' && selectedFile && consentConfirmed && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => void executeUpload()}
              >
                Retry Upload
              </Button>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* FORM FOOTER ACTIONS                                               */}
        {/* ================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
          <p className="text-xs text-muted">
            {selectedFile
              ? consentConfirmed
                ? 'Ready to submit for caregiver coaching.'
                : 'Tick the consent box above to enable submission.'
              : 'Record or choose a video clip to continue.'}
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="secondary"
              disabled={isUploading}
              onClick={onCancel}
            >
              Cancel
            </Button>

            {uiState === 'failed' && selectedFile && consentConfirmed ? (
              <Button
                type="button"
                variant="primary"
                leftIcon={<RotateCcw className="w-4 h-4" />}
                onClick={() => void executeUpload()}
              >
                Retry Upload
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                loading={isUploading}
                disabled={isUploading || isRecording || !selectedFile || !consentConfirmed}
                leftIcon={<UploadCloud className="w-4 h-4" />}
              >
                {isUploading ? 'Uploading...' : 'Submit for Review'}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Card>
  );
}
