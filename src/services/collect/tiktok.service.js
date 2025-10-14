// S'appuie sur Apify pour récupérer les vidéos TikTok d'un profil.
import { axios } from '../../utils/http.js';
import { normalizeItem } from './common.js';
import { toISODate } from '../../utils/dates.js';
import { env } from '../../config/index.js';

// Récupère les vidéos TikTok via l'acteur Apify.
export async function scrapeTikTok(username, limit = 12) {
  username = String(username || '').replace(/^@/, '').trim();
  if (!username) return [];
  if (!env.apifyToken) {
    console.warn('[Apify] APIFY_TOKEN manquant -> TikTok vide');
    return [];
  }
  const endpoint = `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(
    env.apifyToken,
  )}`;
  const input = {
    profiles: [`https://www.tiktok.com/@${username}`],
    profileScrapeSections: ['videos'],
    profileSorting: 'latest',
    resultsPerPage: Math.min(Number(limit) || 12, 20),
    excludePinnedPosts: true,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    proxyCountryCode: 'None',
  };
  try {
    const { data } = await axios.post(endpoint, input, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000,
    });
    if (!Array.isArray(data) || data.length === 0) return [];
    return data.map((post, index) => {
      const id = post.id || post.videoId || post.awemeId || post.aweme_id || index;
      let ts = post.createTime || post.create_time || post.timestamp || post.time || post.date;
      if (typeof ts === 'string' && /^\d+$/.test(ts)) ts = Number(ts);
      if (typeof ts === 'number' && ts < 10_000_000_000) ts *= 1000;
      const stats = post.stats || post.statistics || {};
      return normalizeItem({
        id: `tt-${id}`,
        type: 'TikTok',
        title: String(post.text || post.desc || post.title || post.caption || 'Post TikTok').slice(
          0,
          120,
        ),
        url:
          post.url ||
          post.shareUrl ||
          post.webVideoUrl ||
          (id ? `https://www.tiktok.com/@${username}/video/${id}` : '#'),
        date: toISODate(ts || Date.now()),
        metrics: {
          likes:
            stats.diggCount ??
            stats.likeCount ??
            stats.likes ??
            undefined,
          comments: stats.commentCount ?? stats.comments ?? undefined,
          shares: stats.shareCount ?? stats.shares ?? undefined,
          views:
            stats.playCount ??
            stats.play_count ??
            stats.views ??
            undefined,
        },
      });
    });
  } catch (error) {
    console.error('[TikTok] failed:', error.response?.data || error.message);
    return [];
  }
}
