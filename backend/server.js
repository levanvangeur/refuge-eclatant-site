require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database/db');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.disable('x-powered-by');

// Fichiers statiques (dev local uniquement — sur Netlify c'est géré par CDN)
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes API
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/properties',    require('./routes/properties'));
app.use('/api/rooms',         require('./routes/rooms'));
app.use('/api/equipment',     require('./routes/equipment'));
app.use('/api/rules',         require('./routes/rules'));
app.use('/api/hotspots',      require('./routes/hotspots'));
app.use('/api/faq',           require('./routes/faq'));
app.use('/api/checkin-items', require('./routes/checkin-items'));

// Fallback SPA (dev local)
app.get('/admin*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/admin/index.html')));
app.get('*',       (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

app.use((err, req, res, _next) => {
  console.error('Erreur serveur :', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Fichier trop volumineux (max 20 Mo)' });
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Dev local uniquement
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  initDatabase().then(() => {
    app.listen(PORT, () => console.log(`\n🏠 http://localhost:${PORT}\n`));
  });
}

module.exports = app;
