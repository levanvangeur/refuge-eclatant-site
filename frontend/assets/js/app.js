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
    return `<a class="map-link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}" target="_blank" rel="noopener">📍 ${esc(label)}</a>`;
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
    practical: (d, alt) => practical(d.practical, alt, d.earlyLate),
    included: (d, alt) => included((d.welcome || {}).included, alt),
    welcome: (d, alt) => welcome(d.welcome, alt),
    comfort: (d, alt) => comfort(d.comfort, alt),
    gallery: (d, alt) => gallery(d.gallery, alt),
    rules: (d, alt) => rules(d.rules, alt),
    departure: (d, alt) => departure(d.departure, alt),
    discover: (d, alt) => placesSection('decouvrir', 'À deux pas de chez vous', 'Découvrir ' + ((d.meta || {}).city || ''), d.discover, (d.meta || {}).city, alt),
    stroll: (d, alt) => placesSection('flaner', 'Prendre son temps', 'Flâner & respirer', d.stroll, (d.meta || {}).city, alt),
    eat: (d, alt) => directory('manger', 'Nos recommandations', 'Où manger', d.eat, (d.meta || {}).city, alt),
    drinks: (d, alt) => directory('boire', 'Se régaler', 'Bars & gourmandises', d.drinks, (d.meta || {}).city, alt),
    services: (d, alt) => directory('services', 'Bien pratique', 'Services & locations', d.services, (d.meta || {}).city, alt),
    shops: (d, alt) => directory('commerces', 'Le quotidien', 'Commerces & courses', d.shops, (d.meta || {}).city, alt),
    escapes: (d, alt) => placesSection('escapades', 'Une journée d\'escapade', 'Grandes escapades', d.escapes, (d.meta || {}).city, alt),
    digoinCharolles: (d, alt) => digoinCharolles(d.digoinCharolles, alt),
    numbers: (d, alt) => numbers(d.numbers, alt),
    reviews: (d, alt) => reviewsSection(d.reviews, alt),
    goodbye: (d, alt) => goodbye(d.goodbye, d.meta, alt),
  };

  // Ordre par défaut si data.sectionOrder est absent ou incomplet.
  const DEFAULT_ORDER = ['practical', 'included', 'welcome', 'comfort', 'gallery', 'rules', 'departure',
    'discover', 'stroll', 'eat', 'drinks', 'services', 'shops', 'escapes',
    'digoinCharolles', 'numbers', 'reviews', 'goodbye'];

  // Libellés de navigation (id de contenu → [ancre, libellé]).
  const NAV_LABELS = {
    practical: ['pratique', 'Pratique'],
    comfort: ['logement', 'Le logement'],
    gallery: ['galerie', 'Galerie'],
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
    DEFAULT_ORDER.forEach((id) => { if (order.indexOf(id) === -1) order.push(id); });
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
    order.forEach((id) => { const lab = NAV_LABELS[id]; if (lab) nav.push(lab); });
    el('navLinks').innerHTML = nav.map(([id, label]) =>
      `<a href="#${id}" data-nav="${id}">${esc(label)}</a>`).join('');

    // ── Corps ──
    const parts = [hero(m)];
    let alt = false;
    order.forEach((id) => {
      const html = SECTIONS[id](data, alt ? 'alt' : '');
      if (html) { parts.push(html); alt = !alt; }
    });
    el('app').innerHTML = parts.filter(Boolean).join('');

    // ── Pied de page ──
    el('app').insertAdjacentHTML('beforeend', footer(data));

    setupInteractions(data, nav);
    if (window.I18N) window.I18N.init();
  }

  /* ───────────────── Sections ───────────────── */

  function hero(m) {
    return `
    <a id="top"></a>
    <header class="hero" id="bienvenue">
      <div class="hero-content reveal">
        ${m.logo ? `<img class="logo" src="${esc(m.logo)}" alt="${esc(m.apartmentName)}" />` : ''}
        ${m.city ? `<div class="cov-kicker" data-notranslate>${esc(m.city)}</div>` : ''}
        <h1 data-notranslate>${esc(m.apartmentName || '')}</h1>
        <div class="hero-rule"></div>
        ${m.tagline ? `<p class="cov-sub-tag">${esc(m.tagline)}</p>` : (m.motto ? `<p class="cov-sub-tag">« ${esc(m.motto)} »</p>` : '')}
        ${m.bookingUrl ? `<div class="hero-cta-wrap"><a href="${esc(m.bookingUrl)}" class="hero-cta" target="_blank" rel="noopener">Réservez votre prochain séjour</a></div>` : ''}
      </div>
      <a href="#pratique" class="scroll-cue" aria-label="Défiler">⌄</a>
    </header>`;
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
    return `<div class="el-inline"><a class="el-btn sm" href="horaires.html?type=${type}">${arr ? 'Demander une arrivée anticipée' : 'Demander un départ tardif'}</a>
      <div class="el-cap">${esc(note)}</div></div>`;
  }

  function practical(pr, alt, el) {
    if (!pr) return '';
    const wifi = pr.wifi || {}, ar = pr.arrival || {}, ad = pr.address || {}, as = pr.assistance || {};
    const kv = (k, v) => v ? `<div class="kv"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>` : '';
    return section('pratique', 'Informations pratiques', 'Informations pratiques', `
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
          <h3>Arrivée &amp; départ</h3>
          ${kv('Arrivée', ar.checkIn)}
          ${earlyLateBtn(el, 'arrivee')}
          ${kv('Départ', ar.checkOut)}
          ${earlyLateBtn(el, 'depart')}
        </div>
        <div class="callout reveal">
          <div class="co-label">Connexion Wi-Fi</div>
          <div class="co-row"><div><div class="co-label">Réseau</div><div class="co-big" data-notranslate>${esc(wifi.network || '—')}</div></div></div>
          <div class="co-row"><div><div class="co-label">Mot de passe</div><div class="co-big" data-notranslate>${esc(wifi.password || '—')}</div></div>
            <button class="copy-btn" data-copy="${esc(wifi.password || '')}" data-notranslate>Copier</button></div>
        </div>
        <div class="card info-card reveal">
          <h3>Adresse &amp; accès</h3>
          ${ad.full ? `<div class="kv"><div class="k">Adresse</div><div class="v">${esc(ad.full)} ${mapsLink(ad.full, 'Carte')}</div></div>` : ''}
          ${kv('Étage / porte', ad.floor)}
          ${kv('Code immeuble', ad.buildingCode)}
          ${kv('Stationnement', ad.parking)}
        </div>
        <div class="card info-card reveal">
          <h3>Assistance</h3>
          ${(as.phones || []).map((p, i) => p ? `<div class="kv"><div class="k">Téléphone ${i + 1}</div><div class="v" data-notranslate>${esc(p)}</div>${callLink(p)}${waLink(p)}</div>` : '').join('')}
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
          ? `<div class="room-imgs">${imgs.map((src, ii) => `<img src="${esc(src)}" alt="${esc(room.name)}" data-room="${ri}" data-idx="${ii}" loading="lazy" />`).join('')}</div>`
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

  function placesSection(id, kick, title, block, cityHint, alt) {
    if (!block || !(block.places || []).length) return '';
    return section(id, kick, title, `
      ${block.intro ? `<p class="lead">${esc(block.intro)}</p>` : ''}
      <div class="card info-card reveal">
        ${block.places.map((p) => placeHTML(p, cityHint)).join('')}
      </div>`, alt ? 'alt' : '');
  }

  function placeHTML(p, cityHint) {
    const mapQuery = [p.name, cityHint].filter(Boolean).join(', ');
    return `<div class="place">
      <h3>${esc(p.name)}</h3>
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
    const map = mapsLink(mapQuery, 'Carte');
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
      ${block.groups.map((grp) => `
        <div class="reveal" style="margin-bottom:34px">
          <div class="group-title">${esc(grp.title)}</div>
          <div class="card info-card">${(grp.items || []).map((it) => dirItem(it, cityHint)).join('')}</div>
        </div>`).join('')}`, alt);
  }

  function digoinCharolles(dc, alt) {
    if (!dc) return '';
    const col = (b, cityHint) => b ? `
      <div class="reveal">
        <div class="group-title">${esc(b.title)}</div>
        <div class="card info-card">${(b.places || []).map((p) => placeHTML(p, cityHint)).join('')}</div>
      </div>` : '';
    return section('digoin', 'À deux pas de Paray', 'Digoin & Charolles', `
      ${dc.intro ? `<p class="lead">${esc(dc.intro)}</p>` : ''}
      <div class="grid cols-2">${col(dc.digoin, 'Digoin')}${col(dc.charolles, 'Charolles')}</div>`, alt);
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
  function section(id, kicker, title, inner, extra) {
    return `<section class="block ${extra || ''}" id="${id}">
      <div class="container">
        <div class="kicker">${esc(kicker)}</div>
        <h2 class="section-title">${esc(title)}</h2>
        <div class="title-rule"></div>
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
    document.querySelectorAll('[data-keybox-btn]').forEach((btn) => btn.addEventListener('click', () => {
      const code = btn.parentElement.querySelector('.key-code');
      if (code) { code.hidden = false; btn.hidden = true; }
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
    window.addEventListener('scroll', () => {
      toTop.classList.toggle('show', window.scrollY > 600);
    });
    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // Reveal on scroll
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.08 });
    document.querySelectorAll('.reveal').forEach((n) => io.observe(n));

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
