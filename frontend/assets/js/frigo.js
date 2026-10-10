/* Page « Boisson et snack » : liste des produits, empreinte de carte (Stripe) puis code du cadenas du frigo.
 * Le code n'est jamais dans content.json : il est renvoyé par netlify/functions/fridge.js une fois la carte validée. */
(function () {
  'use strict';
  const root = document.getElementById('fr');
  const params = new URLSearchParams(location.search);
  const KEY = 'frigoSid';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} },
    del() { try { localStorage.removeItem(KEY); } catch (e) {} },
  };
  const price = (p) => {
    const n = parseFloat(String(p).replace(',', '.').replace(/[^\d.]/g, ''));
    if (!isFinite(n)) return String(p || '');
    return n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
  };
  const getCode = async (sid) => {
    const r = await fetch('/.netlify/functions/fridge?sid=' + encodeURIComponent(sid), { cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.code) throw new Error(d.error || 'Code indisponible.');
    return d;
  };

  fetch('content.json', { cache: 'no-store' }).then((r) => r.json()).then(init).catch(() => {
    root.innerHTML = '<p class="hz-lead">Page momentanément indisponible.</p>';
  });

  function productsHtml(list) {
    return '<ul class="fr-list">' + list.map((p) =>
      `<li><span class="fr-name">${esc(p.name)}</span><span class="fr-dots"></span><b class="fr-price">${esc(price(p.price))}</b></li>`).join('') + '</ul>';
  }

  function showCode(code) {
    const m = document.createElement('div');
    m.className = 'fr-modal';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Code du frigo');
    m.innerHTML = `<div class="fr-modal-card">
      <div class="hz-star">✦</div>
      <h2>Votre frigo est ouvert</h2>
      <p class="fr-modal-lead">Voici le code du cadenas du frigo :</p>
      <div class="key-digits fr-digits" data-notranslate>${esc(code)}</div>
      <p class="fr-modal-note">Servez-vous. Votre consommation sera débitée à la fin de votre séjour sur la carte enregistrée. Pensez à refermer le cadenas après usage.</p>
      <button type="button" class="fr-ok">Merci, j'ai noté</button></div>`;
    document.body.appendChild(m);
    requestAnimationFrame(() => m.classList.add('show'));
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const close = () => { document.removeEventListener('keydown', onKey); m.classList.remove('show'); setTimeout(() => m.remove(), 300); };
    m.querySelector('.fr-ok').addEventListener('click', close);
    m.addEventListener('click', (e) => { if (e.target === m) close(); });
    document.addEventListener('keydown', onKey);
    m.querySelector('.fr-ok').focus();
  }

  async function init(data) {
    const cfg = data.fridge || {};
    const apt = (data.meta || {}).apartmentName || '';
    const list = (cfg.products || []).filter((p) => p && p.name);
    const title = cfg.title || 'Boisson et snack';
    document.title = title + ' — ' + apt;
    if (cfg.enabled === false || !list.length) { root.innerHTML = '<p class="hz-lead">Ce service n\'est pas proposé pour ce logement.</p>'; return; }

    const head = `<div class="hz-apt">${esc(apt)}</div><h1>${esc(title)}</h1>`;

    // Retour de Stripe : carte validée → on récupère le code
    const sid = params.get('ok') === '1' && params.get('sid') ? params.get('sid') : null;
    if (sid) {
      history.replaceState(null, '', 'frigo.html');
      root.innerHTML = head + '<p class="hz-lead">Validation de votre carte en cours…</p>';
      try {
        const d = await getCode(sid);
        store.set(sid);
        root.innerHTML = head + `<div class="hz-ok"><div class="hz-star">✦</div><h2 class="fr-h2">Empreinte validée, merci${d.guest ? ' ' + esc(String(d.guest).split(' ')[0]) : ''} !</h2>
          <p class="hz-lead">Aucun montant n'a été débité. Le code du frigo s'affiche dans la fenêtre ci-dessus.</p>
          <button type="button" class="hz-pay" id="frAgain">Revoir le code</button></div>
          <h3 class="fr-sub">Dans le frigo</h3>${productsHtml(list)}`;
        document.getElementById('frAgain').addEventListener('click', () => showCode(d.code));
        showCode(d.code);
      } catch (e) {
        root.innerHTML = head + `<div class="hz-ok"><p class="hz-lead">Nous n'avons pas pu confirmer votre empreinte (${esc(e.message)}). Si votre carte a été validée, contactez-nous : nous vous donnerons le code.</p>
          <a class="hz-pay" style="display:inline-block;text-decoration:none" href="frigo.html">Réessayer</a></div>`;
      }
      return;
    }

    // Visite suivante sur le même appareil : empreinte déjà validée récemment ?
    const saved = store.get();
    let again = '', savedCode = null;
    if (saved) {
      try {
        savedCode = (await getCode(saved)).code;
        again = '<div class="fr-already"><span>Frigo déjà débloqué sur cet appareil.</span><button type="button" class="fr-link" id="frAgain">Revoir le code</button></div>';
      } catch (e) { store.del(); }
    }

    root.innerHTML = head + `<p class="hz-lead">${esc(cfg.intro || 'Un petit creux ou une petite soif ? Le frigo du logement est à votre disposition.')}</p>
      ${again}
      <h3 class="fr-sub">Dans le frigo</h3>${productsHtml(list)}
      <ol class="fr-steps">
        <li><b>1</b><span>Vous validez une <strong>empreinte de carte bancaire</strong> : rien n'est débité maintenant.</span></li>
        <li><b>2</b><span>Le <strong>code du cadenas</strong> s'affiche aussitôt : servez-vous.</span></li>
        <li><b>3</b><span><strong>À la fin de votre séjour</strong>, seule votre consommation est débitée sur la carte.</span></li>
      </ol>
      <form class="hz-form" id="frForm" novalidate>
        <label>Nom et prénom<input name="name" autocomplete="name" required></label>
        <label>Email (pour le reçu)<input name="email" type="email" autocomplete="email" required></label>
        <label class="fr-check"><input type="checkbox" name="ok" required><span>J'autorise la prise d'une empreinte de ma carte et le débit, à la fin de mon séjour, des produits que j'aurai consommés au tarif affiché.</span></label>
        <div class="hz-err" id="frErr" role="alert"></div>
        <button class="hz-pay fr-open" id="frGo" type="submit">Ouvrir le frigo</button>
      </form>
      <p class="hz-note">Paiement sécurisé par carte via Stripe : nous ne voyons ni ne conservons vos numéros de carte.</p>`;

    const againBtn = document.getElementById('frAgain');
    if (againBtn && savedCode) againBtn.addEventListener('click', () => showCode(savedCode));

    document.getElementById('frForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const err = document.getElementById('frErr'), go = document.getElementById('frGo');
      err.textContent = '';
      const f = new FormData(ev.target);
      const body = { name: String(f.get('name') || '').trim(), email: String(f.get('email') || '').trim() };
      if (!body.name || !/^\S+@\S+\.\S+$/.test(body.email)) { err.textContent = 'Merci de renseigner votre nom et un email valide.'; return; }
      if (!f.get('ok')) { err.textContent = 'Merci de cocher l\'autorisation pour continuer.'; return; }
      go.disabled = true; go.textContent = 'Redirection…';
      try {
        const r = await fetch('/.netlify/functions/fridge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.url) throw new Error(d.error || 'Service indisponible pour le moment.');
        location.href = d.url;
      } catch (e) {
        err.textContent = e.message;
        go.disabled = false; go.textContent = 'Ouvrir le frigo';
      }
    });
  }
})();
