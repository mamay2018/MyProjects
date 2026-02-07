from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
from uuid import UUID

# ==================== ENUMS ====================

class LeadStatus(str, Enum):
    NEW = "NEW"
    CONTACTED = "CONTACTED"
    BOOKED = "BOOKED"
    WON = "WON"
    LOST = "LOST"

class CaptureType(str, Enum):
    MANUAL = "manual"
    PASTED_TEXT = "pasted_text"
    SCREENSHOT = "screenshot"

class TemplateCategory(str, Enum):
    PLATFORM_COPY = "platform_copy"
    SMS = "sms"
    EMAIL = "email"

class MessageChannel(str, Enum):
    SMS = "sms"
    EMAIL = "email"
    PUSH = "push"

class AppointmentStatus(str, Enum):
    BOOKED = "BOOKED"
    CANCELED = "CANCELED"
    DONE = "DONE"

# ==================== AUTH ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    pro_name: Optional[str] = None
    business_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: UUID
    email: str
    pro_name: Optional[str]
    business_name: Optional[str]
    phone: Optional[str]
    timezone: str
    public_booking_id: Optional[str]
    stripe_subscription_status: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    pro_name: Optional[str] = None
    business_name: Optional[str] = None
    phone: Optional[str] = None
    timezone: Optional[str] = None

# ==================== DEVICES ====================

class DeviceRegister(BaseModel):
    expo_push_token: str
    platform: Optional[str] = None

class DeviceResponse(BaseModel):
    id: int
    expo_push_token: str
    platform: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# ==================== LEAD SOURCES ====================

class LeadSourceCreate(BaseModel):
    name: str

class LeadSourceUpdate(BaseModel):
    name: Optional[str] = None

class LeadSourceResponse(BaseModel):
    id: int
    name: str
    is_default: bool
    created_at: datetime

    class Config:
        from_attributes = True

# ==================== LEADS ====================

class LeadCreate(BaseModel):
    lead_source_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[EmailStr] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    job_type: Optional[str] = None
    notes: Optional[str] = None
    raw_capture_text: Optional[str] = None
    capture_type: CaptureType = CaptureType.MANUAL

class LeadUpdate(BaseModel):
    lead_source_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[EmailStr] = None
    city: Optional[str] = None
    zip_code: Optional[str] = None
    job_type: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[LeadStatus] = None

class LeadResponse(BaseModel):
    id: int
    lead_source_id: Optional[int]
    lead_source_name: Optional[str] = None
    customer_name: Optional[str]
    customer_phone: Optional[str]
    customer_email: Optional[str]
    city: Optional[str]
    zip_code: Optional[str]
    job_type: Optional[str]
    notes: Optional[str]
    raw_capture_text: Optional[str]
    status: LeadStatus
    contacted_at_utc: Optional[datetime]
    booked_at_utc: Optional[datetime]
    closed_at_utc: Optional[datetime]
    won_value_cents: Optional[int]
    followup_active: bool
    created_at: datetime
    next_action: Optional[str] = None

    class Config:
        from_attributes = True

class MarkWonRequest(BaseModel):
    won_value_cents: int

# ==================== TEMPLATES ====================

class TemplateCreate(BaseModel):
    name: str
    category: TemplateCategory
    subject: Optional[str] = None
    body: str

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[TemplateCategory] = None
    subject: Optional[str] = None
    body: Optional[str] = None

class TemplateResponse(BaseModel):
    id: int
    name: str
    category: TemplateCategory
    subject: Optional[str]
    body: str
    is_default: bool
    created_at: datetime

    class Config:
        from_attributes = True

# ==================== AVAILABILITY ====================

class AvailabilityRuleCreate(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time_local: str
    end_time_local: str
    buffer_minutes: int = 30
    slot_duration_minutes: int = 60
    max_appointments_per_day: int = 8
    enabled: bool = True

class AvailabilityRuleResponse(BaseModel):
    id: int
    weekday: int
    start_time_local: str
    end_time_local: str
    buffer_minutes: int
    slot_duration_minutes: int
    max_appointments_per_day: int
    enabled: bool

    class Config:
        from_attributes = True

class AvailabilityUpdate(BaseModel):
    rules: List[AvailabilityRuleCreate]

# ==================== APPOINTMENTS ====================

class AppointmentCreate(BaseModel):
    lead_id: Optional[int] = None
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    start_at_utc: datetime
    end_at_utc: datetime
    location: Optional[str] = None

class AppointmentResponse(BaseModel):
    id: int
    lead_id: Optional[int]
    customer_name: Optional[str]
    customer_phone: Optional[str]
    customer_email: Optional[str]
    start_at_utc: datetime
    end_at_utc: datetime
    location: Optional[str]
    status: AppointmentStatus
    calendar_provider: str
    created_at: datetime

    class Config:
        from_attributes = True

class SlotResponse(BaseModel):
    start_at_utc: datetime
    end_at_utc: datetime
    display_time: str

class BookingRequest(BaseModel):
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    start_at_utc: datetime

# ==================== FOLLOW-UP ====================

class FollowUpStepCreate(BaseModel):
    step_order: int
    delay_minutes: int
    channel: MessageChannel
    message_template: str
    subject: Optional[str] = None
    enabled: bool = True

class FollowUpStepResponse(BaseModel):
    id: int
    step_order: int
    delay_minutes: int
    channel: MessageChannel
    message_template: str
    subject: Optional[str]
    enabled: bool

    class Config:
        from_attributes = True

class FollowUpPlanCreate(BaseModel):
    name: str
    enabled: bool = True
    stop_on_response: bool = True
    steps: List[FollowUpStepCreate]

class FollowUpPlanResponse(BaseModel):
    id: int
    name: str
    enabled: bool
    stop_on_response: bool
    steps: List[FollowUpStepResponse]
    created_at: datetime

    class Config:
        from_attributes = True

class FollowUpPlanUpdate(BaseModel):
    name: Optional[str] = None
    enabled: Optional[bool] = None
    stop_on_response: Optional[bool] = None
    steps: Optional[List[FollowUpStepCreate]] = None

# ==================== ANALYTICS ====================

class SourceAnalytics(BaseModel):
    source_id: int
    source_name: str
    leads_count: int
    contacted_count: int
    bookings_count: int
    won_count: int
    lost_count: int
    close_rate: float
    revenue_cents: int
    cost_cents: int
    roi: Optional[float]
    avg_time_to_contact_hours: Optional[float]
    avg_time_to_booking_hours: Optional[float]

class AnalyticsSummary(BaseModel):
    total_leads: int
    total_contacted: int
    total_bookings: int
    total_won: int
    total_lost: int
    total_revenue_cents: int
    overall_close_rate: float
    by_source: List[SourceAnalytics]

# ==================== SOURCE COSTS ====================

class SourceCostUpdate(BaseModel):
    lead_source_id: int
    month: str  # YYYY-MM
    cost_cents: int

class SourceCostResponse(BaseModel):
    id: int
    lead_source_id: int
    source_name: str
    month: str
    cost_cents: int

    class Config:
        from_attributes = True

# ==================== MESSAGE LOG ====================

class MessageLogResponse(BaseModel):
    id: int
    lead_id: Optional[int]
    appointment_id: Optional[int]
    channel: MessageChannel
    to_value: str
    subject: Optional[str]
    body: str
    status: str
    provider_message_id: Optional[str]
    error: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# ==================== DEBUG ====================

class DebugPushRequest(BaseModel):
    title: str = "Test Push"
    body: str = "This is a test notification"
