from django.contrib.auth.models import AbstractUser
from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    ROLE_CHOICES = (
        ('student', 'Student'),
        ('staff', 'Staff'),
        ('admin', 'Admin'),
    )

    role = models.CharField(
        max_length=10, choices=ROLE_CHOICES,
        default='student'
        )
    email = models.EmailField(unique=True, null=True, blank=True)


class Faculty(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Department(models.Model):
    name = models.CharField(max_length=100)
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE)
    def __str__(self):
        return self.name


class StaffProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    departments = models.ManyToManyField(Department)
    job_title = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"Staff: {self.user.username}"


class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    year_of_study = models.PositiveSmallIntegerField(null=True, blank=True)

    def __str__(self):
        return f"Student: {self.user.username}"


class OTPVerification(models.Model):
    PURPOSE_SIGNUP = 'signup'
    PURPOSE_RESET = 'reset'
    PURPOSE_CHOICES = (
        (PURPOSE_SIGNUP, 'Signup'),
        (PURPOSE_RESET, 'Reset'),
    )

    email = models.EmailField()
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    code = models.CharField(max_length=128)
    purpose = models.CharField(max_length=10, choices=PURPOSE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempt_count = models.PositiveSmallIntegerField(default=0)
    context = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email', 'purpose', 'created_at']),
            models.Index(fields=['email', 'purpose', 'is_used']),
        ]

    def is_expired(self):
        return timezone.now() >= self.expires_at

    def __str__(self):
        return f'{self.email} - {self.purpose}'


STATUS_CHOICES = [
    ('P', 'Pending'),
    ('IP', 'In Progress'),
    ('RS', 'Resolved'),
    ('RJ', 'Rejected'),
]


CASE_CATEGORY_CHOICES = [
    ('AC', 'Academic Complaint'),
    ('AR', 'Advising Request'),
    ('WS', 'Welfare Support'),
    ('AD', 'Administrative Request'),
    ('DI', 'Disciplinary Inquiry'),
]


CASE_PRIORITY_CHOICES = [
    ('N', 'Normal'),
    ('H', 'High'),
    ('U', 'Urgent'),
]


ROUTING_SOURCE_CHOICES = [
    ('AU', 'Automatic'),
    ('MN', 'Manual'),
]


class Case(models.Model):
    category = models.CharField(
        max_length=2,
        choices=CASE_CATEGORY_CHOICES,
        default='AC'
    )

    title = models.CharField(max_length=255)

    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='student_cases'
    )

    staff = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='staff_cases',
        null=True,
        blank=True
    )

    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    description = models.TextField(blank=True)

    priority = models.CharField(
        max_length=1,
        choices=CASE_PRIORITY_CHOICES,
        default='N'
    )

    status = models.CharField(
        max_length=2,
        choices=STATUS_CHOICES,
        default='P'
    )

    routing_source = models.CharField(
        max_length=2,
        choices=ROUTING_SOURCE_CHOICES,
        default='AU'
    )

    routing_notes = models.TextField(blank=True)

    resolution_notes = models.TextField(blank=True)

    reference_code = models.CharField(max_length=20, unique=True, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.reference_code:
            self.reference_code = f"CASE-{self.created_at:%Y}-{self.id:04d}"
            super().save(update_fields=['reference_code'])

    def __str__(self):
        return f"{self.reference_code or f'Case {self.id}'} - {self.title}"

    class Meta:
        ordering = ['-created_at']



class CaseDocument(models.Model):
    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        related_name='documents'
    )

    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE)

    file = models.FileField(
        upload_to='case_documents/',
        validators=[FileExtensionValidator(['pdf', 'jpg', 'jpeg', 'png'])],
    )

    is_requested = models.BooleanField(default=False)

    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Doc {self.id} for Case {self.case.id}"


class CaseMessage(models.Model):
    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        related_name='messages'
    )

    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='case_messages'
    )

    message = models.TextField()

    attachment = models.FileField(
        upload_to='case_messages/',
        validators=[FileExtensionValidator(['pdf', 'jpg', 'jpeg', 'png'])],
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']

    def __str__(self):
        return f"Message {self.id} for Case {self.case_id}"


ACTION_TYPES = [
    ('CR', 'Created'),
    ('UP', 'Updated'),
    ('ST', 'Status Changed'),
    ('DR', 'Document Requested'),
    ('DU', 'Document Uploaded'),
    ('MS', 'Message Sent'),
]


class CaseLog(models.Model):
    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        related_name='logs'
    )

    performed_by = models.ForeignKey(User, on_delete=models.CASCADE)

    action_type = models.CharField(max_length=2, choices=ACTION_TYPES)

    message = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_action_type_display()} - {self.performed_by}"


NOTIFICATION_TYPES = [
    ('NC', 'New Case'),
    ('UP', 'Case Updated'),
    ('DR', 'Document Requested'),
    ('DU', 'Document Uploaded'),
    ('CM', 'Case Message'),
]


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)

    case = models.ForeignKey(
        Case,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    notification_type = models.CharField(max_length=2, choices=NOTIFICATION_TYPES)

    message = models.TextField()

    is_read = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_notification_type_display()} - {self.user.username}"


class AIChatHistory(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE)

    question = models.TextField()
    answer = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.question[:30]
