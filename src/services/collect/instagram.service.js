// S'appuie sur Apify pour récupérer les posts Instagram récents.
import { axios } from '../../utils/http.js';
import { normalizeItem } from './common.js';
import { toISODate } from '../../utils/dates.js';
import { env } from '../../config/index.js';

// Récupère les posts Instagram via l'acteur Apify.
export async function scrapeInstagram(username, limit = 12) {
  username = String(username || '').replace(/^@/, '').trim();
  if (!username) return [];
  if (!env.apifyToken) {
    console.warn('[Apify] APIFY_TOKEN manquant -> Instagram vide');
    return [];
  }
  const endpoint = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(
    env.apifyToken,
  )}`;
  const input = {
    directUrls: [`https://www.instagram.com/${username}/`],
    resultsType: 'posts',
    resultsLimit: Math.min(Number(limit) || 12, 50),
  };
  try {
    const { data } = await axios.post(endpoint, input, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000,
    });
    if (!Array.isArray(data)) return [];
    return data.map((post, index) =>
      normalizeItem({
        id: `ig-${post.id || post.shortCode || index}`,
        type: 'Instagram',
        title:
          (post.caption && String(post.caption).slice(0, 120)) ||
          post.url ||
          'Post Instagram',
        url:
          post.url ||
          (post.shortCode
            ? `https://www.instagram.com/p/${post.shortCode}/`
            : '#'),
        date: toISODate(
          post.timestamp || post.takenAt || post.createdAt || Date.now(),
        ),
        metrics: {
          likes:
            post.likesCount ??
            post.edge_liked_by?.count ??
            undefined,
          comments:
            post.commentsCount ??
            post.edge_media_to_comment?.count ??
            undefined,
        },
      }),
    );
  } catch (error) {
    console.error('[Apify] Instagram failed:', error.response?.data || error.message);
    return [];
  }
}
