const express = require('express');
const { getDb, run } = require('../database/db');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/checkin-items/:propertyId
router.get('/:propertyId', (req, res) => {
  const db = getDb();
  const items = db.prepare(
    'SELECT * FROM checkin_items WHERE property_id = ? ORDER BY type, order_index ASC, id ASC'
  ).all(req.params.propertyId);
  res.json(items);
});

// POST /api/checkin-items
router.post('/', authenticateAdmin, (req, res) => {
  const { property_id, type, icon, title, description } = req.body;
  if (!property_id || !title) return res.status(400).json({ error: 'property_id et title requis' });
  const db = getDb();
  const maxRow = db.prepare(
    'SELECT COALESCE(MAX(order_index), 0) AS m FROM checkin_items WHERE property_id = ? AND type = ?'
  ).get(property_id, type || 'checkin');
  const result = run(db,
    'INSERT INTO checkin_items (property_id, type, icon, title, description, order_index) VALUES (?, ?, ?, ?, ?, ?)',
    property_id, type || 'checkin', icon || 'check', title, description || '', maxRow.m + 1
  );
  res.status(201).json({ id: result.lastInsertRowid, property_id, type, icon, title, description });
});

// PUT /api/checkin-items/:id
router.put('/:id', authenticateAdmin, (req, res) => {
  const { icon, title, description } = req.body;
  const db = getDb();
  run(db, 'UPDATE checkin_items SET icon = ?, title = ?, description = ? WHERE id = ?',
    icon || 'check', title, description || '', req.params.id);
  res.json({ message: 'ok' });
});

// PUT /api/checkin-items/:id/order
router.put('/:id/order', authenticateAdmin, (req, res) => {
  const { order_index } = req.body;
  if (order_index == null) return res.status(400).json({ error: 'order_index requis' });
  const db = getDb();
  run(db, 'UPDATE checkin_items SET order_index = ? WHERE id = ?', order_index, req.params.id);
  res.json({ message: 'ok' });
});

// DELETE /api/checkin-items/:id
router.delete('/:id', authenticateAdmin, (req, res) => {
  const db = getDb();
  run(db, 'DELETE FROM checkin_items WHERE id = ?', req.params.id);
  res.json({ message: 'ok' });
});

module.exports = router;
