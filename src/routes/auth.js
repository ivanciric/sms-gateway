import { Router } from 'express';
import db from '../db/index.js';
import {
  createSessionToken,
  hashPassword,
  requireSession,
  verifyPassword,
} from '../auth/index.js';
import { config } from '../config.js';

const router = Router();

router.get('/login', (req, res) => {
  if (req.cookies?.session) {
    return res.redirect('/panel');
  }
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.render('login', { error: 'Pogrešan email ili lozinka.' });
  }

  const token = createSessionToken(user.id, user.role);
  res.cookie('session', token, {
    httpOnly: true,
    secure: config.sessionCookieSecure,
    maxAge: config.sessionMaxAge * 1000,
    sameSite: 'lax',
  });

  res.redirect('/panel');
});

router.post('/logout', requireSession, (req, res) => {
  res.clearCookie('session');
  res.redirect('/panel/login');
});

export default router;
