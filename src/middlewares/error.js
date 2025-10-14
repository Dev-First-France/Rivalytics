// Centralise la gestion des erreurs HTTP en réponse JSON.
import { env } from '../config/index.js';

// Formate les erreurs en réponse JSON uniforme.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }
  const status = Number.isInteger(err.status) ? err.status : 500;
  const code = err.code || 'internal_error';
  const payload = { error: code };

  const shouldExposeMessage =
    !env.isProduction || status < 500 || Boolean(err.expose);
  if (shouldExposeMessage && err.message && err.message !== code) {
    payload.message = err.message;
  }

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json(payload);
}
