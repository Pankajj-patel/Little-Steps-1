import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  MailCheck,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, Input, useToast } from '../../design-system';
import { api } from '../../lib/api';
import type { NavigateTarget } from '../../lib/router';

import type { UserRole } from '../../shared/types';

interface AuthPageProps {
  onNavigate: (route: NavigateTarget) => void;
}

interface LoginPageProps extends AuthPageProps {
  initialRole?: UserRole;
}

interface TokenAuthPageProps extends AuthPageProps {
  initialToken: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PORTAL_META: Record<
  UserRole,
  {
    label: string;
    eyebrow: string;
    heading: string;
    subtitle: string;
    emailPlaceholder: string;
    ctaLabel: string;
  }
> = {
  parent: {
    label: 'Parent',
    eyebrow: 'Parent Portal',
    heading: 'Sign in to LittleSteps',
    subtitle: 'Continue your baby’s calm daily activity journey.',
    emailPlaceholder: 'you@example.com',
    ctaLabel: 'Sign In as Parent',
  },
  reviewer: {
    label: 'Reviewer',
    eyebrow: 'Authorized Reviewer Portal',
    heading: 'Reviewer Sign In',
    subtitle: 'Enter your assigned reviewer email and password to access the review queue.',
    emailPlaceholder: 'reviewer@littlesteps.in',
    ctaLabel: 'Sign In to Reviewer Portal',
  },
  admin: {
    label: 'Admin',
    eyebrow: 'Administrator Portal',
    heading: 'Admin Sign In',
    subtitle: 'Enter your administrator credentials to manage curriculum, reviewers, and safety logs.',
    emailPlaceholder: 'admin@littlesteps.in',
    ctaLabel: 'Sign In to Admin Console',
  },
};

/* ========================================================================= */
/* 1. LOGIN PAGE                                                             */
/* ========================================================================= */
export function LoginPage({ onNavigate, initialRole = 'parent' }: LoginPageProps) {
  const { login } = useAuth();
  const { notify } = useToast();
  const [portalRole, setPortalRole] = useState<UserRole>(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPortalRole(initialRole);
    setError(null);
  }, [initialRole]);

  const activeMeta = PORTAL_META[portalRole];

  const handleSelectPortal = (nextRole: UserRole) => {
    setPortalRole(nextRole);
    setError(null);
    setFieldErrors({});
    if (nextRole === 'parent') onNavigate('/login');
    else if (nextRole === 'reviewer') onNavigate('/reviewer/login');
    else onNavigate('/admin/login');
  };

  const validate = () => {
    const next: { email?: string; password?: string } = {};
    if (!email.trim() || !EMAIL_REGEX.test(email.trim())) {
      next.email = 'Please enter a valid email address.';
    }
    if (!password) {
      next.password = 'Please enter your password.';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password, portalRole);
      notify({
        tone: 'success',
        title: `Welcome back, ${user.fullName.split(' ')[0]}`,
      });
      onNavigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-6">
      <div className="text-center space-y-2">
        <p className="font-mono text-xs text-sage tabular-nums">{activeMeta.eyebrow}</p>
        <h1 className="font-display text-3xl font-semibold text-charcoal">
          {activeMeta.heading}
        </h1>
        <p className="text-sm text-muted">
          {activeMeta.subtitle}
        </p>
      </div>

      <Card className="space-y-5">
        {/* Role Portal Selector — requires email + password for every role */}
        <div
          role="tablist"
          aria-label="Choose sign-in portal"
          className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-cream border border-border"
        >
          {(['parent', 'reviewer', 'admin'] as UserRole[]).map((roleOption) => {
            const selected = portalRole === roleOption;
            return (
              <button
                key={roleOption}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => handleSelectPortal(roleOption)}
                className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selected
                    ? 'bg-surface text-charcoal shadow-xs border border-border'
                    : 'text-muted hover:text-charcoal'
                }`}
              >
                {PORTAL_META[roleOption].label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input
            label="Email address"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
            }}
            error={fieldErrors.email}
            placeholder={activeMeta.emailPlaceholder}
          />

          <div className="space-y-1.5">
            <Input
              label="Password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
              }}
              error={fieldErrors.password}
              placeholder="Enter your password"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onNavigate('/forgot-password')}
                className="text-xs font-medium text-sage hover:underline min-h-[32px] inline-flex items-center cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-danger bg-danger-soft px-3.5 py-2.5 rounded-lg">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={submitting}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            {activeMeta.ctaLabel}
          </Button>
        </form>
      </Card>

      {portalRole === 'parent' ? (
        <p className="text-center text-sm text-muted">
          New to LittleSteps?{' '}
          <button
            type="button"
            onClick={() => onNavigate('/register')}
            className="text-sage font-medium hover:underline cursor-pointer"
          >
            Create a parent account
          </button>
        </p>
      ) : (
        <p className="text-center text-xs text-muted">
          Reviewer and administrator accounts are provisioned by a LittleSteps admin and require password authentication.
        </p>
      )}
    </div>
  );
}

/* ========================================================================= */
/* 2. REGISTER PAGE                                                          */
/* ========================================================================= */
export function RegisterPage({ onNavigate }: AuthPageProps) {
  const { register } = useAuth();
  const { notify } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = () => {
    const next: {
      fullName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};
    if (fullName.trim().length < 2) {
      next.fullName = 'Please enter your name (at least 2 characters).';
    }
    if (!email.trim() || !EMAIL_REGEX.test(email.trim())) {
      next.email = 'Please enter a valid email address.';
    }
    if (password.length < 8) {
      next.password = 'Password must be at least 8 characters long.';
    }
    if (confirmPassword !== password) {
      next.confirmPassword = 'Passwords do not match. Please re-enter.';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        password,
      });
      notify({
        tone: 'success',
        title: 'Account created',
        description: 'Let’s personalize LittleSteps for you and your baby.',
      });
      onNavigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create your account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-6">
      <div className="text-center space-y-2">
        <p className="font-mono text-xs text-sage tabular-nums">Start Your Journey</p>
        <h1 className="font-display text-3xl font-semibold text-charcoal">
          Create your parent account
        </h1>
        <p className="text-sm text-muted">
          Gentle, age-appropriate daily activities matched automatically to your baby’s stage.
        </p>
      </div>

      <Card className="space-y-5">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input
            label="Your name"
            required
            autoComplete="name"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (fieldErrors.fullName) setFieldErrors((p) => ({ ...p, fullName: undefined }));
            }}
            error={fieldErrors.fullName}
            placeholder="e.g., Priya Sharma"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email address"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
              }}
              error={fieldErrors.email}
              placeholder="you@example.com"
            />

            <Input
              label="Mobile number (Optional)"
              type="tel"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+91 98xxx xxxxx"
              helperText="Optional contact for account recovery."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Create password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
              }}
              error={fieldErrors.password}
              placeholder="At least 8 characters"
            />

            <Input
              label="Confirm password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((p) => ({ ...p, confirmPassword: undefined }));
                }
              }}
              error={fieldErrors.confirmPassword}
              placeholder="Re-enter password"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-danger bg-danger-soft px-3.5 py-2.5 rounded-lg">
              {error}
            </p>
          )}

          <div className="rounded-lg bg-cream/80 border border-border p-3.5 flex items-start gap-2.5 text-xs text-muted leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-sage shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              By creating an account you agree to our{' '}
              <button
                type="button"
                onClick={() => onNavigate('/terms')}
                className="text-sage font-medium hover:underline cursor-pointer"
              >
                Terms & Conditions
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => onNavigate('/privacy')}
                className="text-sage font-medium hover:underline cursor-pointer"
              >
                Privacy Policy
              </button>
              . Uploaded baby videos remain strictly private and auto-delete after 30 days.
            </span>
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={submitting}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Create Account & Personalize
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-muted">
        Already have an account?{' '}
        <button
          type="button"
          onClick={() => onNavigate('/login')}
          className="text-sage font-medium hover:underline cursor-pointer"
        >
          Sign in
        </button>
      </p>
    </div>
  );
}

/* ========================================================================= */
/* 3. FORGOT PASSWORD PAGE                                                   */
/* ========================================================================= */
export function ForgotPasswordPage({ onNavigate }: AuthPageProps) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [resetPreviewPath, setResetPreviewPath] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !EMAIL_REGEX.test(email.trim())) {
      setEmailError('Please enter the email address associated with your account.');
      return;
    }
    setEmailError(undefined);
    setSubmitting(true);
    try {
      const res = await api.forgotPassword(email.trim());
      setSubmittedMessage(res.message);
      setResetPreviewPath(res.resetPreviewPath ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reset instructions.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-6">
      <div className="text-center space-y-2">
        <p className="font-mono text-xs text-sage tabular-nums">Account Recovery</p>
        <h1 className="font-display text-3xl font-semibold text-charcoal">
          Reset your password
        </h1>
        <p className="text-sm text-muted">
          Enter your email address and we’ll prepare a secure one-time link to set a new password.
        </p>
      </div>

      <Card className="space-y-5">
        {submittedMessage ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-sage-soft border border-sage-border p-4 flex items-start gap-3">
              <MailCheck className="w-5 h-5 text-sage shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-charcoal">Check your email</p>
                <p className="text-muted text-xs leading-relaxed">{submittedMessage}</p>
              </div>
            </div>

            {resetPreviewPath && (
              <div className="rounded-xl bg-cream border border-border p-4 space-y-3">
                <p className="text-xs text-muted leading-relaxed">
                  In this local prototype environment, outgoing email is simulated. Open your
                  one-time reset link directly below (valid for 30 minutes):
                </p>
                <Button
                  variant="primary"
                  fullWidth
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => onNavigate(resetPreviewPath as NavigateTarget)}
                >
                  Open Password Reset Link
                </Button>
              </div>
            )}

            <Button
              variant="secondary"
              fullWidth
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => onNavigate('/login')}
            >
              Back to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              label="Email address"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(undefined);
              }}
              error={emailError}
              placeholder="you@example.com"
              helperText="For your privacy, we never disclose whether an email is registered."
            />

            {error && (
              <p role="alert" className="text-xs text-danger bg-danger-soft px-3.5 py-2.5 rounded-lg">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={submitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Send Reset Link
            </Button>
          </form>
        )}
      </Card>

      <p className="text-center text-sm text-muted">
        Remembered your password?{' '}
        <button
          type="button"
          onClick={() => onNavigate('/login')}
          className="text-sage font-medium hover:underline cursor-pointer"
        >
          Return to sign in
        </button>
      </p>
    </div>
  );
}

/* ========================================================================= */
/* 4. RESET PASSWORD PAGE                                                    */
/* ========================================================================= */
export function ResetPasswordPage({ onNavigate, initialToken }: TokenAuthPageProps) {
  const { setUser } = useAuth();
  const { notify } = useToast();
  const [token, setToken] = useState(initialToken ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    token?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (initialToken) setToken(initialToken);
  }, [initialToken]);

  const validate = () => {
    const next: { token?: string; newPassword?: string; confirmPassword?: string } = {};
    if (token.trim().length < 10) {
      next.token = 'A valid reset token is required. Request a new link if yours expired.';
    }
    if (newPassword.length < 8) {
      next.newPassword = 'New password must be at least 8 characters long.';
    }
    if (confirmPassword !== newPassword) {
      next.confirmPassword = 'Passwords do not match.';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.resetPassword(token.trim(), newPassword);
      setUser(null);
      setCompleted(true);
      notify({
        tone: 'success',
        title: 'Password updated',
        description: 'You can now sign in with your new password.',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-6">
      <div className="text-center space-y-2">
        <p className="font-mono text-xs text-sage tabular-nums">Security Update</p>
        <h1 className="font-display text-3xl font-semibold text-charcoal">
          Choose a new password
        </h1>
        <p className="text-sm text-muted">
          Updating your password signs out previous sessions to keep your family account safe.
        </p>
      </div>

      <Card className="space-y-5">
        {completed ? (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-sage-soft text-sage mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-xl font-semibold text-charcoal">
                Your password has been reset
              </h2>
              <p className="text-sm text-muted">
                Please sign in with your new password to continue your journey.
              </p>
            </div>
            <Button
              variant="primary"
              fullWidth
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => onNavigate('/login')}
            >
              Sign In Now
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {!initialToken && (
              <Input
                label="Reset token"
                required
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  if (fieldErrors.token) setFieldErrors((p) => ({ ...p, token: undefined }));
                }}
                error={fieldErrors.token}
                placeholder="Paste the reset token from your email"
              />
            )}

            <Input
              label="New password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (fieldErrors.newPassword) {
                  setFieldErrors((p) => ({ ...p, newPassword: undefined }));
                }
              }}
              error={fieldErrors.newPassword}
              placeholder="At least 8 characters"
              leadingIcon={<KeyRound className="w-4 h-4" />}
            />

            <Input
              label="Confirm new password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((p) => ({ ...p, confirmPassword: undefined }));
                }
              }}
              error={fieldErrors.confirmPassword}
              placeholder="Re-enter your new password"
            />

            {fieldErrors.token && initialToken && (
              <p role="alert" className="text-xs text-danger bg-danger-soft px-3.5 py-2.5 rounded-lg">
                {fieldErrors.token}
              </p>
            )}

            {error && (
              <p role="alert" className="text-xs text-danger bg-danger-soft px-3.5 py-2.5 rounded-lg">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={submitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Save New Password
            </Button>
          </form>
        )}
      </Card>

      <p className="text-center text-sm text-muted">
        Need a fresh link?{' '}
        <button
          type="button"
          onClick={() => onNavigate('/forgot-password')}
          className="text-sage font-medium hover:underline cursor-pointer"
        >
          Request another reset link
        </button>
      </p>
    </div>
  );
}

/* ========================================================================= */
/* 5. EMAIL VERIFICATION PAGE                                                */
/* ========================================================================= */
export function VerifyEmailPage({ onNavigate, initialToken }: TokenAuthPageProps) {
  const { user, refreshUser, verificationPreviewPath, setVerificationPreviewPath } = useAuth();
  const { notify } = useToast();
  const [manualToken, setManualToken] = useState(initialToken ?? '');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'verified' | 'error'>(
    user?.emailVerifiedAt ? 'verified' : initialToken ? 'verifying' : 'idle'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const runVerification = async (tokenToVerify: string) => {
    setStatus('verifying');
    setErrorMessage(null);
    try {
      await api.verifyEmail(tokenToVerify.trim());
      setVerificationPreviewPath(null);
      if (user) {
        await refreshUser();
      }
      setStatus('verified');
      notify({
        tone: 'success',
        title: 'Email verified',
        description: 'Your LittleSteps email address is now confirmed.',
      });
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'This verification link is invalid or has expired.'
      );
    }
  };

  useEffect(() => {
    if (initialToken && !user?.emailVerifiedAt) {
      void runVerification(initialToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialToken]);

  const handleResend = async () => {
    setResending(true);
    setErrorMessage(null);
    try {
      const res = await api.resendVerification();
      if (res.alreadyVerified) {
        await refreshUser();
        setStatus('verified');
        return;
      }
      if (res.verificationPreviewPath) {
        setVerificationPreviewPath(res.verificationPreviewPath);
      }
      notify({
        tone: 'info',
        title: 'Verification link refreshed',
        description: 'Use the link below to verify your email.',
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to send verification link.');
    } finally {
      setResending(false);
    }
  };

  const continueLabel = user
    ? user.role === 'parent' && !user.onboardingCompletedAt
      ? 'Continue Onboarding'
      : 'Go to Dashboard'
    : 'Sign In to LittleSteps';

  const handleContinue = () => {
    onNavigate(user ? '/' : '/login');
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-6">
      <div className="text-center space-y-2">
        <p className="font-mono text-xs text-sage tabular-nums">Email Verification</p>
        <h1 className="font-display text-3xl font-semibold text-charcoal">
          Confirm your email address
        </h1>
        <p className="text-sm text-muted">
          Verifying your email helps protect your account and ensures you can recover access safely.
        </p>
      </div>

      <Card className="space-y-5">
        {status === 'verifying' && (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm font-medium text-charcoal">Verifying your link...</p>
            <p className="text-xs text-muted">This takes just a moment.</p>
          </div>
        )}

        {status === 'verified' && (
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 rounded-full bg-sage-soft text-sage mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-xl font-semibold text-charcoal">
                Email verified
              </h2>
              <p className="text-sm text-muted">
                Thank you for confirming{user?.email ? ` ${user.email}` : ' your email address'}.
              </p>
            </div>
            <Button
              variant="primary"
              fullWidth
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={handleContinue}
            >
              {continueLabel}
            </Button>
          </div>
        )}

        {(status === 'idle' || status === 'error') && (
          <div className="space-y-4">
            {errorMessage && (
              <p role="alert" className="text-xs text-danger bg-danger-soft px-3.5 py-2.5 rounded-lg">
                {errorMessage}
              </p>
            )}

            {user && verificationPreviewPath && (
              <div className="rounded-xl bg-cream border border-border p-4 space-y-3">
                <p className="text-xs text-muted leading-relaxed">
                  Your local preview verification link is ready for{' '}
                  <span className="font-medium text-charcoal">{user.email}</span>:
                </p>
                <Button
                  variant="primary"
                  fullWidth
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => onNavigate(verificationPreviewPath as NavigateTarget)}
                >
                  Verify Email Now
                </Button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualToken.trim().length < 10) {
                  setErrorMessage('Please enter a valid verification token.');
                  return;
                }
                void runVerification(manualToken);
              }}
              className="space-y-3"
            >
              <Input
                label="Verification token"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Paste verification token"
                helperText="Opened this page directly? Paste your token or request a fresh link."
              />
              <Button type="submit" variant="secondary" fullWidth>
                Verify Token
              </Button>
            </form>

            {user && (
              <div className="pt-3 border-t border-border flex flex-col gap-2">
                <Button
                  variant="subtle"
                  fullWidth
                  loading={resending}
                  leftIcon={<RefreshCw className="w-4 h-4" />}
                  onClick={() => void handleResend()}
                >
                  Generate Fresh Verification Link
                </Button>
                <Button variant="subtle" fullWidth onClick={handleContinue}>
                  {continueLabel}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
