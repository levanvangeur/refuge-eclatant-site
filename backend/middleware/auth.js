const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

function authenticateAdmin(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

module.exports = { authenticateAdmin };
