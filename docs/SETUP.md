# Setup Guide - FollowUp Pro v2

## Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL 15+
- Expo CLI

## Backend Setup

### 1. PostgreSQL Database

```bash
# Start PostgreSQL
sudo service postgresql start

# Create database and user (if not exists)
sudo -u postgres psql << EOF
CREATE USER followup_user WITH PASSWORD 'followup_pass';
CREATE DATABASE followup_db OWNER followup_user;
GRANT ALL PRIVILEGES ON DATABASE followup_db TO followup_user;
EOF
```

### 2. Environment Variables

```bash
cd /app/backend
cp .env.example .env
# Edit .env with your settings (or use defaults for MOCK_MODE)
```

**Key variables:**
- `MOCK_MODE=true` - Run without real Twilio/SendGrid/Stripe keys
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Change in production!

### 3. Install Dependencies

```bash
cd /app/backend
pip install -r requirements.txt
```

### 4. Start Backend

```bash
sudo supervisorctl restart backend

# Check health
curl http://localhost:8001/api/health
```

## Frontend Setup

### 1. Environment Variables

```bash
cd /app/frontend
cp .env.example .env
```

### 2. Install Dependencies

```bash
cd /app/frontend
yarn install
```

### 3. Start Expo

```bash
sudo supervisorctl restart expo

# Or manually:
yarn start
```

## Creating Demo Account

```bash
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@followuppro.com",
    "password": "demo123",
    "pro_name": "John Smith",
    "business_name": "Smith Plumbing",
    "timezone": "America/New_York"
  }'
```

## Verification

1. **Backend Health**: `curl http://localhost:8001/api/health`
2. **Login**: Use demo credentials on mobile app
3. **Check Logs**: 
   - Backend: `tail -f /var/log/supervisor/backend.err.log`
   - Frontend: `tail -f /var/log/supervisor/expo.out.log`

## MOCK_MODE Features

When `MOCK_MODE=true`:

- **SMS/Email**: Messages logged to `message_logs` table with status `MOCKED`
- **Push Notifications**: Logged to console, not sent to devices
- **Stripe**: Payment flows work but no actual charges

### Debug Endpoints

```bash
TOKEN="your-jwt-token"

# Test push notification
curl -X POST http://localhost:8001/api/debug/send-push \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "body": "Hello!"}'

# Trigger background worker
curl -X POST http://localhost:8001/api/debug/trigger-worker \
  -H "Authorization: Bearer $TOKEN"

# Simulate incoming message
curl -X POST http://localhost:8001/api/debug/inbound-message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"lead_id": "uuid", "channel": "SMS", "body": "Reply from customer"}'
```

## Production Deployment

For production, set these environment variables:

```bash
MOCK_MODE=false
JWT_SECRET=<strong-random-secret>
TWILIO_ACCOUNT_SID=<your-sid>
TWILIO_AUTH_TOKEN=<your-token>
TWILIO_PHONE_NUMBER=<your-number>
SENDGRID_API_KEY=<your-key>
STRIPE_SECRET_KEY=<your-key>
STRIPE_WEBHOOK_SECRET=<your-secret>
```
