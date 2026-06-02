import { useEffect, useState } from 'react';
import FeedbackBanner from '../components/FeedbackBanner';
import { apiFetch } from '../lib/api';
import { User } from '../types';

interface DepartmentItem {
  id: number;
  name: string;
  faculty: {
    id: number;
    name: string;
  };
}

interface StaffFormState {
  job_title: string;
  department_ids: number[];
}

export default function AdminStaffPage() {
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [forms, setForms] = useState<Record<number, StaffFormState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [userResponse, departmentResponse] = await Promise.all([
        apiFetch<{ users: User[] }>('/api/admin/users/?role=staff&page_size=100'),
        apiFetch<{ departments: DepartmentItem[] }>('/api/admin/departments/'),
      ]);

      setStaffUsers(userResponse.data.users);
      setDepartments(departmentResponse.data.departments);
      const nextForms: Record<number, StaffFormState> = {};
      userResponse.data.users.forEach((user) => {
        nextForms[user.id] = {
          job_title: user.job_title || '',
          department_ids: user.department_ids || [],
        };
      });
      setForms(nextForms);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load staff profiles.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const toggleDepartment = (userId: number, departmentId: number) => {
    setForms((prev) => {
      const current = prev[userId] || { job_title: '', department_ids: [] };
      const exists = current.department_ids.includes(departmentId);
      return {
        ...prev,
        [userId]: {
          ...current,
          department_ids: exists
            ? current.department_ids.filter((id) => id !== departmentId)
            : [...current.department_ids, departmentId],
        },
      };
    });
  };

  const saveProfile = async (user: User) => {
    const payload = forms[user.id] || { job_title: '', department_ids: [] };
    setFeedback('');
    setError('');

    try {
      await apiFetch('/api/admin/staff-profile/', {
        method: 'POST',
        body: {
          user_id: user.id,
          job_title: payload.job_title,
          department_ids: payload.department_ids,
        },
      });
      setFeedback(`Staff profile updated for ${user.username}.`);
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update staff profile.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Staff Management</h1>
        <p className="text-slate-500">Assign staff to departments and maintain staff role details.</p>
      </div>

      {error && <FeedbackBanner message={error} variant="error" />}
      {feedback && <FeedbackBanner message={feedback} variant="success" />}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <h2 className="text-xl font-semibold text-slate-800">Staff Profiles</h2>

        {isLoading ? (
          <p className="text-slate-500">Loading staff users...</p>
        ) : staffUsers.length === 0 ? (
          <p className="text-slate-500">No staff users available yet.</p>
        ) : (
          staffUsers.map((user) => {
            const state = forms[user.id] || { job_title: '', department_ids: [] };
            return (
              <div key={user.id} className="rounded-2xl border border-slate-200 p-4 space-y-3">
                <div>
                  <p className="font-semibold text-slate-800">{user.full_name || user.username}</p>
                  <p className="text-sm text-slate-500">{user.email}</p>
                </div>

                <input
                  value={state.job_title}
                  onChange={(event) =>
                    setForms((prev) => ({
                      ...prev,
                      [user.id]: {
                        ...state,
                        job_title: event.target.value,
                      },
                    }))
                  }
                  placeholder="Job title"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {departments.map((department) => (
                    <label key={department.id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={state.department_ids.includes(department.id)}
                        onChange={() => toggleDepartment(user.id, department.id)}
                      />
                      <span>{department.name}</span>
                    </label>
                  ))}
                </div>

                <button onClick={() => void saveProfile(user)} className="rounded-xl bg-primary px-4 py-2 font-semibold text-white hover:bg-primary/90">
                  Save Staff Profile
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
