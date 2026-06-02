import logging
from urllib import request as urlrequest
from urllib.error import URLError

from django.conf import settings
from django.db.models import Count

from .models import Case, StudentProfile

logger = logging.getLogger(__name__)


def _student_context(user):
    profile = StudentProfile.objects.filter(user=user).select_related('department').first()
    cases = (
        Case.objects.filter(student=user)
        .select_related('department', 'staff')
        .order_by('-created_at')[:5]
    )
    stats = Case.objects.filter(student=user).values('status').annotate(total=Count('id'))

    return {
        'name': user.get_full_name() or user.username,
        'email': user.email or '',
        'department': profile.department.name if profile and profile.department else 'Not recorded',
        'year_of_study': profile.year_of_study if profile else None,
        'case_stats': {item['status']: item['total'] for item in stats},
        'recent_cases': [
            {
                'reference': case.reference_code,
                'title': case.title,
                'status': case.get_status_display(),
                'category': case.get_category_display(),
                'department': case.department.name if case.department else 'Unassigned',
            }
            for case in cases
        ],
    }


def _build_prompt(question, user):
    context = _student_context(user)
    recent_cases = '\n'.join(
        f"- {case['reference']}: {case['title']} ({case['category']}, {case['status']}, {case['department']})"
        for case in context['recent_cases']
    ) or '- No recent cases.'

    return f"""
You are an academic advisory assistant for a university case-management portal.
Give practical, student-safe guidance. Do not invent official policy numbers.
When the student needs an official decision, advise them to contact the relevant department or submit a case.

Student context:
- Name: {context['name']}
- Email: {context['email']}
- Department: {context['department']}
- Year of study: {context['year_of_study'] or 'Not recorded'}
- Case counts by status: {context['case_stats'] or 'No cases'}
- Recent cases:
{recent_cases}

Student question:
{question}

Return a concise answer with:
1. Direct guidance
2. Recommended next steps
3. Any case-management action if relevant
""".strip()


def _local_advice(question, user):
    context = _student_context(user)
    lowered = question.lower()
    focus = 'general academic planning'
    direct_guidance = 'Break the issue into academic, administrative, and personal constraints, then address the highest-risk item first.'
    next_steps = [
        'Confirm the relevant department or advisor for this issue.',
        'Gather transcripts, course outlines, exam notices, or other supporting evidence.',
        'Set a short follow-up timeline and track the outcome in the portal.',
    ]

    if any(word in lowered for word in ['course', 'unit', 'recommend', 'register', 'registration']):
        focus = 'course recommendation'
        direct_guidance = 'Choose courses by prerequisite readiness, graduation value, and workload balance instead of taking the heaviest set available.'
        next_steps = [
            'List required courses that unlock later-year modules first.',
            'Add one performance-strengthening elective or support course if your workload allows it.',
            'Confirm registration rules with your department before the deadline.',
        ]
    if any(word in lowered for word in ['grade', 'gpa', 'performance', 'fail', 'failed', 'exam']):
        focus = 'academic performance'
        direct_guidance = 'Prioritize the modules with the largest grade impact, meet the course instructor early, and use a weekly revision plan with measurable targets.'
        next_steps = [
            'Identify the two weakest courses and schedule fixed revision blocks for them.',
            'Request feedback on past assessments so you know what to correct.',
            'Track weekly quiz, assignment, or practice-test performance to confirm improvement.',
        ]
    if any(word in lowered for word in ['career', 'job', 'internship', 'cv']):
        focus = 'career guidance'
        direct_guidance = 'Map your strongest courses to career paths, prepare a small project portfolio, and use department channels for internship opportunities.'
        next_steps = [
            'Choose one career direction and identify the skills it repeatedly requires.',
            'Build or document two academic projects that prove those skills.',
            'Ask your advisor or department office about internships, attachments, or career events.',
        ]
    if any(word in lowered for word in ['case', 'complaint', 'appeal', 'makeup', 'document']):
        focus = 'case-management guidance'
        direct_guidance = 'Use the case module and attach clear supporting documents so staff can route the request correctly and respond without avoidable delays.'
        next_steps = [
            'Write a concise title that names the issue and affected course or office.',
            'Attach evidence such as medical notes, exam notices, transcripts, or approval letters.',
            'Monitor case status and reply promptly when staff request clarification.',
        ]

    recent_case_line = ''
    if context['recent_cases']:
        case = context['recent_cases'][0]
        recent_case_line = f"\n\nCase-management note: your latest case is {case['reference']} ({case['status']}). Mention it when following up."

    department_line = ''
    if context['department'] != 'Not recorded':
        department_line = f"\n\nContext used: department - {context['department']}; year - {context['year_of_study'] or 'not recorded'}."

    return (
        f"Focus: {focus.title()}\n\n"
        f"Direct guidance: {direct_guidance}\n\n"
        f"Recommended next steps:\n"
        f"- {next_steps[0]}\n"
        f"- {next_steps[1]}\n"
        f"- {next_steps[2]}\n\n"
        f"Academic plan: use consistent weekly study blocks, early instructor feedback, and realistic workload choices."
        f"{recent_case_line}"
        f"{department_line}"
    )


def _call_external_ai(prompt):
    api_key = getattr(settings, 'OPENAI_API_KEY', '')
    if not api_key:
        return ''

    try:
        import json

        payload = json.dumps(
            {
                'model': getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini'),
                'messages': [
                    {'role': 'system', 'content': 'You are a careful academic advisory assistant.'},
                    {'role': 'user', 'content': prompt},
                ],
                'temperature': 0.3,
                'max_tokens': 700,
            }
        ).encode('utf-8')
        req = urlrequest.Request(
            'https://api.openai.com/v1/chat/completions',
            data=payload,
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            method='POST',
        )
        with urlrequest.urlopen(req, timeout=20) as response:
            body = json.loads(response.read().decode('utf-8'))
        return body['choices'][0]['message']['content'].strip()
    except (KeyError, ValueError, URLError, TimeoutError, OSError) as exc:
        logger.warning('External AI provider failed; using local advisory fallback: %s', exc)
        return ''


def ask_academic_advisor(question, user):
    clean_question = ' '.join((question or '').split())
    if not clean_question:
        return 'Please enter a question so I can give useful academic guidance.'

    prompt = _build_prompt(clean_question, user)
    return _call_external_ai(prompt) or _local_advice(clean_question, user)
