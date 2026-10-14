import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import { connectDB } from './config/db.js';
import router from './routes/index.js';
import { attachSignaling } from './signaling/index.js';

const app = express();

const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const ngrokSuffixes = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io'];

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (origin === clientOrigin) return true;

  // Localhost and LAN IPs
  if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin)) {
    return true;
  }

  // ngrok origins (.ngrok-free.app, .ngrok-free.dev, .ngrok.app, .ngrok.io)
  try {
    const { hostname } = new URL(origin);
    if (ngrokSuffixes.some((suffix) => hostname.endsWith(suffix) || hostname === suffix.slice(1))) {
      return true;
    }
  } catch (e) {
    // Malformed origin URL
  }

  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json());

// Mount API routes at /api
app.use('/api', router);

// Create HTTP server and attach WebSocket signaling at /ws
const server = http.createServer(app);
attachSignaling(server);

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`DropRelay server listening on port ${PORT}`);
      console.log(`WebSocket signaling available at ws://localhost:${PORT}/ws`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

export { app, server };
