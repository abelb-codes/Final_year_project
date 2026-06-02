export interface SignupDraft {
  fullName: string;
  email: string;
  password1: string;
  password2: string;
  otpRequestedAt: number | null;
}

const SIGNUP_DRAFT_KEY = 'academic-advisory.signup-draft';
const RESEND_SECONDS = 60;

export function getEmptySignupDraft(): SignupDraft {
  return {
    fullName: '',
    email: '',
    password1: '',
    password2: '',
    otpRequestedAt: null,
  };
}

export function loadSignupDraft(): SignupDraft {
  if (typeof window === 'undefined') {
    return getEmptySignupDraft();
  }

  try {
    const raw = window.sessionStorage.getItem(SIGNUP_DRAFT_KEY);
    if (!raw) {
      return getEmptySignupDraft();
    }

    return {
      ...getEmptySignupDraft(),
      ...(JSON.parse(raw) as Partial<SignupDraft>),
    };
  } catch {
    return getEmptySignupDraft();
  }
}

export function saveSignupDraft(draft: SignupDraft) {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(draft));
}

export function clearSignupDraft() {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
}

export function buildSignupRequestPayload(draft: SignupDraft) {
  return {
    full_name: draft.fullName.trim(),
    email: draft.email.trim().toLowerCase(),
    password1: draft.password1,
    password2: draft.password2,
  };
}

export function hasSignupDraft(draft: SignupDraft) {
  return Boolean(
    draft.fullName.trim() &&
      draft.email.trim() &&
      draft.password1 &&
      draft.password2,
  );
}

export function getRemainingSignupCooldown(draft: SignupDraft) {
  if (!draft.otpRequestedAt) {
    return 0;
  }

  const elapsedSeconds = Math.floor((Date.now() - draft.otpRequestedAt) / 1000);
  return Math.max(0, RESEND_SECONDS - elapsedSeconds);
}

export function maskEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const [localPart, domain] = normalized.split('@');
  if (!localPart || !domain) {
    return normalized;
  }

  if (localPart.length <= 2) {
    return `${localPart[0] ?? ''}***@${domain}`;
  }

  return `${localPart.slice(0, 2)}${'*'.repeat(Math.max(2, localPart.length - 2))}@${domain}`;
}
