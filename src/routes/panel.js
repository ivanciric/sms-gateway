import { Router } from 'express';
import db from '../db/index.js';
import {
  generateApiKey,
  hashPassword,
  requireAdmin,
  requireSession,
} from '../auth/index.js';

const router = Router();

router.use(requireSession);

router.get('/', (req, res) => {
  if (req.user.role === 'admin') {
    return res.redirect('/panel/admin/users');
  }
  res.redirect('/panel/keys');
});

// --- User: own API keys ---

router.get('/keys', (req, res) => {
  const keys = db
    .prepare(
      `SELECT id, key_prefix, label, callback_url, is_active, created_at, revoked_at
       FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(req.user.id);

  res.render('keys', { user: req.user, keys, newKey: null, flash: req.query.flash });
});

router.post('/keys', (req, res) => {
  const { label, callback_url } = req.body;
  const { fullKey, keyHash, keyPrefix } = generateApiKey();

  db.prepare(
    `INSERT INTO api_keys (user_id, key_hash, key_prefix, label, callback_url)
     VALUES (?, ?, ?, ?, ?)`
  ).run(req.user.id, keyHash, keyPrefix, label || 'Default', callback_url || null);

  const keys = db
    .prepare(
      `SELECT id, key_prefix, label, callback_url, is_active, created_at, revoked_at
       FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(req.user.id);

  res.render('keys', { user: req.user, keys, newKey: fullKey, flash: null });
});

router.post('/keys/:id/revoke', (req, res) => {
  const key = db.prepare('SELECT * FROM api_keys WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!key) return res.status(404).render('error', { message: 'Ključ nije pronađen.', user: req.user });

  db.prepare(
    `UPDATE api_keys SET is_active = 0, revoked_at = datetime('now') WHERE id = ?`
  ).run(key.id);

  res.redirect('/panel/keys?flash=revoked');
});

router.post('/keys/:id/callback', (req, res) => {
  const key = db.prepare('SELECT * FROM api_keys WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!key) return res.status(404).render('error', { message: 'Ključ nije pronađen.', user: req.user });

  db.prepare('UPDATE api_keys SET callback_url = ? WHERE id = ?').run(req.body.callback_url || null, key.id);
  res.redirect('/panel/keys?flash=callback_updated');
});

// --- Admin ---

router.get('/admin/users', requireAdmin, (req, res) => {
  const users = db
    .prepare(
      `SELECT u.*, COUNT(ak.id) AS key_count
       FROM users u
       LEFT JOIN api_keys ak ON ak.user_id = u.id AND ak.is_active = 1
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    )
    .all();

  res.render('admin/users', { user: req.user, users, flash: req.query.flash });
});

router.get('/admin/users/new', requireAdmin, (req, res) => {
  res.render('admin/user-form', { user: req.user, editUser: null, error: null });
});

router.post('/admin/users/new', requireAdmin, (req, res) => {
  const { name, email, project, password, role } = req.body;

  try {
    db.prepare(
      `INSERT INTO users (name, email, project, password_hash, role)
       VALUES (?, ?, ?, ?, ?)`
    ).run(name, email, project, hashPassword(password), role === 'admin' ? 'admin' : 'user');

    res.redirect('/panel/admin/users?flash=created');
  } catch (err) {
    const message = err.message.includes('UNIQUE') ? 'Email već postoji.' : err.message;
    res.render('admin/user-form', { user: req.user, editUser: null, error: message });
  }
});

router.get('/admin/users/:id', requireAdmin, (req, res) => {
  const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!targetUser) {
    return res.status(404).render('error', { message: 'Korisnik nije pronađen.', user: req.user });
  }

  const keys = db
    .prepare(
      `SELECT id, key_prefix, label, callback_url, is_active, created_at, revoked_at
       FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(targetUser.id);

  res.render('admin/user-detail', {
    user: req.user,
    targetUser,
    keys,
    newKey: null,
    flash: req.query.flash,
  });
});

router.post('/admin/users/:id/keys', requireAdmin, (req, res) => {
  const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!targetUser) return res.status(404).render('error', { message: 'Korisnik nije pronađen.', user: req.user });

  const { label, callback_url } = req.body;
  const { fullKey, keyHash, keyPrefix } = generateApiKey();

  db.prepare(
    `INSERT INTO api_keys (user_id, key_hash, key_prefix, label, callback_url)
     VALUES (?, ?, ?, ?, ?)`
  ).run(targetUser.id, keyHash, keyPrefix, label || 'Default', callback_url || null);

  const keys = db
    .prepare(
      `SELECT id, key_prefix, label, callback_url, is_active, created_at, revoked_at
       FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`
    )
    .all(targetUser.id);

  res.render('admin/user-detail', {
    user: req.user,
    targetUser,
    keys,
    newKey: fullKey,
    flash: null,
  });
});

router.post('/admin/users/:id/keys/:keyId/revoke', requireAdmin, (req, res) => {
  db.prepare(
    `UPDATE api_keys SET is_active = 0, revoked_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  ).run(req.params.keyId, req.params.id);

  res.redirect(`/panel/admin/users/${req.params.id}?flash=revoked`);
});

router.post('/admin/users/:id/toggle', requireAdmin, (req, res) => {
  const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!targetUser) return res.status(404).render('error', { message: 'Korisnik nije pronađen.', user: req.user });
  if (targetUser.id === req.user.id) {
    return res.redirect(`/panel/admin/users/${req.params.id}?flash=cannot_disable_self`);
  }

  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(targetUser.is_active ? 0 : 1, targetUser.id);
  res.redirect(`/panel/admin/users/${req.params.id}?flash=toggled`);
});

export default router;
