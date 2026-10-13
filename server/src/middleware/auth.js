import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const secret = process.env.JWT_SECRET || 'change_me';
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        const secret = process.env.JWT_SECRET || 'change_me';
        const decoded = jwt.verify(token, secret);
        const user = await User.findById(decoded.userId).select('-passwordHash');
        if (user) {
          req.user = user;
        }
      }
    }
  } catch (err) {
    // Optional auth ignores invalid tokens and proceeds as guest
    req.user = null;
  }
  next();
}
