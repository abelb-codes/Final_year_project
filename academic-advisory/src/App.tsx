import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

import AdminDashboard from './pages/AdminDashboard';
import AdminCasesPage from './pages/AdminCasesPage';
import AdminDepartmentsPage from './pages/AdminDepartmentsPage';
import AdminNotificationsPage from './pages/AdminNotificationsPage';
import AdminStaffPage from './pages/AdminStaffPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AIAdvisorPage from './pages/AIAdvisorPage';
import CaseHistoryPage from './pages/CaseHistoryPage';
import CaseReviewPage from './pages/CaseReviewPage';
import LoginPage from './pages/LoginPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SettingsPage from './pages/SettingsPage';
import SignupPage from './pages/SignupPage';
import SignupVerifyPage from './pages/SignupVerifyPage';
import StaffDashboard from './pages/StaffDashboard';
import StudentDashboard from './pages/StudentDashboard';
import StudentsPage from './pages/StudentsPage';
import SubmitCasePage from './pages/SubmitCasePage';

function RoleRedirect() {
  const { user } = useAuth();

  if (user?.role === 'student') {
    return <Navigate to="/dashboard" replace />;
  }
  if (user?.role === 'staff') {
    return <Navigate to="/cases" replace />;
  }
  if (user?.access_level === 'super_admin' || user?.is_super_admin) {
    return <Navigate to="/admin" replace />;
  }
  if (user?.role === 'admin') {
    return <Navigate to="/notifications" replace />;
  }

  return <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isSuperAdmin = user?.access_level === 'super_admin' || user?.is_super_admin === true;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Loading portal...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/signup/verify" element={<SignupVerifyPage />} />
        <Route path="/forgot-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/dashboard" element={user.role === 'student' ? <StudentDashboard /> : <Navigate to="/" replace />} />
        <Route path="/submit-case" element={user.role === 'student' ? <SubmitCasePage /> : <Navigate to="/" replace />} />
        <Route path="/history" element={user.role === 'student' ? <CaseHistoryPage /> : <Navigate to="/" replace />} />
        <Route path="/history/:id" element={user.role === 'student' ? <CaseReviewPage /> : <Navigate to="/" replace />} />
        <Route path="/ai-advisor" element={user.role === 'student' ? <AIAdvisorPage /> : <Navigate to="/" replace />} />

        <Route path="/cases" element={user.role === 'staff' ? <StaffDashboard /> : <Navigate to="/" replace />} />
        <Route path="/cases/:id" element={user.role === 'staff' ? <CaseReviewPage /> : <Navigate to="/" replace />} />
        <Route path="/students" element={user.role === 'staff' ? <StudentsPage /> : <Navigate to="/" replace />} />

        <Route path="/admin" element={isSuperAdmin ? <AdminDashboard /> : <Navigate to="/" replace />} />
        <Route path="/admin/users" element={isSuperAdmin ? <AdminUsersPage /> : <Navigate to="/" replace />} />
        <Route path="/admin/departments" element={isSuperAdmin ? <AdminDepartmentsPage /> : <Navigate to="/" replace />} />
        <Route path="/admin/staff" element={isSuperAdmin ? <AdminStaffPage /> : <Navigate to="/" replace />} />
        <Route path="/admin/cases" element={isSuperAdmin ? <AdminCasesPage /> : <Navigate to="/" replace />} />
        <Route path="/admin/notifications" element={isSuperAdmin ? <AdminNotificationsPage /> : <Navigate to="/" replace />} />

        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<RoleRedirect />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
