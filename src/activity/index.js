import db from '../db/index.js';
import { emitActivity } from './events.js';

function truncate(text, max = 120) {
  if (!text) return '';
  const str = String(text);
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

function getRequestById(id) {
  return db
    .prepare(
      `SELECT id, method, path, status_code, ip, api_key_prefix, summary, duration_ms, created_at
       FROM request_logs WHERE id = ?`
    )
    .get(id);
}

function getSmsById(id) {
  return db
    .prepare(
      `SELECT s.id, s.direction, s.phone_number, s.message, s.status, s.encode_type,
              s.modem_message_id, s.created_at, ak.key_prefix, ak.label AS key_label
       FROM sms_logs s
       LEFT JOIN api_keys ak ON ak.id = s.api_key_id
       WHERE s.id = ?`
    )
    .get(id);
}

function getWebhookById(id) {
  return db
    .prepare(
      `SELECT w.id, w.callback_url, w.status, w.http_status, w.error_message, w.duration_ms,
              w.created_at, ak.key_prefix, ak.label AS key_label, s.phone_number, s.message AS sms_message
       FROM webhook_logs w
       LEFT JOIN api_keys ak ON ak.id = w.api_key_id
       LEFT JOIN sms_logs s ON s.id = w.sms_log_id
       WHERE w.id = ?`
    )
    .get(id);
}

export function logRequest({ method, path, statusCode, ip, apiKeyPrefix, summary, durationMs }) {
  const result = db
    .prepare(
      `INSERT INTO request_logs (method, path, status_code, ip, api_key_prefix, summary, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(method, path, statusCode, ip || null, apiKeyPrefix || null, truncate(summary), durationMs ?? null);

  const row = getRequestById(result.lastInsertRowid);
  emitActivity('request', row);
  return row;
}

export function logSms({ direction, phoneNumber, message, status, encodeType, apiKeyId, modemMessageId }) {
  const result = db
    .prepare(
      `INSERT INTO sms_logs (direction, phone_number, message, encode_type, status, api_key_id, modem_message_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      direction,
      phoneNumber,
      message,
      encodeType ?? null,
      status,
      apiKeyId ?? null,
      modemMessageId ?? null
    );

  const row = getSmsById(result.lastInsertRowid);
  emitActivity('sms', row);
  return { id: result.lastInsertRowid, row };
}

export function logWebhook({ smsLogId, apiKeyId, callbackUrl, status, httpStatus, errorMessage, durationMs }) {
  const result = db
    .prepare(
      `INSERT INTO webhook_logs (sms_log_id, api_key_id, callback_url, status, http_status, error_message, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      smsLogId,
      apiKeyId,
      callbackUrl,
      status,
      httpStatus ?? null,
      errorMessage ? truncate(errorMessage, 255) : null,
      durationMs ?? null
    );

  const row = getWebhookById(result.lastInsertRowid);
  emitActivity('webhook', row);
  return row;
}

export function getRecentRequests(limit = 30) {
  return db
    .prepare(
      `SELECT id, method, path, status_code, ip, api_key_prefix, summary, duration_ms, created_at
       FROM request_logs ORDER BY id DESC LIMIT ?`
    )
    .all(limit);
}

export function getRecentSms(limit = 30) {
  return db
    .prepare(
      `SELECT s.id, s.direction, s.phone_number, s.message, s.status, s.encode_type,
              s.modem_message_id, s.created_at, ak.key_prefix, ak.label AS key_label
       FROM sms_logs s
       LEFT JOIN api_keys ak ON ak.id = s.api_key_id
       ORDER BY s.id DESC LIMIT ?`
    )
    .all(limit);
}

export function getRecentWebhooks(limit = 30) {
  return db
    .prepare(
      `SELECT w.id, w.callback_url, w.status, w.http_status, w.error_message, w.duration_ms,
              w.created_at, ak.key_prefix, ak.label AS key_label, s.phone_number, s.message AS sms_message
       FROM webhook_logs w
       LEFT JOIN api_keys ak ON ak.id = w.api_key_id
       LEFT JOIN sms_logs s ON s.id = w.sms_log_id
       ORDER BY w.id DESC LIMIT ?`
    )
    .all(limit);
}

export function getRecentActivity() {
  return {
    requests: getRecentRequests(25),
    sms: getRecentSms(25),
    webhooks: getRecentWebhooks(25),
  };
}
