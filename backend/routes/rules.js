const express = require('express');
const { all, get, run } = require('../database/db');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/rules/settings/all
router.get('/settings/all', async (req, res) => {
  const settings = await all('SELECT key, value FROM settings');
  res.json(Object.fromEntries(settings.map(s => [s.key, s.value])));
});

// PUT /api/rules/settings/:key
router.put('/settings/:key', authenticateAdmin, async (req, res) => {
  const { value } = req.body;
  await run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [req.params.key, value || '']
  );
  res.json({ message: 'Paramètre mis à jour' });
});

// GET /api/rules/booking/:propertyId
router.get('/booking/:propertyId', async (req, res) => {
  const bookings = await all('SELECT * FROM bookings WHERE property_id = ? ORDER BY id ASC', [req.params.propertyId]);
  res.json(bookings);
});

// POST /api/rules/booking/:propertyId
router.post('/booking/:propertyId', authenticateAdmin, async (req, res) => {
  const { label, price_per_night, currency, booking_url, is_active } = req.body;
  if (!booking_url) return res.status(400).json({ error: 'Le lien est requis' });
  const { lastInsertRowid } = await run(
    'INSERT INTO bookings (property_id, label, price_per_night, currency, booking_url, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    [req.params.propertyId, label || 'Réservation directe', price_per_night || 0, currency || 'EUR', booking_url, is_active ?? 1]
  );
  res.status(201).json({ id: lastInsertRowid });
});

// PUT /api/rules/booking/item/:id
router.put('/booking/item/:id', authenticateAdmin, async (req, res) => {
  const { label, price_per_night, currency, booking_url, is_active } = req.body;
  await run(
    'UPDATE bookings SET label = ?, price_per_night = ?, currency = ?, booking_url = ?, is_active = ? WHERE id = ?',
    [label || 'Réservation directe', price_per_night || 0, currency || 'EUR', booking_url || '', is_active ?? 1, req.params.id]
  );
  res.json({ message: 'ok' });
});

// DELETE /api/rules/booking/item/:id
router.delete('/booking/item/:id', authenticateAdmin, async (req, res) => {
  await run('DELETE FROM bookings WHERE id = ?', [req.params.id]);
  res.json({ message: 'ok' });
});

// GET /api/rules/:propertyId
router.get('/:propertyId', async (req, res) => {
  const rules = await get('SELECT * FROM rules WHERE property_id = ?', [req.params.propertyId]);
  res.json(rules || {});
});

// PUT /api/rules/:propertyId
router.put('/:propertyId', authenticateAdmin, async (req, res) => {
  const {
    check_in_time, check_out_time, check_in_instructions, check_out_instructions,
    trash_instructions, wifi_name, wifi_password, house_rules,
    parking_instructions, places_to_discover, key_box_code,
  } = req.body;

  const existing = await get('SELECT id FROM rules WHERE property_id = ?', [req.params.propertyId]);
  const vals = [
    check_in_time || '15:00', check_out_time || '11:00',
    check_in_instructions || '', check_out_instructions || '',
    trash_instructions || '', wifi_name || '', wifi_password || '', house_rules || '',
    parking_instructions || '', places_to_discover || '', key_box_code || '',
  ];

  if (existing) {
    await run(
      `UPDATE rules SET check_in_time=?, check_out_time=?, check_in_instructions=?, check_out_instructions=?,
       trash_instructions=?, wifi_name=?, wifi_password=?, house_rules=?,
       parking_instructions=?, places_to_discover=?, key_box_code=? WHERE property_id=?`,
      [...vals, req.params.propertyId]
    );
  } else {
    await run(
      `INSERT INTO rules (property_id, check_in_time, check_out_time, check_in_instructions, check_out_instructions,
       trash_instructions, wifi_name, wifi_password, house_rules, parking_instructions, places_to_discover, key_box_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.propertyId, ...vals]
    );
  }
  res.json({ message: 'Règles mises à jour' });
});

module.exports = router;
