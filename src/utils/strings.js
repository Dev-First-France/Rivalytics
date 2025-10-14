// Réunit les helpers de nettoyage et de normalisation des chaînes.
export const sanitizeEmail = (value) =>
  String(value ?? '').trim().toLowerCase();

export const sanitizeTargetName = (value) =>
  String(value ?? '').trim();

export function slugifyNameToHandle(name = '') {
  return String(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._]+/g, '')
    .toLowerCase();
}
