// Fournit les options de cookies utilisées pour l'authentification.
import env from './env.js';
import { COOKIE_MAX_AGE_MS } from '../constants/limits.js';

export const baseCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProduction,
  path: '/',
};

export const authCookieOptions = {
  ...baseCookieOptions,
  maxAge: COOKIE_MAX_AGE_MS,
};
