import mongoose from 'mongoose';

const transferSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sessionCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  deviceName: {
    type: String,
    default: '',
    trim: true,
  },
  fileName: {
    type: String,
    required: true,
    trim: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  direction: {
    type: String,
    enum: ['sent', 'received'],
    required: true,
  },
  status: {
    type: String,
    enum: ['completed', 'failed', 'cancelled'],
    required: true,
  },
  avgSpeedBps: {
    type: Number,
    default: 0,
  },
  durationMs: {
    type: Number,
    default: 0,
  },
  sha256: {
    type: String,
    default: '',
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Transfer = mongoose.model('Transfer', transferSchema);
export default Transfer;
