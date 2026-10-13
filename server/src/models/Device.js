import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  deviceKey: {
    type: String,
    required: true,
  },
  trusted: {
    type: Boolean,
    default: false,
  },
  lastSeenAt: {
    type: Date,
    default: Date.now,
  },
});

export const Device = mongoose.model('Device', deviceSchema);
export default Device;
