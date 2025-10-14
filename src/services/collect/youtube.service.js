// Interroge l'API YouTube pour récupérer les vidéos récentes.
import { axios } from '../../utils/http.js';
import { normalizeItem } from './common.js';
import { cutoffDays, toISODate } from '../../utils/dates.js';
import { env } from '../../config/index.js';

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

async function ytResolveChannelId(channelOrHandleOrName) {
  if (!channelOrHandleOrName) return null;
  const raw = String(channelOrHandleOrName).trim();
  if (raw.startsWith('UC')) return raw.replace(/^@/, '');
  const q = raw.startsWith('@') ? raw.slice(1) : raw;
  try {
    const { data } = await axios.get(`${YT_BASE}/search`, {
      params: { part: 'snippet', type: 'channel', q, maxResults: 1, key: env.ytApiKey },
      timeout: 20000,
    });
    return data?.items?.[0]?.id?.channelId || null;
  } catch (error) {
    console.warn('[YouTube] resolve échoué:', error.message);
    return null;
  }
}

// Récupère les vidéos YouTube en fonction d'un channel ou d'une recherche.
export async function fetchYouTube({ channel, q = '', limit = 12, days = 7 }) {
  if (!env.ytApiKey) {
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
      key: env.ytApiKey,
    };
    if (channelId) {
      params.channelId = channelId;
    } else if (q) {
      params.q = q;
    } else {
      return [];
    }

    const searchRes = await axios.get(`${YT_BASE}/search`, {
      params,
      timeout: 20000,
    });
    const videoIds = (searchRes.data.items || [])
      .map((item) => item.id?.videoId)
      .filter(Boolean);
    if (videoIds.length === 0) return [];

    const videosRes = await axios.get(`${YT_BASE}/videos`, {
      params: {
        part: 'snippet,statistics,contentDetails',
        id: videoIds.join(','),
        key: env.ytApiKey,
      },
      timeout: 20000,
    });

    const items = (videosRes.data.items || []).map((video) =>
      normalizeItem({
        id: `yt-${video.id}`,
        type: 'YouTube',
        title: video.snippet?.title || 'Vidéo YouTube',
        url: `https://youtu.be/${video.id}`,
        date: toISODate(video.snippet?.publishedAt || Date.now()),
        metrics: {
          views: video.statistics?.viewCount
            ? Number(video.statistics.viewCount)
            : undefined,
          likes: video.statistics?.likeCount
            ? Number(video.statistics.likeCount)
            : undefined,
          comments: video.statistics?.commentCount
            ? Number(video.statistics.commentCount)
            : undefined,
        },
      }),
    );
    return items.sort((a, b) => (a.date && b.date ? (a.date < b.date ? 1 : -1) : -1));
  } catch (error) {
    console.error('[YouTube] fetch failed:', error.response?.data || error.message);
    return [];
  }
}
