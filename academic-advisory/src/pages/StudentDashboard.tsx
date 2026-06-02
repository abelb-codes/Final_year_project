import React from 'react';
import { ArrowRight, Bell, FileText, History, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DashboardStats } from '../types';

interface TileProps {
  icon: React.ElementType;
  title: string;
  onClick: () => void;
}

function Tile({ icon: Icon, title, onClick }: TileProps) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      onClick={onClick}
      className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all group"
    >
      <div className="w-12 h-12 bg-slate-50 text-primary rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-xl font-bold text-slate-800">{title}</h3>
      <div className="flex items-center gap-2 text-primary font-medium mt-4 text-sm">
        <span>Get Started</span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>
    </motion.div>
  );
}

const emptyStats: DashboardStats = {
  total: 0,
  pending: 0,
  in_progress: 0,
  resolved: 0,
  rejected: 0,
  unread_count: 0,
};

export default function StudentDashboard() {
  const { user, dashboardStats } = useAuth();
  const navigate = useNavigate();
  const stats = dashboardStats || emptyStats;

  const displayName = user?.full_name || user?.username || 'Student';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((name) => name[0])
    .join('')
    .slice(0, 2);

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-800">
            Welcome, {displayName.split(' ')[0]}
          </h1>
          <p className="text-slate-500 mt-2 max-w-2xl leading-relaxed">
            Submit academic issues in plain language, track each case, and stay updated as staff respond.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100 shrink-0 self-start md:self-center">
          <div className="text-right">
            <p className="text-sm font-bold text-slate-800">{displayName}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              Student ID {user?.student_id || 'Not set'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg">
            {initials || 'ST'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <Tile icon={FileText} title="Submit Case" onClick={() => navigate('/submit-case')} />
        <Tile icon={History} title="Case History" onClick={() => navigate('/history')} />
        <Tile icon={Bell} title="Notifications" onClick={() => navigate('/notifications')} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
          <p className="text-4xl font-bold text-slate-800">{stats.pending + stats.in_progress}</p>
          <p className="text-sm font-medium text-slate-500 mt-1 uppercase tracking-widest">Active Cases</p>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
          <p className="text-4xl font-bold text-slate-800">{stats.unread_count}</p>
          <p className="text-sm font-medium text-slate-500 mt-1 uppercase tracking-widest">Unread Alerts</p>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
          <p className="text-4xl font-bold text-slate-800">{stats.total}</p>
          <p className="text-sm font-medium text-slate-500 mt-1 uppercase tracking-widest">Total Cases</p>
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate('/ai-advisor')}
        className="fixed bottom-10 right-10 bg-[#004b7a] text-white px-8 py-4 rounded-2xl shadow-xl hover:shadow-2xl transition-all flex items-center gap-3 z-30 group"
      >
        <div className="p-2 bg-white/20 rounded-lg group-hover:rotate-12 transition-transform">
          <MessageSquare className="w-6 h-6" />
        </div>
        <span className="text-lg font-bold">ASK AI</span>
      </motion.button>
    </div>
  );
}
