// Gère les routes d'authentification utilisateur.
import {
  authenticateUser,
  getSanitizedEmail,
  registerUser,
} from '../services/auth.service.js';
import { MIN_PASSWORD_LENGTH } from '../constants/limits.js';
import { emailRegex } from '../constants/regex.js';
import { createError } from '../utils/errors.js';
import { setAuthCookie, clearAuthCookie } from '../middlewares/auth.js';

// Traite l'inscription d'un nouvel utilisateur.
export async function register(req, res, next) {
  try {
    const email = getSanitizedEmail(req.body?.email);
    const password =
      typeof req.body?.password === 'string' ? req.body.password : '';

    if (!emailRegex.test(email)) {
      throw createError(400, 'invalid_email');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw createError(400, 'invalid_password');
    }

    const user = await registerUser({ email, password });
    setAuthCookie(res, user.id);
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
}

// Traite la connexion d'un utilisateur existant.
export async function login(req, res, next) {
  try {
    const email = getSanitizedEmail(req.body?.email);
    const password =
      typeof req.body?.password === 'string' ? req.body.password : '';

    if (!emailRegex.test(email) || password.length < MIN_PASSWORD_LENGTH) {
      throw createError(400, 'invalid_credentials');
    }

    const user = await authenticateUser({ email, password });
    setAuthCookie(res, user.id);
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

// Déconnecte l'utilisateur courant.
export function logout(req, res) {
  clearAuthCookie(res);
  res.status(204).end();
}

// Retourne le profil public de l'utilisateur courant.
export function me(req, res) {
  res.json({ user: req.user });
}
