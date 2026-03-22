const express = require('express');
const app = express();
const products = require('./routes/products');
const cart = require('./routes/cart');
const orders = require('./routes/orders');

app.use(express.json());
app.use('/api/products', products);
app.use('/api/cart', cart);
app.use('/api/orders', orders);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(process.env.PORT || 3000);
module.exports = app;
