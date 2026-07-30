import { logRequest } from '../activity/index.js';

export function apiRequestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    if (req.path === '/activity' || req.path === '/status' || req.path === '/activity/stream') return;

    let summary = '';
    if (req.method === 'POST' && req.path === '/sms/send' && req.body) {
      const { to, message } = req.body;
      summary = `to=${to || '?'} msg="${message ? String(message).slice(0, 80) : ''}"`;
    }

    logRequest({
      method: req.method,
      path: req.originalUrl || req.path,
      statusCode: res.statusCode,
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      apiKeyPrefix: req.apiKey?.key_prefix,
      summary,
      durationMs: Date.now() - start,
    });
  });

  next();
}
