// Crée une session de paiement Stripe pour une arrivée anticipée / un départ tardif.
// Le prix est recalculé ici à partir de content.json (on ne fait jamais confiance au navigateur).
// Variable d'environnement requise sur le site Netlify du livret : STRIPE_SECRET_KEY
// (clé du compte Stripe du bailleur de ce logement).

const json = (status, body) => ({ statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Méthode non autorisée.' });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json(503, { error: 'Paiement momentanément indisponible. Contactez-nous directement.' });

  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Requête invalide.' }); }
  const type = b.type === 'depart' ? 'depart' : 'arrivee';
  const hour = Number(b.hour);
  const name = String(b.name || '').trim().slice(0, 100);
  const email = String(b.email || '').trim().slice(0, 150);
  const date = String(b.date || '');
  if (!Number.isInteger(hour) || !name || !/^\S+@\S+\.\S+$/.test(email) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json(400, { error: 'Informations incomplètes.' });
  }

  const headers = event.headers || {};
  const origin = process.env.URL || (headers.host ? 'https://' + headers.host : '');
  let content;
  try {
    const r = await fetch(origin + '/content.json');
    content = await r.json();
  } catch { return json(500, { error: 'Configuration introuvable.' }); }

  const cfg = Object.assign({ enabled: true, standardCheckIn: 16, standardCheckOut: 11, earliestArrival: 12, latestDeparture: 15, pricePerHour: 5 }, content.earlyLate || {});
  if (!cfg.enabled) return json(403, { error: 'Service non proposé pour ce logement.' });

  const std = type === 'arrivee' ? cfg.standardCheckIn : cfg.standardCheckOut;
  const min = type === 'arrivee' ? cfg.earliestArrival : std + 1;
  const max = type === 'arrivee' ? std - 1 : cfg.latestDeparture;
  if (hour < min || hour > max) return json(400, { error: 'Heure non proposée.' });

  const hours = Math.abs(hour - std);
  const amount = Math.round(hours * cfg.pricePerHour * 100);
  const apt = (content.meta || {}).apartmentName || 'Logement';
  const label = (type === 'arrivee' ? 'Arrivée anticipée à ' : 'Départ tardif à ') + hour + 'h';

  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('locale', 'fr');
  form.set('customer_email', email);
  form.set('success_url', `${origin}/horaires.html?paid=1&type=${type}&h=${hour}`);
  form.set('cancel_url', `${origin}/horaires.html?type=${type}`);
  form.set('line_items[0][quantity]', '1');
  form.set('line_items[0][price_data][currency]', 'eur');
  form.set('line_items[0][price_data][unit_amount]', String(amount));
  form.set('line_items[0][price_data][product_data][name]', `${label} — ${apt}`);
  form.set('line_items[0][price_data][product_data][description]', `${hours} h × ${cfg.pricePerHour} € — ${name}, le ${date}`);
  form.set('payment_intent_data[receipt_email]', email);
  form.set('payment_intent_data[description]', `${label} — ${apt} — ${name} — ${date}`);
  const meta = { kind: 'early_late', type, hour: String(hour), date, guest: name, apartment: apt };
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
