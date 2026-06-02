import json
import logging
import re
from functools import wraps
from pathlib import Path

from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.decorators import login_required
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db.models import Count, Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_http_methods, require_POST

logger = logging.getLogger(__name__)

from .ai_service import ask_academic_advisor
from .models import (
    CASE_PRIORITY_CHOICES,
    CASE_CATEGORY_CHOICES,
    Case,
    CaseDocument,
    CaseLog,
    CaseMessage,
    Faculty,
    Department,
    Notification,
    OTPVerification,
    AIChatHistory,
    StaffProfile,
    StudentProfile,
    User,
)
from .otp_utils import (
    create_otp,
    get_otp_expiry_minutes,
    get_otp_cooldown_seconds,
    mark_otp_used,
    normalize_email,
    send_otp_email,
    verify_otp,
    has_active_cooldown,
)
from .roles import (
    VALID_ROLES,
    access_level_for_user,
    configured_role_for_email,
    is_normal_admin,
    is_super_admin,
    reconcile_user_role,
)


MAX_UPLOAD_SIZE = 5 * 1024 * 1024
ALLOWED_UPLOAD_TYPES = {
    'application/pdf',
    'image/jpeg',
    'image/png',
}

AI_CHAT_HISTORY_LIMIT = 100
AI_RATE_LIMIT_WINDOW_SECONDS = 15
AI_MAX_REQUESTS_PER_WINDOW = 12
AI_QUESTION_MAX_LENGTH = 1200
AUTH_RATE_LIMIT_WINDOW_SECONDS = 60
AUTH_MAX_REQUESTS_PER_WINDOW = 10


CATEGORY_TO_DEPARTMENT_HINTS = {
    'AC': ['academic', 'exam', 'course', 'faculty', 'college', 'assessment', 'grade'],
    'AR': ['advisor', 'advis', 'guidance', 'curriculum', 'program', 'mentor', 'degree'],
    'WS': ['welfare', 'support', 'student affairs', 'financial', 'aid', 'counsel', 'wellbeing'],
    'AD': ['registrar', 'admin', 'record', 'document', 'registration', 'clearance'],
    'DI': ['discipline', 'conduct', 'integrity', 'misconduct', 'ethics'],
}


TITLE_CATEGORY_HINTS = {
    'makeup': 'AC',
    'exam': 'AC',
    'grade': 'AC',
    'appeal': 'AC',
    'remark': 'AC',
    'readmission': 'AR',
    'advis': 'AR',
    'degree audit': 'AR',
    'curriculum': 'AR',
    'financial': 'WS',
    'support': 'WS',
    'counsel': 'WS',
    'welfare': 'WS',
    'document': 'AD',
    'registration': 'AD',
    'transcript': 'AD',
    'clearance': 'AD',
    'misconduct': 'DI',
    'disciplin': 'DI',
    'plagiar': 'DI',
}

VALID_CASE_STATUSES = {'P', 'IP', 'RS', 'RJ'}
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
GENERIC_RESET_MESSAGE = 'If the account exists, a verification code has been sent to the email address.'


def api_success(data=None, message='Request completed successfully', status=200):
    return JsonResponse(
        {
            'status': 'success',
            'message': message,
            'data': data if data is not None else {},
        },
        status=status,
    )


def api_error(message, status=400, data=None):
    return JsonResponse(
        {
            'status': 'error',
            'message': message,
            'data': data if data is not None else {},
        },
        status=status,
    )


def api_validation_error(errors, message='Please correct the highlighted signup fields.', status=400):
    return api_error(
        message,
        status=status,
        data=errors,
    )


def role_required(*allowed_roles):
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return api_error('Authentication required.', status=401)
            if request.user.role not in allowed_roles:
                return api_error('You do not have permission to access this resource.', status=403)
            return view_func(request, *args, **kwargs)

        return wrapped

    return decorator


def super_admin_required(view_func):
    @wraps(view_func)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return api_error('Authentication required.', status=401)
        if not is_super_admin(request.user):
            return api_error('Super administrator access is required.', status=403)
        return view_func(request, *args, **kwargs)

    return wrapped


def _choice_label(choices, value):
    return dict(choices).get(value, value)


def _user_display_name(user):
    full_name = f'{user.first_name} {user.last_name}'.strip()
    return full_name or user.username


def _serialize_user(user):
    student_profile = getattr(user, 'studentprofile', None)
    staff_profile = getattr(user, 'staffprofile', None)

    departments = []
    if staff_profile:
        departments = [department.name for department in staff_profile.departments.order_by('name')]
        department_ids = [department.id for department in staff_profile.departments.order_by('name')]
    else:
        department_ids = []

    return {
        'id': user.id,
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'full_name': _user_display_name(user),
        'email': user.email or '',
        'role': user.role,
        'access_level': access_level_for_user(user),
        'is_super_admin': is_super_admin(user),
        'is_active': user.is_active,
        'department': (
            student_profile.department.name
            if student_profile and student_profile.department
            else (departments[0] if departments else '')
        ),
        'departments': departments,
        'department_ids': department_ids,
        'job_title': getattr(staff_profile, 'job_title', ''),
        'year_of_study': getattr(student_profile, 'year_of_study', None),
    }


def _serialize_case(case, include_logs=False, include_documents=False, include_messages=False):
    payload = {
        'id': case.id,
        'reference_code': case.reference_code,
        'title': case.title,
        'description': case.description,
        'category': case.category,
        'category_label': case.get_category_display(),
        'priority': case.priority,
        'priority_label': case.get_priority_display(),
        'status': case.status,
        'status_label': case.get_status_display(),
        'routing_source': case.routing_source,
        'routing_source_label': case.get_routing_source_display(),
        'routing_notes': case.routing_notes,
        'resolution_notes': case.resolution_notes,
        'created_at': case.created_at.isoformat(),
        'updated_at': case.updated_at.isoformat(),
        'student': {
            'id': case.student_id,
            'name': _user_display_name(case.student),
            'username': case.student.username,
        },
        'staff': (
            {
                'id': case.staff_id,
                'name': _user_display_name(case.staff),
                'username': case.staff.username,
            }
            if case.staff
            else None
        ),
        'department': (
            {
                'id': case.department_id,
                'name': case.department.name,
            }
            if case.department
            else None
        ),
    }

    if include_logs:
        payload['logs'] = [
            {
                'id': log.id,
                'action_type': log.action_type,
                'action_label': log.get_action_type_display(),
                'message': log.message,
                'performed_by': _user_display_name(log.performed_by),
                'created_at': log.created_at.isoformat(),
            }
            for log in case.logs.select_related('performed_by').all()
        ]

    if include_documents:
        payload['documents'] = [
            {
                'id': document.id,
                'file': document.file.url if document.file else '',
                'uploaded_by': _user_display_name(document.uploaded_by),
                'uploaded_at': document.uploaded_at.isoformat(),
            }
            for document in case.documents.select_related('uploaded_by').all()
        ]

    if include_messages:
        payload['messages'] = [
            _serialize_case_message(message)
            for message in case.messages.select_related('sender').all()
        ]

    return payload


def _serialize_case_message(message):
    return {
        'id': message.id,
        'case_id': message.case_id,
        'sender': {
            'id': message.sender_id,
            'name': _user_display_name(message.sender),
            'username': message.sender.username,
            'role': message.sender.role,
        },
        'message': message.message,
        'attachment': message.attachment.url if message.attachment else '',
        'created_at': message.created_at.isoformat(),
    }


def _serialize_notification(notification):
    return {
        'id': notification.id,
        'notification_type': notification.notification_type,
        'notification_label': notification.get_notification_type_display(),
        'message': notification.message,
        'is_read': notification.is_read,
        'created_at': notification.created_at.isoformat(),
        'case_id': notification.case_id,
        'reference_code': notification.case.reference_code if notification.case else '',
    }


def _serialize_student_summary(summary):
    return {
        'id': summary['id'],
        'name': summary['name'],
        'username': summary['username'],
        'email': summary['email'] or '',
        'case_count': summary['case_count'],
        'latest_case_reference': summary['latest_case_reference'],
        'latest_case_status': summary['latest_case_status'],
    }


def _get_request_data(request):
    if request.content_type and 'application/json' in request.content_type:
        try:
            return json.loads(request.body or '{}')
        except json.JSONDecodeError:
            return None
    return request.POST


def _normalize_text(value):
    return re.sub(r'\s+', ' ', (value or '').strip())


def _validate_upload(file):
    if not file:
        return None
    if file.size > MAX_UPLOAD_SIZE:
        return f'File size must not exceed {MAX_UPLOAD_SIZE // (1024 * 1024)}MB.'
    if file.content_type not in ALLOWED_UPLOAD_TYPES:
        return 'Only PDF, JPG, JPEG, and PNG files are allowed.'
    return None


def _route_case(category, department_id=None, staff_id=None):
    selected_department = None
    selected_staff_profile = None
    routing_source = 'AU'
    routing_notes = 'Automatically routed using category rules.'

    if department_id:
        selected_department = Department.objects.filter(id=department_id).first()
        if selected_department:
            routing_source = 'MN'
            routing_notes = 'Department selected manually during submission.'

    if not selected_department:
        department_query = Q()
        for hint in CATEGORY_TO_DEPARTMENT_HINTS.get(category, []):
            department_query |= Q(name__icontains=hint)

        if department_query:
            selected_department = Department.objects.filter(department_query).order_by('name').first()

    if selected_department and staff_id:
        selected_staff_profile = StaffProfile.objects.filter(
            user_id=staff_id,
            departments=selected_department,
        ).select_related('user').first()
        if selected_staff_profile:
            routing_source = 'MN'
            routing_notes = 'Department and staff selected manually during submission.'

    if selected_department and not selected_staff_profile:
        selected_staff_profile = (
            StaffProfile.objects.filter(departments=selected_department)
            .select_related('user')
            .order_by('user__username')
            .first()
        )

    if not selected_department and staff_id:
        selected_staff_profile = (
            StaffProfile.objects.filter(user_id=staff_id)
            .select_related('user')
            .prefetch_related('departments')
            .first()
        )
        if selected_staff_profile:
            selected_department = selected_staff_profile.departments.order_by('name').first()
            routing_source = 'MN'
            routing_notes = 'Staff selected manually during submission.'

    if not selected_department:
        routing_notes = 'No department mapping found for this title. The case is awaiting manual assignment.'

    return selected_department, selected_staff_profile, routing_source, routing_notes


def _infer_category_from_title(title):
    lowered_title = _normalize_text(title).lower()
    if not lowered_title:
        return 'AC'

    category_scores = {choice[0]: 0 for choice in CASE_CATEGORY_CHOICES}
    for hint, category in TITLE_CATEGORY_HINTS.items():
        if hint in lowered_title:
            category_scores[category] += max(3, len(hint.split()))

    tokenized = set(re.findall(r'[a-z0-9]+', lowered_title))
    for category, hints in CATEGORY_TO_DEPARTMENT_HINTS.items():
        for hint in hints:
            hint_tokens = set(re.findall(r'[a-z0-9]+', hint))
            if hint_tokens and hint_tokens.issubset(tokenized):
                category_scores[category] += len(hint_tokens)

    return max(category_scores, key=category_scores.get)


def _dashboard_stats_for(user):
    if user.role == 'student':
        base_cases = Case.objects.filter(student=user)
    elif user.role == 'staff':
        base_cases = Case.objects.filter(staff=user)
    elif is_super_admin(user):
        base_cases = Case.objects.all()
    else:
        base_cases = Case.objects.none()

    return {
        'total': base_cases.count(),
        'pending': base_cases.filter(status='P').count(),
        'in_progress': base_cases.filter(status='IP').count(),
        'resolved': base_cases.filter(status='RS').count(),
        'rejected': base_cases.filter(status='RJ').count(),
        'unread_count': Notification.objects.filter(user=user, is_read=False).count(),
    }


def _case_queryset():
    return Case.objects.select_related('student', 'staff', 'department').prefetch_related('documents', 'logs', 'messages')


def _can_access_case(user, case):
    if is_super_admin(user):
        return True
    if user.role == 'student':
        return case.student_id == user.id
    if user.role == 'staff':
        return case.staff_id == user.id
    return False


def _parse_int(value, default=None):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _extract_department_ids(data):
    if not hasattr(data, 'get'):
        return []

    raw_value = data.get('department_ids', [])
    if isinstance(raw_value, str):
        raw_value = [part.strip() for part in raw_value.split(',') if part.strip()]

    if not isinstance(raw_value, list):
        return []

    cleaned_ids = []
    for item in raw_value:
        parsed = _parse_int(item)
        if parsed:
            cleaned_ids.append(parsed)
    return sorted(set(cleaned_ids))


def _ensure_role_profiles(user):
    if user.role == 'student':
        StudentProfile.objects.get_or_create(user=user)
    if user.role == 'staff':
        StaffProfile.objects.get_or_create(user=user)


def _signup_allowed_domains():
    allowed_domains = getattr(settings, 'SIGNUP_ALLOWED_EMAIL_DOMAINS', [])
    if isinstance(allowed_domains, str):
        allowed_domains = [allowed_domains]
    return [domain.strip().lower() for domain in allowed_domains if domain.strip()]


def _get_role_from_email(email):
    return configured_role_for_email(email)


def _validate_signup_email(email):
    if not email:
        return 'Email is required.'
    if User.objects.filter(email__iexact=email).exists():
        return 'Email already exists.'

    allowed_domains = _signup_allowed_domains()
    domain = email.split('@')[-1].lower() if '@' in email else ''
    assigned_role = _get_role_from_email(email)
    if allowed_domains and domain not in allowed_domains and assigned_role is None:
        return 'Only official Hawassa University emails are allowed.'
    if assigned_role is None:
        return 'Only official Hawassa University emails are allowed.'

    return None


def _validate_password_for_user(password, user):
    try:
        validate_password(password, user)
    except ValidationError as exc:
        return ' '.join(exc.messages)
    return None


def _split_full_name(full_name):
    parts = [part for part in _normalize_text(full_name).split(' ') if part]
    if not parts:
        return '', ''
    if len(parts) == 1:
        return parts[0], ''
    return parts[0], ' '.join(parts[1:])


def _candidate_signup_username(email):
    local_part = normalize_email(email).split('@')[0]
    candidate = re.sub(r'[^a-z0-9._-]+', '', local_part.lower())[:150]
    return candidate or 'user'


def _generate_unique_signup_username(email):
    base_username = _candidate_signup_username(email)
    candidate = base_username
    suffix = 1
    while User.objects.filter(username__iexact=candidate).exists():
        suffix += 1
        suffix_token = str(suffix)
        candidate = f'{base_username[: max(1, 150 - len(suffix_token))]}{suffix_token}'
    return candidate


def _build_signup_payload(data):
    full_name = _normalize_text(data.get('full_name', '')) if hasattr(data, 'get') else ''
    email = normalize_email(data.get('email', '')) if hasattr(data, 'get') else ''
    password1 = data.get('password1', '') if hasattr(data, 'get') else ''
    password2 = data.get('password2', '') if hasattr(data, 'get') else ''

    first_name, last_name = _split_full_name(full_name)
    return {
        'full_name': full_name,
        'first_name': first_name,
        'last_name': last_name,
        'email': email,
        'password1': password1,
        'password2': password2,
    }


def _validate_signup_payload(payload):
    errors = {}
    email_error = _validate_signup_email(payload['email'])
    if email_error:
        errors['email'] = [email_error]

    if not payload['full_name']:
        errors['full_name'] = ['Full name is required.']

    if not payload['password1']:
        errors['password1'] = ['Password is required.']
    if not payload['password2']:
        errors['password2'] = ['Please confirm your password.']
    if payload['password1'] and payload['password2'] and payload['password1'] != payload['password2']:
        errors['password2'] = ['Password confirmation does not match.']

    temp_user = User(
        username=_candidate_signup_username(payload['email']),
        email=payload['email'],
        first_name=payload['first_name'],
        last_name=payload['last_name'],
        role='student',
    )
    if payload['password1']:
        password_error = _validate_password_for_user(payload['password1'], temp_user)
        if password_error:
            errors['password1'] = [password_error]

    return errors


def _create_signup_user(payload):
    email = payload['email']
    role = _get_role_from_email(email) or 'student'
    user = User(
        username=_generate_unique_signup_username(email),
        email=email,
        first_name=payload['first_name'],
        last_name=payload['last_name'],
        role=role,
        is_staff=role == 'admin',
        is_active=True,
    )
    user.set_password(payload['password1'])
    user.save()
    if role == 'staff':
        StaffProfile.objects.create(user=user)
    else:
        StudentProfile.objects.create(user=user)
    return user


def _sanitize_ai_question(text):
    question = re.sub(r'\s+', ' ', (text or '').strip())
    if len(question) > AI_QUESTION_MAX_LENGTH:
        question = question[:AI_QUESTION_MAX_LENGTH].rstrip()
    return question


def _rate_limit_key(request):
    if request.user.is_authenticated:
        return f'ai_rate_user_{request.user.id}'
    return f'ai_rate_ip_{request.META.get("REMOTE_ADDR", "unknown")}'


def _check_rate_limit(request):
    cache_key = _rate_limit_key(request)
    request_count = cache.get(cache_key, 0)
    if request_count >= AI_MAX_REQUESTS_PER_WINDOW:
        return False, cache.ttl(cache_key) if hasattr(cache, 'ttl') else AI_RATE_LIMIT_WINDOW_SECONDS
    cache.set(cache_key, request_count + 1, timeout=AI_RATE_LIMIT_WINDOW_SECONDS)
    return True, None


def _client_identifier(request):
    forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', 'unknown')


def _check_action_rate_limit(request, action, limit=AUTH_MAX_REQUESTS_PER_WINDOW, window=AUTH_RATE_LIMIT_WINDOW_SECONDS):
    cache_key = f'rl_{action}_{_client_identifier(request)}'
    request_count = cache.get(cache_key, 0)
    if request_count >= limit:
        return False, cache.ttl(cache_key) if hasattr(cache, 'ttl') else window
    cache.set(cache_key, request_count + 1, timeout=window)
    return True, None


def _serialize_ai_history_item(history):
    return {
        'id': history.id,
        'question': history.question,
        'answer': history.answer,
        'created_at': history.created_at.isoformat(),
    }


def _serialize_faculty(faculty):
    return {
        'id': faculty.id,
        'name': faculty.name,
    }


def _serialize_department(department):
    return {
        'id': department.id,
        'name': department.name,
        'faculty': {
            'id': department.faculty_id,
            'name': department.faculty.name,
        },
    }


def _paginate_queryset(queryset, request):
    page = _parse_int(request.GET.get('page', 1), 1)
    page_size = _parse_int(request.GET.get('page_size', DEFAULT_PAGE_SIZE), DEFAULT_PAGE_SIZE)
    page_size = max(1, min(page_size, MAX_PAGE_SIZE))

    paginator = Paginator(queryset, page_size)
    page_obj = paginator.get_page(page)
    return page_obj, {
        'page': page_obj.number,
        'page_size': page_size,
        'total_pages': paginator.num_pages,
        'total_items': paginator.count,
        'has_next': page_obj.has_next(),
        'has_previous': page_obj.has_previous(),
    }


@require_GET
@ensure_csrf_cookie
def csrf_token(request):
    return api_success(message='CSRF cookie set successfully.')


@require_POST
@csrf_protect
def signup_request_otp(request):
    allowed, retry_after = _check_action_rate_limit(request, 'signup_otp')
    if not allowed:
        return api_error(
            f'Too many signup attempts. Please wait {retry_after or AUTH_RATE_LIMIT_WINDOW_SECONDS} seconds and try again.',
            status=429,
            data={'retry_after': retry_after or AUTH_RATE_LIMIT_WINDOW_SECONDS},
        )

    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    signup_payload = _build_signup_payload(data)
    validation_errors = _validate_signup_payload(signup_payload)
    if validation_errors:
        return api_validation_error(validation_errors)

    email = signup_payload['email']

    if has_active_cooldown(email, OTPVerification.PURPOSE_SIGNUP):
        return api_error(
            f'Please wait {get_otp_cooldown_seconds()} seconds before requesting another code.',
            status=429,
            data={'retry_after': get_otp_cooldown_seconds()},
        )

    _otp_record, raw_otp = create_otp(
        email,
        OTPVerification.PURPOSE_SIGNUP,
        context={
            'pending_signup': {
                key: value
                for key, value in signup_payload.items()
                if key != 'password2'
            }
        },
    )
    send_otp_email(email, raw_otp, OTPVerification.PURPOSE_SIGNUP)
    return api_success(
        message='A verification code has been sent to your email address.',
        data={'email': email, 'expires_in_seconds': get_otp_expiry_minutes() * 60, 'retry_after': get_otp_cooldown_seconds()},
    )


@require_POST
@csrf_protect
def signup_verify_otp(request):
    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    email = normalize_email(data.get('email', ''))
    otp = _normalize_text(data.get('otp', ''))

    if not otp:
        return api_error('Verification code is required.')

    otp_record, otp_error = verify_otp(email, OTPVerification.PURPOSE_SIGNUP, otp)
    if otp_error:
        return api_error(otp_error, status=400)

    pending_signup = (otp_record.context or {}).get('pending_signup', {})
    if not pending_signup:
        otp_record.delete()
        return api_error('This signup request is no longer valid. Please start again.', status=400)

    validation_errors = _validate_signup_payload({**pending_signup, 'password2': pending_signup.get('password1', '')})
    if validation_errors:
        otp_record.delete()
        return api_validation_error(
            validation_errors,
            message='This signup request is no longer valid. Please start again.',
        )

    user = _create_signup_user(pending_signup)

    if otp_record.user_id != user.id:
        otp_record.user = user
        otp_record.save(update_fields=['user'])
    mark_otp_used(otp_record)

    login(request, user)
    return api_success(
        data={'user': _serialize_user(user)},
        message='Account created successfully.',
        status=201,
    )


@require_POST
@csrf_protect
def reset_request_otp(request):
    allowed, retry_after = _check_action_rate_limit(request, 'reset_otp')
    if not allowed:
        return api_error(
            f'Too many password reset attempts. Please wait {retry_after or AUTH_RATE_LIMIT_WINDOW_SECONDS} seconds and try again.',
            status=429,
            data={'retry_after': retry_after or AUTH_RATE_LIMIT_WINDOW_SECONDS},
        )

    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    email = normalize_email(data.get('email', ''))
    if not email:
        return api_error('Email is required.')

    user = User.objects.filter(email__iexact=email).first()
    if user and has_active_cooldown(email, OTPVerification.PURPOSE_RESET):
        return api_error(
            f'Please wait {get_otp_cooldown_seconds()} seconds before requesting another code.',
            status=429,
            data={'retry_after': get_otp_cooldown_seconds()},
        )

    if user:
        _otp_record, raw_otp = create_otp(email, OTPVerification.PURPOSE_RESET, user=user)
        send_otp_email(email, raw_otp, OTPVerification.PURPOSE_RESET)

    return api_success(
        message=GENERIC_RESET_MESSAGE,
        data={'email': email, 'expires_in_seconds': get_otp_expiry_minutes() * 60, 'retry_after': get_otp_cooldown_seconds()},
    )


@require_POST
@csrf_protect
def reset_verify_otp(request):
    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    email = normalize_email(data.get('email', ''))
    otp = _normalize_text(data.get('otp', ''))
    new_password = data.get('new_password', '')

    if not email or not otp:
        return api_error('Email and verification code are required.')

    otp_record, otp_error = verify_otp(email, OTPVerification.PURPOSE_RESET, otp)
    if otp_error:
        return api_error('The email or verification code is invalid.', status=400)

    user = otp_record.user or User.objects.filter(email__iexact=email).first()
    if not user:
        otp_record.delete()
        return api_error('The email or verification code is invalid.', status=400)

    if not new_password:
        return api_success(message='Verification code confirmed.')

    password_error = _validate_password_for_user(new_password, user)
    if password_error:
        return api_error(password_error)

    user.set_password(new_password)
    user.save(update_fields=['password'])
    mark_otp_used(otp_record)

    return api_success(message='Password reset successfully.')


@require_POST
@csrf_protect
def signup(request):
    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    if data.get('otp'):
        return signup_verify_otp(request)

    return signup_request_otp(request)


@require_POST
@csrf_protect
def login_api(request):
    allowed, retry_after = _check_action_rate_limit(request, 'login')
    if not allowed:
        return api_error(
            f'Too many login attempts. Please wait {retry_after or AUTH_RATE_LIMIT_WINDOW_SECONDS} seconds and try again.',
            status=429,
            data={'retry_after': retry_after or AUTH_RATE_LIMIT_WINDOW_SECONDS},
        )

    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    username = _normalize_text(data.get('username', ''))
    password = data.get('password', '')

    if not username or not password:
        return api_error('Username and password are required.')

    user = authenticate(request, username=username, password=password)
    if user is None and '@' in username:
        matched_user = User.objects.filter(email__iexact=username).first()
        if matched_user:
            user = authenticate(request, username=matched_user.username, password=password)

    if user is None:
        return api_error('Invalid credentials.', status=401)

    user = reconcile_user_role(user)
    _ensure_role_profiles(user)
    login(request, user)
    return api_success(
        data={
            'user': _serialize_user(user),
            'dashboard_stats': _dashboard_stats_for(user),
        },
        message='Login successful.',
    )


@require_POST
@csrf_protect
@login_required
def logout_api(request):
    logout(request)
    return api_success(message='Logged out successfully.')


@require_GET
@login_required
def auth_me(request):
    reconcile_user_role(request.user)
    _ensure_role_profiles(request.user)
    return api_success(
        data={
            'user': _serialize_user(request.user),
            'dashboard_stats': _dashboard_stats_for(request.user),
        },
        message='Authenticated session retrieved successfully.',
    )


@require_POST
@csrf_protect
@login_required
def update_profile(request):
    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    user = request.user
    first_name = _normalize_text(data.get('first_name', ''))
    last_name = _normalize_text(data.get('last_name', ''))
    email = _normalize_text(data.get('email', '')).lower()

    if not email:
        return api_error('Email is required.')

    if User.objects.filter(email__iexact=email).exclude(id=user.id).exists():
        return api_error('That email address is already in use.')
    mapped_role = configured_role_for_email(email)
    if mapped_role and mapped_role != user.role and not is_super_admin(user):
        return api_error('Email changes that alter account privileges must be handled by a super administrator.', status=403)

    user.first_name = first_name
    user.last_name = last_name
    user.email = email
    user.save(update_fields=['first_name', 'last_name', 'email'])

    if user.role == 'student':
        profile, _created = StudentProfile.objects.get_or_create(user=user)
        department_id = _parse_int(data.get('department_id'))
        year_of_study = _parse_int(data.get('year_of_study'))
        updated_fields = []

        if department_id is not None:
            profile.department = Department.objects.filter(id=department_id).first()
            updated_fields.append('department')
        if year_of_study is not None:
            profile.year_of_study = year_of_study
            updated_fields.append('year_of_study')

        if updated_fields:
            profile.save(update_fields=updated_fields)

    return api_success(
        data={'user': _serialize_user(user)},
        message='Profile updated successfully.',
    )


@require_POST
@csrf_protect
@login_required
def change_password(request):
    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')
    confirm_password = data.get('confirm_password', '')

    if not current_password or not new_password or not confirm_password:
        return api_error('All password fields are required.')

    if not request.user.check_password(current_password):
        return api_error('Current password is incorrect.', status=401)

    if new_password != confirm_password:
        return api_error('New passwords do not match.')

    try:
        validate_password(new_password, request.user)
    except ValidationError as exc:
        return api_error(' '.join(exc.messages))

    request.user.set_password(new_password)
    request.user.save(update_fields=['password'])
    update_session_auth_hash(request, request.user)

    return api_success(message='Password updated successfully.')


@require_GET
@role_required('student', 'staff', 'admin')
def dashboard(request):
    if is_super_admin(request.user):
        return admin_dashboard(request)
    if is_normal_admin(request.user):
        return api_success(
            data={
                'stats': {
                    'total': 0,
                    'pending': 0,
                    'in_progress': 0,
                    'resolved': 0,
                    'rejected': 0,
                    'unread_count': Notification.objects.filter(user=request.user, is_read=False).count(),
                }
            },
            message='Limited administrator dashboard retrieved successfully.',
        )
    return api_success(
        data={'stats': _dashboard_stats_for(request.user)},
        message='Dashboard statistics retrieved successfully.',
    )


@require_GET
@role_required('student', 'staff')
def get_departments(request):
    departments = Department.objects.select_related('faculty').order_by('name')
    data = [
        {
            'id': department.id,
            'name': department.name,
            'faculty': department.faculty.name,
        }
        for department in departments
    ]
    return api_success(data={'departments': data}, message='Departments retrieved successfully.')


@require_GET
@role_required('student', 'staff')
def get_staff_by_department(request, department_id):
    staff_profiles = (
        StaffProfile.objects.filter(departments__id=department_id)
        .select_related('user')
        .order_by('user__username')
    )
    data = [
        {
            'id': profile.user.id,
            'name': _user_display_name(profile.user),
            'username': profile.user.username,
            'job_title': profile.job_title,
        }
        for profile in staff_profiles
    ]
    return api_success(data={'staff_members': data}, message='Staff members retrieved successfully.')


@require_POST
@csrf_protect
@role_required('student')
def create_case(request):
    data = request.POST if request.content_type and 'multipart/form-data' in request.content_type else _get_request_data(request)
    if data is None:
        return api_error('Invalid request payload.')

    title = _normalize_text(data.get('title', ''))
    description = _normalize_text(data.get('description', ''))
    department_id = data.get('department_id') or data.get('department')
    staff_id = data.get('staff_id') or data.get('staff')
    priority = data.get('priority') or 'N'
    file = request.FILES.get('file')

    if not title:
        return api_error('A case title is required.')
    if not description:
        return api_error('A case description is required.')

    valid_priorities = {choice[0] for choice in CASE_PRIORITY_CHOICES}
    if priority not in valid_priorities:
        priority = 'N'

    upload_error = _validate_upload(file)
    if upload_error:
        return api_error(upload_error)

    category = _infer_category_from_title(title)
    department, staff_profile, routing_source, routing_notes = _route_case(
        category=category,
        department_id=department_id,
        staff_id=staff_id,
    )

    case = Case.objects.create(
        category=category,
        title=title,
        student=request.user,
        staff=staff_profile.user if staff_profile else None,
        department=department,
        description=description,
        priority=priority,
        routing_source=routing_source,
        routing_notes=routing_notes,
    )

    if file:
        CaseDocument.objects.create(case=case, uploaded_by=request.user, file=file)
        CaseLog.objects.create(
            case=case,
            performed_by=request.user,
            action_type='DU',
            message='Document uploaded during case creation.',
        )

    CaseLog.objects.create(
        case=case,
        performed_by=request.user,
        action_type='CR',
        message=f'Case submitted by student and categorized as {_choice_label(CASE_CATEGORY_CHOICES, category)}.',
    )

    if case.staff:
        Notification.objects.create(
            user=case.staff,
            case=case,
            notification_type='NC',
            message=f'New case {case.reference_code} was assigned to you.',
        )

    case = _case_queryset().get(id=case.id)
    return api_success(
        data={'case': _serialize_case(case)},
        message='Case created successfully.',
        status=201,
    )


@require_GET
@role_required('student')
def my_cases(request):
    cases = (
        Case.objects.filter(student=request.user)
        .select_related('student', 'staff', 'department')
        .order_by('-created_at')
    )
    return api_success(
        data={'cases': [_serialize_case(case) for case in cases]},
        message='Cases retrieved successfully.',
    )


@require_GET
@role_required('staff')
def assigned_cases(request):
    status_filter = request.GET.get('status')
    category_filter = request.GET.get('category')

    cases = (
        Case.objects.filter(staff=request.user)
        .select_related('student', 'staff', 'department')
        .order_by('-created_at')
    )

    if status_filter:
        cases = cases.filter(status=status_filter)
    if category_filter:
        cases = cases.filter(category=category_filter)

    return api_success(
        data={'cases': [_serialize_case(case) for case in cases]},
        message='Assigned cases retrieved successfully.',
    )


@require_GET
@role_required('student', 'staff', 'admin')
def case_detail(request, case_id):
    case = get_object_or_404(_case_queryset(), id=case_id)
    if not _can_access_case(request.user, case):
        return api_error('You do not have permission to view this case.', status=403)

    return api_success(
        data={'case': _serialize_case(case, include_logs=True, include_documents=True, include_messages=True)},
        message='Case details retrieved successfully.',
    )


@csrf_protect
@login_required
def case_messages(request, case_id):
    case = get_object_or_404(_case_queryset(), id=case_id)

    if request.method == 'GET':
        if request.user.role not in {'student', 'staff', 'admin'}:
            return api_error('You do not have permission to access this resource.', status=403)
        if not _can_access_case(request.user, case):
            return api_error('You do not have permission to view messages for this case.', status=403)

        messages = [
            _serialize_case_message(message)
            for message in case.messages.select_related('sender').all()
        ]
        return api_success(
            data={'messages': messages},
            message='Case messages retrieved successfully.',
        )

    if request.method == 'POST':
        if request.user.role not in {'student', 'staff'}:
            return api_error('You do not have permission to access this resource.', status=403)

        data = request.POST if request.content_type and 'multipart/form-data' in request.content_type else _get_request_data(request)
        if data is None:
            return api_error('Invalid request payload.')

        if not _can_access_case(request.user, case):
            return api_error('You do not have permission to send messages for this case.', status=403)

        message_text = _normalize_text(data.get('message', ''))
        attachment = request.FILES.get('file')

        if not message_text and not attachment:
            return api_error('A message or attachment is required.')

        upload_error = _validate_upload(attachment)
        if upload_error:
            return api_error(upload_error)

        case_message = CaseMessage.objects.create(
            case=case,
            sender=request.user,
            message=message_text,
            attachment=attachment,
        )

        sender_label = 'Student' if request.user.id == case.student_id else 'Staff'
        CaseLog.objects.create(
            case=case,
            performed_by=request.user,
            action_type='MS',
            message=f'{sender_label} sent a case message.',
        )

        recipient = case.staff if request.user.id == case.student_id else case.student
        if recipient and recipient.id != request.user.id:
            Notification.objects.create(
                user=recipient,
                case=case,
                notification_type='CM',
                message=f'New message on {case.reference_code} from {_user_display_name(request.user)}.',
            )

        return api_success(
            data={'message_item': _serialize_case_message(CaseMessage.objects.select_related('sender').get(id=case_message.id))},
            message='Case message sent successfully.',
            status=201,
        )

    return api_error('Method not allowed.', status=405)


@require_POST
@csrf_protect
@role_required('staff')
def update_case(request, case_id):
    case = get_object_or_404(Case.objects.select_related('student', 'staff', 'department'), id=case_id, staff=request.user)
    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    status = _normalize_text(data.get('status', ''))
    message = _normalize_text(data.get('message', ''))
    resolution_notes = _normalize_text(data.get('resolution_notes', ''))
    priority = _normalize_text(data.get('priority', ''))

    valid_statuses = VALID_CASE_STATUSES
    valid_priorities = {choice[0] for choice in CASE_PRIORITY_CHOICES}

    if status and status not in valid_statuses:
        return api_error('Invalid case status.')
    if priority and priority not in valid_priorities:
        return api_error('Invalid case priority.')

    action_type = 'UP'
    if status and status != case.status:
        case.status = status
        action_type = 'ST'
    if priority:
        case.priority = priority
    if resolution_notes or resolution_notes == '':
        case.resolution_notes = resolution_notes

    case.save()

    CaseLog.objects.create(
        case=case,
        performed_by=request.user,
        action_type=action_type,
        message=message or 'Case updated by staff.',
    )

    Notification.objects.create(
        user=case.student,
        case=case,
        notification_type='UP',
        message=message or f'Your case {case.reference_code} has been updated.',
    )

    case = _case_queryset().get(id=case.id)
    return api_success(
        data={'case': _serialize_case(case, include_logs=True, include_documents=True, include_messages=True)},
        message='Case updated successfully.',
    )


@require_POST
@csrf_protect
@role_required('student', 'staff')
def upload_document(request, case_id):
    case = get_object_or_404(_case_queryset(), id=case_id)
    if not _can_access_case(request.user, case):
        return api_error('You do not have permission to upload documents for this case.', status=403)

    file = request.FILES.get('file')
    if not file:
        return api_error('A file is required.')

    upload_error = _validate_upload(file)
    if upload_error:
        return api_error(upload_error)

    CaseDocument.objects.create(case=case, uploaded_by=request.user, file=file)

    actor_label = 'Student' if request.user == case.student else 'Staff'
    CaseLog.objects.create(
        case=case,
        performed_by=request.user,
        action_type='DU',
        message=f'{actor_label} uploaded a document.',
    )

    recipient = case.staff if request.user == case.student else case.student
    if recipient:
        Notification.objects.create(
            user=recipient,
            case=case,
            notification_type='DU',
            message=f'{actor_label} uploaded a new document for {case.reference_code}.',
        )

    case = _case_queryset().get(id=case.id)
    return api_success(
        data={'case': _serialize_case(case, include_logs=True, include_documents=True, include_messages=True)},
        message='Document uploaded successfully.',
    )


@require_GET
@role_required('staff')
def staff_students(request):
    assigned_cases = (
        Case.objects.filter(staff=request.user)
        .select_related('student')
        .order_by('-created_at')
    )

    students = {}
    for case in assigned_cases:
        entry = students.setdefault(
            case.student_id,
            {
                'id': case.student.id,
                'name': _user_display_name(case.student),
                'username': case.student.username,
                'email': case.student.email,
                'case_count': 0,
                'latest_case_reference': case.reference_code,
                'latest_case_status': case.get_status_display(),
            },
        )
        entry['case_count'] += 1

    return api_success(
        data={'students': [_serialize_student_summary(summary) for summary in sorted(students.values(), key=lambda item: item['name'].lower())]},
        message='Assigned students retrieved successfully.',
    )


@require_GET
@role_required('student', 'staff', 'admin')
def notifications(request):
    user_notifications = (
        Notification.objects.filter(user=request.user)
        .select_related('case')
        .order_by('-created_at')
    )
    serialized = [_serialize_notification(notification) for notification in user_notifications]
    unread_count = sum(1 for notification in serialized if not notification['is_read'])
    return api_success(
        data={
            'notifications': serialized,
            'unread_count': unread_count,
        },
        message='Notifications retrieved successfully.',
    )


@require_POST
@csrf_protect
@role_required('student', 'staff', 'admin')
def mark_notification_read(request, notif_id):
    notif = get_object_or_404(Notification, id=notif_id, user=request.user)
    notif.is_read = True
    notif.save(update_fields=['is_read'])
    return api_success(message='Notification marked as read.')


@require_GET
@super_admin_required
def admin_dashboard(request):
    stats = {
        'students': User.objects.filter(role='student').count(),
        'staff': User.objects.filter(role='staff').count(),
        'admins': User.objects.filter(role='admin').count(),
        'cases': {
            'total': Case.objects.count(),
            'pending': Case.objects.filter(status='P').count(),
            'in_progress': Case.objects.filter(status='IP').count(),
            'resolved': Case.objects.filter(status='RS').count(),
            'rejected': Case.objects.filter(status='RJ').count(),
        },
        'notifications_sent': Notification.objects.count(),
        'recent_cases': [
            _serialize_case(case)
            for case in Case.objects.select_related('student', 'staff', 'department').order_by('-created_at')[:5]
        ],
        'recent_activity': [
            {
                'id': log.id,
                'action_label': log.get_action_type_display(),
                'message': log.message,
                'performed_by': _user_display_name(log.performed_by),
                'created_at': log.created_at.isoformat(),
            }
            for log in CaseLog.objects.select_related('performed_by').order_by('-created_at')[:6]
        ],
        'department_load': [
            {
                'name': item['department__name'] or 'Unassigned',
                'case_count': item['case_count'],
            }
            for item in (
                Case.objects.values('department__name')
                .annotate(case_count=Count('id'))
                .order_by('-case_count', 'department__name')
            )
        ],
    }
    return api_success(data={'stats': stats}, message='Admin dashboard retrieved successfully.')


@require_GET
@super_admin_required
def admin_users(request):
    query = _normalize_text(request.GET.get('q', '')).lower()
    role_filter = _normalize_text(request.GET.get('role', '')).lower()

    users = (
        User.objects.all()
        .select_related('studentprofile', 'staffprofile')
        .prefetch_related('staffprofile__departments')
        .order_by('id')
    )

    if role_filter and role_filter in VALID_ROLES:
        users = users.filter(role=role_filter)

    if query:
        users = users.filter(
            Q(username__icontains=query)
            | Q(first_name__icontains=query)
            | Q(last_name__icontains=query)
            | Q(email__icontains=query)
        )

    page_obj, pagination = _paginate_queryset(users, request)
    return api_success(
        data={
            'users': [_serialize_user(user) for user in page_obj.object_list],
            'pagination': pagination,
        },
        message='Users retrieved successfully.',
    )


@require_POST
@csrf_protect
@super_admin_required
def admin_create_user(request):
    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    username = _normalize_text(data.get('username', ''))
    email = _normalize_text(data.get('email', '')).lower()
    first_name = _normalize_text(data.get('first_name', ''))
    last_name = _normalize_text(data.get('last_name', ''))
    role = _normalize_text(data.get('role', 'student')).lower() or 'student'
    password = data.get('password', '')

    if not username:
        return api_error('Username is required.')
    if not email:
        return api_error('Email is required.')
    if not password:
        return api_error('Password is required.')
    if role not in VALID_ROLES:
        return api_error('Invalid role selected.')
    if User.objects.filter(username__iexact=username).exists():
        return api_error('That username is already in use.')
    if User.objects.filter(email__iexact=email).exists():
        return api_error('That email address is already in use.')

    user = User(
        username=username,
        email=email,
        first_name=first_name,
        last_name=last_name,
        role=role,
        is_active=True,
    )
    try:
        validate_password(password, user)
    except ValidationError as exc:
        return api_error(' '.join(exc.messages))
    user.set_password(password)
    user.save()
    _ensure_role_profiles(user)

    return api_success(
        data={'user': _serialize_user(user)},
        message='User created successfully.',
        status=201,
    )


@require_http_methods(['PATCH', 'DELETE'])
@csrf_protect
@super_admin_required
def admin_user_detail(request, user_id):
    user = get_object_or_404(
        User.objects.select_related('studentprofile', 'staffprofile').prefetch_related('staffprofile__departments'),
        id=user_id,
    )

    if request.method == 'DELETE':
        if user.id == request.user.id:
            return api_error('You cannot delete your own account.')
        if user.is_superuser:
            return api_error('Super administrator accounts cannot be deleted from this portal.')
        if user.role == 'admin' and not User.objects.filter(role='admin').exclude(id=user.id).exists():
            return api_error('At least one admin account must remain active.')
        user.delete()
        return api_success(message='User deleted successfully.')

    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    new_email = _normalize_text(data.get('email', user.email or '')).lower()
    new_first_name = _normalize_text(data.get('first_name', user.first_name))
    new_last_name = _normalize_text(data.get('last_name', user.last_name))
    new_role = _normalize_text(data.get('role', user.role)).lower() or user.role
    new_password = data.get('password', '')
    is_active = data.get('is_active')

    if not new_email:
        return api_error('Email is required.')
    if User.objects.filter(email__iexact=new_email).exclude(id=user.id).exists():
        return api_error('That email address is already in use.')
    if new_role not in VALID_ROLES:
        return api_error('Invalid role selected.')
    if user.is_superuser and new_role != 'admin':
        return api_error('Super administrator accounts must keep the admin role.')
    if user.role == 'admin' and new_role != 'admin' and not User.objects.filter(role='admin').exclude(id=user.id).exists():
        return api_error('At least one admin account must remain active.')

    user.email = new_email
    user.first_name = new_first_name
    user.last_name = new_last_name
    user.role = new_role
    user.is_staff = new_role == 'admin' or user.is_superuser
    if isinstance(is_active, bool):
        user.is_active = is_active

    if new_password:
        try:
            validate_password(new_password, user)
        except ValidationError as exc:
            return api_error(' '.join(exc.messages))
        user.set_password(new_password)

    user.save()
    _ensure_role_profiles(user)
    user = User.objects.select_related('studentprofile', 'staffprofile').prefetch_related('staffprofile__departments').get(id=user.id)

    return api_success(
        data={'user': _serialize_user(user)},
        message='User updated successfully.',
    )


@require_POST
@csrf_protect
@login_required
def ask_ai_view(request):
    """AI-powered academic advisor endpoint that answers only from the Hawassa University knowledge base."""
    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    question = _sanitize_ai_question(data.get('question', ''))
    if not question:
        return api_success(
            data={'answer': 'Please type an academic question, and I will help with course planning, performance, cases, or career guidance.'},
            message='Empty question handled successfully.',
        )

    allowed, retry_after = _check_rate_limit(request)
    if not allowed:
        return api_error(
            f'Rate limit exceeded. Please wait {retry_after or AI_RATE_LIMIT_WINDOW_SECONDS} seconds and try again.',
            status=429,
            data={'retry_after': retry_after or AI_RATE_LIMIT_WINDOW_SECONDS},
        )

    try:
        answer = ask_academic_advisor(question, user=request.user)
        AIChatHistory.objects.create(student=request.user, question=question, answer=answer)
        return api_success(
            data={'answer': answer},
            message='Response generated successfully.',
        )
    except Exception as e:
        logger.exception('AI service failure')
        return api_error('AI service error: unable to process your request at this time.', status=500)


@require_GET
@ensure_csrf_cookie
@login_required
def ai_chat_history(request):
    history_items = AIChatHistory.objects.filter(student=request.user).order_by('-created_at')[:AI_CHAT_HISTORY_LIMIT]
    return api_success(
        data={
            'history': [_serialize_ai_history_item(item) for item in history_items]
        },
        message='AI chat history retrieved successfully.',
    )


@require_GET
@ensure_csrf_cookie
@login_required
def chat_page(request):
    return render(request, 'system_mdl/chat.html', {'user': request.user})


@require_GET
def home(request):
    if request.user.is_authenticated:
        return redirect('chat_page')
    return redirect('login_page')


@require_GET
@ensure_csrf_cookie
def login_page(request):
    return render(request, 'system_mdl/login.html')


@require_POST
@csrf_protect
def logout_page(request):
    logout(request)
    return redirect('login_page')


@require_POST
@csrf_protect
@super_admin_required
def admin_staff_profile(request):
    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    user_id = _parse_int(data.get('user_id'))
    if not user_id:
        return api_error('A valid staff user is required.')

    user = get_object_or_404(User, id=user_id)
    if user.role != 'staff':
        return api_error('The selected user is not a staff account.')

    department_ids = _extract_department_ids(data)
    departments = Department.objects.filter(id__in=department_ids).order_by('name')
    if department_ids and departments.count() != len(department_ids):
        return api_error('One or more selected departments are invalid.')

    job_title = _normalize_text(data.get('job_title', ''))
    staff_profile, _ = StaffProfile.objects.get_or_create(user=user)
    staff_profile.job_title = job_title
    staff_profile.save(update_fields=['job_title'])
    staff_profile.departments.set(departments)

    staff_profile = StaffProfile.objects.select_related('user').prefetch_related('departments').get(id=staff_profile.id)
    return api_success(
        data={
            'staff_profile': {
                'user_id': staff_profile.user_id,
                'job_title': staff_profile.job_title,
                'department_ids': [department.id for department in staff_profile.departments.order_by('name')],
                'departments': [department.name for department in staff_profile.departments.order_by('name')],
            }
        },
        message='Staff profile saved successfully.',
    )


@require_http_methods(['GET', 'POST'])
@csrf_protect
@super_admin_required
def admin_departments(request):
    if request.method == 'GET':
        departments = Department.objects.select_related('faculty').order_by('name')
        return api_success(
            data={'departments': [_serialize_department(department) for department in departments]},
            message='Departments retrieved successfully.',
        )

    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    name = _normalize_text(data.get('name', ''))
    faculty_id = _parse_int(data.get('faculty_id'))
    if not name:
        return api_error('Department name is required.')
    if not faculty_id:
        return api_error('A valid faculty is required.')

    faculty = get_object_or_404(Faculty, id=faculty_id)
    if Department.objects.filter(name__iexact=name, faculty=faculty).exists():
        return api_error('This department already exists in the selected faculty.')

    department = Department.objects.create(name=name, faculty=faculty)
    return api_success(
        data={'department': _serialize_department(department)},
        message='Department created successfully.',
        status=201,
    )


@require_POST
@csrf_protect
@super_admin_required
def admin_create_department(request):
    return admin_departments(request)


@require_http_methods(['PATCH', 'DELETE'])
@csrf_protect
@super_admin_required
def admin_department_detail(request, department_id):
    department = get_object_or_404(Department.objects.select_related('faculty'), id=department_id)

    if request.method == 'DELETE':
        department.delete()
        return api_success(message='Department deleted successfully.')

    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    name = _normalize_text(data.get('name', department.name)) or department.name
    faculty_id = _parse_int(data.get('faculty_id'), department.faculty_id)
    faculty = get_object_or_404(Faculty, id=faculty_id)

    if Department.objects.filter(name__iexact=name, faculty=faculty).exclude(id=department.id).exists():
        return api_error('This department already exists in the selected faculty.')

    department.name = name
    department.faculty = faculty
    department.save(update_fields=['name', 'faculty'])

    return api_success(
        data={'department': _serialize_department(department)},
        message='Department updated successfully.',
    )


@require_http_methods(['GET', 'POST'])
@csrf_protect
@super_admin_required
def admin_faculties(request):
    if request.method == 'GET':
        faculties = Faculty.objects.annotate(department_count=Count('department')).order_by('name')
        return api_success(
            data={
                'faculties': [
                    {
                        **_serialize_faculty(faculty),
                        'department_count': faculty.department_count,
                    }
                    for faculty in faculties
                ]
            },
            message='Faculties retrieved successfully.',
        )

    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    name = _normalize_text(data.get('name', ''))
    if not name:
        return api_error('Faculty name is required.')
    if Faculty.objects.filter(name__iexact=name).exists():
        return api_error('A faculty with this name already exists.')

    faculty = Faculty.objects.create(name=name)
    return api_success(
        data={'faculty': _serialize_faculty(faculty)},
        message='Faculty created successfully.',
        status=201,
    )


@require_POST
@csrf_protect
@super_admin_required
def admin_create_faculty(request):
    return admin_faculties(request)


@require_GET
@super_admin_required
def admin_cases(request):
    status_filter = _normalize_text(request.GET.get('status', ''))
    department_filter = _parse_int(request.GET.get('department'))

    cases = Case.objects.select_related('student', 'staff', 'department').order_by('-created_at')
    if status_filter in VALID_CASE_STATUSES:
        cases = cases.filter(status=status_filter)
    if department_filter:
        cases = cases.filter(department_id=department_filter)

    page_obj, pagination = _paginate_queryset(cases, request)
    return api_success(
        data={
            'cases': [_serialize_case(case) for case in page_obj.object_list],
            'pagination': pagination,
        },
        message='Cases retrieved successfully.',
    )


@require_POST
@csrf_protect
@super_admin_required
def admin_reassign_case(request, case_id):
    case = get_object_or_404(Case.objects.select_related('student', 'staff', 'department'), id=case_id)
    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    staff_id = _parse_int(data.get('staff_id'))
    message = _normalize_text(data.get('message', '')) or 'Case reassigned by admin.'

    if not staff_id:
        return api_error('A valid staff user is required.')

    staff_user = get_object_or_404(User, id=staff_id, role='staff')
    staff_profile = StaffProfile.objects.filter(user=staff_user).prefetch_related('departments').first()
    if not staff_profile:
        return api_error('Selected staff user does not have a staff profile.')

    if case.department and not staff_profile.departments.filter(id=case.department_id).exists():
        return api_error('Selected staff is not assigned to this case department.')

    case.staff = staff_user
    case.routing_source = 'MN'
    case.routing_notes = f'Manually reassigned by admin {request.user.username}.'
    case.save(update_fields=['staff', 'routing_source', 'routing_notes', 'updated_at'])

    CaseLog.objects.create(
        case=case,
        performed_by=request.user,
        action_type='UP',
        message=message,
    )
    Notification.objects.create(
        user=staff_user,
        case=case,
        notification_type='NC',
        message=f'Case {case.reference_code} has been assigned to you by admin.',
    )

    case = _case_queryset().get(id=case.id)
    return api_success(
        data={'case': _serialize_case(case)},
        message='Case reassigned successfully.',
    )


@require_POST
@csrf_protect
@super_admin_required
def admin_force_case_status(request, case_id):
    case = get_object_or_404(Case.objects.select_related('student', 'staff', 'department'), id=case_id)
    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    status = _normalize_text(data.get('status', ''))
    message = _normalize_text(data.get('message', '')) or 'Case status was force-updated by admin.'

    if status not in VALID_CASE_STATUSES:
        return api_error('Invalid case status.')

    case.status = status
    case.save(update_fields=['status', 'updated_at'])

    CaseLog.objects.create(
        case=case,
        performed_by=request.user,
        action_type='ST',
        message=message,
    )
    Notification.objects.create(
        user=case.student,
        case=case,
        notification_type='UP',
        message=f'Your case {case.reference_code} status is now {case.get_status_display()}.',
    )

    case = _case_queryset().get(id=case.id)
    return api_success(
        data={'case': _serialize_case(case)},
        message='Case status updated successfully.',
    )


@require_POST
@csrf_protect
@super_admin_required
def send_global_notification(request):
    data = _get_request_data(request)
    if data is None:
        return api_error('Invalid JSON payload.')

    message = _normalize_text(data.get('message', ''))
    if not message:
        return api_error('A notification message is required.')

    send_to_students = data.get('send_to_students')
    if send_to_students is True:
        target_role = 'student'
    else:
        target_role = _normalize_text(data.get('target_role', 'student')) or 'student'

    if target_role not in VALID_ROLES:
        return api_error('Invalid notification target role.')

    recipients = User.objects.filter(role=target_role)
    notifications_to_create = [
        Notification(
            user=recipient,
            message=message,
            notification_type='UP',
        )
        for recipient in recipients
    ]
    Notification.objects.bulk_create(notifications_to_create)

    return api_success(
        data={'recipient_count': len(notifications_to_create)},
        message=f'Notification sent to all {target_role}s successfully.',
    )
