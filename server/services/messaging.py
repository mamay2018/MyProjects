"""Messaging Service - Handles SMS (Twilio) and Email (SendGrid)"""
import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

MOCK_MODE = os.getenv("MOCK_MODE", "true").lower() == "true"
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@followuppro.com")


class MessagingService:
    def __init__(self):
        self.mock_mode = MOCK_MODE
        
        if not self.mock_mode:
            # Initialize Twilio
            if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
                from twilio.rest import Client
                self.twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            else:
                self.twilio_client = None
            
            # Initialize SendGrid
            if SENDGRID_API_KEY:
                import sendgrid
                self.sendgrid_client = sendgrid.SendGridAPIClient(api_key=SENDGRID_API_KEY)
            else:
                self.sendgrid_client = None
    
    async def send_sms(
        self, 
        to: str, 
        body: str,
        from_number: Optional[str] = None
    ) -> dict:
        """Send SMS message via Twilio or mock"""
        from_number = from_number or TWILIO_PHONE_NUMBER
        
        if self.mock_mode:
            print(f"[MOCK SMS] To: {to}, Body: {body[:50]}...")
            return {
                "success": True,
                "status": "mocked",
                "external_id": f"mock_sms_{to}_{hash(body)}",
                "mock_mode": True
            }
        
        if not self.twilio_client:
            return {
                "success": False,
                "status": "failed",
                "error": "Twilio not configured"
            }
        
        try:
            message = self.twilio_client.messages.create(
                body=body,
                from_=from_number,
                to=to
            )
            return {
                "success": True,
                "status": "sent",
                "external_id": message.sid,
                "mock_mode": False
            }
        except Exception as e:
            return {
                "success": False,
                "status": "failed",
                "error": str(e)
            }
    
    async def send_email(
        self,
        to: str,
        subject: str,
        body: str,
        from_email: Optional[str] = None,
        html_body: Optional[str] = None
    ) -> dict:
        """Send email via SendGrid or mock"""
        from_email = from_email or FROM_EMAIL
        
        if self.mock_mode:
            print(f"[MOCK EMAIL] To: {to}, Subject: {subject}")
            return {
                "success": True,
                "status": "mocked",
                "external_id": f"mock_email_{to}_{hash(subject)}",
                "mock_mode": True
            }
        
        if not self.sendgrid_client:
            return {
                "success": False,
                "status": "failed",
                "error": "SendGrid not configured"
            }
        
        try:
            from sendgrid.helpers.mail import Mail, Email, To, Content
            
            message = Mail(
                from_email=Email(from_email),
                to_emails=To(to),
                subject=subject,
                plain_text_content=Content("text/plain", body)
            )
            
            if html_body:
                message.add_content(Content("text/html", html_body))
            
            response = self.sendgrid_client.send(message)
            
            return {
                "success": response.status_code in [200, 202],
                "status": "sent" if response.status_code in [200, 202] else "failed",
                "external_id": response.headers.get("X-Message-Id"),
                "mock_mode": False
            }
        except Exception as e:
            return {
                "success": False,
                "status": "failed",
                "error": str(e)
            }


# Template variable replacement
def replace_template_variables(template: str, variables: dict) -> str:
    """Replace {variable_name} placeholders in template"""
    result = template
    for key, value in variables.items():
        result = result.replace(f"{{{key}}}", str(value) if value else "")
    return result
