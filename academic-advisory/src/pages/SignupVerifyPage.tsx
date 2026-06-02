import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, GraduationCap, MailCheck, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import FeedbackBanner from '../components/FeedbackBanner';
import OtpCodeInput from '../components/auth/OtpCodeInput';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import {
  buildSignupRequestPayload,
  clearSignupDraft,
  getRemainingSignupCooldown,
  hasSignupDraft,
  loadSignupDraft,
  maskEmail,
  saveSignupDraft,
  type SignupDraft,
} from '../lib/signupFlow';

export default function SignupVerifyPage() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [draft, setDraft] = useState<SignupDraft | null>(null);
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const storedDraft = loadSignupDraft();
    if (!hasSignupDraft(storedDraft)) {
      navigate('/signup', { replace: true });
      return;
    }

    setDraft(storedDraft);
    setCountdown(getRemainingSignupCooldown(storedDraft));
    const signupSuccessMessage = window.sessionStorage.getItem('academic-advisory.signup-success');
    if (signupSuccessMessage) {
      setSuccess(signupSuccessMessage);
      window.sessionStorage.removeItem('academic-advisory.signup-success');
    }
  }, [navigate]);

  useEffect(() => {
    if (countdown <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const maskedEmail = useMemo(() => maskEmail(draft?.email ?? ''), [draft?.email]);
  const isOtpComplete = otp.length === 6;

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || !isOtpComplete) {
      return;
    }

    setIsVerifying(true);
    setError('');
    setSuccess('');

    try {
      await apiFetch('/api/auth/signup/', {
        method: 'POST',
        body: {
          email: draft.email.trim().toLowerCase(),
          otp,
        },
      });
      clearSignupDraft();
      await refreshSession();
      navigate('/', { replace: true });
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Unable to verify the code.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!draft || countdown > 0) {
      return;
    }

    setIsResending(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiFetch('/api/auth/signup/', {
        method: 'POST',
        body: buildSignupRequestPayload(draft),
      });

      const refreshedDraft = {
        ...draft,
        otpRequestedAt: Date.now(),
      };
      saveSignupDraft(refreshedDraft);
      setDraft(refreshedDraft);
      setCountdown(60);
      setOtp('');
      setSuccess(response.message || 'A verification code has been sent to your email.');
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Unable to resend the code.');
    } finally {
      setIsResending(false);
    }
  };

  if (!draft) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,75,122,0.14),_transparent_42%),linear-gradient(180deg,#f8fbff_0%,#eef4f8_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full overflow-hidden rounded-[2rem] border border-white/70 bg-white/95 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur"
        >
          <div className="border-b border-slate-100 bg-[linear-gradient(180deg,rgba(0,75,122,0.05),rgba(255,255,255,0))] px-6 py-8 sm:px-8 lg:px-10">
            <div className="mx-auto flex max-w-xl flex-col items-center text-center">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
                <GraduationCap className="h-7 w-7" />
              </div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">Step 2 of 2</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">Verify Your Email</h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500 sm:text-base">
                We sent a 6-digit code to <span className="font-medium text-slate-700">{maskedEmail}</span>. Enter it below to finish creating your account.
              </p>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-8 lg:px-10">
            <div className="mx-auto max-w-xl space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
                    <MailCheck className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold text-slate-900">Check your inbox</h2>
                    <p className="text-sm leading-6 text-slate-500">
                      Your verification code expires in 5 minutes. For security, it can only be used once.
                    </p>
                  </div>
                </div>
              </div>

              <form className="space-y-5" onSubmit={handleVerify}>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Verification Code</label>
                  <OtpCodeInput value={otp} onChange={setOtp} disabled={isVerifying} />
                  <p className="text-sm text-slate-500">
                    {countdown > 0 ? `You can request another code in ${countdown}s.` : 'You can request another code now.'}
                  </p>
                </div>

                {error && <FeedbackBanner message={error} variant="error" />}
                {success && <FeedbackBanner message={success} variant="success" />}

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="submit"
                    disabled={!isOtpComplete || isVerifying}
                    className="rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleResend()}
                    disabled={countdown > 0 || isResending}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3.5 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>{isResending ? 'Resending...' : countdown > 0 ? `Resend Code (${countdown}s)` : 'Resend Code'}</span>
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => navigate('/signup')}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Change Email</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="rounded-2xl border border-slate-200 px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
