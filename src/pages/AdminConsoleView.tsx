import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Baby,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileCheck,
  FileEdit,
  FileText,
  FolderPlus,
  HeartHandshake,
  History,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  UserCheck,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { SecureVideoPlayer } from '../components/SecureVideoPlayer';
import { useAuth } from '../context/AuthContext';
import { Badge, type BadgeTone } from '../design-system/Badge';
import { Button } from '../design-system/Button';
import { Card } from '../design-system/Card';
import { ConfirmDialog } from '../design-system/ConfirmDialog';
import { EmptyState } from '../design-system/EmptyState';
import { Modal } from '../design-system/Modal';
import { useToast } from '../design-system/Toast';
import { api } from '../lib/api';
import { EDITORIAL_IMAGES } from '../shared/domain';
import { formatDateTimeReadable } from '../shared/i18n';
import type {
  ActivityDetail,
  ActivityPrepLevel,
  ActivityStatus,
  ActivitySummary,
  ActivityVersionSnapshot,
  AdminAgeGroupItem,
  AdminDomainItem,
  AdminOverviewResponse,
  AdminReviewerItem,
  AdminSubmissionItem,
  AdminUserItem,
  AgeGroup,
  LearningDomain,
  SubmissionReviewStatus,
  UnifiedAuditCategory,
  UnifiedAuditLogItem,
  UserRole,
} from '../shared/types';

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

// =========================================================================
// 1. REUSABLE DATA TABLE COMPONENT (SEARCH, SORT, PAGINATE)
// =========================================================================

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  accessor?: (item: T) => string | number | boolean | null | undefined;
  render?: (item: T) => React.ReactNode;
}

export interface AdminDataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T) => string;
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  filtersSlot?: React.ReactNode;
  actionsSlot?: React.ReactNode;
  emptyTitle?: string;
  emptyMessage?: string;
  loading?: boolean;
  initialPageSize?: number;
  initialSortKey?: string;
  initialSortDirection?: 'asc' | 'desc';
}

export function AdminDataTable<T extends object>({
  data,
  columns,
  keyExtractor,
  searchPlaceholder = 'Search records...',
  searchFilter,
  filtersSlot,
  actionsSlot,
  emptyTitle = 'No records found',
  emptyMessage = 'Try adjusting your search query or filters.',
  loading = false,
  initialPageSize = 10,
  initialSortKey,
  initialSortDirection = 'asc',
}: AdminDataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey ?? null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.trim().toLowerCase();
    if (searchFilter) {
      return data.filter((item) => searchFilter(item, q));
    }
    return data.filter((item) => {
      return columns.some((col) => {
        const val = col.accessor
          ? col.accessor(item)
          : (item as Record<string, unknown>)[col.key];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(q);
      });
    });
  }, [data, searchQuery, searchFilter, columns]);

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filteredData;

    return [...filteredData].sort((a, b) => {
      const valA = col.accessor
        ? col.accessor(a)
        : (a as Record<string, unknown>)[sortKey];
      const valB = col.accessor
        ? col.accessor(b)
        : (b as Record<string, unknown>)[sortKey];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredData, sortKey, sortDirection, columns]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

  const handleHeaderClick = (colKey: string, sortable?: boolean) => {
    if (!sortable) return;
    if (sortKey === colKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(colKey);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  return (
    <div className="bg-white rounded-2xl border border-cream-accent/60 shadow-sm overflow-hidden flex flex-col">
      <div className="p-4 sm:p-5 border-b border-cream-accent/60 bg-offwhite/40 flex flex-col sm:flex-row gap-3.5 sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-cream-accent rounded-xl text-charcoal placeholder-muted focus:outline-none focus:ring-2 focus:ring-sage focus:border-transparent transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-charcoal p-0.5 rounded-md"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {filtersSlot && <div className="flex flex-wrap items-center gap-2">{filtersSlot}</div>}
        </div>
        {actionsSlot && <div className="flex items-center gap-2 self-start sm:self-auto">{actionsSlot}</div>}
      </div>

      <div className="overflow-x-auto min-h-[220px]">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-8 h-8 border-3 border-sage border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted font-medium">Loading records...</p>
          </div>
        ) : sortedData.length === 0 ? (
          <div className="p-8">
            <EmptyState title={emptyTitle} description={emptyMessage} />
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-cream-accent/60 bg-cream/40 text-muted font-semibold text-xs tracking-wider uppercase">
                {columns.map((col) => {
                  const isSorted = sortKey === col.key;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      onClick={() => handleHeaderClick(col.key, col.sortable)}
                      className={`px-4 sm:px-6 py-3.5 select-none ${col.sortable ? 'cursor-pointer hover:bg-cream/70 hover:text-charcoal transition' : ''} ${col.className || ''}`}
                      aria-sort={isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col.header}</span>
                        {col.sortable && (
                          <span className="text-muted/70">
                            {isSorted ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-sage" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-sage" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-accent/40 text-charcoal">
              {paginatedData.map((item) => (
                <tr key={keyExtractor(item)} className="hover:bg-cream/20 transition-colors group">
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 sm:px-6 py-4 align-middle ${col.className || ''}`}>
                      {col.render
                        ? col.render(item)
                        : String(
                            col.accessor
                              ? col.accessor(item) ?? ''
                              : (item as Record<string, unknown>)[col.key] ?? ''
                          )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && sortedData.length > 0 && (
        <div className="p-4 sm:px-6 border-t border-cream-accent/60 bg-offwhite/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-cream-accent rounded-lg px-2 py-1 text-charcoal focus:outline-none focus:ring-1 focus:ring-sage"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span className="ml-2">
              Showing <span className="font-semibold text-charcoal">{startIndex + 1}</span>–
              <span className="font-semibold text-charcoal">{Math.min(startIndex + pageSize, sortedData.length)}</span> of{' '}
              <span className="font-semibold text-charcoal">{sortedData.length}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="mr-2">
              Page <span className="font-semibold text-charcoal">{safePage}</span> of{' '}
              <span className="font-semibold text-charcoal">{totalPages}</span>
            </span>
            <Button
              variant="subtle"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="subtle"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 2. CURRICULUM ACTIVITY MANAGEMENT MODULE
// =========================================================================

const POSTER_OPTIONS = [
  { label: 'Sunlit Floor Mat & Wooden Toys', url: EDITORIAL_IMAGES.heroMontessori },
  { label: 'Everyday Household Textures (Katori & Linen)', url: EDITORIAL_IMAGES.sensoryLinen },
  { label: 'Low Montessori Floor Mirror', url: EDITORIAL_IMAGES.tummyMirror },
  { label: 'Open Steel Cup & Wooden Stacker', url: EDITORIAL_IMAGES.everydayCup },
];

export function AdminActivityManager({
  ageGroups,
  learningDomains,
}: {
  ageGroups: AgeGroup[];
  learningDomains: LearningDomain[];
}) {
  const { notify } = useToast();
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState<string>('all');
  const [selectedDomainId, setSelectedDomainId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formAgeGroupId, setFormAgeGroupId] = useState('');
  const [formDomainId, setFormDomainId] = useState('');
  const [formObjectives, setFormObjectives] = useState<string[]>(['']);
  const [formDuration, setFormDuration] = useState(5);
  const [formPrepLevel, setFormPrepLevel] = useState<ActivityPrepLevel>('quick_setup');
  const [formMaterials, setFormMaterials] = useState<string[]>(['Safe household item', 'Clear floor mat']);
  const [newMaterialInput, setNewMaterialInput] = useState('');
  const [formSafety, setFormSafety] = useState('');
  const [formPoster, setFormPoster] = useState<string>(EDITORIAL_IMAGES.sensoryLinen);
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formStatus, setFormStatus] = useState<ActivityStatus>('draft');
  const [formChangeNote, setFormChangeNote] = useState('');

  const [formSteps, setFormSteps] = useState<
    Array<{ title: string; instructionText: string; caregiverTip: string }>
  >([
    { title: 'Prepare the floor space', instructionText: 'Set a clean mat with ample room.', caregiverTip: 'Ensure gentle lighting.' },
    { title: 'Demonstrate slowly', instructionText: 'Hold the item at baby eye level and wait for interest.', caregiverTip: 'Follow baby pace.' },
  ]);

  const [formRubric, setFormRubric] = useState<
    Array<{ label: string; description: string; weightPoints: number }>
  >([
    { label: 'Safe household setup', description: 'Clear mat, calm lighting, no sharp or choking hazards.', weightPoints: 50 },
    { label: 'Responsive caregiver pacing', description: 'Spoke softly, waited for baby cues without rushing.', weightPoints: 50 },
  ]);

  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [activeVersionActivityTitle, setActiveVersionActivityTitle] = useState('');
  const [versionsList, setVersionsList] = useState<ActivityVersionSnapshot[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewDetail, setPreviewDetail] = useState<ActivityDetail | null>(null);
  const [publishingFromPreview, setPublishingFromPreview] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<ActivitySummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ageQ = selectedAgeGroupId === 'all' ? undefined : selectedAgeGroupId;
      const domQ = selectedDomainId === 'all' ? undefined : selectedDomainId;
      const statQ = selectedStatus === 'all' ? undefined : (selectedStatus as ActivityStatus);
      const res = await api.getAdminActivities(ageQ, domQ, statQ);
      setActivities(res.activities);
    } catch (err: any) {
      setError(err.message || 'Unable to load activities.');
    } finally {
      setLoading(false);
    }
  }, [selectedAgeGroupId, selectedDomainId, selectedStatus]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const resetFormToCreate = () => {
    setEditingActivityId(null);
    setFormTitle('');
    setFormSummary('');
    setFormAgeGroupId(ageGroups[0]?.id || 'ag_6-9m');
    setFormDomainId(learningDomains[0]?.id || 'dom_cognitive');
    setFormObjectives(['Encourage visual focus', 'Promote curiosity through calm touch']);
    setFormDuration(5);
    setFormPrepLevel('quick_setup');
    setFormMaterials(['Clear cotton mat', 'Safe everyday katori or wooden rattle']);
    setNewMaterialInput('');
    setFormSafety('Always stay within arm’s reach on a low floor mat. Never use items with sharp edges or small detachable parts.');
    setFormPoster(EDITORIAL_IMAGES.sensoryLinen);
    setFormVideoUrl('');
    setFormStatus('draft');
    setFormChangeNote('Initial curriculum draft');
    setFormSteps([
      { title: 'Prepare the floor space', instructionText: 'Set a clean mat with ample room.', caregiverTip: 'Ensure gentle lighting.' },
      { title: 'Demonstrate slowly', instructionText: 'Hold the item at baby eye level and wait for interest.', caregiverTip: 'Follow baby pace.' },
    ]);
    setFormRubric([
      { label: 'Safe household setup', description: 'Clear mat, calm lighting, no sharp or choking hazards.', weightPoints: 50 },
      { label: 'Responsive caregiver pacing', description: 'Spoke softly, waited for baby cues without rushing.', weightPoints: 50 },
    ]);
  };

  const handleOpenEdit = async (id: string) => {
    setLoading(true);
    try {
      const res = await api.getAdminActivityDetail(id);
      const act = res.activity;
      setEditingActivityId(act.id);
      setFormTitle(act.title);
      setFormSummary(act.summary);
      setFormAgeGroupId(act.ageGroupId);
      setFormDomainId(act.domainId);
      setFormObjectives(act.objectives && act.objectives.length > 0 ? act.objectives : ['Encourage calm exploration']);
      setFormDuration(act.durationMinutes);
      setFormPrepLevel(act.prepLevel || 'quick_setup');
      setFormMaterials(act.materials);
      setNewMaterialInput('');
      setFormSafety(act.safetyNotes);
      setFormPoster(act.instructionalPosterUrl || EDITORIAL_IMAGES.sensoryLinen);
      setFormVideoUrl(act.instructionalVideoUrl || '');
      setFormStatus(act.status);
      setFormChangeNote('');
      setFormSteps(
        act.steps.map((s) => ({
          title: s.title,
          instructionText: s.instructionText,
          caregiverTip: s.caregiverTip || '',
        }))
      );
      setFormRubric(
        act.rubricCriteria.map((r) => ({
          label: r.label,
          description: r.description,
          weightPoints: r.weightPoints,
        }))
      );
      setEditorOpen(true);
    } catch (err: any) {
      notify({ tone: 'error', title: 'Could not load activity', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenVersions = async (activity: ActivitySummary) => {
    setActiveVersionActivityTitle(activity.title);
    setVersionModalOpen(true);
    setLoadingVersions(true);
    setExpandedVersionId(null);
    try {
      const res = await api.getAdminActivityVersions(activity.id);
      setVersionsList(res.versions);
    } catch (err: any) {
      notify({ tone: 'error', title: 'Unable to load version history', description: err.message });
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleOpenPreview = async (activityId: string) => {
    try {
      const res = await api.getAdminActivityDetail(activityId);
      setPreviewDetail(res.activity);
      setPreviewModalOpen(true);
    } catch (err: any) {
      notify({ tone: 'error', title: 'Preview unavailable', description: err.message });
    }
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    const weightSum = formRubric.reduce((sum, r) => sum + Number(r.weightPoints || 0), 0);
    if (weightSum !== 100) {
      notify({
        tone: 'warning',
        title: 'Rubric weight must equal 100 points',
        description: `Current total: ${weightSum} points. Please adjust criterion weights before saving.`,
      });
      return;
    }

    if (formSteps.length === 0 || formSteps.some((s) => !s.title.trim() || !s.instructionText.trim())) {
      notify({
        tone: 'warning',
        title: 'Complete all steps',
        description: 'Every step needs a title and clear instruction text.',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ageGroupId: formAgeGroupId,
        domainId: formDomainId,
        title: formTitle.trim(),
        summary: formSummary.trim(),
        objectives: formObjectives.filter((o) => o.trim().length > 0),
        durationMinutes: Number(formDuration),
        prepLevel: formPrepLevel,
        materials: formMaterials,
        safetyNotes: formSafety.trim(),
        instructionalPosterUrl: formPoster,
        instructionalVideoUrl: formVideoUrl.trim() || null,
        status: formStatus,
        changeNote: formChangeNote.trim() || null,
        steps: formSteps.map((s) => ({
          title: s.title.trim(),
          instructionText: s.instructionText.trim(),
          caregiverTip: s.caregiverTip.trim() || null,
        })),
        rubricCriteria: formRubric.map((r) => ({
          label: r.label.trim(),
          description: r.description.trim(),
          weightPoints: Number(r.weightPoints),
        })),
      };

      await api.saveAdminActivity(editingActivityId, payload);
      notify({
        tone: 'success',
        title: editingActivityId ? 'Activity updated' : 'Activity created',
        description: `"${formTitle}" is now ${formStatus}.`,
      });
      setEditorOpen(false);
      void loadActivities();
    } catch (err: any) {
      notify({
        tone: 'error',
        title: 'Failed to save activity',
        description: err.message || 'Please check all required fields.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusChange = async (act: ActivitySummary, nextStatus: ActivityStatus) => {
    try {
      await api.updateAdminActivityStatus(act.id, nextStatus);
      notify({
        tone: 'success',
        title: `Status changed to ${nextStatus}`,
        description: `Activity "${act.title}" is now ${nextStatus}.`,
      });
      void loadActivities();
    } catch (err: any) {
      notify({ tone: 'error', title: 'Status update failed', description: err.message });
    }
  };

  const handleConfirmPublishFromPreview = async () => {
    if (!previewDetail) return;
    setPublishingFromPreview(true);
    try {
      await api.updateAdminActivityStatus(previewDetail.id, 'published');
      notify({
        tone: 'success',
        title: 'Activity published to parents',
        description: `"${previewDetail.title}" is now active in daily plans.`,
      });
      setPreviewModalOpen(false);
      void loadActivities();
    } catch (err: any) {
      notify({ tone: 'error', title: 'Publish failed', description: err.message });
    } finally {
      setPublishingFromPreview(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!activityToDelete) return;
    setDeleting(true);
    try {
      await api.deleteAdminActivity(activityToDelete.id);
      notify({
        tone: 'info',
        title: 'Activity removed',
        description: `"${activityToDelete.title}" has been deleted.`,
      });
      setDeleteConfirmOpen(false);
      setActivityToDelete(null);
      void loadActivities();
    } catch (err: any) {
      notify({
        tone: 'error',
        title: 'Could not delete activity',
        description: err.message || 'If video submissions exist, please archive instead.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const columns: ColumnDef<ActivitySummary>[] = [
    {
      key: 'title',
      header: 'Activity Title',
      sortable: true,
      className: 'font-medium',
      render: (item) => (
        <div className="flex flex-col">
          <span className="text-charcoal font-semibold text-sm line-clamp-1">{item.title}</span>
          <span className="text-muted text-xs line-clamp-1">{item.summary}</span>
        </div>
      ),
    },
    {
      key: 'ageGroupLabel',
      header: 'Age Group',
      sortable: true,
      className: 'whitespace-nowrap',
      render: (item) => (
        <span className="inline-flex items-center text-xs font-medium text-charcoal bg-cream/70 px-2.5 py-1 rounded-lg border border-cream-accent/50">
          {item.ageGroupLabel}
        </span>
      ),
    },
    {
      key: 'domainName',
      header: 'Domain',
      sortable: true,
      className: 'whitespace-nowrap',
      render: (item) => <span className="text-xs text-charcoal">{item.domainName}</span>,
    },
    {
      key: 'durationMinutes',
      header: 'Duration',
      sortable: true,
      className: 'whitespace-nowrap text-xs text-muted',
      render: (item) => (
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-muted" />
          <span>{item.durationMinutes} min</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status & Version',
      sortable: true,
      className: 'whitespace-nowrap',
      render: (item) => {
        const tone: BadgeTone =
          item.status === 'published' ? 'sage' : item.status === 'draft' ? 'peach' : 'lavender';
        return (
          <div className="flex items-center gap-2">
            <Badge tone={tone}>{item.status.toUpperCase()}</Badge>
            <span className="text-[11px] font-mono text-muted bg-cream-accent/40 px-1.5 py-0.5 rounded">
              v{item.version ?? 1}
            </span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'whitespace-nowrap text-right',
      render: (item) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="subtle"
            size="sm"
            onClick={() => void handleOpenPreview(item.id)}
            title="Preview parent view"
            aria-label={`Preview ${item.title}`}
          >
            <Eye className="w-4 h-4 text-muted hover:text-charcoal" />
          </Button>

          <Button
            variant="subtle"
            size="sm"
            onClick={() => void handleOpenVersions(item)}
            title="Version history"
            aria-label={`Version history for ${item.title}`}
          >
            <History className="w-4 h-4 text-muted hover:text-charcoal" />
          </Button>

          <Button
            variant="subtle"
            size="sm"
            onClick={() => void handleOpenEdit(item.id)}
            title="Edit activity"
            aria-label={`Edit ${item.title}`}
          >
            <FileEdit className="w-4 h-4 text-sage hover:text-sage-dark" />
          </Button>

          {item.status === 'draft' && (
            <Button
              variant="subtle"
              size="sm"
              onClick={() => void handleQuickStatusChange(item, 'published')}
              title="Publish immediately"
              aria-label={`Publish ${item.title}`}
            >
              <CheckCircle2 className="w-4 h-4 text-sage" />
            </Button>
          )}

          {item.status === 'published' && (
            <Button
              variant="subtle"
              size="sm"
              onClick={() => void handleQuickStatusChange(item, 'archived')}
              title="Archive activity"
              aria-label={`Archive ${item.title}`}
            >
              <Archive className="w-4 h-4 text-muted hover:text-amber-600" />
            </Button>
          )}

          <Button
            variant="subtle"
            size="sm"
            onClick={() => {
              setActivityToDelete(item);
              setDeleteConfirmOpen(true);
            }}
            title="Delete activity"
            aria-label={`Delete ${item.title}`}
          >
            <Trash2 className="w-4 h-4 text-muted hover:text-red-600" />
          </Button>
        </div>
      ),
    },
  ];

  const currentRubricSum = formRubric.reduce((sum, r) => sum + Number(r.weightPoints || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-cream/30 p-6 rounded-2xl border border-cream-accent/60">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-charcoal tracking-tight">
            Curriculum Activity Management
          </h2>
          <p className="text-sm text-muted mt-1 leading-relaxed max-w-2xl">
            Author and publish expert-verified developmental play activities. Every change snapshots
            a version so that existing caregiver submissions remain pinned to their historical rubric.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            resetFormToCreate();
            setEditorOpen(true);
          }}
          className="self-start sm:self-auto shrink-0 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Activity</span>
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <AdminDataTable<ActivitySummary>
        data={activities}
        columns={columns}
        keyExtractor={(item) => item.id}
        loading={loading}
        searchPlaceholder="Search by activity title or summary..."
        emptyTitle="No curriculum activities match"
        emptyMessage="Try selecting a different age group or status filter."
        filtersSlot={
          <>
            <select
              value={selectedAgeGroupId}
              onChange={(e) => setSelectedAgeGroupId(e.target.value)}
              className="text-xs bg-white border border-cream-accent rounded-xl px-3 py-2 text-charcoal focus:ring-1 focus:ring-sage focus:outline-none"
              aria-label="Filter by age group"
            >
              <option value="all">All Age Groups</option>
              {ageGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>

            <select
              value={selectedDomainId}
              onChange={(e) => setSelectedDomainId(e.target.value)}
              className="text-xs bg-white border border-cream-accent rounded-xl px-3 py-2 text-charcoal focus:ring-1 focus:ring-sage focus:outline-none"
              aria-label="Filter by development domain"
            >
              <option value="all">All Domains</option>
              {learningDomains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs bg-white border border-cream-accent rounded-xl px-3 py-2 text-charcoal focus:ring-1 focus:ring-sage focus:outline-none"
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published Only</option>
              <option value="draft">Drafts Only</option>
              <option value="archived">Archived Only</option>
            </select>
          </>
        }
      />

      <Modal
        open={editorOpen}
        onClose={() => !saving && setEditorOpen(false)}
        title={editingActivityId ? 'Edit Curriculum Activity' : 'Create New Activity'}
        size="lg"
      >
        <form onSubmit={handleSaveActivity} className="space-y-6 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">
                Activity Title *
              </label>
              <input
                type="text"
                required
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g., Tummy Time with Low Mirror"
                className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">
                Summary (Parent Overview) *
              </label>
              <textarea
                required
                rows={2}
                value={formSummary}
                onChange={(e) => setFormSummary(e.target.value)}
                placeholder="Brief, encouraging description of the play moment."
                className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Age Group *</label>
              <select
                required
                value={formAgeGroupId}
                onChange={(e) => setFormAgeGroupId(e.target.value)}
                className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
              >
                {ageGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label} ({g.minMonths}–{g.maxMonths}m)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Development Domain *</label>
              <select
                required
                value={formDomainId}
                onChange={(e) => setFormDomainId(e.target.value)}
                className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
              >
                {learningDomains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Estimated Duration (Minutes) *</label>
              <input
                type="number"
                min={1}
                max={30}
                required
                value={formDuration}
                onChange={(e) => setFormDuration(Number(e.target.value))}
                className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Preparation Level</label>
              <select
                value={formPrepLevel}
                onChange={(e) => setFormPrepLevel(e.target.value as ActivityPrepLevel)}
                className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
              >
                <option value="no_prep">No Prep (Ready now)</option>
                <option value="quick_setup">Quick Setup (&lt; 2 minutes)</option>
                <option value="guided_prep">Guided Prep (Gather household items)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-cream-accent/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">
                Learning & Bonding Objectives
              </label>
              <button
                type="button"
                onClick={() => setFormObjectives([...formObjectives, ''])}
                className="text-xs text-sage hover:underline flex items-center gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add Objective
              </button>
            </div>
            {formObjectives.map((obj, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={obj}
                  onChange={(e) => {
                    const next = [...formObjectives];
                    next[idx] = e.target.value;
                    setFormObjectives(next);
                  }}
                  placeholder="e.g., Encourage neck and core strength"
                  className="flex-1 text-sm bg-white border border-cream-accent rounded-xl px-3 py-2 text-charcoal focus:ring-1 focus:ring-sage focus:outline-none"
                />
                {formObjectives.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setFormObjectives(formObjectives.filter((_, i) => i !== idx))}
                    className="p-1.5 text-muted hover:text-red-600 rounded-lg"
                    aria-label="Remove objective"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2 border-t border-cream-accent/60">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">
              Required Household Materials *
            </label>
            <div className="flex flex-wrap gap-2">
              {formMaterials.map((mat, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 bg-cream/70 border border-cream-accent px-3 py-1 rounded-full text-xs text-charcoal font-medium"
                >
                  <span>{mat}</span>
                  <button
                    type="button"
                    onClick={() => setFormMaterials(formMaterials.filter((_, i) => i !== idx))}
                    className="text-muted hover:text-red-600"
                    aria-label={`Remove ${mat}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newMaterialInput}
                onChange={(e) => setNewMaterialInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newMaterialInput.trim()) {
                      setFormMaterials([...formMaterials, newMaterialInput.trim()]);
                      setNewMaterialInput('');
                    }
                  }
                }}
                placeholder="Type item and press Add (e.g., Soft cotton washcloth)"
                className="flex-1 text-sm bg-white border border-cream-accent rounded-xl px-3 py-2 text-charcoal focus:ring-1 focus:ring-sage focus:outline-none"
              />
              <Button
                type="button"
                variant="subtle"
                size="sm"
                onClick={() => {
                  if (newMaterialInput.trim()) {
                    setFormMaterials([...formMaterials, newMaterialInput.trim()]);
                    setNewMaterialInput('');
                  }
                }}
              >
                Add Item
              </Button>
            </div>
          </div>

          <div className="space-y-1 pt-2 border-t border-cream-accent/60">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider flex items-center gap-1.5 text-amber-800">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              Safety & Comfort Guidelines *
            </label>
            <textarea
              required
              rows={2}
              value={formSafety}
              onChange={(e) => setFormSafety(e.target.value)}
              placeholder="Crucial floor and material safety instructions for the caregiver."
              className="w-full text-sm bg-amber-50/40 border border-amber-200 rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-cream-accent/60">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">
                Instructional Poster Visual
              </label>
              <select
                value={formPoster}
                onChange={(e) => setFormPoster(e.target.value)}
                className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2 text-charcoal focus:ring-1 focus:ring-sage focus:outline-none"
              >
                {POSTER_OPTIONS.map((p) => (
                  <option key={p.url} value={p.url}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">
                Instructional Video URL (Optional)
              </label>
              <input
                type="text"
                value={formVideoUrl}
                onChange={(e) => setFormVideoUrl(e.target.value)}
                placeholder="https://... or /media/guide.mp4"
                className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2 text-charcoal focus:ring-1 focus:ring-sage focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-cream-accent/60">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-charcoal">Step-by-Step Instructions</h4>
                <p className="text-xs text-muted">Clear, unhurried steps for the caregiver.</p>
              </div>
              <Button
                type="button"
                variant="subtle"
                size="sm"
                onClick={() =>
                  setFormSteps([
                    ...formSteps,
                    { title: `Step ${formSteps.length + 1}`, instructionText: '', caregiverTip: '' },
                  ])
                }
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Step
              </Button>
            </div>

            {formSteps.map((s, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-cream/30 rounded-xl border border-cream-accent/50 space-y-2 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sage-dark uppercase tracking-wider">
                    Step {idx + 1}
                  </span>
                  {formSteps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setFormSteps(formSteps.filter((_, i) => i !== idx))}
                      className="text-muted hover:text-red-600 p-1 rounded"
                      aria-label={`Remove step ${idx + 1}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={s.title}
                  onChange={(e) => {
                    const next = [...formSteps];
                    next[idx].title = e.target.value;
                    setFormSteps(next);
                  }}
                  placeholder="Step Title (e.g., Lower to floor gently)"
                  className="w-full text-xs font-semibold bg-white border border-cream-accent rounded-lg px-2.5 py-1.5 text-charcoal focus:ring-1 focus:ring-sage focus:outline-none"
                />
                <textarea
                  required
                  rows={2}
                  value={s.instructionText}
                  onChange={(e) => {
                    const next = [...formSteps];
                    next[idx].instructionText = e.target.value;
                    setFormSteps(next);
                  }}
                  placeholder="Clear instructions for what the caregiver does..."
                  className="w-full text-xs bg-white border border-cream-accent rounded-lg px-2.5 py-1.5 text-charcoal focus:ring-1 focus:ring-sage focus:outline-none resize-none"
                />
                <input
                  type="text"
                  value={s.caregiverTip}
                  onChange={(e) => {
                    const next = [...formSteps];
                    next[idx].caregiverTip = e.target.value;
                    setFormSteps(next);
                  }}
                  placeholder="Optional gentle coaching tip (e.g., Pause if baby turns away)"
                  className="w-full text-xs italic bg-white/70 border border-cream-accent/60 rounded-lg px-2.5 py-1 text-muted focus:ring-1 focus:ring-sage focus:outline-none"
                />
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-3 border-t border-cream-accent/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-charcoal">Instruction Match Rubric</h4>
                <p className="text-xs text-muted">
                  Used by authorized reviewers to evaluate whether instructions were followed.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    currentRubricSum === 100
                      ? 'bg-sage/10 text-sage-dark border-sage/30'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  Total Weight: {currentRubricSum} / 100 pts
                </span>
                <Button
                  type="button"
                  variant="subtle"
                  size="sm"
                  onClick={() =>
                    setFormRubric([
                      ...formRubric,
                      { label: 'Additional Criterion', description: '', weightPoints: 20 },
                    ])
                  }
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Criterion
                </Button>
              </div>
            </div>

            {formRubric.map((r, idx) => (
              <div key={idx} className="p-3.5 bg-cream/30 rounded-xl border border-cream-accent/50 space-y-2">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    required
                    value={r.label}
                    onChange={(e) => {
                      const next = [...formRubric];
                      next[idx].label = e.target.value;
                      setFormRubric(next);
                    }}
                    placeholder="Criterion label (e.g., Safe household setup)"
                    className="flex-1 text-xs font-semibold bg-white border border-cream-accent rounded-lg px-2.5 py-1.5 text-charcoal focus:ring-1 focus:ring-sage focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted">Weight:</span>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      step={5}
                      required
                      value={r.weightPoints}
                      onChange={(e) => {
                        const next = [...formRubric];
                        next[idx].weightPoints = Number(e.target.value);
                        setFormRubric(next);
                      }}
                      className="w-16 text-xs text-center font-bold bg-white border border-cream-accent rounded-lg px-2 py-1 text-charcoal focus:ring-1 focus:ring-sage focus:outline-none"
                    />
                    <span className="text-xs text-muted">pts</span>
                  </div>
                  {formRubric.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setFormRubric(formRubric.filter((_, i) => i !== idx))}
                      className="text-muted hover:text-red-600 p-1 rounded"
                      aria-label="Remove criterion"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <textarea
                  required
                  rows={2}
                  value={r.description}
                  onChange={(e) => {
                    const next = [...formRubric];
                    next[idx].description = e.target.value;
                    setFormRubric(next);
                  }}
                  placeholder="Clear description of what constitutes meeting this criterion..."
                  className="w-full text-xs bg-white border border-cream-accent rounded-lg px-2.5 py-1.5 text-charcoal focus:ring-1 focus:ring-sage focus:outline-none resize-none"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-cream-accent/60">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">
                Publication Status *
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as ActivityStatus)}
                className="w-full text-sm font-semibold bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
              >
                <option value="draft">Draft (Visible only to curriculum admins)</option>
                <option value="published">Published (Live for parents and reviewers)</option>
                <option value="archived">Archived (Preserved for past review history)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">
                Version Change Note (Audit trail)
              </label>
              <input
                type="text"
                value={formChangeNote}
                onChange={(e) => setFormChangeNote(e.target.value)}
                placeholder="e.g., Refined safety wording and clarified step 2"
                className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-cream-accent/60 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="subtle"
              onClick={() => setEditorOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={currentRubricSum !== 100}
            >
              {editingActivityId ? 'Update & Snapshot Version' : 'Create Activity'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={versionModalOpen}
        onClose={() => setVersionModalOpen(false)}
        title={`Version History · ${activeVersionActivityTitle}`}
        size="md"
      >
        <div className="space-y-4 pb-4">
          <p className="text-xs text-muted leading-relaxed">
            LittleSteps automatically captures an immutable snapshot on every change. Past video
            submissions stay permanently evaluated against the exact version in effect when submitted.
          </p>

          {loadingVersions ? (
            <div className="py-12 flex justify-center">
              <div className="w-7 h-7 border-3 border-sage border-t-transparent rounded-full animate-spin" />
            </div>
          ) : versionsList.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">
              No version history records found for this activity.
            </div>
          ) : (
            <div className="space-y-3">
              {versionsList.map((ver) => {
                const isExpanded = expandedVersionId === ver.id;
                return (
                  <div
                    key={ver.id}
                    className="p-4 bg-cream/30 rounded-xl border border-cream-accent/60 space-y-2 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold bg-sage text-white px-2 py-0.5 rounded-full">
                          v{ver.versionNumber}
                        </span>
                        <span className="text-xs text-charcoal font-semibold">
                          {ver.createdByName || 'Curriculum Admin'}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted">
                        {formatDateTimeReadable(ver.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-charcoal italic bg-white/70 p-2 rounded-lg border border-cream-accent/40">
                      "{ver.changeNote || 'Curriculum content snapshot'}"
                    </p>

                    <div className="flex items-center justify-between text-xs text-muted pt-1">
                      <span>
                        Linked submissions:{' '}
                        <strong className="text-charcoal font-semibold">
                          {ver.linkedSubmissionsCount}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedVersionId(isExpanded ? null : ver.id)}
                        className="text-sage hover:underline font-medium text-xs flex items-center gap-1"
                      >
                        {isExpanded ? 'Hide snapshot details' : 'Inspect snapshot'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-cream-accent/40 text-xs text-charcoal space-y-2 bg-white p-3 rounded-lg">
                        <div>
                          <strong>Title:</strong> {ver.snapshot.title}
                        </div>
                        <div>
                          <strong>Materials:</strong> {ver.snapshot.materials.join(', ')}
                        </div>
                        <div>
                          <strong>Steps ({ver.snapshot.steps.length}):</strong>
                          <ol className="list-decimal list-inside mt-1 space-y-0.5">
                            {ver.snapshot.steps.map((st) => (
                              <li key={st.stepNumber}>
                                <strong>{st.title}:</strong> {st.instructionText}
                              </li>
                            ))}
                          </ol>
                        </div>
                        <div>
                          <strong>Rubric Criteria ({ver.snapshot.rubricCriteria.length}):</strong>
                          <ul className="list-disc list-inside mt-1 space-y-0.5">
                            {ver.snapshot.rubricCriteria.map((rc) => (
                              <li key={rc.criterionOrder}>
                                {rc.label} ({rc.weightPoints} pts)
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title="Parent View Preview"
        size="lg"
      >
        {previewDetail && (
          <div className="space-y-5 pb-4">
            <div className="flex items-center justify-between pb-3 border-b border-cream-accent/60">
              <div className="flex items-center gap-2">
                <Badge tone={previewDetail.status === 'published' ? 'sage' : 'peach'}>
                  {previewDetail.status.toUpperCase()}
                </Badge>
                <span className="text-xs text-muted">Version {previewDetail.version}</span>
              </div>
              {previewDetail.status !== 'published' && (
                <Button
                  variant="primary"
                  size="sm"
                  loading={publishingFromPreview}
                  onClick={handleConfirmPublishFromPreview}
                  className="flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Publish</span>
                </Button>
              )}
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-cream-accent/80 bg-offwhite">
              <img
                src={previewDetail.instructionalPosterUrl}
                alt={previewDetail.title}
                className="w-full h-48 object-cover"
              />
              <div className="p-4 bg-white/95">
                <div className="flex items-center gap-2 text-xs text-sage-dark font-medium mb-1">
                  <span>{previewDetail.domainName}</span>
                  <span>•</span>
                  <span>{previewDetail.ageGroupLabel}</span>
                  <span>•</span>
                  <span>{previewDetail.durationMinutes} min</span>
                </div>
                <h3 className="text-xl font-serif font-bold text-charcoal">{previewDetail.title}</h3>
                <p className="text-sm text-muted mt-1 leading-relaxed">{previewDetail.summary}</p>
              </div>
            </div>

            {previewDetail.objectives && previewDetail.objectives.length > 0 && (
              <div className="p-4 bg-cream/30 rounded-xl border border-cream-accent/60">
                <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider mb-2">
                  Bonding & Development Focus
                </h4>
                <ul className="list-disc list-inside text-xs text-charcoal space-y-1">
                  {previewDetail.objectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="p-4 bg-white rounded-xl border border-cream-accent/60">
              <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider mb-2">
                Household Items Needed
              </h4>
              <div className="flex flex-wrap gap-2">
                {previewDetail.materials.map((m, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-cream/60 rounded-full text-xs text-charcoal font-medium border border-cream-accent/50"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                Caregiver Safety Guidelines
              </h4>
              <p className="text-xs text-amber-950 leading-relaxed">{previewDetail.safetyNotes}</p>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider">
                Step-by-Step Parent Experience
              </h4>
              {previewDetail.steps.map((st) => (
                <div
                  key={st.stepNumber}
                  className="p-3.5 bg-offwhite/60 rounded-xl border border-cream-accent/50 flex gap-3"
                >
                  <div className="w-6 h-6 rounded-full bg-sage text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {st.stepNumber}
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-sm font-semibold text-charcoal">{st.title}</h5>
                    <p className="text-xs text-muted leading-relaxed">{st.instructionText}</p>
                    {st.caregiverTip && (
                      <p className="text-xs italic text-sage-dark bg-sage/5 px-2.5 py-1 rounded-md border border-sage/20 mt-1">
                        💡 {st.caregiverTip}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-cream/20 rounded-xl border border-cream-accent/60 space-y-2">
              <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider">
                Evaluator Rubric Criteria (100 Points Total)
              </h4>
              <div className="space-y-2">
                {previewDetail.rubricCriteria.map((r) => (
                  <div
                    key={r.criterionOrder}
                    className="p-2.5 bg-white rounded-lg border border-cream-accent/50 flex items-center justify-between text-xs"
                  >
                    <div>
                      <strong className="text-charcoal">{r.label}</strong>
                      <p className="text-muted text-[11px]">{r.description}</p>
                    </div>
                    <span className="font-bold text-sage-dark shrink-0 ml-3">
                      {r.weightPoints} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Activity?"
        message={`Are you sure you want to permanently delete "${activityToDelete?.title}"? If caregiver video submissions have already been linked to this activity, it cannot be deleted and should be archived instead.`}
        confirmLabel="Delete Activity"
        destructive
        loading={deleting}
      />
    </div>
  );
}

// =========================================================================
// 3. AGE GROUPS MANAGEMENT MODULE
// =========================================================================

export function AdminAgeGroupsModule({ onReloadCurriculum }: { onReloadCurriculum?: () => void }) {
  const { notify } = useToast();
  const [ageGroups, setAgeGroups] = useState<AdminAgeGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminAgeGroupItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [slug, setSlug] = useState('');
  const [label, setLabel] = useState('');
  const [minMonths, setMinMonths] = useState(0);
  const [maxMonths, setMaxMonths] = useState(3);
  const [sortOrder, setSortOrder] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminAgeGroups();
      setAgeGroups(res.ageGroups);
    } catch (err: any) {
      notify({ tone: 'error', title: 'Failed to load age groups', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setSlug('');
    setLabel('');
    setMinMonths(0);
    setMaxMonths(3);
    setSortOrder(ageGroups.length + 1);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: AdminAgeGroupItem) => {
    setEditingItem(item);
    setSlug(item.slug);
    setLabel(item.label);
    setMinMonths(item.minMonths);
    setMaxMonths(item.maxMonths);
    setSortOrder(item.sortOrder);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveAdminAgeGroup(editingItem ? editingItem.id : null, {
        slug: slug.trim().toLowerCase(),
        label: label.trim(),
        minMonths: Number(minMonths),
        maxMonths: Number(maxMonths),
        sortOrder: Number(sortOrder),
      });
      notify({
        tone: 'success',
        title: editingItem ? 'Age group updated' : 'Age group created',
        description: `Saved "${label}".`,
      });
      setModalOpen(false);
      void loadData();
      onReloadCurriculum?.();
    } catch (err: any) {
      notify({ tone: 'error', title: 'Error saving age group', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<AdminAgeGroupItem>[] = [
    {
      key: 'sortOrder',
      header: 'Order',
      sortable: true,
      className: 'w-16 font-mono text-muted text-xs',
    },
    {
      key: 'label',
      header: 'Age Group Label',
      sortable: true,
      className: 'font-semibold text-charcoal',
      render: (item) => (
        <div>
          <span>{item.label}</span>
          <span className="block text-xs font-mono text-muted font-normal">{item.slug}</span>
        </div>
      ),
    },
    {
      key: 'minMonths',
      header: 'Month Range',
      sortable: true,
      render: (item) => `${item.minMonths}–${item.maxMonths} months`,
    },
    {
      key: 'activityCount',
      header: 'Activities',
      sortable: true,
      render: (item) => (
        <span className="text-xs">
          <strong>{item.publishedActivityCount}</strong> published / {item.activityCount} total
        </span>
      ),
    },
    {
      key: 'childrenCount',
      header: 'Enrolled Babies',
      sortable: true,
      render: (item) => `${item.childrenCount} little ones`,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (item) => (
        <Button variant="subtle" size="sm" onClick={() => handleOpenEdit(item)}>
          <FileEdit className="w-4 h-4 text-sage hover:text-sage-dark" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-cream/30 p-6 rounded-2xl border border-cream-accent/60">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-charcoal">Age Group Management</h2>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            Manage the eight canonical Montessori developmental cohorts (0–24 months) and their milestones.
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenCreate} className="self-start sm:self-auto flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>New Age Group</span>
        </Button>
      </div>

      <AdminDataTable<AdminAgeGroupItem>
        data={ageGroups}
        columns={columns}
        keyExtractor={(item) => item.id}
        loading={loading}
        searchPlaceholder="Search age groups..."
      />

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingItem ? 'Edit Age Group' : 'Create Age Group'}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Label *</label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., 6–9 months"
              className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Slug (lowercase) *</label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g., 6-9m"
              className="w-full text-sm font-mono bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Min Mo. *</label>
              <input
                type="number"
                min={0}
                max={48}
                required
                value={minMonths}
                onChange={(e) => setMinMonths(Number(e.target.value))}
                className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Max Mo. *</label>
              <input
                type="number"
                min={1}
                max={60}
                required
                value={maxMonths}
                onChange={(e) => setMaxMonths(Number(e.target.value))}
                className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Sort Order *</label>
              <input
                type="number"
                min={1}
                max={100}
                required
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-cream-accent/60 flex justify-end gap-2">
            <Button type="button" variant="subtle" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {editingItem ? 'Update Age Group' : 'Create Age Group'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// =========================================================================
// 4. DEVELOPMENT DOMAINS MANAGEMENT MODULE
// =========================================================================

export function AdminDomainsModule({ onReloadCurriculum }: { onReloadCurriculum?: () => void }) {
  const { notify } = useToast();
  const [domains, setDomains] = useState<AdminDomainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminDomainItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminDomains();
      setDomains(res.domains);
    } catch (err: any) {
      notify({ tone: 'error', title: 'Failed to load domains', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setSlug('');
    setName('');
    setDescription('');
    setSortOrder(domains.length + 1);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: AdminDomainItem) => {
    setEditingItem(item);
    setSlug(item.slug);
    setName(item.name);
    setDescription(item.description);
    setSortOrder(item.sortOrder);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveAdminDomain(editingItem ? editingItem.id : null, {
        slug: slug.trim().toLowerCase(),
        name: name.trim(),
        description: description.trim(),
        sortOrder: Number(sortOrder),
      });
      notify({
        tone: 'success',
        title: editingItem ? 'Domain updated' : 'Domain created',
        description: `Saved "${name}".`,
      });
      setModalOpen(false);
      void loadData();
      onReloadCurriculum?.();
    } catch (err: any) {
      notify({ tone: 'error', title: 'Error saving domain', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<AdminDomainItem>[] = [
    {
      key: 'sortOrder',
      header: 'Order',
      sortable: true,
      className: 'w-16 font-mono text-muted text-xs',
    },
    {
      key: 'name',
      header: 'Domain Name',
      sortable: true,
      className: 'font-semibold text-charcoal',
      render: (item) => (
        <div>
          <span>{item.name}</span>
          <span className="block text-xs font-mono text-muted font-normal">{item.slug}</span>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      className: 'text-xs text-muted max-w-md',
      render: (item) => <p className="line-clamp-2">{item.description}</p>,
    },
    {
      key: 'activityCount',
      header: 'Activities',
      sortable: true,
      render: (item) => (
        <span className="text-xs">
          <strong>{item.publishedActivityCount}</strong> published / {item.activityCount} total
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (item) => (
        <Button variant="subtle" size="sm" onClick={() => handleOpenEdit(item)}>
          <FileEdit className="w-4 h-4 text-sage hover:text-sage-dark" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-cream/30 p-6 rounded-2xl border border-cream-accent/60">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-charcoal">Development Domain Management</h2>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            Configure the six whole-child developmental domains in the LittleSteps curriculum.
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenCreate} className="self-start sm:self-auto flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>New Domain</span>
        </Button>
      </div>

      <AdminDataTable<AdminDomainItem>
        data={domains}
        columns={columns}
        keyExtractor={(item) => item.id}
        loading={loading}
        searchPlaceholder="Search domains..."
      />

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingItem ? 'Edit Domain' : 'Create Domain'}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Domain Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sensory development"
              className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Slug (lowercase) *</label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g., sensory"
              className="w-full text-sm font-mono bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Description *</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Montessori guidance for this developmental area..."
              className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Sort Order *</label>
            <input
              type="number"
              min={1}
              max={100}
              required
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-cream-accent/60 flex justify-end gap-2">
            <Button type="button" variant="subtle" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {editingItem ? 'Update Domain' : 'Create Domain'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// =========================================================================
// 5. DAILY LEARNING PLAN MANAGEMENT MODULE
// =========================================================================

export function AdminDailyPlansModule({ ageGroups }: { ageGroups: AgeGroup[] }) {
  const { notify } = useToast();
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState(ageGroups[0]?.id || 'ag_6-9m');
  const [plans, setPlans] = useState<
    Array<{ id: string; dayNumber: number; title: string; focusNote: string; activityIds: string[] }>
  >([]);
  const [availableActivities, setAvailableActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [dayNumber, setDayNumber] = useState(1);
  const [title, setTitle] = useState('');
  const [focusNote, setFocusNote] = useState('');
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminDailyPlans(selectedAgeGroupId);
      setPlans(res.plans);
      setAvailableActivities(res.activities);
    } catch (err: any) {
      notify({ tone: 'error', title: 'Failed to load daily plans', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [selectedAgeGroupId, notify]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const handleOpenCreate = () => {
    setEditingPlanId(null);
    const nextDay = plans.length > 0 ? Math.max(...plans.map((p) => p.dayNumber)) + 1 : 1;
    setDayNumber(nextDay);
    setTitle(`Day ${nextDay} · Gentle Discovery`);
    setFocusNote('Take 10 calm minutes across today. Pause whenever baby wants to rest.');
    setSelectedActivityIds(availableActivities.slice(0, 2).map((a) => a.id));
    setEditorOpen(true);
  };

  const handleOpenEdit = (plan: (typeof plans)[0]) => {
    setEditingPlanId(plan.id);
    setDayNumber(plan.dayNumber);
    setTitle(plan.title);
    setFocusNote(plan.focusNote);
    setSelectedActivityIds(plan.activityIds);
    setEditorOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedActivityIds.length === 0) {
      notify({ tone: 'warning', title: 'Choose at least one activity', description: 'A daily plan must include activities.' });
      return;
    }
    const uniqueIds = new Set(selectedActivityIds);
    if (uniqueIds.size !== selectedActivityIds.length) {
      notify({ tone: 'warning', title: 'Duplicate activities detected', description: 'Each activity can only be included once per day.' });
      return;
    }

    setSaving(true);
    try {
      await api.saveAdminDailyPlan({
        ageGroupId: selectedAgeGroupId,
        dayNumber: Number(dayNumber),
        title: title.trim(),
        focusNote: focusNote.trim(),
        activityIds: selectedActivityIds,
      });
      notify({ tone: 'success', title: 'Daily plan saved', description: `Day ${dayNumber} plan is ready.` });
      setEditorOpen(false);
      void loadPlans();
    } catch (err: any) {
      notify({ tone: 'error', title: 'Could not save daily plan', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletePlanId) return;
    setDeleting(true);
    try {
      await api.deleteAdminDailyPlan(deletePlanId);
      notify({ tone: 'info', title: 'Plan deleted', description: 'Daily plan removed successfully.' });
      setDeletePlanId(null);
      void loadPlans();
    } catch (err: any) {
      notify({ tone: 'error', title: 'Delete failed', description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-cream/30 p-6 rounded-2xl border border-cream-accent/60">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-charcoal">Daily Learning Plans</h2>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            Curate structured daily sequences for each age cohort. Activities rotate through cognitive, motor, and language areas without overloading the family.
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenCreate} className="self-start sm:self-auto flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>New Daily Plan</span>
        </Button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-cream-accent/60">
        {ageGroups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setSelectedAgeGroupId(g.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              selectedAgeGroupId === g.id
                ? 'bg-sage text-white shadow-sm'
                : 'bg-white border border-cream-accent text-charcoal hover:bg-cream/40'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-muted">Loading daily plans...</div>
      ) : plans.length === 0 ? (
        <div className="p-12 bg-white rounded-2xl border border-cream-accent text-center text-sm text-muted">
          No daily plans configured for this age group yet. Click <strong>New Daily Plan</strong> to create Day 1.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-2xl border border-cream-accent/70 p-5 shadow-sm space-y-3 flex flex-col justify-between hover:border-sage/40 transition"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-sage-dark bg-sage/10 px-2.5 py-0.5 rounded-full border border-sage/20">
                    Day {p.dayNumber}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="subtle" size="sm" onClick={() => handleOpenEdit(p)}>
                      <FileEdit className="w-4 h-4 text-muted hover:text-sage" />
                    </Button>
                    <Button variant="subtle" size="sm" onClick={() => setDeletePlanId(p.id)}>
                      <Trash2 className="w-4 h-4 text-muted hover:text-red-600" />
                    </Button>
                  </div>
                </div>
                <h4 className="font-serif font-bold text-charcoal text-base">{p.title}</h4>
                <p className="text-xs text-muted mt-1 leading-relaxed line-clamp-2">{p.focusNote}</p>
              </div>

              <div className="pt-3 border-t border-cream-accent/50 space-y-1.5">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">
                  Activities ({p.activityIds.length})
                </span>
                <div className="space-y-1">
                  {p.activityIds.map((actId) => {
                    const act = availableActivities.find((a) => a.id === actId);
                    return (
                      <div
                        key={actId}
                        className="text-xs text-charcoal bg-cream/30 px-2.5 py-1.5 rounded-lg border border-cream-accent/40 flex items-center justify-between"
                      >
                        <span className="font-medium truncate mr-2">{act ? act.title : actId}</span>
                        {act && <span className="text-[10px] text-muted shrink-0">{act.domainName}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={editorOpen}
        onClose={() => !saving && setEditorOpen(false)}
        title={editingPlanId ? `Edit Day ${dayNumber} Plan` : 'Create Daily Plan'}
        size="md"
      >
        <form onSubmit={handleSavePlan} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Day # *</label>
              <input
                type="number"
                min={1}
                max={30}
                required
                value={dayNumber}
                onChange={(e) => setDayNumber(Number(e.target.value))}
                className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Plan Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Gentle Touch & Sounds"
                className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Parent Focus Note *</label>
            <textarea
              required
              rows={2}
              value={focusNote}
              onChange={(e) => setFocusNote(e.target.value)}
              placeholder="Calm reassurance for the mother..."
              className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none resize-none"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-cream-accent/60">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">
              Select Published Activities (1–4 activities) *
            </label>
            <div className="max-h-56 overflow-y-auto space-y-1.5 border border-cream-accent rounded-xl p-2 bg-cream/10">
              {availableActivities.length === 0 ? (
                <p className="text-xs text-muted p-3 text-center">
                  No published activities exist for this age group yet. Publish activities first in Activity Management.
                </p>
              ) : (
                availableActivities.map((act) => {
                  const isChecked = selectedActivityIds.includes(act.id);
                  return (
                    <label
                      key={act.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                        isChecked
                          ? 'bg-sage/10 border-sage/40 text-charcoal font-semibold'
                          : 'bg-white border-cream-accent/50 text-charcoal hover:bg-cream/20'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (selectedActivityIds.length >= 4) {
                              notify({
                                tone: 'warning',
                                title: 'Maximum 4 activities',
                                description: 'Keep daily plans gentle and manageable.',
                              });
                              return;
                            }
                            setSelectedActivityIds([...selectedActivityIds, act.id]);
                          } else {
                            setSelectedActivityIds(selectedActivityIds.filter((id) => id !== act.id));
                          }
                        }}
                        className="rounded text-sage focus:ring-sage"
                      />
                      <div className="flex-1 truncate">
                        <span>{act.title}</span>
                        <span className="block text-[11px] text-muted font-normal">
                          {act.domainName} • {act.durationMinutes} min
                        </span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-cream-accent/60 flex justify-end gap-2">
            <Button type="button" variant="subtle" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving} disabled={selectedActivityIds.length === 0}>
              Save Daily Plan
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletePlanId)}
        onClose={() => setDeletePlanId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Daily Plan?"
        message="Are you sure you want to delete this daily plan? Parents will no longer see this daily sequence."
        confirmLabel="Delete Plan"
        destructive
        loading={deleting}
      />
    </div>
  );
}

// =========================================================================
// 6. REVIEWER MANAGEMENT MODULE
// =========================================================================

export function AdminReviewersModule({ ageGroups }: { ageGroups: AgeGroup[] }) {
  const { notify } = useToast();
  const [reviewers, setReviewers] = useState<AdminReviewerItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [provisionOpen, setProvisionOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [allowedAgeSlugs, setAllowedAgeSlugs] = useState<string[]>([]);
  const [specialtyNote, setSpecialtyNote] = useState('');
  const [provisioning, setProvisioning] = useState(false);

  const [editItem, setEditItem] = useState<AdminReviewerItem | null>(null);
  const [editActive, setEditActive] = useState(true);
  const [editSlugs, setEditSlugs] = useState<string[]>([]);
  const [editSpecialty, setEditSpecialty] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminReviewers();
      setReviewers(res.reviewers);
    } catch (err: any) {
      notify({ tone: 'error', title: 'Failed to load reviewers', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleOpenProvision = () => {
    setEmail('');
    setFullName('');
    setPassword('');
    setAllowedAgeSlugs(ageGroups.map((g) => g.slug));
    setSpecialtyNote('');
    setProvisionOpen(true);
  };

  const handleOpenEdit = (item: AdminReviewerItem) => {
    setEditItem(item);
    setEditActive(item.isActive);
    setEditSlugs(item.allowedAgeGroupSlugs);
    setEditSpecialty(item.specialtyNote || '');
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      notify({ tone: 'warning', title: 'Password too short', description: 'Temporary password must be at least 8 characters.' });
      return;
    }
    setProvisioning(true);
    try {
      await api.createAdminReviewer({
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        password,
        allowedAgeGroupSlugs: allowedAgeSlugs,
        specialtyNote: specialtyNote.trim() || null,
      });
      notify({ tone: 'success', title: 'Reviewer account provisioned', description: `Welcome credentials created for ${fullName}.` });
      setProvisionOpen(false);
      void loadData();
    } catch (err: any) {
      notify({ tone: 'error', title: 'Provisioning failed', description: err.message });
    } finally {
      setProvisioning(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    setSavingEdit(true);
    try {
      await api.updateAdminReviewer(editItem.id, {
        isActive: editActive,
        allowedAgeGroupSlugs: editSlugs,
        specialtyNote: editSpecialty.trim() || null,
      });
      notify({ tone: 'success', title: 'Reviewer permissions updated', description: `Saved changes for ${editItem.fullName}.` });
      setEditItem(null);
      void loadData();
    } catch (err: any) {
      notify({ tone: 'error', title: 'Update failed', description: err.message });
    } finally {
      setSavingEdit(false);
    }
  };

  const columns: ColumnDef<AdminReviewerItem>[] = [
    {
      key: 'fullName',
      header: 'Reviewer',
      sortable: true,
      className: 'font-semibold text-charcoal',
      render: (item) => (
        <div>
          <span>{item.fullName}</span>
          <span className="block text-xs text-muted font-normal">{item.email}</span>
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Account Status',
      sortable: true,
      render: (item) => (
        <Badge tone={item.isActive ? 'sage' : 'peach'}>
          {item.isActive ? 'ACTIVE' : 'SUSPENDED'}
        </Badge>
      ),
    },
    {
      key: 'allowedAgeGroupSlugs',
      header: 'Authorized Age Cohorts',
      render: (item) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {item.allowedAgeGroupSlugs.length === 0 ? (
            <span className="text-xs text-muted italic">All cohorts allowed</span>
          ) : (
            item.allowedAgeGroupSlugs.map((slug) => (
              <span key={slug} className="text-[10px] font-mono bg-cream-accent/50 text-charcoal px-1.5 py-0.5 rounded">
                {slug}
              </span>
            ))
          )}
        </div>
      ),
    },
    {
      key: 'completedReviewsCount',
      header: 'Reviews Completed',
      sortable: true,
      render: (item) => `${item.completedReviewsCount} reviews`,
    },
    {
      key: 'activeAssignedCount',
      header: 'Queue Assigned',
      sortable: true,
      render: (item) => (
        <span className={item.activeAssignedCount > 0 ? 'font-semibold text-sage-dark' : 'text-muted'}>
          {item.activeAssignedCount} active
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (item) => (
        <Button variant="subtle" size="sm" onClick={() => handleOpenEdit(item)}>
          <FileEdit className="w-4 h-4 text-sage hover:text-sage-dark" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-cream/30 p-6 rounded-2xl border border-cream-accent/60">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-charcoal">Reviewer Management</h2>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            Provision authorized child-development reviewers and assign approved age-group cohorts.
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenProvision} className="self-start sm:self-auto flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          <span>Provision Reviewer</span>
        </Button>
      </div>

      <AdminDataTable<AdminReviewerItem>
        data={reviewers}
        columns={columns}
        keyExtractor={(item) => item.id}
        loading={loading}
        searchPlaceholder="Search reviewers by name or email..."
      />

      <Modal
        open={provisionOpen}
        onClose={() => !provisioning && setProvisionOpen(false)}
        title="Provision New Reviewer"
        size="md"
      >
        <form onSubmit={handleProvision} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Full Name *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g., Dr. Ananya Sharma"
              className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Email Address *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g., ananya.reviewer@littlesteps.in"
              className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Temporary Password *</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-cream-accent/60">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">
              Authorized Age Cohorts
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ageGroups.map((g) => {
                const checked = allowedAgeSlugs.includes(g.slug);
                return (
                  <label key={g.slug} className="flex items-center gap-2 text-xs text-charcoal cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAllowedAgeSlugs([...allowedAgeSlugs, g.slug]);
                        } else {
                          setAllowedAgeSlugs(allowedAgeSlugs.filter((s) => s !== g.slug));
                        }
                      }}
                      className="rounded text-sage focus:ring-sage"
                    />
                    <span>{g.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Specialty / Credentials Note</label>
            <input
              type="text"
              value={specialtyNote}
              onChange={(e) => setSpecialtyNote(e.target.value)}
              placeholder="e.g., Certified Montessori Infant Specialist (AMI)"
              className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-cream-accent/60 flex justify-end gap-2">
            <Button type="button" variant="subtle" onClick={() => setProvisionOpen(false)} disabled={provisioning}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={provisioning}>
              Provision Account
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editItem)}
        onClose={() => !savingEdit && setEditItem(null)}
        title={`Edit Permissions · ${editItem?.fullName}`}
        size="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Account Active</label>
            <select
              value={editActive ? '1' : '0'}
              onChange={(e) => setEditActive(e.target.value === '1')}
              className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
            >
              <option value="1">Active (Permitted to evaluate video submissions)</option>
              <option value="0">Suspended (Access revoked)</option>
            </select>
          </div>

          <div className="space-y-2 pt-2 border-t border-cream-accent/60">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">
              Authorized Age Cohorts
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ageGroups.map((g) => {
                const checked = editSlugs.includes(g.slug);
                return (
                  <label key={g.slug} className="flex items-center gap-2 text-xs text-charcoal cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditSlugs([...editSlugs, g.slug]);
                        } else {
                          setEditSlugs(editSlugs.filter((s) => s !== g.slug));
                        }
                      }}
                      className="rounded text-sage focus:ring-sage"
                    />
                    <span>{g.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Specialty Note</label>
            <input
              type="text"
              value={editSpecialty}
              onChange={(e) => setEditSpecialty(e.target.value)}
              className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-cream-accent/60 flex justify-end gap-2">
            <Button type="button" variant="subtle" onClick={() => setEditItem(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={savingEdit}>
              Save Permissions
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// =========================================================================
// 7. SUBMISSION MANAGEMENT MODULE
// =========================================================================

export function AdminSubmissionsModule() {
  const { notify } = useToast();
  const [submissions, setSubmissions] = useState<AdminSubmissionItem[]>([]);
  const [reviewers, setReviewers] = useState<AdminReviewerItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reviewerFilter, setReviewerFilter] = useState<string>('all');

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetSub, setTargetSub] = useState<AdminSubmissionItem | null>(null);
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectSub, setInspectSub] = useState<AdminSubmissionItem | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [subsRes, revsRes] = await Promise.all([
        api.getAdminSubmissions({
          status: statusFilter === 'all' ? undefined : (statusFilter as SubmissionReviewStatus),
          reviewerId: reviewerFilter === 'all' ? undefined : reviewerFilter,
        }),
        api.getAdminReviewers(),
      ]);
      setSubmissions(subsRes.submissions);
      setReviewers(revsRes.reviewers);
    } catch (err: any) {
      notify({ tone: 'error', title: 'Failed to load submissions', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, reviewerFilter, notify]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleOpenAssign = (sub: AdminSubmissionItem) => {
    setTargetSub(sub);
    setSelectedReviewerId(sub.assignedReviewerId || '');
    setAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSub) return;
    setAssigning(true);
    try {
      await api.assignAdminSubmissionReviewer(
        targetSub.submissionId,
        selectedReviewerId ? selectedReviewerId : null
      );
      notify({
        tone: 'success',
        title: 'Reviewer assigned',
        description: selectedReviewerId ? 'Submission moved to reviewer queue.' : 'Submission returned to open queue.',
      });
      setAssignModalOpen(false);
      void loadData();
    } catch (err: any) {
      notify({ tone: 'error', title: 'Assignment failed', description: err.message });
    } finally {
      setAssigning(false);
    }
  };

  const columns: ColumnDef<AdminSubmissionItem>[] = [
    {
      key: 'parentReference',
      header: 'Family Ref',
      className: 'font-mono text-xs font-bold text-charcoal',
      render: (item) => (
        <div>
          <span>{item.parentReference}</span>
          <span className="block text-[11px] font-normal text-muted">{item.ageGroupLabel}</span>
        </div>
      ),
    },
    {
      key: 'activityTitle',
      header: 'Activity Title',
      sortable: true,
      className: 'font-semibold text-charcoal',
      render: (item) => (
        <div>
          <span>{item.activityTitle}</span>
          <span className="block text-[11px] font-mono text-muted">v{item.activityVersion}</span>
        </div>
      ),
    },
    {
      key: 'reviewStatus',
      header: 'Review Status',
      sortable: true,
      render: (item) => {
        const tone: BadgeTone =
          item.reviewStatus === 'reviewed'
            ? 'sage'
            : item.reviewStatus === 'in_review'
              ? 'lavender'
              : item.reviewStatus === 'resubmit_requested'
                ? 'peach'
                : 'neutral';
        return <Badge tone={tone}>{item.reviewStatus.replace(/_/g, ' ').toUpperCase()}</Badge>;
      },
    },
    {
      key: 'assignedReviewerName',
      header: 'Assigned Reviewer',
      sortable: true,
      render: (item) => (
        <span className={item.assignedReviewerName ? 'text-charcoal font-medium text-xs' : 'text-muted italic text-xs'}>
          {item.assignedReviewerName || 'Unassigned (Open Queue)'}
        </span>
      ),
    },
    {
      key: 'instructionMatchScorePct',
      header: 'Match Score',
      sortable: true,
      render: (item) => (
        <span className="text-xs font-semibold">
          {item.isAssessable === false
            ? 'Not Assessable'
            : item.instructionMatchScorePct !== null
              ? `${item.instructionMatchScorePct}% match`
              : 'Pending'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Submitted',
      sortable: true,
      render: (item) => (
        <span className="text-xs text-muted">{formatDateTimeReadable(item.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (item) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="subtle"
            size="sm"
            onClick={() => {
              setInspectSub(item);
              setInspectModalOpen(true);
            }}
            title="Inspect submission record"
          >
            <Eye className="w-4 h-4 text-muted hover:text-charcoal" />
          </Button>

          <Button
            variant="subtle"
            size="sm"
            onClick={() => handleOpenAssign(item)}
            title="Assign reviewer"
          >
            <UserCheck className="w-4 h-4 text-sage hover:text-sage-dark" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-cream/30 p-6 rounded-2xl border border-cream-accent/60">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-charcoal">Submission Records & Queue</h2>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            Monitor incoming caregiver activity submissions, reassign reviewers, and inspect audit records.
          </p>
        </div>
      </div>

      <AdminDataTable<AdminSubmissionItem>
        data={submissions}
        columns={columns}
        keyExtractor={(item) => item.submissionId}
        loading={loading}
        searchPlaceholder="Search by activity title or submission ID..."
        filtersSlot={
          <>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-white border border-cream-accent rounded-xl px-3 py-2 text-charcoal focus:ring-1 focus:ring-sage focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="in_review">In Review</option>
              <option value="reviewed">Reviewed</option>
              <option value="resubmit_requested">Changes Requested</option>
              <option value="deleted">Purged</option>
            </select>

            <select
              value={reviewerFilter}
              onChange={(e) => setReviewerFilter(e.target.value)}
              className="text-xs bg-white border border-cream-accent rounded-xl px-3 py-2 text-charcoal focus:ring-1 focus:ring-sage focus:outline-none"
            >
              <option value="all">All Reviewers</option>
              <option value="unassigned">Unassigned Only</option>
              {reviewers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </>
        }
      />

      <Modal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Assign Submission to Reviewer"
        size="sm"
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <p className="text-xs text-muted leading-relaxed">
            Assign submission for <strong>{targetSub?.activityTitle}</strong> ({targetSub?.parentReference}) to a qualified reviewer.
          </p>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Reviewer</label>
            <select
              value={selectedReviewerId}
              onChange={(e) => setSelectedReviewerId(e.target.value)}
              className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
            >
              <option value="">Unassigned (Return to Open Queue)</option>
              {reviewers.map((r) => (
                <option key={r.id} value={r.id} disabled={!r.isActive}>
                  {r.fullName} {!r.isActive ? '(Suspended)' : ''} ({r.activeAssignedCount} active assigned)
                </option>
              ))}
            </select>
          </div>

          <div className="pt-3 border-t border-cream-accent/60 flex justify-end gap-2">
            <Button type="button" variant="subtle" onClick={() => setAssignModalOpen(false)} disabled={assigning}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={assigning}>
              Confirm Assignment
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={inspectModalOpen}
        onClose={() => setInspectModalOpen(false)}
        title="Submission Inspection Record"
        size="md"
      >
        {inspectSub && (
          <div className="space-y-4 text-xs text-charcoal">
            <div className="p-3 bg-cream/30 rounded-xl border border-cream-accent/60 space-y-1">
              <div>
                <strong>Submission ID:</strong> <span className="font-mono">{inspectSub.submissionId}</span>
              </div>
              <div>
                <strong>Family Reference:</strong> {inspectSub.parentReference}
              </div>
              <div>
                <strong>Activity:</strong> {inspectSub.activityTitle} (v{inspectSub.activityVersion})
              </div>
              <div>
                <strong>Status:</strong> {inspectSub.reviewStatus}
              </div>
              <div>
                <strong>Storage Vault Mode:</strong> {inspectSub.storageMode}
              </div>
              <div>
                <strong>Duration:</strong> {inspectSub.durationSeconds} seconds
              </div>
              <div>
                <strong>Submitted At:</strong> {formatDateTimeReadable(inspectSub.createdAt)}
              </div>
              <div>
                <strong>Retention Expiration:</strong> {formatDateTimeReadable(inspectSub.expiresAt)}
              </div>
            </div>

            {inspectSub.hasActiveVideo ? (
              <div className="space-y-2">
                <h5 className="font-bold uppercase tracking-wider text-charcoal">Encrypted Video Playback</h5>
                <SecureVideoPlayer
                  submissionId={inspectSub.submissionId}
                  hasActiveVideo={inspectSub.hasActiveVideo}
                  expiresAt={inspectSub.expiresAt}
                  deletionReason={inspectSub.deletionReason}
                  storageMode={inspectSub.storageMode}
                />
              </div>
            ) : (
              <div className="p-4 bg-offwhite border border-cream-accent rounded-xl text-center text-muted">
                {inspectSub.deletedAt
                  ? `Video purged per retention policy: "${inspectSub.deletionReason || '30-day privacy auto-purge'}"`
                  : 'No active video stream attached.'}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// =========================================================================
// 8. USER MANAGEMENT MODULE
// =========================================================================

export function AdminUsersModule() {
  const { notify } = useToast();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>('parent');
  const [targetActive, setTargetActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminUsers();
      setUsers(res.users);
    } catch (err: any) {
      notify({ tone: 'error', title: 'Failed to load users', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleOpenEdit = (user: AdminUserItem) => {
    setEditingUser(user);
    setTargetRole(user.role);
    setTargetActive(user.isActive);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSaving(true);
    try {
      await api.updateAdminUser(editingUser.id, {
        role: targetRole,
        isActive: targetActive,
      });
      notify({
        tone: 'success',
        title: 'Account updated',
        description: `Updated role and status for ${editingUser.fullName}.`,
      });
      setEditingUser(null);
      void loadData();
    } catch (err: any) {
      notify({ tone: 'error', title: 'Could not update account', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnDef<AdminUserItem>[] = [
    {
      key: 'fullName',
      header: 'User Account',
      sortable: true,
      className: 'font-semibold text-charcoal',
      render: (item) => (
        <div>
          <span>{item.fullName}</span>
          <span className="block text-xs text-muted font-normal">{item.email}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Platform Role',
      sortable: true,
      render: (item) => {
        const tone: BadgeTone =
          item.role === 'admin' ? 'lavender' : item.role === 'reviewer' ? 'sage' : 'neutral';
        return <Badge tone={tone}>{item.role.toUpperCase()}</Badge>;
      },
    },
    {
      key: 'isActive',
      header: 'Status',
      sortable: true,
      render: (item) => (
        <Badge tone={item.isActive ? 'sage' : 'peach'}>
          {item.isActive ? 'ACTIVE' : 'DISABLED'}
        </Badge>
      ),
    },
    {
      key: 'childrenCount',
      header: 'Family Profile',
      render: (item) => (
        <span className="text-xs text-muted">
          {item.childrenCount} {item.childrenCount === 1 ? 'child' : 'children'} • {item.submissionsCount} submissions
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      sortable: true,
      render: (item) => (
        <span className="text-xs text-muted">{formatDateTimeReadable(item.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (item) => (
        <Button variant="subtle" size="sm" onClick={() => handleOpenEdit(item)}>
          <FileEdit className="w-4 h-4 text-sage hover:text-sage-dark" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-cream/30 p-6 rounded-2xl border border-cream-accent/60">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-charcoal">User Account Management</h2>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            Manage parent, reviewer, and administrator roles. The platform safeguards against deleting or disabling the last active admin.
          </p>
        </div>
      </div>

      <AdminDataTable<AdminUserItem>
        data={users}
        columns={columns}
        keyExtractor={(item) => item.id}
        loading={loading}
        searchPlaceholder="Search users by name or email..."
      />

      <Modal
        open={Boolean(editingUser)}
        onClose={() => !saving && setEditingUser(null)}
        title={`Update Account · ${editingUser?.fullName}`}
        size="sm"
      >
        <form onSubmit={handleSaveUser} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Role *</label>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as UserRole)}
              className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
            >
              <option value="parent">Parent</option>
              <option value="reviewer">Reviewer</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">Account Active *</label>
            <select
              value={targetActive ? '1' : '0'}
              onChange={(e) => setTargetActive(e.target.value === '1')}
              className="w-full text-sm bg-white border border-cream-accent rounded-xl px-3.5 py-2.5 text-charcoal focus:ring-2 focus:ring-sage focus:outline-none"
            >
              <option value="1">Active</option>
              <option value="0">Disabled (Login Blocked)</option>
            </select>
          </div>

          <div className="pt-3 border-t border-cream-accent/60 flex justify-end gap-2">
            <Button type="button" variant="subtle" onClick={() => setEditingUser(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Update User
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// =========================================================================
// 9. AUDIT LOGS & RETENTION MODULE
// =========================================================================

export function AdminAuditLogsModule() {
  const { notify } = useToast();
  const [logs, setLogs] = useState<UnifiedAuditLogItem[]>([]);
  const [lastSweepAt, setLastSweepAt] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<UnifiedAuditCategory | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminAuditLogs({
        category: categoryFilter === 'all' ? undefined : categoryFilter,
      });
      setLogs(res.logs);
      setLastSweepAt(res.lastRetentionSweepAt);
    } catch (err: any) {
      notify({ tone: 'error', title: 'Failed to load audit logs', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, notify]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRunSweep = async () => {
    setSweeping(true);
    try {
      const res = await api.runAdminRetentionSweep();
      notify({
        tone: 'success',
        title: 'Retention sweep complete',
        description: `Purged ${res.purgedCount} expired private videos.`,
      });
      void loadData();
    } catch (err: any) {
      notify({ tone: 'error', title: 'Sweep failed', description: err.message });
    } finally {
      setSweeping(false);
    }
  };

  const columns: ColumnDef<UnifiedAuditLogItem>[] = [
    {
      key: 'createdAt',
      header: 'Timestamp',
      sortable: true,
      className: 'whitespace-nowrap text-xs text-muted font-mono w-48',
      render: (item) => formatDateTimeReadable(item.createdAt),
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      className: 'w-28',
      render: (item) => {
        const tone: BadgeTone =
          item.category === 'admin' ? 'lavender' : item.category === 'review' ? 'sage' : 'peach';
        return <Badge tone={tone}>{item.category.toUpperCase()}</Badge>;
      },
    },
    {
      key: 'actorName',
      header: 'Actor',
      sortable: true,
      render: (item) => (
        <div>
          <span className="font-semibold text-charcoal text-xs">{item.actorName}</span>
          <span className="block text-[10px] text-muted uppercase font-mono">{item.actorRole}</span>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      className: 'font-mono text-xs text-charcoal',
    },
    {
      key: 'summary',
      header: 'Audit Summary',
      className: 'text-xs text-charcoal max-w-lg',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-cream/30 p-6 rounded-2xl border border-cream-accent/60">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-charcoal">Platform Audit Logs & Retention</h2>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            Immutable tracking of administrative actions, reviewer evaluations, and private family video access.
          </p>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-cream-accent/70 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-sage" />
            <h4 className="font-serif font-bold text-charcoal text-base">30-Day Family Video Auto-Purge</h4>
          </div>
          <p className="text-xs text-muted max-w-xl leading-relaxed">
            LittleSteps automatically purges private caregiver recordings 30 days after upload. Last automated sweep:{' '}
            <strong className="text-charcoal font-semibold">
              {lastSweepAt ? formatDateTimeReadable(lastSweepAt) : 'Within past 24 hours'}
            </strong>.
          </p>
        </div>
        <Button
          variant="subtle"
          onClick={handleRunSweep}
          loading={sweeping}
          className="self-start sm:self-auto shrink-0 flex items-center gap-2 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Run Retention Sweep Now</span>
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {(['all', 'admin', 'review', 'media'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                categoryFilter === cat
                  ? 'bg-sage text-white shadow-sm'
                  : 'bg-white border border-cream-accent text-charcoal hover:bg-cream/40'
              }`}
            >
              {cat === 'all'
                ? 'All Audit Logs'
                : cat === 'admin'
                  ? 'Admin Actions'
                  : cat === 'review'
                    ? 'Review Decisions'
                    : 'Private Media Access'}
            </button>
          ))}
        </div>

        <AdminDataTable<UnifiedAuditLogItem>
          data={logs}
          columns={columns}
          keyExtractor={(item) => item.id}
          loading={loading}
          searchPlaceholder="Search audit logs..."
        />
      </div>
    </div>
  );
}

// =========================================================================
// 10. MAIN ADMIN CONSOLE VIEW (DASHBOARD + MODULE NAVIGATION)
// =========================================================================

export interface AdminConsoleViewProps {
  activeTab?: AdminTab;
  onTabChange?: (tab: AdminTab) => void;
  onLogout?: () => Promise<void>;
  onOpenDesignSystem?: () => void;
}

export function AdminConsoleView({
  activeTab = 'dashboard',
  onTabChange,
  onLogout,
  onOpenDesignSystem,
}: AdminConsoleViewProps) {
  const { ageGroups, learningDomains, user } = useAuth();

  const resolveTab = (tab: AdminTab): AdminTab => {
    if (tab === 'curriculum') return 'activities';
    if (tab === 'plans') return 'daily-plans';
    if (tab === 'privacy') return 'audit-logs';
    return tab;
  };

  const [currentTab, setCurrentTab] = useState<AdminTab>(resolveTab(activeTab));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setCurrentTab(resolveTab(activeTab));
  }, [activeTab]);

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
    <div className="min-h-screen flex flex-col md:flex-row bg-offwhite">
      <div className="md:hidden p-4 border-b border-border bg-surface flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          <BrandLogo size="sm" />
          <span className="font-display font-semibold text-charcoal">LittleSteps Admin</span>
        </div>
        <div className="flex items-center gap-2">
          {onLogout && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void onLogout()}
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              Sign Out
            </Button>
          )}
          <Button
            variant="subtle"
            size="sm"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      <aside
        aria-label="Admin navigation"
        className={`${
          mobileMenuOpen ? 'flex' : 'hidden'
        } md:flex flex-col w-full md:w-64 bg-surface border-r border-border p-4 md:sticky md:top-0 md:h-[100dvh] shrink-0 z-10`}
      >
        <div className="hidden md:flex items-center gap-2.5 px-3 py-3 mb-4 border-b border-border">
          <BrandLogo size="md" />
          <div>
            <h1 className="text-sm font-display font-semibold text-charcoal leading-tight">
              Admin Console
            </h1>
            <p className="text-[11px] text-muted">Platform Management</p>
          </div>
        </div>

        <nav className="space-y-1 flex-1 overflow-y-auto" aria-label="Admin modules">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  setCurrentTab(item.id);
                  onTabChange?.(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-sage text-white shadow-sm'
                    : 'text-charcoal hover:bg-cream/60 hover:text-charcoal'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-muted'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-4 pt-4 border-t border-border space-y-2 shrink-0">
          <div className="px-3 text-[11px] text-muted space-y-0.5">
            <p className="truncate">
              Signed in as: <strong className="text-charcoal">{user?.fullName}</strong>
            </p>
            <p className="text-sage font-medium">Administrator (Full Access)</p>
          </div>
          {onOpenDesignSystem && (
            <button
              type="button"
              onClick={onOpenDesignSystem}
              className="w-full min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-muted hover:bg-cream hover:text-charcoal transition-colors cursor-pointer"
            >
              <Palette className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Design System</span>
            </button>
          )}
          {onLogout && (
            <button
              type="button"
              onClick={() => void onLogout()}
              className="w-full min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-muted hover:bg-cream hover:text-charcoal transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-24 max-w-7xl mx-auto w-full focus:outline-none"
      >
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

            {overview && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <div className="bg-white p-4 rounded-2xl border border-cream-accent/70 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">Parents</span>
                  <div className="text-2xl font-bold font-serif text-charcoal">{overview.counts.totalParents}</div>
                  <span className="text-[10px] text-muted">Registered families</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-cream-accent/70 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">Children</span>
                  <div className="text-2xl font-bold font-serif text-charcoal">{overview.counts.totalChildren}</div>
                  <span className="text-[10px] text-muted">Enrolled babies</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-cream-accent/70 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">Activities</span>
                  <div className="text-2xl font-bold font-serif text-charcoal">{overview.counts.publishedActivities}</div>
                  <span className="text-[10px] text-muted">{overview.counts.totalActivities} in curriculum</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-cream-accent/70 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">Queue</span>
                  <div className="text-2xl font-bold font-serif text-charcoal">{overview.counts.pendingReviews}</div>
                  <span className="text-[10px] text-muted">Pending review</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-cream-accent/70 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">Reviews</span>
                  <div className="text-2xl font-bold font-serif text-charcoal">{overview.counts.completedReviews}</div>
                  <span className="text-[10px] text-muted">Evaluations completed</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-cream-accent/70 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block">Video Vault</span>
                  <div className="text-2xl font-bold font-serif text-sage-dark">{overview.counts.activeVideosCount}</div>
                  <span className="text-[10px] text-muted">{overview.counts.expiredPurgedCount} auto-purged</span>
                </div>
              </div>
            )}

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

        {currentTab === 'age-groups' && <AdminAgeGroupsModule onReloadCurriculum={loadOverview} />}
        {currentTab === 'domains' && <AdminDomainsModule onReloadCurriculum={loadOverview} />}
        {currentTab === 'activities' && (
          <AdminActivityManager ageGroups={ageGroups} learningDomains={learningDomains} />
        )}
        {currentTab === 'daily-plans' && <AdminDailyPlansModule ageGroups={ageGroups} />}
        {currentTab === 'reviewers' && <AdminReviewersModule ageGroups={ageGroups} />}
        {currentTab === 'submissions' && <AdminSubmissionsModule />}
        {currentTab === 'users' && <AdminUsersModule />}
        {currentTab === 'audit-logs' && <AdminAuditLogsModule />}
      </main>
    </div>
  );
}
