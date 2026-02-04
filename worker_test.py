#!/usr/bin/env python3
"""
FollowUp Pro Background Worker Test
Tests the follow-up scheduling and background processing
"""

import requests
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class FollowUpWorkerTester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.auth_token = None
        self.lead_id = None
        self.sequence_id = None
        
        # Test data
        self.test_email = "workertest@followuppro.com"
        self.test_password = "WorkerTest123!"
        self.test_business = {
            "business_name": "Test Worker Business",
            "owner_name": "Worker Tester"
        }
        self.test_lead = {
            "full_name": "Background Test Lead",
            "phone": "555-999-8888",
            "email": "testlead@example.com",
            "job_type": "Background Test Job",
            "quote_amount": 5000,
            "preferred_channel": "SMS"
        }
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    headers: Optional[Dict] = None, params: Optional[Dict] = None) -> Dict[str, Any]:
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        
        # Add auth header if token exists
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
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=headers, params=params, timeout=30)
            else:
                return {"success": False, "error": f"Unsupported method: {method}"}
                
            return {
                "success": response.status_code < 400,
                "status_code": response.status_code,
                "data": response.json() if response.content else {},
                "error": None if response.status_code < 400 else f"HTTP {response.status_code}: {response.text}"
            }
            
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": f"Request failed: {str(e)}"}
        except json.JSONDecodeError as e:
            return {"success": False, "error": f"JSON decode error: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"Unexpected error: {str(e)}"}
    
    def setup_test_environment(self) -> bool:
        """Setup user, business, and lead for testing"""
        self.log("Setting up test environment...")
        
        # Signup
        signup_data = {"email": self.test_email, "password": self.test_password}
        result = self.make_request("POST", "/api/auth/signup", signup_data)
        if not result["success"]:
            self.log(f"❌ Signup failed: {result['error']}", "ERROR")
            return False
        
        self.auth_token = result["data"].get("access_token")
        
        # Create business
        result = self.make_request("POST", "/api/business", self.test_business)
        if not result["success"]:
            self.log(f"❌ Business creation failed: {result['error']}", "ERROR")
            return False
        
        # Get sequences
        result = self.make_request("GET", "/api/sequences")
        if not result["success"] or not result["data"]:
            self.log(f"❌ Get sequences failed: {result['error']}", "ERROR")
            return False
        
        self.sequence_id = result["data"][0]["id"]  # Use first sequence
        
        # Create lead
        result = self.make_request("POST", "/api/leads", self.test_lead)
        if not result["success"]:
            self.log(f"❌ Lead creation failed: {result['error']}", "ERROR")
            return False
        
        self.lead_id = result["data"]["id"]
        self.log("✅ Test environment setup complete")
        return True
    
    def test_sequence_assignment_and_scheduling(self) -> bool:
        """Test that assigning a sequence properly schedules follow-ups"""
        self.log("Testing sequence assignment and follow-up scheduling...")
        
        # Get lead before assignment
        result = self.make_request("GET", f"/api/leads/{self.lead_id}")
        if not result["success"]:
            self.log(f"❌ Failed to get lead: {result['error']}", "ERROR")
            return False
        
        lead_before = result["data"]
        self.log(f"Lead before assignment - Status: {lead_before.get('status')}, Next followup: {lead_before.get('next_followup_at')}")
        
        # Assign sequence
        assign_data = {"sequence_id": self.sequence_id}
        result = self.make_request("POST", f"/api/leads/{self.lead_id}/assign-sequence", assign_data)
        if not result["success"]:
            self.log(f"❌ Sequence assignment failed: {result['error']}", "ERROR")
            return False
        
        lead_after = result["data"]
        self.log(f"Lead after assignment - Status: {lead_after.get('status')}, Next followup: {lead_after.get('next_followup_at')}")
        
        # Verify changes
        if lead_after.get("status") != "FOLLOWING_UP":
            self.log(f"❌ Expected status FOLLOWING_UP, got {lead_after.get('status')}", "ERROR")
            return False
        
        if not lead_after.get("next_followup_at"):
            self.log("❌ No next_followup_at scheduled", "ERROR")
            return False
        
        if not lead_after.get("current_sequence_id"):
            self.log("❌ No current_sequence_id set", "ERROR")
            return False
        
        self.log("✅ Sequence assignment and scheduling working correctly")
        return True
    
    def test_message_logging(self) -> bool:
        """Test that messages are being logged"""
        self.log("Testing message logging...")
        
        # Wait a moment for any background processing
        time.sleep(2)
        
        # Check message logs
        result = self.make_request("GET", f"/api/leads/{self.lead_id}/messages")
        if not result["success"]:
            self.log(f"❌ Failed to get messages: {result['error']}", "ERROR")
            return False
        
        messages = result["data"]
        self.log(f"Found {len(messages)} messages in log")
        
        # For now, just verify the endpoint works - messages might be sent by background worker
        self.log("✅ Message logging endpoint working")
        return True
    
    def test_status_changes_stop_automation(self) -> bool:
        """Test that changing lead status to WON/LOST/REPLIED stops automation"""
        self.log("Testing that status changes stop automation...")
        
        # Update lead to REPLIED
        update_data = {"status": "REPLIED"}
        result = self.make_request("PUT", f"/api/leads/{self.lead_id}", update_data)
        if not result["success"]:
            self.log(f"❌ Failed to update lead status: {result['error']}", "ERROR")
            return False
        
        lead_updated = result["data"]
        
        # Verify automation stopped
        if lead_updated.get("next_followup_at") is not None:
            self.log(f"❌ next_followup_at should be null after REPLIED, got {lead_updated.get('next_followup_at')}", "ERROR")
            return False
        
        if lead_updated.get("current_sequence_id") is not None:
            self.log(f"❌ current_sequence_id should be null after REPLIED, got {lead_updated.get('current_sequence_id')}", "ERROR")
            return False
        
        self.log("✅ Status change correctly stops automation")
        return True
    
    def test_webhook_endpoint(self) -> bool:
        """Test Twilio webhook endpoint"""
        self.log("Testing Twilio webhook endpoint...")
        
        # Create a new lead for webhook testing
        webhook_lead = {
            "full_name": "Webhook Test Lead",
            "phone": "555-777-6666",
            "job_type": "Webhook Test",
            "quote_amount": 2000,
            "preferred_channel": "SMS"
        }
        
        result = self.make_request("POST", "/api/leads", webhook_lead)
        if not result["success"]:
            self.log(f"❌ Failed to create webhook test lead: {result['error']}", "ERROR")
            return False
        
        webhook_lead_id = result["data"]["id"]
        
        # Assign sequence to start automation
        assign_data = {"sequence_id": self.sequence_id}
        result = self.make_request("POST", f"/api/leads/{webhook_lead_id}/assign-sequence", assign_data)
        if not result["success"]:
            self.log(f"❌ Failed to assign sequence to webhook lead: {result['error']}", "ERROR")
            return False
        
        # Simulate Twilio webhook (form data)
        webhook_data = {
            "From": "+15557776666",
            "Body": "Thanks for following up! I'm interested.",
            "MessageSid": "SM123456789"
        }
        
        # Make webhook request (form data, not JSON)
        url = f"{self.base_url}/api/webhooks/twilio/sms"
        try:
            response = self.session.post(url, data=webhook_data, timeout=30)
            webhook_result = {
                "success": response.status_code < 400,
                "status_code": response.status_code,
                "data": response.json() if response.content else {},
                "error": None if response.status_code < 400 else f"HTTP {response.status_code}: {response.text}"
            }
        except Exception as e:
            webhook_result = {"success": False, "error": f"Webhook request failed: {str(e)}"}
        
        if not webhook_result["success"]:
            self.log(f"❌ Webhook request failed: {webhook_result['error']}", "ERROR")
            return False
        
        # Check if lead status changed to REPLIED
        result = self.make_request("GET", f"/api/leads/{webhook_lead_id}")
        if result["success"]:
            lead_data = result["data"]
            if lead_data.get("status") == "REPLIED":
                self.log("✅ Webhook correctly changed lead status to REPLIED")
                return True
            else:
                self.log(f"❌ Expected lead status REPLIED, got {lead_data.get('status')}", "ERROR")
                return False
        else:
            self.log(f"❌ Failed to get lead after webhook: {result['error']}", "ERROR")
            return False
    
    def run_worker_tests(self) -> Dict[str, bool]:
        """Run all background worker tests"""
        self.log("=" * 60)
        self.log("STARTING FOLLOWUP PRO BACKGROUND WORKER TESTS")
        self.log("=" * 60)
        
        # Setup
        if not self.setup_test_environment():
            self.log("❌ Failed to setup test environment", "ERROR")
            return {"Setup": False}
        
        tests = [
            ("Sequence Assignment & Scheduling", self.test_sequence_assignment_and_scheduling),
            ("Message Logging", self.test_message_logging),
            ("Status Changes Stop Automation", self.test_status_changes_stop_automation),
            ("Twilio Webhook", self.test_webhook_endpoint),
        ]
        
        results = {"Setup": True}
        passed = 1  # Setup passed
        total = len(tests) + 1  # +1 for setup
        
        for test_name, test_func in tests:
            self.log(f"\n--- Running: {test_name} ---")
            try:
                result = test_func()
                results[test_name] = result
                if result:
                    passed += 1
                time.sleep(0.5)
            except Exception as e:
                self.log(f"❌ {test_name} crashed: {str(e)}", "ERROR")
                results[test_name] = False
        
        # Summary
        self.log("\n" + "=" * 60)
        self.log("BACKGROUND WORKER TEST SUMMARY")
        self.log("=" * 60)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{status}: {test_name}")
        
        self.log(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        return results


def main():
    """Main test runner"""
    backend_url = "https://followboost-33.preview.emergentagent.com"
    
    print(f"Testing FollowUp Pro Background Worker at: {backend_url}")
    
    tester = FollowUpWorkerTester(backend_url)
    results = tester.run_worker_tests()
    
    # Return exit code based on results
    failed_tests = [name for name, result in results.items() if not result]
    if failed_tests:
        print(f"\nFailed tests: {', '.join(failed_tests)}")
        return 1
    else:
        print("\nAll background worker tests passed!")
        return 0


if __name__ == "__main__":
    exit(main())