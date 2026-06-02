from django.core.management.base import BaseCommand

from system_mdl.models import Department, Faculty, StaffProfile, User


SEED_STRUCTURE = {
    'College of Computing and Informatics': [
        {
            'department': 'Academic Affairs',
            'staff': [
                {
                    'username': 'academic_affairs_officer',
                    'email': 'academic.affairs@university.edu',
                    'first_name': 'Academic',
                    'last_name': 'Officer',
                    'job_title': 'Academic Affairs Officer',
                },
                {
                    'username': 'student_advisor',
                    'email': 'student.advisor@university.edu',
                    'first_name': 'Student',
                    'last_name': 'Advisor',
                    'job_title': 'Student Advisor',
                },
            ],
        },
        {
            'department': 'Registrar',
            'staff': [
                {
                    'username': 'registrar_officer',
                    'email': 'registrar@university.edu',
                    'first_name': 'Registrar',
                    'last_name': 'Officer',
                    'job_title': 'Registrar Officer',
                },
            ],
        },
        {
            'department': 'Student Welfare',
            'staff': [
                {
                    'username': 'welfare_officer',
                    'email': 'welfare@university.edu',
                    'first_name': 'Welfare',
                    'last_name': 'Officer',
                    'job_title': 'Student Welfare Officer',
                },
            ],
        },
        {
            'department': 'Disciplinary Office',
            'staff': [
                {
                    'username': 'discipline_officer',
                    'email': 'discipline@university.edu',
                    'first_name': 'Discipline',
                    'last_name': 'Officer',
                    'job_title': 'Disciplinary Officer',
                },
            ],
        },
    ],
}


class Command(BaseCommand):
    help = 'Seed faculties, departments, and staff assignments for the university support portal.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            required=True,
            help='Password to assign to created staff accounts.',
        )

    def handle(self, *args, **options):
        password = options['password']

        for faculty_name, departments in SEED_STRUCTURE.items():
            faculty, faculty_created = Faculty.objects.get_or_create(name=faculty_name)
            self._write_result('Faculty', faculty_name, faculty_created)

            for department_data in departments:
                department_name = department_data['department']
                department, department_created = Department.objects.get_or_create(
                    name=department_name,
                    faculty=faculty,
                )
                self._write_result('Department', department_name, department_created)

                for staff_data in department_data['staff']:
                    user, user_created = User.objects.get_or_create(
                        username=staff_data['username'],
                        defaults={
                            'email': staff_data['email'],
                            'first_name': staff_data['first_name'],
                            'last_name': staff_data['last_name'],
                            'role': 'staff',
                        },
                    )

                    if user_created:
                        user.set_password(password)
                        user.save()
                    else:
                        updated = False
                        for field in ('email', 'first_name', 'last_name'):
                            new_value = staff_data[field]
                            if getattr(user, field) != new_value:
                                setattr(user, field, new_value)
                                updated = True
                        if user.role != 'staff':
                            user.role = 'staff'
                            updated = True
                        if updated:
                            user.save()

                    self._write_result('Staff User', user.username, user_created)

                    profile, profile_created = StaffProfile.objects.get_or_create(
                        user=user,
                        defaults={'job_title': staff_data['job_title']},
                    )

                    if profile.job_title != staff_data['job_title']:
                        profile.job_title = staff_data['job_title']
                        profile.save(update_fields=['job_title'])

                    profile.departments.add(department)
                    self._write_result('Staff Profile', user.username, profile_created)

        self.stdout.write(self.style.SUCCESS('Portal seed data is ready.'))

    def _write_result(self, label, name, created):
        action = 'Created' if created else 'Exists'
        self.stdout.write(f'{action}: {label} -> {name}')
