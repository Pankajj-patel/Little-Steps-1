import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '../design-system';
import type { PublicRoute } from '../lib/router';

interface PublicLayoutProps {
  currentRoute: PublicRoute;
  onNavigate: (route: PublicRoute) => void;
  children: React.ReactNode;
}

const HEADER_NAV_LINKS: Array<{ route: PublicRoute; label: string }> = [
  { route: '/about', label: 'About' },
  { route: '/how-it-works', label: 'How It Works' },
  { route: '/our-approach', label: 'Our Approach' },
  { route: '/contact', label: 'Contact' },
  { route: '/login', label: 'Login' },
];

export function PublicLayout({ currentRoute, onNavigate, children }: PublicLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLinkClick = (e: React.MouseEvent, route: PublicRoute) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    onNavigate(route);
  };

  return (
    <div className="min-h-screen bg-offwhite text-charcoal flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-lg focus:bg-sage focus:text-white focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-offwhite/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6 lg:gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="/"
            onClick={(e) => handleLinkClick(e, '/')}
            className="font-display text-xl font-bold tracking-tight text-charcoal whitespace-nowrap shrink-0 min-h-[44px] inline-flex items-center"
          >
            LittleSteps
          </a>

          {/* Zone 2: 5 clean single-line navigation links */}
          <nav
            aria-label="Main navigation"
            className="hidden md:flex items-center gap-6 lg:gap-7"
          >
            {HEADER_NAV_LINKS.map((item) => {
              const active = currentRoute === item.route;
              return (
                <a
                  key={item.route}
                  href={item.route}
                  aria-current={active ? 'page' : undefined}
                  onClick={(e) => handleLinkClick(e, item.route)}
                  className={`min-h-[44px] inline-flex items-center text-sm border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-sage text-charcoal font-semibold'
                      : 'border-transparent text-muted hover:text-charcoal font-medium'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Zone 3: Primary CTA on desktop; clean menu button on mobile */}
          <div className="flex items-center shrink-0">
            <div className="hidden md:block">
              <Button
                variant="primary"
                size="sm"
                onClick={() => onNavigate('/register')}
              >
                Start Your Journey
              </Button>
            </div>

            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border bg-surface text-charcoal hover:bg-cream transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-Down Navigation Menu (320px+ friendly, >= 44px touch targets) */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="md:hidden border-t border-border bg-surface px-4 py-4 space-y-1"
          >
            {(
              [
                { route: '/', label: 'Home' },
                { route: '/about', label: 'About LittleSteps' },
                { route: '/how-it-works', label: 'How It Works' },
                { route: '/our-approach', label: 'Our Approach' },
                { route: '/contact', label: 'Contact Us' },
                { route: '/login', label: 'Login' },
              ] as Array<{ route: PublicRoute; label: string }>
            ).map((item) => {
              const active = currentRoute === item.route;
              return (
                <a
                  key={item.route}
                  href={item.route}
                  aria-current={active ? 'page' : undefined}
                  onClick={(e) => handleLinkClick(e, item.route)}
                  className={`min-h-[44px] px-3.5 rounded-lg flex items-center text-sm transition-colors ${
                    active
                      ? 'bg-sage-soft text-sage font-semibold'
                      : 'text-charcoal hover:bg-cream font-medium'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}

            <div className="pt-3 border-t border-border">
              <Button
                variant="primary"
                fullWidth
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate('/register');
                }}
              >
                Start Your Journey
              </Button>
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>

      {/* Quiet, Structured Footer (Section 9) */}
      <footer className="border-t border-border bg-surface mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-3">
              <a
                href="/"
                onClick={(e) => handleLinkClick(e, '/')}
                className="font-display text-xl font-bold text-charcoal inline-block"
              >
                LittleSteps
              </a>
              <p className="text-sm text-muted leading-relaxed max-w-xs">
                Calm, age-appropriate daily activities helping mothers and caregivers support babies from birth to 24 months.
              </p>
              <p className="text-xs text-muted">
                India · English (regional languages planned)
              </p>
            </div>

            <div className="lg:col-span-3 space-y-3">
              <p className="text-xs font-semibold text-charcoal">Explore</p>
              <ul className="space-y-2 text-sm text-muted">
                <li>
                  <a
                    href="/"
                    onClick={(e) => handleLinkClick(e, '/')}
                    className="hover:text-charcoal transition-colors"
                  >
                    Home
                  </a>
                </li>
                <li>
                  <a
                    href="/about"
                    onClick={(e) => handleLinkClick(e, '/about')}
                    className="hover:text-charcoal transition-colors"
                  >
                    About LittleSteps
                  </a>
                </li>
                <li>
                  <a
                    href="/how-it-works"
                    onClick={(e) => handleLinkClick(e, '/how-it-works')}
                    className="hover:text-charcoal transition-colors"
                  >
                    How It Works
                  </a>
                </li>
                <li>
                  <a
                    href="/our-approach"
                    onClick={(e) => handleLinkClick(e, '/our-approach')}
                    className="hover:text-charcoal transition-colors"
                  >
                    Our Approach
                  </a>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-2 space-y-3">
              <p className="text-xs font-semibold text-charcoal">Account</p>
              <ul className="space-y-2 text-sm text-muted">
                <li>
                  <a
                    href="/register"
                    onClick={(e) => handleLinkClick(e, '/register')}
                    className="hover:text-charcoal transition-colors"
                  >
                    Start Your Journey
                  </a>
                </li>
                <li>
                  <a
                    href="/login"
                    onClick={(e) => handleLinkClick(e, '/login')}
                    className="hover:text-charcoal transition-colors"
                  >
                    Login
                  </a>
                </li>
                <li>
                  <a
                    href="/design-system"
                    onClick={(e) => handleLinkClick(e, '/design-system')}
                    className="hover:text-charcoal transition-colors"
                  >
                    Design System
                  </a>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-3 space-y-3">
              <p className="text-xs font-semibold text-charcoal">Support & Legal</p>
              <ul className="space-y-2 text-sm text-muted">
                <li>
                  <a
                    href="/contact"
                    onClick={(e) => handleLinkClick(e, '/contact')}
                    className="hover:text-charcoal transition-colors"
                  >
                    Contact Us
                  </a>
                </li>
                <li>
                  <a
                    href="/privacy"
                    onClick={(e) => handleLinkClick(e, '/privacy')}
                    className="hover:text-charcoal transition-colors"
                  >
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a
                    href="/terms"
                    onClick={(e) => handleLinkClick(e, '/terms')}
                    className="hover:text-charcoal transition-colors"
                  >
                    Terms & Conditions
                  </a>
                </li>
                <li className="pt-1 text-xs text-muted">
                  hello@littlesteps.in
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-border flex flex-wrap items-center justify-between gap-4 text-xs text-muted">
            <p>© {new Date().getFullYear()} LittleSteps. All rights reserved.</p>
            <p>
              Educational parenting guidance only · Not a medical or developmental diagnostic service.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
