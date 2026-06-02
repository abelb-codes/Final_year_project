import { useState } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FeedbackBanner from '../components/FeedbackBanner';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await login(username, password);
      navigate('/');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
      >
        <div className="p-8 text-center border-b border-slate-50">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white mx-auto mb-4 shadow-lg">
            <GraduationCap className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Academic Advisory Portal</h1>
          <p className="text-slate-500 mt-2">Sign in to access the case management system</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleLogin()}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-sm font-medium text-primary hover:text-primary/80"
                >
                  Forgot password?
                </button>
              </div>
            </div>
          </div>

          {error && <FeedbackBanner message={error} variant="error" />}

          <FeedbackBanner
            message="Use your university-issued account credentials to access the portal. Contact the system administrator if your account has not been provisioned yet."
            variant="info"
          />

          <div className="flex gap-4">
            <button
              onClick={() => void handleLogin()}
              disabled={isSubmitting}
              className="flex-1 bg-primary text-white font-semibold py-3 rounded-lg hover:bg-primary/90 transition-colors shadow-md active:scale-95 disabled:opacity-60"
            >
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>

            <button
              onClick={() => navigate('/signup')}
              className="flex-1 border border-primary text-primary font-semibold py-3 rounded-lg hover:bg-primary/5 transition-colors"
            >
              Sign Up
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
