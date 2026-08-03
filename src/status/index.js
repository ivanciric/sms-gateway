import { execSync } from 'child_process';
import os from 'os';
import db from '../db/index.js';
import { config } from '../config.js';
import { ModemClient } from '../sms/modem.js';
import { getRecentActivity } from '../activity/index.js';

function checkSystemd(service) {
  try {
    return execSync(`systemctl is-active ${service}`, { encoding: 'utf8' }).trim() === 'active';
  } catch {
    return false;
  }
}

async function checkPublicUrl() {
  if (!config.publicUrl) {
    return { status: 'unknown', message: 'PUBLIC_URL nije podešen' };
  }

  const start = Date.now();
  try {
    const response = await fetch(`${config.publicUrl.replace(/\/$/, '')}/health`, {
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - start;
    if (response.ok) {
      return { status: 'ok', message: config.publicUrl, latencyMs };
    }
    return { status: 'error', message: `HTTP ${response.status}`, latencyMs };
  } catch (err) {
    return { status: 'error', message: err.message, latencyMs: Date.now() - start };
  }
}

function getStats() {
  const outbound = db.prepare(`SELECT COUNT(*) AS n FROM sms_logs WHERE direction = 'outbound'`).get().n;
  const inbound = db.prepare(`SELECT COUNT(*) AS n FROM sms_logs WHERE direction = 'inbound'`).get().n;
  const activeKeys = db.prepare(`SELECT COUNT(*) AS n FROM api_keys WHERE is_active = 1`).get().n;
  const lastOutbound = db
    .prepare(`SELECT created_at, status FROM sms_logs WHERE direction = 'outbound' ORDER BY id DESC LIMIT 1`)
    .get();
  const lastInbound = db
    .prepare(`SELECT created_at, phone_number FROM sms_logs WHERE direction = 'inbound' ORDER BY id DESC LIMIT 1`)
    .get();

  return { outbound, inbound, activeKeys, lastOutbound, lastInbound };
}

export async function collectStatus(options = {}) {
  const { includeModem = true, includePublic = true } = options;

  let database = { status: 'ok' };
  try {
    db.prepare('SELECT 1').get();
  } catch (err) {
    database = { status: 'error', message: err.message };
  }

  const services = {
    smsGateway: { status: 'ok', uptime: Math.floor(process.uptime()) },
    cloudflared: {
      status: checkSystemd('cloudflared') ? 'ok' : 'error',
      message: checkSystemd('cloudflared') ? 'active' : 'inactive',
    },
  };

  const stats = getStats();
  const activity = getRecentActivity();

  const modemPromise = includeModem
    ? new ModemClient().checkStatus()
    : Promise.resolve({ status: 'unknown', message: 'Preskočeno', url: config.modemUrl });

  const publicPromise = includePublic ? checkPublicUrl() : Promise.resolve({ status: 'unknown', message: 'Preskočeno' });

  const [modemStatus, publicAccess] = await Promise.all([modemPromise, publicPromise]);

  const overallOk =
    database.status === 'ok' &&
    modemStatus.status === 'ok' &&
    modemStatus.operational !== false &&
    services.cloudflared.status === 'ok';

  return {
    ok: overallOk,
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    services,
    modem: modemStatus,
    database,
    publicAccess,
    stats,
    activity,
    config: {
      modemUrl: config.modemUrl,
      publicUrl: config.publicUrl || null,
    },
  };
}
