require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const { pool } = require('./db');
const auth = require('./auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));
app.use('/views', express.static('views'));

app.use(auth.middleware);

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const token = await auth.login(username, password);
  if (token) {
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => res.sendFile(__dirname + '/views/login.html'));
app.get('/dashboard', auth.requireLogin, (req, res) => res.sendFile(__dirname + '/views/dashboard.html'));
app.get('/admin', auth.requireAdmin, (req, res) => res.sendFile(__dirname + '/views/admin.html'));

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(10) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id),
        account_number CHAR(10) UNIQUE NOT NULL,
        test_balance DECIMAL(12,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS admin_credits (
        id SERIAL PRIMARY KEY,
        account_id INT REFERENCES accounts(id),
        amount DECIMAL(12,2) NOT NULL,
        reason TEXT,
        credited_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS transfer_requests (
        id SERIAL PRIMARY KEY,
        from_account_id INT REFERENCES accounts(id),
        to_account_number CHAR(10) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        status VARCHAR(10) DEFAULT 'pending',
        requested_at TIMESTAMP DEFAULT NOW(),
        reviewed_at TIMESTAMP,
        review_note TEXT
      );
      CREATE TABLE IF NOT EXISTS transaction_log (
        id SERIAL PRIMARY KEY,
        account_id INT REFERENCES accounts(id),
        type VARCHAR(20),
        amount DECIMAL(12,2),
        description TEXT,
        status VARCHAR(10) DEFAULT 'visible',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Tables ready");
  } catch (e) { console.error(e); }
}
initDB();

app.get('/setup', async (req, res) => {
  const adminHash = await bcrypt.hash('admin123', 10);
  const aliceHash = await bcrypt.hash('demo123', 10);
  await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', ['admin', adminHash, 'admin']);
  await pool.query('INSERT INTO users (username, password_hash) VALUES ($1,$2) ON CONFLICT DO NOTHING', ['alice', aliceHash]);
  await pool.query('INSERT INTO accounts (user_id, account_number) VALUES (1, $1) ON CONFLICT DO NOTHING', ['OHD0000001']);
  await pool.query('INSERT INTO accounts (user_id, account_number) VALUES (2, $1) ON CONFLICT DO NOTHING', ['OHD0000002']);
  res.send('Setup done! Delete this route after first run.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`OHD Bank running on ${PORT}`));