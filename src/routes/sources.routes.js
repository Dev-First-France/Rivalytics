// Déclare les routes des différentes sources de contenu.
import { Router } from 'express';
import { getCollect, getLinkedIn, getYouTube } from '../controllers/sources.controller.js';

const router = Router();

router.get('/collect', getCollect);
router.get('/linkedin', getLinkedIn);
// Instagram & TikTok désactivés en production (API payante).
router.get('/youtube', getYouTube);

export default router;
