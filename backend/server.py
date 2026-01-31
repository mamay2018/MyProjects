from fastapi import FastAPI, APIRouter, HTTPException, Depends, File, UploadFile, Query, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import hashlib
import secrets
import json
import socketio
import base64
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'roadside_services')]

# Create the main app without a prefix
app = FastAPI(title="Roadside Services API", version="1.0.0")

# Socket.IO server
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio, app)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v):
        if isinstance(v, ObjectId):
            return str(v)
        return str(v)

# User Models
class UserCreate(BaseModel):
    phone: str
    role: str = "customer"  # customer, provider, admin
    name: Optional[str] = None
    email: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    phone: str
    role: str
    name: Optional[str] = None
    email: Optional[str] = None
    created_at: datetime

class OTPRequest(BaseModel):
    phone: str

class OTPVerify(BaseModel):
    phone: str
    otp: str

# Provider Profile Models
class ProviderProfileCreate(BaseModel):
    user_id: str
    name: str
    services_offered: List[str]  # gas_delivery, towing, tire_repair, mechanic, car_wash
    vehicle_info: Optional[Dict[str, Any]] = None
    bio: Optional[str] = None

class ProviderProfileResponse(BaseModel):
    id: str
    user_id: str
    name: str
    services_offered: List[str]
    vehicle_info: Optional[Dict[str, Any]] = None
    bio: Optional[str] = None
    is_online: bool = False
    last_location: Optional[Dict[str, float]] = None
    verification_status: Dict[str, str] = {}  # service_type: pending/approved/denied
    rating: float = 0.0
    total_jobs: int = 0
    stripe_connect_id: Optional[str] = None
    created_at: datetime

# Document Models
class DocumentUpload(BaseModel):
    provider_id: str
    doc_type: str  # id, insurance, license, gas_certification
    doc_data: str  # base64 encoded
    service_type: Optional[str] = None

class DocumentResponse(BaseModel):
    id: str
    provider_id: str
    doc_type: str
    service_type: Optional[str] = None
    status: str  # pending, approved, denied
    uploaded_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewer_notes: Optional[str] = None

# Job Models
class JobCreate(BaseModel):
    customer_id: str
    service_type: str  # gas_delivery, towing, tire_repair, mechanic, car_wash
    pickup_location: Dict[str, float]  # lat, lng
    destination_location: Optional[Dict[str, float]] = None
    pickup_address: str
    destination_address: Optional[str] = None
    service_details: Dict[str, Any]  # varies by service type
    estimated_price: float
    notes: Optional[str] = None

class JobResponse(BaseModel):
    id: str
    customer_id: str
    provider_id: Optional[str] = None
    service_type: str
    pickup_location: Dict[str, float]
    destination_location: Optional[Dict[str, float]] = None
    pickup_address: str
    destination_address: Optional[str] = None
    service_details: Dict[str, Any]
    estimated_price: float
    final_price: Optional[float] = None
    platform_fee: Optional[float] = None
    provider_payout: Optional[float] = None
    tip_amount: float = 0.0
    status: str  # pending, matching, accepted, en_route, arrived, in_progress, completed, cancelled
    notes: Optional[str] = None
    proof_photos: List[str] = []
    completion_notes: Optional[str] = None
    payment_status: str = "pending"  # pending, processing, succeeded, failed, refunded
    payment_intent_id: Optional[str] = None
    created_at: datetime
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None

# Job Offer Models
class JobOfferResponse(BaseModel):
    id: str
    job_id: str
    provider_id: str
    status: str  # pending, accepted, declined, expired
    payout_estimate: float
    expires_at: datetime
    created_at: datetime

# Payment Models
class PaymentCreate(BaseModel):
    job_id: str
    amount: float
    payment_method_type: str = "card"  # card, apple_pay, google_pay

class TipCreate(BaseModel):
    job_id: str
    amount: float

# Rating Models
class RatingCreate(BaseModel):
    job_id: str
    from_user_id: str
    to_user_id: str
    rating: int  # 1-5
    comment: Optional[str] = None

# Pricing Config Models
class PricingConfig(BaseModel):
    service_type: str
    base_fee: float
    per_mile_fee: float = 0.0
    surge_multiplier: float = 1.0
    min_fee: float = 0.0
    platform_fee_percent: float = 0.15  # 15%
    gas_max_gallons: int = 10
    enabled: bool = True
    enabled_cities: List[str] = []

# Quote Models
class QuoteRequest(BaseModel):
    service_type: str
    pickup_location: Dict[str, float]
    destination_location: Optional[Dict[str, float]] = None
    service_details: Dict[str, Any]

class QuoteResponse(BaseModel):
    service_type: str
    base_fee: float
    distance_fee: float
    service_fee: float
    platform_fee: float
    total: float
    surge_multiplier: float
    estimated_arrival_minutes: int

# Admin Models
class ProviderApproval(BaseModel):
    provider_id: str
    service_type: str
    approved: bool
    notes: Optional[str] = None

class RefundRequest(BaseModel):
    job_id: str
    amount: float
    reason: str
    is_full_refund: bool = False

# Dispute Models
class DisputeCreate(BaseModel):
    job_id: str
    raised_by: str
    reason: str
    evidence: Optional[str] = None  # base64 image

# ==================== HELPER FUNCTIONS ====================

def generate_otp():
    return str(secrets.randbelow(900000) + 100000)  # 6-digit OTP

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def generate_token(user_id: str) -> str:
    return hashlib.sha256(f"{user_id}{secrets.token_hex(16)}".encode()).hexdigest()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = credentials.credentials
    session = await db.sessions.find_one({"token": token, "expires_at": {"$gt": datetime.utcnow()}})
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user = await db.users.find_one({"_id": ObjectId(session["user_id"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

async def require_role(user: dict, roles: List[str]):
    if user["role"] not in roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

def serialize_doc(doc):
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc

# ==================== AUTH ENDPOINTS ====================

@api_router.get("/")
async def root():
    return {"message": "Roadside Services API v1.0"}

@api_router.post("/auth/send-otp")
async def send_otp(request: OTPRequest):
    """Send OTP to phone number (mock for MVP)"""
    otp = generate_otp()
    
    # Store OTP (expires in 5 minutes)
    await db.otps.update_one(
        {"phone": request.phone},
        {"$set": {
            "otp": otp,
            "expires_at": datetime.utcnow() + timedelta(minutes=5),
            "created_at": datetime.utcnow()
        }},
        upsert=True
    )
    
    # In production, send OTP via SMS (Twilio/Firebase)
    # For MVP, we'll return it (remove in production!)
    logger.info(f"OTP for {request.phone}: {otp}")
    
    return {"success": True, "message": "OTP sent", "otp_for_testing": otp}

@api_router.post("/auth/verify-otp")
async def verify_otp(request: OTPVerify):
    """Verify OTP and login/register user"""
    otp_doc = await db.otps.find_one({
        "phone": request.phone,
        "otp": request.otp,
        "expires_at": {"$gt": datetime.utcnow()}
    })
    
    if not otp_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    
    # Delete used OTP
    await db.otps.delete_one({"_id": otp_doc["_id"]})
    
    # Find or create user
    user = await db.users.find_one({"phone": request.phone})
    
    if not user:
        # Create new user
        user_doc = {
            "phone": request.phone,
            "role": "customer",
            "name": None,
            "email": None,
            "created_at": datetime.utcnow()
        }
        result = await db.users.insert_one(user_doc)
        user_doc["_id"] = result.inserted_id
        user = user_doc
    
    # Create session token
    token = generate_token(str(user["_id"]))
    await db.sessions.insert_one({
        "user_id": str(user["_id"]),
        "token": token,
        "expires_at": datetime.utcnow() + timedelta(days=30),
        "created_at": datetime.utcnow()
    })
    
    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "phone": user["phone"],
            "role": user["role"],
            "name": user.get("name"),
            "email": user.get("email")
        }
    }

@api_router.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user), credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Logout user"""
    await db.sessions.delete_one({"token": credentials.credentials})
    return {"success": True}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Get current user info"""
    return {
        "id": str(user["_id"]),
        "phone": user["phone"],
        "role": user["role"],
        "name": user.get("name"),
        "email": user.get("email")
    }

@api_router.put("/auth/update-profile")
async def update_profile(name: Optional[str] = None, email: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Update user profile"""
    update_data = {}
    if name:
        update_data["name"] = name
    if email:
        update_data["email"] = email
    
    if update_data:
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": update_data}
        )
    
    return {"success": True}

@api_router.put("/auth/set-role")
async def set_role(role: str, user: dict = Depends(get_current_user)):
    """Set user role (customer or provider)"""
    if role not in ["customer", "provider"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"role": role}}
    )
    
    return {"success": True, "role": role}

# ==================== PROVIDER ENDPOINTS ====================

@api_router.post("/providers/profile")
async def create_provider_profile(profile: ProviderProfileCreate, user: dict = Depends(get_current_user)):
    """Create provider profile during onboarding"""
    # Set user role to provider
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"role": "provider", "name": profile.name}}
    )
    
    # Create verification status for each service
    verification_status = {service: "pending" for service in profile.services_offered}
    
    profile_doc = {
        "user_id": str(user["_id"]),
        "name": profile.name,
        "services_offered": profile.services_offered,
        "vehicle_info": profile.vehicle_info,
        "bio": profile.bio,
        "is_online": False,
        "last_location": None,
        "verification_status": verification_status,
        "rating": 0.0,
        "total_jobs": 0,
        "total_earnings": 0.0,
        "stripe_connect_id": None,
        "created_at": datetime.utcnow()
    }
    
    result = await db.provider_profiles.insert_one(profile_doc)
    profile_doc["id"] = str(result.inserted_id)
    
    return serialize_doc(profile_doc)

@api_router.get("/providers/profile")
async def get_provider_profile(user: dict = Depends(get_current_user)):
    """Get current provider's profile"""
    profile = await db.provider_profiles.find_one({"user_id": str(user["_id"])})
    if not profile:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    return serialize_doc(profile)

@api_router.put("/providers/profile")
async def update_provider_profile(
    name: Optional[str] = None,
    services_offered: Optional[List[str]] = None,
    vehicle_info: Optional[Dict[str, Any]] = None,
    bio: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Update provider profile"""
    update_data = {}
    if name:
        update_data["name"] = name
    if services_offered:
        update_data["services_offered"] = services_offered
        # Add pending verification for new services
        profile = await db.provider_profiles.find_one({"user_id": str(user["_id"])})
        if profile:
            current_verification = profile.get("verification_status", {})
            for service in services_offered:
                if service not in current_verification:
                    current_verification[service] = "pending"
            update_data["verification_status"] = current_verification
    if vehicle_info:
        update_data["vehicle_info"] = vehicle_info
    if bio:
        update_data["bio"] = bio
    
    if update_data:
        await db.provider_profiles.update_one(
            {"user_id": str(user["_id"])},
            {"$set": update_data}
        )
    
    return {"success": True}

@api_router.post("/providers/toggle-online")
async def toggle_online(is_online: bool, user: dict = Depends(get_current_user)):
    """Toggle provider online/offline status"""
    await db.provider_profiles.update_one(
        {"user_id": str(user["_id"])},
        {"$set": {"is_online": is_online}}
    )
    
    # Broadcast status change
    await sio.emit('provider_status_changed', {
        "provider_id": str(user["_id"]),
        "is_online": is_online
    })
    
    return {"success": True, "is_online": is_online}

@api_router.post("/providers/update-location")
async def update_provider_location(lat: float, lng: float, user: dict = Depends(get_current_user)):
    """Update provider's current location"""
    location = {"lat": lat, "lng": lng}
    
    await db.provider_profiles.update_one(
        {"user_id": str(user["_id"])},
        {"$set": {"last_location": location, "location_updated_at": datetime.utcnow()}}
    )
    
    # Get provider's active job if any
    active_job = await db.jobs.find_one({
        "provider_id": str(user["_id"]),
        "status": {"$in": ["accepted", "en_route", "arrived", "in_progress"]}
    })
    
    if active_job:
        # Broadcast location to customer
        await sio.emit(f'job_{str(active_job["_id"])}_location', {
            "provider_location": location,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    return {"success": True}

@api_router.post("/providers/documents")
async def upload_document(doc: DocumentUpload, user: dict = Depends(get_current_user)):
    """Upload provider document"""
    doc_record = {
        "provider_id": doc.provider_id,
        "user_id": str(user["_id"]),
        "doc_type": doc.doc_type,
        "doc_data": doc.doc_data,  # base64 encoded
        "service_type": doc.service_type,
        "status": "pending",
        "uploaded_at": datetime.utcnow(),
        "reviewed_at": None,
        "reviewer_notes": None
    }
    
    result = await db.provider_documents.insert_one(doc_record)
    
    return {
        "id": str(result.inserted_id),
        "doc_type": doc.doc_type,
        "status": "pending"
    }

@api_router.get("/providers/documents")
async def get_provider_documents(user: dict = Depends(get_current_user)):
    """Get provider's documents"""
    docs = await db.provider_documents.find({"user_id": str(user["_id"])}).to_list(100)
    return [serialize_doc(doc) for doc in docs]

@api_router.get("/providers/offers")
async def get_job_offers(user: dict = Depends(get_current_user)):
    """Get pending job offers for provider"""
    offers = await db.job_offers.find({
        "provider_id": str(user["_id"]),
        "status": "pending",
        "expires_at": {"$gt": datetime.utcnow()}
    }).to_list(100)
    
    result = []
    for offer in offers:
        job = await db.jobs.find_one({"_id": ObjectId(offer["job_id"])})
        if job:
            offer_data = serialize_doc(offer)
            offer_data["job"] = serialize_doc(job)
            result.append(offer_data)
    
    return result

@api_router.post("/providers/offers/{offer_id}/accept")
async def accept_job_offer(offer_id: str, user: dict = Depends(get_current_user)):
    """Accept a job offer"""
    offer = await db.job_offers.find_one({
        "_id": ObjectId(offer_id),
        "provider_id": str(user["_id"]),
        "status": "pending"
    })
    
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found or already processed")
    
    if offer["expires_at"] < datetime.utcnow():
        await db.job_offers.update_one(
            {"_id": ObjectId(offer_id)},
            {"$set": {"status": "expired"}}
        )
        raise HTTPException(status_code=400, detail="Offer has expired")
    
    # Update offer status
    await db.job_offers.update_one(
        {"_id": ObjectId(offer_id)},
        {"$set": {"status": "accepted", "accepted_at": datetime.utcnow()}}
    )
    
    # Expire other offers for this job
    await db.job_offers.update_many(
        {"job_id": offer["job_id"], "_id": {"$ne": ObjectId(offer_id)}},
        {"$set": {"status": "expired"}}
    )
    
    # Update job with provider
    await db.jobs.update_one(
        {"_id": ObjectId(offer["job_id"])},
        {"$set": {
            "provider_id": str(user["_id"]),
            "status": "accepted",
            "accepted_at": datetime.utcnow()
        }}
    )
    
    job = await db.jobs.find_one({"_id": ObjectId(offer["job_id"])})
    
    # Notify customer
    await sio.emit(f'job_{offer["job_id"]}_update', {
        "status": "accepted",
        "provider_id": str(user["_id"]),
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return {"success": True, "job": serialize_doc(job)}

@api_router.post("/providers/offers/{offer_id}/decline")
async def decline_job_offer(offer_id: str, user: dict = Depends(get_current_user)):
    """Decline a job offer"""
    offer = await db.job_offers.find_one({
        "_id": ObjectId(offer_id),
        "provider_id": str(user["_id"]),
        "status": "pending"
    })
    
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    await db.job_offers.update_one(
        {"_id": ObjectId(offer_id)},
        {"$set": {"status": "declined", "declined_at": datetime.utcnow()}}
    )
    
    return {"success": True}

@api_router.post("/providers/jobs/{job_id}/status")
async def update_job_status(job_id: str, status: str, user: dict = Depends(get_current_user)):
    """Update job status (en_route, arrived, in_progress, completed)"""
    valid_statuses = ["en_route", "arrived", "in_progress", "completed"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    job = await db.jobs.find_one({
        "_id": ObjectId(job_id),
        "provider_id": str(user["_id"])
    })
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    update_data = {"status": status}
    if status == "completed":
        update_data["completed_at"] = datetime.utcnow()
        # Calculate final amounts
        update_data["final_price"] = job["estimated_price"]
        update_data["platform_fee"] = job["estimated_price"] * 0.15
        update_data["provider_payout"] = job["estimated_price"] * 0.85
    
    await db.jobs.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": update_data}
    )
    
    # Broadcast status update
    await sio.emit(f'job_{job_id}_update', {
        "status": status,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return {"success": True, "status": status}

@api_router.post("/providers/jobs/{job_id}/proof")
async def upload_proof_photo(job_id: str, photo_data: str, notes: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Upload proof photo for completed job"""
    job = await db.jobs.find_one({
        "_id": ObjectId(job_id),
        "provider_id": str(user["_id"])
    })
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Save proof photo
    proof_doc = {
        "job_id": job_id,
        "provider_id": str(user["_id"]),
        "photo_data": photo_data,  # base64
        "notes": notes,
        "uploaded_at": datetime.utcnow()
    }
    
    result = await db.job_proofs.insert_one(proof_doc)
    
    # Update job with proof reference
    await db.jobs.update_one(
        {"_id": ObjectId(job_id)},
        {
            "$push": {"proof_photos": str(result.inserted_id)},
            "$set": {"completion_notes": notes}
        }
    )
    
    return {"success": True, "proof_id": str(result.inserted_id)}

@api_router.get("/providers/earnings")
async def get_provider_earnings(user: dict = Depends(get_current_user)):
    """Get provider earnings summary"""
    profile = await db.provider_profiles.find_one({"user_id": str(user["_id"])})
    
    # Get completed jobs
    jobs = await db.jobs.find({
        "provider_id": str(user["_id"]),
        "status": "completed"
    }).to_list(1000)
    
    total_earnings = sum(job.get("provider_payout", 0) for job in jobs)
    total_tips = sum(job.get("tip_amount", 0) for job in jobs)
    total_jobs = len(jobs)
    
    # Get recent jobs
    recent_jobs = await db.jobs.find({
        "provider_id": str(user["_id"]),
        "status": "completed"
    }).sort("completed_at", -1).limit(10).to_list(10)
    
    return {
        "total_earnings": total_earnings,
        "total_tips": total_tips,
        "total_jobs": total_jobs,
        "recent_jobs": [serialize_doc(job) for job in recent_jobs]
    }

@api_router.get("/providers/active-job")
async def get_provider_active_job(user: dict = Depends(get_current_user)):
    """Get provider's current active job"""
    job = await db.jobs.find_one({
        "provider_id": str(user["_id"]),
        "status": {"$in": ["accepted", "en_route", "arrived", "in_progress"]}
    })
    
    if not job:
        return None
    
    # Get customer info
    customer = await db.users.find_one({"_id": ObjectId(job["customer_id"])})
    job_data = serialize_doc(job)
    if customer:
        job_data["customer"] = {
            "id": str(customer["_id"]),
            "name": customer.get("name", "Customer"),
            "phone": customer.get("phone")
        }
    
    return job_data

# ==================== CUSTOMER/JOB ENDPOINTS ====================

@api_router.post("/quote")
async def get_quote(request: QuoteRequest):
    """Get price quote for a service"""
    # Get pricing config
    config = await db.pricing_configs.find_one({"service_type": request.service_type})
    
    if not config:
        # Default pricing
        config = {
            "base_fee": 25.0,
            "per_mile_fee": 2.0,
            "surge_multiplier": 1.0,
            "platform_fee_percent": 0.15
        }
    
    base_fee = config.get("base_fee", 25.0)
    distance_fee = 0.0
    service_fee = 0.0
    
    # Calculate distance fee if destination provided
    if request.destination_location:
        # Simple distance calculation (in production use Google Maps API)
        from math import radians, sin, cos, sqrt, atan2
        
        lat1, lon1 = radians(request.pickup_location["lat"]), radians(request.pickup_location["lng"])
        lat2, lon2 = radians(request.destination_location["lat"]), radians(request.destination_location["lng"])
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        distance_miles = 3959 * c  # Earth radius in miles
        
        distance_fee = distance_miles * config.get("per_mile_fee", 2.0)
    
    # Calculate service-specific fees
    if request.service_type == "gas_delivery":
        gallons = request.service_details.get("gallons", 5)
        fuel_type = request.service_details.get("fuel_type", "regular")
        
        # Fuel prices (mock - would come from API in production)
        fuel_prices = {
            "regular": 3.50,
            "mid": 4.00,
            "premium": 4.50,
            "diesel": 4.25
        }
        
        service_fee = gallons * fuel_prices.get(fuel_type, 3.50)
    
    subtotal = base_fee + distance_fee + service_fee
    surge_multiplier = config.get("surge_multiplier", 1.0)
    subtotal_with_surge = subtotal * surge_multiplier
    platform_fee = subtotal_with_surge * config.get("platform_fee_percent", 0.15)
    total = subtotal_with_surge + platform_fee
    
    return {
        "service_type": request.service_type,
        "base_fee": base_fee,
        "distance_fee": round(distance_fee, 2),
        "service_fee": round(service_fee, 2),
        "platform_fee": round(platform_fee, 2),
        "total": round(total, 2),
        "surge_multiplier": surge_multiplier,
        "estimated_arrival_minutes": 15  # Would be calculated based on provider locations
    }

@api_router.post("/jobs")
async def create_job(job: JobCreate, user: dict = Depends(get_current_user)):
    """Create a new job request"""
    job_doc = {
        "customer_id": str(user["_id"]),
        "provider_id": None,
        "service_type": job.service_type,
        "pickup_location": job.pickup_location,
        "destination_location": job.destination_location,
        "pickup_address": job.pickup_address,
        "destination_address": job.destination_address,
        "service_details": job.service_details,
        "estimated_price": job.estimated_price,
        "final_price": None,
        "platform_fee": None,
        "provider_payout": None,
        "tip_amount": 0.0,
        "status": "pending",
        "notes": job.notes,
        "proof_photos": [],
        "completion_notes": None,
        "payment_status": "pending",
        "payment_intent_id": None,
        "created_at": datetime.utcnow(),
        "accepted_at": None,
        "completed_at": None,
        "cancelled_at": None,
        "cancellation_reason": None
    }
    
    result = await db.jobs.insert_one(job_doc)
    job_doc["id"] = str(result.inserted_id)
    
    return serialize_doc(job_doc)

@api_router.get("/jobs/{job_id}")
async def get_job(job_id: str, user: dict = Depends(get_current_user)):
    """Get job details"""
    job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check access
    if str(user["_id"]) != job["customer_id"] and str(user["_id"]) != job.get("provider_id") and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    job_data = serialize_doc(job)
    
    # Add provider info if assigned
    if job.get("provider_id"):
        provider_profile = await db.provider_profiles.find_one({"user_id": job["provider_id"]})
        if provider_profile:
            job_data["provider"] = {
                "id": provider_profile["user_id"],
                "name": provider_profile["name"],
                "rating": provider_profile.get("rating", 0),
                "vehicle_info": provider_profile.get("vehicle_info"),
                "location": provider_profile.get("last_location")
            }
    
    return job_data

@api_router.post("/jobs/{job_id}/dispatch")
async def dispatch_job(job_id: str, user: dict = Depends(get_current_user)):
    """Start dispatching job to providers"""
    job = await db.jobs.find_one({"_id": ObjectId(job_id), "customer_id": str(user["_id"])})
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["status"] != "pending":
        raise HTTPException(status_code=400, detail="Job already dispatched")
    
    # Update job status
    await db.jobs.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": {"status": "matching"}}
    )
    
    # Find available providers
    providers = await db.provider_profiles.find({
        "is_online": True,
        f"verification_status.{job['service_type']}": "approved",
        "last_location": {"$ne": None}
    }).to_list(50)
    
    # Create job offers (batch of 3 at a time)
    offers_created = 0
    for provider in providers[:3]:
        offer_doc = {
            "job_id": job_id,
            "provider_id": provider["user_id"],
            "status": "pending",
            "payout_estimate": job["estimated_price"] * 0.85,
            "expires_at": datetime.utcnow() + timedelta(seconds=60),
            "created_at": datetime.utcnow()
        }
        
        await db.job_offers.insert_one(offer_doc)
        offers_created += 1
        
        # Notify provider via Socket.IO
        await sio.emit(f'provider_{provider["user_id"]}_offer', {
            "job_id": job_id,
            "service_type": job["service_type"],
            "pickup_address": job["pickup_address"],
            "payout_estimate": job["estimated_price"] * 0.85,
            "expires_in": 60
        })
    
    return {
        "success": True,
        "status": "matching",
        "offers_sent": offers_created
    }

@api_router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str, reason: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Cancel a job"""
    job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check if user can cancel
    if str(user["_id"]) != job["customer_id"] and user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Cannot cancel this job")
    
    # Check if job can be cancelled
    if job["status"] in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Job cannot be cancelled")
    
    await db.jobs.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.utcnow(),
            "cancellation_reason": reason
        }}
    )
    
    # Notify provider if assigned
    if job.get("provider_id"):
        await sio.emit(f'provider_{job["provider_id"]}_job_cancelled', {
            "job_id": job_id
        })
    
    return {"success": True}

@api_router.get("/jobs")
async def get_customer_jobs(
    status: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    user: dict = Depends(get_current_user)
):
    """Get customer's jobs history"""
    query = {"customer_id": str(user["_id"])}
    if status:
        query["status"] = status
    
    jobs = await db.jobs.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return [serialize_doc(job) for job in jobs]

@api_router.post("/jobs/{job_id}/tip")
async def add_tip(job_id: str, tip: TipCreate, user: dict = Depends(get_current_user)):
    """Add tip to completed job"""
    job = await db.jobs.find_one({
        "_id": ObjectId(job_id),
        "customer_id": str(user["_id"]),
        "status": "completed"
    })
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not completed")
    
    await db.jobs.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": {"tip_amount": tip.amount}}
    )
    
    return {"success": True, "tip_amount": tip.amount}

@api_router.post("/jobs/{job_id}/rate")
async def rate_job(job_id: str, rating: RatingCreate, user: dict = Depends(get_current_user)):
    """Rate a completed job"""
    job = await db.jobs.find_one({
        "_id": ObjectId(job_id),
        "status": "completed"
    })
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not completed")
    
    rating_doc = {
        "job_id": job_id,
        "from_user_id": str(user["_id"]),
        "to_user_id": rating.to_user_id,
        "rating": rating.rating,
        "comment": rating.comment,
        "created_at": datetime.utcnow()
    }
    
    await db.ratings.insert_one(rating_doc)
    
    # Update provider rating
    if rating.to_user_id:
        ratings = await db.ratings.find({"to_user_id": rating.to_user_id}).to_list(1000)
        if ratings:
            avg_rating = sum(r["rating"] for r in ratings) / len(ratings)
            await db.provider_profiles.update_one(
                {"user_id": rating.to_user_id},
                {"$set": {"rating": round(avg_rating, 2)}}
            )
    
    return {"success": True}

# ==================== ADMIN ENDPOINTS ====================

@api_router.get("/admin/providers/verification-queue")
async def get_verification_queue(user: dict = Depends(get_current_user)):
    """Get providers pending verification"""
    await require_role(user, ["admin"])
    
    # Get providers with pending verifications
    providers = await db.provider_profiles.find({
        "$or": [
            {"verification_status.gas_delivery": "pending"},
            {"verification_status.towing": "pending"},
            {"verification_status.tire_repair": "pending"},
            {"verification_status.mechanic": "pending"},
            {"verification_status.car_wash": "pending"}
        ]
    }).to_list(100)
    
    result = []
    for provider in providers:
        provider_data = serialize_doc(provider)
        # Get documents
        docs = await db.provider_documents.find({"provider_id": provider_data["id"]}).to_list(100)
        provider_data["documents"] = [serialize_doc(doc) for doc in docs]
        result.append(provider_data)
    
    return result

@api_router.post("/admin/providers/approve")
async def approve_provider(approval: ProviderApproval, user: dict = Depends(get_current_user)):
    """Approve or deny provider for a service"""
    await require_role(user, ["admin"])
    
    status = "approved" if approval.approved else "denied"
    
    await db.provider_profiles.update_one(
        {"_id": ObjectId(approval.provider_id)},
        {"$set": {f"verification_status.{approval.service_type}": status}}
    )
    
    # Log audit
    await db.audit_logs.insert_one({
        "action": "provider_approval",
        "admin_id": str(user["_id"]),
        "provider_id": approval.provider_id,
        "service_type": approval.service_type,
        "approved": approval.approved,
        "notes": approval.notes,
        "created_at": datetime.utcnow()
    })
    
    return {"success": True, "status": status}

@api_router.get("/admin/jobs")
async def get_all_jobs(
    status: Optional[str] = None,
    service_type: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    user: dict = Depends(get_current_user)
):
    """Get all jobs (admin)"""
    await require_role(user, ["admin"])
    
    query = {}
    if status:
        query["status"] = status
    if service_type:
        query["service_type"] = service_type
    
    jobs = await db.jobs.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    return [serialize_doc(job) for job in jobs]

@api_router.get("/admin/jobs/live")
async def get_live_jobs(user: dict = Depends(get_current_user)):
    """Get active jobs for live operations view"""
    await require_role(user, ["admin"])
    
    jobs = await db.jobs.find({
        "status": {"$in": ["pending", "matching", "accepted", "en_route", "arrived", "in_progress"]}
    }).to_list(100)
    
    result = []
    for job in jobs:
        job_data = serialize_doc(job)
        
        # Get customer info
        customer = await db.users.find_one({"_id": ObjectId(job["customer_id"])})
        if customer:
            job_data["customer"] = {"name": customer.get("name"), "phone": customer.get("phone")}
        
        # Get provider info if assigned
        if job.get("provider_id"):
            provider_profile = await db.provider_profiles.find_one({"user_id": job["provider_id"]})
            if provider_profile:
                job_data["provider"] = {
                    "name": provider_profile["name"],
                    "location": provider_profile.get("last_location")
                }
        
        result.append(job_data)
    
    return result

@api_router.post("/admin/jobs/{job_id}/reassign")
async def reassign_job(job_id: str, user: dict = Depends(get_current_user)):
    """Reassign job to new provider"""
    await require_role(user, ["admin"])
    
    job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Reset job to matching status
    old_provider_id = job.get("provider_id")
    
    await db.jobs.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": {
            "status": "matching",
            "provider_id": None,
            "accepted_at": None
        }}
    )
    
    # Notify old provider
    if old_provider_id:
        await sio.emit(f'provider_{old_provider_id}_job_reassigned', {"job_id": job_id})
    
    # Log audit
    await db.audit_logs.insert_one({
        "action": "job_reassign",
        "admin_id": str(user["_id"]),
        "job_id": job_id,
        "old_provider_id": old_provider_id,
        "created_at": datetime.utcnow()
    })
    
    return {"success": True}

@api_router.post("/admin/refunds")
async def process_refund(refund: RefundRequest, user: dict = Depends(get_current_user)):
    """Process a refund"""
    await require_role(user, ["admin"])
    
    job = await db.jobs.find_one({"_id": ObjectId(refund.job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    refund_doc = {
        "job_id": refund.job_id,
        "amount": refund.amount,
        "reason": refund.reason,
        "is_full_refund": refund.is_full_refund,
        "processed_by": str(user["_id"]),
        "status": "processed",
        "created_at": datetime.utcnow()
    }
    
    await db.refunds.insert_one(refund_doc)
    
    # Update job payment status
    await db.jobs.update_one(
        {"_id": ObjectId(refund.job_id)},
        {"$set": {"payment_status": "refunded" if refund.is_full_refund else "partial_refund"}}
    )
    
    # Log audit
    await db.audit_logs.insert_one({
        "action": "refund_processed",
        "admin_id": str(user["_id"]),
        "job_id": refund.job_id,
        "amount": refund.amount,
        "is_full": refund.is_full_refund,
        "reason": refund.reason,
        "created_at": datetime.utcnow()
    })
    
    return {"success": True, "refund_amount": refund.amount}

@api_router.get("/admin/pricing")
async def get_pricing_configs(user: dict = Depends(get_current_user)):
    """Get all pricing configurations"""
    await require_role(user, ["admin"])
    
    configs = await db.pricing_configs.find().to_list(100)
    return [serialize_doc(config) for config in configs]

@api_router.post("/admin/pricing")
async def update_pricing_config(config: PricingConfig, user: dict = Depends(get_current_user)):
    """Update pricing configuration"""
    await require_role(user, ["admin"])
    
    await db.pricing_configs.update_one(
        {"service_type": config.service_type},
        {"$set": config.dict()},
        upsert=True
    )
    
    return {"success": True}

@api_router.get("/admin/analytics")
async def get_analytics(user: dict = Depends(get_current_user)):
    """Get analytics summary"""
    await require_role(user, ["admin"])
    
    # Total jobs by status
    total_jobs = await db.jobs.count_documents({})
    completed_jobs = await db.jobs.count_documents({"status": "completed"})
    cancelled_jobs = await db.jobs.count_documents({"status": "cancelled"})
    active_jobs = await db.jobs.count_documents({"status": {"$in": ["pending", "matching", "accepted", "en_route", "arrived", "in_progress"]}})
    
    # Revenue
    completed_jobs_list = await db.jobs.find({"status": "completed"}).to_list(10000)
    total_revenue = sum(job.get("final_price", 0) for job in completed_jobs_list)
    total_platform_fees = sum(job.get("platform_fee", 0) for job in completed_jobs_list)
    total_provider_payouts = sum(job.get("provider_payout", 0) for job in completed_jobs_list)
    
    # Users
    total_customers = await db.users.count_documents({"role": "customer"})
    total_providers = await db.users.count_documents({"role": "provider"})
    online_providers = await db.provider_profiles.count_documents({"is_online": True})
    
    # Jobs by service type
    jobs_by_service = {}
    for service in ["gas_delivery", "towing", "tire_repair", "mechanic", "car_wash"]:
        count = await db.jobs.count_documents({"service_type": service})
        jobs_by_service[service] = count
    
    return {
        "jobs": {
            "total": total_jobs,
            "completed": completed_jobs,
            "cancelled": cancelled_jobs,
            "active": active_jobs,
            "completion_rate": round(completed_jobs / total_jobs * 100, 2) if total_jobs > 0 else 0,
            "by_service": jobs_by_service
        },
        "revenue": {
            "total": round(total_revenue, 2),
            "platform_fees": round(total_platform_fees, 2),
            "provider_payouts": round(total_provider_payouts, 2)
        },
        "users": {
            "total_customers": total_customers,
            "total_providers": total_providers,
            "online_providers": online_providers
        }
    }

@api_router.get("/admin/disputes")
async def get_disputes(user: dict = Depends(get_current_user)):
    """Get all disputes"""
    await require_role(user, ["admin"])
    
    disputes = await db.disputes.find().sort("created_at", -1).to_list(100)
    return [serialize_doc(d) for d in disputes]

@api_router.post("/disputes")
async def create_dispute(dispute: DisputeCreate, user: dict = Depends(get_current_user)):
    """Create a dispute"""
    dispute_doc = {
        "job_id": dispute.job_id,
        "raised_by": str(user["_id"]),
        "reason": dispute.reason,
        "evidence": dispute.evidence,
        "status": "open",
        "created_at": datetime.utcnow(),
        "resolved_at": None,
        "resolution": None
    }
    
    result = await db.disputes.insert_one(dispute_doc)
    return {"id": str(result.inserted_id), "status": "open"}

@api_router.post("/admin/disputes/{dispute_id}/resolve")
async def resolve_dispute(dispute_id: str, resolution: str, user: dict = Depends(get_current_user)):
    """Resolve a dispute"""
    await require_role(user, ["admin"])
    
    await db.disputes.update_one(
        {"_id": ObjectId(dispute_id)},
        {"$set": {
            "status": "resolved",
            "resolved_at": datetime.utcnow(),
            "resolution": resolution,
            "resolved_by": str(user["_id"])
        }}
    )
    
    return {"success": True}

@api_router.get("/admin/users")
async def get_all_users(
    role: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    user: dict = Depends(get_current_user)
):
    """Get all users"""
    await require_role(user, ["admin"])
    
    query = {}
    if role:
        query["role"] = role
    
    users = await db.users.find(query).limit(limit).to_list(limit)
    return [serialize_doc(u) for u in users]

# ==================== PAYMENT ENDPOINTS (Stripe Mock) ====================

@api_router.post("/payments/create-intent")
async def create_payment_intent(payment: PaymentCreate, user: dict = Depends(get_current_user)):
    """Create payment intent (mock for MVP)"""
    job = await db.jobs.find_one({"_id": ObjectId(payment.job_id)})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Mock payment intent creation
    # In production, use Stripe API
    intent_id = f"pi_{secrets.token_hex(12)}"
    client_secret = f"pi_{secrets.token_hex(12)}_secret_{secrets.token_hex(8)}"
    
    await db.jobs.update_one(
        {"_id": ObjectId(payment.job_id)},
        {"$set": {
            "payment_intent_id": intent_id,
            "payment_status": "processing"
        }}
    )
    
    return {
        "payment_intent_id": intent_id,
        "client_secret": client_secret,
        "amount": payment.amount,
        "status": "requires_confirmation"
    }

@api_router.post("/payments/confirm")
async def confirm_payment(payment_intent_id: str, user: dict = Depends(get_current_user)):
    """Confirm payment (mock for MVP)"""
    job = await db.jobs.find_one({"payment_intent_id": payment_intent_id})
    if not job:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Mock successful payment
    await db.jobs.update_one(
        {"payment_intent_id": payment_intent_id},
        {"$set": {"payment_status": "succeeded"}}
    )
    
    return {"status": "succeeded"}

@api_router.get("/payments/config")
async def get_payment_config():
    """Get Stripe publishable key"""
    # Return test key placeholder
    return {
        "publishable_key": os.environ.get("STRIPE_PUBLISHABLE_KEY", "pk_test_PLACEHOLDER"),
        "merchant_id": "merchant.com.roadsideservices"
    }

# ==================== SOCKET.IO EVENTS ====================

@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")

@sio.event
async def join_job(sid, data):
    """Join a job room for updates"""
    job_id = data.get("job_id")
    if job_id:
        await sio.enter_room(sid, f"job_{job_id}")
        logger.info(f"Client {sid} joined job room: {job_id}")

@sio.event
async def leave_job(sid, data):
    """Leave a job room"""
    job_id = data.get("job_id")
    if job_id:
        await sio.leave_room(sid, f"job_{job_id}")

@sio.event
async def provider_location(sid, data):
    """Handle provider location update"""
    job_id = data.get("job_id")
    location = data.get("location")
    
    if job_id and location:
        await sio.emit(f'job_{job_id}_location', {
            "provider_location": location,
            "timestamp": datetime.utcnow().isoformat()
        }, room=f"job_{job_id}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_db():
    # Create indexes
    await db.users.create_index("phone", unique=True)
    await db.sessions.create_index("token")
    await db.sessions.create_index("expires_at")
    await db.jobs.create_index("customer_id")
    await db.jobs.create_index("provider_id")
    await db.jobs.create_index("status")
    await db.provider_profiles.create_index("user_id", unique=True)
    await db.provider_profiles.create_index("is_online")
    
    # Seed default pricing configs
    services = [
        {"service_type": "gas_delivery", "base_fee": 15.0, "per_mile_fee": 0, "gas_max_gallons": 10},
        {"service_type": "towing", "base_fee": 75.0, "per_mile_fee": 3.5},
        {"service_type": "tire_repair", "base_fee": 50.0, "per_mile_fee": 0},
        {"service_type": "mechanic", "base_fee": 65.0, "per_mile_fee": 0},
        {"service_type": "car_wash", "base_fee": 35.0, "per_mile_fee": 0}
    ]
    
    for service in services:
        await db.pricing_configs.update_one(
            {"service_type": service["service_type"]},
            {"$setOnInsert": {**service, "platform_fee_percent": 0.15, "surge_multiplier": 1.0, "enabled": True}},
            upsert=True
        )
    
    # Create admin user if not exists
    admin = await db.users.find_one({"phone": "+1234567890"})
    if not admin:
        await db.users.insert_one({
            "phone": "+1234567890",
            "role": "admin",
            "name": "Admin",
            "email": "admin@roadsideservices.com",
            "created_at": datetime.utcnow()
        })
    
    logger.info("Database initialized")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
