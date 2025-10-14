// Fournit les utilitaires de parsing spécifiques à LinkedIn.
import crypto from 'node:crypto';
import { parseRelativeTextToDate, toISODate } from './dates.js';

export function parseAbbrevNumber(raw) {
  if (raw == null) return 0;
  let s = String(raw).toLowerCase().replace(/\u00a0/g, ' ').trim();
  const hasK = /\bk\b/.test(s);
  const hasM = /\bm\b/.test(s);
  s = s.replace(/[^\d.,\s]/g, '').replace(/\s+/g, '');
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  const n = Number.parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
  if (hasM) return Math.round(n * 1_000_000);
  if (hasK) return Math.round(n * 1_000);
  return Math.round(n);
}

export function liPickText($scope) {
  return (
    $scope.find('[data-test-id="main-feed-activity-card__commentary"]').first()
      .text().trim() || ''
  );
}

export function liPickTimeRaw($scope) {
  const t = $scope.find('time[datetime]').first();
  if (t.length) {
    return { iso: t.attr('datetime'), raw: t.text().trim() || null };
  }
  const fallback = $scope.find('time').first().text().trim();
  return { iso: null, raw: fallback || null };
}

export function liExtractLikes($scope) {
  const a = $scope.find('[data-test-id="social-actions__reactions"]').first();
  const attr = a.attr('data-num-reactions');
  if (attr) return parseAbbrevNumber(attr);
  const span = $scope
    .find('span[data-test-id="social-actions__reaction-count"]')
    .first()
    .text()
    .trim();
  if (span) return parseAbbrevNumber(span);
  const aria = a.attr('aria-label');
  if (aria) {
    const m = aria.match(/(\d[\d\s.,\u00a0]*)/);
    if (m) return parseAbbrevNumber(m[1]);
  }
  return 0;
}

export function liExtractComments($scope) {
  const a = $scope.find('[data-test-id="social-actions__comments"]').first();
  const attr = a.attr('data-num-comments');
  if (attr) return parseAbbrevNumber(attr);
  const aria = a.attr('aria-label');
  if (aria) {
    const m = aria.match(/(\d[\d\s.,\u00a0]*)/);
    if (m) return parseAbbrevNumber(m[1]);
  }
  const legacy = $scope
    .find('.social-details-social-counts__comments')
    .first()
    .text()
    .trim();
  if (legacy) {
    const m = legacy.match(/(\d[\d\s.,\u00a0]*)/);
    if (m) return parseAbbrevNumber(m[1]);
  }
  return 0;
}

export function liPickActivityUrn($scope) {
  return (
    $scope.attr('data-activity-urn') ||
    $scope.attr('data-featured-activity-urn') ||
    $scope.attr('data-attributed-urn') ||
    null
  );
}

export function liUrnToUrl(urn) {
  return urn ? `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}` : null;
}

export function liPickPostUrl($scope) {
  const overlay = $scope
    .find('a.main-feed-card__overlay-link')
    .first()
    .attr('href');
  const deep = $scope
    .find('a[href*="/posts/"], a[href*="activity-"]')
    .first()
    .attr('href');
  return overlay || deep || null;
}

export function liNormalizeUrl(u) {
  if (!u) return null;
  try {
    const url = new URL(u, 'https://www.linkedin.com');
    if (url.hostname.startsWith('fr.')) url.hostname = url.hostname.slice(3);
    if (url.hostname !== 'www.linkedin.com') url.hostname = 'www.linkedin.com';
    ['utm_source', 'utm_medium', 'utm_campaign', 'trk', 'trackingId', 'originalSubdomain'].forEach(
      (key) => url.searchParams.delete(key),
    );
    if (url.pathname.endsWith('/') && !/^\/$/.test(url.pathname)) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }
    return url.toString();
  } catch {
    return u;
  }
}

export function liActivityIdFromUrl(u) {
  if (!u) return null;
  try {
    const s = decodeURIComponent(u);
    const m1 = s.match(/activity:(\d{8,})/);
    if (m1) return m1[1];
    const m2 = s.match(/activity-(\d{8,})/);
    if (m2) return m2[1];
    return null;
  } catch {
    return null;
  }
}

export function liActivityIdFromUrn(urn) {
  if (!urn) return null;
  const s = decodeURIComponent(String(urn));
  const m = s.match(/activity:(\d{8,})/);
  return m ? m[1] : null;
}

export function liCanonicalKey({ url, id, _activityId }) {
  const fromUrl = liActivityIdFromUrl(url);
  const activityId = _activityId || fromUrl;
  if (activityId) return `li:act:${activityId}`;
  const norm = liNormalizeUrl(url || '');
  if (norm) return `li:url:${norm}`;
  return `li:id:${id}`;
}

export function liItemId(seed) {
  return (
    'li-' +
    crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16)
  );
}

export function guessDateIso({ iso, raw }) {
  if (iso) {
    const dt = new Date(iso);
    if (!Number.isNaN(dt)) return dt.toISOString().slice(0, 10);
  }
  if (raw) {
    const guess = parseRelativeTextToDate(raw);
    if (guess) return toISODate(guess);
  }
  return null;
}
