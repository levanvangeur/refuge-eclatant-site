/* ────────────────────────────────────────────────────────────
   Livret d'accueil — moteur de rendu (lit content.json)
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const el = (id) => document.getElementById(id);

  // Lien « voir sur la carte » (recherche Google Maps à partir du nom/adresse).
  function mapsLink(query, label) {
    if (!query) return '';
    return `<a class="map-link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}" target="_blank" rel="noopener">${esc(label)}</a>`;
  }

  // Lien de discussion WhatsApp à partir d'un numéro français (0X… → +33X…).
  function waLink(phone) {
    const digits = String(phone || '').replace(/[^\d]/g, '');
    if (!digits) return '';
    const intl = digits.charAt(0) === '0' ? '33' + digits.slice(1) : digits;
    return `<a class="icon-btn wa-btn" href="https://wa.me/${intl}" target="_blank" rel="noopener" aria-label="WhatsApp">`
      + `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12.04 2c-5.46 0-9.9 4.43-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.43 9.9-9.9 0-2.64-1.03-5.12-2.9-6.98A9.82 9.82 0 0 0 12.04 2zm5.8 14.16c-.24.68-1.4 1.32-1.93 1.4-.5.08-1.11.11-1.79-.11a15 15 0 0 1-1.62-.6c-2.86-1.24-4.72-4.14-4.86-4.33-.14-.19-1.16-1.55-1.16-2.95 0-1.4.73-2.09 1-2.38.26-.28.57-.35.76-.35h.55c.18 0 .42-.03.64.5.24.57.8 1.98.87 2.12.07.15.12.32.02.51-.1.19-.15.31-.29.48-.14.17-.3.37-.43.5-.14.14-.29.29-.13.57.17.28.74 1.24 1.6 2 1.1.98 2.03 1.29 2.31 1.44.28.14.44.12.6-.07.17-.19.72-.84.91-1.13.19-.28.38-.24.64-.14.26.09 1.65.78 1.93.92.28.14.47.21.54.33.07.12.07.68-.17 1.36z"/></svg>`
      + `</a>`;
  }

  // Bouton « Appeler » (ouvre l'appli téléphone du voyageur).
  function callLink(phone) {
    const digits = String(phone || '').replace(/[^+\d]/g, '');
    if (!digits) return '';
    return `<a class="icon-btn call-btn" href="tel:${digits}" aria-label="Appeler">`
      + `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v2.6a2 2 0 0 1-2.2 2 19.4 19.4 0 0 1-8.4-3 19.1 19.1 0 0 1-5.9-5.9 19.4 19.4 0 0 1-3-8.4A2 2 0 0 1 4.5 2h2.6a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2.2z"/></svg>`
      + `</a>`;
  }

  // Catégories du corps du livret (id de contenu → générateur de section).
  // L'ordre par défaut ci-dessous peut être remplacé par data.sectionOrder
  // (modifiable depuis l'éditeur, bouton ↑ / ↓ sur chaque catégorie).
  const SECTIONS = {
    practical: (d, alt) => practical(d.practical, alt, d.earlyLate, d.stayServices),
    included: (d, alt) => included((d.welcome || {}).included, alt),
    booking: (d) => bookingSection(d.meta),
    fridge: (d, alt) => fridge(d.fridge, alt),
    welcome: (d, alt) => welcome(d.welcome, alt),
    comfort: (d, alt) => comfort(d.comfort, alt),
    rules: (d, alt) => rules(d.rules, alt),
    departure: (d, alt) => departure(d.departure, alt),
    discover: (d, alt) => placesSection('decouvrir', 'À deux pas de chez vous', 'Découvrir ' + ((d.meta || {}).city || ''), d.discover, (d.meta || {}).city, alt),
    eat: (d, alt) => directory('manger', 'Nos recommandations', 'Où manger', d.eat, (d.meta || {}).city, alt),
    drinks: (d, alt) => directory('boire', 'Se régaler', 'Bars & gourmandises', d.drinks, (d.meta || {}).city, alt),
    services: (d, alt) => directory('services', 'Bien pratique', 'Services & locations', d.services, (d.meta || {}).city, alt),
    shops: (d, alt) => directory('commerces', 'Le quotidien', 'Commerces & courses', d.shops, (d.meta || {}).city, alt),
    escapes: (d, alt) => placesSection('escapades', 'Une journée d\'escapade', 'Grandes escapades', d.escapes, (d.meta || {}).city, alt),
    numbers: (d, alt) => numbers(d.numbers, alt),
    reviews: (d, alt) => reviewsSection(d.reviews, alt),
    goodbye: (d, alt) => goodbye(d.goodbye, d.meta, alt),
  };

  // Ordre par défaut si data.sectionOrder est absent ou incomplet.
  const DEFAULT_ORDER = ['booking', 'practical', 'included', 'fridge', 'welcome', 'comfort', 'rules', 'departure',
    'discover', 'eat', 'drinks', 'services', 'shops', 'escapes',
    'numbers', 'reviews', 'goodbye'];

  // Libellés de navigation (id de contenu → [ancre, libellé]).
  const NAV_LABELS = {
    practical: ['pratique', 'Pratique'],
    fridge: ['frigo', 'Boissons & snacks'],
    comfort: ['logement', 'Le logement'],
    rules: ['regles', 'Règles'],
    departure: ['depart', 'Avant le départ'],
    discover: ['decouvrir', 'Découvrir'],
    eat: ['manger', 'Où manger'],
    drinks: ['boire', 'Gourmandises'],
    services: ['services', 'Services'],
    escapes: ['escapades', 'Escapades'],
    numbers: ['numeros', 'Numéros utiles'],
    reviews: ['avis', 'Avis des voyageurs'],
  };

  function resolveOrder(saved) {
    const order = (Array.isArray(saved) ? saved : []).filter((id) => SECTIONS[id]);
    // Le bouton « Réservez… » était dans l'en-tête : s'il manque dans l'ordre enregistré, il reste tout en haut.
    DEFAULT_ORDER.forEach((id) => { if (order.indexOf(id) === -1) { if (id === 'booking') order.unshift(id); else order.push(id); } });
    return order;
  }

  fetch('content.json', { cache: 'no-store' })
    .then((r) => r.json())
    .then(render)
    .catch((err) => {
      el('app').innerHTML = '<div class="container" style="padding:120px 0;text-align:center">'
        + '<h1 class="section-title">Contenu indisponible</h1>'
        + '<p class="lead">Impossible de charger le livret. ' + esc(err.message) + '</p></div>';
    });

  function render(data) {
    const m = data.meta || {};
    document.documentElement.lang = 'fr';
    const order = resolveOrder(data.sectionOrder);

    // ── Marque / logo ──
    if (m.logo) { el('navLogo').src = m.logo; } else { el('navLogo').style.display = 'none'; }
    el('navName').textContent = m.apartmentName || 'Livret d\'accueil';

    // ── CTA réservation fixée dans le menu ──
    const navCta = el('navCta');
    if (navCta) {
      if (m.bookingUrl) { navCta.href = m.bookingUrl; navCta.classList.add('show'); }
      else { navCta.classList.remove('show'); }
    }

    // ── Navigation ──
    const nav = [['bienvenue', 'Bienvenue']];
    order.forEach((id) => { const lab = NAV_LABELS[id]; if (lab && SECTIONS[id](data, '')) nav.push(lab); }); // pas de lien vers une rubrique vide
    el('navLinks').innerHTML = nav.map(([id, label]) =>
      `<a href="#${id}" data-nav="${id}">${esc(label)}</a>`).join('');

    // ── Corps ──
    const parts = [hero(m, data.banner)];
    let alt = false;
    order.forEach((id) => {
      const html = SECTIONS[id](data, alt ? 'alt' : '');
      if (html) { parts.push(html); if (id !== 'booking') alt = !alt; }
    });
    el('app').innerHTML = parts.filter(Boolean).join('');

    // ── Pied de page ──
    el('app').insertAdjacentHTML('beforeend', footer(data));

    setupInteractions(data, nav);
    setupAccordions();
    setupBanner();
    if (window.I18N) window.I18N.init();
    polish();
    if (window.btnFx) window.btnFx();
    jumpToHash();
  }

  // Lien direct vers une section (ex. QR code « …/#frigo ») : le contenu est généré après le chargement,
  // le navigateur ne trouve donc pas l'ancre tout seul. On saute à la section une fois la page construite,
  // et une 2e fois quand les images sont chargées (la mise en page peut bouger), sauf si le visiteur a déjà défilé.
  function jumpToHash() {
    const id = decodeURIComponent((location.hash || '').slice(1));
    if (!id) return;
    let moved = false;
    ['wheel', 'touchmove', 'keydown', 'mousedown'].forEach((ev) => window.addEventListener(ev, () => { moved = true; }, { once: true, passive: true }));
    const go = () => {
      const t = document.getElementById(id);
      if (!t || moved) return;
      const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10) || 64;
      // QR du frigo (#frigo) : on amène directement le bouton « Ouvrir le frigo » au milieu de l'écran
      const btn = id === 'frigo' ? t.querySelector('.fr-btn') : null;
      const r = (btn || t).getBoundingClientRect();
      const y = btn
        ? r.top + window.scrollY + r.height / 2 - (window.innerHeight / 2 + navH / 2)
        : r.top + window.scrollY - navH;
      window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
    };
    requestAnimationFrame(go);
    window.addEventListener('load', () => setTimeout(go, 150), { once: true });
    setTimeout(go, 1200);
  }

  /* ───────────────── Sections ───────────────── */

  // Fluidité : les boutons animés se mettent en pause quand ils ne sont pas à l'écran
  function polish() {
    if (!('IntersectionObserver' in window)) return;
    const po = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.target.classList.toggle('is-off', !e.isIntersecting));
    }, { rootMargin: '120px' });
    document.querySelectorAll('.hero-cta, .nav-cta, .el-btn, .fr-btn, .kv-actions .icon-btn').forEach((n) => po.observe(n));
  }

  function hero(m, bn) {
    return `
    <a id="top"></a>
    <header class="hero" id="bienvenue">
      <div class="hero-content reveal">
        ${m.logo ? `<img class="logo" src="${esc(m.logo)}" alt="${esc(m.apartmentName)}" />` : ''}
        ${m.city ? `<div class="cov-kicker" data-notranslate>${esc(m.city)}</div>` : ''}
        <h1 data-notranslate>${esc(m.apartmentName || '')}</h1>
        ${banner(bn, m)}
        <div class="hero-rule"></div>
        ${m.tagline ? `<p class="cov-sub-tag">${esc(m.tagline)}</p>` : (m.motto ? `<p class="cov-sub-tag">« ${esc(m.motto)} »</p>` : '')}
        <p class="hero-welcome">Bienvenue, gérez votre séjour depuis cette interface</p>
      </div>
    </header>`;
  }

  // Bandeau photos du logement sous le titre (fondu lent, points cliquables, balayage au doigt)
  function banner(b, m) {
    const imgs = ((b && b.images) || []).filter(Boolean);
    if (!imgs.length) return '';
    return `<div class="cin-wrap reveal">
      <div class="cin">
        ${imgs.map((src, i) => `<img class="cin-sl${i === 0 ? ' on' : ''}" src="${esc(src)}" alt="${esc((m && m.apartmentName) || '')}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />`).join('')}
        ${b.caption ? `<span class="cin-cap">${esc(b.caption)}</span>` : ''}
      </div>
      ${imgs.length > 1 ? `<div class="cin-dots">${imgs.map((_, i) => `<button type="button" class="${i === 0 ? 'on' : ''}" aria-label="Photo ${i + 1}"></button>`).join('')}</div>` : ''}
    </div>`;
  }

  function setupBanner() {
    const w = document.querySelector('.cin-wrap');
    if (!w) return;
    const sl = Array.from(w.querySelectorAll('.cin-sl')), dots = Array.from(w.querySelectorAll('.cin-dots button'));
    if (sl.length < 2) return;
    let cur = 0, timer = null;
    const go = (i) => {
      cur = (i + sl.length) % sl.length;
      sl.forEach((x, k) => x.classList.toggle('on', k === cur));
      dots.forEach((d, k) => d.classList.toggle('on', k === cur));
    };
    const stop = () => { clearInterval(timer); timer = null; };
    const start = () => {
      stop();
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      timer = setInterval(() => go(cur + 1), 5500);
    };
    dots.forEach((d, k) => d.addEventListener('click', () => { go(k); start(); }));
    let x0 = null;
    w.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    w.addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { go(cur + (dx < 0 ? 1 : -1)); start(); }
    }, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
    start();
  }

  // Bouton « Réservez votre prochain séjour » : catégorie déplaçable comme les autres (id 'booking' dans sectionOrder)
  function bookingSection(m) {
    if (!m || !m.bookingUrl) return '';
    return `<section class="block booking-block" id="reservation"><div class="container">
      <div class="hero-cta-wrap reveal"><a href="${esc(m.bookingUrl)}" class="hero-cta" target="_blank" rel="noopener">Réservez votre prochain séjour</a></div>
    </div></section>`;
  }

  // Icônes du bloc « Tout est inclus » (mêmes pictos que le site de réservation)
  const INCLUDED_ICONS = [
    '<rect x="4" y="6" width="16" height="12" rx="1.5"/><path d="M4 11h16M9 6v5"/>',
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    '<path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9zM16 10h1.5a2 2 0 0 1 0 4H16M8 4v2M12 4v2"/>',
  ];
  function included(items, alt) {
    if (!Array.isArray(items) || !items.length) return '';
    return section('inclus', 'Dans chaque logement', 'Tout est inclus', `
      <div class="grid cols-3 inc-grid">${items.map((it, i) => `
        <div class="card inc-card reveal">
          <svg class="inc-ico" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${INCLUDED_ICONS[i % INCLUDED_ICONS.length]}</svg>
          <h4>${esc(it.title)}</h4>
          <p>${esc(it.detail || '')}</p>
        </div>`).join('')}
      </div>`, alt);
  }

  function welcome(w, alt) {
    if (!w) return '';
    return sectionWrap('', false, `
      <div class="kicker">Un mot pour vous</div>
      <h2 class="section-title">${esc(w.title || 'Bienvenue')}</h2>
      <div class="title-rule"></div>
      <div style="max-width:760px;margin:0 auto;text-align:center">
        ${(w.paragraphs || []).map((p) => `<p class="lead" style="margin-bottom:20px">${esc(p)}</p>`).join('')}
        ${w.signature ? `<p class="serif" style="font-style:italic;font-size:1.3rem;color:var(--gold-dark);margin-top:10px">${esc(w.signature)}</p>` : ''}
      </div>`, alt);
  }

  // Bouton « arrivée anticipée » / « départ tardif » affiché sous l'horaire correspondant
  function earlyLateBtn(e, type) {
    if (!e || e.enabled === false) return '';
    const price = Number(e.pricePerHour) || 0;
    const arr = type === 'arrivee';
    const note = (arr ? 'dès ' + e.earliestArrival + 'h' : 'jusqu\'à ' + e.latestDeparture + 'h') + ' · ' + price + ' € par heure supplémentaire';
    return `<div class="el-inline"><a class="el-btn sm" href="horaires.html?type=${type}">${arr ? 'Arrivée anticipée' : 'Départ tardif'}</a>
      <div class="el-cap">${esc(note)}</div></div>`;
  }

  // Bouton d'un service du séjour (ménage / linge) : même famille que arrivée anticipée / départ tardif
  function stayBtn(ss, key, type, label, note) {
    if (!ss || ss.enabled === false) return '';
    const c = ss[key] || {};
    if (c.enabled === false || !(Number(c.price) > 0)) return '';
    return `<div class="el-inline"><a class="el-btn sm" href="services.html?type=${type}">${label}</a>
      <div class="el-cap">${esc(note(c))}</div></div>`;
  }

  function stayCard(ss) {
    const eur = (n) => Number(n).toLocaleString('fr-FR') + ' €';
    const a = stayBtn(ss, 'cleaning', 'menage', 'Demander un ménage', (c) => 'Ménage complet du logement · ' + eur(c.price));
    const b = stayBtn(ss, 'linen', 'linge', 'Draps supplémentaires', (c) => 'Jeu complet · ' + eur(c.price) + ' le jeu');
    if (!a && !b) return '';
    return `<div class="card info-card reveal">
          <h3>${esc((ss && ss.title) || 'Services du séjour')}</h3>
          ${ss && ss.intro ? `<p class="lead" style="margin:0 0 14px;text-align:left">${esc(ss.intro)}</p>` : ''}
          ${a}${b}
        </div>`;
  }

  function practical(pr, alt, el, ss) {
    if (!pr) return '';
    const wifi = pr.wifi || {}, ar = pr.arrival || {}, ad = pr.address || {}, as = pr.assistance || {};
    const kv = (k, v) => v ? `<div class="kv"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>` : '';
    return section('pratique', '', 'Informations pratiques', `
      <div class="grid cols-2">
        <div class="card info-card reveal">
          <h3>Remise des clés</h3>
          ${ar.keys ? `<div class="kv"><div class="v">${esc(ar.keys)}</div></div>` : ''}
          ${ar.keyboxCode ? `<div class="key-reveal">
            <button class="el-btn sm" type="button" data-keybox-btn>Obtenir le code de la boîte à clés</button>
            <div class="key-code" data-notranslate hidden><div class="co-label">Code de la boîte à clés</div><div class="key-digits">${esc(ar.keyboxCode)}</div></div>
          </div>` : ''}
        </div>
        <div class="card info-card reveal">
          <h3>Adresse &amp; accès</h3>
          ${ad.full ? `<div class="kv"><div class="k">Adresse</div><div class="v">${esc(ad.full)} ${mapsLink(ad.full, 'Voir sur la carte')}</div></div>` : ''}
          ${kv('Étage / porte', ad.floor)}
          ${kv('Code immeuble', ad.buildingCode)}
          ${kv('Stationnement', ad.parking)}
        </div>
        <div class="card info-card reveal">
          <h3>Arrivée &amp; départ</h3>
          ${kv('Arrivée', ar.checkIn)}
          ${earlyLateBtn(el, 'arrivee')}
          ${kv('Départ', ar.checkOut)}
          ${earlyLateBtn(el, 'depart')}
        </div>
        ${stayCard(ss)}
        <div class="callout reveal">
          <div class="co-label">Connexion Wi-Fi</div>
          <div class="co-row"><div><div class="co-label">Réseau</div><div class="co-big" data-notranslate>${esc(wifi.network || '—')}</div></div></div>
          <div class="co-row"><div><div class="co-label">Mot de passe</div><div class="co-big" data-notranslate>${esc(wifi.password || '—')}</div></div>
            <button class="copy-btn" data-copy="${esc(wifi.password || '')}" data-notranslate>Copier</button></div>
        </div>
        <div class="card info-card reveal">
          <h3>Assistance</h3>
          ${(as.phones || []).map((p, i) => p ? `<div class="kv"><div class="k">Téléphone ${i + 1}</div><div class="v" data-notranslate>${esc(p)}</div><div class="kv-actions">${callLink(p)}${waLink(p)}</div></div>` : '').join('')}
          ${kv('Disponibilité', as.availability)}
        </div>
      </div>`, alt);
  }

  function comfort(c, alt) {
    if (!c) return '';
    return section('logement', 'Le confort', 'Votre logement', `
      ${c.intro ? `<p class="lead">${esc(c.intro)}</p>` : ''}
      <div class="grid cols-2">
        ${(c.sections || []).map((s) => `
          <div class="card info-card reveal">
            <h3>${esc(s.title)}</h3>
            <ul class="diamond">${(s.items || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
          </div>`).join('')}
      </div>`, alt);
  }

  function gallery(g, alt) {
    if (!g || !(g.rooms || []).length) return '';
    const rooms = g.rooms.map((room, ri) => {
      const imgs = (room.images || []).filter(Boolean);
      return `
      <div class="room reveal">
        <div class="room-head"><h3>${esc(room.name)}</h3><div class="line"></div></div>
        ${(room.equipment || []).length ? `<div class="room-eq">${room.equipment.map((e) => `<span>${esc(e)}</span>`).join('')}</div>` : ''}
        ${imgs.length
          ? `<div class="room-imgs">${imgs.map((src, ii) => `<img src="${esc(src)}" alt="${esc(room.name)}" data-room="${ri}" data-idx="${ii}" loading="lazy" decoding="async" />`).join('')}</div>`
          : `<div class="room-empty">Photos à venir.</div>`}
      </div>`;
    }).join('');
    return section('galerie', 'Visite en images', 'Le logement pièce par pièce', `
      ${g.intro ? `<p class="lead">${esc(g.intro)}</p>` : ''}${rooms}`, alt);
  }

  function rules(r, alt) {
    if (!r) return '';
    return section('regles', 'Pour le bien de tous', 'Règles de la maison', `
      <div class="card info-card reveal">
        <h3>Le respect des lieux</h3>
        <ul class="diamond">${(r.respect || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      </div>`, alt);
  }

  function departure(dep, alt) {
    if (!dep) return '';
    return section('depart', 'Dernière ligne droite', dep.title || 'Avant votre départ', `
      ${dep.intro ? `<p class="lead">${esc(dep.intro)}</p>` : ''}
      <div class="card info-card reveal">
        <ul class="diamond">${(dep.items || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      </div>
      ${dep.thanks ? `<div class="card info-card reveal" style="margin-top:22px;text-align:center;border-color:var(--gold-light)">
        <h3 style="text-align:center">Merci !</h3><p class="lead" style="margin:0">${esc(dep.thanks)}</p></div>` : ''}`, alt);
  }

  // Sous-catégorie dépliable (flèche ▾). Fermée par défaut ; excl = une seule ouverte à la fois dans la rubrique.
  const CHEV = '<svg class="acc-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  function acc(title, count, inner, opts) {
    opts = opts || {};
    return `<div class="acc reveal${opts.place ? ' acc-place' : ''}"${opts.excl ? ' data-excl="1"' : ''}>
      <button class="acc-head" type="button" aria-expanded="false">
        <span class="acc-t">${esc(title)}</span>
        <span class="acc-r">${count ? `<span class="acc-n" data-notranslate>${count}</span>` : ''}${CHEV}</span>
      </button>
      <div class="acc-panel"><div class="acc-in"><div class="acc-body">${inner}</div></div></div>
    </div>`;
  }

  function setupAccordions() {
    document.querySelectorAll('.acc-head').forEach((btn) => btn.addEventListener('click', () => {
      const a = btn.parentElement;
      const willOpen = !a.classList.contains('open');
      if (willOpen && a.dataset.excl) {
        a.closest('.container').querySelectorAll('.acc.open[data-excl]').forEach((o) => {
          o.classList.remove('open'); o.querySelector('.acc-head').setAttribute('aria-expanded', 'false');
        });
      }
      a.classList.toggle('open', willOpen);
      btn.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) setTimeout(() => {
        const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'), 10) || 64;
        const top = a.getBoundingClientRect().top;
        if (top < navH + 8) window.scrollTo({ top: top + window.scrollY - navH - 12, behavior: 'smooth' });
      }, 380);
    }));
  }

  function placesSection(id, kick, title, block, cityHint, alt) {
    if (!block || !(block.places || []).length) return '';
    return section(id, kick, title, `
      ${block.intro ? `<p class="lead">${esc(block.intro)}</p>` : ''}
      ${block.places.map((p) => acc(p.name, '', placeHTML(p, cityHint, true), { place: true })).join('')}`, alt ? 'alt' : '');
  }

  function placeHTML(p, cityHint, bare) {
    const mapQuery = [p.name, p.city || cityHint].filter(Boolean).join(', ');
    return `<div class="place">
      ${bare ? '' : `<h3>${esc(p.name)}</h3>`}
      ${p.desc ? `<p>${esc(p.desc)}</p>` : ''}
      ${p.meta ? `<div class="meta">${esc(p.meta)}</div>` : ''}
      ${mapsLink(mapQuery, 'Voir sur la carte')}
    </div>`;
  }

  function dirItem(it, cityHint) {
    const text = [];
    if (it.address) text.push(esc(it.address));
    if (it.phone) text.push(`<span class="tel" data-notranslate>${esc(it.phone)}</span>`);
    const mapQuery = [it.name, it.address, cityHint].filter(Boolean).join(', ');
    const map = mapsLink(mapQuery, 'Voir sur la carte');
    if (map) text.push(map);
    const actions = it.phone ? callLink(it.phone) : '';
    return `<div class="dir-item">
      <div class="n">${esc(it.name)}${it.type ? `<small>${esc(it.type)}</small>` : ''}</div>
      <div class="a"><span>${text.join(' · ')}</span>${actions}</div>
    </div>`;
  }

  function directory(id, kick, title, block, cityHint, alt) {
    if (!block || !(block.groups || []).length) return '';
    return section(id, kick, title, `
      ${block.intro ? `<p class="lead">${esc(block.intro)}</p>` : ''}
      ${block.groups.map((grp) => acc(grp.title, (grp.items || []).length,
        (grp.items || []).map((it) => dirItem(it, cityHint)).join(''), { excl: true })).join('')}`, alt);
  }

  function numbers(n, alt) {
    if (!n) return '';
    const cards = (arr) => (arr || []).map((x) => `
      <div class="phone-card">
        <div class="pl">${esc(x.label)}</div>
        <div class="pn" data-notranslate>${x.number ? esc(x.number) : '—'}</div>
        ${x.number ? callLink(x.number) : ''}
      </div>`).join('');
    return section('numeros', 'En cas de besoin', 'Numéros utiles', `
      <div class="grid cols-2">
        <div class="reveal"><div class="group-title">Urgences</div><div class="phones">${cards(n.emergency)}</div></div>
        <div class="reveal"><div class="group-title">Au quotidien</div><div class="phones">${cards(n.daily)}</div></div>
      </div>`, alt);
  }

  function goodbye(g, m, alt) {
    if (!g) return '';
    m = m || {};
    const reviewLinks = [
      ['reviewUrlBooking', 'Avis sur Booking.com', 'platform-btn platform-btn--booking'],
      ['reviewUrlAirbnb', 'Avis sur Airbnb', 'platform-btn platform-btn--airbnb'],
    ].filter(([key]) => m[key]);
    const reviewButtons = reviewLinks.length ? `
      <div class="review-cta-wrap">
        ${reviewLinks.map(([key, label, cls]) => `<a href="${esc(m[key])}" class="${cls}" target="_blank" rel="noopener">${esc(label)}</a>`).join('')}
      </div>` : '';
    return sectionWrap('', false, `
      <div class="kicker">À bientôt</div>
      <h2 class="section-title">${esc(g.title || 'Merci')}</h2>
      <div class="title-rule"></div>
      <p class="lead">${esc(g.text || '')}</p>
      ${reviewButtons}
      <div style="text-align:center;color:var(--gold);letter-spacing:.4em;margin-top:10px">✦ ✦ ✦</div>`, alt);
  }

  function reviewsSection(r, alt) {
    if (!r || !(r.items || []).length) return '';
    const cards = r.items.map((rv) => `
      <div class="review-card reveal">
        ${rv.score ? `<div class="review-score">${esc(rv.score)}<span>/10</span></div>` : ''}
        <p class="review-text">${esc(rv.text)}</p>
        <div class="review-author">${esc(rv.author || '')}${rv.country ? ` · ${esc(rv.country)}` : ''}</div>
      </div>`).join('');
    return section('avis', 'Ils ont séjourné ici', r.title || 'Avis des voyageurs', `
      ${r.intro ? `<p class="lead">${esc(r.intro)}</p>` : ''}
      <div class="grid cols-3">${cards}</div>
      ${r.source ? `<p class="review-source">Avis vérifiés sur ${esc(r.source)}.</p>` : ''}`, alt);
  }

  function footer(data) {
    const m = data.meta || {}, as = (data.practical || {}).assistance || {}, ad = (data.practical || {}).address || {};
    const phones = (as.phones || []).map((p) => `<a href="tel:${esc(p.replace(/[^+0-9]/g, ''))}" data-notranslate>${esc(p)}</a>`).join('');
    return `<footer class="footer">
      <div class="container">
        <div class="fstars">✦ ✦ ✦</div>
        <h4 data-notranslate>${esc(m.apartmentName || '')}</h4>
        <p>${esc(m.motto ? '« ' + m.motto + ' »' : '')}</p>
        <div class="fcontact">
          ${ad.full ? `<span>⚑ ${esc(ad.full)}</span>` : ''}
          ${phones}
        </div>
        <div class="fcopy">© ${new Date().getFullYear()} ${esc(m.apartmentName || '')} — ${esc(m.city || '')}. Tous droits réservés.</div>
      </div>
    </footer>`;
  }

  /* ───────────────── Helpers de mise en page ───────────────── */
  // Boissons et snacks : liste du frigo + bouton « Ouvrir le frigo » (empreinte de carte → code du cadenas, voir frigo.html)
  function fridge(f, alt) {
    if (!f || f.enabled === false) return '';
    // Logements où le frigo n'est pas encore installé : simple mention « Coming soon »
    if (f.comingSoon) {
      return section('frigo', 'Une petite envie ?', f.title || 'Boissons et snacks', `
        <div class="fr-card fr-soon-card reveal"><p class="fr-soon">${esc(f.soonText || 'Coming soon')}</p></div>`, alt);
    }
    const list = (f.products || []).filter((p) => p && p.name);
    if (!list.length) return '';
    const fmt = (v) => {
      const n = parseFloat(String(v).replace(',', '.').replace(/[^0-9.]/g, ''));
      return isFinite(n) ? n.toLocaleString('fr-FR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €' : String(v || '');
    };
    return section('frigo', 'Une petite envie ?', f.title || 'Boissons et snacks', `
      <div class="fr-card reveal">
        <p class="fr-intro">${esc(f.intro || 'Un petit creux ou une petite soif ? Le frigo du logement est à votre disposition, fermé par un cadenas à code.')}</p>
        <div class="fr-box"><ul class="fr-list">${list.map((p) =>
          `<li><span class="fr-name">${esc(p.name)}</span><span class="fr-dots"></span><b class="fr-price" data-notranslate>${esc(fmt(p.price))}</b></li>`).join('')}</ul></div>
        <div class="fr-cta-wrap"><a class="fr-btn" href="frigo.html">Ouvrir le frigo</a></div>
        <p class="fr-note">Une empreinte de carte bancaire suffit : rien n'est débité maintenant, seule votre consommation l'est à la fin de votre séjour.</p>
      </div>`, alt);
  }

  function section(id, kicker, title, inner, extra) {
    return `<section class="block ${extra || ''}" id="${id}">
      <div class="container">
        ${kicker ? '<div class="kicker sig">' + esc(kicker) + '</div>' : ''}
        <h2 class="section-title sig">${esc(title)}</h2>
        <div class="title-rule sig"></div>
        ${inner}
      </div>
    </section>`;
  }
  function sectionWrap(id, _n, inner, extra) {
    return `<section class="block ${extra || ''}"${id ? ` id="${id}"` : ''}>
      <div class="container">${inner}</div></section>`;
  }

  /* ───────────────── Interactions ───────────────── */
  function setupInteractions(data, nav) {
    // Code de la boîte à clés : affiché au clic
    // Le code peut être modifié à distance depuis l'espace privé (admin.logementsparay.fr) : on le relit au clic,
    // et on retombe sur le code du content.json si le service ne répond pas.
    document.querySelectorAll('[data-keybox-btn]').forEach((btn) => btn.addEventListener('click', async () => {
      const code = btn.parentElement.querySelector('.key-code');
      if (!code) return;
      const digits = code.querySelector('.key-digits');
      const fallback = digits ? digits.textContent : '';
      code.hidden = false; btn.hidden = true;
      if (!digits) return;
      digits.textContent = '···';
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
        const slug = location.hostname.split('.')[0];
        const r = await fetch('https://admin.logementsparay.fr/.netlify/functions/codes?apt=' + encodeURIComponent(slug), { cache: 'no-store', signal: ctrl.signal });
        clearTimeout(timer);
        const d = r.ok ? await r.json() : {};
        digits.textContent = d.keybox || fallback;
      } catch (e) { digits.textContent = fallback; }
    }));

    // Menu mobile
    const toggle = el('navToggle'), links = el('navLinks');
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    links.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => links.classList.remove('open')));

    // Copier (wifi)
    document.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-copy');
        navigator.clipboard && navigator.clipboard.writeText(val).then(() => {
          const old = btn.textContent; btn.textContent = 'Copié ✓';
          setTimeout(() => { btn.textContent = old; }, 1400);
        });
      });
    });

    // Bouton haut de page
    const toTop = el('toTop');
    let topTick = false;
    window.addEventListener('scroll', () => {
      if (topTick) return;
      topTick = true;
      requestAnimationFrame(() => { toTop.classList.toggle('show', window.scrollY > 600); topTick = false; });
    }, { passive: true });
    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // Reveal on scroll
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.08 });
    // Cascade : décalage selon le rang parmi les frères .reveal
    document.querySelectorAll('.reveal').forEach((n) => {
      const sibs = Array.from(n.parentElement.children).filter((c) => c.classList.contains('reveal'));
      n.style.setProperty('--d', Math.min(sibs.indexOf(n), 6));
    });
    document.querySelectorAll('.reveal, .sig').forEach((n) => io.observe(n));

    // Nav active
    const navMap = {};
    document.querySelectorAll('[data-nav]').forEach((a) => navMap[a.getAttribute('data-nav')] = a);
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          Object.values(navMap).forEach((a) => a.classList.remove('active'));
          const a = navMap[e.target.id]; if (a) a.classList.add('active');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    nav.forEach(([id]) => { const s = el(id); if (s) spy.observe(s); });

    setupLightbox(data);
  }

  function setupLightbox(data) {
    const rooms = ((data.gallery || {}).rooms || []).map((r) => (r.images || []).filter(Boolean));
    const lb = el('lightbox'), img = el('lbImg');
    let cur = { room: 0, idx: 0 };
    function show(room, idx) {
      const arr = rooms[room] || []; if (!arr.length) return;
      cur = { room, idx: (idx + arr.length) % arr.length };
      img.src = arr[cur.idx]; lb.classList.add('open');
    }
    document.querySelectorAll('.room-imgs img').forEach((im) => {
      im.addEventListener('click', () => show(+im.dataset.room, +im.dataset.idx));
    });
    el('lbClose').addEventListener('click', () => lb.classList.remove('open'));
    lb.addEventListener('click', (e) => { if (e.target === lb) lb.classList.remove('open'); });
    el('lbPrev').addEventListener('click', () => show(cur.room, cur.idx - 1));
    el('lbNext').addEventListener('click', () => show(cur.room, cur.idx + 1));
    document.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') lb.classList.remove('open');
      if (e.key === 'ArrowLeft') show(cur.room, cur.idx - 1);
      if (e.key === 'ArrowRight') show(cur.room, cur.idx + 1);
    });
  }
})();
