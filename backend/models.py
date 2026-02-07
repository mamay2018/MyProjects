"""FollowUp Pro v2 - Database Models"""
import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import (
    Column, String, Integer, BigInteger, Boolean, DateTime, Text, ForeignKey, 
    Enum, UniqueConstraint, Index, Time
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base


# ============= ENUMS =============

class LeadStatus(str, PyEnum):
    NEW = "NEW"
    CONTACTED = "CONTACTED"
    BOOKED = "BOOKED"
    WON = "WON"
    LOST = "LOST"


class CaptureType(str, PyEnum):
    TEXT_PASTE = "TEXT_PASTE"
    SCREENSHOT = "SCREENSHOT"
    EMAIL_FORWARD = "EMAIL_FORWARD"
    MANUAL = "MANUAL"


class TemplateCategory(str, PyEnum):
    SMS = "SMS"
    EMAIL = "EMAIL"
    PLATFORM = "PLATFORM"


class AppointmentStatus(str, PyEnum):
    SCHEDULED = "SCHEDULED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


class MessageChannel(str, PyEnum):
    SMS = "SMS"
    EMAIL = "EMAIL"


class MessageStatus(str, PyEnum):
    PENDING = "PENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"
    MOCKED = "MOCKED"


class ScheduledSendStatus(str, PyEnum):
    PENDING = "PENDING"
    SENT = "SENT"
    CANCELLED = "CANCELLED"
    FAILED = "FAILED"


class ScheduledEntityType(str, PyEnum):
    FOLLOW_UP = "FOLLOW_UP"
    REMINDER = "REMINDER"


# ============= MODELS =============

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    pro_name = Column(String(255), nullable=False)
    business_name = Column(String(255))
    phone = Column(String(20))
    timezone = Column(String(50), default="America/New_York")
    stripe_customer_id = Column(String(255))
    stripe_subscription_id = Column(String(255))
    subscription_status = Column(String(50), default="trialing")
    public_booking_id = Column(String(36), unique=True, default=lambda: str(uuid.uuid4())[:8])
    default_appt_duration_minutes = Column(Integer, default=60)
    buffer_minutes = Column(Integer, default=15)
    daily_appt_limit = Column(Integer, default=8)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    devices = relationship("Device", back_populates="user", cascade="all, delete-orphan")
    lead_sources = relationship("LeadSource", back_populates="user", cascade="all, delete-orphan")
    leads = relationship("Lead", back_populates="user", cascade="all, delete-orphan")
    templates = relationship("Template", back_populates="user", cascade="all, delete-orphan")
    availability_rules = relationship("AvailabilityRule", back_populates="user", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="user", cascade="all, delete-orphan")
    follow_up_plans = relationship("FollowUpPlan", back_populates="user", cascade="all, delete-orphan")
    message_logs = relationship("MessageLog", back_populates="user", cascade="all, delete-orphan")
    source_costs = relationship("SourceCost", back_populates="user", cascade="all, delete-orphan")


class Device(Base):
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expo_push_token = Column(String(255), unique=True, nullable=False)
    platform = Column(String(20))  # ios, android
    device_name = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="devices")


class LeadSource(Base):
    __tablename__ = "lead_sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    is_default = Column(Boolean, default=False)
    color = Column(String(7), default="#6366F1")  # hex color
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="lead_sources")
    leads = relationship("Lead", back_populates="lead_source")
    source_costs = relationship("SourceCost", back_populates="lead_source", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('user_id', 'name', name='uq_user_source_name'),
    )


class Lead(Base):
    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_source_id = Column(UUID(as_uuid=True), ForeignKey("lead_sources.id", ondelete="SET NULL"))
    customer_name = Column(String(255), nullable=False)
    customer_phone = Column(String(20))
    customer_email = Column(String(255))
    status = Column(Enum(LeadStatus), default=LeadStatus.NEW, index=True)
    notes = Column(Text)
    won_value_cents = Column(BigInteger)  # Revenue when WON
    next_action = Column(String(255))  # e.g., "Follow up tomorrow"
    next_action_at = Column(DateTime)
    follow_up_plan_id = Column(UUID(as_uuid=True), ForeignKey("follow_up_plans.id", ondelete="SET NULL"))
    automation_paused = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    contacted_at = Column(DateTime)
    booked_at = Column(DateTime)
    closed_at = Column(DateTime)

    user = relationship("User", back_populates="leads")
    lead_source = relationship("LeadSource", back_populates="leads")
    follow_up_plan = relationship("FollowUpPlan")
    captures = relationship("LeadCapture", back_populates="lead", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="lead", cascade="all, delete-orphan")
    message_logs = relationship("MessageLog", back_populates="lead", cascade="all, delete-orphan")
    scheduled_sends = relationship("ScheduledSend", back_populates="lead", cascade="all, delete-orphan")


class LeadCapture(Base):
    __tablename__ = "lead_captures"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    type = Column(Enum(CaptureType), nullable=False)
    text = Column(Text)
    file_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)

    lead = relationship("Lead", back_populates="captures")


class Template(Base):
    __tablename__ = "templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    category = Column(Enum(TemplateCategory), nullable=False)
    subject = Column(String(255))  # For EMAIL templates
    body = Column(Text, nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="templates")


class AvailabilityRule(Base):
    __tablename__ = "availability_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    weekday = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time_local = Column(Time, nullable=False)
    end_time_local = Column(Time, nullable=False)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="availability_rules")

    __table_args__ = (
        Index('ix_availability_user_weekday', 'user_id', 'weekday'),
    )


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL"))
    start_at_utc = Column(DateTime, nullable=False, index=True)
    end_at_utc = Column(DateTime, nullable=False)
    status = Column(Enum(AppointmentStatus), default=AppointmentStatus.SCHEDULED)
    customer_name = Column(String(255), nullable=False)
    customer_phone = Column(String(20))
    customer_email = Column(String(255))
    notes = Column(Text)
    reminder_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="appointments")
    lead = relationship("Lead", back_populates="appointments")


class FollowUpPlan(Base):
    __tablename__ = "follow_up_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="follow_up_plans")
    steps = relationship("FollowUpStep", back_populates="plan", cascade="all, delete-orphan", order_by="FollowUpStep.step_order")


class FollowUpStep(Base):
    __tablename__ = "follow_up_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("follow_up_plans.id", ondelete="CASCADE"), nullable=False)
    step_order = Column(Integer, nullable=False)
    delay_minutes_from_previous = Column(Integer, nullable=False, default=60)  # e.g., 60 = 1 hour
    channel = Column(Enum(MessageChannel), nullable=False)
    template_id = Column(UUID(as_uuid=True), ForeignKey("templates.id", ondelete="SET NULL"))
    custom_body = Column(Text)  # Override template if set
    created_at = Column(DateTime, default=datetime.utcnow)

    plan = relationship("FollowUpPlan", back_populates="steps")
    template = relationship("Template")

    __table_args__ = (
        UniqueConstraint('plan_id', 'step_order', name='uq_plan_step_order'),
    )


class MessageLog(Base):
    __tablename__ = "message_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL"))
    channel = Column(Enum(MessageChannel), nullable=False)
    direction = Column(String(10), default="outbound")  # outbound, inbound
    to_address = Column(String(255))
    from_address = Column(String(255))
    subject = Column(String(255))
    body = Column(Text, nullable=False)
    status = Column(Enum(MessageStatus), default=MessageStatus.PENDING)
    external_id = Column(String(255))  # Twilio SID or SendGrid ID
    error_message = Column(Text)
    sent_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="message_logs")
    lead = relationship("Lead", back_populates="message_logs")

    __table_args__ = (
        Index('ix_message_log_user_lead', 'user_id', 'lead_id'),
    )


class ScheduledSend(Base):
    __tablename__ = "scheduled_sends"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    entity_type = Column(Enum(ScheduledEntityType), nullable=False)
    follow_up_step_id = Column(UUID(as_uuid=True), ForeignKey("follow_up_steps.id", ondelete="CASCADE"))
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"))
    due_at_utc = Column(DateTime, nullable=False, index=True)
    status = Column(Enum(ScheduledSendStatus), default=ScheduledSendStatus.PENDING, index=True)
    unique_key = Column(String(255), unique=True)  # Prevent duplicate scheduling
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime)

    lead = relationship("Lead", back_populates="scheduled_sends")
    follow_up_step = relationship("FollowUpStep")
    appointment = relationship("Appointment")


class SourceCost(Base):
    __tablename__ = "source_costs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    lead_source_id = Column(UUID(as_uuid=True), ForeignKey("lead_sources.id", ondelete="CASCADE"), nullable=False)
    month = Column(String(7), nullable=False)  # YYYY-MM format
    cost_cents = Column(BigInteger, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="source_costs")
    lead_source = relationship("LeadSource", back_populates="source_costs")

    __table_args__ = (
        UniqueConstraint('lead_source_id', 'month', name='uq_source_month'),
    )
