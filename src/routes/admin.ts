/**
 * Admin endpoints — instance owner only
 *
 * Protected by ADMIN_API_KEY environment variable (separate from user API keys).
 * If ADMIN_API_KEY is not set, admin endpoints return 503.
 */

import { Router, Request, Response } from 'express';
import { getDb } from '../services/firestore.js';

export const adminRouter = Router();

function adminAuth(req: Request, res: Response): boolean {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    res.status(503).json({
      error: 'Admin not configured',
      hint: 'Set ADMIN_API_KEY environment variable on your Cloud Run service.',
    });
    return false;
  }

  const provided =
    (req.query.admin_key as string) ||
    (req.headers['x-admin-key'] as string);

  if (provided !== adminKey) {
    res.status(401).json({
      error: 'Invalid admin key',
      hint: 'Provide your admin key via ?admin_key= or x-admin-key header.',
    });
    return false;
  }

  return true;
}

// GET /admin/users — list all users with stats
adminRouter.get('/admin/users', async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const db = getDb();
    const usersSnap = await db.collection('users').get();

    const users = await Promise.all(
      usersSnap.docs.map(async (doc) => {
        const data = doc.data();
        const userId = doc.id;

        // Count memories, tasks, contacts
        const [memoriesSnap, tasksSnap, contactsSnap, keysSnap] = await Promise.all([
          db.collection('memories').where('userId', '==', userId).count().get(),
          db.collection('tasks').where('userId', '==', userId).count().get(),
          db.collection('contacts').where('userId', '==', userId).count().get(),
          db.collection('apiKeys').where('userId', '==', userId).get(),
        ]);

        const lastUsed = keysSnap.docs
          .map((k) => k.data().lastUsedAt)
          .filter(Boolean)
          .sort()
          .pop() || null;

        return {
          userId,
          name: data.name,
          email: data.email,
          createdAt: data.createdAt,
          stats: {
            memories: memoriesSnap.data().count,
            tasks: tasksSnap.data().count,
            contacts: contactsSnap.data().count,
            apiKeys: keysSnap.size,
          },
          lastApiKeyUsed: lastUsed,
        };
      })
    );

    res.json({
      total: users.length,
      users: users.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1)),
    });
  } catch (error) {
    console.error('Admin list users error:', error);
    res.status(500).json({ error: 'Failed to list users', hint: 'Check server logs.' });
  }
});

// GET /admin/users/:userId — detailed user info
adminRouter.get('/admin/users/:userId', async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const db = getDb();
    const userId = req.params.userId as string;

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const data = userDoc.data()!;

    const [memoriesSnap, tasksSnap, contactsSnap, accountsSnap, listsSnap, keysSnap] =
      await Promise.all([
        db.collection('memories').where('userId', '==', userId).get(),
        db.collection('tasks').where('userId', '==', userId).get(),
        db.collection('contacts').where('userId', '==', userId).get(),
        db.collection('accounts').where('userId', '==', userId).get(),
        db.collection('lists').where('userId', '==', userId).get(),
        db.collection('apiKeys').where('userId', '==', userId).get(),
      ]);

    res.json({
      userId,
      name: data.name,
      email: data.email,
      instructions: data.instructions,
      createdAt: data.createdAt,
      stats: {
        memories: memoriesSnap.size,
        tasks: tasksSnap.size,
        contacts: contactsSnap.size,
        accounts: accountsSnap.size,
        lists: listsSnap.size,
        apiKeys: keysSnap.size,
      },
      lists: listsSnap.docs.map((d) => d.data().name),
      apiKeys: keysSnap.docs.map((d) => ({
        id: d.id,
        label: d.data().label,
        createdAt: d.data().createdAt,
        lastUsedAt: d.data().lastUsedAt,
      })),
    });
  } catch (error) {
    console.error('Admin get user error:', error);
    res.status(500).json({ error: 'Failed to get user', hint: 'Check server logs.' });
  }
});

// DELETE /admin/users/:userId — delete user and all their data
adminRouter.delete('/admin/users/:userId', async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const db = getDb();
    const userId = req.params.userId as string;

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const collections = ['memories', 'tasks', 'contacts', 'accounts', 'lists', 'apiKeys', 'transcripts', 'plans'];
    let totalDeleted = 0;

    for (const col of collections) {
      const snap = await db.collection(col).where('userId', '==', userId).get();
      const batch = db.batch();
      snap.docs.forEach((doc) => batch.delete(doc.ref));
      if (snap.size > 0) {
        await batch.commit();
        totalDeleted += snap.size;
      }
    }

    // Delete user doc
    await db.collection('users').doc(userId).delete();
    totalDeleted += 1;

    res.json({
      success: true,
      deleted: totalDeleted,
      hint: `User ${userDoc.data()?.name} and all their data have been permanently deleted.`,
    });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user', hint: 'Check server logs.' });
  }
});
