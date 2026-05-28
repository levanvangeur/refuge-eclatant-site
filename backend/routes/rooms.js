const express = require('express');
const { all, get, run } = require('../database/db');
const { authenticateAdmin } = require('../middleware/auth');
const { upload, deleteCloudinaryImage } = require('../middleware/upload');

const router = express.Router();

// GET /api/rooms/:propertyId
router.get('/:propertyId', async (req, res) => {
  const rooms = await all('SELECT * FROM rooms WHERE property_id = ? ORDER BY order_index', [req.params.propertyId]);
  for (const room of rooms) {
    room.images    = await all('SELECT * FROM room_images WHERE room_id = ? ORDER BY order_index', [room.id]);
    room.equipment = await all('SELECT * FROM equipment WHERE room_id = ? ORDER BY order_index ASC, id ASC', [room.id]);
  }
  res.json(rooms);
});

// POST /api/rooms
router.post('/', authenticateAdmin, async (req, res) => {
  const { property_id, name, description, order_index } = req.body;
  if (!property_id || !name) return res.status(400).json({ error: 'property_id et name requis' });
  const { lastInsertRowid } = await run(
    'INSERT INTO rooms (property_id, name, description, order_index) VALUES (?, ?, ?, ?)',
    [property_id, name, description || '', order_index || 0]
  );
  res.status(201).json({ id: lastInsertRowid, property_id, name, description, order_index });
});

// PUT /api/rooms/:id
router.put('/:id', authenticateAdmin, async (req, res) => {
  const { name, description, order_index } = req.body;
  await run('UPDATE rooms SET name = ?, description = ?, order_index = ? WHERE id = ?',
    [name, description, order_index ?? 0, req.params.id]);
  res.json({ message: 'Pièce mise à jour' });
});

// POST /api/rooms/:roomId/images — upload vers Cloudinary
router.post('/:roomId/images', authenticateAdmin, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });

  const cloudinaryUrl = req.file.path; // URL Cloudinary complète
  const maxOrder = await get('SELECT MAX(order_index) as m FROM room_images WHERE room_id = ?', [req.params.roomId]);
  const { lastInsertRowid } = await run(
    'INSERT INTO room_images (room_id, filename, alt_text, order_index) VALUES (?, ?, ?, ?)',
    [req.params.roomId, cloudinaryUrl, req.body.alt_text || '', (maxOrder.m ?? -1) + 1]
  );
  res.status(201).json({ id: lastInsertRowid, filename: cloudinaryUrl });
});

// DELETE /api/rooms/:id/images/:imageId
router.delete('/:id/images/:imageId', authenticateAdmin, async (req, res) => {
  const img = await get('SELECT * FROM room_images WHERE id = ?', [req.params.imageId]);
  if (img) {
    await deleteCloudinaryImage(img.filename);
    await run('DELETE FROM room_images WHERE id = ?', [req.params.imageId]);
  }
  res.json({ message: 'Image supprimée' });
});

// DELETE /api/rooms/:id
router.delete('/:id', authenticateAdmin, async (req, res) => {
  await run('DELETE FROM rooms WHERE id = ?', [req.params.id]);
  res.json({ message: 'Pièce supprimée' });
});

module.exports = router;
