# Cortex Open Source - Technical Build Brief

**Date:** February 22, 2026
**Author:** Cesar Pinto
**Status:** Ready for build
**First test user:** Dordi Blekken (partner, Sales Manager at Ulstein Digital - non-technical)
**Validation criteria:** If Dordi gets value from ALL three tiers without touching a terminal or asking Cesar for help, the product is ready.

---

## 1. What Is Cortex?

Cortex is an AI Chief of Staff - a personal knowledge system that gives any AI frontend (Claude, ChatGPT, Gemini) persistent memory, context, and agency about YOUR life and work. It solves the "amnesia problem": every AI conversation starts from zero. Cortex ensures the AI already knows your world.

**Current state (Cesar's instance):**
- 50 REST API endpoints on Google Cloud Run
- Firestore database (memories, tasks, contacts, accounts, transcripts, plans)
- Google Calendar + Gmail integration (read/write)
- Spotify integration
- Voice calls via Vapi.ai
- Scheduled messages
- CRM with pipeline tracking
- Deck library with contextual generation
- Full OpenAPI 3.0 schema at /api/schema

**The goal:** Make this deployable by anyone. Open source the core, so a new user can spin up their own Cortex instance and connect it to their AI of choice.

---

## 2. Architecture: "Own Your Brain"

This is NOT a SaaS where user data lives on our servers. Each user deploys Cortex on their own Google Cloud project. Their data never leaves their infrastructure.

```
User's GCP Project                          AI Frontend
+----------------------------------+        +------------------+
|                                  |        |                  |
|  Cloud Run (cortex-api)          |<------>|  Claude.ai       |
|    - REST API (Express/Node)     |  curl  |  (via bash_tool) |
|    - Auth via API key            |        |                  |
|                                  |        |  OR              |
|  Firestore                       |        |                  |
|    - memories collection         |        |  Claude Desktop  |
|    - tasks collection            |        |  (via MCP)       |
|    - contacts collection         |        |                  |
|    - accounts collection         |        |  OR              |
|    - transcripts collection      |        |                  |
|    - plans collection            |        |  Any LLM with    |
|    - lists collection            |        |  HTTP capability  |
|                                  |        +------------------+
|  Google OAuth (user's own)       |
|    - Calendar read/write         |
|    - Gmail read/send             |
|                                  |
+----------------------------------+
```

**Key design decisions:**
- API key auth (simple, works everywhere) - NOT OAuth between user and Cortex
- Each instance is single-tenant (one user, one deployment)
- AI-frontend agnostic - any LLM that can make HTTP calls works
- No background daemons (Anthropic policy: consumer OAuth cannot be used outside Claude.ai/Claude Code)
- Intelligence happens when the user is in conversation, not autonomously

---

## 3. Tiered Endpoint Architecture

The tiers exist for progressive documentation in the open source repo - so self-serve developers can start simple and grow. For managed onboarding (like Dordi), ALL tiers are deployed from day one. A managed user should never feel like they're on a "starter" plan.

### Tier 1: Core (MVP - "Cortex Start")
**This is what Dordi gets first.** The minimum to make AI conversations contextual.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /api/bootstrap | GET | Load full context at conversation start |
| /api/schema | GET | OpenAPI 3.0 self-documentation |
| /api/memories | GET, POST | List/create persistent memories |
| /api/memories/search | GET | Search memories by keyword |
| /api/memories/:id | GET, PATCH, DELETE | Single memory CRUD |
| /api/domains | GET | List memory domains with counts |
| /api/domain/:domain | GET | Domain-specific context bundle |
| /api/tasks | GET, POST | List/create tasks |
| /api/tasks/search | GET | Search tasks by keyword |
| /api/tasks/:id | GET, PATCH, DELETE | Single task CRUD |
| /api/tasks/summary | GET | Task statistics |
| /api/tasks/upcoming | GET | Tasks due soon |
| /api/lists | GET, POST | Task list management |
| /api/lists/:id | DELETE | Delete list |
| /api/keys | GET | List API keys (masked) |
| /api/keys/rotate | POST | Rotate API key |
| /api/keys/:keyId | DELETE | Revoke specific key |

**17 endpoints. This alone transforms the AI experience.**

Memory fields: { content, category, domain, subjects[], confidence, source }
Task fields: { title, listName, body, dueDate, importance }

### Tier 2: Relationships ("Cortex Full")
For users who manage people - sales, consulting, leadership.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /api/accounts | GET, POST | Companies/organizations |
| /api/accounts/:id | GET, PATCH, DELETE | Account CRUD |
| /api/contacts | GET, POST | People with filters |
| /api/contacts/:id | PATCH, DELETE | Contact CRUD |
| /api/contacts/:id/activities | GET, POST | Interaction log |
| /api/contacts/:id/activities/:activityId | PATCH, DELETE | Activity CRUD |
| /api/contacts/:id/latest-activity | GET | Most recent + days since |
| /api/contacts/:id/hide | POST | Soft delete |
| /api/pipeline | GET | Pipeline overview by stage |
| /api/meeting-prep/:memberId | GET | Full context for a person |
| /api/transcripts | GET, POST | Meeting transcript storage |
| /api/plans | POST | Strategic plans |
| /api/plans/:id | PATCH | Update plans |
| /api/tasks/for-contact/:name | GET | Tasks mentioning a person |

### Tier 3: Integrations ("Cortex Connected")
External service connections. Each is optional and requires the user's own OAuth tokens.

| Integration | Endpoints | Requires |
|-------------|-----------|----------|
| Google Calendar | /api/calendar/* (6 endpoints) | Google OAuth |
| Gmail | /api/emails/* (5 endpoints) | Google OAuth |
| Spotify | /api/spotify/* (7 endpoints) | Spotify OAuth |
| Voice Calls | /api/calls/* (3 endpoints) | Vapi.ai account |
| Scheduled Messages | /api/scheduled-messages/* (3 endpoints) | Cloud Scheduler |
| Deck Library | /api/decks/* (4 endpoints) | Content in Firestore |

---

## 4. Data Model (Firestore Collections)

### memories
```json
{
  "id": "auto",
  "userId": "string",
  "content": "string (the actual memory, self-contained)",
  "category": "enum: context | decision | learning | preference | identity",
  "domain": "string (e.g. work, health, finance, relationships)",
  "subjects": ["string array for tagging"],
  "confidence": "number 0-1",
  "source": "string (manual | conversation | import)",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### tasks
```json
{
  "id": "auto",
  "userId": "string",
  "title": "string",
  "listName": "string (maps to a Life-OS domain list)",
  "body": "string (markdown, structured with next/context/reference)",
  "dueDate": "string ISO date",
  "importance": "enum: normal | high",
  "completed": "boolean",
  "completedAt": "timestamp | null",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### lists
```json
{
  "id": "auto",
  "userId": "string",
  "name": "string",
  "createdAt": "timestamp"
}
```

### contacts
```json
{
  "id": "auto",
  "userId": "string",
  "name": "string",
  "email": "string",
  "roleTitle": "string",
  "companyId": "string (ref to accounts)",
  "accountName": "string (denormalized)",
  "pipelineStage": "enum: Identify | Qualify | Engage | Propose | Close | Nurture",
  "clientStatus": "string",
  "nextActionNote": "string",
  "assignedRole": "string",
  "hidden": "boolean",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### accounts
```json
{
  "id": "auto",
  "userId": "string",
  "name": "string",
  "workspace": "string",
  "industry": "string",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### activities (subcollection of contacts)
```json
{
  "id": "auto",
  "type": "enum: email | call | meeting | linkedin | note | proposal | other",
  "note": "string",
  "date": "timestamp",
  "nextStep": "string",
  "createdAt": "timestamp"
}
```

### transcripts
```json
{
  "id": "auto",
  "userId": "string",
  "title": "string",
  "content": "string (full transcript text)",
  "summary": "string",
  "memberId": "string (ref to contacts)",
  "accountId": "string (ref to accounts)",
  "createdAt": "timestamp"
}
```

---

## 5. Bootstrap: The Magic Endpoint

/api/bootstrap is the most important endpoint. It's what the AI calls at the start of every conversation to load context. It returns:

```json
{
  "instructions": "System prompt for the AI - who the user is, how to behave",
  "user": {
    "name": "string",
    "identityFacts": ["array of identity memories"]
  },
  "recentDecisions": ["last N decision-category memories"],
  "preferences": ["preference-category memories"],
  "activeTasks": ["tasks due within 7 days, sorted by importance"],
  "taskSummary": { "total": 0, "overdue": 0, "dueSoon": 0, "highPriority": 0 },
  "api": {
    "version": "string",
    "baseUrl": "string",
    "schemaUrl": "/api/schema",
    "endpoints": ["simplified endpoint directory"]
  },
  "lifeOsLists": ["array of list names"],
  "currentDate": "YYYY-MM-DD",
  "currentTime": "HH:MM:SS"
}
```

**The bootstrap response is what makes the AI "know" you.** A new user's onboarding is essentially: populate memories + configure bootstrap instructions.

---

## 6. Onboarding Flow (Dordi's Setup)

### Step 1: Deploy infrastructure (15 minutes)
```bash
# Clone the repo
git clone https://github.com/andes-no/cortex.git
cd cortex

# Run setup script
./setup.sh
# Prompts for:
#   - Google Cloud project ID (creates new or uses existing)
#   - User's name
#   - Preferred language (en/no)
#   - Life-OS domains (suggest defaults, let them customize)
```

The setup script should:
1. Enable required GCP APIs (Cloud Run, Firestore, Secret Manager)
2. Create Firestore database
3. Deploy Cloud Run service
4. Generate first API key
5. Seed default lists (Work, Personal, Health, Finance, Home, Travel)
6. Create initial bootstrap config
7. Output the bootstrap curl command ready to paste into Claude preferences

### Step 2: Configure AI frontend (5 minutes)
Paste into Claude.ai user preferences:
```
Before responding, run:
curl -s "https://[USER_CLOUD_RUN_URL]/api/bootstrap?key=[USER_API_KEY]"
Parse the JSON. Follow instructions in the response.
```

### Step 3: Discovery session (30-60 minutes)
The AI (now connected to Cortex) runs a structured onboarding conversation:

"Tell me about your work, your key relationships, your current projects, what keeps you up at night..."

Each answer gets stored as memories with appropriate categories and domains. By the end of the session, the AI has 20-50 memories and the bootstrap already returns rich context.

### Step 4: Daily use
Every new conversation auto-bootstraps. The AI knows who you are. Memories compound over time.

---

## 7. Dordi-Specific Setup Plan

Dordi is Sales Manager at Ulstein Digital - a similar client-facing role to Cesar but with less interest in the tech itself. She manages relationships, pipeline, meetings, follow-ups. Everything just needs to work. She is the perfect test user because if the system requires technical curiosity to get value, it's not ready for market.

**Dordi gets ALL THREE TIERS from day one.** The tiering is for the open source docs (progressive complexity for self-serve users), not for managed onboarding. A managed user gets the full experience deployed and configured.

**Life domains / lists:**
- Ulstein-OS (client accounts, pipeline, follow-ups)
- Personal (family, social, Vilma)
- Home (shared with Cesar - Raholt house, contractors)
- Health (her health context)
- Travel (shared travel planning, home exchanges, direct flights preference)
- Finance (personal finance tracking)

**Integrations (all configured during setup):**
- Google Calendar (her calendar, read/write)
- Gmail (her email, read/send)
- Full CRM (accounts, contacts, activities, pipeline, meeting prep)

**Key onboarding context to seed:**
- Ulstein Digital account structure and her key client relationships
- Her communication style preferences (Claude learns from the discovery session)
- Shared context with Cesar (home, travel, Vilma)
- Her preference for direct flights (motion sickness)
- Norwegian as working language for client comms, English fine for AI interaction

**Non-negotiable UX requirements (the Dordi test):**
- Zero terminal usage. She should never see a command line after initial deployment.
- No debugging. If something breaks, it should fail gracefully with a clear message, not a stack trace.
- Bootstrap must work silently. She pastes the preference once, then forgets about it.
- Every endpoint must return useful error messages, not HTTP status codes.
- Calendar and email must "just work" - no token refresh prompts, no re-auth flows mid-conversation.

**Success criteria:**
1. Dordi can start a Claude conversation and it knows her name, role, current clients, and priorities
2. She can say "remind me to follow up with [client]" and it creates a task in Ulstein-OS
3. She can say "prep me for my meeting with [name]" and get full context (last activity, pipeline stage, notes)
4. She can say "what's on my calendar tomorrow" and get her schedule
5. She can say "draft a follow-up email to [client]" and get something she'd actually send
6. After 2 weeks of use, the bootstrap returns enough context that conversations feel continuous
7. She never has to explain her background or client context twice
8. She never has to troubleshoot anything technical
9. Month 2: she actively prefers starting conversations in Claude over starting from scratch elsewhere

---

## 8. Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Runtime | Node.js + TypeScript | Matches current Cortex, wide ecosystem |
| Framework | Express.js | Simple, proven, easy to extend |
| Database | Firestore | Serverless, real-time, generous free tier |
| Hosting | Google Cloud Run | Auto-scales to zero, pay per request |
| Secrets | Google Secret Manager | API keys, OAuth tokens |
| Auth | API key via query param or header | Simple, works in curl from any AI |
| Calendar | Google Calendar API | Direct OAuth |
| Email | Gmail API | Direct OAuth |
| Schema | OpenAPI 3.0 | Self-documenting, AI-readable |

**Why GCP over alternatives:**
- Firestore free tier: 1GB storage, 50K reads/day, 20K writes/day (more than enough for personal use)
- Cloud Run free tier: 2M requests/month
- Total cost for personal Cortex: $0-5/month
- Single ecosystem (no gluing AWS + Firebase + Heroku)

---

## 9. Repository Structure

```
cortex/
  README.md                    # Quick start, what is Cortex
  LICENSE                      # MIT or Apache 2.0
  setup.sh                     # One-command deployment script
  
  src/
    index.ts                   # Express app entry point
    routes/
      bootstrap.ts             # The magic /api/bootstrap endpoint
      schema.ts                # OpenAPI spec generator
      memories.ts              # Memory CRUD + search
      tasks.ts                 # Task CRUD + search + summary
      lists.ts                 # List management
      contacts.ts              # Contact CRUD + activities
      accounts.ts              # Account CRUD
      pipeline.ts              # Pipeline view
      meeting-prep.ts          # Meeting preparation context
      transcripts.ts           # Transcript storage
      plans.ts                 # Strategic plans
      calendar.ts              # Google Calendar integration
      emails.ts                # Gmail integration
      keys.ts                  # API key management
    middleware/
      auth.ts                  # API key validation
      cors.ts                  # CORS configuration
    services/
      firestore.ts             # Firestore client + helpers
      google-auth.ts           # Google OAuth token management
      bootstrap-builder.ts     # Assembles bootstrap response
    config/
      defaults.ts              # Default lists, categories, domains
      
  scripts/
    setup.sh                   # GCP project setup
    seed.sh                    # Seed initial data
    migrate.sh                 # Data migration helpers
    
  docs/
    ONBOARDING.md              # Discovery session guide
    AI-INSTRUCTIONS.md         # How to configure Claude/ChatGPT/Gemini
    INTEGRATIONS.md            # Setting up Calendar, Gmail, etc.
    SELF-HOSTING.md            # Detailed deployment guide
    
  .github/
    workflows/
      deploy.yml               # Auto-deploy on push to main
```

---

## 10. Open Source Strategy

### What's open source (MIT license):
- Complete Cortex API (all tiers)
- Setup and deployment scripts
- Onboarding guides
- AI configuration templates
- All integrations

### What Andes sells (commercial):
- Managed onboarding ("the Sherpa") - 25K NOK setup
- The 300 Club community - 3K NOK/month
- Monthly optimization calls
- Enterprise deployments
- Custom integrations
- Training and workshops

**The software is free. The expertise is the product.**

This is the Red Hat model: open core, commercial services. The code being open actually accelerates trust and adoption. Nobody has to worry about vendor lock-in because they own their data AND the code.

---

## 11. Build Priorities

### Sprint 1: Full MVP (Dordi can use it - ALL tiers)
- [ ] Extract all endpoints from current codebase into clean standalone repo
- [ ] Create setup.sh deployment script (zero-terminal after first run)
- [ ] Bootstrap endpoint with configurable user profile
- [ ] Memory CRUD + search
- [ ] Task CRUD + search + summary + lists
- [ ] Contact + Account CRUD + activities + pipeline
- [ ] Meeting prep endpoint
- [ ] Transcripts
- [ ] Google OAuth setup flow (Calendar + Gmail)
- [ ] Calendar read/write
- [ ] Gmail read/send
- [ ] API key auth + rotation
- [ ] OpenAPI schema generation
- [ ] Error messages that make sense to non-technical users
- [ ] Token refresh that works silently (no mid-conversation auth prompts)
- [ ] README with quickstart
- [ ] AI-INSTRUCTIONS.md for Claude.ai preferences setup
- [ ] ONBOARDING.md discovery session guide

### Sprint 2: Dordi onboarding + hardening
- [ ] Deploy Dordi's instance
- [ ] Run discovery session, seed her context
- [ ] Seed Ulstein Digital account + key contacts
- [ ] Connect her Google Calendar + Gmail
- [ ] 2-week daily monitoring - fix anything that breaks
- [ ] Document every friction point she hits
- [ ] Iterate based on real usage patterns

### Sprint 3: Polish for open source release
- [ ] Security audit
- [ ] Rate limiting
- [ ] Error handling standardization
- [ ] Documentation review (all friction points from Dordi's onboarding become docs)
- [ ] GitHub Actions CI/CD
- [ ] Contributing guide
- [ ] Demo video (use Dordi's journey as the narrative)

---

## 12. Constraints and Decisions

**Anthropic OAuth policy (Feb 2026):** Consumer OAuth tokens can only be used in Claude Code and Claude.ai. No background daemons. All intelligence happens inside the AI conversation when the user is present. The bootstrap/curl pattern from within Claude.ai is fully compliant.

**No PATCH/DELETE on transcripts:** Current API limitation. Should be fixed in open source version.

**Memory quality matters more than quantity:** Memories must be self-contained, dated, atomic. Bad memories pollute the bootstrap. Include memory hygiene guidelines in onboarding docs.

**Bootstrap token budget:** The bootstrap response needs to fit within reasonable token limits. Current Cesar's bootstrap is ~3K tokens. For new users it'll start much smaller. Include a max_tokens parameter on bootstrap to control response size.

**Single-tenant only for v1:** Each Cortex instance serves one user. Multi-tenant (family, team) is a future consideration but not in scope for initial release.

---

## 13. Success Metrics

**For Dordi (first user - full deployment):**
- Time from "setup.sh" to first working conversation: < 30 minutes
- Time to "this feels useful": < 1 week
- Times she asks Cesar for technical help: zero (target)
- Uses meeting prep before a client call within first 2 weeks
- Creates tasks and memories naturally without instructions
- Pipeline tracking reflects her actual Ulstein Digital deals by week 3
- Calendar + email integration works without a single auth interruption
- After month 1: she opens Claude before opening her CRM
- After month 2: she would be annoyed if Cortex was taken away

**For open source:**
- GitHub stars in first month: > 100
- Successful deployments by strangers: > 10
- Issues filed (shows people are trying): > 20
- First external PR: within 60 days

---

*This document is the handover. Take it to Claude Code or a developer and build Sprint 1. Dordi is the benchmark. If she can use it, anyone can.*
