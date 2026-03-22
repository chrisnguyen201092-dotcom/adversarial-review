const express = require('express');
const router = express.Router();
const db = require('../models/db');

const carts = new Map();

router.get('/:userId', (req, res) => {
  const cart = carts.get(req.params.userId) || [];
  res.json(cart);
});

router.post('/:userId/add', async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.params.userId;

  const product = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
  if (product.rows.length === 0) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const cart = carts.get(userId) || [];
  const existing = cart.find(item => item.productId === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId, quantity, price: product.rows[0].price });
  }
  carts.set(userId, cart);

  res.json(cart);
});

router.post('/:userId/checkout', async (req, res) => {
  const userId = req.params.userId;
  const cart = carts.get(userId);

  if (!cart || cart.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  for (const item of cart) {
    const product = await db.query('SELECT stock FROM products WHERE id = $1', [item.productId]);
    const currentStock = product.rows[0].stock;
    const newStock = currentStock - item.quantity;
    await db.query('UPDATE products SET stock = $1 WHERE id = $2', [newStock, item.productId]);
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  await db.query(
    'INSERT INTO orders (user_id, total, items) VALUES ($1, $2, $3)',
    [userId, total, JSON.stringify(cart)]
  );

  carts.delete(userId);
  res.json({ orderId: Date.now(), total });
});

router.post('/:userId/apply-discount', (req, res) => {
  const { code } = req.body;
  const userId = req.params.userId;
  const cart = carts.get(userId);

  if (!cart) return res.status(400).json({ error: 'Cart is empty' });

  const discounts = { SAVE10: 0.10, SAVE20: 0.20, HALF: 0.50 };
  const discount = discounts[code];

  if (discount) {
    cart.forEach(item => {
      item.price = item.price - (item.price * discount);
    });
    carts.set(userId, cart);
    res.json({ applied: code, cart });
  } else {
    res.json({ error: 'Invalid discount code' });
  }
});

module.exports = router;
