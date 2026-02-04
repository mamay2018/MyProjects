# FollowUp Pro - Webhook Configuration

## Twilio SMS Webhook

### Endpoint
```
POST /api/webhooks/twilio/sms
```

### Setup in Twilio Console

1. Go to [Twilio Console](https://console.twilio.com)
2. Navigate to Phone Numbers → Manage → Active Numbers
3. Click your phone number
4. Under "Messaging", set:
   - **A MESSAGE COMES IN**: Webhook
   - **URL**: `https://your-domain.com/api/webhooks/twilio/sms`
   - **HTTP Method**: POST

### Expected Payload (form-urlencoded)

```
From=%2B15551234567      # Sender phone (URL encoded +)
To=%2B15559876543        # Your Twilio number
Body=Yes%20I%20am%20interested  # Message text
MessageSid=SM1234567890  # Twilio message ID
AccountSid=AC1234567890  # Your Twilio account
```

### How Phone Matching Works

1. **Incoming phone is normalized to E.164:**
   ```python
   def normalize_phone(phone: str) -> str:
       # Remove all non-digit characters
       digits = re.sub(r'\D', '', phone)
       
       # Add country code if missing (assume US)
       if len(digits) == 10:
           digits = '1' + digits
       
       return '+' + digits
   ```

2. **Lead lookup compares last 10 digits:**
   ```python
   # Extract digits from both numbers
   incoming_digits = ''.join(filter(str.isdigit, normalized_phone))[-10:]
   stored_digits = ''.join(filter(str.isdigit, lead.phone))[-10:]
   
   # Match if last 10 digits are equal
   if incoming_digits == stored_digits:
       # Found matching lead!
   ```

### Response

```json
{"status": "ok", "lead_id": 123}
```

### What happens on inbound SMS:

1. Phone number is normalized
2. Lead is found by matching last 10 digits
3. Message is logged with `direction=INBOUND`
4. If lead was `FOLLOWING_UP`, status changes to `REPLIED`
5. Automation stops (`next_followup_at = null`)

---

## Stripe Webhook

### Endpoint
```
POST /api/webhooks/stripe
```

### Setup in Stripe Dashboard

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Set endpoint URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

---

## Debug Endpoints (MOCK_MODE only)

When `MOCK_MODE=true`, these endpoints are available:

### Simulate Inbound SMS
```bash
POST /api/debug/inbound-sms
Content-Type: application/json

{
  "from_phone": "+15551234567",
  "body": "Yes, I'm interested!"
}
```

### Trigger Worker Manually
```bash
POST /api/debug/trigger-worker
Authorization: Bearer YOUR_TOKEN
```

### Check Mock Messages
```bash
GET /api/debug/mock-messages
Authorization: Bearer YOUR_TOKEN
```
