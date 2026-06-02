import { useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { NotificationItem } from '../types';
import { formatDate } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import FeedbackBanner from '../components/FeedbackBanner';

export default function NotificationsPage() {
  const { refreshDashboardStats } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');

  const loadNotifications = async () => {
    try {
      const response = await apiFetch<{ notifications: NotificationItem[]; unread_count: number }>('/api/notifications/');
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unread_count);
      setError('');
      await refreshDashboardStats();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load notifications.');
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  const markAsRead = async (notificationId: number) => {
    try {
      await apiFetch(`/api/notifications/${notificationId}/read/`, {
        method: 'POST',
        body: {},
      });
      await loadNotifications();
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : 'Unable to mark the notification as read.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Notifications</h1>
          <p className="text-slate-500">Stay updated as your university support cases move forward.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm text-right">
          <p className="text-xs uppercase tracking-widest text-slate-400">Unread</p>
          <p className="text-3xl font-bold text-slate-800">{unreadCount}</p>
        </div>
      </div>

      <div className="space-y-4">
        {error && <FeedbackBanner message={error} variant="error" />}

        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`rounded-2xl border px-6 py-5 shadow-sm transition-all ${
              notification.is_read
                ? 'border-slate-200 bg-white'
                : 'border-primary/20 bg-primary/5'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-primary">
                  <Bell className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm uppercase tracking-widest text-slate-400">
                    {notification.notification_label}
                  </p>
                  <h2 className="text-lg font-semibold text-slate-800">
                    {notification.reference_code || `Case #${notification.case_id}`}
                  </h2>
                  <p className="text-slate-600">{notification.message}</p>
                  <p className="text-sm text-slate-400">{formatDate(notification.created_at)}</p>
                </div>
              </div>

              {!notification.is_read && (
                <button
                  onClick={() => void markAsRead(notification.id)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary transition-colors"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark Read
                </button>
              )}
            </div>
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
            <p className="text-slate-400 font-medium">No notifications yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
