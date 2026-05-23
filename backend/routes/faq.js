const express = require('express');
const { getDb, run } = require('../database/db');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/faq/:propertyId
router.get('/:propertyId', (req, res) => {
  const db = getDb();
  const items = db.prepare('SELECT * FROM faq WHERE property_id = ? ORDER BY order_index ASC, id ASC').all(req.params.propertyId);
  res.json(items);
});

// POST /api/faq/:propertyId
router.post('/:propertyId', authenticateAdmin, (req, res) => {
  const { question, answer } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'question et answer requis' });
  const db = getDb();
  const maxRow = db.prepare('SELECT COALESCE(MAX(order_index), 0) AS m FROM faq WHERE property_id = ?').get(req.params.propertyId);
  const result = run(db,
    'INSERT INTO faq (property_id, question, answer, order_index) VALUES (?, ?, ?, ?)',
    req.params.propertyId, question, answer, maxRow.m + 1);
  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/faq/:id
router.put('/:id', authenticateAdmin, (req, res) => {
  const { question, answer } = req.body;
  const db = getDb();
  run(db, 'UPDATE faq SET question = ?, answer = ? WHERE id = ?', question, answer, req.params.id);
  res.json({ message: 'ok' });
});

// DELETE /api/faq/:id
router.delete('/:id', authenticateAdmin, (req, res) => {
  const db = getDb();
  run(db, 'DELETE FROM faq WHERE id = ?', req.params.id);
  res.json({ message: 'ok' });
});

module.exports = router;
