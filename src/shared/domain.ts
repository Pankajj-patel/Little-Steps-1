import type { RubricAchievementLevel } from './types';

export const RETENTION_DAYS = 30;
export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_VIDEO_DURATION_SECONDS = 120; // 2 minutes
export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

export const EDITORIAL_IMAGES = {
  heroMontessori: '/src/assets/images/hero_montessori_play_1795191199446.jpg',
  sensoryLinen: '/src/assets/images/activity_sensory_linen_1795191186954.jpg',
  tummyMirror: '/src/assets/images/activity_tummy_mirror_1795191186302.jpg',
  everydayCup: '/src/assets/images/activity_everyday_cup_1795191187309.jpg',
} as const;

export const CANONICAL_AGE_GROUPS = [
  { slug: '0-3m', label: '0–3 months', minMonths: 0, maxMonths: 3, sortOrder: 1 },
  { slug: '3-6m', label: '3–6 months', minMonths: 3, maxMonths: 6, sortOrder: 2 },
  { slug: '6-9m', label: '6–9 months', minMonths: 6, maxMonths: 9, sortOrder: 3 },
  { slug: '9-12m', label: '9–12 months', minMonths: 9, maxMonths: 12, sortOrder: 4 },
  { slug: '12-15m', label: '12–15 months', minMonths: 12, maxMonths: 15, sortOrder: 5 },
  { slug: '15-18m', label: '15–18 months', minMonths: 15, maxMonths: 18, sortOrder: 6 },
  { slug: '18-21m', label: '18–21 months', minMonths: 18, maxMonths: 21, sortOrder: 7 },
  { slug: '21-24m', label: '21–24 months', minMonths: 21, maxMonths: 24, sortOrder: 8 },
] as const;

export const CANONICAL_LEARNING_DOMAINS = [
  {
    slug: 'cognitive',
    name: 'Cognitive development',
    description: 'Curiosity, cause-and-effect, memory, and gentle early problem solving.',
    sortOrder: 1,
  },
  {
    slug: 'language',
    name: 'Language and communication',
    description: 'Warm conversation, turn-taking sounds, listening, and naming everyday objects.',
    sortOrder: 2,
  },
  {
    slug: 'physical',
    name: 'Physical development',
    description: 'Floor movement, balance, reaching, grasping, and hand-eye coordination.',
    sortOrder: 3,
  },
  {
    slug: 'social-emotional',
    name: 'Social and emotional development',
    description: 'Attachment, soothing routines, eye contact, and responsive caregiver bonding.',
    sortOrder: 4,
  },
  {
    slug: 'sensory',
    name: 'Sensory development',
    description: 'Safe everyday exploration of textures, gentle sounds, light, and natural materials.',
    sortOrder: 5,
  },
  {
    slug: 'early-independence',
    name: 'Early independence and everyday skills',
    description: 'Participating calmly in dressing, open-cup drinking, feeding, and tidying up.',
    sortOrder: 6,
  },
] as const;

/**
 * Calculates age in whole completed months (clamped between 0 and 24 for LittleSteps mapping).
 */
export function calculateAgeInMonths(dateOfBirthIso: string, referenceDate = new Date()): number {
  const dob = new Date(dateOfBirthIso);
  if (Number.isNaN(dob.getTime())) {
    return 0;
  }
  let months =
    (referenceDate.getFullYear() - dob.getFullYear()) * 12 +
    (referenceDate.getMonth() - dob.getMonth());
  if (referenceDate.getDate() < dob.getDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

/**
 * Resolves the canonical 3-month age-group slug for a child's age in months.
 */
export function resolveAgeGroupSlug(ageInMonths: number): string {
  const clamped = Math.max(0, Math.min(23.99, ageInMonths));
  const match = CANONICAL_AGE_GROUPS.find(
    (g) => clamped >= g.minMonths && clamped < g.maxMonths
  );
  return match ? match.slug : '21-24m';
}

export function getRubricMultiplier(level: RubricAchievementLevel): number | null {
  switch (level) {
    case 'met':
      return 1;
    case 'partially_met':
      return 0.5;
    case 'not_met':
    case 'not_observed':
      return 0;
    case 'not_assessable':
      return null;
  }
}

/**
 * Computes the caregiver instruction-match percentage (0–100) from weighted criteria:
 *   Instruction Match Percentage = (Weighted points earned / Applicable weighted points) × 100
 * Criteria marked 'not_assessable' are excluded from applicable weighted points.
 * If applicable weight is 0 or less than 50% of total rubric weight (insufficient evidence),
 * returns isAssessable=false and scorePct=null ("Not Assessable") rather than a misleading percentage.
 * Explicitly evaluates caregiver instruction execution only — never baby development.
 */
export function calculateInstructionMatchScore(
  items: Array<{ weightPoints: number; achievedLevel: RubricAchievementLevel }>
): {
  isAssessable: boolean;
  scorePct: number | null;
  earnedTotal: number;
  applicableTotal: number;
  maxTotal: number;
  excludedCount: number;
} {
  const maxTotal = items.reduce((sum, item) => sum + item.weightPoints, 0);
  if (maxTotal <= 0) {
    return {
      isAssessable: false,
      scorePct: null,
      earnedTotal: 0,
      applicableTotal: 0,
      maxTotal: 0,
      excludedCount: 0,
    };
  }

  let earnedTotal = 0;
  let applicableTotal = 0;
  let excludedCount = 0;

  for (const item of items) {
    const mult = getRubricMultiplier(item.achievedLevel);
    if (mult === null) {
      excludedCount += 1;
      continue;
    }
    applicableTotal += item.weightPoints;
    earnedTotal += item.weightPoints * mult;
  }

  // Require at least 50% of rubric weight to be assessable to avoid misleading percentages
  if (applicableTotal <= 0 || applicableTotal < maxTotal * 0.5) {
    return {
      isAssessable: false,
      scorePct: null,
      earnedTotal,
      applicableTotal,
      maxTotal,
      excludedCount,
    };
  }

  const scorePct = Math.round((earnedTotal / applicableTotal) * 100);
  return {
    isAssessable: true,
    scorePct,
    earnedTotal,
    applicableTotal,
    maxTotal,
    excludedCount,
  };
}

export function formatDaysUntilExpiry(expiresAtIso: string): number {
  const diffMs = new Date(expiresAtIso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}
