import { Router } from 'express';
import { config } from '../config.js';
import { collectStatus } from '../status/index.js';
import { getRecentActivity } from '../activity/index.js';
import { activityBus } from '../activity/events.js';

const router = Router();

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

router.get('/status', async (_req, res) => {
  try {
    res.json(await collectStatus());
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/activity', (_req, res) => {
  res.json(getRecentActivity());
});

router.get('/activity/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = ({ type, data }) => {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const handler = (event) => send(event);
  activityBus.on('activity', handler);

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    activityBus.off('activity', handler);
  });
});

export default router;

export async function statusPageHandler(_req, res) {
  try {
    const status = await collectStatus({ includeModem: false, includePublic: false });
    res.render('status', {
      status,
      refreshSeconds: config.statusRefreshSeconds,
      formatUptime,
    });
  } catch (err) {
    res.status(500).render('error', { message: err.message, user: null });
  }
}
