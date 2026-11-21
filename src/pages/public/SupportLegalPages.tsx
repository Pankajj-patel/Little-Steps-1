import React, { useState } from 'react';
import { CheckCircle2, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { Button, Card, Input, PageHeader, Select, useToast } from '../../design-system';
import { api } from '../../lib/api';
import type { PublicRoute } from '../../lib/router';

interface PublicPageProps {
  onNavigate: (route: PublicRoute) => void;
}

/* ========================================================================= */
/* 5. CONTACT US                                                             */
/* ========================================================================= */
export function ContactPage({ onNavigate }: PublicPageProps) {
  const { notify } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('general');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { inquiry } = await api.submitContactInquiry({
        fullName,
        email,
        topic,
        message,
      });
      setSubmittedRef(inquiry.id);
      setFullName('');
      setEmail('');
      setMessage('');
      notify({
        tone: 'success',
        title: 'Message received',
        description: 'Thank you for writing to LittleSteps. Our team will respond shortly.',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
      <PageHeader
        kicker="Contact Us"
        title="We are here to listen and help"
        description="Questions about daily activities, account support, or children’s video privacy? Send us a note anytime."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7">
          <Card>
            {submittedRef ? (
              <div className="py-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-sage-soft text-sage flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h2 className="font-display text-2xl font-semibold text-charcoal">
                    Thank you for reaching out
                  </h2>
                  <p className="text-sm text-muted max-w-md mx-auto">
                    Your message has been saved safely. Reference ID:{' '}
                    <span className="font-mono text-charcoal">{submittedRef}</span>.
                  </p>
                </div>
                <div className="pt-2">
                  <Button variant="secondary" onClick={() => setSubmittedRef(null)}>
                    Send Another Message
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Your name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Meera Deshmukh"
                  />
                  <Input
                    label="Email address"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                <Select
                  label="How can we help?"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  options={[
                    { value: 'general', label: 'General question about LittleSteps' },
                    { value: 'activities', label: 'Daily activities & age stages' },
                    { value: 'privacy', label: 'Video privacy & data deletion' },
                    { value: 'account', label: 'Account or sign-in support' },
                  ]}
                />

                <div className="space-y-1.5">
                  <label htmlFor="contact-message" className="block text-sm font-medium text-charcoal">
                    Your message<span className="text-danger ml-0.5">*</span>
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    minLength={10}
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Share your question or feedback..."
                    className="w-full rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-charcoal placeholder:text-muted/70 focus:border-sage"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-xs text-danger bg-danger-soft px-3.5 py-2.5 rounded-lg">
                    {error}
                  </p>
                )}

                <Button type="submit" variant="primary" loading={submitting}>
                  Send Message
                </Button>
              </form>
            )}
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <Card tone="cream" className="space-y-4">
            <h2 className="font-display text-lg font-semibold text-charcoal">Direct Support</h2>
            <div className="space-y-3 text-sm text-muted">
              <div className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-sage shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <p className="font-medium text-charcoal">Email</p>
                  <p>hello@littlesteps.in</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-sage shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <p className="font-medium text-charcoal">Region</p>
                  <p>Built in India for families everywhere</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-sage shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <p className="font-medium text-charcoal">Medical Note</p>
                  <p className="text-xs leading-relaxed">
                    LittleSteps cannot provide medical advice or diagnoses. For urgent child health concerns, please contact your pediatrician directly.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card padding="sm" className="text-xs text-muted space-y-2">
            <p className="font-medium text-charcoal">Looking for privacy details?</p>
            <p>Read how we protect children’s videos and delete uploaded clips automatically after 30 days.</p>
            <button
              type="button"
              onClick={() => onNavigate('/privacy')}
              className="text-sage font-medium hover:underline cursor-pointer"
            >
              View Privacy Policy
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 6. PRIVACY POLICY                                                         */
/* ========================================================================= */
export function PrivacyPolicyPage({ onNavigate }: PublicPageProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      <PageHeader
        kicker="Privacy Policy · Last updated November 2026"
        title="Protecting your family and your baby’s videos"
        description="Written in plain language so every parent knows exactly what data LittleSteps stores, who can see it, and how to delete it anytime."
      />

      <Card className="space-y-6 text-sm text-muted leading-relaxed">
        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-charcoal">
            1. Information We Collect
          </h2>
          <p>
            When you create a parent account, we store your name, email address, optional mobile number, and the child profile details you enter (display name or nickname and date of birth) solely to match daily activities to the right three-month age group.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-charcoal">
            2. Strict Protection of Children’s Activity Videos
          </h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong className="text-charcoal">Never public:</strong> Uploaded or recorded practice clips are stored in an isolated private vault outside public web directories with random opaque storage keys.
            </li>
            <li>
              <strong className="text-charcoal">Short-lived signed playback:</strong> Videos stream only over authenticated, time-limited signed tokens (5-minute expiry) with browser caching and downloads disabled.
            </li>
            <li>
              <strong className="text-charcoal">Minimized reviewer view:</strong> Assigned reviewers see only your baby’s age band, the activity instructions, and the video stream—never your email address, mobile number, or home address.
            </li>
            <li>
              <strong className="text-charcoal">30-day automatic deletion:</strong> Every uploaded video is automatically and permanently deleted from storage 30 days after upload.
            </li>
            <li>
              <strong className="text-charcoal">Delete anytime:</strong> Parents can permanently delete any uploaded video immediately from their Progress &amp; Review History tab while optionally keeping their written coaching notes. Deleting a baby profile also immediately purges all stored videos for that profile from the private vault.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-charcoal">
            3. Access Auditing &amp; Verifiable Parental Consent
          </h2>
          <p>
            We record explicit caregiver consent before any practice video is uploaded and maintain an internal audit trail of every upload, stream access, review open, parent deletion, and automated 30-day purge. We never sell family data, build behavioral profiles of children, or display targeted advertising.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-charcoal">
            4. Children’s Data &amp; Indian Privacy Framework (DPDP Act 2023)
          </h2>
          <p>
            LittleSteps is designed around India’s Digital Personal Data Protection (DPDP) Act, 2023 principles for processing children’s personal data: data minimization, purpose limitation (educational caregiver coaching only), verifiable parent/lawful-guardian consent, strict access control, and automated 30-day video erasure.
          </p>
          <p className="text-xs bg-cream/80 border border-border rounded-lg px-3.5 py-2.5 text-charcoal">
            <strong className="font-semibold">Pre-launch compliance notice:</strong> Before onboarding real families in India, LittleSteps requires formal legal review and sign-off on DPDP verifiable parental consent workflows, Data Fiduciary disclosures, and Grievance Officer registration.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-charcoal">
            5. Data Retention Schedule, Your Rights &amp; Grievance Contact
          </h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong className="text-charcoal">Practice videos:</strong> Automatically and permanently purged after 30 days (or immediately on parent request or child-profile deletion).
            </li>
            <li>
              <strong className="text-charcoal">Written coaching feedback &amp; activity history:</strong> Retained while your account is active so you can track your journey, and deleted upon account erasure request.
            </li>
            <li>
              <strong className="text-charcoal">Access &amp; erasure audit logs:</strong> Kept with minimal non-PII identifiers to verify privacy compliance.
            </li>
          </ul>
          <p>
            You may update your child profile, delete uploaded videos, or request full account removal at any time. Reach our Privacy &amp; Grievance desk via our{' '}
            <button
              type="button"
              onClick={() => onNavigate('/contact')}
              className="text-sage font-medium hover:underline cursor-pointer"
            >
              Contact Us
            </button>{' '}
            page or email <span className="text-charcoal font-medium">privacy@littlesteps.in</span> (general support:{' '}
            <span className="text-charcoal font-medium">hello@littlesteps.in</span>).
          </p>
        </section>
      </Card>
    </div>
  );
}

/* ========================================================================= */
/* 7. TERMS AND CONDITIONS                                                   */
/* ========================================================================= */
export function TermsPage({ onNavigate }: PublicPageProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8">
      <PageHeader
        kicker="Terms and Conditions · Effective November 2026"
        title="Clear, respectful terms for using LittleSteps"
        description="Please read how LittleSteps daily activities, safety guidance, and caregiver instruction-match coaching work."
      />

      <Card className="space-y-6 text-sm text-muted leading-relaxed">
        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-charcoal">
            1. Educational Purpose & Non-Diagnostic Notice
          </h2>
          <p>
            LittleSteps provides structured, age-appropriate everyday play ideas and caregiver instruction coaching for parents of children aged 0–24 months. LittleSteps is not a medical service, clinical therapy program, or developmental diagnostic tool. Always consult a qualified pediatrician regarding your child’s health, nutrition, or developmental milestones.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-charcoal">
            2. Meaning of Caregiver Instruction-Match Scores
          </h2>
          <p>
            Any percentage-based instruction-match score provided by a reviewer reflects only how closely the caregiver demonstrated the published steps of an activity (such as setup, safety positioning, and calm pacing). Scores never assess a baby’s intelligence, developmental level, or health.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-charcoal">
            3. Adult Supervision & Home Safety
          </h2>
          <p>
            Caregivers are responsible for closely supervising their baby during every activity, inspecting household items for clean smooth edges and choking safety, and pausing immediately whenever a baby appears tired, uncomfortable, or unwell.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-charcoal">
            4. Account & Video Privacy
          </h2>
          <p>
            You agree to upload only videos of activities involving your own child (or a child for whom you are a legal guardian/authorized caregiver). Video retention, access controls, and deletion rights are governed by our{' '}
            <button
              type="button"
              onClick={() => onNavigate('/privacy')}
              className="text-sage font-medium hover:underline cursor-pointer"
            >
              Privacy Policy
            </button>
            .
          </p>
        </section>
      </Card>
    </div>
  );
}
