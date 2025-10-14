// Déclare les routes d'authentification.
import { Router } from 'express';
import {
  login,
  logout,
  me,
  register,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

export default router;
