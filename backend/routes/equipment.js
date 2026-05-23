const express = require('express');
const { getDb, run } = require('../database/db');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/equipment/:roomId
router.get('/:roomId', (req, res) => {
  const db = getDb();
  const items = db.prepare('SELECT * FROM equipment WHERE room_id = ? ORDER BY order_index ASC, id ASC').all(req.params.roomId);
  res.json(items);
});

// POST /api/equipment
router.post('/', authenticateAdmin, (req, res) => {
  const { room_id, name, icon, instructions, tips, category } = req.body;
  if (!room_id || !name) return res.status(400).json({ error: 'room_id et name requis' });

  const db = getDb();
  const maxRow = db.prepare('SELECT COALESCE(MAX(order_index), 0) AS m FROM equipment WHERE room_id = ?').get(room_id);
  const nextOrder = maxRow.m + 1;

  const result = run(db,
    'INSERT INTO equipment (room_id, name, icon, instructions, tips, order_index, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
    room_id, name, icon || 'tool', instructions || '', tips || '', nextOrder, category || 'equipement');

  res.status(201).json({ id: result.lastInsertRowid, room_id, name, icon, instructions, tips, category });
});

// PUT /api/equipment/:id/order — met à jour uniquement l'ordre
router.put('/:id/order', authenticateAdmin, (req, res) => {
  const { order_index } = req.body;
  if (order_index == null) return res.status(400).json({ error: 'order_index requis' });
  const db = getDb();
  run(db, 'UPDATE equipment SET order_index = ? WHERE id = ?', order_index, req.params.id);
  res.json({ message: 'ok' });
});

// PUT /api/equipment/:id
router.put('/:id', authenticateAdmin, (req, res) => {
  const { name, icon, instructions, tips, category } = req.body;
  const db = getDb();
  run(db, 'UPDATE equipment SET name = ?, icon = ?, instructions = ?, tips = ?, category = ? WHERE id = ?',
    name, icon || 'tool', instructions, tips, category || 'equipement', req.params.id);
  res.json({ message: 'Équipement mis à jour' });
});

// DELETE /api/equipment/:id
router.delete('/:id', authenticateAdmin, (req, res) => {
  const db = getDb();
  run(db, 'DELETE FROM equipment WHERE id = ?', req.params.id);
  res.json({ message: 'Équipement supprimé' });
});

module.exports = router;
