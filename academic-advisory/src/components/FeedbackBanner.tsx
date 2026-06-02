type FeedbackVariant = 'error' | 'success' | 'info' | 'warning';

const variantClasses: Record<FeedbackVariant, string> = {
  error: 'border-red-200 bg-red-50 text-red-700',
  success: 'border-green-200 bg-green-50 text-green-700',
  info: 'border-slate-200 bg-slate-50 text-slate-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
};

export default function FeedbackBanner({
  message,
  variant = 'info',
}: {
  message: string;
  variant?: FeedbackVariant;
}) {
  return (
    <div
      className={`rounded-2xl border px-5 py-4 ${variantClasses[variant]}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      {message}
    </div>
  );
}
