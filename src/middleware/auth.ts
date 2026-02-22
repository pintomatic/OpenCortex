/**
 * API key authentication middleware
 *
 * Accepts key via:
 *   - x-api-key header
 *   - ?key= query parameter
 *
 * Keys are stored as bcrypt-like hashes in Firestore apiKeys collection.
 * For v1 simplicity, we store and compare plaintext prefixed keys (sc_ prefix).
 */

import { Request, Response, NextFunction } from 'express';
import { getDb } from '../services/firestore.js';

export interface AuthenticatedRequest extends Request {
  userId: string;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey =
    (req.query.key as string) ||
    req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({
      error: 'Authentication required',
      hint: 'Provide your API key via ?key= query parameter or x-api-key header',
    });
    return;
  }

  try {
    const db = getDb();
    const snapshot = await db
      .collection('apiKeys')
      .where('key', '==', apiKey)
      .limit(1)
      .get();

    if (snapshot.empty) {
      res.status(401).json({
        error: 'Invalid API key',
        hint: 'Check your API key or generate a new one',
      });
      return;
    }

    const keyDoc = snapshot.docs[0];
    const keyData = keyDoc.data();

    // Update last used timestamp (fire and forget)
    keyDoc.ref.update({ lastUsedAt: new Date().toISOString() }).catch(() => {});

    (req as AuthenticatedRequest).userId = keyData.userId;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      hint: 'Internal error checking API key. Try again.',
    });
  }
}
