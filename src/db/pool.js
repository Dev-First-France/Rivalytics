// Initialise et expose l'instance pg.Pool pour l'accès PostgreSQL.
import pg from 'pg';
import { env } from '../config/index.js';

let pool = null;

if (!env.databaseUrl) {
  console.warn(
    '⚠️  DATABASE_URL non défini: authentification et favoris désactivés.',
  );
} else {
  const shouldUseSSL = !/localhost|127\.0\.0\.1/.test(env.databaseUrl);
  pool = new pg.Pool({
    connectionString: env.databaseUrl,
    ssl: shouldUseSSL ? { rejectUnauthorized: false } : false,
  });
  pool.on('error', (err) => {
    console.error('❌ Erreur PostgreSQL inattendue:', err);
  });
}

export const getPool = () => pool;

export default pool;
