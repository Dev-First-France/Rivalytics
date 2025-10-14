// Contient les helpers de manipulation de dates utilisés par les scrapers.
export function cutoffDays(days) {
  return new Date(Date.now() - (Number(days) || 7) * 86400000);
}

export function toISODate(value) {
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function parseRelativeTextToDate(text) {
  if (!text) return null;
  const s = text.toLowerCase().replace(/\u00a0/g, ' ').trim();
  const numMatch = s.match(/(\d+[.,]?\d*)/);
  const n = numMatch ? Number.parseFloat(numMatch[1].replace(',', '.')) : null;
  if (n == null || Number.isNaN(n)) return null;

  let days = 0;
  if (/\ban(s)?\b|\byears?\b|\byrs?\b/.test(s)) days = n * 365;
  else if (/\bmois\b|\bmonths?\b|\bmos?\b/.test(s)) days = n * 30;
  else if (/\bsemaines?\b|\bweeks?\b|\bsem\b/.test(s)) days = n * 7;
  else if (/\bjours?\b|\bdays?\b|\bj\b/.test(s)) days = n;
  else if (/\bheures?\b|\bhours?\b|\bh\b/.test(s)) days = n / 24;
  else if (/\bminutes?\b|\bmins?\b|\bmin\b/.test(s)) days = n / (24 * 60);

  if (days === 0) return null;
  return new Date(Date.now() - days * 86400000);
}
