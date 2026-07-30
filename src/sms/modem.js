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

  async getModemInfo(cmd) {
    const params = new URLSearchParams({ cmd, isTest: 'false' });
    const url = `${this.baseUrl}/goform/goform_get_cmd_process?${params}`;
    const start = Date.now();

    const response = await fetch(url, {
      headers: this.headers,
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text.trim();
    }

    return { data, latencyMs: Date.now() - start };
  }

  async checkStatus() {
    const start = Date.now();
    const checks = {};

    try {
      checks.modem_main_state = await this.getModemInfo('modem_main_state');
    } catch (err) {
      return {
        status: 'error',
        url: this.baseUrl,
        latencyMs: Date.now() - start,
        state: 'unreachable',
        signal: null,
        network: null,
        smsCapacity: null,
        checks,
        message: `ZTE modem nedostupan: ${err.message}`,
      };
    }

    const extraCommands = ['signalbar', 'network_type', 'ppp_status', 'nwa_sms_capacity'];
    await Promise.all(
      extraCommands.map(async (cmd) => {
        try {
          checks[cmd] = await this.getModemInfo(cmd);
        } catch (err) {
          checks[cmd] = { error: err.message };
        }
      })
    );

    const mainState = checks.modem_main_state;
    const raw = mainState.data;
    let state = 'unknown';
    if (typeof raw === 'object' && raw !== null) {
      state = raw.modem_main_state || raw.modem_state || JSON.stringify(raw);
    } else {
      state = String(raw);
    }

    const signal = checks.signalbar?.data;
    const network = checks.network_type?.data;
    const smsCapacity = checks.nwa_sms_capacity?.data;

    return {
      status: 'ok',
      url: this.baseUrl,
      latencyMs: Date.now() - start,
      state,
      signal: typeof signal === 'object' ? signal : { raw: signal },
      network: typeof network === 'object' ? network : { raw: network },
      smsCapacity: typeof smsCapacity === 'object' ? smsCapacity : { raw: smsCapacity },
      checks,
      message: 'ZTE modem dostupan',
    };
  }
}
