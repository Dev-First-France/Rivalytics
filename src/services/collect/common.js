// Regroupe les helpers partagés par les services d'agrégation.
export function normalizeItem({ id, type, title, url, date, metrics }) {
  return {
    id,
    type,
    title,
    url,
    date,
    metrics: metrics || {},
  };
}
