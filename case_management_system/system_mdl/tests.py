from datetime import timedelta
from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.test import Client, TestCase
from django.test.utils import override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone

from .models import (
    AIChatHistory,
    Case,
    CaseMessage,
    Department,
    Faculty,
    Notification,
    OTPVerification,
    StaffProfile,
    User,
)


class CaseApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = Client()
        self.faculty = Faculty.objects.create(name='Technology')
        self.academic_department = Department.objects.create(
            name='Academic Affairs',
            faculty=self.faculty,
        )
        self.student = User.objects.create_user(
            username='student1',
            password='Password123!',
            email='student1@example.com',
            role='student',
        )
        self.staff = User.objects.create_user(
            username='staff1',
            password='Password123!',
            email='staff1@example.com',
            role='staff',
        )
        self.admin = User.objects.create_user(
            username='admin1',
            password='Password123!',
            email='admin1@example.com',
            role='admin',
        )
        self.super_admin = User.objects.create_superuser(
            username='superadmin1',
            password='Password123!',
            email='superadmin1@example.com',
        )
        self.super_admin.role = 'admin'
        self.super_admin.save(update_fields=['role'])
        staff_profile = StaffProfile.objects.create(user=self.staff, job_title='Advisor')
        staff_profile.departments.add(self.academic_department)

    def test_student_case_creation_auto_routes_by_title(self):
        self.client.login(username='student1', password='Password123!')

        response = self.client.post(
            reverse('create_case'),
            {
                'title': 'Exam appeal for final grade',
                'description': 'I need a review of my final grade.',
                'priority': 'H',
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload['status'], 'success')
        self.assertEqual(payload['data']['case']['category'], 'AC')
        self.assertEqual(payload['data']['case']['department']['name'], 'Academic Affairs')
        self.assertEqual(payload['data']['case']['staff']['username'], 'staff1')

        created_case = Case.objects.get(id=payload['data']['case']['id'])
        self.assertEqual(created_case.routing_source, 'AU')
        self.assertTrue(created_case.reference_code.startswith('CASE-'))

    def test_student_cannot_view_other_students_case(self):
        other_student = User.objects.create_user(
            username='student2',
            password='Password123!',
            email='student2@example.com',
            role='student',
        )
        case = Case.objects.create(
            category='AC',
            title='Private case',
            description='Should not be visible to another student.',
            student=self.student,
            staff=self.staff,
            department=self.academic_department,
        )

        self.client.login(username='student2', password='Password123!')
        response = self.client.get(reverse('case_detail', args=[case.id]))

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['message'], 'You do not have permission to view this case.')

    def test_staff_students_endpoint_returns_assigned_students(self):
        Case.objects.create(
            category='AC',
            title='Grade issue',
            description='Assigned to staff member.',
            student=self.student,
            staff=self.staff,
            department=self.academic_department,
        )

        self.client.login(username='staff1', password='Password123!')
        response = self.client.get(reverse('staff_students'))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'success')
        self.assertEqual(len(payload['data']['students']), 1)
        self.assertEqual(payload['data']['students'][0]['username'], 'student1')

    def test_change_password_updates_credentials(self):
        self.client.login(username='student1', password='Password123!')
        response = self.client.post(
            reverse('change_password'),
            data='{"current_password":"Password123!","new_password":"Newpass123!","confirm_password":"Newpass123!"}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.student.refresh_from_db()
        self.assertTrue(self.student.check_password('Newpass123!'))

    def test_normal_admin_cannot_send_global_notifications(self):
        self.client.login(username='admin1', password='Password123!')
        response = self.client.post(
            reverse('send_global_notification'),
            data='{"message":"System maintenance tonight","target_role":"student"}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(Notification.objects.filter(user=self.student).count(), 0)

    def test_super_admin_can_send_global_notifications(self):
        self.client.login(username='superadmin1', password='Password123!')
        response = self.client.post(
            reverse('send_global_notification'),
            data='{"message":"System maintenance tonight","target_role":"student"}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['data']['recipient_count'], 1)
        self.assertEqual(Notification.objects.filter(user=self.student).count(), 1)

    def test_normal_admin_cannot_view_student_case_detail(self):
        case = Case.objects.create(
            category='AC',
            title='Restricted from normal admin',
            description='Normal admin should not see this.',
            student=self.student,
            staff=self.staff,
            department=self.academic_department,
        )

        self.client.login(username='admin1', password='Password123!')
        response = self.client.get(reverse('case_detail', args=[case.id]))

        self.assertEqual(response.status_code, 403)

    def test_super_admin_can_view_student_case_detail(self):
        case = Case.objects.create(
            category='AC',
            title='Visible to super admin',
            description='Super admin can see all cases.',
            student=self.student,
            staff=self.staff,
            department=self.academic_department,
        )

        self.client.login(username='superadmin1', password='Password123!')
        response = self.client.get(reverse('case_detail', args=[case.id]))

        self.assertEqual(response.status_code, 200)

    def test_case_detail_includes_messages(self):
        case = Case.objects.create(
            category='AC',
            title='Clarification needed',
            description='Case for threaded discussion.',
            student=self.student,
            staff=self.staff,
            department=self.academic_department,
        )
        CaseMessage.objects.create(case=case, sender=self.student, message='Initial context from student.')

        self.client.login(username='staff1', password='Password123!')
        response = self.client.get(reverse('case_detail', args=[case.id]))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload['data']['case']['messages']), 1)
        self.assertEqual(payload['data']['case']['messages'][0]['sender']['username'], 'student1')

    def test_case_message_post_creates_notification_for_other_participant(self):
        case = Case.objects.create(
            category='AC',
            title='Need more information',
            description='Case for follow-up.',
            student=self.student,
            staff=self.staff,
            department=self.academic_department,
        )

        self.client.login(username='staff1', password='Password123!')
        response = self.client.post(
            reverse('case_messages', args=[case.id]),
            data='{"message":"Please attach your transcript."}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(CaseMessage.objects.filter(case=case).count(), 1)
        notification = Notification.objects.filter(user=self.student, case=case, notification_type='CM').latest('id')
        self.assertIn('New message on', notification.message)

    def test_case_message_post_accepts_attachment(self):
        case = Case.objects.create(
            category='AC',
            title='Supporting document',
            description='Case with chat attachment.',
            student=self.student,
            staff=self.staff,
            department=self.academic_department,
        )

        self.client.login(username='student1', password='Password123!')
        response = self.client.post(
            reverse('case_messages', args=[case.id]),
            {
                'message': 'Here is the requested document.',
                'file': SimpleUploadedFile('evidence.pdf', b'%PDF-1.4 test file', content_type='application/pdf'),
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()['data']['message_item']['attachment'].endswith('.pdf'))

    def test_non_participant_cannot_send_case_message(self):
        other_student = User.objects.create_user(
            username='student2',
            password='Password123!',
            email='student2@example.com',
            role='student',
        )
        case = Case.objects.create(
            category='AC',
            title='Restricted case',
            description='Only participants may message.',
            student=self.student,
            staff=self.staff,
            department=self.academic_department,
        )

        self.client.login(username='student2', password='Password123!')
        response = self.client.post(
            reverse('case_messages', args=[case.id]),
            data='{"message":"I should not be here."}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(CaseMessage.objects.filter(case=case).count(), 0)


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class OTPAuthTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = Client()
        self.user = User.objects.create_user(
            username='resetuser',
            password='Password123!',
            email='reset@example.com',
            role='student',
        )

    def _signup_payload(self, **overrides):
        payload = {
            'full_name': 'Ada Lovelace',
            'email': 'newstudent@hustudent.edu',
            'password1': 'Password123!',
            'password2': 'Password123!',
        }
        payload.update(overrides)
        return payload

    def test_signup_request_generates_new_hashed_otp(self):
        existing = OTPVerification.objects.create(
            email='newstudent@hustudent.edu',
            purpose=OTPVerification.PURPOSE_SIGNUP,
            code='obsolete',
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        OTPVerification.objects.filter(id=existing.id).update(created_at=timezone.now() - timedelta(minutes=2))

        response = self.client.post(
            reverse('signup_request_otp'),
            data=self._signup_payload(),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(OTPVerification.objects.filter(email='newstudent@hustudent.edu', purpose='signup').count(), 1)
        otp_record = OTPVerification.objects.get(email='newstudent@hustudent.edu', purpose='signup')
        self.assertNotEqual(otp_record.id, existing.id)
        self.assertEqual(len(mail.outbox), 1)
        self.assertNotIn('obsolete', mail.outbox[0].body)
        self.assertNotEqual(otp_record.code, mail.outbox[0].body)
        self.assertIn('pending_signup', otp_record.context)

    def test_otp_expiry_helper_returns_true_after_five_minutes(self):
        otp_record = OTPVerification.objects.create(
            email='expired@example.com',
            purpose=OTPVerification.PURPOSE_SIGNUP,
            code='hashed-value',
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        otp_record.refresh_from_db()

        self.assertTrue(otp_record.is_expired())

    def test_signup_verify_rejects_invalid_otp(self):
        self.client.post(
            reverse('signup_request_otp'),
            data=self._signup_payload(email='invalidsignup@hustudent.edu'),
            content_type='application/json',
        )

        response = self.client.post(
            reverse('signup_verify_otp'),
            data='{"email":"invalidsignup@example.com","otp":"111111"}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.filter(username='invalidsignup').count(), 0)

    def test_successful_signup_creates_user_and_marks_otp_used(self):
        email = 'verifiedsignup@hustudent.edu'
        self.client.post(
            reverse('signup_request_otp'),
            data=self._signup_payload(email=email),
            content_type='application/json',
        )
        otp = mail.outbox[-1].body.split(': ')[1].split('.')[0]

        response = self.client.post(
            reverse('signup_verify_otp'),
            data='{"email":"verifiedsignup@hustudent.edu","otp":"%s"}' % otp,
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        created_user = User.objects.get(username='verifiedsignup')
        self.assertEqual(created_user.email, email)
        self.assertEqual(created_user.role, 'student')
        otp_record = OTPVerification.objects.get(email=email, purpose='signup')
        self.assertTrue(otp_record.is_used)
        self.assertEqual(created_user.first_name, 'Ada')
        self.assertEqual(created_user.last_name, 'Lovelace')

    def test_signup_assigns_student_role_for_hustudents_domain(self):
        email = 'studentuser@hustudents.edu'
        self.client.post(
            reverse('signup_request_otp'),
            data=self._signup_payload(email=email),
            content_type='application/json',
        )
        otp = mail.outbox[-1].body.split(': ')[1].split('.')[0]

        response = self.client.post(
            reverse('signup_verify_otp'),
            data='{"email":"studentuser@hustudents.edu","otp":"%s"}' % otp,
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        created_user = User.objects.get(email=email)
        self.assertEqual(created_user.role, 'student')

    def test_signup_assigns_staff_role_for_hu_domain(self):
        email = 'staffuser@hu.edu.et'
        self.client.post(
            reverse('signup_request_otp'),
            data=self._signup_payload(email=email),
            content_type='application/json',
        )
        otp = mail.outbox[-1].body.split(': ')[1].split('.')[0]

        response = self.client.post(
            reverse('signup_verify_otp'),
            data='{"email":"staffuser@hu.edu.et","otp":"%s"}' % otp,
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        created_user = User.objects.get(email=email)
        self.assertEqual(created_user.role, 'staff')

    def test_successful_reset_updates_password_and_marks_otp_used(self):
        self.client.post(
            reverse('reset_request_otp'),
            data='{"email":"reset@example.com"}',
            content_type='application/json',
        )
        otp = mail.outbox[-1].body.split(': ')[1].split('.')[0]

        response = self.client.post(
            reverse('reset_verify_otp'),
            data='{"email":"reset@example.com","otp":"%s","new_password":"ResetPass123!"}' % otp,
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('ResetPass123!'))
        otp_record = OTPVerification.objects.get(email='reset@example.com', purpose='reset')
        self.assertTrue(otp_record.is_used)

    def test_signup_request_requires_complete_form_before_sending_otp(self):
        response = self.client.post(
            reverse('signup_request_otp'),
            data={'email': 'missing@example.com'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(OTPVerification.objects.filter(email='missing@example.com').count(), 0)

    def test_signup_invalid_attempt_limit_invalidates_otp(self):
        self.client.post(
            reverse('signup_request_otp'),
            data=self._signup_payload(email='attempts@hustudent.edu'),
            content_type='application/json',
        )

        for _ in range(4):
            response = self.client.post(
                reverse('signup_verify_otp'),
                data='{"email":"attempts@hustudent.edu","otp":"000000"}',
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 400)

        final_response = self.client.post(
            reverse('signup_verify_otp'),
            data='{"email":"attempts@hustudent.edu","otp":"000000"}',
            content_type='application/json',
        )

        self.assertEqual(final_response.status_code, 400)
        self.assertIn('Too many invalid attempts', final_response.json()['message'])
        self.assertFalse(OTPVerification.objects.filter(email='attempts@example.com', purpose='signup', is_used=False).exists())


class AIChatTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = Client()
        self.user = User.objects.create_user(
            username='chatstudent',
            password='Password123!',
            email='chatstudent@hustudent.edu',
            role='student',
        )

    def test_signup_request_rejects_non_university_domain(self):
        response = self.client.post(
            reverse('signup_request_otp'),
            data='{"full_name":"Test User","email":"test@gmail.com","password1":"Password123!","password2":"Password123!"}',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertEqual(payload['status'], 'error')
        self.assertIn('Only official Hawassa University emails are allowed.', payload['data']['email'][0])

    def test_ask_ai_view_stores_history_and_returns_answer(self):
        self.client.login(username='chatstudent', password='Password123!')
        with patch('system_mdl.views.ask_academic_advisor', return_value='This is a verified AI answer.'):
            response = self.client.post(
                reverse('ask_ai'),
                data='{"question":"What is the registration deadline?"}',
                content_type='application/json',
            )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'success')
        self.assertEqual(payload['data']['answer'], 'This is a verified AI answer.')
        self.assertTrue(AIChatHistory.objects.filter(student=self.user, question__icontains='registration').exists())

    def test_ai_history_endpoint_returns_user_history(self):
        AIChatHistory.objects.create(student=self.user, question='What is GPA?', answer='GPA is calculated from grades.')
        self.client.login(username='chatstudent', password='Password123!')
        response = self.client.get(reverse('ai_chat_history'))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'success')
        self.assertEqual(len(payload['data']['history']), 1)
        self.assertEqual(payload['data']['history'][0]['question'], 'What is GPA?')
