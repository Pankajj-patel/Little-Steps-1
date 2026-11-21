export interface ColorTokenSpec {
  name: string;
  role: string;
  hex: string;
  cssVar: string;
  swatchClass: string;
  contrastNote: string;
}

export const COLOR_TOKENS: ColorTokenSpec[] = [
  {
    name: 'Soft Sage Green',
    role: 'Primary',
    hex: '#446E5A',
    cssVar: '--color-sage',
    swatchClass: 'bg-sage',
    contrastNote: '5.7:1 with white text (AA)',
  },
  {
    name: 'Warm Cream',
    role: 'Secondary',
    hex: '#F6F1E7',
    cssVar: '--color-cream',
    swatchClass: 'bg-cream',
    contrastNote: 'Subtle section & control surface',
  },
  {
    name: 'Off-White',
    role: 'Background',
    hex: '#FAF9F6',
    cssVar: '--color-offwhite',
    swatchClass: 'bg-offwhite',
    contrastNote: 'Calm page canvas',
  },
  {
    name: 'Pure White',
    role: 'Cards',
    hex: '#FFFFFF',
    cssVar: '--color-surface',
    swatchClass: 'bg-surface',
    contrastNote: 'Primary card & dialog surface',
  },
  {
    name: 'Muted Peach',
    role: 'Accent',
    hex: '#E8B99B',
    cssVar: '--color-peach',
    swatchClass: 'bg-peach',
    contrastNote: 'Paired with #844825 text (AA)',
  },
  {
    name: 'Soft Lavender',
    role: 'Highlight',
    hex: '#D6CEE9',
    cssVar: '--color-lavender',
    swatchClass: 'bg-lavender',
    contrastNote: 'Paired with #4F4278 text (AA)',
  },
  {
    name: 'Dark Charcoal',
    role: 'Primary Text',
    hex: '#222624',
    cssVar: '--color-charcoal',
    swatchClass: 'bg-charcoal',
    contrastNote: '14.5:1 on off-white (AAA)',
  },
  {
    name: 'Muted Grey',
    role: 'Secondary Text',
    hex: '#5C635E',
    cssVar: '--color-muted',
    swatchClass: 'bg-muted',
    contrastNote: '5.8:1 on off-white (AA)',
  },
];

export const TYPOGRAPHY_SCALE = [
  {
    id: 'page-heading',
    name: 'Page Heading',
    font: 'Nunito SemiBold',
    size: '28px–36px / 1.18',
    className: 'font-display text-3xl sm:text-4xl font-semibold text-charcoal leading-tight',
    sample: 'Today’s calm moments with Aarav',
  },
  {
    id: 'section-heading',
    name: 'Section Heading',
    font: 'Nunito SemiBold',
    size: '20px–24px / 1.28',
    className: 'font-display text-xl sm:text-2xl font-semibold text-charcoal leading-snug',
    sample: 'Everyday Household Textures',
  },
  {
    id: 'body-text',
    name: 'Body Text',
    font: 'Plus Jakarta Sans Regular',
    size: '15px–16px / 1.65',
    className: 'font-sans text-base text-charcoal leading-relaxed',
    sample:
      'Place two or three safe everyday objects on a cotton mat and sit quietly beside your baby while naming each texture softly.',
  },
  {
    id: 'supporting-text',
    name: 'Supporting Text',
    font: 'Plus Jakarta Sans Regular',
    size: '14px / 1.55',
    className: 'font-sans text-sm text-muted leading-relaxed',
    sample: 'Short, unhurried sessions work best when your baby is rested and fed.',
  },
  {
    id: 'button-text',
    name: 'Button Text',
    font: 'Plus Jakarta Sans Medium',
    size: '14px / 1.2',
    className: 'font-sans text-sm font-medium text-charcoal tracking-tight',
    sample: 'Open Activity Guide',
  },
  {
    id: 'form-label',
    name: 'Form Label',
    font: 'Plus Jakarta Sans SemiBold',
    size: '13px–14px / 1.3',
    className: 'font-sans text-sm font-medium text-charcoal',
    sample: 'Baby’s Date of Birth',
  },
  {
    id: 'small-metadata',
    name: 'Small Metadata',
    font: 'Plus Jakarta Sans / IBM Plex Mono',
    size: '12px / 1.4',
    className: 'font-sans text-xs text-muted tabular-nums',
    sample: 'Sensory development · 6–9 months · 5 min',
  },
] as const;

export const LAYOUT_TOKENS = {
  maxContentWidth: '1200px (max-w-6xl)',
  sidebarWidth: '256px (w-64)',
  minTouchTarget: '44px × 44px',
  mobileMinViewport: '320px',
  cardRadius: '14px (rounded-xl)',
  controlRadius: '10px (rounded-lg)',
} as const;
