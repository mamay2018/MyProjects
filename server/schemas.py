from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class LeadStatus(str, Enum):
    NEW = "NEW"
    FOLLOWING_UP = "FOLLOWING_UP"
    REPLIED = "REPLIED"
    WON = "WON"
    LOST = "LOST"
    GHOSTED = "GHOSTED"

class Channel(str, Enum):
    SMS = "SMS"
    EMAIL = "EMAIL"
    BOTH = "BOTH"

class MessageDirection(str, Enum):
    OUTBOUND = "OUTBOUND"
    INBOUND = "INBOUND"

class MessageStatus(str, Enum):
    SENT = "SENT"
    FAILED = "FAILED"
    PENDING = "PENDING"

class SubscriptionStatus(str, Enum):
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    INACTIVE = "inactive"

class SubscriptionPlan(str, Enum):
    SOLO = "SOLO"
    GROWTH = "GROWTH"
    TEAM = "TEAM"

# Auth Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime
    has_business: bool = False
    subscription_status: Optional[str] = None
    subscription_plan: Optional[str] = None

    class Config:
        from_attributes = True

# Business Schemas
class BusinessCreate(BaseModel):
    business_name: str
    owner_name: str
    timezone: str = "America/New_York"
    phone: Optional[str] = None
    email: Optional[EmailStr] = None

class BusinessUpdate(BaseModel):
    business_name: Optional[str] = None
    owner_name: Optional[str] = None
    timezone: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None

class BusinessResponse(BaseModel):
    id: int
    business_name: str
    owner_name: str
    timezone: str
    phone: Optional[str]
    email: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# Lead Schemas
class LeadCreate(BaseModel):
    full_name: str
    phone: str
    email: Optional[EmailStr] = None
    job_type: str
    quote_amount: Optional[float] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    preferred_channel: Channel = Channel.SMS

class LeadUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    job_type: Optional[str] = None
    quote_amount: Optional[float] = None
    status: Optional[LeadStatus] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    preferred_channel: Optional[Channel] = None

class LeadResponse(BaseModel):
    id: int
    full_name: str
    phone: str
    email: Optional[str]
    job_type: str
    quote_amount: Optional[float]
    status: LeadStatus
    tags: Optional[List[str]]
    notes: Optional[str]
    preferred_channel: Channel
    last_contact_at: Optional[datetime]
    next_followup_at: Optional[datetime]
    current_sequence_id: Optional[int]
    current_step_index: int
    created_at: datetime

    class Config:
        from_attributes = True

class AssignSequence(BaseModel):
    sequence_id: int

# Sequence Schemas
class SequenceStepCreate(BaseModel):
    day_offset: int
    channel: Channel
    message_template: str
    email_subject: Optional[str] = None
    step_order: int

class SequenceStepResponse(BaseModel):
    id: int
    day_offset: int
    channel: Channel
    message_template: str
    email_subject: Optional[str]
    step_order: int

    class Config:
        from_attributes = True

class SequenceCreate(BaseModel):
    name: str
    steps: List[SequenceStepCreate]

class SequenceUpdate(BaseModel):
    name: Optional[str] = None
    steps: Optional[List[SequenceStepCreate]] = None

class SequenceResponse(BaseModel):
    id: int
    name: str
    is_builtin: bool
    steps: List[SequenceStepResponse]
    created_at: datetime

    class Config:
        from_attributes = True

# Message Log Schemas
class MessageLogResponse(BaseModel):
    id: int
    lead_id: int
    direction: MessageDirection
    channel: Channel
    body: str
    subject: Optional[str]
    status: MessageStatus
    provider_message_id: Optional[str]
    error: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True

class ManualMessageSend(BaseModel):
    body: str
    channel: Channel = Channel.SMS

# Dashboard Schemas
class DashboardStats(BaseModel):
    todays_followups: int
    hot_leads: int
    pipeline_counts: dict
    money_at_risk: float

# AI Rewrite Schemas
class AIRewriteRequest(BaseModel):
    message: str
    tone: str = "Friendly"  # Friendly, Professional, Urgent
    length: Optional[str] = None  # Shorter, Longer, or None

class AIRewriteResponse(BaseModel):
    original: str
    rewritten: str

# Subscription Schemas
class SubscriptionResponse(BaseModel):
    id: int
    status: SubscriptionStatus
    plan: Optional[SubscriptionPlan]
    active_lead_limit: int
    stripe_customer_id: Optional[str]

    class Config:
        from_attributes = True

class CheckoutSessionResponse(BaseModel):
    checkout_url: str

class CustomerPortalResponse(BaseModel):
    portal_url: str

# Push Token Schema
class PushTokenUpdate(BaseModel):
    expo_push_token: str
