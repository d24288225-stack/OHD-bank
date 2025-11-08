const express = require('express');
const { pool } = require('../db');
const router = express.Router();

router.post('/credit', async (req, res) => {
  const { account_number, amount, reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const acc = (await client.query('SELECT id FROM accounts WHERE account_number = $1', [account_number])).rows[0];
    if (!acc) throw new Error('Account not found');
    await client.query('INSERT INTO admin_credits (account_id, amount, reason) VALUES ($1,$2,$3)', [acc.id, amount, reason]);
    await client.query('UPDATE accounts SET test_balance = test_balance + $1 WHERE id = $2', [amount, acc.id]);
    await client.query('INSERT INTO transaction_log (account_id, type, amount, description) VALUES ($1,$2,$3,$4)', [acc.id, 'credit', amount, `Admin: ${reason}`]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.get('/pending', async (req, res) => {
  const rows = (await pool.query('SELECT * FROM transfer_requests WHERE status = $1', ['pending'])).rows;
  res.json(rows);
});

router.post('/review-transfer', async (req, res) => {
  const { transfer_id, status, note } = req.body;
  await pool.query('UPDATE transfer_requests SET status = $1, review_note = $2, reviewed_at = NOW() WHERE id = $3', [status, note, transfer_id]);
  res.json({ success: true });
});

module.exports = router;