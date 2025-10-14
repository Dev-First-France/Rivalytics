// Implémente la récupération et le parsing des posts LinkedIn.
import * as cheerio from 'cheerio';
import crypto from 'node:crypto';
import { axios, linkedinHeaders } from '../../utils/http.js';
import { cacheGetSet } from '../../utils/cache.js';
import { cutoffDays, toISODate } from '../../utils/dates.js';
import {
  liPickText,
  liPickTimeRaw,
  liExtractLikes,
  liExtractComments,
  liPickActivityUrn,
  liUrnToUrl,
  liPickPostUrl,
  liNormalizeUrl,
  liActivityIdFromUrl,
  liActivityIdFromUrn,
  liCanonicalKey,
  guessDateIso,
} from '../../utils/linkedin.js';
import { normalizeItem } from './common.js';

const getLinkedInHtml = (url) =>
  cacheGetSet(`li:${url}`, 5 * 60 * 1000, async () => {
    const { data } = await axios.get(url, {
      headers: linkedinHeaders,
      maxRedirects: 5,
      timeout: 30000,
      validateStatus: (status) => status >= 200 && status < 400,
    });
    return data;
  });

const parseJsonLd = ($) => {
  const blocks = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const txt = $(el).contents().text().trim();
    if (txt) blocks.push(txt);
  });
  const graphs = [];
  for (const txt of blocks) {
    try {
      const json = JSON.parse(txt);
      if (Array.isArray(json)) graphs.push(...json);
      else if (json['@graph']) graphs.push(...json['@graph']);
      else graphs.push(json);
    } catch {
      // ignore JSON invalide
    }
  }
  return graphs;
};

const extractCompany = (graph, fixedUrl) => {
  const org = graph.find((entry) => entry['@type'] === 'Organization') || null;
  if (!org) return null;
  return {
    name: org.name || null,
    slogan: org.slogan || null,
    site: org.sameAs || null,
    employees: org.numberOfEmployees?.value ?? null,
    locality: org.address?.addressLocality || null,
    country: org.address?.addressCountry || null,
    logo: org.logo?.contentUrl || null,
    description: org.description || null,
    url: liNormalizeUrl(fixedUrl),
  };
};

const preferWithMetrics = (a, b) => {
  const has = (metrics) =>
    metrics && (metrics.likes > 0 || metrics.comments > 0 || metrics.views > 0 || metrics.shares > 0);
  if (has(a.metrics) && !has(b.metrics)) return a;
  if (!has(a.metrics) && has(b.metrics)) return b;
  if (a.date && !b.date) return a;
  if (!a.date && b.date) return b;
  const da = a.date ? new Date(a.date).getTime() : 0;
  const db = b.date ? new Date(b.date).getTime() : 0;
  return da >= db ? a : b;
};

// Récupère les posts LinkedIn associés à une URL d'entreprise.
export async function fetchLinkedInByUrl(targetUrl, { days = 3650, limit = 20 } = {}) {
  try {
    const fixedUrl = String(targetUrl || '').replace(/^https:\/\/fr\./, 'https://www.');
    const html = await getLinkedInHtml(fixedUrl);
    const $ = cheerio.load(html);

    const graphs = parseJsonLd($);
    const company = extractCompany(graphs, fixedUrl);
    const min = cutoffDays(days);

    const jsonldItems = graphs
      .filter((entry) => entry['@type'] === 'DiscussionForumPosting')
      .map((post) => {
        const url = liNormalizeUrl(post.url || fixedUrl);
        const dt = post.datePublished || Date.now();
        const actId = liActivityIdFromUrl(url);
        const id = actId
          ? `li-${actId}`
          : `li-${crypto.createHash('sha256').update(`${url}|${dt}`).digest('hex').slice(0, 16)}`;
        return normalizeItem({
          id,
          type: 'LinkedIn',
          title: (post.text || '').split('\n')[0]?.slice(0, 120) || 'Post LinkedIn',
          url,
          date: toISODate(dt),
          metrics: {},
        });
      })
      .filter((item) => !item.date || new Date(item.date) >= min);

    const domRaw = [];
    const $cards = $('article[data-id="main-feed-card"], [data-test-id="main-feed-activity-card"]');
    $cards.each((index, element) => {
      const $card = $(element);
      const text = liPickText($card);
      const when = liPickTimeRaw($card);
      const likes = liExtractLikes($card);
      const comments = liExtractComments($card);

      const urn = liPickActivityUrn($card);
      const fromUrn = liActivityIdFromUrn(urn);
      const link = liNormalizeUrl(liPickPostUrl($card) || liUrnToUrl(urn));

      const dateIso = guessDateIso(when);
      if (dateIso) {
        const dt = new Date(dateIso);
        if (dt < min) return;
      }

      const actFromUrl = liActivityIdFromUrl(link);
      const activityId = fromUrn || actFromUrl;
      const idSeed = activityId ? `act:${activityId}` : link || text || String(index);
      const id = `li-${crypto.createHash('sha256').update(idSeed).digest('hex').slice(0, 16)}`;

      domRaw.push({
        ...normalizeItem({
          id,
          type: 'LinkedIn',
          title: text?.split('\n')[0]?.slice(0, 120) || 'Post LinkedIn',
          url: link || null,
          date: dateIso || null,
          metrics: { likes, comments },
        }),
        _activityId: activityId || null,
      });
    });

    const byKey = new Map();
    const push = (item) => {
      if (!item._activityId) {
        item._activityId = liActivityIdFromUrl(item.url) || liActivityIdFromUrn(item.id);
      }
      const key = liCanonicalKey(item);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, item);
        return;
      }
      byKey.set(key, preferWithMetrics(existing, item));
    };

    domRaw.forEach(push);
    jsonldItems.forEach(push);

    const itemsAll = Array.from(byKey.values());
    const getDate = (value) => (value.date ? new Date(value.date).getTime() : 0);
    itemsAll.sort((a, b) => getDate(b) - getDate(a));
    const items = itemsAll.slice(0, Math.min(Number(limit) || 20, 50));

    return { company, items };
  } catch (error) {
    console.warn('[LinkedIn] fetch error:', error.message);
    return { company: null, items: [] };
  }
}

// Résout un nom ou un handle vers une URL LinkedIn et récupère les posts.
export async function fetchLinkedIn(nameOrUrl, options) {
  if (!nameOrUrl) return { company: null, items: [] };
  const raw = String(nameOrUrl).trim();
  if (/^https?:\/\//i.test(raw)) {
    return fetchLinkedInByUrl(raw, options);
  }

  const base1 = 'https://www.linkedin.com/company/';
  const base2 = 'https://fr.linkedin.com/company/';

  const dashed = String(raw)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');

  const undashed = String(raw)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._]+/g, '')
    .toLowerCase();

  const candidates = [
    `${base1}${dashed}`,
    `${base2}${dashed}`,
    `${base1}${undashed}`,
    `${base2}${undashed}`,
  ];

  for (const url of candidates) {
    const res = await fetchLinkedInByUrl(url, options);
    if ((res.company && res.company.name) || (res.items && res.items.length)) {
      return res;
    }
  }
  return fetchLinkedInByUrl(candidates[0], options);
}
