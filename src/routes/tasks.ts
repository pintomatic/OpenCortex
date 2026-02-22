/**
 * Tasks — native Firestore task CRUD + search + summary + upcoming
 *
 * Unlike studio's MS Graph sync, tasks live entirely in Firestore.
 */

import { Router, Request, Response } from 'express';
import { getDb } from '../services/firestore.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const tasksRouter = Router();

// GET /api/tasks — list with optional filters
tasksRouter.get('/tasks', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { listName, completed, importance, limit: limitStr } = req.query;
    const limit = Math.min(parseInt(limitStr as string) || 50, 200);
    const db = getDb();

    let query = db.collection('tasks').where('userId', '==', userId) as FirebaseFirestore.Query;

    if (listName) query = query.where('listName', '==', listName);
    if (completed !== undefined) query = query.where('completed', '==', completed === 'true');
    if (importance) query = query.where('importance', '==', importance);

    const snapshot = await query.orderBy('createdAt', 'desc').limit(limit).get();
    const tasks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json({ tasks, count: tasks.length });
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({ error: 'Failed to load tasks', hint: 'Try again in a moment.' });
  }
});

// GET /api/tasks/search — keyword search
tasksRouter.get('/tasks/search', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Missing search query', hint: 'Provide ?q=your+search+terms' });
      return;
    }

    const db = getDb();
    const snapshot = await db
      .collection('tasks')
      .where('userId', '==', userId)
      .where('completed', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    const searchTerms = q.toLowerCase().split(/\s+/);
    const tasks = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((task: any) => {
        const text = [task.title, task.body, task.listName].filter(Boolean).join(' ').toLowerCase();
        return searchTerms.every((term) => text.includes(term));
      });

    res.json({ tasks, count: tasks.length, query: q });
  } catch (error) {
    console.error('Search tasks error:', error);
    res.status(500).json({ error: 'Failed to search tasks', hint: 'Try again in a moment.' });
  }
});

// GET /api/tasks/summary — statistics
tasksRouter.get('/tasks/summary', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const db = getDb();

    const snapshot = await db
      .collection('tasks')
      .where('userId', '==', userId)
      .where('completed', '==', false)
      .get();

    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 7);

    let total = 0;
    let overdue = 0;
    let dueSoon = 0;
    let highPriority = 0;

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      total++;
      if (data.importance === 'high') highPriority++;
      if (data.dueDate) {
        const due = new Date(data.dueDate);
        if (due < now) overdue++;
        else if (due <= soon) dueSoon++;
      }
    });

    res.json({ total, overdue, dueSoon, highPriority });
  } catch (error) {
    console.error('Task summary error:', error);
    res.status(500).json({ error: 'Failed to compute task summary', hint: 'Try again in a moment.' });
  }
});

// GET /api/tasks/upcoming — tasks due within N days
tasksRouter.get('/tasks/upcoming', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const days = parseInt(req.query.days as string) || 7;
    const db = getDb();

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + days);

    // Get all incomplete tasks, filter by due date client-side
    const snapshot = await db
      .collection('tasks')
      .where('userId', '==', userId)
      .where('completed', '==', false)
      .get();

    const tasks = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((task: any) => {
        if (!task.dueDate) return false;
        const due = new Date(task.dueDate);
        return due <= cutoff;
      })
      .sort((a: any, b: any) => {
        // Sort: overdue first, then by due date, high priority first
        const aDate = new Date(a.dueDate).getTime();
        const bDate = new Date(b.dueDate).getTime();
        if (a.importance !== b.importance) return a.importance === 'high' ? -1 : 1;
        return aDate - bDate;
      });

    res.json({ tasks, count: tasks.length, days });
  } catch (error) {
    console.error('Upcoming tasks error:', error);
    res.status(500).json({ error: 'Failed to load upcoming tasks', hint: 'Try again in a moment.' });
  }
});

// GET /api/tasks/for-contact/:name — tasks mentioning a person
tasksRouter.get('/tasks/for-contact/:name', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const name = req.params.name as string;
    const db = getDb();

    const snapshot = await db
      .collection('tasks')
      .where('userId', '==', userId)
      .where('completed', '==', false)
      .get();

    const nameLower = name.toLowerCase();
    const tasks = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((task: any) => {
        const text = [task.title, task.body].filter(Boolean).join(' ').toLowerCase();
        return text.includes(nameLower);
      });

    res.json({ tasks, count: tasks.length, contact: name });
  } catch (error) {
    console.error('Tasks for contact error:', error);
    res.status(500).json({ error: 'Failed to search tasks by contact', hint: 'Try again in a moment.' });
  }
});

// POST /api/tasks — create a task
tasksRouter.post('/tasks', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { title, listName, body, dueDate, importance } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'Missing required field', hint: 'Provide a "title" for the task.' });
      return;
    }
    if (!listName || typeof listName !== 'string') {
      res.status(400).json({
        error: 'Missing required field',
        hint: 'Provide a "listName" — which list this task belongs to (e.g. "Work", "Personal").',
      });
      return;
    }

    const now = new Date().toISOString();
    const db = getDb();

    const task = {
      userId,
      title: title.trim(),
      listName: listName.trim(),
      body: body || '',
      dueDate: dueDate || null,
      importance: importance === 'high' ? 'high' : 'normal',
      completed: false,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection('tasks').add(task);
    res.status(201).json({ id: docRef.id, ...task });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task', hint: 'Try again in a moment.' });
  }
});

// GET /api/tasks/:id — get single task
tasksRouter.get('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const db = getDb();

    const doc = await db.collection('tasks').doc(id).get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Task not found', hint: 'Check the task ID and try again.' });
      return;
    }

    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to load task', hint: 'Try again in a moment.' });
  }
});

// PATCH /api/tasks/:id — update a task
tasksRouter.patch('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const db = getDb();

    const doc = await db.collection('tasks').doc(id).get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Task not found', hint: 'Check the task ID and try again.' });
      return;
    }

    const allowed = ['title', 'listName', 'body', 'dueDate', 'importance', 'completed'];
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    // Track completion timestamp
    if (updates.completed === true && !doc.data()?.completedAt) {
      updates.completedAt = new Date().toISOString();
    } else if (updates.completed === false) {
      updates.completedAt = null;
    }

    await db.collection('tasks').doc(id).update(updates);
    const updated = await db.collection('tasks').doc(id).get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task', hint: 'Try again in a moment.' });
  }
});

// DELETE /api/tasks/:id — delete a task
tasksRouter.delete('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const id = req.params.id as string;
    const db = getDb();

    const doc = await db.collection('tasks').doc(id).get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Task not found', hint: 'Check the task ID and try again.' });
      return;
    }

    await db.collection('tasks').doc(id).delete();
    res.json({ success: true, hint: 'Task permanently deleted.' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task', hint: 'Try again in a moment.' });
  }
});
