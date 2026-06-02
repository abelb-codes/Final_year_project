import { useEffect, useState } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { AcademicCase, DepartmentOption, StaffOption } from '../types';
import { useAuth } from '../context/AuthContext';
import FeedbackBanner from '../components/FeedbackBanner';

export default function SubmitCasePage() {
  const navigate = useNavigate();
  const { refreshDashboardStats } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loadMessage, setLoadMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ departments: DepartmentOption[] }>('/api/staff/departments/')
      .then((response) => {
        const { departments: availableDepartments } = response.data;
        setDepartments(availableDepartments);
        if (availableDepartments.length === 0) {
          setLoadMessage('No departments are configured yet. You can still submit and the system will auto-route when possible.');
        }
      })
      .catch((loadError) => {
        setLoadMessage(loadError instanceof Error ? loadError.message : 'Departments could not be loaded right now.');
      });
  }, []);

  useEffect(() => {
    if (!selectedDepartment) {
      setStaffList([]);
      setSelectedStaff('');
      return;
    }

    apiFetch<{ staff_members: StaffOption[] }>(`/api/staff/departments/${selectedDepartment}/members/`)
      .then((response) => setStaffList(response.data.staff_members))
      .catch(() => setStaffList([]));
  }, [selectedDepartment]);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      setError('Enter a case title and description before submitting.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('description', description.trim());

    if (selectedDepartment) {
      formData.append('department_id', selectedDepartment);
    }
    if (selectedStaff) {
      formData.append('staff_id', selectedStaff);
    }
    if (file) {
      formData.append('file', file);
    }

    try {
      await apiFetch<{ case: AcademicCase }>('/api/cases/create/', {
        method: 'POST',
        body: formData,
      });
      await refreshDashboardStats();
      setIsSuccess(true);
      setTimeout(() => navigate('/history'), 1800);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your case.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center space-y-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center"
        >
          <CheckCircle2 className="w-14 h-14" />
        </motion.div>
        <h2 className="text-3xl font-bold text-slate-800">Case Submitted Successfully</h2>
        <p className="text-slate-500">
          Your title was analyzed, the case was categorized server-side, and routing has started.
          <br />
          Redirecting you to your case history...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Submit Case</h1>
        <p className="text-slate-500">Describe the issue in plain language. The system will infer the category automatically.</p>
      </div>

      {loadMessage && <FeedbackBanner message={loadMessage} variant="warning" />}
      {error && <FeedbackBanner message={error} variant="error" />}

      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm"
        >
          <div className="flex items-start gap-6">
            <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold">1</div>
            <div className="flex-1 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Case Title</h3>
                <p className="text-sm text-slate-500">Examples: "Exam appeal", "Registration issue", "Financial support request".</p>
              </div>
              <div className="relative">
                <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Write a short title for your case"
                  className="w-full rounded-2xl border border-slate-200 py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm"
        >
          <div className="flex items-start gap-6">
            <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold">2</div>
            <div className="flex-1 space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Department and Staff</h3>
              <p className="text-sm text-slate-500">Optional. Leave blank if you want the system to assign the best match automatically.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                  <select
                    value={selectedDepartment}
                    onChange={(event) => setSelectedDepartment(event.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Let system choose</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Staff</label>
                  <select
                    value={selectedStaff}
                    onChange={(event) => setSelectedStaff(event.target.value)}
                    disabled={!selectedDepartment || staffList.length === 0}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                  >
                    <option value="">Let system choose</option>
                    {staffList.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm"
        >
          <div className="flex items-start gap-6">
            <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold">3</div>
            <div className="flex-1 space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Describe the Issue</h3>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Include what happened, what outcome you need, and any deadlines involved."
                className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm"
        >
          <div className="flex items-start gap-6">
            <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold">4</div>
            <div className="flex-1 space-y-6">
              <h3 className="text-lg font-bold text-slate-800">Attach Supporting File</h3>
              <p className="text-sm text-slate-500">Optional. PDF, JPG, and PNG files are supported up to 5MB.</p>
              <input
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                accept=".pdf,.jpg,.jpeg,.png"
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </motion.div>

        <div className="flex justify-end pt-6">
          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="px-10 py-4 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-3"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Case'}
          </button>
        </div>
      </div>
    </div>
  );
}
