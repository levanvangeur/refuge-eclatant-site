const express = require('express');
const { getDb, run } = require('../database/db');
const { authenticateAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// ── PUBLIC ────────────────────────────────────────────────

// GET /api/properties  — liste publique avec galerie
router.get('/', (req, res) => {
  const db = getDb();
  const props = db.prepare('SELECT * FROM properties WHERE active = 1 ORDER BY id').all();
  props.forEach(p => {
    p.gallery = db.prepare('SELECT * FROM property_gallery WHERE property_id = ? ORDER BY order_index ASC, id ASC').all(p.id);
  });
  res.json(props);
});

// GET /api/properties/:id  — données complètes pour la page voyageur
router.get('/:id', (req, res) => {
  const db = getDb();
  const prop = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!prop) return res.status(404).json({ error: 'Logement introuvable' });

  const rooms = db.prepare('SELECT * FROM rooms WHERE property_id = ? ORDER BY order_index').all(prop.id);
  rooms.forEach(room => {
    room.images = db.prepare('SELECT * FROM room_images WHERE room_id = ? ORDER BY order_index').all(room.id);
    room.images.forEach(img => {
      const rows = db.prepare(`
        SELECT h.id, h.x_percent, h.y_percent, h.label, h.description,
               h.target_image_id, h.icon_override,
               e.id AS equipment_id, e.name, e.icon, e.instructions, e.tips
        FROM photo_hotspots h
        LEFT JOIN equipment e ON e.id = h.equipment_id
        WHERE h.room_image_id = ?
      `).all(img.id);
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
    });
    room.equipment = db.prepare('SELECT * FROM equipment WHERE room_id = ? ORDER BY order_index ASC, id ASC').all(room.id);
  });

  prop.gallery      = db.prepare('SELECT * FROM property_gallery WHERE property_id = ? ORDER BY order_index ASC, id ASC').all(prop.id);
  prop.hero_images  = db.prepare('SELECT * FROM property_hero_images WHERE property_id = ? ORDER BY order_index ASC, id ASC').all(prop.id);
  const rules   = db.prepare('SELECT * FROM rules WHERE property_id = ?').get(prop.id);
  const bookings = db.prepare('SELECT * FROM bookings WHERE property_id = ? AND is_active = 1 ORDER BY id ASC').all(prop.id);
  const faq          = db.prepare('SELECT * FROM faq WHERE property_id = ? ORDER BY order_index ASC, id ASC').all(prop.id);
  let checkinItems = [];
  try { checkinItems = db.prepare('SELECT * FROM checkin_items WHERE property_id = ? ORDER BY type, order_index ASC, id ASC').all(prop.id); } catch(_) {}
  const settings     = db.prepare('SELECT key, value FROM settings').all();
  const settingsMap  = Object.fromEntries(settings.map(s => [s.key, s.value]));

  res.json({ ...prop, rooms, rules, bookings, faq, checkinItems, settings: settingsMap });
});

// ── ADMIN ─────────────────────────────────────────────────

// GET /api/properties/admin/all
router.get('/admin/all', authenticateAdmin, (req, res) => {
  const db = getDb();
  const props = db.prepare('SELECT * FROM properties ORDER BY id').all();
  props.forEach(p => {
    p.gallery = db.prepare('SELECT * FROM property_gallery WHERE property_id = ? ORDER BY order_index ASC, id ASC').all(p.id);
  });
  res.json(props);
});

// POST /api/properties
router.post('/', authenticateAdmin, (req, res) => {
  const { name, tagline, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  const db = getDb();
  const result = run(db, 'INSERT INTO properties (name, tagline, description) VALUES (?, ?, ?)',
    name, tagline || '', description || '');
  run(db, 'INSERT OR IGNORE INTO rules (property_id) VALUES (?)', result.lastInsertRowid);
  run(db, 'INSERT OR IGNORE INTO bookings (property_id) VALUES (?)', result.lastInsertRowid);
  res.status(201).json({ id: result.lastInsertRowid, name, tagline, description });
});

// PUT /api/properties/:id
router.put('/:id', authenticateAdmin, (req, res) => {
  const { name, tagline, description, active } = req.body;
  const db = getDb();
  run(db, 'UPDATE properties SET name = ?, tagline = ?, description = ?, active = ? WHERE id = ?',
    name, tagline, description, active ?? 1, req.params.id);
  res.json({ message: 'Logement mis à jour' });
});

// POST /api/properties/:id/hero  — ajoute une photo au slideshow d'accueil
router.post('/:id/hero', authenticateAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  const destDir = path.join(__dirname, '../../uploads/hero');
  fs.mkdirSync(destDir, { recursive: true });
  const ext      = path.extname(req.file.originalname).toLowerCase();
  const filename = `hero-${Date.now()}${ext}`;
  fs.renameSync(req.file.path, path.join(destDir, filename));
  const db = getDb();
  const { m } = db.prepare('SELECT COALESCE(MAX(order_index),0) AS m FROM property_hero_images WHERE property_id = ?').get(req.params.id);
  const result = run(db,
    'INSERT INTO property_hero_images (property_id, filename, order_index) VALUES (?, ?, ?)',
    req.params.id, `hero/${filename}`, m + 1);
  res.status(201).json({ id: result.lastInsertRowid, filename: `hero/${filename}` });
});

// DELETE /api/properties/:id/hero/:imgId
router.delete('/:id/hero/:imgId', authenticateAdmin, (req, res) => {
  const db  = getDb();
  const img = db.prepare('SELECT filename FROM property_hero_images WHERE id = ? AND property_id = ?').get(req.params.imgId, req.params.id);
  if (img) {
    run(db, 'DELETE FROM property_hero_images WHERE id = ?', req.params.imgId);
    const fp = path.join(__dirname, '../../uploads', img.filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  res.json({ message: 'ok' });
});

// POST /api/properties/:id/image  — image principale (hero) — rétrocompat
router.post('/:id/image', authenticateAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  const destDir = path.join(__dirname, '../../uploads/properties');
  fs.mkdirSync(destDir, { recursive: true });
  const ext = path.extname(req.file.originalname).toLowerCase();
  const filename = `main-${Date.now()}${ext}`;
  fs.renameSync(req.file.path, path.join(destDir, filename));
  const db = getDb();
  run(db, 'UPDATE properties SET main_image = ? WHERE id = ?', `properties/${filename}`, req.params.id);
  res.json({ filename: `properties/${filename}` });
});

// POST /api/properties/:id/gallery  — ajoute une photo de galerie
router.post('/:id/gallery', authenticateAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  const destDir = path.join(__dirname, '../../uploads/gallery');
  fs.mkdirSync(destDir, { recursive: true });
  const ext = path.extname(req.file.originalname).toLowerCase();
  const filename = `gallery-${Date.now()}${ext}`;
  fs.renameSync(req.file.path, path.join(destDir, filename));
  const db = getDb();
  const maxRow = db.prepare('SELECT COALESCE(MAX(order_index), 0) AS m FROM property_gallery WHERE property_id = ?').get(req.params.id);
  const result = run(db,
    'INSERT INTO property_gallery (property_id, filename, order_index) VALUES (?, ?, ?)',
    req.params.id, `gallery/${filename}`, maxRow.m + 1);
  res.json({ id: result.lastInsertRowid, filename: `gallery/${filename}` });
});

// DELETE /api/properties/:id/gallery/:imgId
router.delete('/:id/gallery/:imgId', authenticateAdmin, (req, res) => {
  const db = getDb();
  const img = db.prepare('SELECT filename FROM property_gallery WHERE id = ? AND property_id = ?').get(req.params.imgId, req.params.id);
  if (img) {
    run(db, 'DELETE FROM property_gallery WHERE id = ?', req.params.imgId);
    const filePath = path.join(__dirname, '../../uploads', img.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  res.json({ message: 'ok' });
});

// DELETE /api/properties/:id
router.delete('/:id', authenticateAdmin, (req, res) => {
  const db = getDb();
  run(db, 'DELETE FROM properties WHERE id = ?', req.params.id);
  res.json({ message: 'Logement supprimé' });
});

module.exports = router;
