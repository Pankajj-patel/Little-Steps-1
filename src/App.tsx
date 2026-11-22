import React, { Suspense, lazy } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PublicLayout } from './components/PublicLayout';
import { TopBar, type TopBarNavItem } from './components/TopBar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './design-system';
import { usePublicRouter, type NavigateTarget, type PublicRoute } from './lib/router';
import { HomePage } from './pages/public/HomePage';

// Lazy-loaded workspaces & secondary pages for fast initial paint and zero landing CLS
const ParentDashboardView = lazy(() =>
  import('./pages/ParentDashboardView').then((m) => ({ default: m.ParentDashboardView }))
);
const AdminConsoleView = lazy(() =>
  import('./pages/AdminConsoleView').then((m) => ({ default: m.AdminConsoleView }))
);
const DesignSystemShowcasePage = lazy(() =>
  import('./pages/DesignSystemShowcasePage').then((m) => ({
    default: m.DesignSystemShowcasePage,
  }))
);
const ParentOnboardingView = lazy(() =>
  import('./pages/ParentOnboardingView').then((m) => ({ default: m.ParentOnboardingView }))
);
const ReviewerWorkbenchView = lazy(() =>
  import('./pages/ReviewerWorkbenchView').then((m) => ({ default: m.ReviewerWorkbenchView }))
);
const LoginPage = lazy(() =>
  import('./pages/public/AuthPages').then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import('./pages/public/AuthPages').then((m) => ({ default: m.RegisterPage }))
);
const ForgotPasswordPage = lazy(() =>
  import('./pages/public/AuthPages').then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
  import('./pages/public/AuthPages').then((m) => ({ default: m.ResetPasswordPage }))
);
const VerifyEmailPage = lazy(() =>
  import('./pages/public/AuthPages').then((m) => ({ default: m.VerifyEmailPage }))
);
const AboutPage = lazy(() =>
  import('./pages/public/InfoPages').then((m) => ({ default: m.AboutPage }))
);
const HowItWorksPage = lazy(() =>
  import('./pages/public/InfoPages').then((m) => ({ default: m.HowItWorksPage }))
);
const OurApproachPage = lazy(() =>
  import('./pages/public/InfoPages').then((m) => ({ default: m.OurApproachPage }))
);
const ContactPage = lazy(() =>
  import('./pages/public/SupportLegalPages').then((m) => ({ default: m.ContactPage }))
);
const PrivacyPolicyPage = lazy(() =>
  import('./pages/public/SupportLegalPages').then((m) => ({ default: m.PrivacyPolicyPage }))
);
const TermsPage = lazy(() =>
  import('./pages/public/SupportLegalPages').then((m) => ({ default: m.TermsPage }))
);

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" role="status" aria-live="polite">
      <p className="font-display text-base text-muted">Loading workspace...</p>
    </div>
  );
}

function SkipToContentLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-lg focus:bg-sage focus:text-white focus:text-sm focus:font-semibold"
    >
      Skip to main content
    </a>
  );
}

function AuthenticatedWorkspace({
  onOpenDesignSystem,
  onNavigate,
  onLogout,
}: {
  onOpenDesignSystem: () => void;
  onNavigate: (target: NavigateTarget) => void;
  onLogout: () => Promise<void>;
}) {
  const { user, t } = useAuth();

  if (!user) return null;

  // Parent Dashboard owns its dedicated desktop sidebar, top header, and mobile bottom nav
  if (user.role === 'parent') {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <ParentDashboardView
          onNavigate={onNavigate}
          onOpenDesignSystem={onOpenDesignSystem}
          onLogout={onLogout}
        />
      </Suspense>
    );
  }

  if (user.role === 'reviewer') {
    const navItems: TopBarNavItem[] = [
      { id: 'queue', label: t('nav.queue') },
      { id: 'design-system', label: 'Design System' },
    ];
    return (
      <div className="min-h-screen bg-offwhite text-charcoal flex flex-col">
        <SkipToContentLink />
        <TopBar
          navItems={navItems}
          activeNavId="queue"
          onSelectNav={(id) => {
            if (id === 'design-system') onOpenDesignSystem();
          }}
          primaryActionLabel={t('auth.signOut')}
          onPrimaryAction={() => void onLogout()}
        />
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          <Suspense fallback={<RouteLoadingFallback />}>
            <ReviewerWorkbenchView />
          </Suspense>
        </main>
      </div>
    );
  }

  // Admin Console owns its single unified sidebar, mobile header, and main-content landmark
  return (
    <div className="min-h-screen bg-offwhite text-charcoal">
      <SkipToContentLink />
      <Suspense fallback={<RouteLoadingFallback />}>
        <AdminConsoleView
          activeTab="dashboard"
          onLogout={onLogout}
          onOpenDesignSystem={onOpenDesignSystem}
        />
      </Suspense>
    </div>
  );
}

function LittleStepsRouter() {
  const { user, loading, logout, t } = useAuth();
  const { notify } = useToast();
  const { route, getQueryParam, navigate } = usePublicRouter();

  const handleLogout = async () => {
    await logout();
    notify({
      tone: 'info',
      title: 'Signed out safely',
      description: 'See you soon for your next calm moment.',
    });
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-offwhite flex items-center justify-center" role="status">
        <p className="font-display text-lg text-muted">Preparing LittleSteps...</p>
      </div>
    );
  }

  // Design System Reference accessible anytime via /design-system
  if (route === '/design-system') {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <DesignSystemShowcasePage onOpenPrototype={() => navigate('/')} />
      </Suspense>
    );
  }

  // Allow email verification and password recovery pages whether logged in or signed out
  if (route === '/verify-email') {
    return (
      <div className="min-h-screen bg-offwhite text-charcoal flex flex-col">
        {user ? (
          <>
            <SkipToContentLink />
            <TopBar
              navItems={[]}
              activeNavId=""
              onSelectNav={() => {}}
              primaryActionLabel={t('auth.signOut')}
              onPrimaryAction={() => void handleLogout()}
              onBrandClick={() => navigate('/')}
            />
            <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
              <Suspense fallback={<RouteLoadingFallback />}>
                <VerifyEmailPage onNavigate={navigate} initialToken={getQueryParam('token')} />
              </Suspense>
            </main>
          </>
        ) : (
          <PublicLayout currentRoute={route} onNavigate={navigate}>
            <Suspense fallback={<RouteLoadingFallback />}>
              <VerifyEmailPage onNavigate={navigate} initialToken={getQueryParam('token')} />
            </Suspense>
          </PublicLayout>
        )}
      </div>
    );
  }

  if (route === '/forgot-password') {
    return (
      <div className="min-h-screen bg-offwhite text-charcoal flex flex-col">
        {user ? (
          <>
            <SkipToContentLink />
            <TopBar
              navItems={[]}
              activeNavId=""
              onSelectNav={() => {}}
              primaryActionLabel="Back to Dashboard"
              onPrimaryAction={() => navigate('/')}
              onBrandClick={() => navigate('/')}
            />
            <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
              <Suspense fallback={<RouteLoadingFallback />}>
                <ForgotPasswordPage onNavigate={navigate} />
              </Suspense>
            </main>
          </>
        ) : (
          <PublicLayout currentRoute={route} onNavigate={navigate}>
            <Suspense fallback={<RouteLoadingFallback />}>
              <ForgotPasswordPage onNavigate={navigate} />
            </Suspense>
          </PublicLayout>
        )}
      </div>
    );
  }

  if (route === '/reset-password') {
    return (
      <PublicLayout currentRoute={route} onNavigate={navigate}>
        <Suspense fallback={<RouteLoadingFallback />}>
          <ResetPasswordPage onNavigate={navigate} initialToken={getQueryParam('token')} />
        </Suspense>
      </PublicLayout>
    );
  }

  // Parent Onboarding Gate: guide newly registered mothers step-by-step before entering dashboard
  if (user && user.role === 'parent' && !user.onboardingCompletedAt) {
    return (
      <div className="min-h-screen bg-offwhite text-charcoal flex flex-col">
        <SkipToContentLink />
        <TopBar
          navItems={[]}
          activeNavId=""
          onSelectNav={() => {}}
          primaryActionLabel={t('auth.signOut')}
          onPrimaryAction={() => void handleLogout()}
        />
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          <Suspense fallback={<RouteLoadingFallback />}>
            <ParentOnboardingView onNavigate={navigate} />
          </Suspense>
        </main>
      </div>
    );
  }

  // Authenticated users enter their role workspace cleanly
  if (user) {
    return (
      <AuthenticatedWorkspace
        onOpenDesignSystem={() => navigate('/design-system')}
        onNavigate={navigate}
        onLogout={handleLogout}
      />
    );
  }

  // Public & Authentication Website
  const renderPublicPage = (activeRoute: PublicRoute) => {
    switch (activeRoute) {
      case '/':
        return <HomePage onNavigate={navigate} />;
      case '/about':
        return <AboutPage onNavigate={navigate} />;
      case '/how-it-works':
        return <HowItWorksPage onNavigate={navigate} />;
      case '/our-approach':
        return <OurApproachPage onNavigate={navigate} />;
      case '/contact':
        return <ContactPage onNavigate={navigate} />;
      case '/privacy':
        return <PrivacyPolicyPage onNavigate={navigate} />;
      case '/terms':
        return <TermsPage onNavigate={navigate} />;
      case '/login': {
        const queryRole = getQueryParam('role');
        const initialRole =
          queryRole === 'reviewer' || queryRole === 'admin' ? queryRole : 'parent';
        return <LoginPage onNavigate={navigate} initialRole={initialRole} />;
      }
      case '/reviewer/login':
        return <LoginPage onNavigate={navigate} initialRole="reviewer" />;
      case '/admin/login':
        return <LoginPage onNavigate={navigate} initialRole="admin" />;
      case '/register':
        return <RegisterPage onNavigate={navigate} />;
      default:
        return <HomePage onNavigate={navigate} />;
    }
  };

  return (
    <PublicLayout currentRoute={route} onNavigate={navigate}>
      <Suspense fallback={<RouteLoadingFallback />}>{renderPublicPage(route)}</Suspense>
    </PublicLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <LittleStepsRouter />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
