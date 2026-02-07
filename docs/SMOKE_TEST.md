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
**Expected:** Returns `access_token` and `user` object with `public_booking_id`

### 3. Login
```bash
curl -s -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@followuppro.com", "password": "demo123"}' | jq
```
**Expected:** Returns JWT token and user info

### 4. Create Lead with Source
```bash
TOKEN="<your-jwt-token>"
SOURCE_ID="<lead-source-uuid>"  # Get from /api/lead-sources

curl -s -X POST http://localhost:8001/api/leads \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Jane Doe",
    "customer_phone": "+15551234567",
    "customer_email": "jane@example.com",
    "lead_source_id": "'$SOURCE_ID'",
    "notes": "Needs kitchen repair"
  }' | jq
```
**Expected:** Returns created lead with `id`, `status: NEW`, and `lead_source` object

### 5. List Leads with Filters
```bash
# By status
curl -s "http://localhost:8001/api/leads?status=NEW" \
  -H "Authorization: Bearer $TOKEN" | jq

# By source
curl -s "http://localhost:8001/api/leads?source_id=$SOURCE_ID" \
  -H "Authorization: Bearer $TOKEN" | jq

# With search
curl -s "http://localhost:8001/api/leads?search=jane" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 6. Update Lead Status & Won Value
```bash
LEAD_ID="<lead-uuid>"

# Mark as WON with value
curl -s -X PATCH http://localhost:8001/api/leads/$LEAD_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "WON", "won_value_cents": 250000}' | jq
```
**Expected:** Lead with `status: WON`, `won_value_cents: 250000`, `closed_at` timestamp

### 7. Analytics Summary with Source Breakdown
```bash
curl -s "http://localhost:8001/api/analytics/summary" \
  -H "Authorization: Bearer $TOKEN" | jq
```
**Expected:** Object with `total_leads`, `total_revenue_cents`, `by_source` array with per-source metrics

### 8. Lead Sources Management
```bash
# List sources
curl -s http://localhost:8001/api/lead-sources \
  -H "Authorization: Bearer $TOKEN" | jq

# Create custom source
curl -s -X POST http://localhost:8001/api/lead-sources \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Instagram", "color": "#E1306C"}' | jq
```

### 9. Public Booking Slots
```bash
PUBLIC_ID="<8-char-id>"  # From user.public_booking_id

curl -s http://localhost:8001/api/book/$PUBLIC_ID/slots | jq
```
**Expected:** `pro_name`, `duration_minutes`, and `slots` array

### 10. Create Public Booking
```bash
curl -s -X POST http://localhost:8001/api/book/$PUBLIC_ID \
  -H "Content-Type: application/json" \
  -d '{
    "start_at_utc": "2026-02-10T14:00:00",
    "customer_name": "Customer Name",
    "customer_email": "customer@example.com"
  }' | jq
```
**Expected:** Appointment created with `ics_url` for calendar download

### 11. Availability Management
```bash
# Get availability
curl -s http://localhost:8001/api/availability \
  -H "Authorization: Bearer $TOKEN" | jq

# Set availability (Mon-Fri 9-5)
curl -s -X PUT http://localhost:8001/api/availability \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {"weekday": 0, "start_time_local": "09:00:00", "end_time_local": "17:00:00", "enabled": true},
      {"weekday": 1, "start_time_local": "09:00:00", "end_time_local": "17:00:00", "enabled": true},
      {"weekday": 2, "start_time_local": "09:00:00", "end_time_local": "17:00:00", "enabled": true}
    ]
  }' | jq
```

### 12. Device Registration (Push Notifications)
```bash
curl -s -X POST http://localhost:8001/api/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "expo_push_token": "ExponentPushToken[xxxxxxxxxxxxxx]",
    "platform": "ios",
    "device_name": "iPhone 15"
  }' | jq
```

### 13. Debug: Trigger Worker
```bash
curl -s -X POST http://localhost:8001/api/debug/trigger-worker \
  -H "Authorization: Bearer $TOKEN" | jq
```
**Expected:** `{"success": true, "follow_ups_processed": 0, ...}`

### 14. Debug: Inbound Message
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
**Expected:** Message logged, lead status updated, follow-ups cancelled

### 15. Message Logs
```bash
curl -s "http://localhost:8001/api/messages?lead_id=$LEAD_ID" \
  -H "Authorization: Bearer $TOKEN" | jq
```
**Expected:** Array of message logs with `status: MOCKED`

## Frontend Tests

### 1. Login Flow
- Open browser to app preview URL
- Enter `demo@followuppro.com` / `demo123`
- Should navigate to Dashboard

### 2. Dashboard
- View stats cards (Total Leads, Won Deals)
- View Revenue card with Close Rate
- View Pipeline overview
- View Recent leads list

### 3. Leads List
- Navigate to Leads tab
- Filter by status (tap status chips)
- Filter by source (tap source chips)
- Search by name/phone
- Tap + to add new lead

### 4. Lead Creation
- Fill customer name (required)
- Select lead source from chips
- Optionally select follow-up plan
- Tap "Create Lead"

### 5. Lead Detail
- Tap on a lead
- View contact info and source
- Tap status badge to change status
- Use quick actions (Mark Booked/Won/Lost)
- Enter job value when marking Won
- Toggle automation on/off

### 6. Analytics
- Navigate to Analytics tab
- Select time period (7d/30d/90d/All)
- View summary metrics
- View source breakdown table

### 7. Settings
- View profile info
- Share booking link
- Enable push notifications (on device)
- Edit weekly availability
- View booking settings
- Logout

## Test Results Checklist

| Test | Backend | Frontend | Notes |
|------|---------|----------|-------|
| Health Check | ✅ | - | |
| Registration | ✅ | ✅ | |
| Login | ✅ | ✅ | |
| Create Lead | ✅ | ✅ | With source selector |
| List Leads | ✅ | ✅ | With filters |
| Update Lead Status | ✅ | ✅ | |
| Mark Won with Value | ✅ | ✅ | |
| Analytics | ✅ | ✅ | Source breakdown |
| Lead Sources | ✅ | ✅ | 8 defaults + custom |
| Booking Slots | ✅ | - | |
| Create Booking | ✅ | - | |
| Availability | ✅ | ✅ | Weekly editor |
| Device Registration | ✅ | ✅ | Push setup |
| Debug Worker | ✅ | - | |
| Debug Inbound | ✅ | - | |
| Message Logs | ✅ | ✅ | In lead detail |

---

**Last Updated:** v2.0.0 - Increment 2 Complete
