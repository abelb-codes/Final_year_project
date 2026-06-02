import { useEffect, useMemo, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import FeedbackBanner from '../components/FeedbackBanner';
import OtpCodeInput from '../components/auth/OtpCodeInput';
import { ApiError, apiFetch } from '../lib/api';
import { maskEmail } from '../lib/signupFlow';

const RESEND_SECONDS = 60;

type ResetStep = 'request' | 'verify' | 'reset';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<ResetStep>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (countdown <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const maskedEmail = useMemo(() => maskEmail(email), [email]);

  const stepIndex = {
    request: 1,
    verify: 2,
    reset: 3,
  }[step];

  const resetFeedback = () => {
    setError('');
    setSuccess('');
  };

  const handleRequestOtp = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Enter the email address linked to your account.');
      return;
    }

    setIsRequestingOtp(true);
    resetFeedback();

    try {
      const response = await apiFetch<{ retry_after?: number }>('/api/auth/reset/request-otp/', {
        method: 'POST',
        body: { email: normalizedEmail },
      });
      setEmail(normalizedEmail);
      setStep('verify');
      setCountdown(response.data.retry_after ?? RESEND_SECONDS);
      setOtp('');
      setSuccess('A verification code has been sent to your email.');
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Unable to send verification code.');
      }
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleVerifyOtp = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (otp.trim().length !== 6) {
      setError('Enter the 6-digit verification code.');
      return;
    }

    setIsVerifyingOtp(true);
    resetFeedback();

    try {
      const response = await apiFetch('/api/auth/reset/verify-otp/', {
        method: 'POST',
        body: {
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
        },
      });
      setStep('reset');
      setSuccess(response.message);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Unable to verify the code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResetPassword = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError('Enter and confirm your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsResettingPassword(true);
    resetFeedback();

    try {
      const response = await apiFetch('/api/auth/reset/verify-otp/', {
        method: 'POST',
        body: {
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
          new_password: newPassword,
        },
      });
      setSuccess(response.message);
      window.setTimeout(() => navigate('/login'), 1200);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Unable to reset password.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || isRequestingOtp) {
      return;
    }
    await handleRequestOtp();
  };

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
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">Password Recovery</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">Reset Your Password</h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500 sm:text-base">
                {step === 'request' && 'Enter your email address to receive a verification code.'}
                {step === 'verify' && (
                  <>Enter the code we sent to <span className="font-medium text-slate-700">{maskedEmail}</span>.</>
                )}
                {step === 'reset' && 'Choose a new password for your account.'}
              </p>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-8 lg:px-10">
            <div className="mx-auto max-w-xl space-y-6">
              <div className="flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-4 text-sm">
                {['Create Request', 'Verify Code', 'Reset Password'].map((label, index) => {
                  const currentIndex = index + 1;
                  const active = stepIndex === currentIndex;
                  const complete = stepIndex > currentIndex;

                  return (
                    <div
                      key={label}
                      className={`flex-1 rounded-2xl px-4 py-3 text-center font-medium transition ${
                        active
                          ? 'bg-primary text-white shadow-lg shadow-primary/15'
                          : complete
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-white text-slate-400'
                      }`}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>

              {step === 'request' && (
                <form className="space-y-5" onSubmit={handleRequestOtp}>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700" htmlFor="reset-email">
                      Email
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        resetFeedback();
                      }}
                      placeholder="Enter your email address"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                    />
                  </div>

                  {error && <FeedbackBanner message={error} variant="error" />}
                  {success && <FeedbackBanner message={success} variant="success" />}

                  <div className="space-y-3">
                    <button
                      type="submit"
                      disabled={isRequestingOtp}
                      className="w-full rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRequestingOtp ? 'Sending Verification Code...' : 'Send Verification Code'}
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="w-full text-sm font-medium text-slate-500 transition hover:text-slate-700"
                    >
                      Back to Login
                    </button>
                  </div>
                </form>
              )}

              {step === 'verify' && (
                <form className="space-y-5" onSubmit={handleVerifyOtp}>
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">Verification Code</label>
                    <OtpCodeInput value={otp} onChange={(value) => {
                      setOtp(value);
                      resetFeedback();
                    }} disabled={isVerifyingOtp} />
                    <p className="text-sm text-slate-500">
                      {countdown > 0 ? `You can resend a code in ${countdown}s.` : 'You can resend a new code now.'}
                    </p>
                  </div>

                  {error && <FeedbackBanner message={error} variant="error" />}
                  {success && <FeedbackBanner message={success} variant="success" />}

                  <div className="space-y-3">
                    <button
                      type="submit"
                      disabled={isVerifyingOtp || otp.trim().length !== 6}
                      className="w-full rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isVerifyingOtp ? 'Verifying Code...' : 'Verify Code'}
                    </button>

                    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
                      <button
                        type="button"
                        onClick={() => void handleResend()}
                        disabled={countdown > 0 || isRequestingOtp}
                        className="font-medium text-primary transition hover:text-primary/80 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        {isRequestingOtp ? 'Resending...' : 'Resend Code'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStep('request');
                          setOtp('');
                          resetFeedback();
                        }}
                        className="font-medium text-slate-500 transition hover:text-slate-700"
                      >
                        Change Email
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="font-medium text-slate-500 transition hover:text-slate-700"
                      >
                        Back to Login
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {step === 'reset' && (
                <form className="space-y-5" onSubmit={handleResetPassword}>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700" htmlFor="new-password">
                      New Password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(event) => {
                        setNewPassword(event.target.value);
                        resetFeedback();
                      }}
                      placeholder="Create a new password"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700" htmlFor="confirm-new-password">
                      Confirm Password
                    </label>
                    <input
                      id="confirm-new-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        resetFeedback();
                      }}
                      placeholder="Confirm your new password"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                    />
                  </div>

                  {error && <FeedbackBanner message={error} variant="error" />}
                  {success && <FeedbackBanner message={success} variant="success" />}

                  <div className="space-y-3">
                    <button
                      type="submit"
                      disabled={isResettingPassword}
                      className="w-full rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isResettingPassword ? 'Resetting Password...' : 'Reset Password'}
                    </button>

                    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
                      <button
                        type="button"
                        onClick={() => {
                          setStep('verify');
                          setNewPassword('');
                          setConfirmPassword('');
                          resetFeedback();
                        }}
                        className="font-medium text-slate-500 transition hover:text-slate-700"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="font-medium text-slate-500 transition hover:text-slate-700"
                      >
                        Back to Login
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
