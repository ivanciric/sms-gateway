import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import db from '../db/index.js';

export function hashPassword(password) {
  return bcrypt.hashSync(password, 12);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function generateApiKey() {
  const raw = crypto.randomBytes(32).toString('base64url');
  const fullKey = `sgw_${raw}`;
  const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
  const keyPrefix = fullKey.slice(0, 12);
  return { fullKey, keyHash, keyPrefix };
}

export function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function createSessionToken(userId, role) {
  return jwt.sign({ sub: userId, role }, config.secretKey, {
    expiresIn: config.sessionMaxAge,
  });
}

export function decodeSessionToken(token) {
  return jwt.verify(token, config.secretKey);
}

export function requireSession(req, res, next) {
  const token = req.cookies?.session;
  if (!token) {
    return res.redirect('/panel/login');
  }

  try {
    const payload = decodeSessionToken(token);
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(payload.sub);
    if (!user) {
      res.clearCookie('session');
      return res.redirect('/panel/login');
    }
    req.user = user;
    next();
  } catch {
    res.clearCookie('session');
    return res.redirect('/panel/login');
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).render('error', { message: 'Admin pristup je obavezan.', user: req.user });
  }
  next();
}

export function requireApiKey(req, res, next) {
  let apiKey = req.headers['x-api-key'];

  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    apiKey = auth.slice(7).trim();
  }

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const keyHash = hashApiKey(apiKey);
  const record = db
    .prepare(
      `SELECT ak.*, u.is_active AS user_active, u.name AS user_name, u.email AS user_email
       FROM api_keys ak
       JOIN users u ON u.id = ak.user_id
       WHERE ak.key_hash = ? AND ak.is_active = 1`
    )
    .get(keyHash);

  if (!record) {
    return res.status(401).json({ error: 'Invalid or revoked API key' });
  }

  if (!record.user_active) {
    return res.status(403).json({ error: 'User account is inactive' });
  }

  req.apiKey = record;
  next();
}
