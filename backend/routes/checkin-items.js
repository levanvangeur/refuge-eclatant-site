const express = require('express');
const { all, get, run } = require('../database/db');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/:propertyId', async (req, res) => {
  const items = await all(
    'SELECT * FROM checkin_items WHERE property_id = ? ORDER BY type, order_index ASC, id ASC',
    [req.params.propertyId]
  );
  res.json(items);
});

router.post('/', authenticateAdmin, async (req, res) => {
  const { property_id, type, icon, title, description } = req.body;
  if (!property_id || !title) return res.status(400).json({ error: 'property_id et title requis' });

  const maxRow = await get(
    'SELECT COALESCE(MAX(order_index), 0) AS m FROM checkin_items WHERE property_id = ? AND type = ?',
    [property_id, type || 'checkin']
  );
  const { lastInsertRowid } = await run(
    'INSERT INTO checkin_items (property_id, type, icon, title, description, order_index) VALUES (?, ?, ?, ?, ?, ?)',
    [property_id, type || 'checkin', icon || 'check', title, description || '', maxRow.m + 1]
  );
  res.status(201).json({ id: lastInsertRowid, property_id, type, icon, title, description });
});

router.put('/:id', authenticateAdmin, async (req, res) => {
  const { icon, title, description } = req.body;
  await run(
    'UPDATE checkin_items SET icon = ?, title = ?, description = ? WHERE id = ?',
    [icon || 'check', title, description || '', req.params.id]
  );
  res.json({ message: 'ok' });
});

router.put('/:id/order', authenticateAdmin, async (req, res) => {
  const { order_index } = req.body;
  if (order_index == null) return res.status(400).json({ error: 'order_index requis' });
  await run('UPDATE checkin_items SET order_index = ? WHERE id = ?', [order_index, req.params.id]);
  res.json({ message: 'ok' });
});

router.delete('/:id', authenticateAdmin, async (req, res) => {
  await run('DELETE FROM checkin_items WHERE id = ?', [req.params.id]);
  res.json({ message: 'ok' });
});

module.exports = router;
