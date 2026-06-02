import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from .models import OTPVerification


OTP_EXPIRY_MINUTES = 5
OTP_COOLDOWN_SECONDS = 60
OTP_MAX_ATTEMPTS = 5


def normalize_email(email):
    return (email or '').strip().lower()


def generate_otp():
    return f'{secrets.randbelow(1000000):06d}'


def hash_otp(email, purpose, otp):
    payload = f'{normalize_email(email)}:{purpose}:{otp}:{settings.SECRET_KEY}'
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def get_otp_cooldown_seconds():
    return getattr(settings, 'OTP_COOLDOWN_SECONDS', OTP_COOLDOWN_SECONDS)


def get_otp_expiry_minutes():
    return getattr(settings, 'OTP_EXPIRY_MINUTES', OTP_EXPIRY_MINUTES)


def get_otp_max_attempts():
    return getattr(settings, 'OTP_MAX_ATTEMPTS', OTP_MAX_ATTEMPTS)


def otp_expired(expires_at):
    return timezone.now() >= expires_at


def has_active_cooldown(email, purpose):
    cooldown_started_at = timezone.now() - timedelta(seconds=get_otp_cooldown_seconds())
    return OTPVerification.objects.filter(
        email=normalize_email(email),
        purpose=purpose,
        created_at__gte=cooldown_started_at,
        is_used=False,
    ).exists()


def create_otp(email, purpose, user=None, context=None):
    normalized_email = normalize_email(email)
    OTPVerification.objects.filter(
        email=normalized_email,
        purpose=purpose,
        is_used=False,
    ).delete()

    raw_otp = generate_otp()
    otp_record = OTPVerification.objects.create(
        email=normalized_email,
        user=user,
        purpose=purpose,
        code=hash_otp(normalized_email, purpose, raw_otp),
        expires_at=timezone.now() + timedelta(minutes=get_otp_expiry_minutes()),
        context=context or {},
    )
    return otp_record, raw_otp


def verify_otp(email, purpose, otp):
    normalized_email = normalize_email(email)
    otp_record = (
        OTPVerification.objects.filter(
            email=normalized_email,
            purpose=purpose,
            is_used=False,
        )
        .order_by('-created_at')
        .first()
    )

    if not otp_record:
        return None, 'No verification code was found for this request.'

    if otp_record.is_expired():
        otp_record.delete()
        return None, 'This verification code has expired. Please request a new one.'

    if otp_record.code != hash_otp(normalized_email, purpose, otp):
        otp_record.attempt_count += 1
        if otp_record.attempt_count >= get_otp_max_attempts():
            otp_record.delete()
            return None, 'Too many invalid attempts. Please request a new verification code.'
        otp_record.save(update_fields=['attempt_count'])
        return None, 'The verification code you entered is invalid.'

    return otp_record, None


def mark_otp_used(otp_record):
    otp_record.is_used = True
    otp_record.save(update_fields=['is_used'])


def send_otp_email(email, otp, purpose):
    subject = 'Your Verification Code'
    message = f'Your OTP code is: {otp}. It expires in {get_otp_expiry_minutes()} minutes.'
    send_mail(
        subject=subject,
        message=message,
        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@localhost'),
        recipient_list=[normalize_email(email)],
        fail_silently=False,
    )
