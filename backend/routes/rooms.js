const express = require('express');
const { getDb, run } = require('../database/db');
const { authenticateAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// ── PUBLIC ────────────────────────────────────────────────

// GET /api/rooms/:propertyId
router.get('/:propertyId', (req, res) => {
  const db = getDb();
  const rooms = db.prepare(
    'SELECT * FROM rooms WHERE property_id = ? ORDER BY order_index'
  ).all(req.params.propertyId);

  rooms.forEach(room => {
    room.images    = db.prepare('SELECT * FROM room_images WHERE room_id = ? ORDER BY order_index').all(room.id);
    room.equipment = db.prepare('SELECT * FROM equipment WHERE room_id = ?').all(room.id);
  });

  res.json(rooms);
});

// ── ADMIN ─────────────────────────────────────────────────

// POST /api/rooms
router.post('/', authenticateAdmin, (req, res) => {
  const { property_id, name, description, order_index } = req.body;
  if (!property_id || !name) return res.status(400).json({ error: 'property_id et name requis' });

  const db = getDb();
  const result = run(db,
    'INSERT INTO rooms (property_id, name, description, order_index) VALUES (?, ?, ?, ?)',
    property_id, name, description || '', order_index || 0);

  res.status(201).json({ id: result.lastInsertRowid, property_id, name, description, order_index });
});

// PUT /api/rooms/:id
router.put('/:id', authenticateAdmin, (req, res) => {
  const { name, description, order_index } = req.body;
  const db = getDb();
  run(db, 'UPDATE rooms SET name = ?, description = ?, order_index = ? WHERE id = ?',
    name, description, order_index ?? 0, req.params.id);
  res.json({ message: 'Pièce mise à jour' });
});

// POST /api/rooms/:roomId/images
router.post('/:roomId/images', authenticateAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });

  const destDir = path.join(__dirname, '../../uploads/rooms', String(req.params.roomId));
  fs.mkdirSync(destDir, { recursive: true });

  const ext = path.extname(req.file.originalname).toLowerCase();
  const filename = `room-${req.params.roomId}-${Date.now()}${ext}`;
  const destPath = path.join(destDir, filename);
  fs.renameSync(req.file.path, destPath);

  const db = getDb();
  const maxOrder = db.prepare('SELECT MAX(order_index) as m FROM room_images WHERE room_id = ?').get(req.params.roomId);
  const nextOrder = (maxOrder.m ?? -1) + 1;

  const result = run(db,
    'INSERT INTO room_images (room_id, filename, alt_text, order_index) VALUES (?, ?, ?, ?)',
    req.params.roomId, `rooms/${req.params.roomId}/${filename}`, req.body.alt_text || '', nextOrder);

  res.status(201).json({
    id: result.lastInsertRowid,
    filename: `rooms/${req.params.roomId}/${filename}`,
  });
});

// DELETE /api/rooms/:id/images/:imageId
router.delete('/:id/images/:imageId', authenticateAdmin, (req, res) => {
  const db = getDb();
  const img = db.prepare('SELECT * FROM room_images WHERE id = ?').get(req.params.imageId);
  if (img) {
    const filePath = path.join(__dirname, '../../uploads', img.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    run(db, 'DELETE FROM room_images WHERE id = ?', req.params.imageId);
  }
  res.json({ message: 'Image supprimée' });
});

// DELETE /api/rooms/:id
router.delete('/:id', authenticateAdmin, (req, res) => {
  const db = getDb();
  run(db, 'DELETE FROM rooms WHERE id = ?', req.params.id);
  res.json({ message: 'Pièce supprimée' });
});

module.exports = router;
