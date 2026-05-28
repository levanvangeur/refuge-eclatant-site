const express = require('express');
const { all, get, run } = require('../database/db');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/:propertyId', async (req, res) => {
  const items = await all('SELECT * FROM faq WHERE property_id = ? ORDER BY order_index ASC, id ASC', [req.params.propertyId]);
  res.json(items);
});

router.post('/:propertyId', authenticateAdmin, async (req, res) => {
  const { question, answer } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'question et answer requis' });

  const maxRow = await get('SELECT COALESCE(MAX(order_index), 0) AS m FROM faq WHERE property_id = ?', [req.params.propertyId]);
  const { lastInsertRowid } = await run(
    'INSERT INTO faq (property_id, question, answer, order_index) VALUES (?, ?, ?, ?)',
    [req.params.propertyId, question, answer, maxRow.m + 1]
  );
  res.status(201).json({ id: lastInsertRowid });
});

router.put('/:id', authenticateAdmin, async (req, res) => {
  const { question, answer } = req.body;
  await run('UPDATE faq SET question = ?, answer = ? WHERE id = ?', [question, answer, req.params.id]);
  res.json({ message: 'ok' });
});

router.delete('/:id', authenticateAdmin, async (req, res) => {
  await run('DELETE FROM faq WHERE id = ?', [req.params.id]);
  res.json({ message: 'ok' });
});

module.exports = router;
