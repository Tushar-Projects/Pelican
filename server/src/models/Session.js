import mongoose from 'mongoose';

// 6 characters from A-Z and 0-9, excluding 0, O, 1, I
export const SESSION_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateSessionCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * SESSION_CODE_ALPHABET.length);
    code += SESSION_CODE_ALPHABET[randomIndex];
  }
  return code;
}

const sessionSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    required: true,
    uppercase: true,
    trim: true,
  },
  hostUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  status: {
    type: String,
    enum: ['waiting', 'paired', 'closed', 'expired'],
    default: 'waiting',
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// TTL index to automatically remove expired documents
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Returns the session if status is 'waiting' or 'paired' and expiresAt > now, else null.
 * @param {string} code
 * @returns {Promise<Document|null>}
 */
sessionSchema.statics.findActiveByCode = async function (code) {
  if (!code || typeof code !== 'string') return null;
  const normalizedCode = code.trim().toUpperCase();
  const now = new Date();
  const session = await this.findOne({
    code: normalizedCode,
    status: { $in: ['waiting', 'paired'] },
    expiresAt: { $gt: now },
  });
  return session;
};

export const Session = mongoose.model('Session', sessionSchema);
export default Session;
