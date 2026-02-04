# FollowUp Pro - Setup Guide

## Prerequisites

- Node.js 18+ 
- Python 3.11+
- PostgreSQL 15+
- Docker (optional, for PostgreSQL)
- Expo CLI (`npm install -g expo-cli`)

## Quick Start

### 1. Clone & Install

```bash
# Clone repository
git clone <repo-url>
cd followup-pro

# Install server dependencies
cd server
pip install -r requirements.txt

# Install mobile dependencies  
cd ../mobile
yarn install
```

### 2. Database Setup

**Option A: Docker (Recommended)**
```bash
# From project root
docker-compose up -d

# Verify PostgreSQL is running
docker ps
```

**Option B: Local PostgreSQL**
```bash
# Create database and user
sudo -u postgres psql
CREATE USER followup_user WITH PASSWORD 'followup_pass';
CREATE DATABASE followup_db OWNER followup_user;
GRANT ALL PRIVILEGES ON DATABASE followup_db TO followup_user;
\q
```

### 3. Environment Configuration

```bash
# Server
cd server
cp .env.example .env
# Edit .env with your credentials

# Mobile
cd ../mobile  
cp .env.example .env
# Edit .env with your backend URL
```

### 4. Run the Server

```bash
cd server

# Start the API server (includes scheduler)
python server.py

# Or with uvicorn for development
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

The server will:
- Initialize the database tables
- Seed built-in sequences (Friendly, Professional, Urgent)
- Start the follow-up scheduler (runs every minute)

### 5. Run the Mobile App

```bash
cd mobile

# Start Expo development server
yarn start

# Or for specific platforms
yarn ios     # iOS simulator
yarn android # Android emulator
yarn web     # Web browser
```

## Migrations & Seeding

The server automatically:
1. Creates all database tables on startup (`init_db()`)
2. Seeds 3 built-in sequences (`seed_builtin_sequences()`)

To manually reset the database:
```bash
# Drop and recreate database
sudo -u postgres psql -c "DROP DATABASE followup_db;"
sudo -u postgres psql -c "CREATE DATABASE followup_db OWNER followup_user;"

# Restart server to recreate tables
python server.py
```

## Testing the Worker

The follow-up scheduler is an **APScheduler interval job** that runs every minute inside the server process.

### How it works:
1. Finds leads with `status=FOLLOWING_UP` and `next_followup_at <= now`
2. Sends the message via Twilio/SendGrid (or logs if MOCK_MODE=true)
3. Advances to next step or marks lead as GHOSTED if complete
4. Logs everything to `message_logs` table

### To test locally:

```bash
# 1. Create a lead and assign sequence
curl -X POST http://localhost:8001/api/leads \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Test Lead","phone":"555-123-4567","job_type":"Test Job"}'

# 2. Assign sequence (this sets next_followup_at to now)
curl -X POST http://localhost:8001/api/leads/1/assign-sequence \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sequence_id":1}'

# 3. Wait 1 minute or trigger manually
curl -X POST http://localhost:8001/api/debug/trigger-worker \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Check message logs
curl http://localhost:8001/api/leads/1/messages \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Webhook Configuration

See [WEBHOOKS.md](./WEBHOOKS.md) for detailed webhook setup.
