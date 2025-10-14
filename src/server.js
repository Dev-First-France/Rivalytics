// Démarre le serveur HTTP après vérification du schéma PostgreSQL.
import app from './app.js';
import { env } from './config/index.js';
import ensureSchema from './db/ensureSchema.js';

if (!env.jwtSecret) {
  console.warn(
    '⚠️  JWT_SECRET non défini: les routes d’authentification renverront une erreur 500.',
  );
}

async function start() {
  await ensureSchema().catch((error) => {
    console.error('❌ ensureSchema a échoué:', error);
  });

  app.listen(env.port, () => {
    console.log(`Rivalytics API prête sur http://localhost:${env.port}`);
    if (!env.apifyToken) {
      console.warn(
        '⚠️  APIFY_TOKEN non défini: /api/instagram & /api/tiktok seront vides.',
      );
    }
    if (!env.ytApiKey) {
      console.warn('⚠️  YT_API_KEY non défini: /api/youtube sera vide.');
    }
  });
}

start().catch((error) => {
  console.error('❌ Le serveur n’a pas pu démarrer:', error);
  process.exit(1);
});
