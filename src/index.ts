/**
 * Cortex — AI Chief of Staff
 * Main Express server entry point
 */

import express from 'express';
import cors from 'cors';
import { initFirestore } from './services/firestore.js';
import { authMiddleware } from './middleware/auth.js';

// Route imports — Tier 1
import { bootstrapRouter } from './routes/bootstrap.js';
import { memoriesRouter } from './routes/memories.js';
import { tasksRouter } from './routes/tasks.js';
import { listsRouter } from './routes/lists.js';
import { keysRouter } from './routes/keys.js';
import { schemaRouter } from './routes/schema.js';

// Route imports — Tier 2
import { contactsRouter } from './routes/contacts.js';
import { accountsRouter } from './routes/accounts.js';
import { pipelineRouter } from './routes/pipeline.js';
import { meetingPrepRouter } from './routes/meeting-prep.js';
import { transcriptsRouter } from './routes/transcripts.js';
import { plansRouter } from './routes/plans.js';

// Route imports — Tier 3
import { calendarRouter } from './routes/calendar.js';
import { emailsRouter } from './routes/emails.js';

const app = express();
const PORT = parseInt(process.env.PORT || '8080');

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Initialize Firestore
initFirestore();

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Schema (no auth — AI needs to discover endpoints)
app.use('/api', schemaRouter);

// All other routes require auth
app.use('/api', authMiddleware);

// Tier 1: Core
app.use('/api', bootstrapRouter);
app.use('/api', memoriesRouter);
app.use('/api', tasksRouter);
app.use('/api', listsRouter);
app.use('/api', keysRouter);

// Tier 2: Relationships
app.use('/api', contactsRouter);
app.use('/api', accountsRouter);
app.use('/api', pipelineRouter);
app.use('/api', meetingPrepRouter);
app.use('/api', transcriptsRouter);
app.use('/api', plansRouter);

// Tier 3: Integrations
app.use('/api', calendarRouter);
app.use('/api', emailsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    hint: 'Call GET /api/schema to see all available endpoints',
  });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Something went wrong',
    hint: 'Check the server logs for details',
  });
});

app.listen(PORT, () => {
  console.log(`Cortex API running on port ${PORT}`);
});
