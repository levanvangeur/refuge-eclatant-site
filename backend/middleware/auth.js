const jwt = require('jsonwebtoken');

function authenticateAdmin(req, res, next) {
  // Auth temporairement désactivée — à remettre en place ultérieurement
  next();
}

module.exports = { authenticateAdmin };
