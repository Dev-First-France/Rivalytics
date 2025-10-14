// Construit la configuration CORS en fonction des origines autorisées.
import cors from 'cors';
import env from './env.js';

const parseAllowedOrigins = (raw) =>
  raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = parseAllowedOrigins(env.corsAllowedOrigins);

const corsOptions =
  allowedOrigins.length > 0
    ? {
        origin: (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
          }
          console.warn(`CORS: origine refusée ${origin}`);
          callback(null, false);
        },
        credentials: true,
      }
    : { origin: true, credentials: true };

export default () => cors(corsOptions);
