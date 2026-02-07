# FollowUp Pro v2

**A production-ready MVP mobile app for service professionals to manage leads, automate follow-ups, and enable self-service booking.**

## 🎯 Business Goal

Increase a service pro's close rate by:
- Automating lead follow-up sequences
- Enabling customers to self-book appointments
- Tracking lead source effectiveness and ROI

## 📱 Features

### Core Features
- **Universal Lead Inbox & Pipeline**: Manage leads from any source with status tracking (NEW → CONTACTED → BOOKED → WON/LOST)
- **Quick Responses (Templates)**: Pre-built templates for SMS, Email, and platform-specific replies
- **Auto Booking & Scheduling**: Set availability, generate public booking links, ICS calendar files
- **Follow-Up Automation**: Automated SMS/Email sequences with configurable delays
- **Lead Source Analytics**: Track leads, bookings, revenue, and ROI by source
- **Push Notifications**: Real-time alerts for new bookings and reminders

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
cd /app/backend
sudo supervisorctl restart backend

# 3. Start Mobile (Expo)
cd /app/frontend
sudo supervisorctl restart expo
```

## 🧪 Testing

See [docs/SMOKE_TEST.md](docs/SMOKE_TEST.md) for comprehensive smoke tests.

**Demo Account:**
- Email: `demo@followuppro.com`
- Password: `demo123`

## 📊 API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `PATCH /api/auth/me` - Update profile

### Leads
- `GET /api/leads` - List leads (with filters)
- `POST /api/leads` - Create lead
- `GET /api/leads/{id}` - Get lead details
- `PATCH /api/leads/{id}` - Update lead
- `DELETE /api/leads/{id}` - Delete lead

### Lead Sources & Analytics
- `GET /api/lead-sources` - List sources
- `POST /api/lead-sources` - Create source
- `GET /api/analytics/summary` - Get analytics dashboard data
- `POST /api/source-costs` - Record marketing spend

### Templates & Follow-ups
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `GET /api/follow-up-plans` - List plans
- `POST /api/follow-up-plans` - Create plan

### Booking
- `GET /api/availability` - Get availability rules
- `PUT /api/availability` - Set availability
- `GET /api/book/{publicId}/slots` - Public: Get available slots
- `POST /api/book/{publicId}` - Public: Book appointment

### Debug (MOCK_MODE)
- `POST /api/debug/send-push` - Test push notifications
- `POST /api/debug/trigger-worker` - Trigger background worker
- `POST /api/debug/inbound-message` - Simulate incoming message

## 📁 Project Structure

```
/app
├── backend/              # FastAPI backend
│   ├── server.py         # Main API server
│   ├── models.py         # SQLAlchemy models
│   ├── schemas.py        # Pydantic schemas
│   ├── crud.py           # Database operations
│   ├── auth.py           # JWT authentication
│   └── services/         # Business logic
│       ├── messaging.py  # SMS/Email via Twilio/SendGrid
│       ├── push_notifications.py  # Expo Push
│       ├── ics_generator.py       # Calendar files
│       └── worker.py     # Background job processor
├── frontend/             # Expo mobile app
│   ├── app/              # Expo Router screens
│   └── src/              # Components, stores, API
└── docs/                 # Documentation
    ├── SETUP.md
    └── SMOKE_TEST.md
```

## 📝 License

MIT
