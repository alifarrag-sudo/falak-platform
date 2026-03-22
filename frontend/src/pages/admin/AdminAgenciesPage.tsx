/**
 * Admin Agencies Management page.
 * Lists all agencies with search, pagination.
 * Supports create, edit, and delete.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, X, ShieldAlert, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAgencies, createAgency, updateAgency, deleteAgency,
  type AdminAgency,
} from '../../utils/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCommission(rate: number): string {
  return `${rate}%`;
}

// ─── Create Agency Modal ──────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
}

function CreateAgencyModal({ onClose }: CreateModalProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    contact_email: '',
    website: '',
    country: '',
    commission_rate: '15',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: createAgency,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-agencies'] });
      toast.success('Agency created');
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create agency';
      toast.error(msg);
    },
  });

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Agency name is required';
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) {
      e.contact_email = 'Invalid email address';
    }
    const rate = parseFloat(form.commission_rate);
    if (form.commission_rate && (isNaN(rate) || rate < 0 || rate > 100)) {
      e.commission_rate = 'Must be between 0 and 100';
    }
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    mutation.mutate({
      name: form.name.trim(),
      contact_email: form.contact_email.trim() || undefined,
      website: form.website.trim() || undefined,
      country: form.country.trim() || undefined,
      commission_rate: form.commission_rate ? parseFloat(form.commission_rate) : undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-base font-semibold text-white">Create Agency</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Agency Name <span className="text-red-400">*</span></label>
            <input
              className={`input w-full ${errors.name ? 'border-red-500' : ''}`}
              placeholder="e.g. Starpower Agency"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="label">Contact Email</label>
            <input
              className={`input w-full ${errors.contact_email ? 'border-red-500' : ''}`}
              type="email"
              placeholder="agency@example.com"
              value={form.contact_email}
              onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
            />
            {errors.contact_email && <p className="text-xs text-red-400 mt-1">{errors.contact_email}</p>}
          </div>

          <div>
            <label className="label">Website</label>
            <input
              className="input w-full"
              placeholder="https://agency.com"
              value={form.website}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Country</label>
            <input
              className="input w-full"
              placeholder="e.g. Saudi Arabia"
              value={form.country}
              onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Commission Rate (%)</label>
            <input
              className={`input w-full ${errors.commission_rate ? 'border-red-500' : ''}`}
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="15"
              value={form.commission_rate}
              onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))}
            />
            {errors.commission_rate && <p className="text-xs text-red-400 mt-1">{errors.commission_rate}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[#2a2a2a] text-gray-400 hover:text-white hover:border-gray-600 transition-colors text-sm">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 btn-primary text-sm">
              {mutation.isPending ? 'Creating…' : 'Create Agency'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Agency Modal ────────────────────────────────────────────────────────

interface EditModalProps {
  agency: AdminAgency;
  onClose: () => void;
}

function EditAgencyModal({ agency, onClose }: EditModalProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: agency.name,
    contact_email: agency.contact_email || '',
    website: agency.website || '',
    country: agency.country || '',
    commission_rate: String(agency.commission_override_pct ?? 15),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (updates: Parameters<typeof updateAgency>[1]) => updateAgency(agency.id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-agencies'] });
      toast.success('Agency updated');
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update agency';
      toast.error(msg);
    },
  });

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Agency name is required';
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) {
      e.contact_email = 'Invalid email address';
    }
    const rate = parseFloat(form.commission_rate);
    if (form.commission_rate && (isNaN(rate) || rate < 0 || rate > 100)) {
      e.commission_rate = 'Must be between 0 and 100';
    }
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    mutation.mutate({
      name: form.name.trim(),
      contact_email: form.contact_email.trim(),
      website: form.website.trim(),
      country: form.country.trim(),
      commission_rate: parseFloat(form.commission_rate),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <div>
            <h2 className="text-base font-semibold text-white">Edit Agency</h2>
            <p className="text-xs text-gray-500 mt-0.5">{agency.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Agency Name <span className="text-red-400">*</span></label>
            <input
              className={`input w-full ${errors.name ? 'border-red-500' : ''}`}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="label">Contact Email</label>
            <input
              className={`input w-full ${errors.contact_email ? 'border-red-500' : ''}`}
              type="email"
              value={form.contact_email}
              onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
            />
            {errors.contact_email && <p className="text-xs text-red-400 mt-1">{errors.contact_email}</p>}
          </div>

          <div>
            <label className="label">Website</label>
            <input
              className="input w-full"
              value={form.website}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Country</label>
            <input
              className="input w-full"
              value={form.country}
              onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Commission Rate (%)</label>
            <input
              className={`input w-full ${errors.commission_rate ? 'border-red-500' : ''}`}
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.commission_rate}
              onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))}
            />
            {errors.commission_rate && <p className="text-xs text-red-400 mt-1">{errors.commission_rate}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[#2a2a2a] text-gray-400 hover:text-white hover:border-gray-600 transition-colors text-sm">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 btn-primary text-sm">
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

interface DeleteModalProps {
  agency: AdminAgency;
  onClose: () => void;
}

function DeleteConfirmModal({ agency, onClose }: DeleteModalProps) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteAgency(agency.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-agencies'] });
      toast.success('Agency deleted');
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to delete agency';
      toast.error(msg);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Delete Agency?</h2>
            <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-6">
          You are about to permanently delete <span className="text-white font-medium">{agency.name}</span>.
          Associated user links will not be removed.
        </p>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[#2a2a2a] text-gray-400 hover:text-white hover:border-gray-600 transition-colors text-sm">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminAgenciesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editAgency, setEditAgency] = useState<AdminAgency | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminAgency | null>(null);

  const LIMIT = 50;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-agencies', search, page],
    queryFn: () => getAgencies({
      search: search || undefined,
      page,
      limit: LIMIT,
    }),
    placeholderData: prev => prev,
  });

  function handleSearchChange(v: string) {
    setSearch(v);
    setPage(1);
  }

  const agencies = data?.agencies || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Agencies</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total > 0 ? `${total} agenc${total !== 1 ? 'ies' : 'y'} total` : 'Manage all platform agencies'}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2 text-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Agency
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            className="input w-full pl-9"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-500 text-sm">Loading agencies…</div>
        ) : isError ? (
          <div className="flex items-center justify-center h-48 text-red-400 text-sm">Failed to load agencies. Check permissions.</div>
        ) : agencies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Building2 className="w-8 h-8 text-gray-600" />
            <p className="text-gray-500 text-sm">
              {search ? 'No agencies match your search.' : 'No agencies yet. Create one to get started.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Agency</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Contact Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Country</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Commission</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Users</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Created</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {agencies.map(agency => (
                  <tr key={agency.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {agency.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">{agency.name}</p>
                          {agency.website && (
                            <a
                              href={agency.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-500 text-xs truncate hover:text-blue-400 transition-colors"
                            >
                              {agency.website.replace(/^https?:\/\//, '')}
                            </a>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact Email */}
                    <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">
                      {agency.contact_email || '—'}
                    </td>

                    {/* Country */}
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                      {agency.country || '—'}
                    </td>

                    {/* Commission */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-700/50">
                        {formatCommission(agency.commission_override_pct)}
                      </span>
                    </td>

                    {/* Users */}
                    <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
                      {agency.user_count ?? 0}
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
                      {formatDate(agency.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditAgency(agency)}
                          title="Edit agency"
                          className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(agency)}
                          title="Delete agency"
                          className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !isError && pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#2a2a2a]">
            <p className="text-xs text-gray-500">
              Page {page} of {pages} &mdash; {total} agencies
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: pages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === pages || Math.abs(p - page) <= 2)
                .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === 'ellipsis' ? (
                    <span key={`ell-${idx}`} className="px-1.5 text-gray-600 text-xs">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                        page === p
                          ? 'bg-white/10 text-white'
                          : 'text-gray-500 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}

              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate    && <CreateAgencyModal onClose={() => setShowCreate(false)} />}
      {editAgency    && <EditAgencyModal agency={editAgency} onClose={() => setEditAgency(null)} />}
      {deleteTarget  && <DeleteConfirmModal agency={deleteTarget} onClose={() => setDeleteTarget(null)} />}
    </div>
  );
}
