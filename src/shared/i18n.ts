import type { LocaleCode } from './types';

const EN_MESSAGES = {
  'brand.name': 'LittleSteps',
  'brand.tagline': 'Calm, age-appropriate daily moments from birth to 24 months.',
  'nav.today': 'Today',
  'nav.progress': 'Progress',
  'nav.feedback': 'Feedback',
  'nav.queue': 'Review Queue',
  'nav.curriculum': 'Curriculum',
  'nav.plans': 'Daily Plans',
  'nav.users': 'People',
  'nav.privacy': 'Privacy & Audit',
  'auth.signIn': 'Sign In',
  'auth.createAccount': 'Create Account',
  'auth.signOut': 'Sign Out',
  'policy.nonDiagnosticTitle': 'Caregiver Execution Feedback Only',
  'policy.nonDiagnosticBody':
    'Instruction-match scores measure how closely the activity steps were demonstrated by the caregiver—never your baby’s intelligence, developmental level, or health.',
  'privacy.videoRetentionShort': 'Private · Auto-deletes in 30 days · Delete anytime',
  'privacy.videoDeletedPreserved':
    'Video permanently deleted from our private vault. Your written coaching feedback remains saved.',
} as const;

export type TranslationKey = keyof typeof EN_MESSAGES;

// Structured catalog ready for Hindi ('hi') and regional Indian language packs.
const CATALOGS: Record<LocaleCode, Partial<Record<TranslationKey, string>>> = {
  en: EN_MESSAGES,
  hi: {
    'brand.name': 'LittleSteps',
  },
};

export function translate(locale: LocaleCode, key: TranslationKey): string {
  return CATALOGS[locale]?.[key] ?? EN_MESSAGES[key];
}

export function formatDateReadable(isoString: string, locale: LocaleCode = 'en'): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const tag = locale === 'hi' ? 'hi-IN' : 'en-IN';
  return new Intl.DateTimeFormat(tag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTimeReadable(isoString: string, locale: LocaleCode = 'en'): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const tag = locale === 'hi' ? 'hi-IN' : 'en-IN';
  return new Intl.DateTimeFormat(tag, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
