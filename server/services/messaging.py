import os
import re
from typing import Optional, Tuple
from dotenv import load_dotenv

load_dotenv()

# Mock mode - set via environment variable
MOCK_MODE = os.getenv("MOCK_MODE", "true").lower() == "true"

# Twilio config
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")

# SendGrid config
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@followuppro.com")

# Initialize clients only if not in mock mode and credentials exist
twilio_client = None
sendgrid_client = None

if not MOCK_MODE:
    if TWILIO_ACCOUNT_SID and not TWILIO_ACCOUNT_SID.startswith("your_"):
        try:
            from twilio.rest import Client as TwilioClient
            twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        except Exception as e:
            print(f"Failed to initialize Twilio client: {e}")

    if SENDGRID_API_KEY and not SENDGRID_API_KEY.startswith("your_"):
        try:
            from sendgrid import SendGridAPIClient
            sendgrid_client = SendGridAPIClient(SENDGRID_API_KEY)
        except Exception as e:
            print(f"Failed to initialize SendGrid client: {e}")

def normalize_phone(phone: str) -> str:
    """Normalize phone number to E.164 format"""
    # Remove all non-digit characters
    digits = re.sub(r'\D', '', phone)
    
    # Add country code if missing (assume US)
    if len(digits) == 10:
        digits = '1' + digits
    
    return '+' + digits

async def send_sms(to_phone: str, body: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Send SMS via Twilio
    Returns: (success, message_sid, error)
    """
    normalized_phone = normalize_phone(to_phone)
    
    if MOCK_MODE or twilio_client is None:
        # Mock mode - simulate successful send
        print(f"[MOCK SMS] To: {normalized_phone}, Body: {body[:50]}...")
        return True, f"mock_sms_{normalized_phone}", None
    
    try:
        message = twilio_client.messages.create(
            body=body,
            from_=TWILIO_PHONE_NUMBER,
            to=normalized_phone
        )
        return True, message.sid, None
    except Exception as e:
        return False, None, str(e)

async def send_email(to_email: str, subject: str, body: str) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Send Email via SendGrid
    Returns: (success, message_id, error)
    """
    if MOCK_MODE or sendgrid_client is None:
        # Mock mode - simulate successful send
        print(f"[MOCK EMAIL] To: {to_email}, Subject: {subject}, Body: {body[:50]}...")
        return True, f"mock_email_{to_email}", None
    
    try:
        from sendgrid.helpers.mail import Mail
        message = Mail(
            from_email=FROM_EMAIL,
            to_emails=to_email,
            subject=subject,
            plain_text_content=body
        )
        response = sendgrid_client.send(message)
        return True, response.headers.get('X-Message-Id', 'sent'), None
    except Exception as e:
        return False, None, str(e)

def replace_template_variables(template: str, lead_data: dict, business_data: dict) -> str:
    """
    Replace template variables with actual values
    Variables: {firstName}, {jobType}, {quoteAmount}, {businessName}
    """
    # Extract first name from full name
    full_name = lead_data.get('full_name', '')
    first_name = full_name.split()[0] if full_name else 'there'
    
    replacements = {
        '{firstName}': first_name,
        '{jobType}': lead_data.get('job_type', 'your project'),
        '{quoteAmount}': f"${lead_data.get('quote_amount', 0):,.2f}" if lead_data.get('quote_amount') else 'the quoted amount',
        '{businessName}': business_data.get('business_name', 'our team'),
    }
    
    result = template
    for var, value in replacements.items():
        result = result.replace(var, str(value))
    
    return result
