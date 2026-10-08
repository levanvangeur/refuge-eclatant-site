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
      <div class="hz-times" id="hzTimes" role="radiogroup" aria-label="Choix de l'heure"></div>
      <div class="hz-legend">Horaire habituel : ${std}h</div>
      <div class="hz-price empty" id="hzPrice"><div class="hz-detail">Choisissez une heure</div></div>
      <form class="hz-form" id="hzForm" novalidate>
        <label>Nom et prénom<input name="name" autocomplete="name" required></label>
        <label>Email (pour le reçu)<input name="email" type="email" autocomplete="email" required></label>
        <label>${isArr ? 'Date d\'arrivée' : 'Date de départ'}<input name="date" type="date" required></label>
        <div class="hz-err" id="hzErr" role="alert"></div>
        <button class="hz-pay" id="hzPay" type="submit" disabled>Payer et confirmer</button>
      </form>
      <p class="hz-note">Paiement sécurisé par carte via Stripe. La demande reste soumise à la disponibilité du logement : en cas d'impossibilité, vous êtes remboursé.</p>`;

    // ── Choix de l'heure : pastilles avec le prix ──
    const box = document.getElementById('hzTimes');
    const buttons = {};
    hours.forEach((h) => {
      const n = Math.abs(h - std);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hz-time';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.innerHTML = '<i class="hz-dot"></i><span class="hz-h">' + (isArr ? 'Arriver à ' : 'Partir à ') + h + 'h</span><em class="hz-p">+ ' + eur(n * cfg.pricePerHour) + '</em>';
      btn.addEventListener('click', () => pick(h));
      box.appendChild(btn);
      buttons[h] = btn;
    });

    const priceBox = document.getElementById('hzPrice'), pay = document.getElementById('hzPay'), err = document.getElementById('hzErr');
    function pick(h) {
      selected = h;
      Object.keys(buttons).forEach((k) => { const on = Number(k) === h; buttons[k].classList.toggle('sel', on); buttons[k].setAttribute('aria-checked', on); });
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
