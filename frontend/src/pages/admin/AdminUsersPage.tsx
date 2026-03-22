/**
 * Admin Users Management page.
 * Lists all platform users with search, role filtering, pagination.
 * Supports create, edit (role/status/name), suspend/activate toggle, and soft delete.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, X, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getUsers, createAdminUser, updateUser, deleteUser,
  type AdminUser,
} from '../../utils/api';

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_TABS = [
  { value: 'all',             label: 'All' },
  { value: 'platform_admin',  label: 'Admin' },
  { value: 'agency',          label: 'Agency' },
  { value: 'brand',           label: 'Brand' },
  { value: 'influencer',      label: 'Influencer' },
  { value: 'talent_manager',  label: 'Talent Manager' },
];

const ROLE_COLORS: Record<string, string> = {
  platform_admin:  'bg-purple-900/50 text-purple-300 border-purple-700/50',
  agency:          'bg-blue-900/50 text-blue-300 border-blue-700/50',
  brand:           'bg-green-900/50 text-green-300 border-green-700/50',
  influencer:      'bg-pink-900/50 text-pink-300 border-pink-700/50',
  talent_manager:  'bg-orange-900/50 text-orange-300 border-orange-700/50',
  public:          'bg-gray-800 text-gray-400 border-gray-700',
};

const ROLE_LABELS: Record<string, string> = {
  platform_admin:  'Admin',
  agency:          'Agency',
  brand:           'Brand',
  influencer:      'Influencer',
  talent_manager:  'Talent Manager',
  public:          'Public',
};

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-emerald-900/40 text-emerald-400',
  suspended: 'bg-amber-900/40 text-amber-400',
  deleted:   'bg-red-900/40 text-red-400',
};

const VALID_ROLES = ['platform_admin', 'agency', 'brand', 'influencer', 'talent_manager', 'public'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarInitial(user: AdminUser): string {
  return (user.display_name || user.email).charAt(0).toUpperCase();
}

function avatarColor(role: string): string {
  const map: Record<string, string> = {
    platform_admin: 'bg-purple-700',
    agency:         'bg-blue-700',
    brand:          'bg-green-700',
    influencer:     'bg-pink-700',
    talent_manager: 'bg-orange-700',
    public:         'bg-gray-700',
  };
  return map[role] || 'bg-gray-700';
}

function formatDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[role] || ROLE_COLORS.public}`}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[status] || 'bg-gray-800 text-gray-400'}`}>
      {status}
    </span>
  );
}

// ─── Create User Modal ────────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
}

function CreateUserModal({ onClose }: CreateModalProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ email: '', password: '', role: 'influencer', display_name: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User created');
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create user';
      toast.error(msg);
    },
  });

  function validate() {
    const e: Record<string, string> = {};
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'At least 6 characters';
    if (!form.role) e.role = 'Role is required';
    return e;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    mutation.mutate({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      role: form.role,
      display_name: form.display_name.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-base font-semibold text-white">Create User</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              className={`input w-full ${errors.email ? 'border-red-500' : ''}`}
              type="email"
              placeholder="user@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
            {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="label">Password</label>
            <input
              className={`input w-full ${errors.password ? 'border-red-500' : ''}`}
              type="password"
              placeholder="Min. 6 characters"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
            {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
          </div>

          <div>
            <label className="label">Display Name</label>
            <input
              className="input w-full"
              placeholder="Optional"
              value={form.display_name}
              onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Role</label>
            <select
              className="input w-full"
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            >
              {VALID_ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
              ))}
            </select>
            {errors.role && <p className="text-xs text-red-400 mt-1">{errors.role}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-[#2a2a2a] text-gray-400 hover:text-white hover:border-gray-600 transition-colors text-sm">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 btn-primary text-sm">
              {mutation.isPending ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────

interface EditModalProps {
  user: AdminUser;
  onClose: () => void;
}

function EditUserModal({ user, onClose }: EditModalProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    display_name: user.display_name || '',
    role: user.role,
    status: user.status,
  });

  const mutation = useMutation({
    mutationFn: (updates: { display_name?: string; role?: string; status?: string }) =>
      updateUser(user.id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User updated');
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update user';
      toast.error(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const updates: Record<string, string> = {};
    if (form.display_name.trim() !== user.display_name) updates.display_name = form.display_name.trim();
    if (form.role !== user.role) updates.role = form.role;
    if (form.status !== user.status) updates.status = form.status;
    if (Object.keys(updates).length === 0) { onClose(); return; }
    mutation.mutate(updates);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[#1c1c1c] border border-[#2a2a2a] rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <div>
            <h2 className="text-base font-semibold text-white">Edit User</h2>
            <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Display Name</label>
            <input
              className="input w-full"
              value={form.display_name}
              onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Role</label>
            <select
              className="input w-full"
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            >
              {VALID_ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Status</label>
            <select
              className="input w-full"
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
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
  user: AdminUser;
  onClose: () => void;
}

function DeleteConfirmModal({ user, onClose }: DeleteModalProps) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => deleteUser(user.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User deleted');
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to delete user';
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
            <h2 className="text-base font-semibold text-white">Delete User?</h2>
            <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-6">
          You are about to delete <span className="text-white font-medium">{user.display_name || user.email}</span>.
          The account will be soft-deleted and removed from all active views.
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

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const LIMIT = 50;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-users', search, roleFilter, page],
    queryFn: () => getUsers({
      search: search || undefined,
      role: roleFilter !== 'all' ? roleFilter : undefined,
      page,
      limit: LIMIT,
    }),
    placeholderData: prev => prev,
  });

  // Suspend / Activate inline toggle
  const toggleStatus = useMutation({
    mutationFn: (user: AdminUser) =>
      updateUser(user.id, { status: user.status === 'active' ? 'suspended' : 'active' }),
    onSuccess: (_, user) => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(user.status === 'active' ? 'User suspended' : 'User activated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  function handleSearchChange(v: string) {
    setSearch(v);
    setPage(1);
  }

  function handleRoleFilter(v: string) {
    setRoleFilter(v);
    setPage(1);
  }

  const users = data?.users || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total > 0 ? `${total} user${total !== 1 ? 's' : ''} total` : 'Manage all platform accounts'}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2 text-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            className="input w-full pl-9"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
          />
        </div>

        {/* Role tabs */}
        <div className="flex items-center gap-1 bg-[#1c1c1c] border border-[#2a2a2a] rounded-lg p-1 flex-wrap">
          {ROLE_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => handleRoleFilter(tab.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                roleFilter === tab.value
                  ? 'bg-[#2a2a2a] text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-gray-500 text-sm">Loading users…</div>
        ) : isError ? (
          <div className="flex items-center justify-center h-48 text-red-400 text-sm">Failed to load users. Check permissions.</div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
            {search || roleFilter !== 'all' ? 'No users match your filters.' : 'No users found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">User</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Last Login</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Joined</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2a]">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Avatar + Name/Email */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarColor(user.role)}`}>
                          {avatarInitial(user)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">{user.display_name || '—'}</p>
                          <p className="text-gray-500 text-xs truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <RoleBadge role={user.role} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={user.status} />
                    </td>

                    {/* Last Login */}
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                      {formatDate(user.last_login_at)}
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
                      {formatDate(user.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Suspend / Activate */}
                        <button
                          onClick={() => toggleStatus.mutate(user)}
                          disabled={toggleStatus.isPending}
                          title={user.status === 'active' ? 'Suspend user' : 'Activate user'}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                            user.status === 'active'
                              ? 'text-amber-400 hover:bg-amber-900/30'
                              : 'text-emerald-400 hover:bg-emerald-900/30'
                          }`}
                        >
                          {user.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => setEditUser(user)}
                          title="Edit user"
                          className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteTarget(user)}
                          title="Delete user"
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
              Page {page} of {pages} &mdash; {total} users
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page numbers (show up to 5 around current) */}
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
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
      {editUser   && <EditUserModal   user={editUser}    onClose={() => setEditUser(null)} />}
      {deleteTarget && <DeleteConfirmModal user={deleteTarget} onClose={() => setDeleteTarget(null)} />}
    </div>
  );
}
