// Définit une erreur applicative standardisée pour les réponses HTTP JSON.
export class AppError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

export const createError = (status, code, message) =>
  new AppError(status, code, message);
