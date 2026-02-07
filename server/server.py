"""FollowUp Pro v2 - FastAPI Server"""
import os
from datetime import datetime, timedelta
from typing import Optional, List
from uuid import UUID
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from dotenv import load_dotenv

load_dotenv()

import models
import schemas
import crud
from database import get_db, init_db
from auth import (
    get_password_hash, verify_password, create_access_token, 
    get_current_user, oauth2_scheme
)
from services.messaging import MessagingService
from services.push_notifications import PushNotificationService
from services.ics_generator import generate_ics

# Configuration
MOCK_MODE = os.getenv("MOCK_MODE", "true").lower() == "true"
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:8001")
PUBLIC_BOOKING_BASE_URL = os.getenv("PUBLIC_BOOKING_BASE_URL", f"{APP_BASE_URL}/book")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    print(f"\n🚀 FollowUp Pro v2 API started (MOCK_MODE={MOCK_MODE})\n")
    yield
    # Shutdown
    print("\n👋 FollowUp Pro v2 API shutting down\n")


app = FastAPI(
    title="FollowUp Pro v2 API",
    description="API for service professionals to manage leads, follow-ups, and bookings",
    version="2.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============= HEALTH CHECK =============

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "2.0.0",
        "mock_mode": MOCK_MODE,
        "timestamp": datetime.utcnow().isoformat()
    }


# ============= AUTH ENDPOINTS =============

@app.post("/api/auth/register", response_model=schemas.TokenResponse)
async def register(
    user_data: schemas.UserCreate,
    db: AsyncSession = Depends(get_db)
):
    # Check if email exists
    existing = await crud.get_user_by_email(db, user_data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    user = await crud.create_user(db, user_data, hashed_password)
    
    # Create default data for new user
    await crud.create_default_lead_sources(db, user.id)
    await crud.create_default_templates(db, user.id)
    await crud.create_default_availability(db, user.id)
    await crud.create_default_follow_up_plan(db, user.id)
    
    # Generate token
    token = create_access_token(data={"sub": str(user.id)})
    
    return schemas.TokenResponse(
        access_token=token,
        user=schemas.UserResponse.model_validate(user)
    )


@app.post("/api/auth/login", response_model=schemas.TokenResponse)
async def login(
    credentials: schemas.UserLogin,
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_email(db, credentials.email)
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    token = create_access_token(data={"sub": str(user.id)})
    
    return schemas.TokenResponse(
        access_token=token,
        user=schemas.UserResponse.model_validate(user)
    )


@app.get("/api/auth/me", response_model=schemas.UserResponse)
async def get_me(
    current_user: models.User = Depends(get_current_user)
):
    return schemas.UserResponse.model_validate(current_user)


@app.patch("/api/auth/me", response_model=schemas.UserResponse)
async def update_me(
    user_data: schemas.UserUpdate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    updated = await crud.update_user(db, current_user, user_data)
    return schemas.UserResponse.model_validate(updated)


# ============= DEVICE ENDPOINTS =============

@app.post("/api/devices", response_model=schemas.DeviceResponse)
async def register_device(
    device_data: schemas.DeviceRegister,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    device = await crud.register_device(db, current_user.id, device_data)
    return schemas.DeviceResponse.model_validate(device)


@app.get("/api/devices", response_model=List[schemas.DeviceResponse])
async def list_devices(
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    devices = await crud.get_user_devices(db, current_user.id)
    return [schemas.DeviceResponse.model_validate(d) for d in devices]


@app.delete("/api/devices/{device_id}")
async def delete_device(
    device_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    deleted = await crud.delete_device(db, current_user.id, device_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"success": True}


# ============= LEAD SOURCE ENDPOINTS =============

@app.get("/api/lead-sources", response_model=List[schemas.LeadSourceResponse])
async def list_lead_sources(
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    sources = await crud.get_lead_sources(db, current_user.id)
    return [schemas.LeadSourceResponse.model_validate(s) for s in sources]


@app.post("/api/lead-sources", response_model=schemas.LeadSourceResponse)
async def create_lead_source(
    source_data: schemas.LeadSourceCreate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    source = await crud.create_lead_source(db, current_user.id, source_data)
    return schemas.LeadSourceResponse.model_validate(source)


@app.patch("/api/lead-sources/{source_id}", response_model=schemas.LeadSourceResponse)
async def update_lead_source(
    source_id: UUID,
    source_data: schemas.LeadSourceUpdate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    source = await crud.get_lead_source_by_id(db, current_user.id, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Lead source not found")
    updated = await crud.update_lead_source(db, source, source_data)
    return schemas.LeadSourceResponse.model_validate(updated)


@app.delete("/api/lead-sources/{source_id}")
async def delete_lead_source(
    source_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    source = await crud.get_lead_source_by_id(db, current_user.id, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Lead source not found")
    await crud.delete_lead_source(db, source)
    return {"success": True}


# ============= LEAD ENDPOINTS =============

@app.get("/api/leads", response_model=List[schemas.LeadListResponse])
async def list_leads(
    status: Optional[models.LeadStatus] = None,
    source_id: Optional[UUID] = None,
    search: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    leads = await crud.get_leads(db, current_user.id, status, source_id, search, limit, offset)
    return [schemas.LeadListResponse.model_validate(l) for l in leads]


@app.get("/api/leads/{lead_id}", response_model=schemas.LeadResponse)
async def get_lead(
    lead_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    lead = await crud.get_lead_by_id(db, current_user.id, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return schemas.LeadResponse.model_validate(lead)


@app.post("/api/leads", response_model=schemas.LeadResponse)
async def create_lead(
    lead_data: schemas.LeadCreate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    lead = await crud.create_lead(db, current_user.id, lead_data)
    
    # Schedule follow-ups if plan is assigned
    if lead.follow_up_plan_id:
        await schedule_follow_ups_for_lead(db, lead)
    
    # Refresh to get relationships
    lead = await crud.get_lead_by_id(db, current_user.id, lead.id)
    return schemas.LeadResponse.model_validate(lead)


@app.patch("/api/leads/{lead_id}", response_model=schemas.LeadResponse)
async def update_lead(
    lead_id: UUID,
    lead_data: schemas.LeadUpdate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    lead = await crud.get_lead_by_id(db, current_user.id, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Check if status is changing to BOOKED, WON, or LOST - cancel follow-ups
    if lead_data.status and lead_data.status in [
        models.LeadStatus.BOOKED, models.LeadStatus.WON, models.LeadStatus.LOST
    ]:
        await crud.cancel_scheduled_sends_for_lead(db, lead_id)
    
    updated = await crud.update_lead(db, lead, lead_data)
    updated = await crud.get_lead_by_id(db, current_user.id, lead_id)
    return schemas.LeadResponse.model_validate(updated)


@app.delete("/api/leads/{lead_id}")
async def delete_lead(
    lead_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    lead = await crud.get_lead_by_id(db, current_user.id, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    await crud.delete_lead(db, lead)
    return {"success": True}


@app.post("/api/leads/{lead_id}/captures", response_model=schemas.LeadCaptureResponse)
async def add_lead_capture(
    lead_id: UUID,
    capture_data: schemas.LeadCaptureCreate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    lead = await crud.get_lead_by_id(db, current_user.id, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    capture = await crud.add_lead_capture(db, lead_id, capture_data)
    return schemas.LeadCaptureResponse.model_validate(capture)


# ============= TEMPLATE ENDPOINTS =============

@app.get("/api/templates", response_model=List[schemas.TemplateResponse])
async def list_templates(
    category: Optional[models.TemplateCategory] = None,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    templates = await crud.get_templates(db, current_user.id, category)
    return [schemas.TemplateResponse.model_validate(t) for t in templates]


@app.get("/api/templates/{template_id}", response_model=schemas.TemplateResponse)
async def get_template(
    template_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    template = await crud.get_template_by_id(db, current_user.id, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return schemas.TemplateResponse.model_validate(template)


@app.post("/api/templates", response_model=schemas.TemplateResponse)
async def create_template(
    template_data: schemas.TemplateCreate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    template = await crud.create_template(db, current_user.id, template_data)
    return schemas.TemplateResponse.model_validate(template)


@app.patch("/api/templates/{template_id}", response_model=schemas.TemplateResponse)
async def update_template(
    template_id: UUID,
    template_data: schemas.TemplateUpdate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    template = await crud.get_template_by_id(db, current_user.id, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    updated = await crud.update_template(db, template, template_data)
    return schemas.TemplateResponse.model_validate(updated)


@app.delete("/api/templates/{template_id}")
async def delete_template(
    template_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    template = await crud.get_template_by_id(db, current_user.id, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    await crud.delete_template(db, template)
    return {"success": True}


# ============= AVAILABILITY ENDPOINTS =============

@app.get("/api/availability", response_model=List[schemas.AvailabilityRuleResponse])
async def get_availability(
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    rules = await crud.get_availability_rules(db, current_user.id)
    return [schemas.AvailabilityRuleResponse.model_validate(r) for r in rules]


@app.put("/api/availability", response_model=List[schemas.AvailabilityRuleResponse])
async def set_availability(
    rules_data: schemas.AvailabilityBulkUpdate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    rules = await crud.set_availability_rules(db, current_user.id, rules_data)
    return [schemas.AvailabilityRuleResponse.model_validate(r) for r in rules]


# ============= APPOINTMENT ENDPOINTS =============

@app.get("/api/appointments", response_model=List[schemas.AppointmentResponse])
async def list_appointments(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[models.AppointmentStatus] = None,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    appts = await crud.get_appointments(db, current_user.id, start_date, end_date, status)
    return [schemas.AppointmentResponse.model_validate(a) for a in appts]


@app.get("/api/appointments/{appt_id}", response_model=schemas.AppointmentResponse)
async def get_appointment(
    appt_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    appt = await crud.get_appointment_by_id(db, current_user.id, appt_id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return schemas.AppointmentResponse.model_validate(appt)


@app.post("/api/appointments", response_model=schemas.AppointmentResponse)
async def create_appointment(
    appt_data: schemas.AppointmentCreate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    appt = await crud.create_appointment(db, current_user.id, appt_data)
    
    # Update lead status if linked
    if appt_data.lead_id:
        lead = await crud.get_lead_by_id(db, current_user.id, appt_data.lead_id)
        if lead and lead.status in [models.LeadStatus.NEW, models.LeadStatus.CONTACTED]:
            await crud.update_lead(db, lead, schemas.LeadUpdate(status=models.LeadStatus.BOOKED))
    
    return schemas.AppointmentResponse.model_validate(appt)


@app.patch("/api/appointments/{appt_id}", response_model=schemas.AppointmentResponse)
async def update_appointment(
    appt_id: UUID,
    appt_data: schemas.AppointmentUpdate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    appt = await crud.get_appointment_by_id(db, current_user.id, appt_id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    updated = await crud.update_appointment(db, appt, appt_data)
    return schemas.AppointmentResponse.model_validate(updated)


@app.delete("/api/appointments/{appt_id}")
async def delete_appointment(
    appt_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    appt = await crud.get_appointment_by_id(db, current_user.id, appt_id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    await crud.delete_appointment(db, appt)
    return {"success": True}


@app.get("/api/appointments/{appt_id}/ics")
async def get_appointment_ics(
    appt_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    appt = await crud.get_appointment_by_id(db, current_user.id, appt_id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    ics_content = generate_ics(
        summary=f"Appointment with {appt.customer_name}",
        start=appt.start_at_utc,
        end=appt.end_at_utc,
        description=appt.notes or "",
        organizer_name=current_user.pro_name,
        organizer_email=current_user.email
    )
    
    return Response(
        content=ics_content,
        media_type="text/calendar",
        headers={"Content-Disposition": f"attachment; filename=appointment_{appt_id}.ics"}
    )


# ============= FOLLOW-UP PLAN ENDPOINTS =============

@app.get("/api/follow-up-plans", response_model=List[schemas.FollowUpPlanResponse])
async def list_follow_up_plans(
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    plans = await crud.get_follow_up_plans(db, current_user.id)
    return [schemas.FollowUpPlanResponse.model_validate(p) for p in plans]


@app.get("/api/follow-up-plans/{plan_id}", response_model=schemas.FollowUpPlanResponse)
async def get_follow_up_plan(
    plan_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    plan = await crud.get_follow_up_plan_by_id(db, current_user.id, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Follow-up plan not found")
    return schemas.FollowUpPlanResponse.model_validate(plan)


@app.post("/api/follow-up-plans", response_model=schemas.FollowUpPlanResponse)
async def create_follow_up_plan(
    plan_data: schemas.FollowUpPlanCreate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    plan = await crud.create_follow_up_plan(db, current_user.id, plan_data)
    plan = await crud.get_follow_up_plan_by_id(db, current_user.id, plan.id)
    return schemas.FollowUpPlanResponse.model_validate(plan)


@app.patch("/api/follow-up-plans/{plan_id}", response_model=schemas.FollowUpPlanResponse)
async def update_follow_up_plan(
    plan_id: UUID,
    plan_data: schemas.FollowUpPlanUpdate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    plan = await crud.get_follow_up_plan_by_id(db, current_user.id, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Follow-up plan not found")
    updated = await crud.update_follow_up_plan(db, plan, plan_data)
    return schemas.FollowUpPlanResponse.model_validate(updated)


@app.delete("/api/follow-up-plans/{plan_id}")
async def delete_follow_up_plan(
    plan_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    plan = await crud.get_follow_up_plan_by_id(db, current_user.id, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Follow-up plan not found")
    await crud.delete_follow_up_plan(db, plan)
    return {"success": True}


# ============= MESSAGE LOG ENDPOINTS =============

@app.get("/api/messages", response_model=List[schemas.MessageLogResponse])
async def list_messages(
    lead_id: Optional[UUID] = None,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    messages = await crud.get_message_logs(db, current_user.id, lead_id, limit, offset)
    return [schemas.MessageLogResponse.model_validate(m) for m in messages]


# ============= ANALYTICS ENDPOINTS =============

@app.get("/api/analytics/summary", response_model=schemas.AnalyticsSummary)
async def get_analytics_summary(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not start_date:
        start_date = datetime.utcnow() - timedelta(days=30)
    if not end_date:
        end_date = datetime.utcnow()
    
    return await crud.get_analytics_summary(db, current_user.id, start_date, end_date)


@app.get("/api/source-costs", response_model=List[schemas.SourceCostResponse])
async def list_source_costs(
    lead_source_id: Optional[UUID] = None,
    month: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    costs = await crud.get_source_costs(db, current_user.id, lead_source_id, month)
    return [schemas.SourceCostResponse.model_validate(c) for c in costs]


@app.post("/api/source-costs", response_model=schemas.SourceCostResponse)
async def upsert_source_cost(
    cost_data: schemas.SourceCostCreate,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify source belongs to user
    source = await crud.get_lead_source_by_id(db, current_user.id, cost_data.lead_source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Lead source not found")
    cost = await crud.upsert_source_cost(db, current_user.id, cost_data)
    return schemas.SourceCostResponse.model_validate(cost)


# ============= PUBLIC BOOKING ENDPOINTS =============

@app.get("/api/book/{public_id}/slots", response_model=schemas.BookingSlotsResponse)
async def get_booking_slots(
    public_id: str,
    date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_public_booking_id(db, public_id)
    if not user:
        raise HTTPException(status_code=404, detail="Booking page not found")
    
    # Get availability rules
    rules = await crud.get_availability_rules(db, user.id)
    if not rules:
        return schemas.BookingSlotsResponse(
            pro_name=user.pro_name,
            business_name=user.business_name,
            duration_minutes=user.default_appt_duration_minutes,
            slots=[]
        )
    
    # Calculate slots for the next 7 days
    if not date:
        date = datetime.utcnow()
    
    # Get existing appointments
    end_date = date + timedelta(days=7)
    existing_appts = await crud.get_appointments(
        db, user.id, date, end_date, models.AppointmentStatus.SCHEDULED
    )
    
    slots = calculate_available_slots(
        rules=rules,
        existing_appts=existing_appts,
        duration_minutes=user.default_appt_duration_minutes,
        buffer_minutes=user.buffer_minutes,
        daily_limit=user.daily_appt_limit,
        timezone=user.timezone,
        start_date=date,
        days=7
    )
    
    return schemas.BookingSlotsResponse(
        pro_name=user.pro_name,
        business_name=user.business_name,
        duration_minutes=user.default_appt_duration_minutes,
        slots=slots
    )


@app.post("/api/book/{public_id}", response_model=schemas.PublicBookingResponse)
async def create_public_booking(
    public_id: str,
    booking_data: schemas.PublicBookingCreate,
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_public_booking_id(db, public_id)
    if not user:
        raise HTTPException(status_code=404, detail="Booking page not found")
    
    # Calculate end time
    end_at = booking_data.start_at_utc + timedelta(minutes=user.default_appt_duration_minutes)
    
    # Create appointment
    appt_data = schemas.AppointmentCreate(
        start_at_utc=booking_data.start_at_utc,
        end_at_utc=end_at,
        customer_name=booking_data.customer_name,
        customer_phone=booking_data.customer_phone,
        customer_email=booking_data.customer_email,
        notes=booking_data.notes
    )
    appt = await crud.create_appointment(db, user.id, appt_data)
    
    # Generate ICS URL
    ics_url = f"{APP_BASE_URL}/api/book/{public_id}/ics/{appt.id}"
    
    # Send push notification to pro
    push_service = PushNotificationService()
    devices = await crud.get_user_devices(db, user.id)
    if devices:
        await push_service.send_notification(
            tokens=[d.expo_push_token for d in devices],
            title="New Booking!",
            body=f"{booking_data.customer_name} booked an appointment",
            data={"type": "new_booking", "appointment_id": str(appt.id)}
        )
    
    return schemas.PublicBookingResponse(
        appointment_id=appt.id,
        start_at_utc=appt.start_at_utc,
        end_at_utc=appt.end_at_utc,
        pro_name=user.pro_name,
        business_name=user.business_name,
        ics_url=ics_url
    )


@app.get("/api/book/{public_id}/ics/{appt_id}")
async def get_public_booking_ics(
    public_id: str,
    appt_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_public_booking_id(db, public_id)
    if not user:
        raise HTTPException(status_code=404, detail="Booking page not found")
    
    appt = await crud.get_appointment_by_id(db, user.id, appt_id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    ics_content = generate_ics(
        summary=f"Appointment with {user.business_name or user.pro_name}",
        start=appt.start_at_utc,
        end=appt.end_at_utc,
        description=appt.notes or "",
        organizer_name=user.pro_name,
        organizer_email=user.email
    )
    
    return Response(
        content=ics_content,
        media_type="text/calendar",
        headers={"Content-Disposition": f"attachment; filename=appointment.ics"}
    )


# ============= DEBUG ENDPOINTS =============

@app.post("/api/debug/send-push", response_model=schemas.DebugPushResponse)
async def debug_send_push(
    push_data: schemas.DebugPushRequest,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    devices = await crud.get_user_devices(db, current_user.id)
    if not devices:
        return schemas.DebugPushResponse(
            success=False,
            message="No registered devices found",
            tokens_targeted=0,
            mock_mode=MOCK_MODE
        )
    
    push_service = PushNotificationService()
    result = await push_service.send_notification(
        tokens=[d.expo_push_token for d in devices],
        title=push_data.title,
        body=push_data.body,
        data=push_data.data
    )
    
    return schemas.DebugPushResponse(
        success=result["success"],
        message=result.get("message", "Notifications sent"),
        tokens_targeted=len(devices),
        mock_mode=MOCK_MODE
    )


@app.post("/api/debug/trigger-worker", response_model=schemas.DebugWorkerResponse)
async def debug_trigger_worker(
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Manually trigger the background worker to process pending follow-ups and reminders"""
    from services.worker import process_scheduled_sends
    
    result = await process_scheduled_sends(db)
    
    return schemas.DebugWorkerResponse(
        success=True,
        message="Worker executed",
        follow_ups_processed=result.get("follow_ups", 0),
        reminders_processed=result.get("reminders", 0),
        mock_mode=MOCK_MODE
    )


@app.post("/api/debug/inbound-message")
async def debug_inbound_message(
    message_data: schemas.DebugInboundMessage,
    current_user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Simulate receiving an inbound message from a lead"""
    lead = await crud.get_lead_by_id(db, current_user.id, message_data.lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Log the inbound message
    from_address = lead.customer_phone if message_data.channel == models.MessageChannel.SMS else lead.customer_email
    await crud.create_message_log(
        db=db,
        user_id=current_user.id,
        lead_id=lead.id,
        channel=message_data.channel,
        to_address=current_user.phone or current_user.email,
        from_address=from_address,
        body=message_data.body,
        direction="inbound",
        status=models.MessageStatus.MOCKED if MOCK_MODE else models.MessageStatus.DELIVERED
    )
    
    # Cancel pending follow-ups since lead responded
    cancelled = await crud.cancel_scheduled_sends_for_lead(db, lead.id)
    
    # Update lead status to CONTACTED if NEW
    if lead.status == models.LeadStatus.NEW:
        await crud.update_lead(db, lead, schemas.LeadUpdate(status=models.LeadStatus.CONTACTED))
    
    return {
        "success": True,
        "message": "Inbound message recorded",
        "follow_ups_cancelled": cancelled,
        "mock_mode": MOCK_MODE
    }


# ============= HELPER FUNCTIONS =============

def calculate_available_slots(
    rules: List[models.AvailabilityRule],
    existing_appts: List[models.Appointment],
    duration_minutes: int,
    buffer_minutes: int,
    daily_limit: int,
    timezone: str,
    start_date: datetime,
    days: int = 7
) -> List[schemas.BookingSlot]:
    """Calculate available booking slots based on availability rules and existing appointments"""
    from datetime import time
    import pytz
    
    slots = []
    tz = pytz.timezone(timezone)
    
    # Group rules by weekday
    rules_by_day = {}
    for rule in rules:
        if rule.enabled:
            if rule.weekday not in rules_by_day:
                rules_by_day[rule.weekday] = []
            rules_by_day[rule.weekday].append(rule)
    
    # Group existing appointments by date
    appts_by_date = {}
    for appt in existing_appts:
        date_key = appt.start_at_utc.date()
        if date_key not in appts_by_date:
            appts_by_date[date_key] = []
        appts_by_date[date_key].append(appt)
    
    # Generate slots for each day
    current_date = start_date.date()
    for _ in range(days):
        weekday = current_date.weekday()
        
        if weekday in rules_by_day:
            day_appts = appts_by_date.get(current_date, [])
            
            # Check daily limit
            if len(day_appts) >= daily_limit:
                current_date += timedelta(days=1)
                continue
            
            for rule in rules_by_day[weekday]:
                # Generate slots for this rule
                slot_start = datetime.combine(current_date, rule.start_time_local)
                slot_start = tz.localize(slot_start).astimezone(pytz.UTC).replace(tzinfo=None)
                
                slot_end_boundary = datetime.combine(current_date, rule.end_time_local)
                slot_end_boundary = tz.localize(slot_end_boundary).astimezone(pytz.UTC).replace(tzinfo=None)
                
                while slot_start + timedelta(minutes=duration_minutes) <= slot_end_boundary:
                    slot_end = slot_start + timedelta(minutes=duration_minutes)
                    
                    # Check for conflicts with existing appointments
                    has_conflict = False
                    for appt in day_appts:
                        appt_start = appt.start_at_utc - timedelta(minutes=buffer_minutes)
                        appt_end = appt.end_at_utc + timedelta(minutes=buffer_minutes)
                        
                        if not (slot_end <= appt_start or slot_start >= appt_end):
                            has_conflict = True
                            break
                    
                    # Only add future slots
                    if not has_conflict and slot_start > datetime.utcnow():
                        slots.append(schemas.BookingSlot(
                            start_at_utc=slot_start,
                            end_at_utc=slot_end
                        ))
                    
                    slot_start += timedelta(minutes=duration_minutes + buffer_minutes)
        
        current_date += timedelta(days=1)
    
    return slots


async def schedule_follow_ups_for_lead(db: AsyncSession, lead: models.Lead):
    """Schedule follow-up messages for a new lead"""
    if not lead.follow_up_plan_id:
        return
    
    plan = await crud.get_follow_up_plan_by_id(db, lead.user_id, lead.follow_up_plan_id)
    if not plan or not plan.enabled or not plan.steps:
        return
    
    # Schedule each step
    cumulative_delay = 0
    for step in plan.steps:
        cumulative_delay += step.delay_minutes_from_previous
        due_at = datetime.utcnow() + timedelta(minutes=cumulative_delay)
        
        unique_key = f"followup_{lead.id}_{step.id}"
        await crud.create_scheduled_send(
            db=db,
            user_id=lead.user_id,
            lead_id=lead.id,
            entity_type=models.ScheduledEntityType.FOLLOW_UP,
            due_at_utc=due_at,
            follow_up_step_id=step.id,
            unique_key=unique_key
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
