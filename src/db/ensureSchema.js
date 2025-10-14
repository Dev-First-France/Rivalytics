// Crée le schéma PostgreSQL minimal nécessaire au démarrage.
import pool from './pool.js';

async function ensureSchema() {
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text UNIQUE NOT NULL,
        password_hash text NOT NULL,
        created_at timestamptz DEFAULT now()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS targets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        name text NOT NULL,
        created_at timestamptz DEFAULT now()
      );
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS targets_user_name_idx ON targets (user_id, name);
    `);
    await client.query('COMMIT');
    console.log('✅ Schéma PostgreSQL OK');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur lors de la création du schéma PostgreSQL:', error);
  } finally {
    client.release();
  }
}

export default ensureSchema;
