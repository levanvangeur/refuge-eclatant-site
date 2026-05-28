const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get, run } = require('../database/db');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();
const SECRET  = process.env.JWT_SECRET || 'dev_secret_change_me';
const EXPIRES = process.env.JWT_EXPIRES_IN || '24h';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Identifiants requis' });

  const user = await get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Identifiants incorrects' });

  const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: EXPIRES });
  res.json({ token, username: user.username });
});

// POST /api/auth/change-password
router.post('/change-password', authenticateAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ error: 'Nouveau mot de passe requis' });

  const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!bcrypt.compareSync(currentPassword, user.password_hash))
    return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

  const hash = bcrypt.hashSync(newPassword, 10);
  await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  res.json({ message: 'Mot de passe modifié' });
});

// GET /api/auth/me
router.get('/me', authenticateAdmin, (req, res) => {
  res.json({ username: req.user.username });
});

module.exports = router;
