/**
 * Transcripts — meeting transcript storage
 */

import { Router, Request, Response } from 'express';
import { getDb } from '../services/firestore.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const transcriptsRouter = Router();

// GET /api/transcripts — list transcripts
transcriptsRouter.get('/transcripts', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { memberId, accountId, limit: limitStr } = req.query;
    const limit = Math.min(parseInt(limitStr as string) || 20, 100);
    const db = getDb();

    let query = db.collection('transcripts').where('userId', '==', userId) as FirebaseFirestore.Query;

    if (memberId) query = query.where('memberId', '==', memberId);
    if (accountId) query = query.where('accountId', '==', accountId);

    const snapshot = await query.orderBy('createdAt', 'desc').limit(limit).get();
    const transcripts = snapshot.docs.map((doc) => ({
      id: doc.id,
      title: doc.data().title,
      summary: doc.data().summary,
      memberId: doc.data().memberId,
      accountId: doc.data().accountId,
      createdAt: doc.data().createdAt,
    }));

    res.json({ transcripts, count: transcripts.length });
  } catch (error) {
    console.error('List transcripts error:', error);
    res.status(500).json({ error: 'Failed to load transcripts', hint: 'Try again in a moment.' });
  }
});

// POST /api/transcripts — store a transcript
transcriptsRouter.post('/transcripts', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { title, content, summary, memberId, accountId } = req.body;

    if (!title || !content) {
      res.status(400).json({
        error: 'Missing required fields',
        hint: 'Provide "title" and "content" for the transcript.',
      });
      return;
    }

    const now = new Date().toISOString();
    const db = getDb();

    const transcript = {
      userId,
      title: title.trim(),
      content,
      summary: summary || '',
      memberId: memberId || '',
      accountId: accountId || '',
      createdAt: now,
    };

    const docRef = await db.collection('transcripts').add(transcript);
    res.status(201).json({ id: docRef.id, ...transcript });
  } catch (error) {
    console.error('Create transcript error:', error);
    res.status(500).json({ error: 'Failed to store transcript', hint: 'Try again in a moment.' });
  }
});
