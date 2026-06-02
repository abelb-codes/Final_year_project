import { useEffect, useState } from 'react';
import { ArrowRight, GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import FeedbackBanner from '../components/FeedbackBanner';
import { ApiError, apiFetch, type FieldErrors } from '../lib/api';
import {
  buildSignupRequestPayload,
  getEmptySignupDraft,
  loadSignupDraft,
  saveSignupDraft,
  type SignupDraft,
} from '../lib/signupFlow';

export default function SignupPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<SignupDraft>(getEmptySignupDraft());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    const storedDraft = loadSignupDraft();
    setDraft((current) => ({
      ...current,
      ...storedDraft,
    }));
  }, []);

  const handleChange = (field: keyof SignupDraft, value: string | number | null) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
    setError('');
    setFieldErrors((current) => {
      const nextErrors = { ...current };
      const apiFieldName =
        field === 'fullName'
          ? 'full_name'
          : field;
      delete nextErrors[apiFieldName];
      return nextErrors;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setFieldErrors({});

    try {
      const payload = buildSignupRequestPayload(draft);
      const response = await apiFetch<{ email: string; retry_after?: number }>('/api/auth/signup/', {
        method: 'POST',
        body: payload,
      });

      const nextDraft = {
        ...draft,
        email: payload.email,
        fullName: payload.full_name,
        otpRequestedAt: Date.now(),
      };
      saveSignupDraft(nextDraft);
      window.sessionStorage.setItem('academic-advisory.signup-success', response.message);
      navigate('/signup/verify');
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setFieldErrors(requestError.fieldErrors);
        const hasFieldErrors = Object.keys(requestError.fieldErrors).length > 0;
        setError(hasFieldErrors ? '' : requestError.message);
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Unable to start signup.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputClassName = (fieldName: string) =>
    `w-full rounded-2xl px-4 py-3.5 text-slate-900 outline-none transition focus:bg-white focus:ring-4 ${
      fieldErrors[fieldName]?.length
        ? 'border border-rose-300 bg-rose-50 focus:border-rose-500 focus:ring-rose-100'
        : 'border border-slate-200 bg-slate-50 focus:border-primary focus:ring-primary/10'
    }`;

  const renderFieldError = (fieldName: string) =>
    fieldErrors[fieldName]?.length ? (
      <p className="text-sm text-rose-600">{fieldErrors[fieldName][0]}</p>
    ) : null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(0,75,122,0.16),_transparent_42%),linear-gradient(180deg,#f8fbff_0%,#eef4f8_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid w-full overflow-hidden rounded-[2rem] border border-white/70 bg-white/95 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur lg:grid-cols-[1.05fr_0.95fr]"
        >
          <div className="relative overflow-hidden bg-[linear-gradient(160deg,#003b61_0%,#0d5f96_56%,#d7e8f5_100%)] p-8 text-white sm:p-10 lg:p-12">
            <div className="absolute -right-12 top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute bottom-0 left-0 h-40 w-40 -translate-x-10 translate-y-10 rounded-full bg-cyan-200/20 blur-3xl" />
            <div className="relative space-y-6">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/16 ring-1 ring-white/20">
                <GraduationCap className="h-7 w-7" />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium uppercase tracking-[0.28em] text-sky-100/80">Secure Registration</p>
                <h1 className="max-w-sm text-3xl font-semibold leading-tight sm:text-4xl">
                  Create your account before verifying your email.
                </h1>
                <p className="max-w-md text-sm leading-6 text-sky-50/88 sm:text-base">
                  Enter your details once, receive a secure one-time code, and finish registration on the next screen.
                </p>
              </div>
              <div className="grid gap-3 rounded-3xl bg-white/10 p-5 text-sm text-sky-50/90 ring-1 ring-white/15">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">1</span>
                  <span>Fill in your full name, email, and password.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">2</span>
                  <span>We validate your details and send a 6-digit code to your email.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">3</span>
                  <span>Verify the code to activate your student account.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 lg:p-12">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8 space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">Step 1 of 2</p>
                <h2 className="text-2xl font-semibold text-slate-900">Create Account</h2>
                <p className="text-sm leading-6 text-slate-500">
                  We will only show the OTP screen after these details are complete.
                </p>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="full-name">
                    Full Name
                  </label>
                  <input
                    id="full-name"
                    type="text"
                    value={draft.fullName}
                    onChange={(event) => handleChange('fullName', event.target.value)}
                    placeholder="e.g. Ada Lovelace"
                    className={getInputClassName('full_name')}
                  />
                  {renderFieldError('full_name')}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={draft.email}
                    onChange={(event) => handleChange('email', event.target.value)}
                    placeholder="student@university.edu"
                    className={getInputClassName('email')}
                  />
                  {renderFieldError('email')}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="password">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={draft.password1}
                      onChange={(event) => handleChange('password1', event.target.value)}
                      placeholder="Create password"
                      className={getInputClassName('password1')}
                    />
                    {renderFieldError('password1')}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor="confirm-password">
                      Confirm Password
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={draft.password2}
                      onChange={(event) => handleChange('password2', event.target.value)}
                      placeholder="Repeat password"
                      className={getInputClassName('password2')}
                    />
                    {renderFieldError('password2')}
                  </div>
                </div>

                {renderFieldError('__all__')}
                {renderFieldError('non_field_errors')}
                {error && <FeedbackBanner message={error} variant="error" />}

                <div className="space-y-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span>{isSubmitting ? 'Creating Account...' : 'Create Account'}</span>
                    {!isSubmitting && <ArrowRight className="h-4 w-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
