// Stockage des codes modifiables depuis la page /admin.html (Netlify Blobs, sur le site du Refuge).
// Format : { keyboxes: { 'clair-obscur': '1234', ... }, fridge: '753' }
// Rien n'est stocké → les livrets retombent sur le code écrit dans leur content.json (clé boîte) ou FRIDGE_CODE / 753 (frigo).

const { getStore, connectLambda } = require('@netlify/blobs');

const SLUGS = ['clair-obscur', 'cosy-zen', 'refuge-eclatant', 'roche-velours'];
const NAMES = { 'clair-obscur': 'Le Clair-Obscur', 'cosy-zen': 'Le Cosy Zen', 'refuge-eclatant': 'Le Refuge Éclatant', 'roche-velours': 'Le Roche-Velours' };

function open(event) {
  try { if (event && event.blobs) connectLambda(event); return getStore('codes'); } catch (e) { console.error('Blobs indisponible :', e.message); return null; }
}

async function readCodes(event) {
  const store = open(event);
  if (!store) return {};
  try { return (await store.get('codes', { type: 'json' })) || {}; } catch (e) { console.error('Lecture codes :', e.message); return {}; }
}

async function writeCodes(event, data) {
  const store = open(event);
  if (!store) throw new Error('Stockage indisponible');
  await store.setJSON('codes', data);
}

// Un code : 1 à 16 caractères simples (chiffres, lettres, # * -)
const cleanCode = (v) => {
  const s = String(v == null ? '' : v).trim();
  return /^[A-Za-z0-9#*\-]{1,16}$/.test(s) ? s : null;
};

module.exports = { SLUGS, NAMES, readCodes, writeCodes, cleanCode };
