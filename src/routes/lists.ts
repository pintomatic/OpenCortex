/**
 * List management — task list CRUD
 */

import { Router, Request, Response } from 'express';
import { getDb } from '../services/firestore.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { DEFAULT_LISTS } from '../config/defaults.js';

export const listsRouter = Router();

// GET /api/lists — list all lists
listsRouter.get('/lists', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const db = getDb();

    const snapshot = await db
      .collection('lists')
      .where('userId', '==', userId)
      .get();

    const lists = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => {
        const aTime = a.createdAt || '';
        const bTime = b.createdAt || '';
        return aTime > bTime ? 1 : aTime < bTime ? -1 : 0;
      });
    res.json({ lists });
  } catch (error) {
    console.error('List list error:', error);
    res.status(500).json({ error: 'Failed to load lists', hint: 'Try again in a moment.' });
  }
});

// POST /api/lists — create a new list
listsRouter.post('/lists', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Missing required field', hint: 'Provide a "name" for the list.' });
      return;
    }

    const db = getDb();

    // Check for duplicate
    const existing = await db
      .collection('lists')
      .where('userId', '==', userId)
      .where('name', '==', name.trim())
      .limit(1)
      .get();

    if (!existing.empty) {
      res.status(409).json({ error: 'List already exists', hint: `A list named "${name.trim()}" already exists.` });
      return;
    }

    const now = new Date().toISOString();
    const docRef = await db.collection('lists').add({
      userId,
      name: name.trim(),
      createdAt: now,
    });

    res.status(201).json({ id: docRef.id, name: name.trim(), createdAt: now });
  } catch (error) {
    console.error('Create list error:', error);
    res.status(500).json({ error: 'Failed to create list', hint: 'Try again in a moment.' });
  }
});

// DELETE /api/lists/:id — delete a list
listsRouter.delete('/lists/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const db = getDb();

    const doc = await db.collection('lists').doc(id).get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      res.status(404).json({ error: 'List not found', hint: 'Check the list ID and try again.' });
      return;
    }

    await db.collection('lists').doc(id).delete();
    res.json({ success: true, hint: `List deleted. Tasks in this list still exist — reassign them if needed.` });
  } catch (error) {
    console.error('Delete list error:', error);
    res.status(500).json({ error: 'Failed to delete list', hint: 'Try again in a moment.' });
  }
});

/**
 * Seed default lists for a new user (called during onboarding)
 */
export async function seedDefaultLists(userId: string): Promise<void> {
  const db = getDb();
  const batch = db.batch();
  const now = new Date().toISOString();

  for (const name of DEFAULT_LISTS) {
    const ref = db.collection('lists').doc();
    batch.set(ref, { userId, name, createdAt: now });
  }

  await batch.commit();
}
