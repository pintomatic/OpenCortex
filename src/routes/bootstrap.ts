/**
 * Bootstrap — the magic endpoint that loads full user context
 *
 * Called at the start of every AI conversation to give the AI
 * persistent memory and awareness of the user's world.
 */

import { Router, Request, Response } from 'express';
import { getDb } from '../services/firestore.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const bootstrapRouter = Router();

bootstrapRouter.get('/bootstrap', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const db = getDb();

    // Load user profile
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data()! : {};

    // Load memories in parallel
    // Fetch all memories at once (no composite index needed), then filter in-memory
    const [
      memoriesSnap,
      listsSnap,
      tasksSnap,
    ] = await Promise.all([
      db.collection('memories')
        .where('userId', '==', userId)
        .get(),
      db.collection('lists')
        .where('userId', '==', userId)
        .get(),
      db.collection('tasks')
        .where('userId', '==', userId)
        .get(),
    ]);

    // Sort and filter memories in-memory (avoids composite index requirement)
    const allMemories = memoriesSnap.docs.map((d) => d.data());
    const byDate = (a: any, b: any) =>
      (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');

    const identitySnap = allMemories.filter((m) => m.category === 'identity').sort(byDate).slice(0, 20);
    const decisionSnap = allMemories.filter((m) => m.category === 'decision').sort(byDate).slice(0, 10);
    const preferenceSnap = allMemories.filter((m) => m.category === 'preference').sort(byDate).slice(0, 15);
    const taskDocs = tasksSnap.docs.filter((d) => !d.data().completed);

    // Build identity facts
    const identityFacts = identitySnap.map((m) => m.content);

    // Recent decisions
    const recentDecisions = decisionSnap.map((m) => m.content);

    // Preferences
    const preferences = preferenceSnap.map((m) => m.content);

    // Lists (sort in-memory)
    const lifeOsLists = listsSnap.docs
      .map((d) => d.data())
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
      .map((d) => d.name);

    // Task summary
    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 7);

    let total = 0;
    let overdue = 0;
    let dueSoon = 0;
    let highPriority = 0;
    const activeTasks: any[] = [];

    taskDocs.forEach((doc) => {
      const data = doc.data();
      total++;
      if (data.importance === 'high') highPriority++;
      if (data.dueDate) {
        const due = new Date(data.dueDate);
        if (due < now) overdue++;
        else if (due <= soon) {
          dueSoon++;
          activeTasks.push({
            id: doc.id,
            title: data.title,
            listName: data.listName,
            dueDate: data.dueDate,
            importance: data.importance,
          });
        }
      }
    });

    // Sort active tasks: high priority first, then by due date
    activeTasks.sort((a, b) => {
      if (a.importance !== b.importance) return a.importance === 'high' ? -1 : 1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    // Build bootstrap instructions
    const userName = userData.name || 'User';
    const proto = req.get('x-forwarded-proto') || req.protocol;
    const baseUrl = `${proto}://${req.get('host')}`;

    const instructions = userData.instructions ||
      `You are an AI assistant for ${userName}. You have access to their Cortex — a personal knowledge system with memories, tasks, contacts, calendar, and email. Use the API endpoints to help them. Always be concise, warm, and proactive. When you learn something new about ${userName}, save it as a memory. When they mention a to-do, create a task.`;

    const bootstrap = {
      instructions,
      user: {
        name: userName,
        identityFacts,
      },
      recentDecisions,
      preferences,
      activeTasks: activeTasks.slice(0, 15),
      taskSummary: { total, overdue, dueSoon, highPriority },
      api: {
        version: '1.0.0',
        baseUrl: `${baseUrl}/api`,
        schemaUrl: `${baseUrl}/api/schema`,
        hint: 'Call GET /api/schema to see all available endpoints.',
      },
      lifeOsLists,
      currentDate: now.toISOString().split('T')[0],
      currentTime: now.toTimeString().split(' ')[0],
    };

    res.json(bootstrap);
  } catch (error) {
    console.error('Bootstrap error:', error);
    res.status(500).json({
      error: 'Failed to load your context',
      hint: 'Something went wrong loading your profile. Try again in a moment.',
    });
  }
});
