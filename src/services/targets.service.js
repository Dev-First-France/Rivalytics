// Encapsule la logique métier autour des cibles suivies par l'utilisateur.
import { MAX_TARGET_NAME } from '../constants/limits.js';
import { createError } from '../utils/errors.js';
import { sanitizeTargetName } from '../utils/strings.js';
import { getPool } from '../db/pool.js';

const requirePool = () => {
  const instance = getPool();
  if (!instance) {
    throw createError(503, 'database_unavailable');
  }
  return instance;
};

// Nettoie le nom fourni pour un target.
export function sanitizeName(name) {
  return sanitizeTargetName(name);
}

// Valide les contraintes métier du nom de target.
export function validateName(name) {
  if (!name) {
    throw createError(400, 'invalid_name');
  }
  if (name.length > MAX_TARGET_NAME) {
    throw createError(400, 'name_too_long');
  }
}

// Récupère la liste des targets d'un utilisateur.
export async function listTargets(userId) {
  const client = requirePool();
  try {
    const { rows } = await client.query(
      'SELECT id, name, created_at FROM targets WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return rows;
  } catch (error) {
    console.error('GET /targets failed:', error);
    throw createError(500, 'targets_fetch_failed');
  }
}

// Crée un nouveau target appartenant à l'utilisateur.
export async function createTarget(userId, name) {
  const client = requirePool();
  try {
    const { rows } = await client.query(
      'INSERT INTO targets (user_id, name) VALUES ($1, $2) RETURNING id, name, created_at',
      [userId, name],
    );
    return rows[0];
  } catch (error) {
    if (error?.code === '23505') {
      throw createError(409, 'target_exists');
    }
    console.error('POST /targets failed:', error);
    throw createError(500, 'target_create_failed');
  }
}

// Supprime un target si l'utilisateur en est propriétaire.
export async function deleteTarget(userId, id) {
  const client = requirePool();
  try {
    const result = await client.query(
      'DELETE FROM targets WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    if (result.rowCount === 0) {
      throw createError(404, 'not_found');
    }
  } catch (error) {
    if (error.status === 404) throw error;
    console.error('DELETE /targets/:id failed:', error);
    throw createError(500, 'target_delete_failed');
  }
}
