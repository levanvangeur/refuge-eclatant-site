// Webhook Stripe : prévient le propriétaire par email à chaque arrivée anticipée /
// départ tardif payé (événement checkout.session.completed).
//
// Variables d'environnement du site Netlify du livret :
//   STRIPE_WEBHOOK_SECRET  secret « whsec_… » du webhook créé dans Stripe
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS  boîte d'envoi (ex. smtp.gmail.com / 465 / adresse / mot de passe d'application)
// Destinataire : content.json → earlyLate.notifyEmail (modifiable dans l'éditeur).

const crypto = require('crypto');
const nodemailer = require('nodemailer');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const frDate = (iso) => { const [y, m, d] = String(iso).split('-'); return d && m && y ? `${d}/${m}/${y}` : iso; };

function verify(payload, header, secret) {
  const parts = Object.fromEntries(String(header || '').split(',').map((p) => p.split('=')));
  if (!parts.t || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${payload}`).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

exports.handler = async (event) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return { statusCode: 503, body: 'Webhook non configuré' };
  const headers = event.headers || {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  if (!verify(raw, headers['stripe-signature'], secret)) return { statusCode: 400, body: 'Signature invalide' };

  const evt = JSON.parse(raw);
  if (evt.type !== 'checkout.session.completed') return { statusCode: 200, body: 'ignoré' };
  const s = evt.data.object;
  const m = s.metadata || {};
  if (m.kind !== 'early_late' || s.payment_status !== 'paid') return { statusCode: 200, body: 'ignoré' };

  // Destinataire depuis le contenu publié du livret
  let to = process.env.NOTIFY_EMAIL || '';
  try {
    const origin = process.env.URL || (headers.host ? 'https://' + headers.host : '');
    const c = await (await fetch(origin + '/content.json')).json();
    to = (c.earlyLate && c.earlyLate.notifyEmail) || to;
  } catch { /* on garde NOTIFY_EMAIL */ }
  if (!to) { console.error('Aucun destinataire (earlyLate.notifyEmail / NOTIFY_EMAIL)'); return { statusCode: 200, body: 'pas de destinataire' }; }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) { console.error('SMTP non configuré'); return { statusCode: 500, body: 'SMTP non configuré' }; }
  const port = Number(SMTP_PORT) || 465;
  const transport = nodemailer.createTransport({
    host: SMTP_HOST, port, secure: port === 465,
    auth: { user: SMTP_USER, pass: /gmail\.com$/i.test(SMTP_HOST) ? SMTP_PASS.replace(/\s/g, '') : SMTP_PASS },
  });

  const isArr = m.type === 'arrivee';
  const what = isArr ? 'Arrivée anticipée' : 'Départ tardif';
  const amount = (s.amount_total || 0) / 100;
  const email = (s.customer_details && s.customer_details.email) || s.customer_email || '';
  const rows = [
    ['Logement', m.apartment], ['Client', m.guest], ['Email', email],
    [isArr ? 'Date d\'arrivée' : 'Date de départ', frDate(m.date)],
    ['Heure demandée', m.hour + 'h'], ['Montant payé', amount.toLocaleString('fr-FR') + ' €'],
  ];
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#5B4B37">
    <h2 style="font-weight:500">${esc(what)} — ${esc(m.apartment)}</h2>
    <table style="width:100%;border-collapse:collapse">${rows.map(([k, v]) =>
      `<tr><td style="padding:8px 0;border-bottom:1px solid #E4DFD5;color:#8A7C64">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #E4DFD5;text-align:right"><b>${esc(v)}</b></td></tr>`).join('')}</table>
    <p style="color:#8A7C64;font-size:13px">À valider selon le planning. En cas d'impossibilité, remboursez le client depuis Stripe.</p></div>`;

  try {
    await transport.sendMail({
      from: `"Livret ${m.apartment}" <${SMTP_USER}>`,
      to, replyTo: email || undefined,
      subject: `${what} à ${m.hour}h — ${m.apartment} — ${m.guest}`,
      html,
    });
  } catch (err) {
    console.error('Email non envoyé :', err.message);
    return { statusCode: 500, body: 'Email non envoyé' }; // Stripe réessaiera
  }
  return { statusCode: 200, body: 'ok' };
};
