const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { pool } = require('./db');

const SECRET = process.env.JWT_SECRET || 'change-me-in-production-12345';

module.exports = {
  async login(username, password) {
    const res = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = res.rows[0];
    if (user && await bcrypt.compare(password, user.password_hash)) {
      return jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '1h' });
    }
    return null;
  },

  middleware: (req, res, next) => {
    const token = req.cookies.token;
    if (token) {
      try {
        req.user = jwt.verify(token, SECRET);
      } catch (e) {}
    }
    next();
  },

  requireLogin: (req, res, next) => {
    if (!req.user) return res.redirect('/');
    next();
  },

  requireAdmin: (req, res, next) => {
    if (req.user?.role !== 'admin') return res.status(403).send('Admin Only');
    next();
  }
};