import React, { Suspense, lazy, useState } from 'react';
import { PublicLayout } from './components/PublicLayout';
import { TopBar, type TopBarNavItem } from './components/TopBar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './design-system';
import { usePublicRouter, type NavigateTarget, type PublicRoute } from './lib/router';
import type { AdminTab } from './pages/AdminConsoleView';
import { ParentDashboardView } from './pages/ParentDashboardView';
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from './pages/public/AuthPages';
import { HomePage } from './pages/public/HomePage';
import { AboutPage, HowItWorksPage, OurApproachPage } from './pages/public/InfoPages';
import { ContactPage, PrivacyPolicyPage, TermsPage } from './pages/public/SupportLegalPages';

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

function RouteLoadingFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
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
  const [adminTab, setAdminTab] = useState<AdminTab>('curriculum');

  if (!user) return null;

  // Step 4 Parent Dashboard owns its dedicated desktop sidebar, top header, and mobile bottom nav
  if (user.role === 'parent') {
    return (
      <ParentDashboardView
        onNavigate={onNavigate}
        onOpenDesignSystem={onOpenDesignSystem}
        onLogout={onLogout}
      />
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

  const adminNavItems: TopBarNavItem[] = [
    { id: 'curriculum', label: t('nav.curriculum') },
    { id: 'plans', label: t('nav.plans') },
    { id: 'users', label: t('nav.users') },
    { id: 'privacy', label: t('nav.privacy') },
    { id: 'design-system', label: 'Design System' },
  ];

  return (
    <div className="min-h-screen bg-offwhite text-charcoal flex flex-col">
      <SkipToContentLink />
      <TopBar
        navItems={adminNavItems}
        activeNavId={adminTab}
        onSelectNav={(id) => {
          if (id === 'design-system') {
            onOpenDesignSystem();
            return;
          }
          setAdminTab(id as AdminTab);
        }}
        primaryActionLabel={t('auth.signOut')}
        onPrimaryAction={() => void onLogout()}
        onBrandClick={() => setAdminTab('curriculum')}
      />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        <Suspense fallback={<RouteLoadingFallback />}>
          <AdminConsoleView activeTab={adminTab} />
        </Suspense>
      </main>
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
      <div className="min-h-screen bg-offwhite flex items-center justify-center">
        <p className="font-display text-lg text-muted">Preparing LittleSteps...</p>
      </div>
    );
  }

  // Step 1 Design System Reference accessible anytime via /design-system
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
              <VerifyEmailPage onNavigate={navigate} initialToken={getQueryParam('token')} />
            </main>
          </>
        ) : (
          <PublicLayout currentRoute={route} onNavigate={navigate}>
            <VerifyEmailPage onNavigate={navigate} initialToken={getQueryParam('token')} />
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
              <ForgotPasswordPage onNavigate={navigate} />
            </main>
          </>
        ) : (
          <PublicLayout currentRoute={route} onNavigate={navigate}>
            <ForgotPasswordPage onNavigate={navigate} />
          </PublicLayout>
        )}
      </div>
    );
  }

  if (route === '/reset-password') {
    return (
      <PublicLayout currentRoute={route} onNavigate={navigate}>
        <ResetPasswordPage onNavigate={navigate} initialToken={getQueryParam('token')} />
      </PublicLayout>
    );
  }

  // Step 3 Parent Onboarding Gate: guide newly registered mothers step-by-step before entering dashboard
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

  // Step 2 & Step 3 Public & Authentication Website
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
      {renderPublicPage(route)}
    </PublicLayout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <LittleStepsRouter />
      </AuthProvider>
    </ToastProvider>
  );
}


