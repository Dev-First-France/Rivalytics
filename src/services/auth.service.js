// Contient la logique métier liée à l'authentification et aux utilisateurs.
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/index.js';
import pool, { getPool } from '../db/pool.js';
import { AppError, createError } from '../utils/errors.js';
import { sanitizeEmail } from '../utils/strings.js';

const TOKEN_COOKIE = 'rivalytics_token';

const toPublicUser = (row) =>
  row
    ? {
        id: row.id,
        email: row.email,
        created_at: row.created_at,
      }
    : null;

const requirePool = () => {
  const instance = getPool();
  if (!instance) {
    throw createError(503, 'database_unavailable');
  }
  return instance;
};

const ensureJwtSecret = () => {
  if (!env.jwtSecret) {
    throw createError(500, 'jwt_not_configured');
  }
};

// Retourne le nom du cookie JWT utilisé côté client.
export const getTokenCookieName = () => TOKEN_COOKIE;

// Nettoie l'email depuis l'entrée utilisateur.
export const getSanitizedEmail = (value) => sanitizeEmail(value);

// Recherche un utilisateur via son email (mot de passe inclus).
export async function findUserByEmail(email) {
  const client = requirePool();
  const { rows } = await client.query(
    'SELECT id, email, password_hash, created_at FROM users WHERE email = $1',
    [email],
  );
  return rows[0] || null;
}

// Retourne un utilisateur public en fonction de son ID.
export async function findUserById(id) {
  const client = requirePool();
  const { rows } = await client.query(
    'SELECT id, email, created_at FROM users WHERE id = $1',
    [id],
  );
  return rows[0] || null;
}

// Crée un utilisateur et retourne son profil public.
export async function registerUser({ email, password }) {
  const client = requirePool();
  ensureJwtSecret();
  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      throw createError(409, 'email_exists');
    }
    const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
    const { rows } = await client.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash],
    );
    return toPublicUser(rows[0]);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('/auth/register failed:', error);
    throw createError(500, 'registration_failed');
  }
}

// Authentifie un utilisateur et retourne son profil public.
export async function authenticateUser({ email, password }) {
  const client = requirePool();
  ensureJwtSecret();
  try {
    const user = await findUserByEmail(email);
    if (!user) {
      throw createError(401, 'invalid_credentials');
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      throw createError(401, 'invalid_credentials');
    }
    return toPublicUser(user);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('/auth/login failed:', error);
    throw createError(500, 'login_failed');
  }
}

// Génère un JWT signé pour l'utilisateur.
export function createAuthToken(userId) {
  ensureJwtSecret();
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: '7d' });
}

// Vérifie que la configuration JWT est présente.
export function ensureJwtConfigured() {
  ensureJwtSecret();
}

// Indique si une connexion à la base de données est disponible.
export const isDatabaseAvailable = () => Boolean(pool);
