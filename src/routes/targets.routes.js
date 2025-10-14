// Déclare les routes protégées liées aux cibles utilisateur.
import { Router } from 'express';
import {
  createTarget,
  deleteTarget,
  listTargets,
} from '../controllers/targets.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/', listTargets);
router.post('/', createTarget);
router.delete('/:id', deleteTarget);

export default router;
