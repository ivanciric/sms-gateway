/** SMS message encoding for Huawei/ZTE USB modem web API. */

const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001bÆæßÉ !"#¤%&\'()*+,-./' +
  '0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';

const GSM7_EXTENDED = '^{}\\[~]|€';
const GSM7_CHARS = new Set([...GSM7_BASIC, ...GSM7_EXTENDED]);

export function canEncodeGsm7(text) {
  return [...text].every((ch) => GSM7_CHARS.has(ch));
}

/**
 * Encode SMS text for modem API.
 * Returns { messageBody, encodeType }.
 * Huawei modems expect MessageBody as UTF-16BE hex (4 digits per character).
 */
export function encodeMessageBody(text) {
  const encodeType = canEncodeGsm7(text) ? 'GSM7_default' : 'UCS2';
  const messageBody = Buffer.from(text, 'utf16le')
    .swap16()
    .toString('hex')
    .toUpperCase();

  return { messageBody, encodeType };
}

/**
 * Generate sms_time in format: YY;MM;DD;HH;mm;ss;+TZ
 * Example: 24;07;30;19;11;11;+2
 */
export function generateSmsTime(tzOffsetHours = 2) {
  const localMs = Date.now() + tzOffsetHours * 3600000;
  const d = new Date(localMs);

  const yy = String(d.getUTCFullYear()).slice(-2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  const sign = tzOffsetHours >= 0 ? '+' : '-';

  return `${yy};${mm};${dd};${hh};${min};${ss};${sign}${Math.abs(tzOffsetHours)}`;
}
