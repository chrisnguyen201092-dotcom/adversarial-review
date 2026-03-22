const express = require('express');
const router = express.Router();
const db = require('../models/db');

router.get('/:userId', async (req, res) => {
  const orders = await db.query('SELECT * FROM orders WHERE user_id = $1', [req.params.userId]);
  res.json(orders.rows);
});

module.exports = router;
