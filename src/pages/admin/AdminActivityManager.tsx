import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Clock,
  Eye,
  FileEdit,
  History,
  Layers,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
  UploadCloud,
  Video,
} from 'lucide-react';
import { Badge, type BadgeTone } from '../../design-system/Badge';
import { Button } from '../../design-system/Button';
import { Card } from '../../design-system/Card';
import { ConfirmDialog } from '../../design-system/ConfirmDialog';
import { Modal } from '../../design-system/Modal';
import { useToast } from '../../design-system/Toast';
import { api } from '../../lib/api';
import { EDITORIAL_IMAGES } from '../../shared/domain';
import { formatDateTimeReadable } from '../../shared/i18n';
import type {
  ActivityDetail,
  ActivityPrepLevel,
  ActivityStatus,
  ActivitySummary,
  ActivityVersionSnapshot,
  AgeGroup,
  LearningDomain,
} from '../../shared/types';
import { AdminDataTable, type ColumnDef } from './AdminDataTable';

const POSTER_OPTIONS = [
  { label: 'Sunlit Floor Mat & Wooden Toys', url: EDITORIAL_IMAGES.heroMontessori },
  { label: 'Everyday Household Textures (Katori & Linen)', url: EDITORIAL_IMAGES.sensoryLinen },
  { label: 'Low Montessori Floor Mirror', url: EDITORIAL_IMAGES.tummyMirror },
  { label: 'Open Steel Cup & Wooden Stacker', url: EDITORIAL_IMAGES.everydayCup },
];

export interface AdminActivityManagerProps {
  ageGroups: AgeGroup[];
  learningDomains: LearningDomain[];
}

export function AdminActivityManager({
  ageGroups,
  learningDomains,
}: AdminActivityManagerProps) {
  const { notify } = useToast();

  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState<string>('all');
  const [selectedDomainId, setSelectedDomainId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Activity Editor Form Modal State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
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

  // Version History Modal State
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [activeVersionActivityTitle, setActiveVersionActivityTitle] = useState('');
  const [versionsList, setVersionsList] = useState<ActivityVersionSnapshot[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);

  // Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewDetail, setPreviewDetail] = useState<ActivityDetail | null>(null);
  const [publishingFromPreview, setPublishingFromPreview] = useState(false);

  // Delete Confirmation State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<ActivitySummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load activities list
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

  // Reset form to default create state
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

  // Open editor for an existing activity
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

  // Open Version History Modal
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

  // Open Preview Modal
  const handleOpenPreview = async (activityId: string) => {
    try {
      const res = await api.getAdminActivityDetail(activityId);
      setPreviewDetail(res.activity);
      setPreviewModalOpen(true);
    } catch (err: any) {
      notify({ tone: 'error', title: 'Preview unavailable', description: err.message });
    }
  };

  // Save activity (create or update)
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

  // Quick toggle status (publish / archive)
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

  // Publish from preview modal
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

  // Delete activity confirmation
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

  // Columns definition for AdminDataTable
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
            <Badge tone={tone}>
              {item.status.toUpperCase()}
            </Badge>
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

  const currentRubricSum = formRubric.reduce(
    (sum, r) => sum + Number(r.weightPoints || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
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

      {/* Activities Table with Search, Sorting, and Filters */}
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
            {/* Age Group Filter */}
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

            {/* Domain Filter */}
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

            {/* Status Filter */}
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

      {/* ==================== ACTIVITY EDITOR MODAL ==================== */}
      <Modal
        open={editorOpen}
        onClose={() => !saving && setEditorOpen(false)}
        title={editingActivityId ? 'Edit Curriculum Activity' : 'Create New Activity'}
        size="lg"
      >
        <form onSubmit={handleSaveActivity} className="space-y-6 max-h-[75vh] overflow-y-auto px-1 pr-2">
          {/* Basic Info */}
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
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">
                Age Group *
              </label>
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
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">
                Development Domain *
              </label>
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
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">
                Estimated Duration (Minutes) *
              </label>
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
              <label className="text-xs font-semibold text-charcoal uppercase tracking-wider">
                Preparation Level
              </label>
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

          {/* Objectives */}
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

          {/* Household Materials */}
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
                placeholder="Type item and press Add (e.g., Soft organic cotton washcloth)"
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

          {/* Safety Guidelines */}
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

          {/* Media: Poster & Video */}
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

          {/* Step-by-Step Instructions */}
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

          {/* Activity Rubric & Weight Validator */}
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
              <div
                key={idx}
                className="p-3.5 bg-cream/30 rounded-xl border border-cream-accent/50 space-y-2"
              >
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

          {/* Publishing & Version Snapshot Note */}
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
                Version Change Note (Optional audit trail)
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

          {/* Modal Footer Actions */}
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

      {/* ==================== VERSION HISTORY MODAL ==================== */}
      <Modal
        open={versionModalOpen}
        onClose={() => setVersionModalOpen(false)}
        title={`Version History · ${activeVersionActivityTitle}`}
        size="md"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1 pr-1">
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

      {/* ==================== PREVIEW BEFORE PUBLISH MODAL ==================== */}
      <Modal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title="Parent View Preview"
        size="lg"
      >
        {previewDetail && (
          <div className="space-y-5 max-h-[75vh] overflow-y-auto px-1 pr-2">
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

            {/* Poster & Header */}
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

            {/* Objectives */}
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

            {/* Household Materials */}
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

            {/* Safety Guidelines */}
            <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                Caregiver Safety Guidelines
              </h4>
              <p className="text-xs text-amber-950 leading-relaxed">{previewDetail.safetyNotes}</p>
            </div>

            {/* Steps Sequence */}
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

            {/* Rubric Preview */}
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

      {/* ==================== DELETE CONFIRM DIALOG ==================== */}
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
