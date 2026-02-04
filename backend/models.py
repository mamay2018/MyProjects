from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Boolean, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum
from datetime import datetime

class LeadStatus(str, enum.Enum):
    NEW = "NEW"
    FOLLOWING_UP = "FOLLOWING_UP"
    REPLIED = "REPLIED"
    WON = "WON"
    LOST = "LOST"
    GHOSTED = "GHOSTED"

class Channel(str, enum.Enum):
    SMS = "SMS"
    EMAIL = "EMAIL"
    BOTH = "BOTH"

class MessageDirection(str, enum.Enum):
    OUTBOUND = "OUTBOUND"
    INBOUND = "INBOUND"

class MessageStatus(str, enum.Enum):
    SENT = "SENT"
    FAILED = "FAILED"
    PENDING = "PENDING"

class SubscriptionStatus(str, enum.Enum):
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    INACTIVE = "inactive"

class SubscriptionPlan(str, enum.Enum):
    SOLO = "SOLO"
    GROWTH = "GROWTH"
    TEAM = "TEAM"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    expo_push_token = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    business = relationship("Business", back_populates="user", uselist=False)
    subscription = relationship("Subscription", back_populates="user", uselist=False)

class Business(Base):
    __tablename__ = "businesses"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    business_name = Column(String(255), nullable=False)
    owner_name = Column(String(255), nullable=False)
    timezone = Column(String(100), default="America/New_York")
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="business")
    leads = relationship("Lead", back_populates="business")
    sequences = relationship("Sequence", back_populates="business")

class Lead(Base):
    __tablename__ = "leads"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=False)
    email = Column(String(255), nullable=True)
    job_type = Column(String(255), nullable=False)
    quote_amount = Column(Float, nullable=True)
    status = Column(SQLEnum(LeadStatus), default=LeadStatus.NEW)
    tags = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    preferred_channel = Column(SQLEnum(Channel), default=Channel.SMS)
    last_contact_at = Column(DateTime(timezone=True), nullable=True)
    next_followup_at = Column(DateTime(timezone=True), nullable=True)
    current_sequence_id = Column(Integer, ForeignKey("sequences.id"), nullable=True)
    current_step_index = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    business = relationship("Business", back_populates="leads")
    sequence = relationship("Sequence")
    message_logs = relationship("MessageLog", back_populates="lead")

class Sequence(Base):
    __tablename__ = "sequences"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id"), nullable=True)  # Null for built-in
    name = Column(String(255), nullable=False)
    is_builtin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    business = relationship("Business", back_populates="sequences")
    steps = relationship("SequenceStep", back_populates="sequence", order_by="SequenceStep.step_order")

class SequenceStep(Base):
    __tablename__ = "sequence_steps"
    
    id = Column(Integer, primary_key=True, index=True)
    sequence_id = Column(Integer, ForeignKey("sequences.id"), nullable=False)
    day_offset = Column(Integer, nullable=False)  # 0, 2, 5, 10, etc.
    channel = Column(SQLEnum(Channel), nullable=False)
    message_template = Column(Text, nullable=False)
    email_subject = Column(String(255), nullable=True)
    step_order = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    sequence = relationship("Sequence", back_populates="steps")

class MessageLog(Base):
    __tablename__ = "message_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=False)
    direction = Column(SQLEnum(MessageDirection), nullable=False)
    channel = Column(SQLEnum(Channel), nullable=False)
    body = Column(Text, nullable=False)
    subject = Column(String(255), nullable=True)  # For emails
    status = Column(SQLEnum(MessageStatus), nullable=False)
    provider_message_id = Column(String(255), nullable=True)
    error = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    lead = relationship("Lead", back_populates="message_logs")

class Subscription(Base):
    __tablename__ = "subscriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    status = Column(SQLEnum(SubscriptionStatus), default=SubscriptionStatus.INACTIVE)
    plan = Column(SQLEnum(SubscriptionPlan), nullable=True)
    active_lead_limit = Column(Integer, default=50)  # Default to SOLO plan limit
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="subscription")
