/**
 * Normalize phone number to international format without '+'.
 * Examples: 063308105 -> 38163308105, +38163308105 -> 38163308105
 */
export function normalizePhoneNumber(number) {
  if (!number) return '';

  let digits = String(number).replace(/[\s\-()+]/g, '');

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0')) {
    return `381${digits.slice(1)}`;
  }

  if (digits.startsWith('381')) {
    return digits;
  }

  // Local mobile without leading 0 (e.g. 63308105)
  if (/^6\d{7,8}$/.test(digits)) {
    return `381${digits}`;
  }

  return digits;
}

/**
 * Build webhook payload for inbound SMS callbacks.
 */
export function buildWebhookPayload({ from, text, messageId }) {
  const payload = {
    from: normalizePhoneNumber(from),
    text: String(text ?? ''),
  };

  if (messageId) {
    payload.messageId = String(messageId);
  }

  return payload;
}
