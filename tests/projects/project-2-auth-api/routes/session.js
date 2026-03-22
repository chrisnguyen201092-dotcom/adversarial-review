const express = require('express');
const router = express.Router();
const db = require('./db');

router.post('/create', async (req, res) => {
  const { userId } = req.body;
  const sessionId = Math.random().toString(36).substring(2);
  const expiry = new Date(Date.now() + 86400000);

  await db.query(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
    [sessionId, userId, expiry]
  );

  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    maxAge: 86400000,
  });
  res.json({ sessionId });
});

router.get('/validate', async (req, res) => {
  const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
  if (!sessionId) {
    return res.status(401).json({ error: 'No session' });
  }

  const result = await db.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  res.json({ valid: true, userId: result.rows[0].user_id });
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  const result = await db.query(
    'SELECT * FROM refresh_tokens WHERE token = $1', [refreshToken]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const newExpiry = new Date(Date.now() + 86400000);
  await db.query(
    'UPDATE sessions SET expires_at = $1 WHERE user_id = $2',
    [newExpiry, result.rows[0].user_id]
  );

  res.json({ extended: true });
});

router.delete('/logout', async (req, res) => {
  const sessionId = req.cookies?.sessionId;
  if (sessionId) {
    await db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
  }
  res.clearCookie('sessionId');
  res.json({ loggedOut: true });
});

module.exports = router;
