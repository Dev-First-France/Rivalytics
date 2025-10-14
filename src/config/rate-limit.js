// Configure le rate limiting des routes sensibles comme /auth.
import rateLimit from 'express-rate-limit';
import {
  AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_MS,
} from '../constants/limits.js';

export const createAuthLimiter = () =>
  rateLimit({
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    limit: AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  });
