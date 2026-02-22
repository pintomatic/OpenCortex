/**
 * Calendar — Google Calendar integration (read/write)
 */

import { Router, Request, Response } from 'express';
import { google, type calendar_v3 } from 'googleapis';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getGoogleClient } from '../services/google-auth.js';

export const calendarRouter = Router();

function parseEvent(event: calendar_v3.Schema$Event): any {
  return {
    id: event.id || '',
    summary: event.summary || '(No title)',
    description: event.description || undefined,
    location: event.location || undefined,
    start: event.start?.dateTime || event.start?.date || '',
    end: event.end?.dateTime || event.end?.date || '',
    attendees: event.attendees?.map((a) => ({
      email: a.email || '',
      responseStatus: a.responseStatus || undefined,
    })),
    htmlLink: event.htmlLink || undefined,
    status: event.status || 'confirmed',
  };
}

// GET /api/calendar/today — today's events
calendarRouter.get('/calendar/today', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { client } = await getGoogleClient(userId);
    const calendar = google.calendar({ version: 'v3', auth: client });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const result = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });

    const events = (result.data.items || []).map(parseEvent);
    res.json({ events, total: events.length });
  } catch (error: any) {
    console.error('Calendar today error:', error);
    if (error.message?.includes('not configured')) {
      res.status(501).json({ error: 'Calendar not configured', hint: 'Set up Google OAuth to use calendar features.' });
    } else {
      res.status(500).json({ error: 'Failed to load today\'s calendar', hint: 'Try again in a moment.' });
    }
  }
});

// GET /api/calendar/upcoming — events in next N days
calendarRouter.get('/calendar/upcoming', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const days = parseInt(req.query.days as string) || 7;
    const { client } = await getGoogleClient(userId);
    const calendar = google.calendar({ version: 'v3', auth: client });

    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + days);

    const result = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });

    const events = (result.data.items || []).map(parseEvent);
    res.json({ events, total: events.length, days });
  } catch (error: any) {
    console.error('Calendar upcoming error:', error);
    if (error.message?.includes('not configured')) {
      res.status(501).json({ error: 'Calendar not configured', hint: 'Set up Google OAuth to use calendar features.' });
    } else {
      res.status(500).json({ error: 'Failed to load upcoming events', hint: 'Try again in a moment.' });
    }
  }
});

// GET /api/calendar/events — list events in a date range
calendarRouter.get('/calendar/events', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { timeMin, timeMax } = req.query;
    const { client } = await getGoogleClient(userId);
    const calendar = google.calendar({ version: 'v3', auth: client });

    const now = new Date();
    const defaultEnd = new Date(now);
    defaultEnd.setDate(defaultEnd.getDate() + 7);

    const result = await calendar.events.list({
      calendarId: 'primary',
      timeMin: (timeMin as string) || now.toISOString(),
      timeMax: (timeMax as string) || defaultEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });

    const events = (result.data.items || []).map(parseEvent);
    res.json({ events, total: events.length });
  } catch (error: any) {
    console.error('Calendar events error:', error);
    if (error.message?.includes('not configured')) {
      res.status(501).json({ error: 'Calendar not configured', hint: 'Set up Google OAuth to use calendar features.' });
    } else {
      res.status(500).json({ error: 'Failed to load calendar events', hint: 'Try again in a moment.' });
    }
  }
});

// POST /api/calendar/events — create an event
calendarRouter.post('/calendar/events', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { summary, start, end, description, location, attendees } = req.body;

    if (!summary || !start || !end) {
      res.status(400).json({
        error: 'Missing required fields',
        hint: 'Provide "summary", "start" (ISO datetime), and "end" (ISO datetime).',
      });
      return;
    }

    const { client } = await getGoogleClient(userId);
    const calendar = google.calendar({ version: 'v3', auth: client });

    const eventBody: calendar_v3.Schema$Event = {
      summary,
      description: description || undefined,
      location: location || undefined,
      start: { dateTime: start },
      end: { dateTime: end },
    };

    if (attendees?.length) {
      eventBody.attendees = attendees.map((email: string) => ({ email }));
    }

    const result = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventBody,
    });

    res.status(201).json(parseEvent(result.data));
  } catch (error: any) {
    console.error('Create event error:', error);
    if (error.message?.includes('not configured')) {
      res.status(501).json({ error: 'Calendar not configured', hint: 'Set up Google OAuth to use calendar features.' });
    } else {
      res.status(500).json({ error: 'Failed to create event', hint: 'Try again in a moment.' });
    }
  }
});

// PATCH /api/calendar/events/:eventId — update an event
calendarRouter.patch('/calendar/events/:eventId', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const eventId = req.params.eventId as string;
    const { summary, start, end, description, location, attendees } = req.body;

    const { client } = await getGoogleClient(userId);
    const calendar = google.calendar({ version: 'v3', auth: client });

    const patchBody: calendar_v3.Schema$Event = {};
    if (summary !== undefined) patchBody.summary = summary;
    if (description !== undefined) patchBody.description = description;
    if (location !== undefined) patchBody.location = location;
    if (start !== undefined) patchBody.start = { dateTime: start };
    if (end !== undefined) patchBody.end = { dateTime: end };
    if (attendees !== undefined) {
      patchBody.attendees = attendees.map((email: string) => ({ email }));
    }

    const result = await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: patchBody,
    });

    res.json(parseEvent(result.data));
  } catch (error: any) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event', hint: 'Try again in a moment.' });
  }
});

// DELETE /api/calendar/events/:eventId — delete an event
calendarRouter.delete('/calendar/events/:eventId', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const eventId = req.params.eventId as string;

    const { client } = await getGoogleClient(userId);
    const calendar = google.calendar({ version: 'v3', auth: client });

    await calendar.events.delete({ calendarId: 'primary', eventId });
    res.json({ success: true, hint: 'Event deleted from calendar.' });
  } catch (error: any) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event', hint: 'Try again in a moment.' });
  }
});
