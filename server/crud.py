"""FollowUp Pro v2 - CRUD Operations"""
from datetime import datetime, timedelta
from typing import Optional, List
from uuid import UUID
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import models
import schemas


# ============= USER CRUD =============

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[models.User]:
    result = await db.execute(select(models.User).where(models.User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> Optional[models.User]:
    result = await db.execute(select(models.User).where(models.User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_public_booking_id(db: AsyncSession, public_id: str) -> Optional[models.User]:
    result = await db.execute(select(models.User).where(models.User.public_booking_id == public_id))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, user_data: schemas.UserCreate, hashed_password: str) -> models.User:
    user = models.User(
        email=user_data.email,
        hashed_password=hashed_password,
        pro_name=user_data.pro_name,
        business_name=user_data.business_name,
        phone=user_data.phone,
        timezone=user_data.timezone
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_user(db: AsyncSession, user: models.User, user_data: schemas.UserUpdate) -> models.User:
    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


# ============= DEVICE CRUD =============

async def get_user_devices(db: AsyncSession, user_id: UUID) -> List[models.Device]:
    result = await db.execute(select(models.Device).where(models.Device.user_id == user_id))
    return result.scalars().all()


async def register_device(db: AsyncSession, user_id: UUID, device_data: schemas.DeviceRegister) -> models.Device:
    # Check if token already exists
    result = await db.execute(
        select(models.Device).where(models.Device.expo_push_token == device_data.expo_push_token)
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        # Update to new user if different
        existing.user_id = user_id
        existing.platform = device_data.platform
        existing.device_name = device_data.device_name
        existing.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(existing)
        return existing
    
    device = models.Device(
        user_id=user_id,
        expo_push_token=device_data.expo_push_token,
        platform=device_data.platform,
        device_name=device_data.device_name
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return device


async def delete_device(db: AsyncSession, user_id: UUID, device_id: UUID) -> bool:
    result = await db.execute(
        select(models.Device).where(
            and_(models.Device.id == device_id, models.Device.user_id == user_id)
        )
    )
    device = result.scalar_one_or_none()
    if device:
        await db.delete(device)
        await db.commit()
        return True
    return False


# ============= LEAD SOURCE CRUD =============

async def get_lead_sources(db: AsyncSession, user_id: UUID) -> List[models.LeadSource]:
    result = await db.execute(
        select(models.LeadSource)
        .where(models.LeadSource.user_id == user_id)
        .order_by(models.LeadSource.name)
    )
    return result.scalars().all()


async def get_lead_source_by_id(db: AsyncSession, user_id: UUID, source_id: UUID) -> Optional[models.LeadSource]:
    result = await db.execute(
        select(models.LeadSource).where(
            and_(models.LeadSource.id == source_id, models.LeadSource.user_id == user_id)
        )
    )
    return result.scalar_one_or_none()


async def create_lead_source(db: AsyncSession, user_id: UUID, source_data: schemas.LeadSourceCreate) -> models.LeadSource:
    source = models.LeadSource(
        user_id=user_id,
        name=source_data.name,
        color=source_data.color,
        is_default=source_data.is_default
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    return source


async def update_lead_source(db: AsyncSession, source: models.LeadSource, source_data: schemas.LeadSourceUpdate) -> models.LeadSource:
    update_data = source_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(source, field, value)
    await db.commit()
    await db.refresh(source)
    return source


async def delete_lead_source(db: AsyncSession, source: models.LeadSource) -> bool:
    await db.delete(source)
    await db.commit()
    return True


async def create_default_lead_sources(db: AsyncSession, user_id: UUID) -> List[models.LeadSource]:
    """Create default lead sources for a new user"""
    default_sources = [
        {"name": "Google Ads", "color": "#4285F4", "is_default": False},
        {"name": "Facebook", "color": "#1877F2", "is_default": False},
        {"name": "Thumbtack", "color": "#009FD9", "is_default": False},
        {"name": "Yelp", "color": "#D32323", "is_default": False},
        {"name": "HomeAdvisor", "color": "#F68B1E", "is_default": False},
        {"name": "Referral", "color": "#10B981", "is_default": True},
        {"name": "Website", "color": "#6366F1", "is_default": False},
        {"name": "Other", "color": "#6B7280", "is_default": False},
    ]
    
    sources = []
    for src in default_sources:
        source = models.LeadSource(user_id=user_id, **src)
        db.add(source)
        sources.append(source)
    
    await db.commit()
    for source in sources:
        await db.refresh(source)
    return sources


# ============= LEAD CRUD =============

async def get_leads(
    db: AsyncSession, 
    user_id: UUID, 
    status: Optional[models.LeadStatus] = None,
    source_id: Optional[UUID] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> List[models.Lead]:
    query = select(models.Lead).where(models.Lead.user_id == user_id)
    
    if status:
        query = query.where(models.Lead.status == status)
    if source_id:
        query = query.where(models.Lead.lead_source_id == source_id)
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                models.Lead.customer_name.ilike(search_term),
                models.Lead.customer_phone.ilike(search_term),
                models.Lead.customer_email.ilike(search_term)
            )
        )
    
    query = query.options(selectinload(models.Lead.lead_source))
    query = query.order_by(models.Lead.updated_at.desc())
    query = query.limit(limit).offset(offset)
    
    result = await db.execute(query)
    return result.scalars().all()


async def get_lead_by_id(db: AsyncSession, user_id: UUID, lead_id: UUID) -> Optional[models.Lead]:
    result = await db.execute(
        select(models.Lead)
        .where(and_(models.Lead.id == lead_id, models.Lead.user_id == user_id))
        .options(
            selectinload(models.Lead.lead_source),
            selectinload(models.Lead.captures)
        )
    )
    return result.scalar_one_or_none()


async def create_lead(db: AsyncSession, user_id: UUID, lead_data: schemas.LeadCreate) -> models.Lead:
    lead = models.Lead(
        user_id=user_id,
        customer_name=lead_data.customer_name,
        customer_phone=lead_data.customer_phone,
        customer_email=lead_data.customer_email,
        lead_source_id=lead_data.lead_source_id,
        notes=lead_data.notes,
        follow_up_plan_id=lead_data.follow_up_plan_id
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return lead


async def update_lead(db: AsyncSession, lead: models.Lead, lead_data: schemas.LeadUpdate) -> models.Lead:
    update_data = lead_data.model_dump(exclude_unset=True)
    
    # Handle status transitions
    if 'status' in update_data:
        new_status = update_data['status']
        now = datetime.utcnow()
        
        if new_status == models.LeadStatus.CONTACTED and not lead.contacted_at:
            lead.contacted_at = now
        elif new_status == models.LeadStatus.BOOKED and not lead.booked_at:
            lead.booked_at = now
        elif new_status in [models.LeadStatus.WON, models.LeadStatus.LOST] and not lead.closed_at:
            lead.closed_at = now
    
    for field, value in update_data.items():
        setattr(lead, field, value)
    
    await db.commit()
    await db.refresh(lead)
    return lead


async def delete_lead(db: AsyncSession, lead: models.Lead) -> bool:
    await db.delete(lead)
    await db.commit()
    return True


async def add_lead_capture(db: AsyncSession, lead_id: UUID, capture_data: schemas.LeadCaptureCreate) -> models.LeadCapture:
    capture = models.LeadCapture(
        lead_id=lead_id,
        type=capture_data.type,
        text=capture_data.text,
        file_url=capture_data.file_url
    )
    db.add(capture)
    await db.commit()
    await db.refresh(capture)
    return capture


# ============= TEMPLATE CRUD =============

async def get_templates(
    db: AsyncSession, 
    user_id: UUID, 
    category: Optional[models.TemplateCategory] = None
) -> List[models.Template]:
    query = select(models.Template).where(models.Template.user_id == user_id)
    if category:
        query = query.where(models.Template.category == category)
    query = query.order_by(models.Template.name)
    result = await db.execute(query)
    return result.scalars().all()


async def get_template_by_id(db: AsyncSession, user_id: UUID, template_id: UUID) -> Optional[models.Template]:
    result = await db.execute(
        select(models.Template).where(
            and_(models.Template.id == template_id, models.Template.user_id == user_id)
        )
    )
    return result.scalar_one_or_none()


async def create_template(db: AsyncSession, user_id: UUID, template_data: schemas.TemplateCreate) -> models.Template:
    template = models.Template(
        user_id=user_id,
        name=template_data.name,
        category=template_data.category,
        subject=template_data.subject,
        body=template_data.body,
        is_default=template_data.is_default
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


async def update_template(db: AsyncSession, template: models.Template, template_data: schemas.TemplateUpdate) -> models.Template:
    update_data = template_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    await db.commit()
    await db.refresh(template)
    return template


async def delete_template(db: AsyncSession, template: models.Template) -> bool:
    await db.delete(template)
    await db.commit()
    return True


async def create_default_templates(db: AsyncSession, user_id: UUID) -> List[models.Template]:
    """Create default templates for a new user"""
    default_templates = [
        {
            "name": "Initial SMS",
            "category": models.TemplateCategory.SMS,
            "body": "Hi {customer_name}! This is {pro_name} from {business_name}. Thanks for reaching out! When would be a good time to discuss your project?",
            "is_default": True
        },
        {
            "name": "Follow-up SMS",
            "category": models.TemplateCategory.SMS,
            "body": "Hi {customer_name}, just following up on my earlier message. I'd love to help with your project. Let me know if you have any questions!",
            "is_default": False
        },
        {
            "name": "Appointment Reminder SMS",
            "category": models.TemplateCategory.SMS,
            "body": "Hi {customer_name}! Just a reminder about our appointment tomorrow at {appointment_time}. Looking forward to seeing you! - {pro_name}",
            "is_default": False
        },
        {
            "name": "Initial Email",
            "category": models.TemplateCategory.EMAIL,
            "subject": "Thanks for contacting {business_name}!",
            "body": "Hi {customer_name},\n\nThank you for reaching out to {business_name}! I'm {pro_name} and I'd be happy to help with your project.\n\nWhen would be a good time for us to discuss your needs?\n\nBest regards,\n{pro_name}\n{business_name}",
            "is_default": True
        },
        {
            "name": "Quote Follow-up",
            "category": models.TemplateCategory.EMAIL,
            "subject": "Following up on your quote from {business_name}",
            "body": "Hi {customer_name},\n\nI wanted to follow up on the quote I sent over. Do you have any questions or would you like to proceed?\n\nI'm happy to discuss any adjustments to make it work for you.\n\nBest regards,\n{pro_name}",
            "is_default": False
        },
        {
            "name": "Thumbtack Reply",
            "category": models.TemplateCategory.PLATFORM,
            "body": "Hi {customer_name}! Thanks for your request on Thumbtack. I'd love to help with your project. I have great reviews and competitive pricing. When can we chat?",
            "is_default": True
        },
    ]
    
    templates = []
    for tmpl in default_templates:
        template = models.Template(user_id=user_id, **tmpl)
        db.add(template)
        templates.append(template)
    
    await db.commit()
    for template in templates:
        await db.refresh(template)
    return templates


# ============= AVAILABILITY CRUD =============

async def get_availability_rules(db: AsyncSession, user_id: UUID) -> List[models.AvailabilityRule]:
    result = await db.execute(
        select(models.AvailabilityRule)
        .where(models.AvailabilityRule.user_id == user_id)
        .order_by(models.AvailabilityRule.weekday, models.AvailabilityRule.start_time_local)
    )
    return result.scalars().all()


async def set_availability_rules(
    db: AsyncSession, 
    user_id: UUID, 
    rules_data: schemas.AvailabilityBulkUpdate
) -> List[models.AvailabilityRule]:
    # Delete existing rules
    existing = await get_availability_rules(db, user_id)
    for rule in existing:
        await db.delete(rule)
    
    # Create new rules
    new_rules = []
    for rule_data in rules_data.rules:
        rule = models.AvailabilityRule(
            user_id=user_id,
            weekday=rule_data.weekday,
            start_time_local=rule_data.start_time_local,
            end_time_local=rule_data.end_time_local,
            enabled=rule_data.enabled
        )
        db.add(rule)
        new_rules.append(rule)
    
    await db.commit()
    for rule in new_rules:
        await db.refresh(rule)
    return new_rules


async def create_default_availability(db: AsyncSession, user_id: UUID) -> List[models.AvailabilityRule]:
    """Create default availability (Mon-Fri 9am-5pm)"""
    from datetime import time
    rules = []
    for weekday in range(5):  # Monday to Friday
        rule = models.AvailabilityRule(
            user_id=user_id,
            weekday=weekday,
            start_time_local=time(9, 0),
            end_time_local=time(17, 0),
            enabled=True
        )
        db.add(rule)
        rules.append(rule)
    
    await db.commit()
    for rule in rules:
        await db.refresh(rule)
    return rules


# ============= APPOINTMENT CRUD =============

async def get_appointments(
    db: AsyncSession, 
    user_id: UUID,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[models.AppointmentStatus] = None
) -> List[models.Appointment]:
    query = select(models.Appointment).where(models.Appointment.user_id == user_id)
    
    if start_date:
        query = query.where(models.Appointment.start_at_utc >= start_date)
    if end_date:
        query = query.where(models.Appointment.start_at_utc <= end_date)
    if status:
        query = query.where(models.Appointment.status == status)
    
    query = query.order_by(models.Appointment.start_at_utc)
    result = await db.execute(query)
    return result.scalars().all()


async def get_appointment_by_id(db: AsyncSession, user_id: UUID, appt_id: UUID) -> Optional[models.Appointment]:
    result = await db.execute(
        select(models.Appointment).where(
            and_(models.Appointment.id == appt_id, models.Appointment.user_id == user_id)
        )
    )
    return result.scalar_one_or_none()


async def create_appointment(db: AsyncSession, user_id: UUID, appt_data: schemas.AppointmentCreate) -> models.Appointment:
    appt = models.Appointment(
        user_id=user_id,
        lead_id=appt_data.lead_id,
        start_at_utc=appt_data.start_at_utc,
        end_at_utc=appt_data.end_at_utc,
        customer_name=appt_data.customer_name,
        customer_phone=appt_data.customer_phone,
        customer_email=appt_data.customer_email,
        notes=appt_data.notes
    )
    db.add(appt)
    await db.commit()
    await db.refresh(appt)
    return appt


async def update_appointment(db: AsyncSession, appt: models.Appointment, appt_data: schemas.AppointmentUpdate) -> models.Appointment:
    update_data = appt_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(appt, field, value)
    await db.commit()
    await db.refresh(appt)
    return appt


async def delete_appointment(db: AsyncSession, appt: models.Appointment) -> bool:
    await db.delete(appt)
    await db.commit()
    return True


# ============= FOLLOW-UP PLAN CRUD =============

async def get_follow_up_plans(db: AsyncSession, user_id: UUID) -> List[models.FollowUpPlan]:
    result = await db.execute(
        select(models.FollowUpPlan)
        .where(models.FollowUpPlan.user_id == user_id)
        .options(selectinload(models.FollowUpPlan.steps))
        .order_by(models.FollowUpPlan.name)
    )
    return result.scalars().all()


async def get_follow_up_plan_by_id(db: AsyncSession, user_id: UUID, plan_id: UUID) -> Optional[models.FollowUpPlan]:
    result = await db.execute(
        select(models.FollowUpPlan)
        .where(and_(models.FollowUpPlan.id == plan_id, models.FollowUpPlan.user_id == user_id))
        .options(selectinload(models.FollowUpPlan.steps))
    )
    return result.scalar_one_or_none()


async def create_follow_up_plan(db: AsyncSession, user_id: UUID, plan_data: schemas.FollowUpPlanCreate) -> models.FollowUpPlan:
    plan = models.FollowUpPlan(
        user_id=user_id,
        name=plan_data.name,
        enabled=plan_data.enabled
    )
    db.add(plan)
    await db.flush()
    
    for step_data in plan_data.steps:
        step = models.FollowUpStep(
            plan_id=plan.id,
            step_order=step_data.step_order,
            delay_minutes_from_previous=step_data.delay_minutes_from_previous,
            channel=step_data.channel,
            template_id=step_data.template_id,
            custom_body=step_data.custom_body
        )
        db.add(step)
    
    await db.commit()
    await db.refresh(plan)
    return plan


async def update_follow_up_plan(
    db: AsyncSession, 
    plan: models.FollowUpPlan, 
    plan_data: schemas.FollowUpPlanUpdate
) -> models.FollowUpPlan:
    update_data = plan_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(plan, field, value)
    await db.commit()
    await db.refresh(plan)
    return plan


async def delete_follow_up_plan(db: AsyncSession, plan: models.FollowUpPlan) -> bool:
    await db.delete(plan)
    await db.commit()
    return True


async def create_default_follow_up_plan(db: AsyncSession, user_id: UUID) -> models.FollowUpPlan:
    """Create a default follow-up plan for a new user"""
    plan = models.FollowUpPlan(
        user_id=user_id,
        name="Standard Follow-up",
        enabled=True
    )
    db.add(plan)
    await db.flush()
    
    # Add steps: 1 hour, 1 day, 3 days
    steps = [
        {"step_order": 1, "delay_minutes_from_previous": 60, "channel": models.MessageChannel.SMS},
        {"step_order": 2, "delay_minutes_from_previous": 1440, "channel": models.MessageChannel.EMAIL},  # 24 hours
        {"step_order": 3, "delay_minutes_from_previous": 4320, "channel": models.MessageChannel.SMS},   # 72 hours
    ]
    
    for step_data in steps:
        step = models.FollowUpStep(plan_id=plan.id, **step_data)
        db.add(step)
    
    await db.commit()
    await db.refresh(plan)
    return plan


# ============= MESSAGE LOG CRUD =============

async def get_message_logs(
    db: AsyncSession, 
    user_id: UUID,
    lead_id: Optional[UUID] = None,
    limit: int = 50,
    offset: int = 0
) -> List[models.MessageLog]:
    query = select(models.MessageLog).where(models.MessageLog.user_id == user_id)
    if lead_id:
        query = query.where(models.MessageLog.lead_id == lead_id)
    query = query.order_by(models.MessageLog.created_at.desc())
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    return result.scalars().all()


async def create_message_log(
    db: AsyncSession,
    user_id: UUID,
    lead_id: Optional[UUID],
    channel: models.MessageChannel,
    to_address: str,
    body: str,
    subject: Optional[str] = None,
    from_address: Optional[str] = None,
    direction: str = "outbound",
    status: models.MessageStatus = models.MessageStatus.PENDING,
    external_id: Optional[str] = None
) -> models.MessageLog:
    log = models.MessageLog(
        user_id=user_id,
        lead_id=lead_id,
        channel=channel,
        direction=direction,
        to_address=to_address,
        from_address=from_address,
        subject=subject,
        body=body,
        status=status,
        external_id=external_id,
        sent_at=datetime.utcnow() if status in [models.MessageStatus.SENT, models.MessageStatus.MOCKED] else None
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


# ============= SCHEDULED SEND CRUD =============

async def get_pending_scheduled_sends(db: AsyncSession, before_time: datetime) -> List[models.ScheduledSend]:
    result = await db.execute(
        select(models.ScheduledSend)
        .where(
            and_(
                models.ScheduledSend.status == models.ScheduledSendStatus.PENDING,
                models.ScheduledSend.due_at_utc <= before_time
            )
        )
        .options(
            selectinload(models.ScheduledSend.lead),
            selectinload(models.ScheduledSend.follow_up_step),
            selectinload(models.ScheduledSend.appointment)
        )
        .order_by(models.ScheduledSend.due_at_utc)
    )
    return result.scalars().all()


async def create_scheduled_send(
    db: AsyncSession,
    user_id: UUID,
    lead_id: UUID,
    entity_type: models.ScheduledEntityType,
    due_at_utc: datetime,
    follow_up_step_id: Optional[UUID] = None,
    appointment_id: Optional[UUID] = None,
    unique_key: Optional[str] = None
) -> Optional[models.ScheduledSend]:
    # Check for duplicate
    if unique_key:
        result = await db.execute(
            select(models.ScheduledSend).where(models.ScheduledSend.unique_key == unique_key)
        )
        if result.scalar_one_or_none():
            return None  # Already scheduled
    
    scheduled = models.ScheduledSend(
        user_id=user_id,
        lead_id=lead_id,
        entity_type=entity_type,
        follow_up_step_id=follow_up_step_id,
        appointment_id=appointment_id,
        due_at_utc=due_at_utc,
        unique_key=unique_key
    )
    db.add(scheduled)
    await db.commit()
    await db.refresh(scheduled)
    return scheduled


async def cancel_scheduled_sends_for_lead(db: AsyncSession, lead_id: UUID) -> int:
    """Cancel all pending scheduled sends for a lead"""
    result = await db.execute(
        select(models.ScheduledSend).where(
            and_(
                models.ScheduledSend.lead_id == lead_id,
                models.ScheduledSend.status == models.ScheduledSendStatus.PENDING
            )
        )
    )
    sends = result.scalars().all()
    count = 0
    for send in sends:
        send.status = models.ScheduledSendStatus.CANCELLED
        count += 1
    await db.commit()
    return count


# ============= SOURCE COST CRUD =============

async def get_source_costs(
    db: AsyncSession, 
    user_id: UUID,
    lead_source_id: Optional[UUID] = None,
    month: Optional[str] = None
) -> List[models.SourceCost]:
    query = select(models.SourceCost).where(models.SourceCost.user_id == user_id)
    if lead_source_id:
        query = query.where(models.SourceCost.lead_source_id == lead_source_id)
    if month:
        query = query.where(models.SourceCost.month == month)
    query = query.order_by(models.SourceCost.month.desc())
    result = await db.execute(query)
    return result.scalars().all()


async def upsert_source_cost(
    db: AsyncSession,
    user_id: UUID,
    cost_data: schemas.SourceCostCreate
) -> models.SourceCost:
    result = await db.execute(
        select(models.SourceCost).where(
            and_(
                models.SourceCost.lead_source_id == cost_data.lead_source_id,
                models.SourceCost.month == cost_data.month
            )
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        existing.cost_cents = cost_data.cost_cents
        existing.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(existing)
        return existing
    
    cost = models.SourceCost(
        user_id=user_id,
        lead_source_id=cost_data.lead_source_id,
        month=cost_data.month,
        cost_cents=cost_data.cost_cents
    )
    db.add(cost)
    await db.commit()
    await db.refresh(cost)
    return cost


# ============= ANALYTICS CRUD =============

async def get_analytics_summary(
    db: AsyncSession,
    user_id: UUID,
    start_date: datetime,
    end_date: datetime
) -> schemas.AnalyticsSummary:
    # Get all lead sources
    sources = await get_lead_sources(db, user_id)
    
    # Get source costs for the period
    month_start = start_date.strftime("%Y-%m")
    month_end = end_date.strftime("%Y-%m")
    costs_result = await db.execute(
        select(models.SourceCost).where(
            and_(
                models.SourceCost.user_id == user_id,
                models.SourceCost.month >= month_start,
                models.SourceCost.month <= month_end
            )
        )
    )
    costs_by_source = {}
    for cost in costs_result.scalars().all():
        source_id = str(cost.lead_source_id)
        costs_by_source[source_id] = costs_by_source.get(source_id, 0) + cost.cost_cents
    
    # Calculate stats per source
    by_source = []
    total_leads = 0
    total_booked = 0
    total_won = 0
    total_lost = 0
    total_revenue = 0
    total_cost = 0
    
    for source in sources:
        # Count leads by status for this source
        leads_result = await db.execute(
            select(
                func.count(models.Lead.id).label('total'),
                func.sum(func.cast(models.Lead.status == models.LeadStatus.NEW, Integer)).label('new'),
                func.sum(func.cast(models.Lead.status == models.LeadStatus.CONTACTED, Integer)).label('contacted'),
                func.sum(func.cast(models.Lead.status == models.LeadStatus.BOOKED, Integer)).label('booked'),
                func.sum(func.cast(models.Lead.status == models.LeadStatus.WON, Integer)).label('won'),
                func.sum(func.cast(models.Lead.status == models.LeadStatus.LOST, Integer)).label('lost'),
                func.coalesce(func.sum(models.Lead.won_value_cents), 0).label('revenue')
            ).where(
                and_(
                    models.Lead.user_id == user_id,
                    models.Lead.lead_source_id == source.id,
                    models.Lead.created_at >= start_date,
                    models.Lead.created_at <= end_date
                )
            )
        )
        stats = leads_result.first()
        
        source_total = stats.total or 0
        source_new = stats.new or 0
        source_contacted = stats.contacted or 0
        source_booked = stats.booked or 0
        source_won = stats.won or 0
        source_lost = stats.lost or 0
        source_revenue = stats.revenue or 0
        source_cost = costs_by_source.get(str(source.id), 0)
        
        # Calculate close rate
        close_rate = 0.0
        if source_won + source_lost > 0:
            close_rate = (source_won / (source_won + source_lost)) * 100
        
        # Calculate ROI
        roi = None
        if source_cost > 0:
            roi = ((source_revenue - source_cost) / source_cost) * 100
        
        by_source.append(schemas.SourceAnalytics(
            source_id=source.id,
            source_name=source.name,
            source_color=source.color,
            total_leads=source_total,
            new_leads=source_new,
            contacted_leads=source_contacted,
            booked_leads=source_booked,
            won_leads=source_won,
            lost_leads=source_lost,
            close_rate=round(close_rate, 1),
            revenue_cents=source_revenue,
            cost_cents=source_cost,
            roi=round(roi, 1) if roi is not None else None
        ))
        
        # Accumulate totals
        total_leads += source_total
        total_booked += source_booked
        total_won += source_won
        total_lost += source_lost
        total_revenue += source_revenue
        total_cost += source_cost
    
    # Calculate overall metrics
    overall_close_rate = 0.0
    if total_won + total_lost > 0:
        overall_close_rate = (total_won / (total_won + total_lost)) * 100
    
    overall_roi = None
    if total_cost > 0:
        overall_roi = ((total_revenue - total_cost) / total_cost) * 100
    
    return schemas.AnalyticsSummary(
        period_start=start_date,
        period_end=end_date,
        total_leads=total_leads,
        total_booked=total_booked,
        total_won=total_won,
        total_lost=total_lost,
        overall_close_rate=round(overall_close_rate, 1),
        total_revenue_cents=total_revenue,
        total_cost_cents=total_cost,
        overall_roi=round(overall_roi, 1) if overall_roi is not None else None,
        by_source=by_source
    )


# Import for Integer cast
from sqlalchemy import Integer
