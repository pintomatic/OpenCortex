# Cortex

**AI Chief of Staff — persistent memory, tasks, CRM, and integrations for Claude.**

Every Claude conversation starts from zero. Cortex fixes that. It gives Claude persistent knowledge about *your* world — who you are, what you're working on, who you know, what's on your calendar.

You deploy it on your own Google Cloud. Your data never leaves your infrastructure.

---

## Quick Start (3 steps)

### 1. Deploy to Google Cloud

[![Run on Google Cloud](https://deploy.cloud.run/button.svg)](https://deploy.cloud.run/?git_repo=https://github.com/pintomatic/OpenCortex)

This creates a Cloud Run service and Firestore database in your own GCP project. You'll need:
- A Google Cloud account ([free tier](https://cloud.google.com/free) works)
- The `FIREBASE_SERVICE_ACCOUNT` JSON (see [Setup Guide](#getting-your-firebase-service-account) below)

### 2. Set Up Your Cortex

After deployment, visit your Cloud Run URL. You'll see the setup page:

1. Enter your name
2. Pick your life domains (Work, Personal, Health, etc.)
3. Click **"Create My Cortex"**
4. Save the API key it gives you

### 3. Connect to Claude

Copy the instructions from the setup page and paste them into:

**Claude.ai** → Settings → Profile → Custom Instructions

That's it. Every new conversation will now know who you are.

---

## What You Get

### Tier 1: Core (makes AI conversations contextual)
- **Memories** — persistent knowledge that survives across conversations
- **Tasks** — to-do list with due dates, priorities, and list organization
- **Bootstrap** — one API call loads your full context at conversation start
- **Self-documenting** — OpenAPI 3.0 schema at `/api/schema`

### Tier 2: Relationships (for people who manage people)
- **Contacts + Activities** — track interactions with people
- **Accounts** — companies and organizations
- **Pipeline** — CRM pipeline by stage
- **Meeting Prep** — full context bundle before any meeting
- **Transcripts** — meeting transcript storage

### Tier 3: Integrations (connect your tools)
- **Google Calendar** — read/write calendar events
- **Gmail** — read, search, send, reply to emails
- Requires Google OAuth setup (see [Integrations Guide](docs/INTEGRATIONS.md))

---

## How It Works

```
Your GCP Project                    Claude
┌─────────────────────────┐        ┌──────────────┐
│                         │        │              │
│  Cloud Run (Cortex API) │◄──────►│  Claude.ai   │
│    46 REST endpoints    │  HTTP  │  (via curl)  │
│    API key auth         │        │              │
│                         │        │  Claude Code │
│  Firestore              │        │  (via curl)  │
│    memories, tasks,     │        │              │
│    contacts, accounts   │        │  Claude Code │
│                         │        │              │
│  Google OAuth (yours)   │        └──────────────┘
│    Calendar + Gmail     │
│                         │
└─────────────────────────┘
```

Each instance is **single-tenant** — one user, one deployment. Your data lives in your cloud.

---

## Getting Your Firebase Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select (or create) your project
3. Navigate to **IAM & Admin** → **Service Accounts**
4. Click the default service account (or create one)
5. Go to **Keys** → **Add Key** → **Create new key** → **JSON**
6. Download the JSON file — this is your `FIREBASE_SERVICE_ACCOUNT`

You'll also need to enable these APIs in your project:
- Cloud Run API
- Cloud Firestore API

---

## API Endpoints

| Endpoint | Method | What it does |
|----------|--------|-------------|
| `/setup` | GET/POST | Web-based onboarding (no auth) |
| `/health` | GET | Health check (no auth) |
| `/api/schema` | GET | Full OpenAPI 3.0 spec (no auth) |
| `/api/bootstrap` | GET | Load full context for AI |
| `/api/memories` | GET/POST | List/create memories |
| `/api/memories/:id` | GET/PATCH/DELETE | Memory CRUD |
| `/api/memories/search` | GET | Search memories |
| `/api/domains` | GET | List domains with counts |
| `/api/tasks` | GET/POST | List/create tasks |
| `/api/tasks/:id` | GET/PATCH/DELETE | Task CRUD |
| `/api/tasks/summary` | GET | Task statistics |
| `/api/tasks/upcoming` | GET | Due soon |
| `/api/lists` | GET/POST | List management |
| `/api/keys` | GET | List API keys (masked) |
| `/api/keys/rotate` | POST | Generate new key |
| `/api/contacts` | GET/POST | Contact CRUD |
| `/api/accounts` | GET/POST | Account CRUD |
| `/api/pipeline` | GET | Pipeline overview |
| `/api/meeting-prep/:id` | GET | Meeting preparation |
| `/api/calendar/today` | GET | Today's events |
| `/api/emails/recent` | GET | Recent emails |
| *... and more* | | See `/api/schema` for full list |

Auth: API key via `?key=YOUR_KEY` or `x-api-key` header.

### Admin Endpoints

Manage users on your instance. Requires `ADMIN_API_KEY` environment variable.

| Endpoint | Method | What it does |
|----------|--------|-------------|
| `/api/admin/users` | GET | List all users with stats |
| `/api/admin/users/:userId` | GET | Detailed user info |
| `/api/admin/users/:userId` | DELETE | Delete user and all data |

Auth: `?admin_key=YOUR_ADMIN_KEY` or `x-admin-key` header.

```bash
# Set admin key on Cloud Run
gcloud run services update open-cortex --region us-central1 \
  --update-env-vars ADMIN_API_KEY=your_secret_admin_key

# List all users
curl "https://your-url/api/admin/users?admin_key=your_secret_admin_key"
```

---

## Local Development

```bash
git clone https://github.com/pintomatic/OpenCortex.git
cd OpenCortex
npm install
npm run build

# Set environment variables
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'

# Run locally
npm start
# → http://localhost:8080/setup
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20 + TypeScript |
| Framework | Express.js |
| Database | Google Cloud Firestore |
| Hosting | Google Cloud Run |
| Auth | API key (simple, works everywhere) |
| Calendar | Google Calendar API |
| Email | Gmail API |
| Schema | OpenAPI 3.0 |

**Cost**: $0-5/month on GCP free tier.

---

## License

MIT

---

Built by [Andes](https://andes.no) — AI consulting for people who ship.
