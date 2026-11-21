import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Archive,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileEdit,
  FolderPlus,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import { SecureVideoPlayer } from '../../components/SecureVideoPlayer';
import { Badge, type BadgeTone } from '../../design-system/Badge';
import { Button } from '../../design-system/Button';
import { Card } from '../../design-system/Card';
import { ConfirmDialog } from '../../design-system/ConfirmDialog';
import { Modal } from '../../design-system/Modal';
import { useToast } from '../../design-system/Toast';
import { api } from '../../lib/api';
import { formatDateTimeReadable } from '../../shared/i18n';
import type {
  ActivitySummary,
  AdminAgeGroupItem,
  AdminDomainItem,
  AdminReviewerItem,
  AdminSubmissionItem,
  AdminUserItem,
  AgeGroup,
  LearningDomain,
  SubmissionReviewStatus,
  UnifiedAuditCategory,
  UnifiedAuditLogItem,
  UserRole,
} from '../../shared/types';
import { AdminDataTable, type ColumnDef } from './AdminDataTable';

// =========================================================================
// 1. AGE GROUPS MANAGEMENT MODULE
// =========================================================================

export function AdminAgeGroupsModule({ onReloadCurriculum }: { onReloadCurriculum?: () => void }) {
  const { notify } = useToast();
  const [ageGroups, setAgeGroups] = useState<AdminAgeGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminAgeGroupItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
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
// 2. DEVELOPMENT DOMAINS MANAGEMENT MODULE
// =========================================================================

export function AdminDomainsModule({ onReloadCurriculum }: { onReloadCurriculum?: () => void }) {
  const { notify } = useToast();
  const [domains, setDomains] = useState<AdminDomainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminDomainItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
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
// 3. DAILY LEARNING PLAN MANAGEMENT MODULE
// =========================================================================

export function AdminDailyPlansModule({ ageGroups }: { ageGroups: AgeGroup[] }) {
  const { notify } = useToast();
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState(ageGroups[0]?.id || 'ag_6-9m');
  const [plans, setPlans] = useState<
    Array<{ id: string; dayNumber: number; title: string; focusNote: string; activityIds: string[] }>
  >([]);
  const [availableActivities, setAvailableActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [dayNumber, setDayNumber] = useState(1);
  const [title, setTitle] = useState('');
  const [focusNote, setFocusNote] = useState('');
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Delete Confirm
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

      {/* Cohort Tabs */}
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

      {/* Plans List */}
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

      {/* Editor Modal */}
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

          {/* Activity Selector */}
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
// 4. REVIEWER MANAGEMENT MODULE
// =========================================================================

export function AdminReviewersModule({ ageGroups }: { ageGroups: AgeGroup[] }) {
  const { notify } = useToast();
  const [reviewers, setReviewers] = useState<AdminReviewerItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Provision Modal
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [allowedAgeSlugs, setAllowedAgeSlugs] = useState<string[]>([]);
  const [specialtyNote, setSpecialtyNote] = useState('');
  const [provisioning, setProvisioning] = useState(false);

  // Edit Permissions Modal
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

      {/* Provision Modal */}
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

      {/* Edit Permissions Modal */}
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
// 5. SUBMISSION MANAGEMENT MODULE
// =========================================================================

export function AdminSubmissionsModule() {
  const { notify } = useToast();
  const [submissions, setSubmissions] = useState<AdminSubmissionItem[]>([]);
  const [reviewers, setReviewers] = useState<AdminReviewerItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reviewerFilter, setReviewerFilter] = useState<string>('all');

  // Assignment Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetSub, setTargetSub] = useState<AdminSubmissionItem | null>(null);
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  // Inspect Modal
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
        return (
          <Badge tone={tone}>
            {item.reviewStatus.replace(/_/g, ' ').toUpperCase()}
          </Badge>
        );
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
        <span className="text-xs text-muted">
          {formatDateTimeReadable(item.createdAt)}
        </span>
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

      {/* Assign Modal */}
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

      {/* Inspect Modal */}
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
// 6. USER MANAGEMENT MODULE
// =========================================================================

export function AdminUsersModule() {
  const { notify } = useToast();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal
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
        return (
          <Badge tone={tone}>
            {item.role.toUpperCase()}
          </Badge>
        );
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
// 7. AUDIT LOGS & RETENTION MODULE
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
        return (
          <Badge tone={tone}>
            {item.category.toUpperCase()}
          </Badge>
        );
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

      {/* 30-Day Retention Sweep Card */}
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

      {/* Category Pills & Table */}
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
