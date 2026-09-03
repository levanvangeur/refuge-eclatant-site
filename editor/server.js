/* ────────────────────────────────────────────────────────────
   Éditeur local du livret d'accueil.
   Sert l'interface d'édition, enregistre le contenu et les photos,
   affiche un aperçu, et publie le site (git commit + push) avec
   étape d'aperçu/confirmation.
   Lancer :  node editor/server.js
   ──────────────────────────────────────────────────────────── */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const ROOT = path.resolve(__dirname, '..');            // dossier du site (repo git)
const FRONTEND = path.join(ROOT, 'frontend');
const CONTENT = path.join(FRONTEND, 'content.json');
const IMAGES = path.join(FRONTEND, 'images');
const PORT = process.env.EDITOR_PORT || 4001;
const APP_NAME = process.env.APP_NAME || readAppName();

function readAppName() {
  try { return JSON.parse(fs.readFileSync(CONTENT, 'utf8')).meta.apartmentName || 'Livret'; }
  catch (e) { return 'Livret'; }
}

const app = express();
app.use(express.json({ limit: '2mb' }));

// ── Interface d'édition ──
app.use('/', express.static(path.join(__dirname, 'public')));
// ── Aperçu du livret publié (mêmes fichiers que la version en ligne) ──
app.use('/preview', express.static(FRONTEND));

// ── Contenu ──
app.get('/api/content', (req, res) => {
  fs.readFile(CONTENT, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Lecture impossible : ' + err.message });
    res.type('application/json').send(data);
  });
});

app.post('/api/content', (req, res) => {
  try {
    const json = JSON.stringify(req.body, null, 2);
    fs.writeFileSync(CONTENT, json, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Écriture impossible : ' + e.message });
  }
});

// ── Upload de photos ──
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const sub = (req.query.folder || 'custom').replace(/[^a-z0-9/_-]/gi, '');
    const dir = path.join(IMAGES, sub);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'photo';
    cb(null, base + '-' + Date.now() + ext);
  },
});
const upload = multer({ storage, limits: { fileSize: 12 * 1024 * 1024 } });

app.post('/api/upload', upload.array('photos', 20), (req, res) => {
  const sub = (req.query.folder || 'custom').replace(/[^a-z0-9/_-]/gi, '');
  const paths = (req.files || []).map((f) => 'images/' + sub + '/' + f.filename);
  res.json({ ok: true, paths });
});

// ── Git helpers ──
function git(args, cb) {
  execFile('git', args, { cwd: ROOT, windowsHide: true }, (err, stdout, stderr) => {
    cb(err, (stdout || '') + (stderr || ''));
  });
}

// Aperçu des changements avant publication
app.get('/api/status', (req, res) => {
  git(['status', '--porcelain'], (err, out) => {
    if (err) return res.status(500).json({ error: out || err.message });
    const files = out.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const code = l.slice(0, 2).trim();
      const file = l.slice(2).trim();
      let kind = 'Modifié';
      if (code.includes('A') || code === '??') kind = 'Ajouté';
      else if (code.includes('D')) kind = 'Supprimé';
      else if (code.includes('R')) kind = 'Renommé';
      return { kind, file };
    });
    git(['remote', 'get-url', 'origin'], (e2, remote) => {
      res.json({ files, remote: (remote || '').trim(), clean: files.length === 0 });
    });
  });
});

// Publication : add + commit + push
app.post('/api/publish', (req, res) => {
  const msg = (req.body && req.body.message ? String(req.body.message) : '').trim()
    || ('Mise à jour du livret — ' + new Date().toLocaleString('fr-FR'));
  git(['add', '-A'], (e1, o1) => {
    if (e1) return res.status(500).json({ step: 'add', error: o1 || e1.message });
    git(['commit', '-m', msg], (e2, o2) => {
      // « rien à committer » n'est pas une vraie erreur
      if (e2 && !/nothing to commit|rien à/i.test(o2)) {
        return res.status(500).json({ step: 'commit', error: o2 || e2.message });
      }
      git(['push', 'origin', 'HEAD'], (e3, o3) => {
        if (e3) return res.status(500).json({ step: 'push', error: o3 || e3.message });
        res.json({ ok: true, message: msg, log: o3 });
      });
    });
  });
});

app.get('/api/config', (req, res) => {
  res.json({ appName: APP_NAME, port: PORT });
});

app.listen(PORT, () => {
  console.log('\n  ✦ Éditeur du livret « ' + APP_NAME + ' »');
  console.log('  → Interface : http://localhost:' + PORT);
  console.log('  → Aperçu    : http://localhost:' + PORT + '/preview');
  console.log('  (Laissez cette fenêtre ouverte pendant l\'édition.)\n');
});
