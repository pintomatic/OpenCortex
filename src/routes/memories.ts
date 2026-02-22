/**
 * Memories — persistent knowledge CRUD + search + domains
 */

import { Router, Request, Response } from 'express';
import { getDb } from '../services/firestore.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { MEMORY_CATEGORIES, MemoryCategory } from '../config/defaults.js';

export const memoriesRouter = Router();

// GET /api/memories — list with optional filters
memoriesRouter.get('/memories', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { category, domain, limit: limitStr } = req.query;
    const limit = Math.min(parseInt(limitStr as string) || 50, 200);
    const db = getDb();

    let query = db.collection('memories').where('userId', '==', userId) as FirebaseFirestore.Query;

    if (category) query = query.where('category', '==', category);
    if (domain) query = query.where('domain', '==', domain);

    const snapshot = await query.orderBy('updatedAt', 'desc').limit(limit).get();
    const memories = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json({ memories, count: memories.length });
  } catch (error) {
    console.error('List memories error:', error);
    res.status(500).json({ error: 'Failed to load memories', hint: 'Try again in a moment.' });
  }
});

// GET /api/memories/search — keyword search
memoriesRouter.get('/memories/search', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Missing search query', hint: 'Provide ?q=your+search+terms' });
      return;
    }

    const db = getDb();
    const snapshot = await db
      .collection('memories')
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .limit(200)
      .get();

    const searchTerms = q.toLowerCase().split(/\s+/);
    const memories = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((mem: any) => {
        const text = [
          mem.content,
          mem.domain,
          ...(mem.subjects || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return searchTerms.every((term) => text.includes(term));
      });

    res.json({ memories, count: memories.length, query: q });
  } catch (error) {
    console.error('Search memories error:', error);
    res.status(500).json({ error: 'Failed to search memories', hint: 'Try again in a moment.' });
  }
});

// GET /api/domains — list domains with counts
memoriesRouter.get('/domains', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const db = getDb();

    const snapshot = await db
      .collection('memories')
      .where('userId', '==', userId)
      .select('domain')
      .get();

    const counts: Record<string, number> = {};
    snapshot.docs.forEach((doc) => {
      const domain = doc.data().domain || 'uncategorized';
      counts[domain] = (counts[domain] || 0) + 1;
    });

    const domains = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.json({ domains });
  } catch (error) {
    console.error('List domains error:', error);
    res.status(500).json({ error: 'Failed to load domains', hint: 'Try again in a moment.' });
  }
});

// GET /api/domain/:domain — all memories for a domain
memoriesRouter.get('/domain/:domain', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const domain = req.params.domain as string;
    const db = getDb();

    const snapshot = await db
      .collection('memories')
      .where('userId', '==', userId)
      .where('domain', '==', domain)
      .orderBy('updatedAt', 'desc')
      .get();

    const memories = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ domain, memories, count: memories.length });
  } catch (error) {
    console.error('Domain memories error:', error);
    res.status(500).json({ error: 'Failed to load domain memories', hint: 'Try again in a moment.' });
  }
});

// POST /api/memories — create a memory
memoriesRouter.post('/memories', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { content, category, domain, subjects, confidence, source } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({
        error: 'Missing required field',
        hint: 'Provide "content" — a self-contained, atomic piece of knowledge.',
      });
      return;
    }

    if (category && !MEMORY_CATEGORIES.includes(category as MemoryCategory)) {
      res.status(400).json({
        error: 'Invalid category',
        hint: `Must be one of: ${MEMORY_CATEGORIES.join(', ')}`,
      });
      return;
    }

    const now = new Date().toISOString();
    const db = getDb();

    const memory = {
      userId,
      content: content.trim(),
      category: category || 'context',
      domain: domain || 'general',
      subjects: Array.isArray(subjects) ? subjects : [],
      confidence: typeof confidence === 'number' ? Math.max(0, Math.min(1, confidence)) : 0.9,
      source: source || 'manual',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection('memories').add(memory);
    res.status(201).json({ id: docRef.id, ...memory });
  } catch (error) {
    console.error('Create memory error:', error);
    res.status(500).json({ error: 'Failed to create memory', hint: 'Try again in a moment.' });
  }
});

// GET /api/memories/:id — get single memory
memoriesRouter.get('/memories/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const db = getDb();

    const doc = await db.collection('memories').doc(id).get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Memory not found', hint: 'Check the memory ID and try again.' });
      return;
    }

    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Get memory error:', error);
    res.status(500).json({ error: 'Failed to load memory', hint: 'Try again in a moment.' });
  }
});

// PATCH /api/memories/:id — update a memory
memoriesRouter.patch('/memories/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const db = getDb();

    const doc = await db.collection('memories').doc(id).get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Memory not found', hint: 'Check the memory ID and try again.' });
      return;
    }

    const allowed = ['content', 'category', 'domain', 'subjects', 'confidence', 'source'];
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (updates.category && !MEMORY_CATEGORIES.includes(updates.category)) {
      res.status(400).json({
        error: 'Invalid category',
        hint: `Must be one of: ${MEMORY_CATEGORIES.join(', ')}`,
      });
      return;
    }

    await db.collection('memories').doc(id).update(updates);
    const updated = await db.collection('memories').doc(id).get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (error) {
    console.error('Update memory error:', error);
    res.status(500).json({ error: 'Failed to update memory', hint: 'Try again in a moment.' });
  }
});

// DELETE /api/memories/:id — delete a memory
memoriesRouter.delete('/memories/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const db = getDb();

    const doc = await db.collection('memories').doc(id).get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Memory not found', hint: 'Check the memory ID and try again.' });
      return;
    }

    await db.collection('memories').doc(id).delete();
    res.json({ success: true, hint: 'Memory permanently deleted.' });
  } catch (error) {
    console.error('Delete memory error:', error);
    res.status(500).json({ error: 'Failed to delete memory', hint: 'Try again in a moment.' });
  }
});
