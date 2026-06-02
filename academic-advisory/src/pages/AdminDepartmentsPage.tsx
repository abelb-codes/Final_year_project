import { FormEvent, useEffect, useState } from 'react';
import FeedbackBanner from '../components/FeedbackBanner';
import { apiFetch } from '../lib/api';
import { FacultyItem } from '../types';

interface DepartmentItem {
  id: number;
  name: string;
  faculty: {
    id: number;
    name: string;
  };
}

export default function AdminDepartmentsPage() {
  const [faculties, setFaculties] = useState<FacultyItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [newFacultyName, setNewFacultyName] = useState('');
  const [departmentForm, setDepartmentForm] = useState({ name: '', faculty_id: '' });
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [facultyResponse, departmentResponse] = await Promise.all([
        apiFetch<{ faculties: FacultyItem[] }>('/api/admin/faculties/'),
        apiFetch<{ departments: DepartmentItem[] }>('/api/admin/departments/'),
      ]);
      setFaculties(facultyResponse.data.faculties);
      setDepartments(departmentResponse.data.departments);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load department data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const createFaculty = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback('');
    setError('');
    try {
      await apiFetch('/api/admin/faculties/', {
        method: 'POST',
        body: { name: newFacultyName },
      });
      setFeedback('Faculty created successfully.');
      setNewFacultyName('');
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create faculty.');
    }
  };

  const createDepartment = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback('');
    setError('');
    try {
      await apiFetch('/api/admin/departments/', {
        method: 'POST',
        body: {
          name: departmentForm.name,
          faculty_id: Number(departmentForm.faculty_id),
        },
      });
      setFeedback('Department created successfully.');
      setDepartmentForm({ name: '', faculty_id: '' });
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create department.');
    }
  };

  const updateDepartment = async (department: DepartmentItem, field: 'name' | 'faculty_id', value: string) => {
    setFeedback('');
    setError('');

    const payload =
      field === 'name'
        ? { name: value }
        : {
            faculty_id: Number(value),
          };

    try {
      await apiFetch(`/api/admin/departments/${department.id}/`, {
        method: 'PATCH',
        body: payload,
      });
      setFeedback('Department updated successfully.');
      await loadData();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update department.');
    }
  };

  const deleteDepartment = async (department: DepartmentItem) => {
    const confirmed = window.confirm(`Delete department ${department.name}?`);
    if (!confirmed) {
      return;
    }

    setFeedback('');
    setError('');
    try {
      await apiFetch(`/api/admin/departments/${department.id}/`, {
        method: 'DELETE',
      });
      setFeedback('Department deleted successfully.');
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete department.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Department Management</h1>
        <p className="text-slate-500">Manage faculties and departments from the admin dashboard.</p>
      </div>

      {error && <FeedbackBanner message={error} variant="error" />}
      {feedback && <FeedbackBanner message={feedback} variant="success" />}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <form onSubmit={createFaculty} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold text-slate-800">Create Faculty</h2>
          <input
            value={newFacultyName}
            onChange={(event) => setNewFacultyName(event.target.value)}
            placeholder="Faculty name"
            className="w-full rounded-xl border border-slate-200 px-4 py-3"
            required
          />
          <button className="rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:bg-primary/90">Create Faculty</button>
        </form>

        <form onSubmit={createDepartment} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold text-slate-800">Create Department</h2>
          <input
            value={departmentForm.name}
            onChange={(event) => setDepartmentForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Department name"
            className="w-full rounded-xl border border-slate-200 px-4 py-3"
            required
          />
          <select
            value={departmentForm.faculty_id}
            onChange={(event) => setDepartmentForm((prev) => ({ ...prev, faculty_id: event.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-3"
            required
          >
            <option value="">Select Faculty</option>
            {faculties.map((faculty) => (
              <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
            ))}
          </select>
          <button className="rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:bg-primary/90">Create Department</button>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-800">Departments</h2>

        {isLoading ? (
          <p className="mt-4 text-slate-500">Loading departments...</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-3 pr-4">Department</th>
                  <th className="py-3 pr-4">Faculty</th>
                  <th className="py-3 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => (
                  <tr key={department.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4">
                      <input
                        defaultValue={department.name}
                        onBlur={(event) => {
                          if (event.target.value.trim() !== department.name) {
                            void updateDepartment(department, 'name', event.target.value);
                          }
                        }}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <select
                        value={department.faculty.id}
                        onChange={(event) => void updateDepartment(department, 'faculty_id', event.target.value)}
                        className="rounded-lg border border-slate-200 px-3 py-2"
                      >
                        {faculties.map((faculty) => (
                          <option key={faculty.id} value={faculty.id}>{faculty.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-4">
                      <button onClick={() => void deleteDepartment(department)} className="rounded-lg border border-red-200 px-3 py-1 text-red-600 hover:bg-red-50">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {departments.length === 0 && <p className="py-4 text-slate-500">No departments available yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
