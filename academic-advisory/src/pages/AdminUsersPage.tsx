import { FormEvent, useEffect, useMemo, useState } from 'react';
import FeedbackBanner from '../components/FeedbackBanner';
import { apiFetch } from '../lib/api';
import { PaginationMeta, Role, User } from '../types';

const defaultPagination: PaginationMeta = {
  page: 1,
  page_size: 20,
  total_pages: 1,
  total_items: 0,
  has_next: false,
  has_previous: false,
};

const roleOptions: Role[] = ['student', 'staff', 'admin'];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(defaultPagination);
  const [searchTerm, setSearchTerm] = useState('');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    role: 'student' as Role,
    password: '',
  });

  const roleSummary = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        acc[user.role] += 1;
        return acc;
      },
      { student: 0, staff: 0, admin: 0 }
    );
  }, [users]);

  const loadUsers = async (page = 1, activeQuery = query) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', '20');
      if (activeQuery.trim()) {
        params.set('q', activeQuery.trim());
      }

      const response = await apiFetch<{ users: User[]; pagination: PaginationMeta }>(`/api/admin/users/?${params.toString()}`);
      setUsers(response.data.users);
      setPagination(response.data.pagination);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const createUser = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback('');
    setError('');

    try {
      await apiFetch('/api/admin/users/create/', {
        method: 'POST',
        body: formData,
      });
      setFeedback('User created successfully.');
      setFormData({ username: '', email: '', first_name: '', last_name: '', role: 'student', password: '' });
      await loadUsers(pagination.page);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateRole = async (userId: number, role: Role) => {
    setFeedback('');
    setError('');
    try {
      await apiFetch(`/api/admin/users/${userId}/`, {
        method: 'PATCH',
        body: { role },
      });
      setFeedback('Role updated successfully.');
      await loadUsers(pagination.page);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update role.');
    }
  };

  const resetPassword = async (user: User) => {
    const password = window.prompt(`Set a new password for ${user.username}:`);
    if (!password) {
      return;
    }

    setFeedback('');
    setError('');
    try {
      await apiFetch(`/api/admin/users/${user.id}/`, {
        method: 'PATCH',
        body: { password },
      });
      setFeedback(`Password reset for ${user.username}.`);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Unable to reset password.');
    }
  };

  const deleteUser = async (user: User) => {
    const confirmed = window.confirm(`Delete user ${user.username}? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setFeedback('');
    setError('');
    try {
      await apiFetch(`/api/admin/users/${user.id}/`, {
        method: 'DELETE',
      });
      setFeedback('User deleted successfully.');
      await loadUsers(pagination.page);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete user.');
    }
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(searchTerm);
    void loadUsers(1, searchTerm);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">User Management</h1>
        <p className="text-slate-500">Create, update, and remove platform users without Django Admin.</p>
      </div>

      {error && <FeedbackBanner message={error} variant="error" />}
      {feedback && <FeedbackBanner message={feedback} variant="success" />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickStat label="Students" value={roleSummary.student} />
        <QuickStat label="Staff" value={roleSummary.staff} />
        <QuickStat label="Admins" value={roleSummary.admin} />
      </div>

      <form onSubmit={createUser} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-xl font-semibold text-slate-800">Create User</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <input value={formData.username} onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))} placeholder="Username" className="rounded-xl border border-slate-200 px-4 py-3" required />
          <input value={formData.email} onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" type="email" className="rounded-xl border border-slate-200 px-4 py-3" required />
          <input value={formData.password} onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))} placeholder="Temporary password" type="password" className="rounded-xl border border-slate-200 px-4 py-3" required />
          <input value={formData.first_name} onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))} placeholder="First name" className="rounded-xl border border-slate-200 px-4 py-3" />
          <input value={formData.last_name} onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))} placeholder="Last name" className="rounded-xl border border-slate-200 px-4 py-3" />
          <select value={formData.role} onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value as Role }))} className="rounded-xl border border-slate-200 px-4 py-3">
            {roleOptions.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
        <button disabled={isSubmitting} className="rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
          {isSubmitting ? 'Creating...' : 'Create User'}
        </button>
      </form>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-semibold text-slate-800">Users</h2>
          <form onSubmit={submitSearch} className="flex gap-2">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, username"
              className="rounded-xl border border-slate-200 px-4 py-2"
            />
            <button className="rounded-xl border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50">Search</button>
          </form>
        </div>

        {isLoading ? (
          <p className="mt-6 text-slate-500">Loading users...</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-3 pr-4">Username</th>
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Role</th>
                  <th className="py-3 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 text-slate-700">
                    <td className="py-3 pr-4">
                      <p className="font-medium">{user.username}</p>
                      <p className="text-xs text-slate-400">{user.full_name || 'No name set'}</p>
                    </td>
                    <td className="py-3 pr-4">{user.email}</td>
                    <td className="py-3 pr-4">
                      <select
                        value={user.role}
                        onChange={(event) => void updateRole(user.id, event.target.value as Role)}
                        className="rounded-lg border border-slate-200 px-2 py-1"
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => void resetPassword(user)} className="rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-50">Reset Password</button>
                        <button onClick={() => void deleteUser(user)} className="rounded-lg border border-red-200 px-3 py-1 text-red-600 hover:bg-red-50">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <p className="py-6 text-slate-500">No users found.</p>}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <p>
            Page {pagination.page} of {pagination.total_pages} ({pagination.total_items} users)
          </p>
          <div className="flex gap-2">
            <button disabled={!pagination.has_previous} onClick={() => void loadUsers(pagination.page - 1)} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-50">Previous</button>
            <button disabled={!pagination.has_next} onClick={() => void loadUsers(pagination.page + 1)} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}
