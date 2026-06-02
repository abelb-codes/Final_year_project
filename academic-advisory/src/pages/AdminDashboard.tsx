import { useEffect, useState } from 'react';
import { BarChart3, BellRing, Send, ShieldCheck, Users } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { AdminDashboardStats } from '../types';
import FeedbackBanner from '../components/FeedbackBanner';
import { formatDate } from '../lib/utils';

const emptyStats: AdminDashboardStats = {
  students: 0,
  staff: 0,
  admins: 0,
  notifications_sent: 0,
  cases: {
    total: 0,
    pending: 0,
    in_progress: 0,
    resolved: 0,
    rejected: 0,
  },
  recent_cases: [],
  recent_activity: [],
  department_load: [],
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminDashboardStats>(emptyStats);
  const [message, setMessage] = useState('');
  const [targetRole, setTargetRole] = useState<'student' | 'staff' | 'admin'>('student');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch<{ stats: AdminDashboardStats }>('/api/admin/dashboard/');
      setStats(response.data.stats);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load admin dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const sendNotification = async () => {
    if (!message.trim()) {
      setError('Enter a notification message before sending.');
      return;
    }

    const confirmed = window.confirm(`Send this announcement to all ${targetRole} accounts?`);
    if (!confirmed) {
      return;
    }

    setIsSending(true);
    setFeedback('');
    setError('');

    try {
      const response = await apiFetch<{ recipient_count: number }>('/api/admin/notifications/global/', {
        method: 'POST',
        body: {
          message,
          target_role: targetRole,
        },
      });
      setFeedback(`${response.data.recipient_count} ${targetRole} accounts were notified successfully.`);
      setMessage('');
      await loadDashboard();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send notification.');
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-slate-500">Loading admin dashboard...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Admin Dashboard</h1>
        <p className="text-slate-500">Monitor platform activity, review case volume, and share official announcements.</p>
      </div>

      {error && <FeedbackBanner message={error} variant="error" />}
      {feedback && <FeedbackBanner message={feedback} variant="success" />}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard icon={Users} label="Students" value={stats.students} />
        <StatCard icon={ShieldCheck} label="Staff" value={stats.staff} />
        <StatCard icon={BarChart3} label="Total Cases" value={stats.cases.total} />
        <StatCard icon={BellRing} label="Notifications" value={stats.notifications_sent} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
          <h2 className="text-xl font-semibold text-slate-800">Global Notification</h2>
          <p className="text-sm text-slate-500">Send a concise announcement to one role at a time.</p>
          <select
            value={targetRole}
            onChange={(event) => setTargetRole(event.target.value as 'student' | 'staff' | 'admin')}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="student">Students</option>
            <option value="staff">Staff</option>
            <option value="admin">Admins</option>
          </select>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write the announcement you want to send..."
            className="h-36 w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            onClick={() => void sendNotification()}
            disabled={isSending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {isSending ? 'Sending...' : 'Send Notification'}
          </button>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-800">Case Status Overview</h2>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <MiniStat label="Pending" value={stats.cases.pending} />
            <MiniStat label="In Progress" value={stats.cases.in_progress} />
            <MiniStat label="Resolved" value={stats.cases.resolved} />
            <MiniStat label="Rejected" value={stats.cases.rejected} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-800">Recent Cases</h2>
          <div className="mt-6 space-y-4">
            {stats.recent_cases.length === 0 ? (
              <p className="text-slate-500">No cases have been submitted yet.</p>
            ) : (
              stats.recent_cases.map((caseItem) => (
                <div key={caseItem.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-widest text-slate-400">{caseItem.reference_code}</p>
                  <h3 className="mt-1 font-semibold text-slate-800">{caseItem.title}</h3>
                  <p className="text-sm text-slate-500">{caseItem.student.name} | {caseItem.status_label}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-800">Recent Activity</h2>
          <div className="mt-6 space-y-4">
            {stats.recent_activity.length === 0 ? (
              <p className="text-slate-500">No recent activity is available yet.</p>
            ) : (
              stats.recent_activity.map((activity) => (
                <div key={activity.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <p className="text-xs uppercase tracking-widest text-slate-400">{activity.action_label}</p>
                  <p className="mt-1 font-medium text-slate-800">{activity.message}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {activity.performed_by} | {formatDate(activity.created_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-800">Department Load</h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.department_load.length === 0 ? (
            <p className="text-slate-500">No department workload data available yet.</p>
          ) : (
            stats.department_load.map((department) => (
              <div key={department.name} className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-4">
                <span className="font-medium text-slate-700">{department.name}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                  {department.case_count}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 text-primary">
        <div className="rounded-2xl bg-primary/10 p-3">
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
      <p className="mt-6 text-4xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-5">
      <p className="text-xs uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}
