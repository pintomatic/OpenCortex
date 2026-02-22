/**
 * API key management — list, rotate, revoke
 */

import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { getDb } from '../services/firestore.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const keysRouter = Router();

function generateApiKey(): string {
  return 'sc_' + randomBytes(36).toString('base64url');
}

function maskKey(key: string): string {
  if (key.length <= 10) return '***';
  return key.slice(0, 6) + '...' + key.slice(-4);
}

// GET /api/keys — list API keys (masked)
keysRouter.get('/keys', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const db = getDb();

    const snapshot = await db
      .collection('apiKeys')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const keys = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        maskedKey: maskKey(data.key),
        label: data.label || 'default',
        createdAt: data.createdAt,
        lastUsedAt: data.lastUsedAt || null,
      };
    });

    res.json({ keys });
  } catch (error) {
    console.error('List keys error:', error);
    res.status(500).json({ error: 'Failed to list API keys', hint: 'Try again in a moment.' });
  }
});

// POST /api/keys/rotate — generate a new API key
keysRouter.post('/keys/rotate', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { label } = req.body || {};
    const db = getDb();

    const newKey = generateApiKey();
    const now = new Date().toISOString();

    const docRef = await db.collection('apiKeys').add({
      userId,
      key: newKey,
      label: label || 'default',
      createdAt: now,
      lastUsedAt: null,
    });

    res.status(201).json({
      id: docRef.id,
      key: newKey,
      label: label || 'default',
      createdAt: now,
      hint: 'Save this key securely — it will not be shown again.',
    });
  } catch (error) {
    console.error('Rotate key error:', error);
    res.status(500).json({ error: 'Failed to generate API key', hint: 'Try again in a moment.' });
  }
});

// DELETE /api/keys/:keyId — revoke a specific key
keysRouter.delete('/keys/:keyId', async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const keyId = req.params.keyId as string;
    const db = getDb();

    const doc = await db.collection('apiKeys').doc(keyId).get();
    if (!doc.exists || doc.data()?.userId !== userId) {
      res.status(404).json({ error: 'API key not found', hint: 'Check the key ID and try again.' });
      return;
    }

    // Prevent revoking the last key
    const allKeys = await db
      .collection('apiKeys')
      .where('userId', '==', userId)
      .get();

    if (allKeys.size <= 1) {
      res.status(400).json({
        error: 'Cannot revoke last key',
        hint: 'Generate a new key first (POST /api/keys/rotate) before revoking this one.',
      });
      return;
    }

    await db.collection('apiKeys').doc(keyId).delete();
    res.json({ success: true, hint: 'API key revoked. Any client using this key will lose access.' });
  } catch (error) {
    console.error('Revoke key error:', error);
    res.status(500).json({ error: 'Failed to revoke API key', hint: 'Try again in a moment.' });
  }
});
