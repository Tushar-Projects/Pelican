import express from 'express';
import authRoutes from './auth.js';
import sessionRoutes from './sessions.js';
import transferRoutes from './transfers.js';
import deviceRoutes from './devices.js';

const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/sessions', sessionRoutes);
apiRouter.use('/transfers', transferRoutes);
apiRouter.use('/devices', deviceRoutes);

export { apiRouter };
export default apiRouter;
