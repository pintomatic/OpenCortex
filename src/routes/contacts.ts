/**
 * Contacts — people CRUD + activities + latest activity + hide
 */

import { Router, Request, Response } from 'express';
import { getDb } from '../services/firestore.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { ACTIVITY_TYPES, ActivityType } from '../config/defaults.js';

export const contactsRouter = Router();

// GET /api/contacts — list with optional filters
contactsRouter.get('/contacts', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { accountId, pipelineStage, hidden } = req.query;
    const db = getDb();

    let query = db.collection('contacts').where('userId', '==', userId) as FirebaseFirestore.Query;

    if (accountId) query = query.where('companyId', '==', accountId);
    if (pipelineStage) query = query.where('pipelineStage', '==', pipelineStage);

    // Default: hide hidden contacts
    const showHidden = hidden === 'true';
    if (!showHidden) query = query.where('hidden', '==', false);

    const snapshot = await query.orderBy('updatedAt', 'desc').get();
    const contacts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json({ contacts, count: contacts.length });
  } catch (error) {
    console.error('List contacts error:', error);
    res.status(500).json({ error: 'Failed to load contacts', hint: 'Try again in a moment.' });
  }
});

// POST /api/contacts — create a contact
contactsRouter.post('/contacts', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { name, email, roleTitle, companyId, accountName, pipelineStage, clientStatus, nextActionNote, assignedRole } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Missing required field', hint: 'Provide a "name" for the contact.' });
      return;
    }

    const now = new Date().toISOString();
    const db = getDb();

    const contact = {
      userId,
      name: name.trim(),
      email: email || '',
      roleTitle: roleTitle || '',
      companyId: companyId || '',
      accountName: accountName || '',
      pipelineStage: pipelineStage || 'Identify',
      clientStatus: clientStatus || '',
      nextActionNote: nextActionNote || '',
      assignedRole: assignedRole || '',
      hidden: false,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection('contacts').add(contact);
    res.status(201).json({ id: docRef.id, ...contact });
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Failed to create contact', hint: 'Try again in a moment.' });
  }
});

// PATCH /api/contacts/:id — update a contact
contactsRouter.patch('/contacts/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const db = getDb();

    const doc = await db.collection('contacts').doc(id).get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Contact not found', hint: 'Check the contact ID and try again.' });
      return;
    }

    const allowed = ['name', 'email', 'roleTitle', 'companyId', 'accountName', 'pipelineStage', 'clientStatus', 'nextActionNote', 'assignedRole'];
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await db.collection('contacts').doc(id).update(updates);
    const updated = await db.collection('contacts').doc(id).get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Failed to update contact', hint: 'Try again in a moment.' });
  }
});

// DELETE /api/contacts/:id — hard delete
contactsRouter.delete('/contacts/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const db = getDb();

    const doc = await db.collection('contacts').doc(id).get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Contact not found', hint: 'Check the contact ID and try again.' });
      return;
    }

    await db.collection('contacts').doc(id).delete();
    res.json({ success: true, hint: 'Contact permanently deleted.' });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Failed to delete contact', hint: 'Try again in a moment.' });
  }
});

// POST /api/contacts/:id/hide — soft delete
contactsRouter.post('/contacts/:id/hide', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const db = getDb();

    const doc = await db.collection('contacts').doc(id).get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Contact not found', hint: 'Check the contact ID and try again.' });
      return;
    }

    await db.collection('contacts').doc(id).update({ hidden: true, updatedAt: new Date().toISOString() });
    res.json({ success: true, hint: 'Contact hidden. Use ?hidden=true to see hidden contacts.' });
  } catch (error) {
    console.error('Hide contact error:', error);
    res.status(500).json({ error: 'Failed to hide contact', hint: 'Try again in a moment.' });
  }
});

// GET /api/contacts/:id/activities — list activities for a contact
contactsRouter.get('/contacts/:id/activities', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const db = getDb();

    // Verify contact belongs to user
    const contactDoc = await db.collection('contacts').doc(id).get();
    if (!contactDoc.exists || contactDoc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Contact not found', hint: 'Check the contact ID and try again.' });
      return;
    }

    const snapshot = await db
      .collection('contacts')
      .doc(id)
      .collection('activities')
      .orderBy('date', 'desc')
      .get();

    const activities = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ activities, count: activities.length });
  } catch (error) {
    console.error('List activities error:', error);
    res.status(500).json({ error: 'Failed to load activities', hint: 'Try again in a moment.' });
  }
});

// POST /api/contacts/:id/activities — log an activity
contactsRouter.post('/contacts/:id/activities', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const { type, note, date, nextStep } = req.body;
    const db = getDb();

    const contactDoc = await db.collection('contacts').doc(id).get();
    if (!contactDoc.exists || contactDoc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Contact not found', hint: 'Check the contact ID and try again.' });
      return;
    }

    if (!type || !ACTIVITY_TYPES.includes(type as ActivityType)) {
      res.status(400).json({
        error: 'Invalid activity type',
        hint: `Must be one of: ${ACTIVITY_TYPES.join(', ')}`,
      });
      return;
    }

    const now = new Date().toISOString();
    const activity = {
      type,
      note: note || '',
      date: date || now,
      nextStep: nextStep || '',
      createdAt: now,
    };

    const docRef = await db
      .collection('contacts')
      .doc(id)
      .collection('activities')
      .add(activity);

    // Update contact's updatedAt
    await db.collection('contacts').doc(id).update({ updatedAt: now });

    res.status(201).json({ id: docRef.id, ...activity });
  } catch (error) {
    console.error('Create activity error:', error);
    res.status(500).json({ error: 'Failed to log activity', hint: 'Try again in a moment.' });
  }
});

// PATCH /api/contacts/:id/activities/:activityId
contactsRouter.patch('/contacts/:id/activities/:activityId', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const activityId = req.params.activityId as string;
    const db = getDb();

    const contactDoc = await db.collection('contacts').doc(id).get();
    if (!contactDoc.exists || contactDoc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Contact not found', hint: 'Check the contact ID.' });
      return;
    }

    const activityDoc = await db.collection('contacts').doc(id).collection('activities').doc(activityId).get();
    if (!activityDoc.exists) {
      res.status(404).json({ error: 'Activity not found', hint: 'Check the activity ID.' });
      return;
    }

    const allowed = ['type', 'note', 'date', 'nextStep'];
    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await db.collection('contacts').doc(id).collection('activities').doc(activityId).update(updates);
    const updated = await db.collection('contacts').doc(id).collection('activities').doc(activityId).get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (error) {
    console.error('Update activity error:', error);
    res.status(500).json({ error: 'Failed to update activity', hint: 'Try again in a moment.' });
  }
});

// DELETE /api/contacts/:id/activities/:activityId
contactsRouter.delete('/contacts/:id/activities/:activityId', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const activityId = req.params.activityId as string;
    const db = getDb();

    const contactDoc = await db.collection('contacts').doc(id).get();
    if (!contactDoc.exists || contactDoc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Contact not found', hint: 'Check the contact ID.' });
      return;
    }

    const activityDoc = await db.collection('contacts').doc(id).collection('activities').doc(activityId).get();
    if (!activityDoc.exists) {
      res.status(404).json({ error: 'Activity not found', hint: 'Check the activity ID.' });
      return;
    }

    await db.collection('contacts').doc(id).collection('activities').doc(activityId).delete();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete activity error:', error);
    res.status(500).json({ error: 'Failed to delete activity', hint: 'Try again in a moment.' });
  }
});

// GET /api/contacts/:id/latest-activity — most recent + days since
contactsRouter.get('/contacts/:id/latest-activity', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const db = getDb();

    const contactDoc = await db.collection('contacts').doc(id).get();
    if (!contactDoc.exists || contactDoc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Contact not found', hint: 'Check the contact ID.' });
      return;
    }

    const snapshot = await db
      .collection('contacts')
      .doc(id)
      .collection('activities')
      .orderBy('date', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      res.json({ activity: null, daysSince: null, hint: 'No activities recorded for this contact.' });
      return;
    }

    const activity = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    const activityDate = new Date((activity as any).date);
    const daysSince = Math.floor((Date.now() - activityDate.getTime()) / (1000 * 60 * 60 * 24));

    res.json({ activity, daysSince });
  } catch (error) {
    console.error('Latest activity error:', error);
    res.status(500).json({ error: 'Failed to load latest activity', hint: 'Try again in a moment.' });
  }
});
