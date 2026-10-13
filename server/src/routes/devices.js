import express from 'express';
import Device from '../models/Device.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /devices (auth required)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, deviceKey } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Device name is required' });
    }
    if (!deviceKey || typeof deviceKey !== 'string' || !deviceKey.trim()) {
      return res.status(400).json({ error: 'Device key is required' });
    }

    const device = await Device.create({
      userId: req.user._id,
      name: name.trim(),
      deviceKey: deviceKey.trim(),
      trusted: false,
      lastSeenAt: new Date(),
    });

    return res.status(201).json({ device });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to register device' });
  }
});

// GET /devices (auth required, returns user's devices)
router.get('/', requireAuth, async (req, res) => {
  try {
    const devices = await Device.find({ userId: req.user._id }).sort({ lastSeenAt: -1 });
    return res.status(200).json(devices);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// PATCH /devices/:id (auth required, body: {name?, trusted?})
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const device = await Device.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const { name, trusted } = req.body || {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Invalid device name' });
      }
      device.name = name.trim();
    }

    if (trusted !== undefined) {
      device.trusted = Boolean(trusted);
    }

    device.lastSeenAt = new Date();
    await device.save();

    return res.status(200).json({ device });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update device' });
  }
});

// DELETE /devices/:id (auth required)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await Device.deleteOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete device' });
  }
});

export default router;
