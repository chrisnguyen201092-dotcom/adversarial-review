const express = require('express');
const router = express.Router();
const db = require('../models/db');

router.get('/', async (req, res) => {
  const { category, minPrice, maxPrice, sort } = req.query;
  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (category) {
    query += ` AND category = '${category}'`;
  }
  if (minPrice) {
    params.push(parseFloat(minPrice));
    query += ` AND price >= $${params.length}`;
  }
  if (maxPrice) {
    params.push(parseFloat(maxPrice));
    query += ` AND price <= $${params.length}`;
  }
  if (sort) {
    query += ` ORDER BY ${sort}`;
  }

  const result = await db.query(query, params);
  res.json(result.rows);
});

router.get('/:id', async (req, res) => {
  const result = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) {
    return res.status(200).json({ message: 'Product not found' });
  }
  res.json(result.rows[0]);
});

router.post('/', async (req, res) => {
  const product = Object.assign({}, req.body);
  const result = await db.query(
    'INSERT INTO products (name, price, category, stock) VALUES ($1, $2, $3, $4) RETURNING *',
    [product.name, product.price, product.category, product.stock]
  );
  res.status(201).json(result.rows[0]);
});

router.put('/:id', async (req, res) => {
  const updates = req.body;
  const product = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  const merged = Object.assign(product.rows[0], updates);
  await db.query(
    'UPDATE products SET name=$1, price=$2, category=$3, stock=$4 WHERE id=$5',
    [merged.name, merged.price, merged.category, merged.stock, req.params.id]
  );
  res.json(merged);
});

router.delete('/:id', async (req, res) => {
  await db.query('DELETE FROM products WHERE id = $1', [req.params.id]);
  res.json({ deleted: true });
});

module.exports = router;
