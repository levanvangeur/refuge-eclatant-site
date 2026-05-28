const express = require('express');
const { all, get, run } = require('../database/db');
const { authenticateAdmin } = require('../middleware/auth');
const { upload, deleteCloudinaryImage } = require('../middleware/upload');

const router = express.Router();

// ── PUBLIC ────────────────────────────────────────────────

// GET /api/properties
router.get('/', async (req, res) => {
  const props = await all('SELECT * FROM properties WHERE active = 1 ORDER BY id');
  for (const p of props) {
    p.gallery = await all('SELECT * FROM property_gallery WHERE property_id = ? ORDER BY order_index ASC, id ASC', [p.id]);
  }
  res.json(props);
});

// GET /api/properties/admin/all  — AVANT /:id pour éviter le conflit de route
router.get('/admin/all', authenticateAdmin, async (req, res) => {
  const props = await all('SELECT * FROM properties ORDER BY id');
  for (const p of props) {
    p.gallery = await all('SELECT * FROM property_gallery WHERE property_id = ? ORDER BY order_index ASC, id ASC', [p.id]);
  }
  res.json(props);
});

// GET /api/properties/:id
router.get('/:id', async (req, res) => {
  const prop = await get('SELECT * FROM properties WHERE id = ?', [req.params.id]);
  if (!prop) return res.status(404).json({ error: 'Logement introuvable' });

  const rooms = await all('SELECT * FROM rooms WHERE property_id = ? ORDER BY order_index', [prop.id]);
  for (const room of rooms) {
    room.images = await all('SELECT * FROM room_images WHERE room_id = ? ORDER BY order_index', [room.id]);
    for (const img of room.images) {
      const rows = await all(`
        SELECT h.id, h.x_percent, h.y_percent, h.label, h.description,
               h.target_image_id, h.icon_override,
               e.id AS equipment_id, e.name, e.icon, e.instructions, e.tips
        FROM photo_hotspots h
        LEFT JOIN equipment e ON e.id = h.equipment_id
        WHERE h.room_image_id = ?
      `, [img.id]);
      img.hotspots = rows.map(h => ({
        id: h.id, x_percent: h.x_percent, y_percent: h.y_percent,
        hotspot_type: h.target_image_id ? 'navigation' : h.equipment_id ? 'equipment' : 'note',
        target_image_id: h.target_image_id || null,
        equipment_id: h.equipment_id || null,
        name: h.name || h.label || '—',
        icon: h.icon_override || h.icon || (h.target_image_id ? 'arrow-right' : 'info'),
        instructions: h.instructions || h.description || '',
        tips: h.tips || '',
      }));
    }
    room.equipment = await all('SELECT * FROM equipment WHERE room_id = ? ORDER BY order_index ASC, id ASC', [room.id]);
  }

  prop.gallery     = await all('SELECT * FROM property_gallery WHERE property_id = ? ORDER BY order_index ASC, id ASC', [prop.id]);
  prop.hero_images = await all('SELECT * FROM property_hero_images WHERE property_id = ? ORDER BY order_index ASC, id ASC', [prop.id]);
  const rules      = await get('SELECT * FROM rules WHERE property_id = ?', [prop.id]);
  const bookings   = await all('SELECT * FROM bookings WHERE property_id = ? AND is_active = 1 ORDER BY id ASC', [prop.id]);
  const faq        = await all('SELECT * FROM faq WHERE property_id = ? ORDER BY order_index ASC, id ASC', [prop.id]);
  let checkinItems = [];
  try { checkinItems = await all('SELECT * FROM checkin_items WHERE property_id = ? ORDER BY type, order_index ASC, id ASC', [prop.id]); } catch (_) {}
  const settingsRows = await all('SELECT key, value FROM settings');
  const settings     = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));

  res.json({ ...prop, rooms, rules, bookings, faq, checkinItems, settings });
});

// ── ADMIN ─────────────────────────────────────────────────

// POST /api/properties
router.post('/', authenticateAdmin, async (req, res) => {
  const { name, tagline, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const { lastInsertRowid } = await run(
    'INSERT INTO properties (name, tagline, description) VALUES (?, ?, ?)',
    [name, tagline || '', description || '']
  );
  await run('INSERT OR IGNORE INTO rules (property_id) VALUES (?)', [lastInsertRowid]);
  await run('INSERT OR IGNORE INTO bookings (property_id, booking_url) VALUES (?, ?)', [lastInsertRowid, '']);
  res.status(201).json({ id: lastInsertRowid, name, tagline, description });
});

// PUT /api/properties/:id
router.put('/:id', authenticateAdmin, async (req, res) => {
  const { name, tagline, description, active, address, max_guests } = req.body;
  await run(
    'UPDATE properties SET name = ?, tagline = ?, description = ?, active = ?, address = ?, max_guests = ? WHERE id = ?',
    [name, tagline, description, active ?? 1, address || '', max_guests || '', req.params.id]
  );
  res.json({ message: 'Logement mis à jour' });
});

// POST /api/properties/:id/hero  — ajoute une photo au slideshow d'accueil
router.post('/:id/hero', authenticateAdmin, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  const cloudinaryUrl = req.file.path;
  const maxRow = await get('SELECT MAX(order_index) AS m FROM property_hero_images WHERE property_id = ?', [req.params.id]);
  const { lastInsertRowid } = await run(
    'INSERT INTO property_hero_images (property_id, filename, order_index) VALUES (?, ?, ?)',
    [req.params.id, cloudinaryUrl, (maxRow.m ?? -1) + 1]
  );
  res.status(201).json({ id: lastInsertRowid, filename: cloudinaryUrl });
});

// DELETE /api/properties/:id/hero/:imgId
router.delete('/:id/hero/:imgId', authenticateAdmin, async (req, res) => {
  const img = await get('SELECT filename FROM property_hero_images WHERE id = ? AND property_id = ?', [req.params.imgId, req.params.id]);
  if (img) {
    await deleteCloudinaryImage(img.filename);
    await run('DELETE FROM property_hero_images WHERE id = ?', [req.params.imgId]);
  }
  res.json({ message: 'ok' });
});

// POST /api/properties/:id/image  — image principale (rétrocompat)
router.post('/:id/image', authenticateAdmin, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  const cloudinaryUrl = req.file.path;
  await run('UPDATE properties SET main_image = ? WHERE id = ?', [cloudinaryUrl, req.params.id]);
  res.json({ filename: cloudinaryUrl });
});

// POST /api/properties/:id/gallery  — ajoute une photo de galerie
router.post('/:id/gallery', authenticateAdmin, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  const cloudinaryUrl = req.file.path;
  const maxRow = await get('SELECT MAX(order_index) AS m FROM property_gallery WHERE property_id = ?', [req.params.id]);
  const { lastInsertRowid } = await run(
    'INSERT INTO property_gallery (property_id, filename, order_index) VALUES (?, ?, ?)',
    [req.params.id, cloudinaryUrl, (maxRow.m ?? -1) + 1]
  );
  res.json({ id: lastInsertRowid, filename: cloudinaryUrl });
});

// DELETE /api/properties/:id/gallery/:imgId
router.delete('/:id/gallery/:imgId', authenticateAdmin, async (req, res) => {
  const img = await get('SELECT filename FROM property_gallery WHERE id = ? AND property_id = ?', [req.params.imgId, req.params.id]);
  if (img) {
    await deleteCloudinaryImage(img.filename);
    await run('DELETE FROM property_gallery WHERE id = ?', [req.params.imgId]);
  }
  res.json({ message: 'ok' });
});

// DELETE /api/properties/:id
router.delete('/:id', authenticateAdmin, async (req, res) => {
  await run('DELETE FROM properties WHERE id = ?', [req.params.id]);
  res.json({ message: 'Logement supprimé' });
});

module.exports = router;
