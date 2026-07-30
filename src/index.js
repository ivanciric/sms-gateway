import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import panelRoutes from './routes/panel.js';
import statusRoutes, { statusPageHandler } from './routes/status.js';
import { startSmsPoller } from './sms/poller.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.set('trust proxy', true);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/static', express.static(path.join(__dirname, '../public')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/status', statusPageHandler);

app.get('/', (_req, res) => {
  res.redirect('/status');
});

app.use('/api/v1', apiRoutes);
app.use('/api/v1', statusRoutes);
app.use('/panel', authRoutes);
app.use('/panel', panelRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).render('error', { message: 'Interna greška servera.', user: null });
});

app.listen(config.port, config.host, () => {
  console.log(`SMS Gateway running on http://${config.host}:${config.port}`);
  startSmsPoller();
});
