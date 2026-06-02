from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('system_mdl', '0005_casemessage_notificationtype_caselog_action'),
    ]

    operations = [
        migrations.CreateModel(
            name='OTPVerification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(max_length=254)),
                ('otp', models.CharField(max_length=128)),
                ('purpose', models.CharField(choices=[('signup', 'Signup'), ('reset', 'Reset')], max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('is_used', models.BooleanField(default=False)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='system_mdl.user')),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['email', 'purpose', 'created_at'], name='system_mdl__email_2e8591_idx'),
                    models.Index(fields=['email', 'purpose', 'is_used'], name='system_mdl__email_9ec2b3_idx'),
                ],
            },
        ),
    ]
