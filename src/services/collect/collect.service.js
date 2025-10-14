// Orchestre la collecte multi-sources (LinkedIn, RSS, YouTube). Instagram/TikTok désactivés (API payante).
import { fetchLinkedIn, fetchLinkedInByUrl } from './linkedin.service.js';
import { fetchRSS } from './rss.service.js';
import { fetchYouTube } from './youtube.service.js';
import { liCanonicalKey } from '../../utils/linkedin.js';

const STRATEGIES = {
  all: ['rss', 'linkedin', 'youtube'],
  cheap: ['rss', 'linkedin', 'youtube'],
  social: ['linkedin', 'youtube'],
};

const COMPETITORS = {
  devfirst: {
    rss: ['https://dev.to/feed/tag/nestjs', 'https://hnrss.org/frontpage'],
    youtube: '@googledevelopers',
    instagram: 'devfirst',
    tiktok: '',
  },
  rivalytics: {
    rss: ['https://dev.to/feed/tag/webdev'],
    youtube: '',
    instagram: '',
    tiktok: '',
  },
  accenture: {
    rss: [],
    youtube: 'UCvDOfCgmS7q4OYMKVpy5Xjw',
    instagram: 'accenture',
    tiktok: 'accenture',
  },
};

// Retourne la configuration par défaut d'un concurrent.
export const getCompetitorConfig = (key) =>
  COMPETITORS[String(key || '').toLowerCase()] || {};

const parseSources = ({ strategy, sources }) => {
  const allowed = new Set(['rss', 'linkedin', 'youtube']);
  const strategyKey = String(strategy || '').trim().toLowerCase();
  let list = STRATEGIES[strategyKey];
  const raw = String(sources || '').trim();
  if (raw) {
    list = raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }
  if (!list || list.length === 0) list = STRATEGIES.cheap;
  return new Set(list.filter((entry) => allowed.has(entry)));
};

const dedupeItems = (items) => {
  const byKey = new Map();
  const keyFor = (item) => {
    if (item.type === 'LinkedIn') return liCanonicalKey(item);
    try {
      if (item.url) {
        const norm = new URL(item.url, 'https://example.com').toString();
        return `${item.type}:${norm}`;
      }
    } catch {
      // ignore et fallback
    }
    const fallback = item.id || JSON.stringify(item);
    return `${item.type}:${fallback}`;
  };
  for (const item of items) {
    const key = keyFor(item);
    if (!byKey.has(key)) {
      byKey.set(key, item);
    }
  }
  return Array.from(byKey.values());
};

// Agrège les différentes sources demandées et déduplique les items.
export async function collectSources(params) {
  const rawName = String(params.name || '').trim();
  const name = rawName.toLowerCase();
  const days = Number(params.days || 7);
  const limit = Number(params.limit || 12);
  const sources = parseSources({
    strategy: params.strategy,
    sources: params.sources,
  });

  const cfg = getCompetitorConfig(name);
  const rssList = cfg.rss || [];
  const ytTarget = cfg.youtube || rawName;

  const jobs = [
    sources.has('linkedin')
      ? fetchLinkedIn(rawName, { days, limit: 20 }).then((res) => res.items)
      : Promise.resolve([]),
    sources.has('rss') ? fetchRSS(rssList, days) : Promise.resolve([]),
    sources.has('youtube')
      ? fetchYouTube({
          channel: ytTarget,
          q: cfg.youtube ? '' : rawName,
          days,
          limit,
        })
      : Promise.resolve([]),
  ];

  const [liItems, rssItems, ytItems] = await Promise.all(jobs);

  const merged = [...liItems, ...rssItems, ...ytItems].sort((a, b) => {
    if (a.date && b.date) return a.date < b.date ? 1 : -1;
    if (!a.date && b.date) return 1;
    return -1;
  });

  const items = dedupeItems(merged);

  return {
    items,
    usedSources: Array.from(sources),
  };
}

export { fetchLinkedIn, fetchLinkedInByUrl, fetchRSS, fetchYouTube };
