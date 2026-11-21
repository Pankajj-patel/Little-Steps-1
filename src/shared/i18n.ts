import type { ActivityPrepLevel, LocaleCode } from './types';

const EN_MESSAGES = {
  'brand.name': 'LittleSteps',
  'brand.tagline': 'Calm, age-appropriate daily moments from birth to 24 months.',
  'nav.today': 'Today',
  'nav.myPlan': 'My Plan',
  'nav.activities': 'Activities',
  'nav.progress': 'Progress',
  'nav.feedback': 'Feedback',
  'nav.guides': 'Parenting Guides',
  'nav.notifications': 'Notifications',
  'nav.profile': 'Profile',
  'nav.settings': 'Settings',
  'nav.dailyJourney': 'Daily Journey',
  'nav.more': 'More',
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
  'dashboard.readySubtitle': 'Ready for today’s little moments?',
  'dashboard.todaysJourney': 'Today’s Learning Journey',
  'dashboard.continueJourney': 'Continue Today’s Journey',
  'dashboard.todaysActivities': 'Today’s Activities',
  'dashboard.viewFullPlan': 'View Full Plan',
  'dashboard.weeklyProgress': 'Weekly Progress',
  'dashboard.weeklyProgressDesc': 'Completed activities across the last 7 days',
  'dashboard.continueLearning': 'Continue Learning',
  'dashboard.pickUpWhereLeft': 'Pick up where you left off',
  'dashboard.resumeActivity': 'Resume Activity',
  'dashboard.revisitActivity': 'Revisit Activity',
  'dashboard.startFirstActivity': 'Start First Activity',
  'dashboard.developmentAreas': 'Development Areas',
  'dashboard.developmentAreasDesc': 'Balanced growth across all six early-childhood areas.',
  'dashboard.detailedProgress': 'Detailed Progress',
  'dashboard.todaysTip': 'Today’s Parenting Tip',
  'dashboard.moreGuides': 'More Guides',
  'dashboard.dailyCompletion': 'Daily completion',
  'dashboard.tryAgain': 'Try Again',
  'studio.backToDashboard': 'Back to Dashboard',
  'studio.everydayItems': 'Everyday Items Needed',
  'studio.safetyReminder': 'Calm Safety Reminder',
  'studio.stepByStep': 'Step-by-Step Guide',
  'studio.gentleCue': 'Gentle cue',
  'studio.finishTitle': 'Finish Activity or Share a Video for Caregiver Feedback',
  'studio.reflectionLabel': 'Short reflection note (Optional)',
  'studio.reflectionPlaceholder': 'How did the pace feel for you and your baby today?',
  'studio.markCompleted': 'Mark Activity Completed',
  'studio.updateNote': 'Update Journal Note',
  'studio.recordActivity': 'Record Activity',
  'studio.uploadVideo': 'Upload Video',
  'studio.viewFeedback': 'View in Progress & Feedback',
  'studio.deleteVideoNow': 'Delete Video Now',
  'player.guidedDemo': 'Guided Demonstration',
  'player.stepOf': 'Step',
  'player.of': 'of',
  'player.playing': 'Playing pace guide',
  'player.paused': 'Paused',
  'player.playGuide': 'Play Step Guide',
  'player.pauseGuide': 'Pause Guide',
  'status.notStarted': 'Not started',
  'status.inProgress': 'In progress',
  'status.completed': 'Completed',
  'status.submittedForReview': 'Submitted for review',
  'status.reviewed': 'Reviewed',
  'action.startActivity': 'Start Activity',
  'action.resumeActivity': 'Resume Activity',
  'action.viewActivity': 'View Activity',
  'action.viewSubmission': 'View Submission',
  'action.readFeedback': 'Read Feedback',
  'common.back': 'Back',
  'common.saveContinue': 'Save & Continue',
  'common.optional': 'Optional',
  'common.min': 'min',
  'common.months': 'months',
  'common.month': 'month',
  'common.day': 'Day',
} as const;

export type TranslationKey = keyof typeof EN_MESSAGES;

const HI_MESSAGES: Record<TranslationKey, string> = {
  'brand.name': 'LittleSteps',
  'brand.tagline': 'जन्म से 24 महीने तक के शिशुओं के लिए शांत और उम्र के अनुकूल दैनिक गतिविधियाँ।',
  'nav.today': 'आज',
  'nav.myPlan': 'मेरी योजना',
  'nav.activities': 'गतिविधियाँ',
  'nav.progress': 'प्रगति',
  'nav.feedback': 'सुझाव',
  'nav.guides': 'पेरेंटिंग गाइड',
  'nav.notifications': 'सूचनाएँ',
  'nav.profile': 'प्रोफ़ाइल',
  'nav.settings': 'सेटिंग्स',
  'nav.dailyJourney': 'दैनिक यात्रा',
  'nav.more': 'अधिक',
  'nav.queue': 'समीक्षा कतार',
  'nav.curriculum': 'पाठ्यक्रम',
  'nav.plans': 'दैनिक योजनाएँ',
  'nav.users': 'उपयोगकर्ता',
  'nav.privacy': 'गोपनीयता और ऑडिट',
  'auth.signIn': 'साइन इन करें',
  'auth.createAccount': 'खाता बनाएँ',
  'auth.signOut': 'साइन आउट',
  'policy.nonDiagnosticTitle': 'केवल देखभालकर्ता अभ्यास पर मार्गदर्शन',
  'policy.nonDiagnosticBody':
    'निर्देश-मिलान स्कोर केवल यह मापता है कि देखभालकर्ता ने गतिविधि के चरणों को कितनी स्पष्टता से दिखाया—यह कभी आपके शिशु की बुद्धि, विकास स्तर या स्वास्थ्य का मूल्यांकन नहीं करता।',
  'privacy.videoRetentionShort': 'निजी · 30 दिनों में स्वतः हट जाएगा · कभी भी हटाएँ',
  'privacy.videoDeletedPreserved':
    'वीडियो हमारे निजी वॉल्ट से स्थायी रूप से हटा दिया गया है। आपके लिखित मार्गदर्शन सुझाव सुरक्षित रहेंगे।',
  'dashboard.readySubtitle': 'आज के शांत और प्यारे पलों के लिए तैयार हैं?',
  'dashboard.todaysJourney': 'आज की सीखने की यात्रा',
  'dashboard.continueJourney': 'आज की यात्रा शुरू करें',
  'dashboard.todaysActivities': 'आज की गतिविधियाँ',
  'dashboard.viewFullPlan': 'पूरी योजना देखें',
  'dashboard.weeklyProgress': 'साप्ताहिक प्रगति',
  'dashboard.weeklyProgressDesc': 'पिछले 7 दिनों में पूरी की गई गतिविधियाँ',
  'dashboard.continueLearning': 'सीखना जारी रखें',
  'dashboard.pickUpWhereLeft': 'जहाँ छोड़ा था, वहीं से आगे बढ़ें',
  'dashboard.resumeActivity': 'गतिविधि जारी रखें',
  'dashboard.revisitActivity': 'गतिविधि फिर से देखें',
  'dashboard.startFirstActivity': 'पहली गतिविधि शुरू करें',
  'dashboard.developmentAreas': 'विकास के क्षेत्र',
  'dashboard.developmentAreasDesc': 'प्रारंभिक बचपन के सभी छह क्षेत्रों में संतुलित विकास।',
  'dashboard.detailedProgress': 'विस्तृत प्रगति',
  'dashboard.todaysTip': 'आज का पेरेंटिंग सुझाव',
  'dashboard.moreGuides': 'और गाइड देखें',
  'dashboard.dailyCompletion': 'दैनिक पूर्णता',
  'dashboard.tryAgain': 'फिर से प्रयास करें',
  'studio.backToDashboard': 'डैशबोर्ड पर वापस जाएँ',
  'studio.everydayItems': 'आवश्यक घरेलू सामग्री',
  'studio.safetyReminder': 'सुरक्षा के लिए शांत याददिहानी',
  'studio.stepByStep': 'चरण-दर-चरण निर्देश',
  'studio.gentleCue': 'प्यारा सुझाव',
  'studio.finishTitle': 'गतिविधि पूरी करें या मार्गदर्शन के लिए वीडियो साझा करें',
  'studio.reflectionLabel': 'संक्षिप्त अनुभव नोट (वैकल्पिक)',
  'studio.reflectionPlaceholder': 'आज आपको और आपके शिशु को यह गतिविधि कैसी लगी?',
  'studio.markCompleted': 'गतिविधि पूर्ण चिह्नित करें',
  'studio.updateNote': 'डायरी नोट अपडेट करें',
  'studio.recordActivity': 'गतिविधि रिकॉर्ड करें',
  'studio.uploadVideo': 'वीडियो अपलोड करें',
  'studio.viewFeedback': 'प्रगति और सुझाव देखें',
  'studio.deleteVideoNow': 'वीडियो अभी हटाएँ',
  'player.guidedDemo': 'चरण-दर-चरण प्रदर्शन',
  'player.stepOf': 'चरण',
  'player.of': 'में से',
  'player.playing': 'मार्गदर्शिका चल रही है',
  'player.paused': 'रुका हुआ',
  'player.playGuide': 'चरण गाइड चलाएँ',
  'player.pauseGuide': 'गाइड रोकें',
  'status.notStarted': 'शुरू नहीं हुई',
  'status.inProgress': 'जारी है',
  'status.completed': 'पूर्ण',
  'status.submittedForReview': 'समीक्षा हेतु भेजा गया',
  'status.reviewed': 'समीक्षित',
  'action.startActivity': 'गतिविधि शुरू करें',
  'action.resumeActivity': 'गतिविधि जारी रखें',
  'action.viewActivity': 'गतिविधि देखें',
  'action.viewSubmission': 'सबमिशन देखें',
  'action.readFeedback': 'सुझाव पढ़ें',
  'common.back': 'पीछे जाएँ',
  'common.saveContinue': 'सहेजें और आगे बढ़ें',
  'common.optional': 'वैकल्पिक',
  'common.min': 'मिनट',
  'common.months': 'महीने',
  'common.month': 'महीना',
  'common.day': 'दिन',
};

const CATALOGS: Record<LocaleCode, Record<TranslationKey, string>> = {
  en: EN_MESSAGES,
  hi: HI_MESSAGES,
};

export function translate(locale: LocaleCode, key: TranslationKey): string {
  return CATALOGS[locale]?.[key] ?? EN_MESSAGES[key];
}

export function getTimeOfDayGreeting(locale: LocaleCode = 'en'): string {
  const hour = new Date().getHours();
  if (locale === 'hi') {
    if (hour < 12) return 'सुप्रभात';
    if (hour < 17) return 'नमस्कार';
    return 'शुभ संध्या';
  }
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const DOMAIN_HI_BY_SLUG: Record<string, string> = {
  cognitive: 'बौद्धिक विकास',
  language: 'भाषा और संवाद',
  physical: 'शारीरिक और गतिशीलता विकास',
  'social-emotional': 'सामाजिक और भावनात्मक जुड़ाव',
  sensory: 'संवेदी अनुभव (स्पर्श व ध्वनि)',
  'early-independence': 'प्रारंभिक आत्मनिर्भरता',
};

const DOMAIN_HI_BY_NAME: Record<string, string> = {
  'Cognitive Development': 'बौद्धिक विकास',
  'Language & Communication': 'भाषा और संवाद',
  'Physical & Motor Development': 'शारीरिक और गतिशीलता विकास',
  'Social & Emotional': 'सामाजिक और भावनात्मक जुड़ाव',
  'Sensory Exploration': 'संवेदी अनुभव (स्पर्श व ध्वनि)',
  'Early Independence': 'प्रारंभिक आत्मनिर्भरता',
};

const DOMAIN_GUIDE_HI_BY_SLUG: Record<string, string> = {
  cognitive: 'लुका-छिपी, वस्तुओं को पकड़ना और सरल मिलान जैसे जिज्ञासा बढ़ाने वाले खेल।',
  language: 'आमने-सामने गुनगुनाना, रोज़मर्रा की घरेलू चीज़ों के नाम बताना और प्यारी लोरियाँ।',
  physical: 'सुरक्षित चटाई पर खेलना, टमी टाइम, हाथ बढ़ाना, करवट लेना और संतुलन बनाना।',
  'social-emotional': 'प्यार भरा आँखों का संपर्क, शांत दिनचर्या, भरोसा और आत्मीय जुड़ाव।',
  sensory: 'घर की सुरक्षित बनावटें—सूती मलमल, चिकनी लकड़ी और कोमल ध्वनियों का अनुभव।',
  'early-independence': 'दो हाथों से खुले कप से पानी पीना और साथ मिलकर सामान समेटना जैसी छोटी आदतें।',
};

export function localizeDomainName(
  slugOrName: string,
  fallback: string,
  locale: LocaleCode = 'en'
): string {
  if (locale !== 'hi') return fallback;
  return DOMAIN_HI_BY_SLUG[slugOrName] ?? DOMAIN_HI_BY_NAME[fallback] ?? fallback;
}

export function localizeDomainGuide(
  slug: string,
  fallback: string,
  locale: LocaleCode = 'en'
): string {
  if (locale !== 'hi') return fallback;
  return DOMAIN_GUIDE_HI_BY_SLUG[slug] ?? fallback;
}

const AGE_GROUP_HI_BY_SLUG: Record<string, string> = {
  '0-3m': '0–3 महीने',
  '3-6m': '3–6 महीने',
  '6-9m': '6–9 महीने',
  '9-12m': '9–12 महीने',
  '12-15m': '12–15 महीने',
  '15-18m': '15–18 महीने',
  '18-21m': '18–21 महीने',
  '21-24m': '21–24 महीने',
};

export function localizeAgeGroupLabel(
  slugOrLabel: string,
  fallback: string,
  locale: LocaleCode = 'en'
): string {
  if (locale !== 'hi') return fallback;
  if (AGE_GROUP_HI_BY_SLUG[slugOrLabel]) return AGE_GROUP_HI_BY_SLUG[slugOrLabel];
  return fallback.replace(/\bmonths\b/gi, 'महीने').replace(/\bmonth\b/gi, 'महीना');
}

export function localizePrepLevel(
  prepLevel?: ActivityPrepLevel,
  locale: LocaleCode = 'en'
): string {
  if (locale === 'hi') {
    switch (prepLevel) {
      case 'no_prep':
        return 'बिना तैयारी';
      case 'guided_prep':
        return 'सरल तैयारी';
      case 'quick_setup':
      default:
        return '2-मिनट सेटअप';
    }
  }
  switch (prepLevel) {
    case 'no_prep':
      return 'No prep';
    case 'guided_prep':
      return 'Guided setup';
    case 'quick_setup':
    default:
      return '2-min setup';
  }
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
