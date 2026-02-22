# Setting Up Integrations

Cortex integrations connect to your existing tools. Each is optional — the core (memories, tasks, CRM) works without any integrations.

---

## Google Calendar + Gmail

### What You Need
1. A Google Cloud project (you already have one from deploying Cortex)
2. OAuth 2.0 credentials (Client ID + Secret)
3. A refresh token for your Google account

### Step 1: Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: "Cortex"
5. Authorized redirect URIs: add `http://localhost:3000/oauth/callback`
6. Click **Create**
7. Save the **Client ID** and **Client Secret**

### Step 2: Enable APIs

In Google Cloud Console → **APIs & Services** → **Library**, enable:
- **Google Calendar API**
- **Gmail API**

### Step 3: Get a Refresh Token

Run the OAuth consent script locally:

```bash
cd OpenCortex
GOOGLE_CLIENT_ID=your-client-id \
GOOGLE_CLIENT_SECRET=your-secret \
npx tsx scripts/google-oauth-consent.ts
```

This will:
1. Open a browser window for Google login
2. Ask for Calendar + Gmail permissions
3. Print your refresh token

### Step 4: Configure Cloud Run

Add these environment variables to your Cloud Run service:

```bash
gcloud run services update cortex \
  --set-env-vars "GOOGLE_CLIENT_ID=your-client-id,GOOGLE_CLIENT_SECRET=your-secret,GOOGLE_REFRESH_TOKEN=your-refresh-token,GOOGLE_EMAIL=your@gmail.com" \
  --region us-central1
```

Or store in Firestore `userSettings` collection for your user:
```json
{
  "googleRefreshToken": "your-refresh-token",
  "googleEmail": "your@gmail.com"
}
```

### Step 5: Test

```bash
# Today's calendar
curl -s "https://YOUR-URL/api/calendar/today?key=YOUR_KEY"

# Recent emails
curl -s "https://YOUR-URL/api/emails/recent?key=YOUR_KEY"
```

---

## Adding More Integrations

Cortex is designed to be extended. To add a new integration:

1. Create a service file in `src/services/` for API auth
2. Create a route file in `src/routes/` with endpoints
3. Import and mount in `src/index.ts`
4. Add to the schema in `src/routes/schema.ts`
5. Rebuild and deploy

The pattern is always the same: OAuth tokens in env vars or Firestore, Express routes that call the external API.
