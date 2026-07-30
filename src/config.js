import dotenv from 'dotenv';

dotenv.config();

export const config = {
  secretKey: process.env.SECRET_KEY || 'change-me-in-production',
  host: process.env.HOST || '0.0.0.0',
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databasePath: process.env.DATABASE_PATH || './data/sms_gateway.db',
  modemUrl: (process.env.MODEM_URL || 'http://192.168.0.1').replace(/\/$/, ''),
  modemPollInterval: parseInt(process.env.MODEM_POLL_INTERVAL || '15', 10) * 1000,
  sessionCookieSecure: process.env.SESSION_COOKIE_SECURE === 'true',
  sessionMaxAge: 86400,
  publicUrl: process.env.PUBLIC_URL || '',
  statusRefreshSeconds: parseInt(process.env.STATUS_REFRESH_SECONDS || '10', 10),
};
