"""FollowUp Pro v2 - Pydantic Schemas"""
from datetime import datetime, time
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from models import LeadStatus, CaptureType, TemplateCategory, AppointmentStatus, MessageChannel, MessageStatus


# ============= AUTH SCHEMAS =============

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    pro_name: str = Field(..., min_length=1, max_length=255)
    business_name: Optional[str] = None
    phone: Optional[str] = None
    timezone: str = "America/New_York"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    pro_name: Optional[str] = None
    business_name: Optional[str] = None
    phone: Optional[str] = None
    timezone: Optional[str] = None
    default_appt_duration_minutes: Optional[int] = Field(None, ge=15, le=480)
    buffer_minutes: Optional[int] = Field(None, ge=0, le=120)
    daily_appt_limit: Optional[int] = Field(None, ge=1, le=50)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    email: str
    pro_name: str
    business_name: Optional[str]
    phone: Optional[str]
    timezone: str
    public_booking_id: str
    default_appt_duration_minutes: int
    buffer_minutes: int
    daily_appt_limit: int
    subscription_status: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ============= DEVICE SCHEMAS =============

class DeviceRegister(BaseModel):
    expo_push_token: str
    platform: Optional[str] = None
    device_name: Optional[str] = None


class DeviceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    expo_push_token: str
    platform: Optional[str]
    device_name: Optional[str]
    created_at: datetime


# ============= LEAD SOURCE SCHEMAS =============

class LeadSourceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: str = Field(default="#6366F1", pattern=r"^#[0-9A-Fa-f]{6}$")
    is_default: bool = False


class LeadSourceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    color: Optional[str] = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    is_default: Optional[bool] = None


class LeadSourceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str
    color: str
    is_default: bool
    created_at: datetime


# ============= LEAD SCHEMAS =============

class LeadCreate(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=255)
    customer_phone: Optional[str] = None
    customer_email: Optional[EmailStr] = None
    lead_source_id: Optional[UUID] = None
    notes: Optional[str] = None
    follow_up_plan_id: Optional[UUID] = None


class LeadUpdate(BaseModel):
    customer_name: Optional[str] = Field(None, min_length=1, max_length=255)
    customer_phone: Optional[str] = None
    customer_email: Optional[EmailStr] = None
    lead_source_id: Optional[UUID] = None
    status: Optional[LeadStatus] = None
    notes: Optional[str] = None
    won_value_cents: Optional[int] = Field(None, ge=0)
    next_action: Optional[str] = None
    next_action_at: Optional[datetime] = None
    follow_up_plan_id: Optional[UUID] = None
    automation_paused: Optional[bool] = None


class LeadCaptureCreate(BaseModel):
    type: CaptureType
    text: Optional[str] = None
    file_url: Optional[str] = None


class LeadCaptureResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    type: CaptureType
    text: Optional[str]
    file_url: Optional[str]
    created_at: datetime


class LeadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    customer_name: str
    customer_phone: Optional[str]
    customer_email: Optional[str]
    status: LeadStatus
    notes: Optional[str]
    won_value_cents: Optional[int]
    next_action: Optional[str]
    next_action_at: Optional[datetime]
    lead_source_id: Optional[UUID]
    lead_source: Optional[LeadSourceResponse]
    follow_up_plan_id: Optional[UUID]
    automation_paused: bool
    created_at: datetime
    updated_at: datetime
    contacted_at: Optional[datetime]
    booked_at: Optional[datetime]
    closed_at: Optional[datetime]
    captures: List[LeadCaptureResponse] = []


class LeadListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    customer_name: str
    customer_phone: Optional[str]
    status: LeadStatus
    next_action: Optional[str]
    next_action_at: Optional[datetime]
    lead_source: Optional[LeadSourceResponse]
    created_at: datetime
    updated_at: datetime


# ============= TEMPLATE SCHEMAS =============

class TemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: TemplateCategory
    subject: Optional[str] = Field(None, max_length=255)
    body: str = Field(..., min_length=1)
    is_default: bool = False


class TemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[TemplateCategory] = None
    subject: Optional[str] = Field(None, max_length=255)
    body: Optional[str] = None
    is_default: Optional[bool] = None


class TemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str
    category: TemplateCategory
    subject: Optional[str]
    body: str
    is_default: bool
    created_at: datetime
    updated_at: datetime


# ============= AVAILABILITY SCHEMAS =============

class AvailabilityRuleCreate(BaseModel):
    weekday: int = Field(..., ge=0, le=6)  # 0=Monday, 6=Sunday
    start_time_local: time
    end_time_local: time
    enabled: bool = True


class AvailabilityRuleUpdate(BaseModel):
    start_time_local: Optional[time] = None
    end_time_local: Optional[time] = None
    enabled: Optional[bool] = None


class AvailabilityRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    weekday: int
    start_time_local: time
    end_time_local: time
    enabled: bool
    created_at: datetime


class AvailabilityBulkUpdate(BaseModel):
    rules: List[AvailabilityRuleCreate]


# ============= APPOINTMENT SCHEMAS =============

class AppointmentCreate(BaseModel):
    lead_id: Optional[UUID] = None
    start_at_utc: datetime
    end_at_utc: datetime
    customer_name: str = Field(..., min_length=1, max_length=255)
    customer_phone: Optional[str] = None
    customer_email: Optional[EmailStr] = None
    notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    start_at_utc: Optional[datetime] = None
    end_at_utc: Optional[datetime] = None
    status: Optional[AppointmentStatus] = None
    notes: Optional[str] = None


class AppointmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    lead_id: Optional[UUID]
    start_at_utc: datetime
    end_at_utc: datetime
    status: AppointmentStatus
    customer_name: str
    customer_phone: Optional[str]
    customer_email: Optional[str]
    notes: Optional[str]
    reminder_sent: bool
    created_at: datetime
    updated_at: datetime


# ============= PUBLIC BOOKING SCHEMAS =============

class BookingSlot(BaseModel):
    start_at_utc: datetime
    end_at_utc: datetime


class BookingSlotsResponse(BaseModel):
    pro_name: str
    business_name: Optional[str]
    duration_minutes: int
    slots: List[BookingSlot]


class PublicBookingCreate(BaseModel):
    start_at_utc: datetime
    customer_name: str = Field(..., min_length=1, max_length=255)
    customer_phone: Optional[str] = None
    customer_email: Optional[EmailStr] = None
    notes: Optional[str] = None


class PublicBookingResponse(BaseModel):
    appointment_id: UUID
    start_at_utc: datetime
    end_at_utc: datetime
    pro_name: str
    business_name: Optional[str]
    ics_url: str


# ============= FOLLOW-UP PLAN SCHEMAS =============

class FollowUpStepCreate(BaseModel):
    step_order: int = Field(..., ge=1)
    delay_minutes_from_previous: int = Field(..., ge=0)
    channel: MessageChannel
    template_id: Optional[UUID] = None
    custom_body: Optional[str] = None


class FollowUpStepResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    step_order: int
    delay_minutes_from_previous: int
    channel: MessageChannel
    template_id: Optional[UUID]
    custom_body: Optional[str]
    created_at: datetime


class FollowUpPlanCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    enabled: bool = True
    steps: List[FollowUpStepCreate] = []


class FollowUpPlanUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    enabled: Optional[bool] = None


class FollowUpPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    name: str
    enabled: bool
    steps: List[FollowUpStepResponse] = []
    created_at: datetime
    updated_at: datetime


# ============= MESSAGE LOG SCHEMAS =============

class MessageLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    lead_id: Optional[UUID]
    channel: MessageChannel
    direction: str
    to_address: Optional[str]
    from_address: Optional[str]
    subject: Optional[str]
    body: str
    status: MessageStatus
    external_id: Optional[str]
    error_message: Optional[str]
    sent_at: Optional[datetime]
    created_at: datetime


# ============= ANALYTICS SCHEMAS =============

class SourceAnalytics(BaseModel):
    source_id: UUID
    source_name: str
    source_color: str
    total_leads: int
    new_leads: int
    contacted_leads: int
    booked_leads: int
    won_leads: int
    lost_leads: int
    close_rate: float  # won / (won + lost) as percentage
    revenue_cents: int
    cost_cents: int
    roi: Optional[float]  # (revenue - cost) / cost as percentage


class AnalyticsSummary(BaseModel):
    period_start: datetime
    period_end: datetime
    total_leads: int
    total_booked: int
    total_won: int
    total_lost: int
    overall_close_rate: float
    total_revenue_cents: int
    total_cost_cents: int
    overall_roi: Optional[float]
    by_source: List[SourceAnalytics]


class SourceCostCreate(BaseModel):
    lead_source_id: UUID
    month: str = Field(..., pattern=r"^\d{4}-\d{2}$")  # YYYY-MM
    cost_cents: int = Field(..., ge=0)


class SourceCostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    lead_source_id: UUID
    month: str
    cost_cents: int
    created_at: datetime


# ============= DEBUG SCHEMAS =============

class DebugPushRequest(BaseModel):
    title: str = "Test Notification"
    body: str = "This is a test push notification"
    data: Optional[dict] = None


class DebugPushResponse(BaseModel):
    success: bool
    message: str
    tokens_targeted: int
    mock_mode: bool


class DebugWorkerResponse(BaseModel):
    success: bool
    message: str
    follow_ups_processed: int
    reminders_processed: int
    mock_mode: bool


class DebugInboundMessage(BaseModel):
    lead_id: UUID
    channel: MessageChannel
    body: str
