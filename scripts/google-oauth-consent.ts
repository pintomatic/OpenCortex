/**
 * Google OAuth Consent — one-time script to get a refresh token
 *
 * Usage:
 *   GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy npx tsx scripts/google-oauth-consent.ts
 *
 * Opens a browser for Google login, then prints the refresh token.
 */

import { google } from 'googleapis';
import { createServer } from 'http';
import { URL } from 'url';

const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/oauth/callback`;

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('\n1. Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\n2. Sign in and grant permissions.');
  console.log('3. You will be redirected back here.\n');

  // Start local server to capture the callback
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, `http://localhost:${PORT}`);

    if (url.pathname === '/oauth/callback') {
      const code = url.searchParams.get('code');

      if (!code) {
        res.writeHead(400);
        res.end('No authorization code received.');
        return;
      }

      try {
        const { tokens } = await oauth2Client.getToken(code);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
          <body style="font-family: sans-serif; text-align: center; margin-top: 3rem;">
            <h2>Success!</h2>
            <p>You can close this tab. Check the terminal for your refresh token.</p>
          </body>
          </html>
        `);

        console.log('\n=== SUCCESS ===\n');
        console.log('Refresh Token (save this — you need it for Cortex):');
        console.log('\n' + tokens.refresh_token + '\n');

        if (tokens.access_token) {
          // Get the email address
          oauth2Client.setCredentials(tokens);
          const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
          const userInfo = await oauth2.userinfo.get();
          console.log('Email:', userInfo.data.email);
        }

        console.log('\nAdd to your Cloud Run environment:');
        console.log(`  GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log(`  GOOGLE_CLIENT_ID=${clientId}`);
        console.log(`  GOOGLE_CLIENT_SECRET=${clientSecret}`);

        server.close();
        process.exit(0);
      } catch (err) {
        res.writeHead(500);
        res.end('Token exchange failed.');
        console.error('Token exchange error:', err);
        server.close();
        process.exit(1);
      }
    }
  });

  server.listen(PORT, () => {
    console.log(`Waiting for OAuth callback on http://localhost:${PORT}...`);
  });
}

main();
