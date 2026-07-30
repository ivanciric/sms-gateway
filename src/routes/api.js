import { Router } from 'express';
import db from '../db/index.js';
import { requireApiKey } from '../auth/index.js';
import { ModemClient } from '../sms/modem.js';

const router = Router();

router.post('/sms/send', requireApiKey, async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'Fields "to" and "message" are required' });
  }

  const modem = new ModemClient();

  try {
    const result = await modem.sendSms(String(to), String(message));
    const status = result.success ? 'sent' : 'modem_rejected';

    db.prepare(
      `INSERT INTO sms_logs (direction, phone_number, message, encode_type, status, api_key_id)
       VALUES ('outbound', ?, ?, ?, ?, ?)`
    ).run(to, message, result.encodeType, status, req.apiKey.id);

    if (!result.success) {
      return res.status(502).json({
        error: 'Modem rejected SMS',
        modem_response: result.modemResponse,
      });
    }

    return res.json({
      success: true,
      encode_type: result.encodeType,
      sms_time: result.smsTime,
      modem_response: result.modemResponse,
    });
  } catch (err) {
    db.prepare(
      `INSERT INTO sms_logs (direction, phone_number, message, status, api_key_id)
       VALUES ('outbound', ?, ?, ?, ?)`
    ).run(to, message, `failed: ${err.message}`, req.apiKey.id);

    return res.status(502).json({ error: `Modem error: ${err.message}` });
  }
});

export default router;
