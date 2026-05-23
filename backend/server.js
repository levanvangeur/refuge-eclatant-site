require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Protection basique : supprimer les headers qui révèlent la stack
app.disable('x-powered-by');

// ── Fichiers statiques ───────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Routes API ───────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/equipment', require('./routes/equipment'));
app.use('/api/rules', require('./routes/rules'));
app.use('/api/hotspots', require('./routes/hotspots'));
app.use('/api/faq',           require('./routes/faq'));
app.use('/api/checkin-items', require('./routes/checkin-items'));

// ── Fallback SPA ─────────────────────────────────────────
app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin/index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Gestionnaire d'erreurs global ────────────────────────
app.use((err, req, res, _next) => {
  console.error('Erreur serveur :', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Fichier trop volumineux (max 15 Mo)' });
  }
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// ── Démarrage ────────────────────────────────────────────
initDatabase();

app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log(`║  🏠 AppVoyageurs  →  http://localhost:${PORT}   ║`);
  console.log(`║  🔒 Admin         →  http://localhost:${PORT}/admin ║`);
  console.log('╚════════════════════════════════════════╝');
  console.log('');
});
