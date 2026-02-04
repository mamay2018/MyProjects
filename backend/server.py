import os
import asyncio
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Request, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from dotenv import load_dotenv
from apscheduler.schedulers.asyncio import AsyncIOScheduler

load_dotenv()

from database import get_db, init_db, async_session_maker
from models import (
    User, Business, Lead, Sequence, SequenceStep, MessageLog, Subscription,
    LeadStatus, Channel, MessageDirection, MessageStatus, SubscriptionStatus, SubscriptionPlan
)
from schemas import (
    UserCreate, UserLogin, Token, UserResponse,
    BusinessCreate, BusinessUpdate, BusinessResponse,
    LeadCreate, LeadUpdate, LeadResponse, AssignSequence,
    SequenceCreate, SequenceUpdate, SequenceResponse, SequenceStepCreate, SequenceStepResponse,
    MessageLogResponse, ManualMessageSend,
    DashboardStats,
    AIRewriteRequest, AIRewriteResponse,
    SubscriptionResponse, CheckoutSessionResponse, CustomerPortalResponse,
    PushTokenUpdate
)
from auth import get_password_hash, verify_password, create_access_token, get_current_user
from services.messaging import send_sms, send_email, replace_template_variables, normalize_phone
from services.ai_rewrite import rewrite_message
from services.stripe_service import (
    create_checkout_session, create_customer_portal_session, 
    verify_webhook_signature, PLAN_CONFIG
)

# Scheduler for background tasks
scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    await seed_builtin_sequences()
    
    # Start the scheduler
    scheduler.add_job(process_followups, 'interval', minutes=1, id='followup_worker')
    scheduler.start()
    
    yield
    
    # Shutdown
    scheduler.shutdown()

app = FastAPI(title="FollowUp Pro API", version="1.0.0", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== SEED DATA ====================

async def seed_builtin_sequences():
    """Seed the built-in sequences if they don't exist"""
    async with async_session_maker() as db:
        # Check if built-in sequences exist
        result = await db.execute(select(Sequence).where(Sequence.is_builtin == True))
        existing = result.scalars().all()
        
        if existing:
            return  # Already seeded
        
        # Friendly Sequence
        friendly = Sequence(
            name="Friendly",
            is_builtin=True,
            business_id=None
        )
        db.add(friendly)
        await db.flush()
        
        friendly_steps = [
            SequenceStep(sequence_id=friendly.id, day_offset=0, channel=Channel.SMS, step_order=0,
                        message_template="Hey {firstName}! Just wanted to follow up on the {jobType} we discussed. Let me know if you have any questions! - {businessName}"),
            SequenceStep(sequence_id=friendly.id, day_offset=2, channel=Channel.EMAIL, step_order=1,
                        email_subject="Quick Follow-up on Your {jobType}",
                        message_template="Hi {firstName},\n\nI hope you're doing well! I wanted to check in about the {jobType} quote I sent over. Happy to answer any questions you might have.\n\nBest,\n{businessName}"),
            SequenceStep(sequence_id=friendly.id, day_offset=5, channel=Channel.SMS, step_order=2,
                        message_template="Hi {firstName}! Still thinking about the {jobType}? I'm here to help whenever you're ready! 😊 - {businessName}"),
        ]
        db.add_all(friendly_steps)
        
        # Professional Sequence
        professional = Sequence(
            name="Professional",
            is_builtin=True,
            business_id=None
        )
        db.add(professional)
        await db.flush()
        
        professional_steps = [
            SequenceStep(sequence_id=professional.id, day_offset=0, channel=Channel.SMS, step_order=0,
                        message_template="Hello {firstName}, this is {businessName}. I'm following up on our {jobType} discussion. Please let me know if you need any additional information."),
            SequenceStep(sequence_id=professional.id, day_offset=3, channel=Channel.EMAIL, step_order=1,
                        email_subject="Follow-up: {jobType} Proposal",
                        message_template="Dear {firstName},\n\nI wanted to follow up regarding the {jobType} proposal for {quoteAmount}. I'm available to discuss any details or answer questions at your convenience.\n\nBest regards,\n{businessName}"),
            SequenceStep(sequence_id=professional.id, day_offset=7, channel=Channel.SMS, step_order=2,
                        message_template="{firstName}, I haven't heard back regarding your {jobType} project. If you have any concerns, please feel free to reach out. - {businessName}"),
        ]
        db.add_all(professional_steps)
        
        # Urgent/Scarcity Sequence
        urgent = Sequence(
            name="Urgent / Scarcity",
            is_builtin=True,
            business_id=None
        )
        db.add(urgent)
        await db.flush()
        
        urgent_steps = [
            SequenceStep(sequence_id=urgent.id, day_offset=0, channel=Channel.SMS, step_order=0,
                        message_template="Hi {firstName}! Quick heads up - we have limited availability for {jobType} this month. Let me know ASAP if you want to secure your spot! - {businessName}"),
            SequenceStep(sequence_id=urgent.id, day_offset=1, channel=Channel.EMAIL, step_order=1,
                        email_subject="⚡ Time-Sensitive: Your {jobType} Quote",
                        message_template="Hi {firstName},\n\nI wanted to let you know that our schedule is filling up fast. Your {quoteAmount} quote for {jobType} is valid for the next few days.\n\nDon't miss out - reply to lock in your spot!\n\n{businessName}"),
            SequenceStep(sequence_id=urgent.id, day_offset=3, channel=Channel.SMS, step_order=2,
                        message_template="Last chance {firstName}! Your {jobType} quote expires soon. Text me back to confirm before we book someone else! - {businessName}"),
        ]
        db.add_all(urgent_steps)
        
        await db.commit()
        print("Built-in sequences seeded successfully!")

# ==================== FOLLOW-UP WORKER ====================

async def process_followups():
    """Background worker to process scheduled follow-ups"""
    async with async_session_maker() as db:
        try:
            now = datetime.utcnow()
            
            # Find leads that need follow-up
            result = await db.execute(
                select(Lead)
                .options(selectinload(Lead.sequence).selectinload(Sequence.steps))
                .options(selectinload(Lead.business))
                .where(
                    and_(
                        Lead.status == LeadStatus.FOLLOWING_UP,
                        Lead.next_followup_at <= now,
                        Lead.current_sequence_id.isnot(None)
                    )
                )
            )
            leads = result.scalars().all()
            
            for lead in leads:
                await send_followup(db, lead)
            
            if leads:
                await db.commit()
                
        except Exception as e:
            print(f"Follow-up worker error: {e}")
            await db.rollback()

async def send_followup(db: AsyncSession, lead: Lead):
    """Send the next follow-up message for a lead"""
    if not lead.sequence or not lead.sequence.steps:
        return
    
    # Get the current step
    steps = sorted(lead.sequence.steps, key=lambda x: x.step_order)
    if lead.current_step_index >= len(steps):
        # Sequence complete - mark as ghosted
        lead.status = LeadStatus.GHOSTED
        lead.next_followup_at = None
        return
    
    current_step = steps[lead.current_step_index]
    
    # Get business data for template
    business_data = {
        'business_name': lead.business.business_name if lead.business else 'Our Team'
    }
    lead_data = {
        'full_name': lead.full_name,
        'job_type': lead.job_type,
        'quote_amount': lead.quote_amount
    }
    
    # Replace template variables
    message_body = replace_template_variables(current_step.message_template, lead_data, business_data)
    
    # Determine which channel to use
    channels_to_send = []
    if lead.preferred_channel == Channel.BOTH:
        channels_to_send = [Channel.SMS, Channel.EMAIL] if current_step.channel == Channel.BOTH else [current_step.channel]
    elif lead.preferred_channel == Channel.SMS and current_step.channel in [Channel.SMS, Channel.BOTH]:
        channels_to_send = [Channel.SMS]
    elif lead.preferred_channel == Channel.EMAIL and current_step.channel in [Channel.EMAIL, Channel.BOTH]:
        channels_to_send = [Channel.EMAIL]
    else:
        channels_to_send = [current_step.channel]
    
    for channel in channels_to_send:
        if channel == Channel.SMS and lead.phone:
            success, msg_id, error = await send_sms(lead.phone, message_body)
            
            log = MessageLog(
                lead_id=lead.id,
                direction=MessageDirection.OUTBOUND,
                channel=Channel.SMS,
                body=message_body,
                status=MessageStatus.SENT if success else MessageStatus.FAILED,
                provider_message_id=msg_id,
                error=error
            )
            db.add(log)
            
        elif channel == Channel.EMAIL and lead.email:
            subject = current_step.email_subject or f"Follow-up: {lead.job_type}"
            subject = replace_template_variables(subject, lead_data, business_data)
            success, msg_id, error = await send_email(lead.email, subject, message_body)
            
            log = MessageLog(
                lead_id=lead.id,
                direction=MessageDirection.OUTBOUND,
                channel=Channel.EMAIL,
                body=message_body,
                subject=subject,
                status=MessageStatus.SENT if success else MessageStatus.FAILED,
                provider_message_id=msg_id,
                error=error
            )
            db.add(log)
    
    # Update lead for next step
    lead.current_step_index += 1
    lead.last_contact_at = datetime.utcnow()
    
    # Schedule next follow-up if there are more steps
    if lead.current_step_index < len(steps):
        next_step = steps[lead.current_step_index]
        days_until_next = next_step.day_offset - current_step.day_offset
        lead.next_followup_at = datetime.utcnow() + timedelta(days=max(days_until_next, 1))
    else:
        # No more steps
        lead.status = LeadStatus.GHOSTED
        lead.next_followup_at = None

# ==================== AUTH ROUTES ====================

@app.post("/api/auth/signup", response_model=Token)
async def signup(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if user exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    user = User(email=user_data.email, password_hash=hashed_password)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Create default subscription (inactive)
    subscription = Subscription(user_id=user.id, status=SubscriptionStatus.INACTIVE)
    db.add(subscription)
    await db.commit()
    
    # Generate token
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/auth/login", response_model=Token)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": user.id})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Get business info
    result = await db.execute(select(Business).where(Business.user_id == current_user.id))
    business = result.scalar_one_or_none()
    
    # Get subscription info
    result = await db.execute(select(Subscription).where(Subscription.user_id == current_user.id))
    subscription = result.scalar_one_or_none()
    
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        created_at=current_user.created_at,
        has_business=business is not None,
        subscription_status=subscription.status.value if subscription else None,
        subscription_plan=subscription.plan.value if subscription and subscription.plan else None
    )

@app.post("/api/auth/push-token")
async def update_push_token(
    data: PushTokenUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    current_user.expo_push_token = data.expo_push_token
    await db.commit()
    return {"status": "ok"}

# ==================== BUSINESS ROUTES ====================

@app.post("/api/business", response_model=BusinessResponse)
async def create_business(
    business_data: BusinessCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check if business exists
    result = await db.execute(select(Business).where(Business.user_id == current_user.id))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Business profile already exists")
    
    business = Business(
        user_id=current_user.id,
        **business_data.model_dump()
    )
    db.add(business)
    await db.commit()
    await db.refresh(business)
    
    return business

@app.get("/api/business", response_model=BusinessResponse)
async def get_business(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Business).where(Business.user_id == current_user.id))
    business = result.scalar_one_or_none()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business profile not found")
    
    return business

@app.put("/api/business", response_model=BusinessResponse)
async def update_business(
    business_data: BusinessUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Business).where(Business.user_id == current_user.id))
    business = result.scalar_one_or_none()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business profile not found")
    
    update_data = business_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(business, key, value)
    
    await db.commit()
    await db.refresh(business)
    
    return business

# ==================== LEAD ROUTES ====================

async def check_lead_limit(db: AsyncSession, user_id: int):
    """Check if user has reached their lead limit"""
    # Get subscription
    result = await db.execute(select(Subscription).where(Subscription.user_id == user_id))
    subscription = result.scalar_one_or_none()
    
    if not subscription:
        limit = 50  # Default limit
    else:
        limit = subscription.active_lead_limit
    
    # Get business
    result = await db.execute(select(Business).where(Business.user_id == user_id))
    business = result.scalar_one_or_none()
    
    if not business:
        return  # No business yet, can't have leads
    
    # Count active leads
    result = await db.execute(
        select(func.count(Lead.id))
        .where(
            and_(
                Lead.business_id == business.id,
                Lead.status.in_([LeadStatus.NEW, LeadStatus.FOLLOWING_UP, LeadStatus.REPLIED])
            )
        )
    )
    active_count = result.scalar() or 0
    
    if active_count >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"Lead limit reached ({limit}). Please upgrade your plan to add more leads."
        )

@app.get("/api/leads", response_model=List[LeadResponse])
async def get_leads(
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Get business
    result = await db.execute(select(Business).where(Business.user_id == current_user.id))
    business = result.scalar_one_or_none()
    
    if not business:
        return []
    
    query = select(Lead).where(Lead.business_id == business.id)
    
    if status:
        query = query.where(Lead.status == status)
    
    if search:
        query = query.where(
            or_(
                Lead.full_name.ilike(f"%{search}%"),
                Lead.phone.ilike(f"%{search}%"),
                Lead.email.ilike(f"%{search}%"),
                Lead.job_type.ilike(f"%{search}%")
            )
        )
    
    query = query.order_by(Lead.created_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()

@app.post("/api/leads", response_model=LeadResponse)
async def create_lead(
    lead_data: LeadCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check lead limit
    await check_lead_limit(db, current_user.id)
    
    # Get business
    result = await db.execute(select(Business).where(Business.user_id == current_user.id))
    business = result.scalar_one_or_none()
    
    if not business:
        raise HTTPException(status_code=400, detail="Create a business profile first")
    
    lead = Lead(
        business_id=business.id,
        **lead_data.model_dump()
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    
    return lead

@app.get("/api/leads/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Business).where(Business.user_id == current_user.id))
    business = result.scalar_one_or_none()
    
    if not business:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    result = await db.execute(
        select(Lead).where(and_(Lead.id == lead_id, Lead.business_id == business.id))
    )
    lead = result.scalar_one_or_none()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    return lead

@app.put("/api/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: int,
    lead_data: LeadUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Business).where(Business.user_id == current_user.id))
    business = result.scalar_one_or_none()
    
    if not business:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    result = await db.execute(
        select(Lead).where(and_(Lead.id == lead_id, Lead.business_id == business.id))
    )
    lead = result.scalar_one_or_none()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    update_data = lead_data.model_dump(exclude_unset=True)
    
    # If status is being changed to WON/LOST/REPLIED, stop automation
    if 'status' in update_data and update_data['status'] in [LeadStatus.WON, LeadStatus.LOST, LeadStatus.REPLIED]:
        lead.next_followup_at = None
        lead.current_sequence_id = None
    
    for key, value in update_data.items():
        setattr(lead, key, value)
    
    await db.commit()
    await db.refresh(lead)
    
    return lead

@app.delete("/api/leads/{lead_id}")
async def delete_lead(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Business).where(Business.user_id == current_user.id))
    business = result.scalar_one_or_none()
    
    if not business:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    result = await db.execute(
        select(Lead).where(and_(Lead.id == lead_id, Lead.business_id == business.id))
    )
    lead = result.scalar_one_or_none()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Delete message logs first
    await db.execute(
        MessageLog.__table__.delete().where(MessageLog.lead_id == lead_id)
    )
    
    await db.delete(lead)
    await db.commit()
    
    return {"status": "deleted"}

@app.post("/api/leads/{lead_id}/assign-sequence", response_model=LeadResponse)
async def assign_sequence_to_lead(
    lead_id: int,
    data: AssignSequence,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Business).where(Business.user_id == current_user.id))
    business = result.scalar_one_or_none()
    
    if not business:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get lead
    result = await db.execute(
        select(Lead).where(and_(Lead.id == lead_id, Lead.business_id == business.id))
    )
    lead = result.scalar_one_or_none()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Verify sequence exists and user has access
    result = await db.execute(
        select(Sequence)
        .options(selectinload(Sequence.steps))
        .where(
            and_(
                Sequence.id == data.sequence_id,
                or_(Sequence.is_builtin == True, Sequence.business_id == business.id)
            )
        )
    )
    sequence = result.scalar_one_or_none()
    
    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found")
    
    # Assign sequence and start automation
    lead.current_sequence_id = sequence.id
    lead.current_step_index = 0
    lead.status = LeadStatus.FOLLOWING_UP
    
    # Schedule first follow-up immediately (or based on first step's day_offset)
    if sequence.steps:
        first_step = sorted(sequence.steps, key=lambda x: x.step_order)[0]
        lead.next_followup_at = datetime.utcnow() + timedelta(days=first_step.day_offset)
    
    await db.commit()
    await db.refresh(lead)
    
    return lead

# ==================== SEQUENCE ROUTES ====================

@app.get("/api/sequences", response_model=List[SequenceResponse])
async def get_sequences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Get business
    result = await db.execute(select(Business).where(Business.user_id == current_user.id))
    business = result.scalar_one_or_none()
    
    # Get built-in sequences + user's custom sequences
    if business:
        query = select(Sequence).options(selectinload(Sequence.steps)).where(
            or_(Sequence.is_builtin == True, Sequence.business_id == business.id)
        )
    else:
        query = select(Sequence).options(selectinload(Sequence.steps)).where(Sequence.is_builtin == True)
    
    result = await db.execute(query)
    sequences = result.scalars().all()
    
    return sequences

@app.post("/api/sequences", response_model=SequenceResponse)
async def create_sequence(
    sequence_data: SequenceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Get business
    result = await db.execute(select(Business).where(Business.user_id == current_user.id))
    business = result.scalar_one_or_none()
    
    if not business:
        raise HTTPException(status_code=400, detail="Create a business profile first")
    
    # Create sequence
    sequence = Sequence(
        business_id=business.id,
        name=sequence_data.name,
        is_builtin=False
    )
    db.add(sequence)
    await db.flush()
    
    # Create steps
    for step_data in sequence_data.steps:
        step = SequenceStep(
            sequence_id=sequence.id,
            **step_data.model_dump()
        )
        db.add(step)
    
    await db.commit()
    
    # Reload with steps
    result = await db.execute(
        select(Sequence).options(selectinload(Sequence.steps)).where(Sequence.id == sequence.id)
    )
    sequence = result.scalar_one()
    
    return sequence

@app.get("/api/sequences/{sequence_id}", response_model=SequenceResponse)
async def get_sequence(
    sequence_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Business).where(Business.user_id == current_user.id))
    business = result.scalar_one_or_none()
    
    result = await db.execute(
        select(Sequence)
        .options(selectinload(Sequence.steps))
        .where(
            and_(
                Sequence.id == sequence_id,
                or_(Sequence.is_builtin == True, Sequence.business_id == (business.id if business else None))
            )
        )
    )
    sequence = result.scalar_one_or_none()
    
    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found")
    
    return sequence

@app.delete("/api/sequences/{sequence_id}")
async def delete_sequence(
    sequence_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Business).where(Business.user_id == current_user.id))
    business = result.scalar_one_or_none()
    
    if not business:
        raise HTTPException(status_code=404, detail="Sequence not found")
    
    result = await db.execute(
        select(Sequence).where(
            and_(Sequence.id == sequence_id, Sequence.business_id == business.id, Sequence.is_builtin == False)
        )
    )
    sequence = result.scalar_one_or_none()
    
    if not sequence:
        raise HTTPException(status_code=404, detail="Sequence not found or cannot delete built-in sequence")
    
    # Delete steps first
    await db.execute(
        SequenceStep.__table__.delete().where(SequenceStep.sequence_id == sequence_id)
    )
    
    await db.delete(sequence)
    await db.commit()
    
    return {"status": "deleted"}

# ==================== MESSAGE/CONVERSATION ROUTES ====================

@app.get("/api/leads/{lead_id}/messages", response_model=List[MessageLogResponse])
async def get_lead_messages(
    lead_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Business).where(Business.user_id == current_user.id))
    business = result.scalar_one_or_none()
    
    if not business:
        return []
    
    # Verify lead belongs to user
    result = await db.execute(
        select(Lead).where(and_(Lead.id == lead_id, Lead.business_id == business.id))
    )
    lead = result.scalar_one_or_none()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    result = await db.execute(
        select(MessageLog)
        .where(MessageLog.lead_id == lead_id)
        .order_by(MessageLog.timestamp.asc())
    )
    
    return result.scalars().all()

@app.post("/api/leads/{lead_id}/messages", response_model=MessageLogResponse)
async def send_manual_message(
    lead_id: int,
    message_data: ManualMessageSend,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Business).where(Business.user_id == current_user.id))
    business = result.scalar_one_or_none()
    
    if not business:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    result = await db.execute(
        select(Lead).where(and_(Lead.id == lead_id, Lead.business_id == business.id))
    )
    lead = result.scalar_one_or_none()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Send message
    if message_data.channel == Channel.SMS:
        success, msg_id, error = await send_sms(lead.phone, message_data.body)
    else:
        success, msg_id, error = await send_email(lead.email or "", "Follow-up", message_data.body)
    
    # Log message
    log = MessageLog(
        lead_id=lead.id,
        direction=MessageDirection.OUTBOUND,
        channel=message_data.channel,
        body=message_data.body,
        status=MessageStatus.SENT if success else MessageStatus.FAILED,
        provider_message_id=msg_id,
        error=error
    )
    db.add(log)
    
    # Update lead
    lead.last_contact_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(log)
    
    return log

# ==================== DASHBOARD ROUTES ====================

@app.get("/api/dashboard", response_model=DashboardStats)
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Business).where(Business.user_id == current_user.id))
    business = result.scalar_one_or_none()
    
    if not business:
        return DashboardStats(
            todays_followups=0,
            hot_leads=0,
            pipeline_counts={status.value: 0 for status in LeadStatus},
            money_at_risk=0
        )
    
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    # Today's follow-ups
    result = await db.execute(
        select(func.count(Lead.id))
        .where(
            and_(
                Lead.business_id == business.id,
                Lead.next_followup_at >= today_start,
                Lead.next_followup_at < today_end
            )
        )
    )
    todays_followups = result.scalar() or 0
    
    # Hot leads (no reply after 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    result = await db.execute(
        select(func.count(Lead.id))
        .where(
            and_(
                Lead.business_id == business.id,
                Lead.status == LeadStatus.FOLLOWING_UP,
                Lead.last_contact_at <= seven_days_ago
            )
        )
    )
    hot_leads = result.scalar() or 0
    
    # Pipeline counts
    pipeline_counts = {}
    for status in LeadStatus:
        result = await db.execute(
            select(func.count(Lead.id))
            .where(and_(Lead.business_id == business.id, Lead.status == status))
        )
        pipeline_counts[status.value] = result.scalar() or 0
    
    # Money at risk
    result = await db.execute(
        select(func.sum(Lead.quote_amount))
        .where(
            and_(
                Lead.business_id == business.id,
                Lead.status.in_([LeadStatus.NEW, LeadStatus.FOLLOWING_UP]),
                Lead.quote_amount.isnot(None)
            )
        )
    )
    money_at_risk = result.scalar() or 0
    
    return DashboardStats(
        todays_followups=todays_followups,
        hot_leads=hot_leads,
        pipeline_counts=pipeline_counts,
        money_at_risk=float(money_at_risk)
    )

# ==================== AI REWRITE ROUTES ====================

@app.post("/api/ai/rewrite", response_model=AIRewriteResponse)
async def ai_rewrite(
    request: AIRewriteRequest,
    current_user: User = Depends(get_current_user)
):
    rewritten = await rewrite_message(request.message, request.tone, request.length)
    return AIRewriteResponse(original=request.message, rewritten=rewritten)

# ==================== SUBSCRIPTION/STRIPE ROUTES ====================

@app.get("/api/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Subscription).where(Subscription.user_id == current_user.id))
    subscription = result.scalar_one_or_none()
    
    if not subscription:
        # Create default subscription
        subscription = Subscription(user_id=current_user.id, status=SubscriptionStatus.INACTIVE)
        db.add(subscription)
        await db.commit()
        await db.refresh(subscription)
    
    return subscription

@app.post("/api/subscription/checkout", response_model=CheckoutSessionResponse)
async def create_checkout(
    plan: str = Query(..., description="Plan: SOLO, GROWTH, or TEAM"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if plan not in PLAN_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    base_url = os.getenv("APP_BASE_URL", "https://followuppro.com")
    success_url = f"{base_url}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{base_url}/subscription/cancel"
    
    checkout_url, error = await create_checkout_session(
        current_user.email,
        plan,
        success_url,
        cancel_url
    )
    
    if error:
        raise HTTPException(status_code=500, detail=error)
    
    return CheckoutSessionResponse(checkout_url=checkout_url)

@app.post("/api/subscription/portal", response_model=CustomerPortalResponse)
async def create_portal(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Subscription).where(Subscription.user_id == current_user.id))
    subscription = result.scalar_one_or_none()
    
    if not subscription or not subscription.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No active subscription found")
    
    base_url = os.getenv("APP_BASE_URL", "https://followuppro.com")
    portal_url, error = await create_customer_portal_session(
        subscription.stripe_customer_id,
        f"{base_url}/settings"
    )
    
    if error:
        raise HTTPException(status_code=500, detail=error)
    
    return CustomerPortalResponse(portal_url=portal_url)

# ==================== TWILIO WEBHOOK ====================

@app.post("/api/webhooks/twilio/sms")
async def twilio_sms_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Handle incoming SMS from Twilio"""
    form_data = await request.form()
    
    from_number = form_data.get("From", "")
    body = form_data.get("Body", "")
    message_sid = form_data.get("MessageSid", "")
    
    if not from_number or not body:
        return {"status": "ignored"}
    
    # Normalize the phone number
    normalized_phone = normalize_phone(from_number)
    
    # Find lead by phone number
    result = await db.execute(
        select(Lead)
        .options(selectinload(Lead.business).selectinload(Business.user))
        .where(Lead.phone.contains(normalized_phone[-10:]))  # Match last 10 digits
    )
    lead = result.scalar_one_or_none()
    
    if not lead:
        print(f"No lead found for phone: {normalized_phone}")
        return {"status": "no_lead_found"}
    
    # Log the inbound message
    log = MessageLog(
        lead_id=lead.id,
        direction=MessageDirection.INBOUND,
        channel=Channel.SMS,
        body=body,
        status=MessageStatus.SENT,
        provider_message_id=message_sid
    )
    db.add(log)
    
    # Stop automation - mark as REPLIED
    if lead.status == LeadStatus.FOLLOWING_UP:
        lead.status = LeadStatus.REPLIED
        lead.next_followup_at = None
    
    lead.last_contact_at = datetime.utcnow()
    
    await db.commit()
    
    # TODO: Send push notification to user
    # if lead.business and lead.business.user and lead.business.user.expo_push_token:
    #     await send_push_notification(lead.business.user.expo_push_token, f"{lead.full_name} replied!")
    
    return {"status": "ok", "lead_id": lead.id}

# ==================== STRIPE WEBHOOK ====================

@app.post("/api/webhooks/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events"""
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    
    event, error = verify_webhook_signature(payload, signature)
    
    if error:
        # In development, try to parse the event directly
        import json
        try:
            event = json.loads(payload)
        except:
            raise HTTPException(status_code=400, detail=error)
    
    if not event:
        return {"status": "ignored"}
    
    event_type = event.get("type") if isinstance(event, dict) else event.type
    
    if event_type == "checkout.session.completed":
        session = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object
        customer_email = session.get("customer_email") or session.get("customer_details", {}).get("email")
        customer_id = session.get("customer")
        subscription_id = session.get("subscription")
        plan = session.get("metadata", {}).get("plan", "SOLO")
        
        # Find user by email
        result = await db.execute(select(User).where(User.email == customer_email))
        user = result.scalar_one_or_none()
        
        if user:
            result = await db.execute(select(Subscription).where(Subscription.user_id == user.id))
            subscription = result.scalar_one_or_none()
            
            if subscription:
                subscription.stripe_customer_id = customer_id
                subscription.stripe_subscription_id = subscription_id
                subscription.status = SubscriptionStatus.ACTIVE
                subscription.plan = SubscriptionPlan(plan)
                subscription.active_lead_limit = PLAN_CONFIG.get(plan, {}).get("lead_limit", 50)
                await db.commit()
    
    elif event_type in ["customer.subscription.updated", "customer.subscription.deleted"]:
        sub_object = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object
        subscription_id = sub_object.get("id")
        status = sub_object.get("status")
        
        result = await db.execute(
            select(Subscription).where(Subscription.stripe_subscription_id == subscription_id)
        )
        subscription = result.scalar_one_or_none()
        
        if subscription:
            if status == "active":
                subscription.status = SubscriptionStatus.ACTIVE
            elif status == "past_due":
                subscription.status = SubscriptionStatus.PAST_DUE
            elif status in ["canceled", "unpaid"]:
                subscription.status = SubscriptionStatus.CANCELED
            await db.commit()
    
    return {"status": "ok"}

# ==================== HEALTH CHECK ====================

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
