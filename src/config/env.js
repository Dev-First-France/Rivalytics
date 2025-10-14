// Fournit la configuration d'environnement centralisée pour l'application.
import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV || 'development';

const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number.parseInt(process.env.PORT || '', 10) || 3001,
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  bcryptRounds: Number.parseInt(process.env.BCRYPT_ROUNDS || '', 10) || 12,
  corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS || '',
  apifyToken: process.env.APIFY_TOKEN || '',
  ytApiKey: process.env.YT_API_KEY || '',
  liAcceptLanguage:
    process.env.LI_ACCEPT_LANGUAGE ||
    'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  liUserAgent:
    process.env.LI_UA ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
};

export default env;
