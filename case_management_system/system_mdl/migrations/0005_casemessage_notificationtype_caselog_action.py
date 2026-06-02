from django.db import migrations, models
import django.core.validators
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('system_mdl', '0004_user_email_unique_case_document_validation'),
    ]

    operations = [
        migrations.CreateModel(
            name='CaseMessage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('message', models.TextField()),
                ('attachment', models.FileField(blank=True, null=True, upload_to='case_messages/', validators=[django.core.validators.FileExtensionValidator(['pdf', 'jpg', 'jpeg', 'png'])])),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('case', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='messages', to='system_mdl.case')),
                ('sender', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='case_messages', to='system_mdl.user')),
            ],
            options={
                'ordering': ['created_at', 'id'],
            },
        ),
        migrations.AlterField(
            model_name='caselog',
            name='action_type',
            field=models.CharField(choices=[('CR', 'Created'), ('UP', 'Updated'), ('ST', 'Status Changed'), ('DR', 'Document Requested'), ('DU', 'Document Uploaded'), ('MS', 'Message Sent')], max_length=2),
        ),
        migrations.AlterField(
            model_name='notification',
            name='notification_type',
            field=models.CharField(choices=[('NC', 'New Case'), ('UP', 'Case Updated'), ('DR', 'Document Requested'), ('DU', 'Document Uploaded'), ('CM', 'Case Message')], max_length=2),
        ),
    ]
