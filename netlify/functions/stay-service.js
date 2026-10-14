// Crée une session de paiement Stripe pour un service du séjour : ménage en cours de séjour ou jeu de linge supplémentaire.
// Le prix est recalculé ici à partir de content.json (stayServices) — on ne fait jamais confiance au navigateur.
// Variable d'environnement requise sur le site Netlify du livret : STRIPE_SECRET_KEY (la même que early-late).
// L'email au propriétaire est envoyé par stripe-webhook.js (kind = menage | linge).

const json = (status, body) => ({ statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const DEFAULTS = {
  cleaning: { enabled: true, price: 40, slots: ['Matin (9h – 12h)', 'Après-midi (13h – 17h)'] },
  linen: { enabled: true, price: 10, maxQty: 6, contents: '2 oreillers, housse de couette, drap housse et 2 serviettes' },
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Méthode non autorisée.' });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json(503, { error: 'Paiement momentanément indisponible. Contactez-nous directement.' });

  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Requête invalide.' }); }
  const kind = b.kind === 'linge' ? 'linge' : 'menage';
  const name = String(b.name || '').trim().slice(0, 100);
  const email = String(b.email || '').trim().slice(0, 150);
  const date = String(b.date || '');
  const note = String(b.note || '').trim().slice(0, 300);
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json(400, { error: 'Informations incomplètes.' });
  }

  const headers = event.headers || {};
  const origin = process.env.URL || (headers.host ? 'https://' + headers.host : '');
  let content;
  try {
    const r = await fetch(origin + '/content.json');
    content = await r.json();
  } catch { return json(500, { error: 'Configuration introuvable.' }); }

  const ss = content.stayServices || {};
  const apt = (content.meta || {}).apartmentName || 'Logement';
  const form = new URLSearchParams();
  let label, detail, meta;

  if (kind === 'menage') {
    const cfg = Object.assign({}, DEFAULTS.cleaning, ss.cleaning || {});
    if (ss.enabled === false || cfg.enabled === false) return json(403, { error: 'Service non proposé pour ce logement.' });
    const slots = Array.isArray(cfg.slots) && cfg.slots.length ? cfg.slots : DEFAULTS.cleaning.slots;
    const slot = Number(b.slot);
    if (!Number.isInteger(slot) || slot < 0 || slot >= slots.length) return json(400, { error: 'Créneau non proposé.' });
    const price = Number(cfg.price) || 0;
    if (price <= 0) return json(503, { error: 'Tarif non configuré.' });
    form.set('line_items[0][price_data][unit_amount]', String(Math.round(price * 100)));
    form.set('line_items[0][quantity]', '1');
    label = 'Ménage en cours de séjour';
    detail = `${slots[slot]} — ${name}, le ${date}`;
    meta = { kind: 'menage', date, slot: String(slots[slot]), guest: name, apartment: apt, note };
  } else {
    const cfg = Object.assign({}, DEFAULTS.linen, ss.linen || {});
    if (ss.enabled === false || cfg.enabled === false) return json(403, { error: 'Service non proposé pour ce logement.' });
    const max = Math.max(1, Math.min(20, Number(cfg.maxQty) || 6));
    const qty = Number(b.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > max) return json(400, { error: 'Quantité non proposée.' });
    const price = Number(cfg.price) || 0;
    if (price <= 0) return json(503, { error: 'Tarif non configuré.' });
    form.set('line_items[0][price_data][unit_amount]', String(Math.round(price * 100)));
    form.set('line_items[0][quantity]', String(qty));
    label = qty > 1 ? `Jeux de linge supplémentaires (×${qty})` : 'Jeu de linge supplémentaire';
    detail = `${cfg.contents || 'Jeu de linge'} — ${name}, le ${date}`;
    meta = { kind: 'linge', date, qty: String(qty), guest: name, apartment: apt, note };
  }

  form.set('mode', 'payment');
  form.set('locale', 'fr');
  form.set('customer_email', email);
  form.set('success_url', `${origin}/services.html?paid=1&type=${kind}`);
  form.set('cancel_url', `${origin}/services.html?type=${kind}`);
  form.set('line_items[0][price_data][currency]', 'eur');
  form.set('line_items[0][price_data][product_data][name]', `${label} — ${apt}`);
  form.set('line_items[0][price_data][product_data][description]', detail.slice(0, 500));
  form.set('payment_intent_data[receipt_email]', email);
  form.set('payment_intent_data[description]', `${label} — ${apt} — ${name} — ${date}`);
  Object.entries(meta).forEach(([k, v]) => {
    form.set(`metadata[${k}]`, v);
    form.set(`payment_intent_data[metadata][${k}]`, v);
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const data = await res.json();
  if (!res.ok || !data.url) {
    console.error('Stripe :', data && data.error && data.error.message);
    return json(502, { error: 'Impossible de lancer le paiement. Réessayez ou contactez-nous.' });
  }
  return json(200, { url: data.url });
};
