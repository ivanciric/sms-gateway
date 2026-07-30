import db from '../db/index.js';
import { config } from '../config.js';
import { ModemClient } from './modem.js';

async function forwardToCallback(callbackUrl, payload) {
  try {
    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (err) {
    console.error(`Callback failed for ${callbackUrl}:`, err.message);
    return false;
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
      db.prepare(
        `INSERT INTO sms_logs (direction, phone_number, message, status, modem_message_id)
         VALUES ('inbound', ?, ?, 'received', ?)`
      ).run(msg.number, msg.content, msg.id);

      const payload = {
        from: msg.number,
        message: msg.content,
        received_at: msg.date,
        modem_message_id: msg.id,
      };

      for (const apiKey of activeCallbacks) {
        await forwardToCallback(apiKey.callback_url, payload);
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
