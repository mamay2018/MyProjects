#!/usr/bin/env python3
"""
FollowUp Pro Backend API Test Suite
Tests the core MVP flow and all backend endpoints
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

class FollowUpProTester:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        self.business_id = None
        self.lead_id = None
        self.sequence_id = None
        
        # Test data
        self.test_email = "testuser@followuppro.com"
        self.test_password = "SecurePass123!"
        self.test_business = {
            "business_name": "Pro Roofing Solutions",
            "owner_name": "John Smith"
        }
        self.test_lead = {
            "full_name": "Sarah Johnson",
            "phone": "555-123-4567",
            "job_type": "Roof Repair",
            "quote_amount": 3500,
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
    
    def test_health_check(self) -> bool:
        """Test basic connectivity"""
        self.log("Testing health check endpoint...")
        result = self.make_request("GET", "/api/health")
        
        if result["success"]:
            self.log("✅ Health check passed")
            return True
        else:
            self.log(f"❌ Health check failed: {result['error']}", "ERROR")
            return False
    
    def test_user_signup(self) -> bool:
        """Test user registration"""
        self.log("Testing user signup...")
        
        signup_data = {
            "email": self.test_email,
            "password": self.test_password
        }
        
        result = self.make_request("POST", "/api/auth/signup", signup_data)
        
        if result["success"]:
            self.auth_token = result["data"].get("access_token")
            self.log("✅ User signup successful")
            return True
        else:
            self.log(f"❌ User signup failed: {result['error']}", "ERROR")
            return False
    
    def test_user_login(self) -> bool:
        """Test user login"""
        self.log("Testing user login...")
        
        login_data = {
            "email": self.test_email,
            "password": self.test_password
        }
        
        result = self.make_request("POST", "/api/auth/login", login_data)
        
        if result["success"]:
            self.auth_token = result["data"].get("access_token")
            self.log("✅ User login successful")
            return True
        else:
            self.log(f"❌ User login failed: {result['error']}", "ERROR")
            return False
    
    def test_get_user_profile(self) -> bool:
        """Test getting user profile"""
        self.log("Testing get user profile...")
        
        result = self.make_request("GET", "/api/auth/me")
        
        if result["success"]:
            user_data = result["data"]
            self.user_id = user_data.get("id")
            self.log(f"✅ User profile retrieved: {user_data.get('email')}")
            return True
        else:
            self.log(f"❌ Get user profile failed: {result['error']}", "ERROR")
            return False
    
    def test_create_business(self) -> bool:
        """Test business creation"""
        self.log("Testing business creation...")
        
        result = self.make_request("POST", "/api/business", self.test_business)
        
        if result["success"]:
            business_data = result["data"]
            self.business_id = business_data.get("id")
            self.log(f"✅ Business created: {business_data.get('business_name')}")
            return True
        else:
            self.log(f"❌ Business creation failed: {result['error']}", "ERROR")
            return False
    
    def test_get_business(self) -> bool:
        """Test getting business profile"""
        self.log("Testing get business profile...")
        
        result = self.make_request("GET", "/api/business")
        
        if result["success"]:
            business_data = result["data"]
            self.log(f"✅ Business profile retrieved: {business_data.get('business_name')}")
            return True
        else:
            self.log(f"❌ Get business profile failed: {result['error']}", "ERROR")
            return False
    
    def test_get_sequences(self) -> bool:
        """Test getting built-in sequences"""
        self.log("Testing get sequences...")
        
        result = self.make_request("GET", "/api/sequences")
        
        if result["success"]:
            sequences = result["data"]
            if len(sequences) >= 3:
                self.sequence_id = sequences[0].get("id")  # Use first sequence for testing
                sequence_names = [seq.get("name") for seq in sequences]
                self.log(f"✅ Sequences retrieved: {sequence_names}")
                return True
            else:
                self.log(f"❌ Expected at least 3 built-in sequences, got {len(sequences)}", "ERROR")
                return False
        else:
            self.log(f"❌ Get sequences failed: {result['error']}", "ERROR")
            return False
    
    def test_create_lead(self) -> bool:
        """Test lead creation"""
        self.log("Testing lead creation...")
        
        result = self.make_request("POST", "/api/leads", self.test_lead)
        
        if result["success"]:
            lead_data = result["data"]
            self.lead_id = lead_data.get("id")
            self.log(f"✅ Lead created: {lead_data.get('full_name')} - ${lead_data.get('quote_amount')}")
            return True
        else:
            self.log(f"❌ Lead creation failed: {result['error']}", "ERROR")
            return False
    
    def test_get_leads(self) -> bool:
        """Test getting leads list"""
        self.log("Testing get leads...")
        
        result = self.make_request("GET", "/api/leads")
        
        if result["success"]:
            leads = result["data"]
            self.log(f"✅ Leads retrieved: {len(leads)} leads found")
            return True
        else:
            self.log(f"❌ Get leads failed: {result['error']}", "ERROR")
            return False
    
    def test_get_single_lead(self) -> bool:
        """Test getting single lead"""
        if not self.lead_id:
            self.log("❌ No lead ID available for testing", "ERROR")
            return False
            
        self.log("Testing get single lead...")
        
        result = self.make_request("GET", f"/api/leads/{self.lead_id}")
        
        if result["success"]:
            lead_data = result["data"]
            self.log(f"✅ Single lead retrieved: {lead_data.get('full_name')}")
            return True
        else:
            self.log(f"❌ Get single lead failed: {result['error']}", "ERROR")
            return False
    
    def test_assign_sequence(self) -> bool:
        """Test assigning sequence to lead"""
        if not self.lead_id or not self.sequence_id:
            self.log("❌ Missing lead_id or sequence_id for testing", "ERROR")
            return False
            
        self.log("Testing assign sequence to lead...")
        
        assign_data = {"sequence_id": self.sequence_id}
        result = self.make_request("POST", f"/api/leads/{self.lead_id}/assign-sequence", assign_data)
        
        if result["success"]:
            lead_data = result["data"]
            status = lead_data.get("status")
            if status == "FOLLOWING_UP":
                self.log("✅ Sequence assigned successfully, lead status changed to FOLLOWING_UP")
                return True
            else:
                self.log(f"❌ Sequence assigned but status is {status}, expected FOLLOWING_UP", "ERROR")
                return False
        else:
            self.log(f"❌ Assign sequence failed: {result['error']}", "ERROR")
            return False
    
    def test_update_lead_status(self) -> bool:
        """Test updating lead status"""
        if not self.lead_id:
            self.log("❌ No lead ID available for testing", "ERROR")
            return False
            
        self.log("Testing update lead status...")
        
        # Test marking as WON
        update_data = {"status": "WON"}
        result = self.make_request("PUT", f"/api/leads/{self.lead_id}", update_data)
        
        if result["success"]:
            lead_data = result["data"]
            if lead_data.get("status") == "WON":
                self.log("✅ Lead status updated to WON successfully")
                return True
            else:
                self.log(f"❌ Lead status not updated correctly, got {lead_data.get('status')}", "ERROR")
                return False
        else:
            self.log(f"❌ Update lead status failed: {result['error']}", "ERROR")
            return False
    
    def test_dashboard_stats(self) -> bool:
        """Test dashboard statistics"""
        self.log("Testing dashboard stats...")
        
        result = self.make_request("GET", "/api/dashboard")
        
        if result["success"]:
            stats = result["data"]
            required_fields = ["todays_followups", "hot_leads", "pipeline_counts", "money_at_risk"]
            
            missing_fields = [field for field in required_fields if field not in stats]
            if not missing_fields:
                self.log(f"✅ Dashboard stats retrieved: {stats}")
                return True
            else:
                self.log(f"❌ Dashboard missing fields: {missing_fields}", "ERROR")
                return False
        else:
            self.log(f"❌ Dashboard stats failed: {result['error']}", "ERROR")
            return False
    
    def test_ai_rewrite(self) -> bool:
        """Test AI message rewrite"""
        self.log("Testing AI message rewrite...")
        
        rewrite_data = {
            "message": "Hi there, just following up!",
            "tone": "Professional"
        }
        
        result = self.make_request("POST", "/api/ai/rewrite", rewrite_data)
        
        if result["success"]:
            response_data = result["data"]
            if "rewritten" in response_data and response_data["rewritten"]:
                self.log(f"✅ AI rewrite successful: '{response_data['rewritten']}'")
                return True
            else:
                self.log("❌ AI rewrite returned empty result", "ERROR")
                return False
        else:
            self.log(f"❌ AI rewrite failed: {result['error']}", "ERROR")
            return False
    
    def test_lead_messages(self) -> bool:
        """Test getting lead messages"""
        if not self.lead_id:
            self.log("❌ No lead ID available for testing", "ERROR")
            return False
            
        self.log("Testing get lead messages...")
        
        result = self.make_request("GET", f"/api/leads/{self.lead_id}/messages")
        
        if result["success"]:
            messages = result["data"]
            self.log(f"✅ Lead messages retrieved: {len(messages)} messages")
            return True
        else:
            self.log(f"❌ Get lead messages failed: {result['error']}", "ERROR")
            return False
    
    def test_delete_lead(self) -> bool:
        """Test deleting a lead"""
        if not self.lead_id:
            self.log("❌ No lead ID available for testing", "ERROR")
            return False
            
        self.log("Testing delete lead...")
        
        result = self.make_request("DELETE", f"/api/leads/{self.lead_id}")
        
        if result["success"]:
            self.log("✅ Lead deleted successfully")
            return True
        else:
            self.log(f"❌ Delete lead failed: {result['error']}", "ERROR")
            return False
    
    def run_all_tests(self) -> Dict[str, bool]:
        """Run all tests in sequence"""
        self.log("=" * 60)
        self.log("STARTING FOLLOWUP PRO BACKEND API TESTS")
        self.log("=" * 60)
        
        tests = [
            ("Health Check", self.test_health_check),
            ("User Signup", self.test_user_signup),
            ("User Login", self.test_user_login),
            ("Get User Profile", self.test_get_user_profile),
            ("Create Business", self.test_create_business),
            ("Get Business", self.test_get_business),
            ("Get Sequences", self.test_get_sequences),
            ("Create Lead", self.test_create_lead),
            ("Get Leads", self.test_get_leads),
            ("Get Single Lead", self.test_get_single_lead),
            ("Assign Sequence", self.test_assign_sequence),
            ("Update Lead Status", self.test_update_lead_status),
            ("Dashboard Stats", self.test_dashboard_stats),
            ("AI Rewrite", self.test_ai_rewrite),
            ("Lead Messages", self.test_lead_messages),
            ("Delete Lead", self.test_delete_lead),
        ]
        
        results = {}
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            self.log(f"\n--- Running: {test_name} ---")
            try:
                result = test_func()
                results[test_name] = result
                if result:
                    passed += 1
                time.sleep(0.5)  # Small delay between tests
            except Exception as e:
                self.log(f"❌ {test_name} crashed: {str(e)}", "ERROR")
                results[test_name] = False
        
        # Summary
        self.log("\n" + "=" * 60)
        self.log("TEST SUMMARY")
        self.log("=" * 60)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{status}: {test_name}")
        
        self.log(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED!")
        else:
            self.log(f"⚠️  {total - passed} tests failed")
        
        return results


def main():
    """Main test runner"""
    # Get backend URL from environment or use default
    import os
    backend_url = "https://followboost-33.preview.emergentagent.com"
    
    print(f"Testing FollowUp Pro Backend at: {backend_url}")
    
    tester = FollowUpProTester(backend_url)
    results = tester.run_all_tests()
    
    # Return exit code based on results
    failed_tests = [name for name, result in results.items() if not result]
    if failed_tests:
        print(f"\nFailed tests: {', '.join(failed_tests)}")
        return 1
    else:
        print("\nAll tests passed successfully!")
        return 0


if __name__ == "__main__":
    exit(main())