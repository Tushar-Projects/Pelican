import express from 'express';
import Transfer from '../models/Transfer.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /transfers (auth required)
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      sessionCode,
      deviceName,
      fileName,
      fileSize,
      direction,
      status,
      avgSpeedBps,
      durationMs,
      sha256,
    } = req.body || {};

    if (!sessionCode || !fileName || fileSize === undefined || !direction || !status) {
      return res.status(400).json({ error: 'Missing required transfer fields' });
    }

    if (!['sent', 'received'].includes(direction)) {
      return res.status(400).json({ error: "Direction must be 'sent' or 'received'" });
    }

    if (!['completed', 'failed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: "Status must be 'completed', 'failed', or 'cancelled'" });
    }

    const transfer = await Transfer.create({
      userId: req.user._id,
      sessionCode: String(sessionCode).trim().toUpperCase(),
      deviceName: deviceName ? String(deviceName).trim() : '',
      fileName: String(fileName).trim(),
      fileSize: Number(fileSize),
      direction,
      status,
      avgSpeedBps: Number(avgSpeedBps) || 0,
      durationMs: Number(durationMs) || 0,
      sha256: sha256 ? String(sha256).trim() : '',
      createdAt: new Date(),
    });

    return res.status(201).json({ transfer });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to record transfer' });
  }
});

// GET /transfers (auth required, query: ?status=&q=&from=&to=&page=&limit=)
router.get('/', requireAuth, async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    const { status, q, from, to } = req.query;

    if (status) {
      filter.status = status;
    }

    if (q && typeof q === 'string' && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      filter.$or = [
        { fileName: regex },
        { sessionCode: regex },
        { deviceName: regex },
      ];
    }

    if (from || to) {
      filter.createdAt = {};
      if (from) {
        const fromDate = new Date(from);
        if (!isNaN(fromDate.getTime())) {
          filter.createdAt.$gte = fromDate;
        }
      }
      if (to) {
        const toDate = new Date(to);
        if (!isNaN(toDate.getTime())) {
          filter.createdAt.$lte = toDate;
        }
      }
      if (Object.keys(filter.createdAt).length === 0) {
        delete filter.createdAt;
      }
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const total = await Transfer.countDocuments(filter);
    const items = await Transfer.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      items,
      total,
      page,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch transfers' });
  }
});

// DELETE /transfers/:id (auth required)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await Transfer.deleteOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete transfer' });
  }
});

// DELETE /transfers (auth required, clears all of user's transfer history)
router.delete('/', requireAuth, async (req, res) => {
  try {
    await Transfer.deleteMany({ userId: req.user._id });
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to clear transfer history' });
  }
});

export default router;
