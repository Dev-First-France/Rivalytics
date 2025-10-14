// Récupère les flux RSS sur une période donnée.
import RSSParser from 'rss-parser';
import { cutoffDays, toISODate } from '../../utils/dates.js';
import { normalizeItem } from './common.js';

const parser = new RSSParser();

// Récupère les entrées RSS récentes pour les URLs données.
export async function fetchRSS(urls = [], days = 7) {
  const min = cutoffDays(days);
  const all = [];
  for (const url of urls) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items || []) {
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
              metrics: {},
            }),
          );
        }
      }
    } catch (error) {
      console.warn('[RSS] error for', url, error.message);
    }
  }
  return all;
}
