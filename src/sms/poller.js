import db from '../db/index.js';
import { config } from '../config.js';
import { ModemClient } from './modem.js';
import { logSms, logWebhook } from '../activity/index.js';

async function forwardToCallback(callbackUrl, payload, meta) {
  const start = Date.now();
  try {
    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const durationMs = Date.now() - start;
    const result = {
      success: response.ok,
      httpStatus: response.status,
      durationMs,
      error: response.ok ? null : `HTTP ${response.status}`,
    };

    logWebhook({
      smsLogId: meta.smsLogId,
      apiKeyId: meta.apiKeyId,
      callbackUrl,
      status: result.success ? 'success' : 'failed',
      httpStatus: result.httpStatus,
      errorMessage: result.error,
      durationMs,
    });

    return result;
  } catch (err) {
    const durationMs = Date.now() - start;
    logWebhook({
      smsLogId: meta.smsLogId,
      apiKeyId: meta.apiKeyId,
      callbackUrl,
      status: 'failed',
      errorMessage: err.message,
      durationMs,
    });
    console.error(`Callback failed for ${callbackUrl}:`, err.message);
    return { success: false, error: err.message, durationMs };
  }
}

async function processInboundMessages() {
  const modem = new ModemClient();

  try {
    const messages = await modem.fetchInbox();
    const activeCallbacks = db
      .prepare(
        `SELECT * FROM api_keys
         WHERE is_active = 1 AND callback_url IS NOT NULL AND callback_url != ''`
      )
      .all();

    for (const msg of messages) {
      if (!msg.id) continue;

      const existing = db
        .prepare('SELECT id FROM processed_inbound_sms WHERE modem_message_id = ?')
        .get(msg.id);
      if (existing) continue;

      db.prepare('INSERT INTO processed_inbound_sms (modem_message_id) VALUES (?)').run(msg.id);
      const { id: smsLogId } = logSms({
        direction: 'inbound',
        phoneNumber: msg.number,
        message: msg.content,
        status: 'received',
        modemMessageId: msg.id,
      });
      const payload = {
        from: msg.number,
        message: msg.content,
        received_at: msg.date,
        modem_message_id: msg.id,
      };

      for (const apiKey of activeCallbacks) {
        await forwardToCallback(apiKey.callback_url, payload, {
          smsLogId,
          apiKeyId: apiKey.id,
        });
      }

      console.log(`Processed inbound SMS ${msg.id} from ${msg.number}`);
    }
  } catch (err) {
    console.error('Error polling modem inbox:', err.message);
  }
}

export function startSmsPoller() {
  console.log(`SMS poller started (interval=${config.modemPollInterval / 1000}s)`);
  processInboundMessages();
  setInterval(processInboundMessages, config.modemPollInterval);
}
