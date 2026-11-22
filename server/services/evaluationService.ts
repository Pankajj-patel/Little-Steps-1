import {
  calculateInstructionMatchScore,
  getRubricMultiplier,
} from '../../src/shared/domain.ts';
import type {
  ActivityRubricCriterion,
  RubricAchievementLevel,
} from '../../src/shared/types.ts';

export const VALID_ACHIEVEMENT_LEVELS: ReadonlySet<RubricAchievementLevel> = new Set([
  'met',
  'partially_met',
  'not_met',
  'not_observed',
  'not_assessable',
]);

export interface CriterionRatingInput {
  criterionId: string;
  achievedLevel: RubricAchievementLevel;
  explanation?: string | null;
}

export interface ComputedCriterionScore {
  criterionId: string;
  achievedLevel: RubricAchievementLevel;
  earnedPoints: number;
  maxPoints: number;
  explanation: string | null;
}

export interface EvaluationInput {
  reviewerUserId: string;
  mode: 'draft' | 'publish' | 'not_assessable';
  criteria: ActivityRubricCriterion[];
  criterionRatings: CriterionRatingInput[];
  strengthsNote?: string;
  coachingTip?: string;
  reviewerComments?: string | null;
  notAssessableReason?: string | null;
}

export interface EvaluationResult {
  computedScores: ComputedCriterionScore[];
  isAssessable: boolean;
  scorePct: number | null;
  earnedTotal: number;
  applicableTotal: number;
  maxTotal: number;
  excludedCount: number;
  notAssessableReason: string | null;
  strengthsNote: string;
  coachingTip: string;
  reviewerComments: string | null;
}

/**
 * Authoritative server-side caregiver rubric evaluation service.
 *
 * Weighted scoring model (Caregiver Instruction Execution Only — never baby development):
 *   - Met = 1.0
 *   - Partially Met = 0.5
 *   - Not Met / Not Observed = 0.0
 *   - Not Assessable = excluded from applicable denominator
 *
 * Instruction Match Percentage = (Weighted points earned / Applicable weighted points) × 100
 * If applicable weight is 0 or < 50% of total rubric weight, returns isAssessable=false and scorePct=null.
 */
export function evaluateCaregiverRubric(input: EvaluationInput): EvaluationResult {
  if (!input.reviewerUserId || !input.reviewerUserId.trim()) {
    throw new Error('Authorized reviewer identity is required to record an evaluation.');
  }

  if (!Array.isArray(input.criteria) || input.criteria.length === 0) {
    throw new Error('Activity has no rubric criteria configured.');
  }

  const validCriterionIds = new Set(input.criteria.map((c) => c.id));
  const ratingById = new Map<string, CriterionRatingInput>();

  for (const r of input.criterionRatings) {
    if (!VALID_ACHIEVEMENT_LEVELS.has(r.achievedLevel)) {
      throw new Error(`Invalid rubric rating value: ${String(r.achievedLevel)}`);
    }
    if (!validCriterionIds.has(r.criterionId)) {
      if (input.mode === 'publish') {
        throw new Error(`Unknown rubric criterion ID: ${r.criterionId}`);
      }
      continue;
    }
    if (ratingById.has(r.criterionId)) {
      throw new Error('Duplicate rating submitted for the same rubric criterion.');
    }
    ratingById.set(r.criterionId, r);
  }

  const computedScores: ComputedCriterionScore[] = input.criteria.map((criterion) => {
    const match = ratingById.get(criterion.id);
    if (!match && input.mode === 'publish') {
      throw new Error(`Missing rubric rating for "${criterion.label}"`);
    }

    const level: RubricAchievementLevel =
      input.mode === 'not_assessable'
        ? 'not_assessable'
        : match?.achievedLevel ?? 'not_assessable';
    const trimmedExplanation = match?.explanation?.trim() || null;

    if (input.mode === 'publish' && level === 'not_assessable' && !trimmedExplanation) {
      throw new Error(
        `Please explain why "${criterion.label}" could not be assessed from the video.`
      );
    }

    const mult = getRubricMultiplier(level);
    const earned = mult === null ? 0 : criterion.weightPoints * mult;

    return {
      criterionId: criterion.id,
      achievedLevel: level,
      earnedPoints: earned,
      maxPoints: criterion.weightPoints,
      explanation:
        trimmedExplanation ||
        (input.mode === 'not_assessable' ? input.notAssessableReason?.trim() || null : null),
    };
  });

  const calc = calculateInstructionMatchScore(
    computedScores.map((s) => ({
      weightPoints: s.maxPoints,
      achievedLevel: s.achievedLevel,
    }))
  );

  const isAssessable = input.mode !== 'not_assessable' && calc.isAssessable;
  const scorePct = isAssessable ? calc.scorePct : null;

  let finalNotAssessableReason: string | null = null;
  if (!isAssessable) {
    const explicitReason = input.notAssessableReason?.trim() || '';
    const criterionReasons = computedScores
      .filter((s) => s.achievedLevel === 'not_assessable' && s.explanation)
      .map((s) => s.explanation)
      .join(' · ');
    finalNotAssessableReason =
      explicitReason ||
      criterionReasons ||
      'Insufficient visual or audio evidence in the video to calculate a fair instruction-match score.';
  }

  const strengthsNote =
    input.strengthsNote?.trim() ||
    (input.mode === 'not_assessable'
      ? 'Thank you for sharing your practice clip with LittleSteps.'
      : '');
  const coachingTip =
    input.coachingTip?.trim() ||
    (input.mode === 'not_assessable'
      ? 'When convenient, share a clip where the setup and activity steps are clearly visible in good lighting.'
      : '');

  return {
    computedScores,
    isAssessable,
    scorePct,
    earnedTotal: calc.earnedTotal,
    applicableTotal: calc.applicableTotal,
    maxTotal: calc.maxTotal,
    excludedCount: calc.excludedCount,
    notAssessableReason: finalNotAssessableReason,
    strengthsNote,
    coachingTip,
    reviewerComments: input.reviewerComments?.trim() || null,
  };
}
