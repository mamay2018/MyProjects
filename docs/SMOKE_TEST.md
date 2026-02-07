# Smoke Test Guide - FollowUp Pro v2

## Backend API Tests

### 1. Health Check
```bash
curl -s http://localhost:8001/api/health | jq
```
**Expected:** `{"status": "healthy", "version": "2.0.0", "mock_mode": true, ...}`

### 2. Registration
```bash
curl -s -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "pro_name": "Test Pro",
    "business_name": "Test Business"
  }' | jq
```
**Expected:** Returns `access_token` and `user` object

### 3. Login
```bash
curl -s -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@followuppro.com", "password": "demo123"}' | jq
```
**Expected:** Returns JWT token

### 4. Create Lead
```bash
TOKEN="<your-jwt-token>"

curl -s -X POST http://localhost:8001/api/leads \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Jane Doe",
    "customer_phone": "+15551234567",
    "customer_email": "jane@example.com",
    "notes": "Needs kitchen repair"
  }' | jq
```
**Expected:** Returns created lead with `id` and `status: NEW`

### 5. List Leads
```bash
curl -s http://localhost:8001/api/leads \
  -H "Authorization: Bearer $TOKEN" | jq
```
**Expected:** Array of leads with source info

### 6. Update Lead Status
```bash
LEAD_ID="<lead-uuid>"

curl -s -X PATCH http://localhost:8001/api/leads/$LEAD_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "CONTACTED"}' | jq
```
**Expected:** Lead with `status: CONTACTED` and `contacted_at` timestamp

### 7. Analytics Summary
```bash
curl -s http://localhost:8001/api/analytics/summary \
  -H "Authorization: Bearer $TOKEN" | jq
```
**Expected:** Object with `total_leads`, `by_source` array with metrics

### 8. Public Booking Slots
```bash
# Get public_booking_id from user profile
PUBLIC_ID="<8-char-id>"

curl -s http://localhost:8001/api/book/$PUBLIC_ID/slots | jq
```
**Expected:** `pro_name`, `duration_minutes`, and `slots` array

### 9. Create Public Booking
```bash
curl -s -X POST http://localhost:8001/api/book/$PUBLIC_ID \
  -H "Content-Type: application/json" \
  -d '{
    "start_at_utc": "2026-02-10T14:00:00",
    "customer_name": "Customer Name",
    "customer_email": "customer@example.com"
  }' | jq
```
**Expected:** Appointment created with `ics_url`

### 10. Debug: Trigger Worker
```bash
curl -s -X POST http://localhost:8001/api/debug/trigger-worker \
  -H "Authorization: Bearer $TOKEN" | jq
```
**Expected:** `{"success": true, "follow_ups_processed": 0, ...}`

### 11. Debug: Inbound Message
```bash
curl -s -X POST http://localhost:8001/api/debug/inbound-message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "<lead-uuid>",
    "channel": "SMS",
    "body": "Yes, I am interested!"
  }' | jq
```
**Expected:** Message logged, lead status updated if NEW

### 12. Message Logs
```bash
curl -s http://localhost:8001/api/messages \
  -H "Authorization: Bearer $TOKEN" | jq
```
**Expected:** Array of message logs with `status: MOCKED`

## Frontend Tests

### 1. Web Preview
- Open browser to app preview URL
- Should see login screen

### 2. Login Flow
- Enter `demo@followuppro.com` / `demo123`
- Should navigate to leads list

### 3. Lead Creation
- Tap "Add Lead" button
- Fill form and submit
- Lead should appear in list

### 4. Lead Detail
- Tap on a lead
- Should see full details with status pipeline

## Test Results Checklist

| Test | Status | Notes |
|------|--------|-------|
| Health Check | ✅ | |
| Registration | ✅ | |
| Login | ✅ | |
| Create Lead | ✅ | |
| List Leads | ✅ | |
| Update Lead | ✅ | |
| Analytics | ✅ | |
| Public Booking Slots | ✅ | |
| Create Booking | ✅ | |
| Trigger Worker | ✅ | |
| Inbound Message | ✅ | |
| Message Logs | ✅ | |

---

**Last Updated:** v2.0.0 - Backend APIs Complete
