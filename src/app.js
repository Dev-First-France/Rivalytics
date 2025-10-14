// Instancie l'application Express et branche les middlewares globaux.
import express from 'express';
import cookieParser from 'cookie-parser';
import { createCorsMiddleware, createAuthLimiter } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/error.js';

const app = express();

app.use(createCorsMiddleware());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(express.static('public'));
app.use('/auth', createAuthLimiter());
app.use(routes);
app.use(errorHandler);

export default app;
