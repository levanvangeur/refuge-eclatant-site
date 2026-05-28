#!/usr/bin/env node
/**
 * Migration d'une base SQLite locale vers Turso
 *
 * Usage :
 *   node scripts/migrate-vers-turso.js <chemin_vers_database.sqlite>
 *
 * Variables d'environnement requises (dans .env) :
 *   TURSO_DATABASE_URL=libsql://xxxxx.turso.io
 *   TURSO_AUTH_TOKEN=eyJ...
 *
 * Ce script lit les données depuis un fichier SQLite local
 * et les insère dans la base Turso cible.
 * Exécutez-le UNE SEULE FOIS après avoir créé la base Turso.
 */

'use strict';
require('dotenv').config();

const { createClient } = require('@libsql/client');
const path = require('path');

const sourceFile = process.argv[2];
if (!sourceFile) {
  console.error('Usage : node scripts/migrate-vers-turso.js <chemin_database.sqlite>');
  process.exit(1);
}

const sourceUrl = 'file:' + path.resolve(sourceFile);

async function migrate() {
  console.log('\n🚀 Migration SQLite → Turso\n');
  console.log('Source :', sourceUrl);
  console.log('Cible  :', process.env.TURSO_DATABASE_URL, '\n');

  const src = createClient({ url: sourceUrl });
  const dst = createClient({
    url:       process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const tables = [
    'settings',
    'properties',
    'property_hero_images',
    'property_gallery',
    'rooms',
    'room_images',
    'equipment',
    'rules',
    'bookings',
    'faq',
    'checkin_items',
    'photo_hotspots',
    'admins',
  ];

  for (const table of tables) {
    let rows;
    try {
      const result = await src.execute(`SELECT * FROM ${table}`);
      rows = result.rows.map(row => {
        const obj = {};
        result.columns.forEach((col, i) => { obj[col] = row[i]; });
        return obj;
      });
    } catch (e) {
      console.log(`  ⚠  Table "${table}" absente dans la source — ignorée`);
      continue;
    }

    if (!rows.length) {
      console.log(`  ✓  ${table} — vide, ignorée`);
      continue;
    }

    const cols = Object.keys(rows[0]);
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;

    let ok = 0, fail = 0;
    for (const row of rows) {
      try {
        await dst.execute({ sql, args: cols.map(c => row[c] ?? null) });
        ok++;
      } catch (e) {
        fail++;
        if (fail <= 3) console.error(`    ✗ ligne ignorée :`, e.message);
      }
    }
    console.log(`  ✓  ${table} — ${ok} ligne(s) insérée(s)${fail ? `, ${fail} ignorée(s)` : ''}`);
  }

  console.log('\n✅ Migration terminée !\n');
}

migrate().catch(err => {
  console.error('\n❌ Erreur :', err.message);
  process.exit(1);
});
