const express = require('express');
const { all, get, run } = require('../database/db');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/:roomId', async (req, res) => {
  const items = await all('SELECT * FROM equipment WHERE room_id = ? ORDER BY order_index ASC, id ASC', [req.params.roomId]);
  res.json(items);
});

router.post('/', authenticateAdmin, async (req, res) => {
  const { room_id, name, icon, instructions, tips, category } = req.body;
  if (!room_id || !name) return res.status(400).json({ error: 'room_id et name requis' });

  const maxRow = await get('SELECT COALESCE(MAX(order_index), 0) AS m FROM equipment WHERE room_id = ?', [room_id]);
  const { lastInsertRowid } = await run(
    'INSERT INTO equipment (room_id, name, icon, instructions, tips, order_index, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [room_id, name, icon || 'tool', instructions || '', tips || '', maxRow.m + 1, category || 'equipement']
  );
  res.status(201).json({ id: lastInsertRowid, room_id, name, icon, instructions, tips, category });
});

router.put('/:id/order', authenticateAdmin, async (req, res) => {
  const { order_index } = req.body;
  if (order_index == null) return res.status(400).json({ error: 'order_index requis' });
  await run('UPDATE equipment SET order_index = ? WHERE id = ?', [order_index, req.params.id]);
  res.json({ message: 'ok' });
});

router.put('/:id', authenticateAdmin, async (req, res) => {
  const { name, icon, instructions, tips, category } = req.body;
  await run(
    'UPDATE equipment SET name = ?, icon = ?, instructions = ?, tips = ?, category = ? WHERE id = ?',
    [name, icon || 'tool', instructions, tips, category || 'equipement', req.params.id]
  );
  res.json({ message: 'Équipement mis à jour' });
});

router.delete('/:id', authenticateAdmin, async (req, res) => {
  await run('DELETE FROM equipment WHERE id = ?', [req.params.id]);
  res.json({ message: 'Équipement supprimé' });
});

module.exports = router;
