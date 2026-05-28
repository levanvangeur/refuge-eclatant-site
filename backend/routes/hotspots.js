const express = require('express');
const { all, run } = require('../database/db');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/image/:imageId', async (req, res) => {
  const rows = await all(`
    SELECT h.id, h.x_percent, h.y_percent, h.label, h.description,
           h.target_image_id, h.icon_override,
           e.id   AS equipment_id, e.name AS equip_name,
           e.icon, e.instructions, e.tips,
           ri.filename AS target_filename, r.name AS target_room_name
    FROM photo_hotspots h
    LEFT JOIN equipment   e  ON e.id  = h.equipment_id
    LEFT JOIN room_images ri ON ri.id = h.target_image_id
    LEFT JOIN rooms       r  ON r.id  = ri.room_id
    WHERE h.room_image_id = ?
  `, [req.params.imageId]);

  res.json(rows.map(h => ({
    id:               h.id,
    x_percent:        h.x_percent,
    y_percent:        h.y_percent,
    hotspot_type:     h.target_image_id ? 'navigation' : h.equipment_id ? 'equipment' : 'note',
    target_image_id:  h.target_image_id  || null,
    target_room_name: h.target_room_name || null,
    target_filename:  h.target_filename  || null,
    equipment_id:     h.equipment_id     || null,
    name:             h.equip_name || h.label || (h.target_room_name || '—'),
    icon:             h.icon_override || h.icon || (h.target_image_id ? 'arrow-right' : 'info'),
    instructions:     h.instructions || h.description || '',
    tips:             h.tips || '',
  })));
});

router.post('/', authenticateAdmin, async (req, res) => {
  const { room_image_id, equipment_id, label, description, x_percent, y_percent, target_image_id, icon_override } = req.body;
  if (!room_image_id || x_percent == null || y_percent == null)
    return res.status(400).json({ error: 'room_image_id, x_percent, y_percent requis' });
  if (!equipment_id && !label && !target_image_id)
    return res.status(400).json({ error: 'Indiquez un équipement, un label ou une destination' });

  const { lastInsertRowid } = await run(
    `INSERT INTO photo_hotspots (room_image_id, equipment_id, label, description, x_percent, y_percent, target_image_id, icon_override)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [room_image_id, equipment_id || null, label || null, description || null, x_percent, y_percent, target_image_id || null, icon_override || null]
  );
  res.status(201).json({ id: lastInsertRowid });
});

router.delete('/:id', authenticateAdmin, async (req, res) => {
  await run('DELETE FROM photo_hotspots WHERE id = ?', [req.params.id]);
  res.json({ message: 'Hotspot supprimé' });
});

module.exports = router;
