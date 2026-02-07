# FollowUp Pro v2

**A production-ready MVP mobile app for service professionals to manage leads, automate follow-ups, and enable self-service booking.**

## 🎯 Business Goal

Increase a service pro's close rate by:
- Automating lead follow-up sequences
- Enabling customers to self-book appointments
- Tracking lead source effectiveness and ROI

## 📱 Features

### Core Features (Implemented)
- **Universal Lead Inbox & Pipeline**: Manage leads from any source with status tracking (NEW → CONTACTED → BOOKED → WON/LOST)
- **Lead Source Tracking**: 8 default sources + custom sources with colors for visual identification
- **Lead Source Analytics**: Dashboard showing leads, bookings, won deals, revenue, close rate, and ROI by source
- **Quick Responses (Templates)**: Pre-built templates for SMS, Email, and platform-specific replies
- **Auto Booking & Scheduling**: Set availability, generate public booking links, ICS calendar files
- **Follow-Up Automation**: Automated SMS/Email sequences with configurable delays
- **Push Notifications**: Device token registration and notification sending (Expo Notifications)

### MOCK_MODE
All integrations work in `MOCK_MODE=true` without real API keys:
- Messages are logged to `MessageLog` table instead of being sent
- Push notifications are logged to console
- Debug endpoints allow testing flows manually

## 🛠 Tech Stack

- **Mobile**: React Native (Expo) with TypeScript
- **Backend**: Python (FastAPI)
- **Database**: PostgreSQL
- **Integrations**: Twilio (SMS), SendGrid (Email), Stripe (Payments), Expo Push Notifications

## 🚀 Quick Start

See [docs/SETUP.md](docs/SETUP.md) for detailed setup instructions.

```bash
# 1. Start PostgreSQL
sudo service postgresql start

# 2. Start Backend
sudo supervisorctl restart backend

# 3. Start Mobile (Expo)
sudo supervisorctl restart expo
```

## 🧪 Testing

See [docs/SMOKE_TEST.md](docs/SMOKE_TEST.md) for comprehensive smoke tests.

**Demo Account:**
- Email: `demo@followuppro.com`
- Password: `demo123`

## 📱 Mobile App Screens

### Dashboard
- Overview stats (total leads, won deals, revenue)
- Close rate and ROI metrics
- Pipeline status breakdown
- Recent leads list

### Leads
- Search and filter leads
- Status filters (New, Contacted, Booked, Won, Lost)
- Source filters (Google Ads, Thumbtack, Referral, etc.)
- Add new lead with source selector

### Lead Detail
- Contact actions (Call, SMS, Email, Share Booking Link)
- Status management with quick actions
- Mark as Won with job value entry
- Toggle follow-up automation
- Message history with status

### Analytics
- Period selector (7 days, 30 days, 90 days, All time)
- Summary metrics (leads, won, revenue, close rate)
- Source performance table
- ROI by source (when costs entered)

### Settings
- Profile information
- Public booking link sharing
- Push notification setup
- Weekly availability editor
- Booking settings (duration, buffer, daily limit)

## 📊 API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `PATCH /api/auth/me` - Update profile

### Leads
- `GET /api/leads` - List leads (with filters: status, source_id, search)
- `POST /api/leads` - Create lead (with lead_source_id)
- `GET /api/leads/{id}` - Get lead details
- `PATCH /api/leads/{id}` - Update lead (status, won_value_cents, etc.)
- `DELETE /api/leads/{id}` - Delete lead

### Lead Sources & Analytics
- `GET /api/lead-sources` - List sources
- `POST /api/lead-sources` - Create custom source
- `GET /api/analytics/summary` - Get analytics with source breakdown
- `POST /api/source-costs` - Record marketing spend

### Templates & Follow-ups
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `GET /api/follow-up-plans` - List plans
- `POST /api/follow-up-plans` - Create plan

### Booking
- `GET /api/availability` - Get availability rules
- `PUT /api/availability` - Set availability (bulk update)
- `GET /api/book/{publicId}/slots` - Public: Get available slots
- `POST /api/book/{publicId}` - Public: Book appointment

### Devices (Push Notifications)
- `POST /api/devices` - Register device token
- `GET /api/devices` - List registered devices
- `DELETE /api/devices/{id}` - Remove device

### Debug (MOCK_MODE)
- `POST /api/debug/send-push` - Test push notifications
- `POST /api/debug/trigger-worker` - Trigger background worker
- `POST /api/debug/inbound-message` - Simulate incoming message

## 📁 Project Structure

```
/app
├── backend/              # FastAPI backend
│   ├── server.py         # Main API server
│   ├── models.py         # SQLAlchemy models (13 tables)
│   ├── schemas.py        # Pydantic schemas
│   ├── crud.py           # Database operations + analytics
│   ├── auth.py           # JWT authentication
│   └── services/         # Business logic
│       ├── messaging.py  # SMS/Email via Twilio/SendGrid
│       ├── push_notifications.py  # Expo Push
│       ├── ics_generator.py       # Calendar files
│       └── worker.py     # Background job processor
├── frontend/             # Expo mobile app
│   ├── app/              # Expo Router screens
│   │   ├── (tabs)/       # Tab navigation
│   │   │   ├── index.tsx      # Dashboard
│   │   │   ├── leads.tsx      # Leads list
│   │   │   ├── analytics.tsx  # Analytics
│   │   │   └── settings.tsx   # Settings
│   │   └── lead/         # Lead screens
│   │       ├── new.tsx        # Create lead
│   │       └── [id].tsx       # Lead detail
│   └── src/              # Components, stores, API
└── docs/                 # Documentation
    ├── SETUP.md
    └── SMOKE_TEST.md
```

## 📝 Changelog

### v2.0.0 - Increment 2
- ✅ Dashboard with pipeline overview and recent leads
- ✅ Leads list with status and source filters
- ✅ Lead detail with contact actions, status management, won value entry
- ✅ New lead screen with source selector and paste text mode
- ✅ Analytics screen with source performance table
- ✅ Settings screen with availability editor
- ✅ Push notification device registration
- ✅ All screens use v2 API with source tracking

### v2.0.0 - Increment 1
- ✅ Complete PostgreSQL database schema (13 tables)
- ✅ All backend API endpoints with MOCK_MODE support
- ✅ Authentication with JWT
- ✅ Lead source management with defaults
- ✅ Analytics with per-source breakdown
- ✅ Public booking system with ICS generation
- ✅ Follow-up automation with scheduled sends
- ✅ Debug endpoints for testing

## 📝 License

MIT
