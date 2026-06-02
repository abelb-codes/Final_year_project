from datetime import timedelta

from django.db import migrations, models


def populate_otp_expiry(apps, schema_editor):
    OTPVerification = apps.get_model('system_mdl', 'OTPVerification')
    for otp_record in OTPVerification.objects.all().iterator():
        otp_record.expires_at = otp_record.created_at + timedelta(minutes=5)
        otp_record.save(update_fields=['expires_at'])


class Migration(migrations.Migration):

    dependencies = [
        ('system_mdl', '0007_rename_system_mdl__email_2e8591_idx_system_mdl__email_135090_idx_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='otpverification',
            old_name='otp',
            new_name='code',
        ),
        migrations.AddField(
            model_name='otpverification',
            name='attempt_count',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='otpverification',
            name='context',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='otpverification',
            name='expires_at',
            field=models.DateTimeField(default=None, null=True),
            preserve_default=False,
        ),
        migrations.RunPython(populate_otp_expiry, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='otpverification',
            name='expires_at',
            field=models.DateTimeField(),
        ),
    ]
