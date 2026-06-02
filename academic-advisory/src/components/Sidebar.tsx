import {
  BarChart3,
  Bell,
  Briefcase,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  LucideIcon,
  MessageSquare,
  Settings,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

interface SidebarItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
  onNavigate?: () => void;
}

function SidebarItem({ to, icon: Icon, label, badge, onNavigate }: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group',
          isActive
            ? 'bg-slate-100 text-primary font-medium shadow-sm'
            : 'text-slate-600 hover:bg-slate-50 hover:text-primary'
        )
      }
    >
      <Icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-primary text-white text-[10px] px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export default function Sidebar({ isOpen = true, onNavigate }: { isOpen?: boolean; onNavigate?: () => void }) {
  const { user, logout, dashboardStats } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = user?.access_level === 'super_admin' || user?.is_super_admin === true;
  const displayName = user?.full_name || user?.username || 'User';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((name) => name[0])
    .join('')
    .slice(0, 2);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside
      id="sidebar"
      className={cn(
        'w-64 h-screen bg-white border-r border-slate-200 flex flex-col fixed left-0 top-0 z-40 transition-transform duration-200 md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="p-6 border-b border-slate-100">
        <h1 className="text-xl font-bold text-slate-800">Academic Portal</h1>
        <p className="text-xs text-slate-500 font-medium mt-1">
          {user?.role === 'student' ? 'Case Management System' : user?.role === 'staff' ? 'Staff Operations' : isSuperAdmin ? 'System Administration' : 'Limited Administration'}
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {user?.role === 'student' && (
          <>
            <SidebarItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" onNavigate={onNavigate} />
            <SidebarItem to="/ai-advisor" icon={MessageSquare} label="Ask AI Advisor" onNavigate={onNavigate} />
            <SidebarItem to="/submit-case" icon={FileText} label="Submit Case" onNavigate={onNavigate} />
            <SidebarItem to="/history" icon={History} label="Case History" onNavigate={onNavigate} />
            <SidebarItem to="/notifications" icon={Bell} label="Notifications" badge={dashboardStats?.unread_count} onNavigate={onNavigate} />
          </>
        )}

        {user?.role === 'staff' && (
          <>
            <SidebarItem to="/cases" icon={Briefcase} label="Cases" badge={dashboardStats?.total} onNavigate={onNavigate} />
            <SidebarItem to="/students" icon={Users} label="Students" onNavigate={onNavigate} />
            <SidebarItem to="/notifications" icon={Bell} label="Notifications" badge={dashboardStats?.unread_count} onNavigate={onNavigate} />
            <SidebarItem to="/settings" icon={Settings} label="Settings" onNavigate={onNavigate} />
          </>
        )}

        {isSuperAdmin && (
          <>
            <SidebarItem to="/admin" icon={ShieldCheck} label="Admin Dashboard" onNavigate={onNavigate} />
            <SidebarItem to="/admin/users" icon={Users} label="Users" onNavigate={onNavigate} />
            <SidebarItem to="/admin/departments" icon={LayoutDashboard} label="Departments" onNavigate={onNavigate} />
            <SidebarItem to="/admin/staff" icon={Briefcase} label="Staff Profiles" onNavigate={onNavigate} />
            <SidebarItem to="/admin/cases" icon={FileText} label="All Cases" onNavigate={onNavigate} />
            <SidebarItem to="/admin/notifications" icon={Bell} label="Global Alerts" onNavigate={onNavigate} />
            <SidebarItem to="/notifications" icon={Bell} label="My Notifications" onNavigate={onNavigate} />
            <SidebarItem to="/settings" icon={Settings} label="Settings" onNavigate={onNavigate} />
            <SidebarItem to="/profile" icon={BarChart3} label="Profile Summary" onNavigate={onNavigate} />
          </>
        )}

        {user?.role === 'admin' && !isSuperAdmin && (
          <>
            <SidebarItem to="/notifications" icon={Bell} label="My Notifications" onNavigate={onNavigate} />
            <SidebarItem to="/settings" icon={Settings} label="Settings" onNavigate={onNavigate} />
            <SidebarItem to="/profile" icon={BarChart3} label="Profile Summary" onNavigate={onNavigate} />
          </>
        )}
      </nav>

      <div className="p-4 border-t border-slate-100">
        {user?.role !== 'admin' && <SidebarItem to="/profile" icon={User} label="Profile" onNavigate={onNavigate} />}
        <button
          id="logout-btn"
          onClick={() => void handleLogout()}
          className="w-full flex items-center gap-3 px-4 py-3 mt-1 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors group"
        >
          <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          <span>Logout</span>
        </button>
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold shadow-md">
            {initials || 'US'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{user?.access_level || user?.role || 'guest'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
