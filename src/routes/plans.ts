/**
 * Plans — strategic plan creation and updates
 */

import { Router, Request, Response } from 'express';
import { getDb } from '../services/firestore.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const plansRouter = Router();

// POST /api/plans — create a strategic plan
plansRouter.post('/plans', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { title, content, accountId, memberId } = req.body;

    if (!title || !content) {
      res.status(400).json({
        error: 'Missing required fields',
        hint: 'Provide "title" and "content" for the plan.',
      });
      return;
    }

    const now = new Date().toISOString();
    const db = getDb();

    const plan = {
      userId,
      title: title.trim(),
      content,
      accountId: accountId || '',
      memberId: memberId || '',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection('plans').add(plan);
    res.status(201).json({ id: docRef.id, ...plan });
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Failed to create plan', hint: 'Try again in a moment.' });
  }
});

// PATCH /api/plans/:id — update a plan
plansRouter.patch('/plans/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const db = getDb();

    const doc = await db.collection('plans').doc(id).get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Plan not found', hint: 'Check the plan ID and try again.' });
      return;
    }

    const allowed = ['title', 'content', 'accountId', 'memberId'];
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await db.collection('plans').doc(id).update(updates);
    const updated = await db.collection('plans').doc(id).get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Failed to update plan', hint: 'Try again in a moment.' });
  }
});
