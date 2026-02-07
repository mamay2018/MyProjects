#!/usr/bin/env python3
"""
Debug Twilio Webhook Issue
"""

import requests
import json
from typing import Dict, Any, Optional

class WebhookDebugger:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.auth_token = None
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        print(f"[{level}] {message}")
        
    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    headers: Optional[Dict] = None, params: Optional[Dict] = None) -> Dict[str, Any]:
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        
        if self.auth_token and headers is None:
            headers = {}
        if self.auth_token:
            headers = headers or {}
            headers["Authorization"] = f"Bearer {self.auth_token}"
            
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers, params=params, timeout=30)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, headers=headers, params=params, timeout=30)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data, headers=headers, params=params, timeout=30)
            else:
                return {"success": False, "error": f"Unsupported method: {method}"}
                
            return {
                "success": response.status_code < 400,
                "status_code": response.status_code,
                "data": response.json() if response.content else {},
                "error": None if response.status_code < 400 else f"HTTP {response.status_code}: {response.text}"
            }
            
        except Exception as e:
            return {"success": False, "error": f"Request failed: {str(e)}"}
    
    def setup_and_test_webhook(self):
        """Setup test and debug webhook"""
        
        # 1. Setup user and business
        self.log("Setting up test user and business...")
        
        signup_data = {"email": "webhookdebug@test.com", "password": "Debug123!"}
        result = self.make_request("POST", "/api/auth/signup", signup_data)
        if not result["success"]:
            self.log(f"Signup failed: {result['error']}", "ERROR")
            return
        
        self.auth_token = result["data"].get("access_token")
        
        business_data = {"business_name": "Debug Business", "owner_name": "Debug Owner"}
        result = self.make_request("POST", "/api/business", business_data)
        if not result["success"]:
            self.log(f"Business creation failed: {result['error']}", "ERROR")
            return
        
        # 2. Create lead with specific phone number
        test_phone = "555-777-6666"  # This will be normalized to +15557776666
        lead_data = {
            "full_name": "Webhook Debug Lead",
            "phone": test_phone,
            "job_type": "Debug Test",
            "quote_amount": 1000,
            "preferred_channel": "SMS"
        }
        
        self.log(f"Creating lead with phone: {test_phone}")
        result = self.make_request("POST", "/api/leads", lead_data)
        if not result["success"]:
            self.log(f"Lead creation failed: {result['error']}", "ERROR")
            return
        
        lead_id = result["data"]["id"]
        created_phone = result["data"]["phone"]
        self.log(f"Lead created with ID: {lead_id}, stored phone: {created_phone}")
        
        # 3. Assign sequence to start automation
        result = self.make_request("GET", "/api/sequences")
        if not result["success"]:
            self.log(f"Get sequences failed: {result['error']}", "ERROR")
            return
        
        sequence_id = result["data"][0]["id"]
        assign_data = {"sequence_id": sequence_id}
        result = self.make_request("POST", f"/api/leads/{lead_id}/assign-sequence", assign_data)
        if not result["success"]:
            self.log(f"Sequence assignment failed: {result['error']}", "ERROR")
            return
        
        self.log("Sequence assigned, lead should be in FOLLOWING_UP status")
        
        # 4. Test webhook with various phone number formats
        webhook_formats = [
            "+15557776666",    # E.164 format
            "15557776666",     # With country code, no +
            "5557776666",      # Without country code
            "(555) 777-6666",  # Formatted
            "555-777-6666",    # Dashed
        ]
        
        for phone_format in webhook_formats:
            self.log(f"\nTesting webhook with phone format: {phone_format}")
            
            # Simulate Twilio webhook
            webhook_data = {
                "From": phone_format,
                "Body": "Thanks for following up!",
                "MessageSid": f"SM{phone_format.replace('+', '').replace('-', '').replace('(', '').replace(')', '').replace(' ', '')}"
            }
            
            # Make webhook request (form data)
            url = f"{self.base_url}/api/webhooks/twilio/sms"
            try:
                response = self.session.post(url, data=webhook_data, timeout=30)
                webhook_result = {
                    "success": response.status_code < 400,
                    "status_code": response.status_code,
                    "data": response.json() if response.content else {},
                }
                
                self.log(f"Webhook response: {webhook_result}")
                
                # Check lead status
                result = self.make_request("GET", f"/api/leads/{lead_id}")
                if result["success"]:
                    lead_status = result["data"]["status"]
                    self.log(f"Lead status after webhook: {lead_status}")
                    
                    if lead_status == "REPLIED":
                        self.log(f"✅ SUCCESS: Webhook worked with format {phone_format}")
                        return
                    else:
                        self.log(f"❌ Lead status is {lead_status}, expected REPLIED")
                else:
                    self.log(f"Failed to get lead: {result['error']}", "ERROR")
                    
            except Exception as e:
                self.log(f"Webhook request failed: {str(e)}", "ERROR")
        
        self.log("❌ All webhook formats failed")


def main():
    backend_url = "https://profollow.preview.emergentagent.com"
    debugger = WebhookDebugger(backend_url)
    debugger.setup_and_test_webhook()


if __name__ == "__main__":
    main()