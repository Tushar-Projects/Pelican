import express from 'express';
import Session, { generateSessionCode } from '../models/Session.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

export function isHost(session, user) {
  return Boolean(session && session.hostUserId) && Boolean(user && user._id) && session.hostUserId.toString() === user._id.toString();
}

// POST /sessions (optional auth)
router.post('/', optionalAuth, async (req, res) => {
  try {
    const ttlMinutes = parseInt(process.env.SESSION_TTL_MINUTES, 10) || 15;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const hostUserId = req.user ? req.user._id : null;

    let code = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      code = generateSessionCode(6);
      const existing = await Session.findOne({ code });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ error: 'Failed to generate unique session code' });
    }

    const session = await Session.create({
      code,
      hostUserId,
      status: 'waiting',
      expiresAt,
      createdAt: new Date(),
    });

    return res.status(201).json({
      code: session.code,
      expiresAt: session.expiresAt,
      status: session.status,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /sessions (auth required, returns user's sessions)
router.get('/', requireAuth, async (req, res) => {
  try {
    const filter = { hostUserId: req.user._id };
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const sessions = await Session.find(filter).sort({ createdAt: -1 });
    return res.status(200).json(sessions);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// GET /sessions/:code (public, no auth)
router.get('/:code', async (req, res) => {
  try {
    const code = req.params.code ? req.params.code.trim().toUpperCase() : '';
    if (!code) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = await Session.findOne({ code });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if session has expired based on time
    if (session.expiresAt <= new Date() || session.status === 'expired' || session.status === 'closed') {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.status(200).json({
      code: session.code,
      status: session.status,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// PATCH /sessions/:code (auth required)
router.patch('/:code', requireAuth, async (req, res) => {
  try {
    const code = req.params.code ? req.params.code.trim().toUpperCase() : '';
    const session = await Session.findOne({ code });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Strict host check: only the session host can modify the session
    if (!isHost(session, req.user)) {
      return res.status(403).json({ error: 'Only the session host can modify this session' });
    }

    const { extendMinutes, status } = req.body || {};

    if (extendMinutes !== undefined) {
      const minutes = Number(extendMinutes);
      if (isNaN(minutes) || minutes <= 0) {
        return res.status(400).json({ error: 'extendMinutes must be a positive number' });
      }
      const baseTime = session.expiresAt > new Date() ? session.expiresAt.getTime() : Date.now();
      session.expiresAt = new Date(baseTime + minutes * 60 * 1000);
    }

    if (status === 'closed') {
      session.status = 'closed';
    } else if (status !== undefined) {
      return res.status(400).json({ error: 'Invalid status update' });
    }

    await session.save();
    return res.status(200).json({ session });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update session' });
  }
});

// DELETE /sessions/:code (auth required)
router.delete('/:code', requireAuth, async (req, res) => {
  try {
    const code = req.params.code ? req.params.code.trim().toUpperCase() : '';
    const session = await Session.findOne({ code });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Strict host check: only the session host can modify the session
    if (!isHost(session, req.user)) {
      return res.status(403).json({ error: 'Only the session host can modify this session' });
    }

    await Session.deleteOne({ _id: session._id });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;
