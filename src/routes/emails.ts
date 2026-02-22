/**
 * Emails — Gmail integration (read/search/send/reply)
 */

import { Router, Request, Response } from 'express';
import { google, type gmail_v1 } from 'googleapis';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getGoogleClient } from '../services/google-auth.js';

export const emailsRouter = Router();

function decodeBody(encoded: string): string {
  return Buffer.from(encoded, 'base64url').toString('utf-8');
}

function extractBody(payload: gmail_v1.Schema$MessagePart): string {
  if (payload.body?.data) return decodeBody(payload.body.data);
  if (payload.parts) {
    const textPart = payload.parts.find((p) => p.mimeType === 'text/plain');
    if (textPart?.body?.data) return decodeBody(textPart.body.data);
    const htmlPart = payload.parts.find((p) => p.mimeType === 'text/html');
    if (htmlPart?.body?.data) return decodeBody(htmlPart.body.data);
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
  }
  return '';
}

function parseMessage(msg: gmail_v1.Schema$Message): any {
  const headers = msg.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

  return {
    id: msg.id || '',
    threadId: msg.threadId || '',
    from: getHeader('from'),
    to: getHeader('to').split(',').map((s) => s.trim()).filter(Boolean),
    cc: getHeader('cc') ? getHeader('cc').split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    subject: getHeader('subject'),
    snippet: msg.snippet || '',
    body: msg.payload ? extractBody(msg.payload) : '',
    date: getHeader('date'),
    labelIds: msg.labelIds || [],
    isUnread: (msg.labelIds || []).includes('UNREAD'),
  };
}

// GET /api/emails/recent — recent emails
emailsRouter.get('/emails/recent', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const maxResults = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const { client } = await getGoogleClient(userId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
    });

    if (!listRes.data.messages?.length) {
      res.json({ emails: [], count: 0 });
      return;
    }

    const emails = await Promise.all(
      listRes.data.messages.map(async (m) => {
        const full = await gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'full' });
        return parseMessage(full.data);
      })
    );

    res.json({ emails, count: emails.length });
  } catch (error: any) {
    console.error('Recent emails error:', error);
    if (error.message?.includes('not configured')) {
      res.status(501).json({ error: 'Email not configured', hint: 'Set up Google OAuth to use email features.' });
    } else {
      res.status(500).json({ error: 'Failed to load recent emails', hint: 'Try again in a moment.' });
    }
  }
});

// GET /api/emails/search — search emails
emailsRouter.get('/emails/search', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Missing search query', hint: 'Provide ?q=your+search+terms (Gmail search syntax).' });
      return;
    }

    const maxResults = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const { client } = await getGoogleClient(userId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults,
    });

    if (!listRes.data.messages?.length) {
      res.json({ emails: [], count: 0, query: q });
      return;
    }

    const emails = await Promise.all(
      listRes.data.messages.map(async (m) => {
        const full = await gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'full' });
        return parseMessage(full.data);
      })
    );

    res.json({ emails, count: emails.length, query: q });
  } catch (error: any) {
    console.error('Search emails error:', error);
    if (error.message?.includes('not configured')) {
      res.status(501).json({ error: 'Email not configured', hint: 'Set up Google OAuth to use email features.' });
    } else {
      res.status(500).json({ error: 'Failed to search emails', hint: 'Try again in a moment.' });
    }
  }
});

// GET /api/emails/:id — read a specific email
emailsRouter.get('/emails/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const { client } = await getGoogleClient(userId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const result = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
    res.json(parseMessage(result.data));
  } catch (error: any) {
    console.error('Get email error:', error);
    res.status(500).json({ error: 'Failed to load email', hint: 'Try again in a moment.' });
  }
});

// POST /api/emails/send — send an email
emailsRouter.post('/emails/send', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { to, cc, bcc, subject, body, isHtml } = req.body;

    if (!to || !subject || !body) {
      res.status(400).json({
        error: 'Missing required fields',
        hint: 'Provide "to" (array of emails), "subject", and "body".',
      });
      return;
    }

    const { client, email: fromEmail } = await getGoogleClient(userId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    const toList = Array.isArray(to) ? to : [to];
    const contentType = isHtml ? 'text/html' : 'text/plain';

    const lines = [
      `From: ${fromEmail}`,
      `To: ${toList.join(', ')}`,
      ...(cc?.length ? [`Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}`] : []),
      ...(bcc?.length ? [`Bcc: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`] : []),
      `Subject: ${subject}`,
      `Content-Type: ${contentType}; charset=utf-8`,
      '',
      body,
    ];

    const raw = Buffer.from(lines.join('\r\n')).toString('base64url');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    res.status(201).json({
      id: result.data.id || '',
      threadId: result.data.threadId || '',
      hint: `Email sent from ${fromEmail}.`,
    });
  } catch (error: any) {
    console.error('Send email error:', error);
    if (error.message?.includes('not configured')) {
      res.status(501).json({ error: 'Email not configured', hint: 'Set up Google OAuth to use email features.' });
    } else {
      res.status(500).json({ error: 'Failed to send email', hint: 'Try again in a moment.' });
    }
  }
});

// POST /api/emails/:id/reply — reply to an email
emailsRouter.post('/emails/:id/reply', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const { body, isHtml } = req.body;

    if (!body) {
      res.status(400).json({ error: 'Missing required field', hint: 'Provide "body" for the reply.' });
      return;
    }

    const { client, email: fromEmail } = await getGoogleClient(userId);
    const gmail = google.gmail({ version: 'v1', auth: client });

    // Fetch original for headers
    const original = await gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'To', 'Message-ID'],
    });

    const headers = original.data.payload?.headers || [];
    const getHeader = (name: string) => {
      const h = headers.find((header) => header.name?.toLowerCase() === name.toLowerCase());
      return h?.value || '';
    };

    const originalSubject = getHeader('subject');
    const originalFrom = getHeader('from');
    const originalMessageId = getHeader('message-id');

    const subject = originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`;
    const contentType = isHtml ? 'text/html' : 'text/plain';

    const lines = [
      `From: ${fromEmail}`,
      `To: ${originalFrom}`,
      `Subject: ${subject}`,
      `In-Reply-To: ${originalMessageId}`,
      `References: ${originalMessageId}`,
      `Content-Type: ${contentType}; charset=utf-8`,
      '',
      body,
    ];

    const raw = Buffer.from(lines.join('\r\n')).toString('base64url');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        threadId: original.data.threadId || undefined,
      },
    });

    res.status(201).json({
      id: result.data.id || '',
      threadId: result.data.threadId || '',
      hint: `Reply sent from ${fromEmail}.`,
    });
  } catch (error: any) {
    console.error('Reply email error:', error);
    res.status(500).json({ error: 'Failed to send reply', hint: 'Try again in a moment.' });
  }
});
