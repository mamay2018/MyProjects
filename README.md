# FollowUp Pro

A production-ready mobile app that helps service professionals automatically follow up with leads via SMS + Email until the client replies or the lead is marked won/lost.

## 📁 Project Structure

```
followup-pro/
├── mobile/              # React Native (Expo) mobile app
│   ├── app/             # Expo Router screens
│   ├── src/             # Components, store, API, types
│   ├── package.json
│   └── .env.example
├── server/              # FastAPI backend + worker
│   ├── server.py        # Main API server with scheduler
│   ├── database.py      # PostgreSQL connection
│   ├── models.py        # SQLAlchemy models
│   ├── schemas.py       # Pydantic schemas
│   ├── auth.py          # JWT authentication
│   ├── services/        # Messaging, AI, Stripe services
│   ├── requirements.txt
│   └── .env.example
├── docs/                # Documentation
│   ├── SETUP.md         # Full setup guide
│   ├── WEBHOOKS.md      # Webhook configuration
│   └── SMOKE_TEST.md    # End-to-end test checklist
└── docker-compose.yml   # PostgreSQL setup
```

## 🚀 Quick Start

### 1. Start PostgreSQL

```bash
docker-compose up -d
```

### 2. Start the Server

```bash
cd server
cp .env.example .env
# Edit .env with your settings (MOCK_MODE=true by default)

pip install -r requirements.txt
python server.py
```

The server will:
- Create database tables
- Seed 3 built-in sequences (Friendly, Professional, Urgent)
- Start the follow-up scheduler (runs every 1 minute)

### 3. Start the Mobile App

```bash
cd mobile
cp .env.example .env
# Edit .env with your backend URL

yarn install
yarn start
```

## ⚙️ Follow-up Scheduler

The scheduler is an **APScheduler interval job** running inside the server process:

```python
scheduler.add_job(process_followups, 'interval', minutes=1, id='followup_worker')
```

**What it does every minute:**
1. Finds leads with `status=FOLLOWING_UP` and `next_followup_at <= now`
2. Sends the message via Twilio/SendGrid (or logs if `MOCK_MODE=true`)
3. Advances to next sequence step
4. Marks lead as `GHOSTED` when sequence completes
5. Logs all activity to `message_logs` table

**To start manually:**
```bash
cd server
python server.py
# Scheduler starts automatically
```

**To trigger worker immediately (MOCK_MODE only):**
```bash
curl -X POST http://localhost:8001/api/debug/trigger-worker \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📱 Twilio Webhook

**Endpoint:** `POST /api/webhooks/twilio/sms`

**Expected payload (form-urlencoded):**
```
From=%2B15551234567
Body=Yes%20I%20am%20interested
MessageSid=SM123
```

**Phone matching:** Compares last 10 digits of incoming phone to stored leads:
```python
# Stored: 555-123-4567 → 5551234567
# Incoming: +15551234567 → 5551234567
# Match! ✓
```

**What happens:**
1. Inbound message logged with `direction=INBOUND`
2. Lead status changes to `REPLIED`
3. Automation stops (`next_followup_at=null`)

## 🧪 Debug Endpoints (MOCK_MODE only)

When `MOCK_MODE=true` in server `.env`:

| Endpoint | Description |
|----------|-------------|
| `POST /api/debug/inbound-sms` | Simulate inbound SMS |
| `POST /api/debug/trigger-worker` | Manually run follow-up worker |
| `GET /api/debug/status` | Check mock mode status |

**Simulate inbound SMS:**
```bash
curl -X POST http://localhost:8001/api/debug/inbound-sms \
  -H "Content-Type: application/json" \
  -d '{"from_phone": "+15551234567", "body": "Yes!"}'
```

## 📋 Environment Variables

### Server (.env)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT tokens |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number |
| `SENDGRID_API_KEY` | SendGrid API key |
| `FROM_EMAIL` | Sender email address |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |
| `EMERGENT_LLM_KEY` | OpenAI API key (via Emergent) |
| `MOCK_MODE` | `true` to disable real SMS/Email |

### Mobile (.env)

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_BACKEND_URL` | Backend API URL |

## ✅ Smoke Test

Run the full smoke test to verify everything works:

```bash
# See docs/SMOKE_TEST.md for complete checklist

# Quick test:
# 1. Create user + business
# 2. Create lead
# 3. Assign sequence → status becomes FOLLOWING_UP
# 4. Trigger worker → message sent
# 5. Simulate inbound → status becomes REPLIED, automation stops
```

## 🔗 Full Documentation

- [Setup Guide](./docs/SETUP.md)
- [Webhook Configuration](./docs/WEBHOOKS.md)
- [Smoke Test Checklist](./docs/SMOKE_TEST.md)

## 📄 License

MIT
