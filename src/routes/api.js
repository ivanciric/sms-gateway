import { Router } from 'express';
import { requireApiKey } from '../auth/index.js';
import { ModemClient } from '../sms/modem.js';
import { apiRequestLogger } from '../middleware/requestLogger.js';
import { logSms } from '../activity/index.js';

const router = Router();

router.use(apiRequestLogger);

router.post('/sms/send', requireApiKey, async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'Fields "to" and "message" are required' });
  }

  const modem = new ModemClient();

  try {
    const result = await modem.sendSms(String(to), String(message));
    const status = result.success ? 'sent' : 'modem_rejected';

    logSms({
      direction: 'outbound',
      phoneNumber: to,
      message,
      encodeType: result.encodeType,
      status,
      apiKeyId: req.apiKey.id,
    });

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
    logSms({
      direction: 'outbound',
      phoneNumber: to,
      message,
      status: `failed: ${err.message}`,
      apiKeyId: req.apiKey.id,
    });

    return res.status(502).json({ error: `Modem error: ${err.message}` });
  }
});

export default router;
