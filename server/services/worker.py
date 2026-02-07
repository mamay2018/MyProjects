"""Background Worker - Processes scheduled follow-ups and reminders"""
import os
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from dotenv import load_dotenv

load_dotenv()

MOCK_MODE = os.getenv("MOCK_MODE", "true").lower() == "true"


async def process_scheduled_sends(db: AsyncSession) -> dict:
    """Process all pending scheduled sends that are due"""
    import crud
    import models
    from services.messaging import MessagingService, replace_template_variables
    from services.push_notifications import PushNotificationService
    
    messaging = MessagingService()
    push_service = PushNotificationService()
    
    now = datetime.utcnow()
    pending = await crud.get_pending_scheduled_sends(db, now)
    
    follow_ups_processed = 0
    reminders_processed = 0
    
    for scheduled in pending:
        try:
            lead = scheduled.lead
            if not lead:
                scheduled.status = models.ScheduledSendStatus.CANCELLED
                continue
            
            # Skip if lead is closed or automation paused
            if lead.status in [models.LeadStatus.BOOKED, models.LeadStatus.WON, models.LeadStatus.LOST]:
                scheduled.status = models.ScheduledSendStatus.CANCELLED
                continue
            
            if lead.automation_paused:
                scheduled.status = models.ScheduledSendStatus.CANCELLED
                continue
            
            # Get user info for template variables
            user = await crud.get_user_by_id(db, lead.user_id)
            if not user:
                scheduled.status = models.ScheduledSendStatus.FAILED
                continue
            
            # Build template variables
            template_vars = {
                "customer_name": lead.customer_name,
                "pro_name": user.pro_name,
                "business_name": user.business_name or user.pro_name,
            }
            
            if scheduled.entity_type == models.ScheduledEntityType.FOLLOW_UP:
                # Process follow-up
                step = scheduled.follow_up_step
                if not step:
                    scheduled.status = models.ScheduledSendStatus.FAILED
                    continue
                
                # Get message body from template or custom body
                if step.custom_body:
                    body = step.custom_body
                elif step.template_id:
                    template = await crud.get_template_by_id(db, user.id, step.template_id)
                    if template:
                        body = template.body
                    else:
                        body = "Hi {customer_name}, this is {pro_name}. I wanted to follow up with you."
                else:
                    body = "Hi {customer_name}, this is {pro_name}. I wanted to follow up with you."
                
                # Replace variables
                body = replace_template_variables(body, template_vars)
                
                # Send message
                if step.channel == models.MessageChannel.SMS and lead.customer_phone:
                    result = await messaging.send_sms(lead.customer_phone, body)
                    status = models.MessageStatus.MOCKED if MOCK_MODE else (
                        models.MessageStatus.SENT if result["success"] else models.MessageStatus.FAILED
                    )
                    
                    await crud.create_message_log(
                        db=db,
                        user_id=user.id,
                        lead_id=lead.id,
                        channel=models.MessageChannel.SMS,
                        to_address=lead.customer_phone,
                        from_address=user.phone,
                        body=body,
                        status=status,
                        external_id=result.get("external_id")
                    )
                    
                elif step.channel == models.MessageChannel.EMAIL and lead.customer_email:
                    # Get subject from template or default
                    subject = "Following up from {business_name}"
                    if step.template_id:
                        template = await crud.get_template_by_id(db, user.id, step.template_id)
                        if template and template.subject:
                            subject = template.subject
                    subject = replace_template_variables(subject, template_vars)
                    
                    result = await messaging.send_email(lead.customer_email, subject, body)
                    status = models.MessageStatus.MOCKED if MOCK_MODE else (
                        models.MessageStatus.SENT if result["success"] else models.MessageStatus.FAILED
                    )
                    
                    await crud.create_message_log(
                        db=db,
                        user_id=user.id,
                        lead_id=lead.id,
                        channel=models.MessageChannel.EMAIL,
                        to_address=lead.customer_email,
                        from_address=user.email,
                        subject=subject,
                        body=body,
                        status=status,
                        external_id=result.get("external_id")
                    )
                
                follow_ups_processed += 1
                scheduled.status = models.ScheduledSendStatus.SENT
                
            elif scheduled.entity_type == models.ScheduledEntityType.REMINDER:
                # Process appointment reminder
                appt = scheduled.appointment
                if not appt or appt.reminder_sent:
                    scheduled.status = models.ScheduledSendStatus.CANCELLED
                    continue
                
                # Format appointment time
                template_vars["appointment_time"] = appt.start_at_utc.strftime("%B %d at %I:%M %p")
                template_vars["customer_name"] = appt.customer_name
                
                body = "Hi {customer_name}! Just a reminder about your appointment with {business_name} on {appointment_time}. See you then!"
                body = replace_template_variables(body, template_vars)
                
                # Send reminder via SMS if phone available
                if appt.customer_phone:
                    result = await messaging.send_sms(appt.customer_phone, body)
                    await crud.create_message_log(
                        db=db,
                        user_id=user.id,
                        lead_id=lead.id if lead else None,
                        channel=models.MessageChannel.SMS,
                        to_address=appt.customer_phone,
                        body=body,
                        status=models.MessageStatus.MOCKED if MOCK_MODE else (
                            models.MessageStatus.SENT if result["success"] else models.MessageStatus.FAILED
                        )
                    )
                
                # Send push notification to pro
                await push_service.send_to_user_devices(
                    db,
                    user.id,
                    "Appointment Reminder",
                    f"You have an appointment with {appt.customer_name} coming up"
                )
                
                appt.reminder_sent = True
                reminders_processed += 1
                scheduled.status = models.ScheduledSendStatus.SENT
            
            scheduled.processed_at = now
            
        except Exception as e:
            print(f"Error processing scheduled send {scheduled.id}: {e}")
            scheduled.status = models.ScheduledSendStatus.FAILED
    
    await db.commit()
    
    return {
        "follow_ups": follow_ups_processed,
        "reminders": reminders_processed,
        "total_processed": len(pending)
    }


async def schedule_appointment_reminder(db: AsyncSession, appointment_id, hours_before: int = 24):
    """Schedule a reminder for an appointment"""
    import crud
    import models
    
    from sqlalchemy import select
    result = await db.execute(
        select(models.Appointment).where(models.Appointment.id == appointment_id)
    )
    appt = result.scalar_one_or_none()
    
    if not appt:
        return None
    
    reminder_time = appt.start_at_utc - timedelta(hours=hours_before)
    
    # Only schedule if reminder time is in the future
    if reminder_time <= datetime.utcnow():
        return None
    
    unique_key = f"reminder_{appointment_id}"
    
    return await crud.create_scheduled_send(
        db=db,
        user_id=appt.user_id,
        lead_id=appt.lead_id,
        entity_type=models.ScheduledEntityType.REMINDER,
        due_at_utc=reminder_time,
        appointment_id=appointment_id,
        unique_key=unique_key
    )
