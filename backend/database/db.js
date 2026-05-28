const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

let _client = null;

function getClient() {
  if (!_client) {
    _client = createClient({
      url:       process.env.TURSO_DATABASE_URL || 'file:database.sqlite',
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

// Convertit un ResultSet libSQL en tableau de plain objects
function toPlain(result) {
  return result.rows.map(row => {
    const obj = {};
    result.columns.forEach((col, i) => { obj[col] = row[i] ?? null; });
    return obj;
  });
}

// SELECT → tableau d'objets
async function all(sql, args = []) {
  const result = await getClient().execute({ sql, args });
  return toPlain(result);
}

// SELECT → premier objet ou null
async function get(sql, args = []) {
  const rows = await all(sql, args);
  return rows[0] || null;
}

// INSERT / UPDATE / DELETE → { lastInsertRowid, changes }
async function run(sql, args = []) {
  const result = await getClient().execute({ sql, args });
  return {
    lastInsertRowid: Number(result.lastInsertRowid || 0),
    changes: result.rowsAffected || 0,
  };
}

// Exécute plusieurs statements DDL séparés par ";"
async function execMultiple(sql) {
  await getClient().executeMultiple(sql);
}

// ── Init ─────────────────────────────────────────────────────

async function initDatabase() {
  const client = getClient();

  await client.executeMultiple(`
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
      address TEXT,
      max_guests TEXT,
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
      order_index INTEGER DEFAULT 0,
      category TEXT DEFAULT 'equipement',
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
      parking_instructions TEXT,
      places_to_discover TEXT,
      key_box_code TEXT,
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
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      room_image_id  INTEGER NOT NULL,
      equipment_id   INTEGER,
      label          TEXT,
      description    TEXT,
      x_percent      REAL NOT NULL,
      y_percent      REAL NOT NULL,
      target_image_id INTEGER,
      icon_override  TEXT,
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

    CREATE TABLE IF NOT EXISTS property_hero_images (
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

  await seedIfEmpty();
  console.log('✅ Base de données prête');
}

async function seedIfEmpty() {
  const users = await all('SELECT COUNT(*) as c FROM users');
  if (users[0].c > 0) return;

  const hash = bcrypt.hashSync('azerty', 10);
  await run('INSERT INTO users (username, password_hash) VALUES (?, ?)', ['admin', hash]);

  const { lastInsertRowid: propId } = await run(
    'INSERT INTO properties (name, tagline, description) VALUES (?, ?, ?)',
    ['Mon Appartement', 'Bienvenue !', 'Décrivez votre logement ici.']
  );

  await run('INSERT OR IGNORE INTO rules (property_id) VALUES (?)', [propId]);
  await run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['help_phone', '+33 6 00 00 00 00']);
  await run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['help_email', 'contact@exemple.fr']);

  console.log('🌱 Données initiales créées — admin / azerty');
}

module.exports = { getClient, all, get, run, execMultiple, initDatabase };
