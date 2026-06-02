import { FormEvent, useState } from 'react';
import FeedbackBanner from '../components/FeedbackBanner';
import { apiFetch } from '../lib/api';

export default function AdminNotificationsPage() {
  const [message, setMessage] = useState('');
  const [targetRole, setTargetRole] = useState<'student' | 'staff' | 'admin'>('student');
  const [sendToStudentsOnly, setSendToStudentsOnly] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSending(true);
    setFeedback('');
    setError('');

    try {
      const response = await apiFetch<{ recipient_count: number }>('/api/admin/notifications/global/', {
        method: 'POST',
        body: {
          message,
          ...(sendToStudentsOnly ? { send_to_students: true } : { target_role: targetRole }),
        },
      });
      setFeedback(`Announcement sent to ${response.data.recipient_count} users.`);
      setMessage('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to send global notification.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Global Notifications</h1>
        <p className="text-slate-500">Broadcast important messages without accessing Django Admin.</p>
      </div>

      {error && <FeedbackBanner message={error} variant="error" />}
      {feedback && <FeedbackBanner message={feedback} variant="success" />}

      <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={sendToStudentsOnly}
            onChange={(event) => setSendToStudentsOnly(event.target.checked)}
          />
          Send to all students
        </label>

        {!sendToStudentsOnly && (
          <select
            value={targetRole}
            onChange={(event) => setTargetRole(event.target.value as 'student' | 'staff' | 'admin')}
            className="w-full rounded-xl border border-slate-200 px-4 py-3"
          >
            <option value="student">Students</option>
            <option value="staff">Staff</option>
            <option value="admin">Admins</option>
          </select>
        )}

        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Write your announcement"
          className="h-36 w-full rounded-xl border border-slate-200 px-4 py-3"
          required
        />

        <button disabled={isSending} className="rounded-xl bg-primary px-5 py-3 font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
          {isSending ? 'Sending...' : 'Send Notification'}
        </button>
      </form>
    </div>
  );
}
