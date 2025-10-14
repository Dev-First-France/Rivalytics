// Expose les routes d'agrégation de contenus externes.
import {
  collectSources,
  fetchLinkedInByUrl,
  fetchRSS,
  fetchYouTube,
  getCompetitorConfig,
} from '../services/collect/collect.service.js';
// Remarque : les handlers Instagram/TikTok sont désactivés (API payante).
import { createError } from '../utils/errors.js';

// Récupère les posts LinkedIn via une URL ou un slug.
export async function getLinkedIn(req, res, next) {
  try {
    const slug = String(req.query.slug || '').trim();
    const urlParam = String(req.query.url || '').trim();
    const days = Number(req.query.days || 3650);
    const limit = Number(req.query.limit || 20);
    const target =
      urlParam || (slug ? `https://www.linkedin.com/company/${slug}` : '');
    if (!target) {
      throw createError(400, 'missing_url_or_slug');
    }
    const result = await fetchLinkedInByUrl(target, { days, limit });
    res.json(result);
  } catch (error) {
    if (!error.status) {
      console.error('[LinkedIn] failed:', error.message);
    }
    next(error.status ? error : createError(500, 'linkedin_fetch_failed'));
  }
}

// Récupère les entrées RSS configurées ou passées en override.
export async function getRSS(req, res, next) {
  try {
    const name = String(req.query.name || '').trim().toLowerCase();
    const days = Number(req.query.days || 7);
    const override = String(req.query.rss || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    const cfg = getCompetitorConfig(name);
    const rssList = override.length > 0 ? override : cfg.rss || [];
    const items = await fetchRSS(rssList, days);
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

// Récupère les vidéos YouTube récentes selon la configuration.
export async function getYouTube(req, res, next) {
  try {
    const channel = String(req.query.channel || '').trim();
    const q = String(req.query.q || '').trim();
    const days = Number(req.query.days || 7);
    const limit = Number(req.query.limit || 12);
    const items = await fetchYouTube({ channel, q, days, limit });
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

// Agrège les différentes sources selon la stratégie choisie.
export async function getCollect(req, res, next) {
  try {
    const result = await collectSources(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
