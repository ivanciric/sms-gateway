import { config } from '../config.js';
import { encodeMessageBody, generateSmsTime } from './encoder.js';

const DEFAULT_HEADERS = {
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.9',
  Connection: 'keep-alive',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'User-Agent':
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'X-Requested-With': 'XMLHttpRequest',
};

function buildHeaders(baseUrl) {
  return {
    ...DEFAULT_HEADERS,
    Origin: baseUrl,
    Referer: `${baseUrl}/index.html`,
  };
}

function decodeModemContent(content) {
  if (!content) return '';
  if (/^[0-9A-Fa-f]+$/.test(content) && content.length % 4 === 0) {
    try {
      const buf = Buffer.from(content, 'hex');
      return buf.swap16().toString('utf16le').replace(/\0/g, '');
    } catch {
      // fall through
    }
  }
  return content;
}

export class ModemClient {
  constructor(baseUrl = config.modemUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.headers = buildHeaders(this.baseUrl);
  }

  async sendSms(number, message) {
    const { messageBody, encodeType } = encodeMessageBody(message);
    const smsTime = generateSmsTime();

    const payload = new URLSearchParams({
      isTest: 'false',
      goformId: 'SEND_SMS',
      notCallback: 'true',
      Number: number,
      sms_time: smsTime,
      MessageBody: messageBody,
      ID: '-1',
      encode_type: encodeType,
    });

    const url = `${this.baseUrl}/goform/goform_set_cmd_process`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: payload.toString(),
    });

    if (!response.ok) {
      throw new Error(`Modem HTTP ${response.status}: ${await response.text()}`);
    }

    const modemResponse = await response.json();
    return {
      modemResponse,
      encodeType,
      smsTime,
      success: modemResponse.result === 'success',
    };
  }

  async fetchInbox() {
    const params = new URLSearchParams({
      multi_data: '1',
      isTest: 'false',
      cmd: 'sms_data_total',
      page: '0',
      data_per_page: '500',
      mem_store: '1',
      tags: '10',
      order_by: 'order by id desc',
      isAsc: '0',
    });

    const url = `${this.baseUrl}/goform/goform_get_cmd_process?${params}`;
    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(`Modem inbox HTTP ${response.status}`);
    }

    const data = await response.json();
    let messages = data.messages || [];
    if (!Array.isArray(messages)) {
      messages = Object.values(messages);
    }

    return messages
      .filter((msg) => ['1', 1, '10', 10].includes(msg.tag ?? msg.tags))
      .map((msg) => ({
        id: String(msg.id ?? ''),
        number: msg.number || msg.phone || '',
        content: decodeModemContent(msg.content || ''),
        date: msg.date || '',
      }));
  }
}
