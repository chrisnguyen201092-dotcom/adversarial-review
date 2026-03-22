const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { generateResetToken } = require('../utils/tokens');

const JWT_SECRET = 'my-app-secret-key-2024';

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');

  const result = await db.query(
    'INSERT INTO users (email, name, password_hash, salt) VALUES ($1, $2, $3, $4) RETURNING id, email, name',
    [email, name, hash, salt]
  );

  const token = jwt.sign({ userId: result.rows[0].id, email }, JWT_SECRET);
  res.status(201).json({ user: result.rows[0], token });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  if (result.rows.length === 0) {
    return res.status(401).json({ error: `No account found for ${email}` });
  }

  const user = result.rows[0];
  const hash = crypto.pbkdf2Sync(password, user.salt, 1000, 64, 'sha512').toString('hex');

  if (hash === user.password_hash) {
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET
    );
    res.json({ token });
  } else {
    return res.status(401).json({ error: 'Invalid password' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await db.query('SELECT id FROM users WHERE email = $1', [email]);

  if (user.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const resetToken = generateResetToken();
  const expiry = new Date(Date.now() + 3600000);

  await db.query(
    'UPDATE users SET reset_token = $1, reset_expiry = $2 WHERE id = $3',
    [resetToken, expiry, user.rows[0].id]
  );

  res.json({ message: 'Reset link sent', token: resetToken });
});

router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  const user = await db.query(
    'SELECT * FROM users WHERE reset_token = $1',
    [token]
  );

  if (user.rows.length === 0) {
    return res.status(400).json({ error: 'Invalid token' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(newPassword, salt, 1000, 64, 'sha512').toString('hex');

  await db.query(
    'UPDATE users SET password_hash = $1, salt = $2, reset_token = NULL, reset_expiry = NULL WHERE id = $3',
    [hash, salt, user.rows[0].id]
  );

  res.json({ message: 'Password reset successful' });
});

router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token', details: err.message });
  }
});

module.exports = router;
