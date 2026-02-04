# FollowUp Pro - Smoke Test Checklist

This checklist verifies the core MVP flow works end-to-end.

## Prerequisites

- Server running on `http://localhost:8001`
- `MOCK_MODE=true` in server `.env`
- PostgreSQL database running

## Test Steps

### 1. Create Account & Business

```bash
# Signup
curl -X POST http://localhost:8001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Save the token
export TOKEN="<access_token from response>"

# Create business profile
curl -X POST http://localhost:8001/api/business \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"business_name":"Test Plumbing","owner_name":"John Test"}'
```

**Expected:** Both return 200 with JSON response.

---

### 2. Create Lead

```bash
curl -X POST http://localhost:8001/api/leads \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Jane Customer",
    "phone": "555-123-4567",
    "email": "jane@example.com",
    "job_type": "Water Heater Replacement",
    "quote_amount": 2500,
    "preferred_channel": "SMS"
  }'
```

**Expected:** Returns lead with `status: "NEW"`, `id: 1`

---

### 3. Get Available Sequences

```bash
curl http://localhost:8001/api/sequences \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** Returns 3 built-in sequences (Friendly, Professional, Urgent)

---

### 4. Assign Sequence to Lead

```bash
curl -X POST http://localhost:8001/api/leads/1/assign-sequence \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sequence_id": 1}'
```

**Expected:** 
- Lead status changes to `FOLLOWING_UP`
- `next_followup_at` is set
- `current_sequence_id` is set

---

### 5. Trigger Worker (or wait 1 minute)

```bash
# Manual trigger
curl -X POST http://localhost:8001/api/debug/trigger-worker \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** Returns `{"status": "ok", "leads_processed": 1}`

---

### 6. Verify Message Was Sent

```bash
curl http://localhost:8001/api/leads/1/messages \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:**
```json
[
  {
    "id": 1,
    "lead_id": 1,
    "direction": "OUTBOUND",
    "channel": "SMS",
    "body": "Hey Jane! Just wanted to follow up...",
    "status": "SENT",
    "provider_message_id": "mock_sms_+15551234567"
  }
]
```

---

### 7. Simulate Inbound SMS Reply

```bash
curl -X POST http://localhost:8001/api/debug/inbound-sms \
  -H "Content-Type: application/json" \
  -d '{
    "from_phone": "+15551234567",
    "body": "Yes, I am interested!"
  }'
```

**Expected:** Returns `{"status": "ok", "lead_id": 1, "automation_stopped": true}`

---

### 8. Verify Automation Stopped

```bash
curl http://localhost:8001/api/leads/1 \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:**
- `status: "REPLIED"`
- `next_followup_at: null`

---

### 9. Verify Message Log Updated

```bash
curl http://localhost:8001/api/leads/1/messages \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** Now shows 2 messages:
1. OUTBOUND (sent by worker)
2. INBOUND (from debug endpoint)

---

### 10. Check Dashboard Stats

```bash
curl http://localhost:8001/api/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:**
```json
{
  "todays_followups": 0,
  "hot_leads": 0,
  "pipeline_counts": {
    "NEW": 0,
    "FOLLOWING_UP": 0,
    "REPLIED": 1,
    "WON": 0,
    "LOST": 0,
    "GHOSTED": 0
  },
  "money_at_risk": 0
}
```

---

## Summary Checklist

- [ ] Create account and login
- [ ] Create business profile
- [ ] Create lead with phone/email
- [ ] Verify 3 built-in sequences exist
- [ ] Assign sequence to lead
- [ ] Worker sends first message (within 1 min or manual trigger)
- [ ] Message appears in lead's message log
- [ ] Inbound SMS reply stops automation
- [ ] Lead status changes to REPLIED
- [ ] Message log shows both OUTBOUND and INBOUND
- [ ] Dashboard stats update correctly

---

## Troubleshooting

**Worker not sending messages?**
- Check `MOCK_MODE=true` in `.env`
- Verify lead has `status=FOLLOWING_UP` and `next_followup_at` in the past
- Check server logs for errors

**Inbound SMS not matching lead?**
- Phone numbers must match by last 10 digits
- Stored: `555-123-4567` → digits: `5551234567`
- Incoming: `+15551234567` → digits: `5551234567`
- Both match!

**API returning 401?**
- Token expired (24 hours)
- Login again to get new token
