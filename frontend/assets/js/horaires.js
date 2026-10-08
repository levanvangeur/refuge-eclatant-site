/* Page « arrivée anticipée / départ tardif » : horloge cliquable + paiement.
 * Le prix est recalculé côté serveur (netlify/functions/early-late.js). */
(function () {
  'use strict';
  const root = document.getElementById('hz');
  const params = new URLSearchParams(location.search);
  const type = params.get('type') === 'depart' ? 'depart' : 'arrivee';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = (n) => n.toLocaleString('fr-FR') + ' €';

  fetch('content.json', { cache: 'no-store' }).then((r) => r.json()).then(init).catch(() => {
    root.innerHTML = '<p class="hz-lead">Page momentanément indisponible.</p>';
  });

  function init(data) {
    const cfg = Object.assign({ enabled: true, standardCheckIn: 16, standardCheckOut: 11, earliestArrival: 12, latestDeparture: 15, pricePerHour: 5 }, data.earlyLate || {});
    const aptName = (data.meta || {}).apartmentName || '';
    const isArr = type === 'arrivee';
    document.title = (isArr ? 'Arrivée anticipée' : 'Départ tardif') + ' — ' + aptName;

    if (params.get('paid') === '1') {
      const h = parseInt(params.get('h'), 10);
      root.innerHTML = `<div class="hz-ok"><div class="hz-star">✦</div>
        <h1>Merci, c'est réglé</h1>
        <p class="hz-lead">Votre ${isArr ? 'arrivée anticipée' : 'départ tardif'} est enregistré${h ? ' pour ' + h + 'h' : ''}. Un reçu vous est envoyé par email. À très bientôt !</p>
        <a class="hz-pay" style="display:inline-block;text-decoration:none" href="index.html">Retour au livret</a></div>`;
      return;
    }
    if (!cfg.enabled) { root.innerHTML = '<p class="hz-lead">Ce service n\'est pas proposé pour ce logement.</p>'; return; }

    const std = isArr ? cfg.standardCheckIn : cfg.standardCheckOut;
    // Arrivée : de l'heure la plus tôt jusqu'à 1 h avant l'heure standard.
    // Départ : d'1 h après l'heure standard jusqu'à l'heure la plus tardive.
    const from = isArr ? cfg.earliestArrival : std + 1;
    const to = isArr ? std - 1 : cfg.latestDeparture;
    const hours = []; for (let h = from; h <= to; h++) hours.push(h);
    let selected = null;

    root.innerHTML = `
      <div class="hz-apt">${esc(aptName)}</div>
      <h1>${isArr ? 'Arrivée anticipée' : 'Départ tardif'}</h1>
      <p class="hz-lead">${isArr
        ? `L'arrivée est habituellement à partir de ${std}h. Touchez l'heure à laquelle vous souhaitez arriver.`
        : `Le départ est habituellement avant ${std}h. Touchez l'heure à laquelle vous souhaitez partir.`}
        Chaque heure supplémentaire est facturée ${eur(cfg.pricePerHour)}.</p>
      <svg class="hz-clock" viewBox="0 0 300 300" role="group" aria-label="Choix de l'heure" id="hzClock"></svg>
      <div class="hz-legend">Heures proposées : de ${from}h à ${to}h</div>
      <div class="hz-price empty" id="hzPrice"><div class="hz-detail">Choisissez une heure sur l'horloge</div></div>
      <form class="hz-form" id="hzForm" novalidate>
        <label>Nom et prénom<input name="name" autocomplete="name" required></label>
        <label>Email (pour le reçu)<input name="email" type="email" autocomplete="email" required></label>
        <label>${isArr ? 'Date d\'arrivée' : 'Date de départ'}<input name="date" type="date" required></label>
        <div class="hz-err" id="hzErr" role="alert"></div>
        <button class="hz-pay" id="hzPay" type="submit" disabled>Payer et confirmer</button>
      </form>
      <p class="hz-note">Paiement sécurisé par carte via Stripe. La demande reste soumise à la disponibilité du logement : en cas d'impossibilité, vous êtes remboursé.</p>`;

    // ── Horloge (cadran 12 h) ──
    const svg = document.getElementById('hzClock');
    const NS = 'http://www.w3.org/2000/svg';
    const C = 150, R = 118;
    const pt = (pos, r) => { const a = (pos % 12) * Math.PI / 6; return [C + r * Math.sin(a), C - r * Math.cos(a)]; };
    const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); (parent || svg).appendChild(e); return e; };
    mk('circle', { cx: C, cy: C, r: 140, class: 'hz-face' });
    for (let i = 0; i < 12; i++) { const [x1, y1] = pt(i, 130), [x2, y2] = pt(i, 136); mk('line', { x1, y1, x2, y2, class: 'hz-tick' }); }
    for (let i = 1; i <= 12; i++) {
      if (hours.some((h) => h % 12 === i % 12) || std % 12 === i % 12) continue;
      const [x, y] = pt(i, 100); mk('text', { x, y, class: 'hz-num' }).textContent = i;
    }
    const hand = mk('line', { x1: C, y1: C, x2: C, y2: C, class: 'hz-hand' });
    mk('circle', { cx: C, cy: C, r: 6, class: 'hz-hub' });
    const bubble = (cls, pos, label, extra) => {
      const [x, y] = pt(pos, R);
      const g = mk('g', Object.assign({ class: cls }, extra || {}));
      mk('circle', { cx: x, cy: y, r: 22 }, g);
      mk('text', { x, y }, g).textContent = label;
      return g;
    };
    bubble('hz-opt hz-std', std, std + 'h', { style: 'cursor:default' });
    const groups = {};
    hours.forEach((h) => {
      const g = bubble('hz-opt', h, h + 'h', { tabindex: 0, role: 'button', 'aria-label': h + ' heures' });
      g.addEventListener('click', () => pick(h));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(h); } });
      groups[h] = g;
    });

    const priceBox = document.getElementById('hzPrice'), pay = document.getElementById('hzPay'), err = document.getElementById('hzErr');
    function pick(h) {
      selected = h;
      Object.keys(groups).forEach((k) => groups[k].classList.toggle('sel', Number(k) === h));
      const [x, y] = pt(h % 12, R - 24);
      hand.setAttribute('x2', x); hand.setAttribute('y2', y);
      const n = Math.abs(h - std);
      priceBox.classList.remove('empty');
      priceBox.innerHTML = `<div class="hz-big">${eur(n * cfg.pricePerHour)}</div>
        <div class="hz-detail">${isArr ? 'Arrivée' : 'Départ'} à ${h}h au lieu de ${std}h : ${n} heure${n > 1 ? 's' : ''} × ${eur(cfg.pricePerHour)}</div>`;
      pay.disabled = false;
    }

    const dateInput = document.querySelector('#hzForm [name=date]');
    const now = new Date();
    dateInput.min = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

    document.getElementById('hzForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      err.textContent = '';
      const f = new FormData(ev.target);
      const body = { type, hour: selected, name: String(f.get('name') || '').trim(), email: String(f.get('email') || '').trim(), date: f.get('date') };
      if (selected == null) { err.textContent = 'Choisissez d\'abord une heure sur l\'horloge.'; return; }
      if (!body.name || !/^\S+@\S+\.\S+$/.test(body.email) || !body.date) { err.textContent = 'Merci de renseigner votre nom, un email valide et la date.'; return; }
      pay.disabled = true; pay.textContent = 'Redirection…';
      try {
        const r = await fetch('/.netlify/functions/early-late', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.url) throw new Error(d.error || 'Paiement indisponible pour le moment.');
        location.href = d.url;
      } catch (e) {
        err.textContent = e.message;
        pay.disabled = false; pay.textContent = 'Payer et confirmer';
      }
    });
  }
})();
