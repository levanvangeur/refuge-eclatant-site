/* Page « services du séjour » : ménage en cours de séjour (créneau + paiement) et linge supplémentaire (quantité + paiement).
 * Le prix est recalculé côté serveur (netlify/functions/stay-service.js). */
(function () {
  'use strict';
  const root = document.getElementById('hz');
  const params = new URLSearchParams(location.search);
  const kind = params.get('type') === 'linge' ? 'linge' : 'menage';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = (n) => n.toLocaleString('fr-FR') + ' €';

  fetch('content.json', { cache: 'no-store' }).then((r) => r.json()).then(init).catch(() => {
    root.innerHTML = '<p class="hz-lead">Page momentanément indisponible.</p>';
  });

  function init(data) {
    const ss = data.stayServices || {};
    const aptName = (data.meta || {}).apartmentName || '';
    const isCl = kind === 'menage';
    const cfg = Object.assign(isCl
      ? { enabled: true, price: 40, slots: ['Matin (9h – 12h)', 'Après-midi (13h – 17h)'] }
      : { enabled: true, price: 10, maxQty: 6, contents: '2 oreillers, housse de couette, drap housse et 2 serviettes' }, (isCl ? ss.cleaning : ss.linen) || {});
    const title = isCl ? 'Ménage en cours de séjour' : 'Linge supplémentaire';
    document.title = title + ' — ' + aptName;

    if (params.get('paid') === '1') {
      root.innerHTML = `<div class="hz-ok"><div class="hz-star">✦</div>
        <h1>Merci, c'est réglé</h1>
        <p class="hz-lead">${isCl
          ? 'Votre demande de ménage est enregistrée : nous passerons sur le créneau choisi. Un reçu vous est envoyé par email.'
          : 'Votre demande de linge supplémentaire est enregistrée : il sera déposé dans le logement à la date choisie. Un reçu vous est envoyé par email.'}</p>
        <a class="hz-pay" style="display:inline-block;text-decoration:none" href="index.html">Retour au livret</a></div>`;
      return;
    }
    if (ss.enabled === false || cfg.enabled === false) { root.innerHTML = '<p class="hz-lead">Ce service n\'est pas proposé pour ce logement.</p>'; return; }

    const price = Number(cfg.price) || 0;
    const slots = (Array.isArray(cfg.slots) && cfg.slots.length) ? cfg.slots : ['Matin (9h – 12h)', 'Après-midi (13h – 17h)'];
    const maxQty = Math.max(1, Math.min(20, Number(cfg.maxQty) || 6));
    let slot = null, qty = 1;

    root.innerHTML = `
      <div class="hz-apt">${esc(aptName)}</div>
      <h1>${title}</h1>
      <p class="hz-lead">${isCl
        ? `Un ménage du logement pendant votre séjour, au tarif de ${eur(price)}. Choisissez le jour et le créneau qui vous conviennent.`
        : `Un jeu comprend : ${esc(cfg.contents || '')}. Tarif : ${eur(price)} par jeu. Choisissez le nombre de jeux et le jour de dépôt.`}</p>
      ${isCl ? `<div class="hz-times" id="hzSlots" role="radiogroup" aria-label="Choix du créneau"></div>`
        : `<div class="sv-qty" id="svQty"><button type="button" class="sv-step" id="svMinus" aria-label="Moins">−</button>
            <div class="sv-n"><b id="svN">1</b><span id="svUnit">jeu</span></div>
            <button type="button" class="sv-step" id="svPlus" aria-label="Plus">+</button></div>`}
      <div class="hz-price" id="hzPrice"></div>
      <form class="hz-form" id="hzForm" novalidate>
        <label>Nom et prénom<input name="name" autocomplete="name" required></label>
        <label>Email (pour le reçu)<input name="email" type="email" autocomplete="email" required></label>
        <label>${isCl ? 'Jour du ménage' : 'Jour de dépôt du linge'}<input name="date" type="date" required></label>
        <label>Précision (facultatif)<input name="note" maxlength="300" placeholder="${isCl ? 'Ex. je serai absent, accès libre' : 'Ex. à déposer dans la chambre'}"></label>
        <div class="hz-err" id="hzErr" role="alert"></div>
        <button class="hz-pay" id="hzPay" type="submit" ${isCl ? 'disabled' : ''}>Payer et confirmer</button>
      </form>
      <p class="hz-note">Paiement sécurisé par carte via Stripe. ${isCl ? 'La demande reste soumise à notre planning : en cas d\'impossibilité, vous êtes remboursé.' : 'En cas d\'impossibilité, vous êtes remboursé.'}</p>`;

    const priceBox = document.getElementById('hzPrice'), pay = document.getElementById('hzPay'), err = document.getElementById('hzErr');

    if (isCl) {
      priceBox.classList.add('empty');
      priceBox.innerHTML = '<div class="hz-detail">Choisissez un créneau</div>';
      const box = document.getElementById('hzSlots');
      const btns = slots.map((label, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'hz-time'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
        b.innerHTML = '<i class="hz-dot"></i><span class="hz-h">' + esc(label) + '</span><em class="hz-p">' + eur(price) + '</em>';
        b.addEventListener('click', () => {
          slot = i;
          btns.forEach((x, j) => { x.classList.toggle('sel', j === i); x.setAttribute('aria-checked', j === i); });
          priceBox.classList.remove('empty');
          priceBox.innerHTML = `<div class="hz-big">${eur(price)}</div><div class="hz-detail">Ménage complet du logement · ${esc(label)}</div>`;
          pay.disabled = false;
        });
        box.appendChild(b);
        return b;
      });
    } else {
      const n = document.getElementById('svN'), unit = document.getElementById('svUnit');
      const paint = () => {
        n.textContent = qty; unit.textContent = qty > 1 ? 'jeux' : 'jeu';
        priceBox.innerHTML = `<div class="hz-big">${eur(qty * price)}</div><div class="hz-detail">${qty} jeu${qty > 1 ? 'x' : ''} × ${eur(price)}</div>`;
        document.getElementById('svMinus').disabled = qty <= 1;
        document.getElementById('svPlus').disabled = qty >= maxQty;
      };
      document.getElementById('svMinus').addEventListener('click', () => { if (qty > 1) { qty--; paint(); } });
      document.getElementById('svPlus').addEventListener('click', () => { if (qty < maxQty) { qty++; paint(); } });
      paint();
    }

    const dateInput = document.querySelector('#hzForm [name=date]');
    const now = new Date();
    dateInput.min = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

    document.getElementById('hzForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      err.textContent = '';
      const f = new FormData(ev.target);
      const body = { kind, name: String(f.get('name') || '').trim(), email: String(f.get('email') || '').trim(), date: f.get('date'), note: String(f.get('note') || '').trim() };
      if (isCl) body.slot = slot; else body.qty = qty;
      if (isCl && slot == null) { err.textContent = 'Choisissez d\'abord un créneau.'; return; }
      if (!body.name || !/^\S+@\S+\.\S+$/.test(body.email) || !body.date) { err.textContent = 'Merci de renseigner votre nom, un email valide et la date.'; return; }
      pay.disabled = true; pay.textContent = 'Redirection…';
      try {
        const r = await fetch('/.netlify/functions/stay-service', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
