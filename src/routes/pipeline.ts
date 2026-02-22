/**
 * Pipeline — CRM pipeline overview grouped by stage
 */

import { Router, Request, Response } from 'express';
import { getDb } from '../services/firestore.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { PIPELINE_STAGES } from '../config/defaults.js';

export const pipelineRouter = Router();

// GET /api/pipeline — overview grouped by stage
pipelineRouter.get('/pipeline', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const db = getDb();

    const snapshot = await db
      .collection('contacts')
      .where('userId', '==', userId)
      .where('hidden', '==', false)
      .get();

    const stages: Record<string, any[]> = {};
    for (const stage of PIPELINE_STAGES) {
      stages[stage] = [];
    }

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const stage = data.pipelineStage || 'Identify';
      if (!stages[stage]) stages[stage] = [];
      stages[stage].push({
        id: doc.id,
        name: data.name,
        accountName: data.accountName,
        roleTitle: data.roleTitle,
        nextActionNote: data.nextActionNote,
        clientStatus: data.clientStatus,
      });
    });

    const totalContacts = snapshot.docs.length;
    const summary = Object.entries(stages).map(([stage, contacts]) => ({
      stage,
      count: contacts.length,
      contacts,
    }));

    res.json({ pipeline: summary, totalContacts });
  } catch (error) {
    console.error('Pipeline error:', error);
    res.status(500).json({ error: 'Failed to load pipeline', hint: 'Try again in a moment.' });
  }
});
