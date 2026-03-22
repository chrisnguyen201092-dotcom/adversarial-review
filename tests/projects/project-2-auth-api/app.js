const express = require('express');
const app = express();
const auth = require('./routes/auth');
const session = require('./routes/session');

app.use(express.json());
app.use('/api/auth', auth);
app.use('/api/session', session);

app.listen(process.env.PORT || 3001);
module.exports = app;
