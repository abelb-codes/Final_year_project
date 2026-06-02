from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import (
    AIChatHistory,
    Case,
    CaseDocument,
    CaseLog,
    Department,
    Faculty,
    Notification,
    OTPVerification,
    StaffProfile,
    StudentProfile,
    User,
)


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'role', 'is_staff')
    list_filter = ('role', 'is_staff', 'is_superuser', 'is_active')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    fieldsets = UserAdmin.fieldsets + (
        ('Role Info', {'fields': ('role',)}),
    )


@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'faculty')
    list_filter = ('faculty',)
    search_fields = ('name', 'faculty__name')


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'job_title', 'department_list')
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'job_title')
    filter_horizontal = ('departments',)

    def department_list(self, obj):
        return ', '.join(obj.departments.values_list('name', flat=True))

    department_list.short_description = 'Departments'


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'department', 'year_of_study')
    list_filter = ('department', 'year_of_study')
    search_fields = ('user__username', 'user__first_name', 'user__last_name')


@admin.register(Case)
class CaseAdmin(admin.ModelAdmin):
    list_display = ('reference_code', 'title', 'category', 'status', 'priority', 'student', 'staff', 'department', 'created_at')
    list_filter = ('category', 'status', 'priority', 'department')
    search_fields = ('reference_code', 'title', 'student__username', 'staff__username', 'description')
    readonly_fields = ('reference_code', 'created_at', 'updated_at')


@admin.register(CaseLog)
class CaseLogAdmin(admin.ModelAdmin):
    list_display = ('case', 'action_type', 'performed_by', 'created_at')
    list_filter = ('action_type', 'created_at')
    search_fields = ('case__reference_code', 'message', 'performed_by__username')


@admin.register(CaseDocument)
class CaseDocumentAdmin(admin.ModelAdmin):
    list_display = ('case', 'uploaded_by', 'uploaded_at', 'is_requested')
    list_filter = ('is_requested', 'uploaded_at')
    search_fields = ('case__reference_code', 'uploaded_by__username')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'notification_type', 'case', 'is_read', 'created_at')
    list_filter = ('notification_type', 'is_read', 'created_at')
    search_fields = ('user__username', 'message', 'case__reference_code')


@admin.register(OTPVerification)
class OTPVerificationAdmin(admin.ModelAdmin):
    list_display = ('email', 'purpose', 'user', 'is_used', 'created_at')
    list_filter = ('purpose', 'is_used', 'created_at')
    search_fields = ('email', 'user__username')
    readonly_fields = ('created_at',)


@admin.register(AIChatHistory)
class AIChatHistoryAdmin(admin.ModelAdmin):
    list_display = ('student', 'question', 'created_at')
    search_fields = ('student__username', 'question', 'answer')
