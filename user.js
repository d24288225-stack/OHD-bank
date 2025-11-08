const express = require('express');
const { pool } = require('../db');
const router = express.Router();

router.get('/data', async (req, res) => {
  try {
    const acc = (await pool.query('SELECT * FROM accounts WHERE user_id = $1', [req.user.id])).rows[0];
    const hist = (await pool.query('SELECT * FROM transaction_log WHERE account_id = $1 ORDER BY created_at DESC', [acc.id])).rows;
    res.json({ balance: acc.test_balance, history: hist });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/transfer', async (req, res) => {
  const { to_account_number, amount } = req.body;
  const acc = (await pool.query('SELECT id FROM accounts WHERE user_id = $1', [req.user.id])).rows[0];
  await pool.query('INSERT INTO transfer_requests (from_account_id, to_account_number, amount) VALUES ($1,$2,$3)', [acc.id, to_account_number, amount]);
  await pool.query('INSERT INTO transaction_log (account_id, type, amount, description) VALUES ($1,$2,$3,$4)', [acc.id, 'transfer_pending', amount, `→ ${to_account_number} (Pending)`]);
  res.json({ success: true });
});

module.exports = router;