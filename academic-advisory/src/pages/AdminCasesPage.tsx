import { useEffect, useState } from 'react';
import FeedbackBanner from '../components/FeedbackBanner';
import { apiFetch } from '../lib/api';
import { AcademicCase, CaseStatusCode, PaginationMeta, User } from '../types';

interface DepartmentItem {
  id: number;
  name: string;
  faculty: {
    id: number;
    name: string;
  };
}

const statusChoices: Array<{ value: CaseStatusCode; label: string }> = [
  { value: 'P', label: 'Pending' },
  { value: 'IP', label: 'In Progress' },
  { value: 'RS', label: 'Resolved' },
  { value: 'RJ', label: 'Rejected' },
];

const defaultPagination: PaginationMeta = {
  page: 1,
  page_size: 20,
  total_pages: 1,
  total_items: 0,
  has_next: false,
  has_previous: false,
};

export default function AdminCasesPage() {
  const [cases, setCases] = useState<AcademicCase[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(defaultPagination);
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<Record<number, string>>({});
  const [selectedStatus, setSelectedStatus] = useState<Record<number, CaseStatusCode>>({});
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async (page = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', '20');
      if (statusFilter) {
        params.set('status', statusFilter);
      }
      if (departmentFilter) {
        params.set('department', departmentFilter);
      }

      const [caseResponse, departmentResponse, staffResponse] = await Promise.all([
        apiFetch<{ cases: AcademicCase[]; pagination: PaginationMeta }>(`/api/admin/cases/?${params.toString()}`),
        apiFetch<{ departments: DepartmentItem[] }>('/api/admin/departments/'),
        apiFetch<{ users: User[] }>('/api/admin/users/?role=staff&page_size=100'),
      ]);

      setCases(caseResponse.data.cases);
      setPagination(caseResponse.data.pagination);
      setDepartments(departmentResponse.data.departments);
      setStaffUsers(staffResponse.data.users);

      const staffSelection: Record<number, string> = {};
      const statusSelection: Record<number, CaseStatusCode> = {};
      caseResponse.data.cases.forEach((caseItem) => {
        staffSelection[caseItem.id] = caseItem.staff?.id ? String(caseItem.staff.id) : '';
        statusSelection[caseItem.id] = caseItem.status;
      });
      setSelectedStaff(staffSelection);
      setSelectedStatus(statusSelection);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load admin cases.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const applyFilters = async () => {
    await loadData(1);
  };

  const reassignCase = async (caseItem: AcademicCase) => {
    const staffId = selectedStaff[caseItem.id];
    if (!staffId) {
      setError('Select a staff member before reassigning.');
      return;
    }

    setFeedback('');
    setError('');
    try {
      await apiFetch(`/api/admin/cases/${caseItem.id}/reassign/`, {
        method: 'POST',
        body: {
          staff_id: Number(staffId),
          message: `Case reassigned by admin to ${staffUsers.find((staff) => staff.id === Number(staffId))?.username || 'staff'}.`,
        },
      });
      setFeedback(`Case ${caseItem.reference_code} reassigned successfully.`);
      await loadData(pagination.page);
    } catch (reassignError) {
      setError(reassignError instanceof Error ? reassignError.message : 'Unable to reassign case.');
    }
  };

  const updateStatus = async (caseItem: AcademicCase) => {
    const status = selectedStatus[caseItem.id] || caseItem.status;

    setFeedback('');
    setError('');
    try {
      await apiFetch(`/api/admin/cases/${caseItem.id}/status/`, {
        method: 'POST',
        body: {
          status,
          message: `Case status force-updated by admin to ${statusChoices.find((choice) => choice.value === status)?.label || status}.`,
        },
      });
      setFeedback(`Case ${caseItem.reference_code} status updated.`);
      await loadData(pagination.page);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to update case status.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Case Management</h1>
        <p className="text-slate-500">Review all cases, filter by department and status, reassign staff, and force status updates.</p>
      </div>

      {error && <FeedbackBanner message={error} variant="error" />}
      {feedback && <FeedbackBanner message={feedback} variant="success" />}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-3">
            <option value="">All Statuses</option>
            {statusChoices.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-3">
            <option value="">All Departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
          <button onClick={() => void applyFilters()} className="rounded-xl border border-slate-200 px-4 py-3 text-slate-700 hover:bg-slate-50">Apply Filters</button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm overflow-x-auto">
        {isLoading ? (
          <p className="text-slate-500">Loading cases...</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-3 pr-4">Case</th>
                <th className="py-3 pr-4">Department</th>
                <th className="py-3 pr-4">Current Staff</th>
                <th className="py-3 pr-4">Reassign</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((caseItem) => (
                <tr key={caseItem.id} className="border-b border-slate-100 align-top">
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-slate-800">{caseItem.reference_code}</p>
                    <p className="text-slate-700">{caseItem.title}</p>
                    <p className="text-xs text-slate-400">{caseItem.student.name}</p>
                  </td>
                  <td className="py-3 pr-4">{caseItem.department?.name || 'Unassigned'}</td>
                  <td className="py-3 pr-4">{caseItem.staff?.name || 'Unassigned'}</td>
                  <td className="py-3 pr-4">
                    <select
                      value={selectedStaff[caseItem.id] || ''}
                      onChange={(event) => setSelectedStaff((prev) => ({ ...prev, [caseItem.id]: event.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <option value="">Select Staff</option>
                      {staffUsers.map((staff) => (
                        <option key={staff.id} value={staff.id}>{staff.full_name || staff.username}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 pr-4">
                    <select
                      value={selectedStatus[caseItem.id] || caseItem.status}
                      onChange={(event) => setSelectedStatus((prev) => ({ ...prev, [caseItem.id]: event.target.value as CaseStatusCode }))}
                      className="rounded-lg border border-slate-200 px-3 py-2"
                    >
                      {statusChoices.map((choice) => (
                        <option key={choice.value} value={choice.value}>{choice.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-col gap-2">
                      <button onClick={() => void reassignCase(caseItem)} className="rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-50">Reassign</button>
                      <button onClick={() => void updateStatus(caseItem)} className="rounded-lg bg-primary px-3 py-1 font-semibold text-white hover:bg-primary/90">Update Status</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!isLoading && cases.length === 0 && <p className="pt-4 text-slate-500">No cases match your filters.</p>}

        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <p>Page {pagination.page} of {pagination.total_pages}</p>
          <div className="flex gap-2">
            <button disabled={!pagination.has_previous} onClick={() => void loadData(pagination.page - 1)} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-50">Previous</button>
            <button disabled={!pagination.has_next} onClick={() => void loadData(pagination.page + 1)} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
