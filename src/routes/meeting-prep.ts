/**
 * Meeting Prep — full context bundle for a contact
 */

import { Router, Request, Response } from 'express';
import { getDb } from '../services/firestore.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const meetingPrepRouter = Router();

// GET /api/meeting-prep/:memberId — full context for meeting preparation
meetingPrepRouter.get('/meeting-prep/:memberId', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const memberId = req.params.memberId as string;
    const db = getDb();

    // Load contact
    const contactDoc = await db.collection('contacts').doc(memberId).get();
    if (!contactDoc.exists || contactDoc.data()?.userId !== userId) {
      res.status(404).json({ error: 'Contact not found', hint: 'Check the contact ID and try again.' });
      return;
    }

    const contact = { id: contactDoc.id, ...contactDoc.data() };

    // Load in parallel: activities, account, related tasks, related memories, transcripts
    const contactData = contactDoc.data()!;
    const [activitiesSnap, accountDoc, tasksSnap, memoriesSnap, transcriptsSnap] = await Promise.all([
      // Recent activities
      db.collection('contacts').doc(memberId).collection('activities')
        .orderBy('date', 'desc')
        .limit(10)
        .get(),
      // Account details (if linked)
      contactData.companyId
        ? db.collection('accounts').doc(contactData.companyId).get()
        : Promise.resolve(null),
      // Related tasks (mentioning contact name)
      db.collection('tasks')
        .where('userId', '==', userId)
        .where('completed', '==', false)
        .get(),
      // Related memories (search by contact name)
      db.collection('memories')
        .where('userId', '==', userId)
        .orderBy('updatedAt', 'desc')
        .limit(100)
        .get(),
      // Related transcripts
      db.collection('transcripts')
        .where('userId', '==', userId)
        .where('memberId', '==', memberId)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get(),
    ]);

    const activities = activitiesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const account = accountDoc && accountDoc.exists
      ? { id: accountDoc.id, ...accountDoc.data() }
      : null;

    // Filter tasks mentioning this contact
    const contactName = contactData.name.toLowerCase();
    const relatedTasks = tasksSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((task: any) => {
        const text = [task.title, task.body].filter(Boolean).join(' ').toLowerCase();
        return text.includes(contactName);
      });

    // Filter memories mentioning this contact
    const relatedMemories = memoriesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((mem: any) => {
        const text = [mem.content, ...(mem.subjects || [])].join(' ').toLowerCase();
        return text.includes(contactName);
      })
      .slice(0, 15);

    const transcripts = transcriptsSnap.docs.map((d) => ({
      id: d.id,
      title: d.data().title,
      summary: d.data().summary,
      createdAt: d.data().createdAt,
    }));

    // Days since last activity
    let daysSinceLastActivity: number | null = null;
    if (activities.length > 0) {
      const lastDate = new Date((activities[0] as any).date);
      daysSinceLastActivity = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    res.json({
      contact,
      account,
      activities,
      daysSinceLastActivity,
      relatedTasks,
      relatedMemories,
      transcripts,
      hint: 'Use this context to prepare for your meeting. Review recent activities and open tasks.',
    });
  } catch (error) {
    console.error('Meeting prep error:', error);
    res.status(500).json({ error: 'Failed to prepare meeting context', hint: 'Try again in a moment.' });
  }
});
