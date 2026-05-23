// node:sqlite est intégré à Node.js 22.5+ — aucune dépendance native requise
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

// Base de données dans le dossier racine du projet (versionné avec Git)
const DB_PATH = path.join(__dirname, '../../database.sqlite');

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}

function initDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tagline TEXT,
      description TEXT,
      main_image TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS room_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      alt_text TEXT,
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'tool',
      instructions TEXT,
      tips TEXT,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL UNIQUE,
      check_in_time TEXT DEFAULT '15:00',
      check_out_time TEXT DEFAULT '11:00',
      check_in_instructions TEXT,
      check_out_instructions TEXT,
      trash_instructions TEXT,
      wifi_name TEXT,
      wifi_password TEXT,
      house_rules TEXT,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      label TEXT,
      price_per_night INTEGER DEFAULT 0,
      currency TEXT DEFAULT 'EUR',
      booking_url TEXT,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS photo_hotspots (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      room_image_id INTEGER NOT NULL,
      equipment_id  INTEGER,
      label         TEXT,
      description   TEXT,
      x_percent     REAL NOT NULL,
      y_percent     REAL NOT NULL,
      FOREIGN KEY (room_image_id) REFERENCES room_images(id) ON DELETE CASCADE,
      FOREIGN KEY (equipment_id)  REFERENCES equipment(id)   ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS property_gallery (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id  INTEGER NOT NULL,
      filename     TEXT NOT NULL,
      order_index  INTEGER DEFAULT 0,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS faq (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id  INTEGER NOT NULL,
      question     TEXT NOT NULL,
      answer       TEXT NOT NULL,
      order_index  INTEGER DEFAULT 0,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checkin_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id  INTEGER NOT NULL,
      type         TEXT NOT NULL DEFAULT 'checkin',
      icon         TEXT DEFAULT 'check',
      title        TEXT NOT NULL,
      description  TEXT,
      order_index  INTEGER DEFAULT 0,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    );
  `);

  // Migrations — colonnes ajoutées après la version initiale
  try { db.exec('ALTER TABLE photo_hotspots ADD COLUMN target_image_id INTEGER REFERENCES room_images(id) ON DELETE SET NULL'); } catch(_) {}
  try { db.exec('ALTER TABLE photo_hotspots ADD COLUMN icon_override TEXT'); } catch(_) {}
  try { db.exec('ALTER TABLE equipment ADD COLUMN order_index INTEGER DEFAULT 0'); } catch(_) {}
  try { db.exec("ALTER TABLE equipment ADD COLUMN category TEXT DEFAULT 'equipement'"); } catch(_) {}
  db.exec('UPDATE equipment SET order_index = id WHERE order_index = 0');
  try { db.exec('ALTER TABLE rules ADD COLUMN parking_instructions TEXT'); } catch(_) {}
  try { db.exec('ALTER TABLE rules ADD COLUMN places_to_discover TEXT'); } catch(_) {}

  // Photos hero (slideshow accueil)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS property_hero_images (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER NOT NULL,
        filename    TEXT NOT NULL,
        order_index INTEGER DEFAULT 0,
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
      )
    `);
  } catch(_) {}
  // Migration : si main_image existe et qu'aucune hero image n'est encore enregistrée
  try {
    const props = db.prepare('SELECT id, main_image FROM properties WHERE main_image IS NOT NULL').all();
    props.forEach(p => {
      const { c } = db.prepare('SELECT COUNT(*) as c FROM property_hero_images WHERE property_id = ?').get(p.id);
      if (c === 0) {
        db.prepare('INSERT INTO property_hero_images (property_id, filename, order_index) VALUES (?, ?, 1)').run(p.id, p.main_image);
      }
    });
  } catch(_) {}

  seedIfEmpty(db);
  console.log('✅ Base de données initialisée');
}

function run(db, sql, ...params) {
  const stmt = db.prepare(sql);
  const result = stmt.run(...params);
  return { lastInsertRowid: Number(result.lastInsertRowid), changes: result.changes };
}

function seedIfEmpty(db) {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (userCount.c > 0) return;

  // Admin par défaut — à changer immédiatement
  const hash = bcrypt.hashSync('azerty', 10);
  run(db, 'INSERT INTO users (username, password_hash) VALUES (?, ?)', 'admin', hash);

  // Propriété de démonstration
  const propRes = run(db,
    'INSERT INTO properties (name, tagline, description, main_image) VALUES (?, ?, ?, ?)',
    'Villa Lumière',
    'Un havre de paix au cœur de la ville',
    'Appartement de charme entièrement rénové, alliant matériaux nobles et confort contemporain. Lumineux, calme et idéalement situé, il vous offre une expérience de séjour unique.',
    null
  );
  const propId = propRes.lastInsertRowid;

  // Pièces
  const roomDefs = [
    { name: 'Salon',        description: 'Espace de vie lumineux avec canapé confort, TV 4K et connexion fibre.',                    order: 0 },
    { name: 'Cuisine',      description: 'Cuisine entièrement équipée. Tout le nécessaire pour cuisiner comme à la maison.',         order: 1 },
    { name: 'Chambre',      description: 'Chambre cosy avec lit queen-size, literie haut de gamme et rangements.',                   order: 2 },
    { name: 'Salle de bain',description: "Salle de bain moderne avec douche à l'italienne et produits de toilette fournis.",         order: 3 },
  ];

  const roomIds = roomDefs.map(r =>
    run(db, 'INSERT INTO rooms (property_id, name, description, order_index) VALUES (?, ?, ?, ?)',
      propId, r.name, r.description, r.order).lastInsertRowid
  );

  // Équipements par pièce
  const equipDefs = [
    // Salon
    { r: 0, name: 'Télévision 4K',      icon: 'tv-2',     instr: 'Appuyez sur le bouton rouge de la télécommande pour allumer. Utilisez Netflix avec les identifiants affichés sur le carton de bienvenue.', tips: 'HDMI 1 = Chromecast, HDMI 2 = Apple TV' },
    { r: 0, name: 'Fibre optique WiFi', icon: 'wifi',     instr: 'Le réseau s\'appelle "VillaLumiere_5G". Le mot de passe se trouve dans la section Règles.', tips: 'Connectez-vous au réseau 5G pour de meilleures performances' },
    { r: 0, name: 'Climatisation',      icon: 'wind',     instr: 'Télécommande sur le meuble TV. Mode ❄️ = climatisation, mode ☀️ = chauffage. Température recommandée : 21°C.', tips: 'Pensez à éteindre en quittant l\'appartement' },
    // Cuisine
    { r: 1, name: 'Plaque à induction', icon: 'flame',    instr: 'Appuyez sur le bouton ON/OFF central. Chaque zone est indépendante. Utilisez uniquement des ustensiles compatibles induction (aimant = compatible).', tips: 'La plaque s\'arrête automatiquement après 2h sans activité' },
    { r: 1, name: 'Four',               icon: 'square',   instr: 'Tournez le sélecteur gauche pour le mode (grill, chaleur tournante…), le sélecteur droit pour la température. Préchauffez 10 min avant.', tips: 'Le lèche-frite se trouve dans le tiroir sous le four' },
    { r: 1, name: 'Lave-vaisselle',     icon: 'droplets', instr: 'Tablettes sous l\'évier. Programme ECO = 3h, programme rapide = 1h.', tips: 'Merci de lancer un cycle avant votre départ' },
    { r: 1, name: 'Cafetière Nespresso',icon: 'coffee',   instr: 'Insérez une capsule, appuyez sur le bouton espresso ou lungo. Les capsules sont dans le tiroir à gauche.', tips: '6 capsules offertes à votre arrivée' },
    // Chambre
    { r: 2, name: 'Literie & Oreillers',icon: 'moon',     instr: 'Oreillers fermes et moelleux disponibles dans le placard. Couette légère ou épaisse selon la saison.', tips: 'Couverture supplémentaire dans le bas du placard' },
    { r: 2, name: 'Stores occultants',  icon: 'sun',      instr: 'Tirez le cordon sur le côté droit pour baisser, à gauche pour monter. Mode 100% nuit : descendre jusqu\'en butée.', tips: 'Parfait pour les grasses matinées !' },
    // Salle de bain
    { r: 3, name: 'Douche italienne',   icon: 'droplet',  instr: 'Tournez vers la gauche pour l\'eau chaude, droite pour le froid. La pression est forte — commencez doucement.', tips: 'Serviettes propres dans le meuble sous le lavabo' },
    { r: 3, name: 'Sèche-cheveux',      icon: 'wind',     instr: 'Dans le tiroir du bas. Deux vitesses : 1 = doux, 2 = puissant. Bouton froid = fixateur.', tips: '' },
  ];

  equipDefs.forEach(e =>
    run(db, 'INSERT INTO equipment (room_id, name, icon, instructions, tips) VALUES (?, ?, ?, ?, ?)',
      roomIds[e.r], e.name, e.icon, e.instr, e.tips)
  );

  // Règles
  run(db, `INSERT INTO rules
    (property_id, check_in_time, check_out_time, check_in_instructions, check_out_instructions, trash_instructions, wifi_name, wifi_password, house_rules)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    propId, '15:00', '11:00',
    'Un boîtier à code est installé à l\'entrée. Le code vous sera communiqué par SMS le jour de votre arrivée.',
    'Déposez les clés dans la boîte aux lettres n°12 au rez-de-chaussée. Merci de laisser l\'appartement propre.',
    'Poubelles vertes (verre) : devant l\'immeuble. Poubelles noires (ordures) : local rez-de-chaussée, code 1234. Recyclage : bac jaune dans le même local.',
    'VillaLumiere_5G',
    'bienvenue2024!',
    '• Pas de fête ni de bruit après 22h\n• Animaux non admis\n• Interdiction de fumer à l\'intérieur (balcon autorisé)\n• Respectez le voisinage\n• Signalez tout problème sans attendre'
  );

  // Option de réservation directe
  run(db, 'INSERT INTO bookings (property_id, label, price_per_night, currency, booking_url, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    propId, 'Réservation directe', 120, 'EUR', 'https://votre-lien-de-reservation.com', 1
  );

  // Paramètres globaux
  run(db, 'INSERT INTO settings (key, value) VALUES (?, ?)', 'help_phone', '+33 6 00 00 00 00');
  run(db, 'INSERT INTO settings (key, value) VALUES (?, ?)', 'help_email', 'contact@villalumierebnb.fr');
  run(db, 'INSERT INTO settings (key, value) VALUES (?, ?)', 'site_name', 'Villa Lumière');

  console.log('🌱 Données de démonstration insérées');
  console.log('👤 Admin : admin / azerty');
}

module.exports = { getDb, initDatabase, run };
