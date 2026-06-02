import { User, Mail, Lock, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import FeedbackBanner from '../components/FeedbackBanner';

export default function ProfilePage() {
  const { user, refreshSession } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
      fullName: '',
      email: '',
      studentId: '',
  });

  useEffect(() => {
    setFormData({
      fullName: user?.full_name || user?.username || '',
      email: user?.email || '',
      studentId: user?.student_id || '',
    });
  }, [user]);

  const displayName = user?.full_name || user?.username || 'User';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((name) => name[0])
    .join('')
    .slice(0, 2);

  const handleSave = async () => {
    const [firstName, ...rest] = formData.fullName.trim().split(' ');
    const lastName = rest.join(' ');

    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch('/api/auth/profile/', {
        method: 'POST',
        body: {
          first_name: firstName || '',
          last_name: lastName,
          email: formData.email,
          student_id: formData.studentId,
        },
      });
      await refreshSession();
      setIsEditing(false);
      setMessage('Profile updated successfully.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100"
      >
        <div className="bg-primary/5 p-12 text-center border-b border-slate-100 relative">
          <div className="w-32 h-32 bg-primary rounded-full flex items-center justify-center text-white text-4xl font-bold mx-auto shadow-2xl relative z-10">
            {initials || 'US'}
          </div>
          <div className="mt-8 space-y-2">
            <h2 className="text-3xl font-bold text-slate-800">{displayName}</h2>
            <p className="text-slate-500 font-medium">{user?.email}</p>
          </div>

          <div className="flex justify-center gap-10 mt-6">
            <div className="text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Student ID</p>
              <p className="text-lg font-bold text-slate-700">{user?.student_id || 'N/A'}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Department</p>
              <p className="text-lg font-bold text-slate-700">{user?.department || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div className="p-12 space-y-10">
          <h3 className="text-2xl font-bold text-slate-800">Edit Profile</h3>

          {error && <FeedbackBanner message={error} variant="error" />}
          {message && <FeedbackBanner message={message} variant="success" />}

          <div className="space-y-6">
            <div className="space-y-2 group">
              <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> Full Name
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData((current) => ({ ...current, fullName: e.target.value }))}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-500"
                readOnly={!isEditing}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                 <Mail className="w-4 h-4 text-primary" /> Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((current) => ({ ...current, email: e.target.value }))}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-500"
                readOnly={!isEditing}
              />
            </div>

            {user?.role === 'student' && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" /> Student ID
                </label>
                <input
                  type="text"
                  value={formData.studentId}
                  onChange={(e) => setFormData((current) => ({ ...current, studentId: e.target.value }))}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-500"
                  readOnly={!isEditing}
                />
              </div>
            )}
          </div>

          <button
            id="edit-profile-btn"
            onClick={() => {
              if (isEditing) {
                void handleSave();
              } else {
                setIsEditing(true);
              }
            }}
            disabled={isSaving}
            className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-60"
          >
            {isEditing ? <><Save className="w-5 h-5" /> {isSaving ? 'Saving...' : 'Save Changes'}</> : 'Edit Profile'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
