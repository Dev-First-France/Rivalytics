// Assemble toutes les sous-routes de l'API.
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import targetsRoutes from './targets.routes.js';
import sourcesRoutes from './sources.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/targets', targetsRoutes);
router.use('/api', sourcesRoutes);

export default router;
