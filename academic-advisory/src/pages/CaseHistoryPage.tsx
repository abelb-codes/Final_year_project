import { useState, useEffect } from 'react';
import { formatDate, cn } from '../lib/utils';
import { motion } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { AcademicCase } from '../types';
import { useNavigate } from 'react-router-dom';
import FeedbackBanner from '../components/FeedbackBanner';

export default function CaseHistoryPage() {
  const [cases, setCases] = useState<AcademicCase[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch<{ cases: AcademicCase[] }>('/api/cases/')
      .then((response) => {
        setCases(response.data.cases);
        setError('');
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load case history.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Case History</h1>
        <p className="text-slate-500">Track all your previous academic case submissions</p>
      </div>

      {error && <FeedbackBanner message={error} variant="error" />}

      <div className="grid grid-cols-1 gap-6">
        {isLoading && (
          <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-400 font-medium">Loading case history...</p>
          </div>
        )}

        {cases.map((caseItem, idx) => (
          <motion.div
            key={caseItem.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:border-primary/30 transition-all"
          >
            <div className="flex items-center gap-8">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-sm',
                caseItem.status === 'RS' ? 'bg-green-50 text-green-600' :
                caseItem.status === 'RJ' ? 'bg-red-50 text-red-600' :
                caseItem.status === 'IP' ? 'bg-blue-50 text-blue-600' :
                'bg-yellow-50 text-yellow-600'
              )}>
                {caseItem.status === 'RS' ? <CheckCircle2 className="w-8 h-8" /> :
                 caseItem.status === 'RJ' ? <XCircle className="w-8 h-8" /> :
                 caseItem.status === 'IP' ? <Clock className="w-8 h-8" /> :
                 <AlertCircle className="w-8 h-8" />}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {caseItem.reference_code}
                  </span>
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

                <h3 className="text-xl font-bold text-slate-800">{caseItem.title}</h3>
                <p className="text-slate-500 line-clamp-1">{caseItem.description}</p>
                <p className="text-xs text-slate-400 uppercase tracking-wider">
                  {caseItem.category_label}
                </p>
              </div>
            </div>

            <div className="text-right flex flex-col items-end gap-2 border-t md:border-t-0 pt-4 md:pt-0 md:border-l md:pl-8 border-slate-100">
              <p className="text-sm font-bold text-slate-700">Submitted on</p>
              <p className="text-slate-500">{formatDate(caseItem.created_at)}</p>
              <button
                onClick={() => navigate(`/history/${caseItem.id}`)}
                className="text-primary font-bold text-sm mt-2 hover:underline"
              >
                {caseItem.staff ? `Assigned to ${caseItem.staff.name}` : 'Awaiting assignment'}
              </button>
            </div>
          </motion.div>
        ))}

        {!isLoading && cases.length === 0 && (
          <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-400 font-medium">No case history yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
