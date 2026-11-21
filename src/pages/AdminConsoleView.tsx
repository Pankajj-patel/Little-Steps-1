import React, { useCallback, useEffect, useState } from 'react';
import {
  Baby,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck,
  FileText,
  HeartHandshake,
  Layers,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  Video,
  X,
} from 'lucide-react';
import { Badge, type BadgeTone } from '../design-system/Badge';
import { Button } from '../design-system/Button';
import { Card } from '../design-system/Card';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { formatDateTimeReadable } from '../shared/i18n';
import type {
  AdminOverviewResponse,
  AgeGroup,
  LearningDomain,
  UnifiedAuditLogItem,
} from '../shared/types';
import { AdminActivityManager } from './admin/AdminActivityManager';
import {
  AdminAgeGroupsModule,
  AdminAuditLogsModule,
  AdminDailyPlansModule,
  AdminDomainsModule,
  AdminReviewersModule,
  AdminSubmissionsModule,
  AdminUsersModule,
} from './admin/AdminSecondaryModules';

export type AdminTab =
  | 'dashboard'
  | 'age-groups'
  | 'domains'
  | 'activities'
  | 'daily-plans'
  | 'reviewers'
  | 'submissions'
  | 'users'
  | 'audit-logs'
  // back-compat for legacy tab names
  | 'curriculum'
  | 'plans'
  | 'privacy';

interface AdminConsoleViewProps {
  activeTab?: AdminTab;
}

export function AdminConsoleView({ activeTab = 'dashboard' }: AdminConsoleViewProps) {
  const { ageGroups, learningDomains, user } = useAuth();

  // Normalize legacy tab names
  const resolveTab = (tab: AdminTab): AdminTab => {
    if (tab === 'curriculum') return 'activities';
    if (tab === 'plans') return 'daily-plans';
    if (tab === 'privacy') return 'audit-logs';
    return tab;
  };

  const [currentTab, setCurrentTab] = useState<AdminTab>(resolveTab(activeTab));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Synchronize when parent activeTab changes
  useEffect(() => {
    setCurrentTab(resolveTab(activeTab));
  }, [activeTab]);

  // Dashboard Overview state
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    setOverviewError(null);
    try {
      const data = await api.getAdminOverview();
      setOverview(data);
    } catch (err: any) {
      setOverviewError(err.message || 'Unable to load platform overview.');
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    if (currentTab === 'dashboard') {
      void loadOverview();
    }
  }, [currentTab, loadOverview]);

  const navItems = [
    { id: 'dashboard' as AdminTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'age-groups' as AdminTab, label: 'Age Groups', icon: Calendar },
    { id: 'domains' as AdminTab, label: 'Development Domains', icon: Layers },
    { id: 'activities' as AdminTab, label: 'Activity Management', icon: FileText },
    { id: 'daily-plans' as AdminTab, label: 'Daily Plans', icon: Clock },
    { id: 'reviewers' as AdminTab, label: 'Reviewer Accounts', icon: UserCheck },
    { id: 'submissions' as AdminTab, label: 'Submissions Queue', icon: Video },
    { id: 'users' as AdminTab, label: 'User Management', icon: Users },
    { id: 'audit-logs' as AdminTab, label: 'Audit Logs & Privacy', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col md:flex-row bg-offwhite">
      {/* Mobile Navigation Header */}
      <div className="md:hidden p-4 border-b border-cream-accent/60 bg-white flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-sage" />
          <span className="font-serif font-bold text-charcoal">LittleSteps Admin</span>
        </div>
        <Button
          variant="subtle"
          size="sm"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Desktop Left Sidebar & Mobile Drawer */}
      <aside
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } md:block w-full md:w-64 bg-white border-r border-cream-accent/70 p-4 md:min-h-[calc(100vh-4rem)] shrink-0 z-10`}
      >
        <div className="hidden md:flex items-center gap-2.5 px-3 py-3 mb-4 border-b border-cream-accent/50">
          <div className="w-8 h-8 rounded-xl bg-sage/10 text-sage flex items-center justify-center font-serif font-bold">
            LS
          </div>
          <div>
            <h1 className="text-sm font-serif font-bold text-charcoal leading-tight">Admin Console</h1>
            <p className="text-[11px] text-muted">Platform Management</p>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setCurrentTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  active
                    ? 'bg-sage text-white shadow-sm'
                    : 'text-charcoal hover:bg-cream/40 hover:text-charcoal'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-muted'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-8 pt-4 border-t border-cream-accent/60 px-3 text-[11px] text-muted space-y-1">
          <p>
            Logged in as: <strong className="text-charcoal">{user?.fullName}</strong>
          </p>
          <p className="text-sage font-medium">Administrator (Full Access)</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
        {/* Module: Dashboard */}
        {currentTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-cream/30 p-6 rounded-2xl border border-cream-accent/60">
              <div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-charcoal">Platform Overview</h2>
                <p className="text-sm text-muted mt-1 leading-relaxed">
                  Real-time health, enrollment, curriculum coverage, and reviewer throughput.
                </p>
              </div>
              <Button
                variant="subtle"
                size="sm"
                onClick={loadOverview}
                loading={loadingOverview}
                className="self-start sm:self-auto flex items-center gap-2 text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Data</span>
              </Button>
            </div>

            {overviewError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {overviewError}
              </div>
            )}

            {/* 6 Key Performance Metric Cards */}
            {overview && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <div className="bg-white p-4 rounded-2xl border border-cream-accent/70 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                    Parents
                  </span>
                  <div className="text-2xl font-bold font-serif text-charcoal">
                    {overview.counts.totalParents}
                  </div>
                  <span className="text-[10px] text-muted">Registered families</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-cream-accent/70 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                    Children
                  </span>
                  <div className="text-2xl font-bold font-serif text-charcoal">
                    {overview.counts.totalChildren}
                  </div>
                  <span className="text-[10px] text-muted">Enrolled babies</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-cream-accent/70 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                    Activities
                  </span>
                  <div className="text-2xl font-bold font-serif text-charcoal">
                    {overview.counts.publishedActivities}
                  </div>
                  <span className="text-[10px] text-muted">
                    {overview.counts.totalActivities} in curriculum
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-cream-accent/70 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                    Queue
                  </span>
                  <div className="text-2xl font-bold font-serif text-charcoal">
                    {overview.counts.pendingReviews}
                  </div>
                  <span className="text-[10px] text-muted">Pending review</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-cream-accent/70 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                    Reviews
                  </span>
                  <div className="text-2xl font-bold font-serif text-charcoal">
                    {overview.counts.completedReviews}
                  </div>
                  <span className="text-[10px] text-muted">Evaluations completed</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-cream-accent/70 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                    Video Vault
                  </span>
                  <div className="text-2xl font-bold font-serif text-sage-dark">
                    {overview.counts.activeVideosCount}
                  </div>
                  <span className="text-[10px] text-muted">
                    {overview.counts.expiredPurgedCount} auto-purged
                  </span>
                </div>
              </div>
            )}

            {/* Curriculum Coverage Matrix (8 Age Groups × 6 Domains) */}
            {overview && overview.coverageMatrix && (
              <div className="bg-white rounded-2xl border border-cream-accent/70 shadow-sm p-6 space-y-4">
                <div>
                  <h3 className="text-base font-serif font-bold text-charcoal">
                    Curriculum Coverage Matrix (8 Age Groups × 6 Domains)
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Ensures every age cohort has balanced, verified activities across all developmental areas.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-cream-accent/70 text-muted uppercase tracking-wider">
                        <th className="py-2.5 px-3 font-semibold">Cohort</th>
                        {learningDomains.map((d) => (
                          <th key={d.id} className="py-2.5 px-3 font-semibold text-center">
                            {d.name.split(' ')[0]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cream-accent/40">
                      {overview.coverageMatrix.map((row) => (
                        <tr key={row.ageGroupId} className="hover:bg-cream/20">
                          <td className="py-2.5 px-3 font-semibold text-charcoal whitespace-nowrap">
                            {row.ageGroupLabel}
                          </td>
                          {learningDomains.map((d) => {
                            const count = row.domainCounts[d.id] ?? 0;
                            const isZero = count === 0;
                            return (
                              <td key={d.id} className="py-2.5 px-3 text-center">
                                <span
                                  className={`inline-block w-8 py-0.5 rounded-md font-bold text-center ${
                                    isZero
                                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                      : 'bg-sage/10 text-sage-dark border border-sage/20'
                                  }`}
                                >
                                  {count}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent Platform Activity */}
            {overview && overview.recentActivity && (
              <div className="bg-white rounded-2xl border border-cream-accent/70 shadow-sm p-6 space-y-4">
                <h3 className="text-base font-serif font-bold text-charcoal">Recent Platform Activity</h3>
                <div className="divide-y divide-cream-accent/40 text-xs">
                  {overview.recentActivity.slice(0, 8).map((item) => (
                    <div key={item.id} className="py-3 flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Badge
                            tone={
                              item.category === 'admin'
                                ? 'lavender'
                                : item.category === 'review'
                                  ? 'sage'
                                  : 'peach'
                            }
                          >
                            {item.category.toUpperCase()}
                          </Badge>
                          <span className="font-semibold text-charcoal">{item.actorName}</span>
                        </div>
                        <p className="text-charcoal leading-relaxed">{item.summary}</p>
                      </div>
                      <span className="text-[11px] text-muted whitespace-nowrap">
                        {formatDateTimeReadable(item.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Module: Age Groups */}
        {currentTab === 'age-groups' && (
          <AdminAgeGroupsModule onReloadCurriculum={loadOverview} />
        )}

        {/* Module: Domains */}
        {currentTab === 'domains' && (
          <AdminDomainsModule onReloadCurriculum={loadOverview} />
        )}

        {/* Module: Activities */}
        {currentTab === 'activities' && (
          <AdminActivityManager
            ageGroups={ageGroups}
            learningDomains={learningDomains}
          />
        )}

        {/* Module: Daily Plans */}
        {currentTab === 'daily-plans' && (
          <AdminDailyPlansModule ageGroups={ageGroups} />
        )}

        {/* Module: Reviewers */}
        {currentTab === 'reviewers' && (
          <AdminReviewersModule ageGroups={ageGroups} />
        )}

        {/* Module: Submissions */}
        {currentTab === 'submissions' && <AdminSubmissionsModule />}

        {/* Module: Users */}
        {currentTab === 'users' && <AdminUsersModule />}

        {/* Module: Audit Logs */}
        {currentTab === 'audit-logs' && <AdminAuditLogsModule />}
      </main>
    </div>
  );
}
