import { Search, ChevronRight } from 'lucide-react';
import { formatDate, cn } from '../lib/utils';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { AcademicCase } from '../types';
import FeedbackBanner from '../components/FeedbackBanner';

interface StatCardProps {
  label: string;
  value: number;
  colorClass: string;
}

function StatCard({ label, value, colorClass }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between min-h-[140px]">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={cn('text-4xl font-bold mt-2', colorClass)}>{value}</p>
    </div>
  );
}

export default function StaffDashboard() {
  const [search, setSearch] = useState('');
  const [cases, setCases] = useState<AcademicCase[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch<{ cases: AcademicCase[] }>('/api/staff/cases/')
      .then((response) => {
        setCases(response.data.cases);
        setError('');
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load assigned cases.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filteredCases = cases.filter((caseItem) =>
    [
      caseItem.student.name,
      caseItem.reference_code,
      caseItem.category_label,
      caseItem.title,
    ].some((value) => value.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Assigned Cases</h1>
        <p className="text-slate-500">Review and manage your academic case assignments</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Cases" value={cases.length} colorClass="text-slate-800" />
        <StatCard label="Urgent" value={cases.filter((caseItem) => caseItem.priority === 'U').length} colorClass="text-red-500" />
        <StatCard label="In Progress" value={cases.filter((caseItem) => caseItem.status === 'IP').length} colorClass="text-green-600" />
        <StatCard label="Pending" value={cases.filter((caseItem) => caseItem.status === 'P').length} colorClass="text-yellow-500" />
      </div>

      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by reference, student name, title, or category"
          className="block w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
        />
      </div>

      <div className="space-y-4">
        {error && <FeedbackBanner message={error} variant="error" />}

        {filteredCases.map((caseItem, idx) => (
          <motion.div
            key={caseItem.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            onClick={() => navigate(`/cases/${caseItem.id}`)}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="text-xl font-bold text-slate-800">{caseItem.reference_code}</div>
                <div>
                  <h3 className="font-semibold text-slate-800 group-hover:text-primary transition-colors">
                    {caseItem.student.name}
                  </h3>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">
                    {caseItem.category_label}
                  </p>
                  <p className="text-sm text-slate-500">{caseItem.title}</p>
                </div>
              </div>

              <div className="flex items-center gap-8">
                {caseItem.priority === 'U' && (
                  <span className="text-red-500 font-bold text-lg">Urgent</span>
                )}

                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-slate-700">{formatDate(caseItem.created_at)}</p>
                  <span className={cn(
                    'text-[10px] font-bold uppercase rounded-full px-2 py-0.5',
                    caseItem.status === 'RS' ? 'bg-green-100 text-green-700' :
                    caseItem.status === 'RJ' ? 'bg-red-100 text-red-700' :
                    caseItem.status === 'IP' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  )}>
                    {caseItem.status_label}
                  </span>
                </div>

                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </motion.div>
        ))}

        {!isLoading && filteredCases.length === 0 && (
          <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-400 font-medium">No cases matching your search</p>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-400 font-medium">Loading assigned cases...</p>
          </div>
        )}
      </div>
    </div>
  );
}
