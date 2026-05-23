const express = require('express');
const { getDb, run } = require('../database/db');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/rules/settings/all  — doit être AVANT /:propertyId pour ne pas entrer en conflit
router.get('/settings/all', (req, res) => {
  const db = getDb();
  const settings = db.prepare('SELECT key, value FROM settings').all();
  res.json(Object.fromEntries(settings.map(s => [s.key, s.value])));
});

// PUT /api/rules/settings/:key
router.put('/settings/:key', authenticateAdmin, (req, res) => {
  const { value } = req.body;
  const db = getDb();
  db.exec(`
    INSERT INTO settings (key, value) VALUES ('${req.params.key.replace(/'/g,"''")}', '${(value || '').replace(/'/g,"''")}')
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  res.json({ message: 'Paramètre mis à jour' });
});

// GET /api/rules/booking/:propertyId — toutes les réservations
router.get('/booking/:propertyId', (req, res) => {
  const db = getDb();
  const bookings = db.prepare('SELECT * FROM bookings WHERE property_id = ? ORDER BY id ASC').all(req.params.propertyId);
  res.json(bookings);
});

// POST /api/rules/booking/:propertyId — créer une réservation
router.post('/booking/:propertyId', authenticateAdmin, (req, res) => {
  const { label, price_per_night, currency, booking_url, is_active } = req.body;
  if (!booking_url) return res.status(400).json({ error: 'Le lien est requis' });
  const db = getDb();
  const result = run(db,
    'INSERT INTO bookings (property_id, label, price_per_night, currency, booking_url, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    req.params.propertyId,
    label || 'Réservation directe',
    price_per_night || 0,
    currency || 'EUR',
    booking_url,
    is_active ?? 1
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/rules/booking/item/:id — modifier une réservation
router.put('/booking/item/:id', authenticateAdmin, (req, res) => {
  const { label, price_per_night, currency, booking_url, is_active } = req.body;
  const db = getDb();
  run(db,
    'UPDATE bookings SET label = ?, price_per_night = ?, currency = ?, booking_url = ?, is_active = ? WHERE id = ?',
    label || 'Réservation directe',
    price_per_night || 0,
    currency || 'EUR',
    booking_url || '',
    is_active ?? 1,
    req.params.id
  );
  res.json({ message: 'Réservation mise à jour' });
});

// DELETE /api/rules/booking/item/:id
router.delete('/booking/item/:id', authenticateAdmin, (req, res) => {
  const db = getDb();
  run(db, 'DELETE FROM bookings WHERE id = ?', req.params.id);
  res.json({ message: 'Réservation supprimée' });
});

// GET /api/rules/:propertyId
router.get('/:propertyId', (req, res) => {
  const db = getDb();
  const rules = db.prepare('SELECT * FROM rules WHERE property_id = ?').get(req.params.propertyId);
  res.json(rules || {});
});

// PUT /api/rules/:propertyId
router.put('/:propertyId', authenticateAdmin, (req, res) => {
  const {
    check_in_time, check_out_time,
    check_in_instructions, check_out_instructions,
    trash_instructions, wifi_name, wifi_password, house_rules,
    parking_instructions, places_to_discover
  } = req.body;

  const db = getDb();
  const existing = db.prepare('SELECT id FROM rules WHERE property_id = ?').get(req.params.propertyId);

  if (existing) {
    run(db, `UPDATE rules SET
      check_in_time = ?, check_out_time = ?,
      check_in_instructions = ?, check_out_instructions = ?,
      trash_instructions = ?, wifi_name = ?, wifi_password = ?, house_rules = ?,
      parking_instructions = ?, places_to_discover = ?
      WHERE property_id = ?`,
      check_in_time || '15:00', check_out_time || '11:00',
      check_in_instructions || '', check_out_instructions || '',
      trash_instructions || '', wifi_name || '', wifi_password || '', house_rules || '',
      parking_instructions || '', places_to_discover || '',
      req.params.propertyId
    );
  } else {
    run(db, `INSERT INTO rules
      (property_id, check_in_time, check_out_time,
       check_in_instructions, check_out_instructions,
       trash_instructions, wifi_name, wifi_password, house_rules, parking_instructions, places_to_discover)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      req.params.propertyId,
      check_in_time || '15:00', check_out_time || '11:00',
      check_in_instructions || '', check_out_instructions || '',
      trash_instructions || '', wifi_name || '', wifi_password || '', house_rules || '',
      parking_instructions || '', places_to_discover || ''
    );
  }

  res.json({ message: 'Règles mises à jour' });
});

module.exports = router;
