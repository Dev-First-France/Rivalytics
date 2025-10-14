// Gère les routes CRUD liées aux cibles utilisateur.
import {
  createTarget as createTargetService,
  deleteTarget as deleteTargetService,
  listTargets as listTargetsService,
  sanitizeName,
  validateName,
} from '../services/targets.service.js';
import { uuidRegex } from '../constants/regex.js';
import { createError } from '../utils/errors.js';

// Retourne la liste des targets de l'utilisateur connecté.
export async function listTargets(req, res, next) {
  try {
    const targets = await listTargetsService(req.user.id);
    res.json({ targets });
  } catch (error) {
    next(error);
  }
}

// Crée un nouveau target pour l'utilisateur connecté.
export async function createTarget(req, res, next) {
  try {
    const name = sanitizeName(req.body?.name);
    validateName(name);
    const target = await createTargetService(req.user.id, name);
    res.status(201).json({ target });
  } catch (error) {
    next(error);
  }
}

// Supprime un target spécifique de l'utilisateur.
export async function deleteTarget(req, res, next) {
  try {
    const { id } = req.params;
    if (!uuidRegex.test(id)) {
      throw createError(400, 'invalid_id');
    }
    await deleteTargetService(req.user.id, id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
