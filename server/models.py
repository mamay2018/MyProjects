import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Boolean, Enum as SQLEnum, BigInteger, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import enum

# ==================== ENUMS ====================

class LeadStatus(str, enum.Enum):
    NEW = "NEW"
    CONTACTED = "CONTACTED"
    BOOKED = "BOOKED"
    WON = "WON"
    LOST = "LOST"

class CaptureType(str, enum.Enum):
    MANUAL = "manual"
    PASTED_TEXT = "pasted_text"
    SCREENSHOT = "screenshot"

class TemplateCategory(str, enum.Enum):
    PLATFORM_COPY = "platform_copy"
    SMS = "sms"
    EMAIL = "email"

class MessageChannel(str, enum.Enum):
    SMS = "sms"
    EMAIL = "email"
    PUSH = "push"

class MessageStatus(str, enum.Enum):
    QUEUED = "queued"
    SENT = "sent"
    FAILED = "failed"

class AppointmentStatus(str, enum.Enum):
    BOOKED = "BOOKED"
    CANCELED = "CANCELED"
    DONE = "DONE"

class CalendarProvider(str, enum.Enum):
    NONE = "none"
    GOOGLE = "google"
    ICS = "ics"

class ScheduledSendStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    SKIPPED = "skipped"

class ScheduledSendEntityType(str, enum.Enum):
    LEAD_FOLLOWUP = "lead_followup"
    APPOINTMENT_REMINDER = "appointment_reminder"

# ==================== MODELS ====================

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    pro_name = Column(String(255), nullable=True)
    business_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    timezone = Column(String(100), default="America/New_York")
    public_booking_id = Column(String(50), unique=True, nullable=True)
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_status = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    devices = relationship("Device", back_populates="user")
    lead_sources = relationship("LeadSource", back_populates="user")
    leads = relationship("Lead", back_populates="user")
    templates = relationship("Template", back_populates="user")
    availability_rules = relationship("AvailabilityRule", back_populates="user")
    appointments = relationship("Appointment", back_populates="user")
    followup_plans = relationship("FollowUpPlan", back_populates="user")
    source_costs = relationship("SourceCost", back_populates="user")

class Device(Base):
    __tablename__ = "devices"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    expo_push_token = Column(String(255), nullable=False)
    platform = Column(String(50), nullable=True)  # ios/android
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_seen = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="devices")

class LeadSource(Base):
    __tablename__ = "lead_sources"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # Null for system defaults
    name = Column(String(100), nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="lead_sources")
    leads = relationship("Lead", back_populates="lead_source")
    costs = relationship("SourceCost", back_populates="lead_source")

class Lead(Base):
    __tablename__ = "leads"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    lead_source_id = Column(Integer, ForeignKey("lead_sources.id"), nullable=True)
    customer_name = Column(String(255), nullable=True)
    customer_phone = Column(String(50), nullable=True)
    customer_email = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    zip_code = Column(String(20), nullable=True)
    job_type = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    raw_capture_text = Column(Text, nullable=True)
    status = Column(SQLEnum(LeadStatus), default=LeadStatus.NEW)
    contacted_at_utc = Column(DateTime(timezone=True), nullable=True)
    booked_at_utc = Column(DateTime(timezone=True), nullable=True)
    closed_at_utc = Column(DateTime(timezone=True), nullable=True)
    won_value_cents = Column(BigInteger, nullable=True)
    followup_active = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="leads")
    lead_source = relationship("LeadSource", back_populates="leads")
    captures = relationship("LeadCapture", back_populates="lead")
    appointments = relationship("Appointment", back_populates="lead")
    message_logs = relationship("MessageLog", back_populates="lead")
    scheduled_sends = relationship("ScheduledSend", back_populates="lead")

class LeadCapture(Base):
    __tablename__ = "lead_captures"
    
    id = Column(Integer, primary_key=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    capture_type = Column(SQLEnum(CaptureType), nullable=False)
    text = Column(Text, nullable=True)
    file_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    lead = relationship("Lead", back_populates="captures")

class Template(Base):
    __tablename__ = "templates"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # Null for system defaults
    name = Column(String(255), nullable=False)
    category = Column(SQLEnum(TemplateCategory), nullable=False)
    subject = Column(String(255), nullable=True)  # For email templates
    body = Column(Text, nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="templates")

class AvailabilityRule(Base):
    __tablename__ = "availability_rules"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    weekday = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time_local = Column(String(10), nullable=False)  # "09:00"
    end_time_local = Column(String(10), nullable=False)  # "17:00"
    buffer_minutes = Column(Integer, default=30)
    slot_duration_minutes = Column(Integer, default=60)
    max_appointments_per_day = Column(Integer, default=8)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="availability_rules")

class Appointment(Base):
    __tablename__ = "appointments"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    customer_name = Column(String(255), nullable=True)
    customer_phone = Column(String(50), nullable=True)
    customer_email = Column(String(255), nullable=True)
    start_at_utc = Column(DateTime(timezone=True), nullable=False)
    end_at_utc = Column(DateTime(timezone=True), nullable=False)
    location = Column(String(500), nullable=True)
    status = Column(SQLEnum(AppointmentStatus), default=AppointmentStatus.BOOKED)
    calendar_provider = Column(SQLEnum(CalendarProvider), default=CalendarProvider.NONE)
    calendar_event_id = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="appointments")
    lead = relationship("Lead", back_populates="appointments")
    message_logs = relationship("MessageLog", back_populates="appointment")
    scheduled_sends = relationship("ScheduledSend", back_populates="appointment")

class FollowUpPlan(Base):
    __tablename__ = "followup_plans"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # Null for system default
    name = Column(String(255), nullable=False)
    enabled = Column(Boolean, default=True)
    stop_on_response = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="followup_plans")
    steps = relationship("FollowUpStep", back_populates="plan", order_by="FollowUpStep.step_order")

class FollowUpStep(Base):
    __tablename__ = "followup_steps"
    
    id = Column(Integer, primary_key=True)
    plan_id = Column(Integer, ForeignKey("followup_plans.id"), nullable=False)
    step_order = Column(Integer, nullable=False)
    delay_minutes = Column(Integer, nullable=False)  # From trigger time
    channel = Column(SQLEnum(MessageChannel), nullable=False)
    message_template = Column(Text, nullable=False)
    subject = Column(String(255), nullable=True)  # For email
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    plan = relationship("FollowUpPlan", back_populates="steps")

class MessageLog(Base):
    __tablename__ = "message_logs"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    channel = Column(SQLEnum(MessageChannel), nullable=False)
    to_value = Column(String(255), nullable=False)  # Phone or email or push token
    subject = Column(String(255), nullable=True)
    body = Column(Text, nullable=False)
    status = Column(SQLEnum(MessageStatus), default=MessageStatus.QUEUED)
    provider_message_id = Column(String(255), nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User")
    lead = relationship("Lead", back_populates="message_logs")
    appointment = relationship("Appointment", back_populates="message_logs")

class ScheduledSend(Base):
    __tablename__ = "scheduled_sends"
    __table_args__ = (UniqueConstraint('unique_key', name='uq_scheduled_send_unique_key'),)
    
    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    entity_type = Column(SQLEnum(ScheduledSendEntityType), nullable=False)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    step_id = Column(Integer, ForeignKey("followup_steps.id"), nullable=True)
    channel = Column(SQLEnum(MessageChannel), nullable=False)
    to_value = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=True)
    body = Column(Text, nullable=False)
    due_at_utc = Column(DateTime(timezone=True), nullable=False)
    sent_at_utc = Column(DateTime(timezone=True), nullable=True)
    status = Column(SQLEnum(ScheduledSendStatus), default=ScheduledSendStatus.PENDING)
    unique_key = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User")
    lead = relationship("Lead", back_populates="scheduled_sends")
    appointment = relationship("Appointment", back_populates="scheduled_sends")
    step = relationship("FollowUpStep")

class SourceCost(Base):
    __tablename__ = "source_costs"
    __table_args__ = (UniqueConstraint('user_id', 'lead_source_id', 'month', name='uq_source_cost_user_source_month'),)
    
    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    lead_source_id = Column(Integer, ForeignKey("lead_sources.id"), nullable=False)
    month = Column(String(7), nullable=False)  # YYYY-MM
    cost_cents = Column(BigInteger, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="source_costs")
    lead_source = relationship("LeadSource", back_populates="costs")
