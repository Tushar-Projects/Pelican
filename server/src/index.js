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
app.use(cors({ origin: clientOrigin }));
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
