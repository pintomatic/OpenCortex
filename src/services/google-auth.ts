/**
 * Google OAuth — token management for Calendar + Gmail
 *
 * Refresh tokens are stored in Firestore userSettings collection.
 * googleapis handles token refresh automatically.
 */

import { google } from 'googleapis';
import { getDb } from './firestore.js';

export function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set for Calendar/Email integration.');
  }
  return new google.auth.OAuth2(clientId, clientSecret);
}

export function getAuthenticatedClient(refreshToken: string) {
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

/**
 * Get an authenticated Google client for a user.
 * Reads refresh token from Firestore userSettings.
 */
export async function getGoogleClient(userId: string) {
  const db = getDb();

  const settingsDoc = await db.collection('userSettings').doc(userId).get();
  const settings = settingsDoc.data();

  const refreshToken = settings?.googleRefreshToken;
  const email = settings?.googleEmail;

  if (!refreshToken) {
    // Fallback to env var (for initial setup before Firestore is configured)
    const envToken = process.env.GOOGLE_REFRESH_TOKEN;
    const envEmail = process.env.GOOGLE_EMAIL;
    if (!envToken) {
      throw new Error(
        'Google integration not configured. Set up OAuth tokens in userSettings or GOOGLE_REFRESH_TOKEN env var.'
      );
    }
    return {
      client: getAuthenticatedClient(envToken),
      email: envEmail || 'user@gmail.com',
    };
  }

  return {
    client: getAuthenticatedClient(refreshToken),
    email: email || 'user@gmail.com',
  };
}
