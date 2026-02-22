/**
 * Accounts — company/organization CRUD
 */

import { Router, Request, Response } from 'express';
import { getDb } from '../services/firestore.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const accountsRouter = Router();

// GET /api/accounts — list all accounts
accountsRouter.get('/accounts', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const db = getDb();

    const snapshot = await db
      .collection('accounts')
      .where('userId', '==', userId)
      .orderBy('name', 'asc')
      .get();

    const accounts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ accounts, count: accounts.length });
  } catch (error) {
    console.error('List accounts error:', error);
    res.status(500).json({ error: 'Failed to load accounts', hint: 'Try again in a moment.' });
  }
});

// POST /api/accounts — create an account
accountsRouter.post('/accounts', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { name, workspace, industry } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Missing required field', hint: 'Provide a "name" for the account.' });
      return;
    }

    const now = new Date().toISOString();
    const db = getDb();

    const account = {
      userId,
      name: name.trim(),
      workspace: workspace || '',
      industry: industry || '',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection('accounts').add(account);
    res.status(201).json({ id: docRef.id, ...account });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ error: 'Failed to create account', hint: 'Try again in a moment.' });
  }
});

// GET /api/accounts/:id — get account details
accountsRouter.get('/accounts/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const db = getDb();

    const doc = await db.collection('accounts').doc(id).get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Account not found', hint: 'Check the account ID and try again.' });
      return;
    }

    // Also fetch contacts for this account
    const contactsSnap = await db
      .collection('contacts')
      .where('userId', '==', userId)
      .where('companyId', '==', id)
      .where('hidden', '==', false)
      .get();

    const contacts = contactsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json({ id: doc.id, ...doc.data(), contacts });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ error: 'Failed to load account', hint: 'Try again in a moment.' });
  }
});

// PATCH /api/accounts/:id — update an account
accountsRouter.patch('/accounts/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const db = getDb();

    const doc = await db.collection('accounts').doc(id).get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Account not found', hint: 'Check the account ID and try again.' });
      return;
    }

    const allowed = ['name', 'workspace', 'industry'];
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await db.collection('accounts').doc(id).update(updates);
    const updated = await db.collection('accounts').doc(id).get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ error: 'Failed to update account', hint: 'Try again in a moment.' });
  }
});

// DELETE /api/accounts/:id — delete an account
accountsRouter.delete('/accounts/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const db = getDb();

    const doc = await db.collection('accounts').doc(id).get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Account not found', hint: 'Check the account ID and try again.' });
      return;
    }

    await db.collection('accounts').doc(id).delete();
    res.json({ success: true, hint: 'Account deleted. Contacts linked to this account still exist.' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account', hint: 'Try again in a moment.' });
  }
});
