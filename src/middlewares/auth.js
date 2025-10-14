// Fournit l'authentification JWT basée sur un cookie httpOnly.
import jwt from 'jsonwebtoken';
import {
  authCookieOptions,
  baseCookieOptions,
  env,
} from '../config/index.js';
import {
  createAuthToken,
  findUserById,
  getTokenCookieName,
  isDatabaseAvailable,
} from '../services/auth.service.js';
import { createError } from '../utils/errors.js';

const TOKEN_COOKIE = getTokenCookieName();

// Crée et envoie le cookie d'authentification.
export function setAuthCookie(res, userId) {
  const token = createAuthToken(userId);
  res.cookie(TOKEN_COOKIE, token, authCookieOptions);
}

// Supprime le cookie d'authentification.
export function clearAuthCookie(res) {
  res.clearCookie(TOKEN_COOKIE, baseCookieOptions);
}

// Vérifie le JWT du cookie et charge l'utilisateur courant.
export async function requireAuth(req, res, next) {
  try {
    if (!isDatabaseAvailable()) {
      throw createError(503, 'database_unavailable');
    }
    if (!env.jwtSecret) {
      throw createError(500, 'jwt_not_configured');
    }
    const token = req.cookies?.[TOKEN_COOKIE];
    if (!token) {
      throw createError(401, 'unauthenticated');
    }
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch (error) {
      clearAuthCookie(res);
      throw createError(401, 'unauthenticated');
    }
    const user = await findUserById(payload.sub);
    if (!user) {
      clearAuthCookie(res);
      throw createError(401, 'unauthenticated');
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
