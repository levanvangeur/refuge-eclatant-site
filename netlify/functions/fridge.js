// Frigo « Boisson et snack » : empreinte de carte bancaire (aucun débit immédiat) puis remise du code du cadenas.
//
//  POST  { name, email }  → crée une session Stripe Checkout en mode « setup » (carte enregistrée sur un client Stripe)
//                           et renvoie { url } vers laquelle rediriger le voyageur.
//  GET   ?sid=cs_…        → si la session est bien terminée (carte validée), renvoie { code }.
//
// Variables d'environnement du site Netlify :
//   STRIPE_SECRET_KEY    clé secrète Stripe du bailleur (obligatoire)
//   FRIDGE_CODE          code du cadenas (facultatif ; « 753 » par défaut)
//   FRIDGE_VALID_DAYS    durée pendant laquelle le code reste consultable après l'empreinte (défaut 7 jours)
// Le code n'est volontairement PAS dans content.json (fichier public) : il n'est renvoyé qu'après validation de la carte.
// Le montant de la consommation est débité ensuite par le propriétaire, depuis Stripe, sur la carte enregistrée.

const json = (status, body) => ({ statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const stripe = (key, path, opts) => fetch('https://api.stripe.com/v1' + path, Object.assign({}, opts, {
  headers: Object.assign({ Authorization: 'Bearer ' + key }, (opts && opts.headers) || {}),
}));

exports.handler = async (event) => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json(503, { error: 'Service momentanément indisponible. Contactez-nous directement.' });
  const headers = event.headers || {};
  const origin = process.env.URL || (headers.host ? 'https://' + headers.host : '');

  // ───── Remise du code après empreinte validée ─────
  if (event.httpMethod === 'GET') {
    const sid = String((event.queryStringParameters || {}).sid || '');
    if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(sid)) return json(400, { error: 'Lien invalide.' });
    const r = await stripe(key, '/checkout/sessions/' + encodeURIComponent(sid));
    const s = await r.json().catch(() => ({}));
    if (!r.ok) return json(404, { error: 'Empreinte introuvable.' });
    const days = Number(process.env.FRIDGE_VALID_DAYS) || 7;
    const fresh = s.created && (Date.now() / 1000 - s.created) < days * 86400;
    if (s.mode !== 'setup' || s.status !== 'complete' || !s.metadata || s.metadata.kind !== 'fridge' || !fresh) {
      return json(403, { error: 'Empreinte non validée ou expirée.' });
    }
    return json(200, { code: process.env.FRIDGE_CODE || '753', guest: s.metadata.guest || '' });
  }

  // ───── Création de l'empreinte de carte ─────
  if (event.httpMethod !== 'POST') return json(405, { error: 'Méthode non autorisée.' });
  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Requête invalide.' }); }
  const name = String(b.name || '').trim().slice(0, 100);
  const email = String(b.email || '').trim().slice(0, 150);
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return json(400, { error: 'Merci de renseigner votre nom et un email valide.' });

  let content = {};
  try { content = await (await fetch(origin + '/content.json')).json(); } catch { return json(500, { error: 'Configuration introuvable.' }); }
  if (!content.fridge || content.fridge.enabled === false) return json(403, { error: 'Service non proposé pour ce logement.' });
  const apt = (content.meta || {}).apartmentName || 'Logement';

  const form = (obj) => { const f = new URLSearchParams(); Object.entries(obj).forEach(([k, v]) => f.set(k, v)); return f; };
  const post = async (path, obj) => {
    const r = await stripe(key, path, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(obj) });
    return { ok: r.ok, data: await r.json().catch(() => ({})) };
  };

  // 1. Client Stripe (c'est lui qui portera la carte, pour pouvoir la débiter ensuite)
  const cus = await post('/customers', { name, email, description: `Frigo — ${apt}`, 'metadata[kind]': 'fridge', 'metadata[apartment]': apt });
  if (!cus.ok || !cus.data.id) { console.error('Stripe customer :', cus.data.error && cus.data.error.message); return json(502, { error: 'Impossible de lancer la validation. Réessayez ou contactez-nous.' }); }

  // 2. Session Checkout en mode « setup » = empreinte de carte, sans prélèvement
  const meta = { kind: 'fridge', guest: name, apartment: apt };
  const sess = { mode: 'setup', locale: 'fr', customer: cus.data.id, 'payment_method_types[0]': 'card',
    success_url: `${origin}/frigo.html?ok=1&sid={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/frigo.html`,
    'custom_text[submit][message]': 'Aucun montant n’est débité maintenant : seule une empreinte de votre carte est enregistrée. Votre consommation sera débitée à la fin de votre séjour.',
    'setup_intent_data[description]': `Frigo — ${apt} — ${name}` };
  Object.entries(meta).forEach(([k, v]) => { sess[`metadata[${k}]`] = v; sess[`setup_intent_data[metadata][${k}]`] = v; });
  const cs = await post('/checkout/sessions', sess);
  if (!cs.ok || !cs.data.url) { console.error('Stripe session :', cs.data.error && cs.data.error.message); return json(502, { error: 'Impossible de lancer la validation. Réessayez ou contactez-nous.' }); }
  return json(200, { url: cs.data.url });
};
