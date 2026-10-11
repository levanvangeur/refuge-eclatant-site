// Codes modifiables à distance (boîte à clés des 4 logements + cadenas du frigo du Refuge).
//
//  GET  ?apt=<slug>             PUBLIC : renvoie { keybox } (code de la boîte à clés du logement), ou null s'il n'a jamais été modifié
//                               (le livret retombe alors sur le code de son content.json).
//  POST { password, action:'load' }                      ADMIN : renvoie les codes actuellement utilisés.
//  POST { password, action:'save', keyboxes:{…}, fridge } ADMIN : enregistre les nouveaux codes.
//
// Variable d'environnement du site Netlify du Refuge : ADMIN_PASSWORD (le mot de passe de la page /admin.html).

const crypto = require('crypto');
const { SLUGS, NAMES, readCodes, writeCodes, cleanCode } = require('../lib/codes-store');

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (status, body, extra) => ({ statusCode: status, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, CORS, extra || {}), body: JSON.stringify(body) });
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const sameSecret = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Code écrit dans le content.json publié d'un livret (valeur de repli), pour pré-remplir la page d'administration
async function siteDefault(slug) {
  try {
    const r = await fetch(`https://${slug}.logementsparay.fr/content.json`, { headers: { 'Cache-Control': 'no-cache' } });
    const c = await r.json();
    return ((c.practical || {}).arrival || {}).keyboxCode || '';
  } catch (e) { return ''; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  // ───── Lecture publique d'un code de boîte à clés ─────
  if (event.httpMethod === 'GET') {
    const apt = String((event.queryStringParameters || {}).apt || '');
    if (!SLUGS.includes(apt)) return json(400, { error: 'Logement inconnu.' });
    const codes = await readCodes(event);
    const k = (codes.keyboxes || {})[apt];
    return json(200, { keybox: k || null });
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Méthode non autorisée.' });
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return json(503, { error: 'Mot de passe non configuré : ajoutez la variable ADMIN_PASSWORD sur Netlify.' });

  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Requête invalide.' }); }
  if (!b.password || !sameSecret(b.password, pass)) { await sleep(800); return json(401, { error: 'Mot de passe incorrect.' }); }

  const stored = await readCodes(event);

  if (b.action === 'load') {
    const defaults = await Promise.all(SLUGS.map(siteDefault));
    const keyboxes = SLUGS.map((slug, i) => ({
      slug, name: NAMES[slug],
      code: (stored.keyboxes || {})[slug] || defaults[i] || '',
      custom: !!(stored.keyboxes || {})[slug],
    }));
    return json(200, { keyboxes, fridge: stored.fridge || process.env.FRIDGE_CODE || '753', fridgeCustom: !!stored.fridge });
  }

  if (b.action === 'save') {
    const next = { keyboxes: Object.assign({}, stored.keyboxes), fridge: stored.fridge };
    const bad = [];
    SLUGS.forEach((slug) => {
      if (b.keyboxes && Object.prototype.hasOwnProperty.call(b.keyboxes, slug)) {
        const c = cleanCode(b.keyboxes[slug]);
        if (c) next.keyboxes[slug] = c; else bad.push(NAMES[slug]);
      }
    });
    if (b.fridge != null) {
      const c = cleanCode(b.fridge);
      if (c) next.fridge = c; else bad.push('Cadenas du frigo');
    }
    if (bad.length) return json(400, { error: 'Code invalide (1 à 16 caractères : chiffres, lettres, # * -) : ' + bad.join(', ') });
    try { await writeCodes(event, next); } catch (e) { console.error(e.message); return json(500, { error: 'Enregistrement impossible. Réessayez.' }); }
    return json(200, { ok: true });
  }

  return json(400, { error: 'Action inconnue.' });
};
