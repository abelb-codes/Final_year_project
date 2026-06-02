import { useEffect, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { StudentSummary } from '../types';

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ students: StudentSummary[] }>('/api/staff/students/')
      .then((response) => {
        setStudents(response.data.students);
        setError('');
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load students.');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const filteredStudents = students.filter((student) =>
    [student.name, student.username, student.email, student.latest_case_reference]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Students</h1>
        <p className="text-slate-500">View students with cases currently assigned to you.</p>
      </div>

      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by student name, username, email, or case reference"
          className="block w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {error && (
          <div className="lg:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {error}
          </div>
        )}

        {filteredStudents.map((student) => (
          <div key={student.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-slate-800">{student.name}</h2>
                <p className="text-slate-500">{student.email}</p>
                <p className="text-sm text-slate-400 uppercase tracking-wider">{student.username}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-400">Assigned Cases</p>
                <p className="text-2xl font-bold text-slate-800 mt-2">{student.case_count}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-400">Latest Case</p>
                <p className="text-sm font-semibold text-slate-800 mt-2">{student.latest_case_reference}</p>
                <p className="text-sm text-slate-500">{student.latest_case_status}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
          <p className="text-slate-400 font-medium">Loading students...</p>
        </div>
      )}

      {!isLoading && filteredStudents.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
          <p className="text-slate-400 font-medium">No students found</p>
        </div>
      )}
    </div>
  );
}
