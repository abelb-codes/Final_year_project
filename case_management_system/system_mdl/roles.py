from django.conf import settings


VALID_ROLES = {'student', 'staff', 'admin'}


def _as_list(value):
    if not value:
        return []
    if isinstance(value, str):
        return [item.strip().lower() for item in value.split(',') if item.strip()]
    return [str(item).strip().lower() for item in value if str(item).strip()]


def normalize_email_address(email):
    return (email or '').strip().lower()


def email_domain(email):
    normalized = normalize_email_address(email)
    if '@' not in normalized:
        return ''
    return normalized.rsplit('@', 1)[1]


def configured_role_for_email(email):
    normalized = normalize_email_address(email)
    domain = email_domain(normalized)
    if not normalized or not domain:
        return None

    super_admin_emails = set(_as_list(getattr(settings, 'SUPER_ADMIN_EMAILS', [])))
    admin_emails = set(_as_list(getattr(settings, 'ADMIN_EMAILS', [])))
    admin_domains = set(_as_list(getattr(settings, 'ADMIN_EMAIL_DOMAINS', [])))
    staff_emails = set(_as_list(getattr(settings, 'STAFF_EMAILS', [])))
    staff_domains = set(_as_list(getattr(settings, 'STAFF_EMAIL_DOMAINS', [])))
    student_domains = set(_as_list(getattr(settings, 'STUDENT_EMAIL_DOMAINS', [])))

    if normalized in super_admin_emails or normalized in admin_emails or domain in admin_domains:
        return 'admin'
    if normalized in staff_emails or domain in staff_domains:
        return 'staff'
    if not student_domains or domain in student_domains:
        return 'student'
    return None


def is_super_admin(user):
    return bool(getattr(user, 'is_authenticated', False) and user.role == 'admin' and user.is_superuser)


def is_normal_admin(user):
    return bool(getattr(user, 'is_authenticated', False) and user.role == 'admin' and not user.is_superuser)


def access_level_for_user(user):
    if is_super_admin(user):
        return 'super_admin'
    if is_normal_admin(user):
        return 'admin'
    return getattr(user, 'role', 'student')


def reconcile_user_role(user):
    if not user or not getattr(user, 'is_authenticated', True):
        return user

    desired_role = configured_role_for_email(user.email)
    update_fields = []

    if user.is_superuser and user.role != 'admin':
        user.role = 'admin'
        update_fields.append('role')
    elif desired_role and desired_role in VALID_ROLES and user.role != desired_role:
        user.role = desired_role
        update_fields.append('role')

    if update_fields:
        user.save(update_fields=update_fields)
    return user
