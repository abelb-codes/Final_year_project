import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project_model.settings')
import django
from django.conf import settings
settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
django.setup()
from django.core import mail
from django.test import Client
from django.urls import reverse
from system_mdl.models import OTPVerification

payload = {
    'full_name': 'Ada Lovelace',
    'email': 'verifiedsignup@hustudent.edu',
    'password1': 'Password123!',
    'password2': 'Password123!',
}
client = Client()
response1 = client.post(reverse('signup_request_otp'), data=payload, content_type='application/json')
print('req1 status', response1.status_code)
print('response1', response1.content)
print('outbox len', len(mail.outbox))
if mail.outbox:
    body = mail.outbox[-1].body
    print('body repr', repr(body))
    otp = body.split(': ')[1].split('.')[0]
    print('otp', otp)
    response2 = client.post(reverse('signup_verify_otp'), data='{"email":"verifiedsignup@hustudent.edu","otp":"%s"}' % otp, content_type='application/json')
    print('req2 status', response2.status_code)
    print('response2', response2.content)
print('otp records', OTPVerification.objects.filter(email='verifiedsignup@hustudent.edu', purpose='signup').count())
