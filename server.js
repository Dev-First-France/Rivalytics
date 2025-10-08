import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import RSSParser from 'rss-parser';
import * as cheerio from 'cheerio';
import crypto from 'node:crypto';

const app = express();
const PORT = process.env.PORT || 3001;

const APIFY_TOKEN = process.env.APIFY_TOKEN || '';
const YT_API_KEY  = process.env.YT_API_KEY  || '';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const parser = new RSSParser();

/* Helpers */
function normalizeItem({ id, type, title, url, date, metrics }) {
  return { id, type, title, url, date, metrics: metrics || {} };
}
function cutoffDays(days) {
  return new Date(Date.now() - (Number(days) || 7) * 86400000);
}
function toISODate(d) {
  try { return new Date(d).toISOString().slice(0, 10); }
  catch { return new Date().toISOString().slice(0, 10); }
}
function slugifyNameToHandle(name = '') {
  return String(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._]+/g, '')
    .toLowerCase();
}

/* Micro-cache (5 min) */
const _cache = new Map();
function cacheGetSet(key, ttlMs, fn) {
  const now = Date.now();
  const hit = _cache.get(key);
  if (hit && now - hit.t < ttlMs) return Promise.resolve(hit.data);
  return Promise.resolve().then(fn).then(data => (_cache.set(key, { t: now, data }), data));
}

/* Stratégies & sources */
const STRATEGIES = {
  all:      ['rss','linkedin','instagram','tiktok','youtube'],
  cheap:    ['rss','linkedin','youtube'],
  social:   ['linkedin','instagram','tiktok','youtube'],
};
function parseSources(req) {
  const allowed = new Set(['rss','linkedin','instagram','tiktok','youtube']);
  const strategy = String(req.query.strategy || '').trim().toLowerCase();
  let list = STRATEGIES[strategy];
  const raw = String(req.query.sources || '').trim();
  if (raw) list = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!list || list.length === 0) list = STRATEGIES.cheap;
  return new Set(list.filter(s => allowed.has(s)));
}

/* RSS publics */
async function fetchRSS(urls = [], days = 7) {
  const min = cutoffDays(days);
  const all = [];
  for (const url of urls) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of (feed.items || [])) {
        const dateStr = item.isoDate || item.pubDate || item.date;
        if (!dateStr) continue;
        const d = new Date(dateStr);
        if (d >= min) {
          all.push(
            normalizeItem({
              id: item.guid || item.link || `${url}#${d.getTime()}`,
              type: 'Blog',
              title: item.title || '(sans titre)',
              url: item.link || '#',
              date: toISODate(d),
              metrics: {}
            })
          );
        }
      }
    } catch (e) {
      console.warn('[RSS] error for', url, e.message);
    }
  }
  return all;
}

/* LinkedIn (guest/SEO) */
async function fetchLinkedInByUrl(url, { days = 3650, limit = 20 } = {}) {
  try {
    const html = await cacheGetSet(`li:${url}`, 5*60*1000, async () => {
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'fr-FR,fr;q=0.9' },
        timeout: 20000
      });
      return data;
    });

    const $ = cheerio.load(html);
    const blocks = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      const txt = $(el).contents().text().trim();
      if (txt) blocks.push(txt);
    });
    if (!blocks.length) return { company: null, items: [] };

    const graphs = [];
    for (const txt of blocks) {
      try {
        const json = JSON.parse(txt);
        if (Array.isArray(json)) graphs.push(...json);
        else if (json['@graph']) graphs.push(...json['@graph']);
        else graphs.push(json);
      } catch { /* ignore */ }
    }

    const org = graphs.find(o => o['@type']==='Organization') || null;
    const company = org ? {
      name: org.name || null,
      slogan: org.slogan || null,
      site: org.sameAs || null,
      employees: org.numberOfEmployees?.value ?? null,
      locality: org.address?.addressLocality || null,
      country: org.address?.addressCountry || null,
      logo: org.logo?.contentUrl || null,
      description: org.description || null,
      url
    } : null;

    const min = cutoffDays(days);
    const postsAll = graphs
      .filter(o => o['@type']==='DiscussionForumPosting')
      .map(p => {
        const u = p.url || url;
        const dt = p.datePublished || Date.now();
        const id = 'li-' + crypto.createHash('sha256').update(`${u}|${dt}`).digest('hex').slice(0,16);
        return {
          id,
          type: 'LinkedIn',
          title: (p.text || '').split('\n')[0]?.slice(0,120) || 'Post LinkedIn',
          url: u,
          date: toISODate(dt),
          metrics: {}
        };
      })
      .filter(x => new Date(x.date) >= min)
      .sort((a,b)=> a.date < b.date ? 1 : -1);

    const posts = postsAll.slice(0, Math.min(Number(limit)||20, 50));

    const seen = new Set();
    const items = posts.filter(x => {
      const u = x.url || '';
      if (!u) return true;
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });

    return { company, items };
  } catch (e) {
    console.warn('[LinkedIn] fetch error:', e.message);
    return { company: null, items: [] };
  }
}

async function fetchLinkedIn(nameOrUrl, opts) {
  if (!nameOrUrl) return { company: null, items: [] };
  const raw = String(nameOrUrl).trim();

  if (/^https?:\/\//i.test(raw)) return fetchLinkedInByUrl(raw, opts);

  const base1 = 'https://www.linkedin.com/company/';
  const base2 = 'https://fr.linkedin.com/company/';

  const dashed =
    String(raw).normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
      .trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/--+/g,'-');

  const undashed =
    String(raw).normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-zA-Z0-9._]+/g,'').toLowerCase();

  const candidates = [
    `${base1}${dashed}`,
    `${base2}${dashed}`,
    `${base1}${undashed}`,
    `${base2}${undashed}`,
  ];

  for (const url of candidates) {
    const res = await fetchLinkedInByUrl(url, opts);
    if ((res.company && res.company.name) || (res.items && res.items.length)) return res;
  }
  return fetchLinkedInByUrl(candidates[0], opts);
}

/* Instagram via Apify */
async function scrapeInstagramApify(username, limit = 12) {
  username = String(username || '').replace(/^@/, '').trim();
  if (!username) return [];
  if (!APIFY_TOKEN) {
    console.warn('[Apify] APIFY_TOKEN manquant -> Instagram vide');
    return [];
  }
  const endpoint = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(APIFY_TOKEN)}`;
  const input = {
    directUrls: [`https://www.instagram.com/${username}/`],
    resultsType: 'posts',
    resultsLimit: Math.min(Number(limit) || 12, 50),
  };
  try {
    const { data } = await axios.post(endpoint, input, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000
    });
    if (!Array.isArray(data)) return [];
    return data.map((p, i) =>
      normalizeItem({
        id: `ig-${p.id || p.shortCode || i}`,
        type: 'Instagram',
        title: (p.caption && String(p.caption).slice(0, 120)) || (p.url || 'Post Instagram'),
        url: p.url || (p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : '#'),
        date: toISODate(p.timestamp || p.takenAt || p.createdAt || Date.now()),
        metrics: {
          likes: p.likesCount ?? p.edge_liked_by?.count ?? undefined,
          comments: p.commentsCount ?? p.edge_media_to_comment?.count ?? undefined,
        },
      })
    );
  } catch (e) {
    console.error('[Apify] Instagram failed:', e.response?.data || e.message);
    return [];
  }
}

/* TikTok via Apify */
async function scrapeTikTokApify(username, limit = 12) {
  username = String(username || '').replace(/^@/, '').trim();
  if (!username) return [];
  if (!APIFY_TOKEN) {
    console.warn('[Apify] APIFY_TOKEN manquant -> TikTok vide');
    return [];
  }
  const endpoint = `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(APIFY_TOKEN)}`;
  const input = {
    profiles: [`https://www.tiktok.com/@${username}`],
    profileScrapeSections: ['videos'],
    profileSorting: 'latest',
    resultsPerPage: Math.min(Number(limit) || 12, 20),
    excludePinnedPosts: true,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    proxyCountryCode: 'None'
  };
  try {
    const { data } = await axios.post(endpoint, input, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000
    });
    if (!Array.isArray(data) || data.length === 0) return [];
    return data.map((p, i) => {
      const id = p.id || p.videoId || p.awemeId || p.aweme_id || i;
      let ts = p.createTime || p.create_time || p.timestamp || p.time || p.date;
      if (typeof ts === 'string' && /^\d+$/.test(ts)) ts = Number(ts);
      if (typeof ts === 'number' && ts < 10_000_000_000) ts *= 1000;
      const stats = p.stats || p.statistics || {};
      return normalizeItem({
        id: `tt-${id}`,
        type: 'TikTok',
        title: String(p.text || p.desc || p.title || p.caption || 'Post TikTok').slice(0, 120),
        url: p.url || p.shareUrl || p.webVideoUrl || (id ? `https://www.tiktok.com/@${username}/video/${id}` : '#'),
        date: toISODate(ts || Date.now()),
        metrics: {
          likes: stats.diggCount ?? stats.likeCount ?? stats.likes ?? undefined,
          comments: stats.commentCount ?? stats.comments ?? undefined,
          shares: stats.shareCount ?? stats.shares ?? undefined,
          views: stats.playCount ?? stats.play_count ?? stats.views ?? undefined,
        },
      });
    });
  } catch (e) {
    console.error('[TikTok] failed:', e.response?.data || e.message);
    return [];
  }
}

/* YouTube Data API v3 */
const YT_BASE = 'https://www.googleapis.com/youtube/v3';

async function ytResolveChannelId(channelOrHandleOrName) {
  if (!channelOrHandleOrName) return null;
  const raw = String(channelOrHandleOrName).trim();
  if (raw.startsWith('UC')) return raw.replace(/^@/, '');
  const q = raw.startsWith('@') ? raw.slice(1) : raw;
  try {
    const { data } = await axios.get(`${YT_BASE}/search`, {
      params: { part: 'snippet', type: 'channel', q, maxResults: 1, key: YT_API_KEY },
      timeout: 20000
    });
    return data?.items?.[0]?.id?.channelId || null;
  } catch (e) {
    console.warn('[YouTube] resolve échoué:', e.message);
    return null;
  }
}

async function fetchYouTube({ channel, q = '', limit = 12, days = 7 }) {
  if (!YT_API_KEY) {
    console.warn('[YouTube] YT_API_KEY manquant -> YouTube vide');
    return [];
  }
  const minISO = cutoffDays(days).toISOString();
  const maxResults = Math.min(Number(limit) || 12, 50);
  try {
    let channelId = null;
    if (channel) channelId = await ytResolveChannelId(channel);
    if (!channelId && q) channelId = await ytResolveChannelId(q);

    const params = {
      part: 'snippet',
      maxResults,
      order: 'date',
      type: 'video',
      publishedAfter: minISO,
      key: YT_API_KEY
    };
    if (channelId) params.channelId = channelId;
    else if (q) params.q = q;
    else return [];

    const searchRes = await axios.get(`${YT_BASE}/search`, { params, timeout: 20000 });
    const videoIds = (searchRes.data.items || []).map(it => it.id?.videoId).filter(Boolean);
    if (videoIds.length === 0) return [];

    const videosRes = await axios.get(`${YT_BASE}/videos`, {
      params: { part: 'snippet,statistics,contentDetails', id: videoIds.join(','), key: YT_API_KEY },
      timeout: 20000
    });

    const items = (videosRes.data.items || []).map(v =>
      normalizeItem({
        id: `yt-${v.id}`,
        type: 'YouTube',
        title: v.snippet?.title || 'Vidéo YouTube',
        url: `https://youtu.be/${v.id}`,
        date: toISODate(v.snippet?.publishedAt || Date.now()),
        metrics: {
          views: v.statistics?.viewCount ? Number(v.statistics.viewCount) : undefined,
          likes: v.statistics?.likeCount ? Number(v.statistics.likeCount) : undefined,
          comments: v.statistics?.commentCount ? Number(v.statistics.commentCount) : undefined,
        }
      })
    );
    return items.sort((a,b)=> a.date < b.date ? 1 : -1);
  } catch (e) {
    console.error('[YouTube] fetch failed:', e.response?.data || e.message);
    return [];
  }
}

/* Config par défaut */
const COMPETITORS = {
  devfirst: {
    rss: ['https://dev.to/feed/tag/nestjs', 'https://hnrss.org/frontpage'],
    youtube: '@googledevelopers',
    instagram: 'devfirst',
    tiktok: ''
  },
  rivalytics: {
    rss: ['https://dev.to/feed/tag/webdev'],
    youtube: '',
    instagram: '',
    tiktok: ''
  },
  accenture: {
    rss: [],
    youtube: 'UCvDOfCgmS7q4OYMKVpy5Xjw',
    instagram: 'accenture',
    tiktok: 'accenture'
  },
};

/* Routes */
app.get('/api/linkedin', async (req, res) => {
  try {
    const slug = String(req.query.slug || '').trim();
    const urlParam = String(req.query.url || '').trim();
    const days = Number(req.query.days || 3650);
    const limit = Number(req.query.limit || 20);
    const target = urlParam || (slug ? `https://www.linkedin.com/company/${slug}` : '');
    if (!target) return res.status(400).json({ error: 'missing_url_or_slug' });

    const out = await fetchLinkedInByUrl(target, { days, limit });
    res.json(out);
  } catch (e) {
    console.error('[LinkedIn] failed:', e.message);
    res.status(500).json({ error: 'linkedin_fetch_failed' });
  }
});

app.get('/api/instagram', async (req, res) => {
  const username = String(req.query.username || '').trim();
  const limit = Number(req.query.limit || 12);
  res.json({ items: await scrapeInstagramApify(username, limit) });
});

app.get('/api/tiktok', async (req, res) => {
  const username = String(req.query.username || '').trim();
  const limit = Number(req.query.limit || 12);
  res.json({ items: await scrapeTikTokApify(username, limit) });
});

app.get('/api/rss', async (req, res) => {
  const name = String(req.query.name || '').trim().toLowerCase();
  const days = Number(req.query.days || 7);
  const overrideRss = String(req.query.rss || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const cfg = COMPETITORS[name] || {};
  const rssList = overrideRss.length ? overrideRss : cfg.rss || [];
  res.json({ items: await fetchRSS(rssList, days) });
});

app.get('/api/youtube', async (req, res) => {
  const channel = String(req.query.channel || '').trim();
  const q = String(req.query.q || '').trim();
  const days = Number(req.query.days || 7);
  const limit = Number(req.query.limit || 12);
  res.json({ items: await fetchYouTube({ channel, q, days, limit }) });
});

/* /api/collect central */
app.get('/api/collect', async (req, res) => {
  try {
    const rawName  = String(req.query.name || '').trim();
    const name     = rawName.toLowerCase();
    const days     = Number(req.query.days || 7);
    const limit    = Number(req.query.limit || 12);

    const sources = parseSources(req);

    const cfg       = COMPETITORS[name] || {};
    const rssList   = cfg.rss || [];
    const instaUser = cfg.instagram || slugifyNameToHandle(rawName);
    const ttUser    = cfg.tiktok || slugifyNameToHandle(rawName);
    const ytTarget  = cfg.youtube || rawName;

    const jobs = [];
    jobs.push(sources.has('linkedin') ? fetchLinkedIn(rawName, { days, limit: 20 }).then(r=>r.items) : Promise.resolve([]));
    jobs.push(sources.has('rss')      ? fetchRSS(rssList, days) : Promise.resolve([]));
    jobs.push(sources.has('instagram')? (instaUser ? scrapeInstagramApify(instaUser, limit) : Promise.resolve([])) : Promise.resolve([]));
    jobs.push(sources.has('tiktok')   ? (ttUser ? scrapeTikTokApify(ttUser, limit) : Promise.resolve([])) : Promise.resolve([]));
    jobs.push(sources.has('youtube')  ? fetchYouTube({ channel: ytTarget, q: cfg.youtube ? '' : rawName, days, limit }) : Promise.resolve([]));

    const [liItems, rssItems, igItems, ttItems, ytItems] = await Promise.all(jobs);

    const merged = [...liItems, ...rssItems, ...ttItems, ...igItems, ...ytItems]
      .sort((a, b) => a.date < b.date ? 1 : -1);

    const seenUrl = new Set();
    const items = merged.filter(x => {
      const u = x.url || '';
      if (!u) return true;
      if (seenUrl.has(u)) return false;
      seenUrl.add(u);
      return true;
    });

    res.json({
      items,
      usedSources: Array.from(sources),
      note: !APIFY_TOKEN && (sources.has('instagram') || sources.has('tiktok'))
        ? 'APIFY_TOKEN manquant: Instagram/TikTok seront vides.'
        : undefined,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'collect_failed' });
  }
});

/* Start */
app.listen(PORT, () => {
  console.log(`Rivalytics API prête sur http://localhost:${PORT}`);
  if (!APIFY_TOKEN) console.warn('⚠️  APIFY_TOKEN non défini: /api/instagram & /api/tiktok seront vides.');
  if (!YT_API_KEY)  console.warn('⚠️  YT_API_KEY non défini: /api/youtube sera vide.');
});