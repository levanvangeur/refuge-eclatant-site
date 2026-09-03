/* ────────────────────────────────────────────────────────────
   Livret d'accueil — moteur de rendu (lit content.json)
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const el = (id) => document.getElementById(id);

  // Sections de navigation (id, libellé, condition d'affichage)
  const NAV = [
    ['bienvenue', 'Bienvenue'],
    ['pratique', 'Pratique'],
    ['logement', 'Le logement'],
    ['galerie', 'Galerie'],
    ['regles', 'Règles'],
    ['decouvrir', 'Découvrir'],
    ['manger', 'Où manger'],
    ['boire', 'Gourmandises'],
    ['services', 'Services'],
    ['escapades', 'Escapades'],
    ['numeros', 'Numéros utiles'],
  ];

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

    // ── Marque / logo ──
    if (m.logo) { el('navLogo').src = m.logo; } else { el('navLogo').style.display = 'none'; }
    el('navName').textContent = m.apartmentName || 'Livret d\'accueil';

    // ── Navigation ──
    el('navLinks').innerHTML = NAV.map(([id, label]) =>
      `<a href="#${id}" data-nav="${id}">${esc(label)}</a>`).join('');

    // ── Corps ──
    const parts = [];
    parts.push(hero(m));
    parts.push(practical(data.practical));
    parts.push(welcome(data.welcome));
    parts.push(comfort(data.comfort));
    parts.push(gallery(data.gallery));
    parts.push(rules(data.rules));
    parts.push(placesSection('decouvrir', 'À deux pas de chez vous', 'Découvrir ' + (m.city || ''), data.discover, false));
    parts.push(placesSection('flaner', 'Prendre son temps', 'Flâner & respirer', data.stroll, true));
    parts.push(directory('manger', 'Nos recommandations', 'Où manger', data.eat, false));
    parts.push(directory('boire', 'Se régaler', 'Bars & gourmandises', data.drinks, true));
    parts.push(directory('services', 'Bien pratique', 'Services & locations', data.services, false));
    parts.push(directory('commerces', 'Le quotidien', 'Commerces & courses', data.shops, true));
    parts.push(placesSection('escapades', 'Une journée d\'escapade', 'Grandes escapades', data.escapes, false));
    parts.push(digoinCharolles(data.digoinCharolles));
    parts.push(numbers(data.numbers));
    parts.push(goodbye(data.goodbye));
    el('app').innerHTML = parts.filter(Boolean).join('');

    // ── Pied de page ──
    el('app').insertAdjacentHTML('beforeend', footer(data));

    setupInteractions(data);
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

  function welcome(w) {
    if (!w) return '';
    return sectionWrap('', false, `
      <div class="kicker">Un mot pour vous</div>
      <h2 class="section-title">${esc(w.title || 'Bienvenue')}</h2>
      <div class="title-rule"></div>
      <div style="max-width:760px;margin:0 auto;text-align:center">
        ${(w.paragraphs || []).map((p) => `<p class="lead" style="margin-bottom:20px">${esc(p)}</p>`).join('')}
        ${w.signature ? `<p class="serif" style="font-style:italic;font-size:1.3rem;color:var(--gold-dark);margin-top:10px">${esc(w.signature)}</p>` : ''}
      </div>`, '');
  }

  function practical(pr) {
    if (!pr) return '';
    const wifi = pr.wifi || {}, ar = pr.arrival || {}, ad = pr.address || {}, as = pr.assistance || {};
    const kv = (k, v) => v ? `<div class="kv"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>` : '';
    return section('pratique', 'Informations pratiques', 'Informations pratiques', `
      <div class="grid cols-2">
        <div class="callout reveal">
          <div class="co-label">Connexion Wi-Fi</div>
          <div class="co-row"><div><div class="co-label">Réseau</div><div class="co-big" data-notranslate>${esc(wifi.network || '—')}</div></div></div>
          <div class="co-row"><div><div class="co-label">Mot de passe</div><div class="co-big" data-notranslate>${esc(wifi.password || '—')}</div></div>
            <button class="copy-btn" data-copy="${esc(wifi.password || '')}" data-notranslate>Copier</button></div>
        </div>
        <div class="card info-card reveal">
          <h3>Arrivée &amp; départ</h3>
          ${kv('Arrivée', ar.checkIn)}
          ${kv('Départ', ar.checkOut)}
          ${kv('Remise des clés', ar.keys)}
        </div>
        <div class="card info-card reveal">
          <h3>Adresse &amp; accès</h3>
          ${kv('Adresse', ad.full)}
          ${kv('Étage / porte', ad.floor)}
          ${kv('Code immeuble', ad.buildingCode)}
          ${kv('Stationnement', ad.parking)}
        </div>
        <div class="card info-card reveal">
          <h3>Assistance</h3>
          ${(as.phones || []).map((p, i) => kv('Téléphone ' + (i + 1), p)).join('')}
          ${kv('Disponibilité', as.availability)}
        </div>
      </div>`);
  }

  function comfort(c) {
    if (!c) return '';
    return section('logement', 'Le confort', 'Votre logement', `
      ${c.intro ? `<p class="lead">${esc(c.intro)}</p>` : ''}
      <div class="grid cols-2">
        ${(c.sections || []).map((s) => `
          <div class="card info-card reveal">
            <h3>${esc(s.title)}</h3>
            <ul class="diamond">${(s.items || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
          </div>`).join('')}
      </div>`, 'alt');
  }

  function gallery(g) {
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
      ${g.intro ? `<p class="lead">${esc(g.intro)}</p>` : ''}${rooms}`);
  }

  function rules(r) {
    if (!r) return '';
    const list = (title, arr) => `
      <div class="card info-card reveal">
        <h3>${esc(title)}</h3>
        <ul class="diamond">${(arr || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      </div>`;
    return section('regles', 'Pour le bien de tous', 'Règles de la maison', `
      <div class="grid cols-2">
        ${list('Le respect des lieux', r.respect)}
        ${list('Avant votre départ', r.beforeLeaving)}
      </div>
      ${r.thanks ? `<div class="card info-card reveal" style="margin-top:22px;text-align:center;border-color:var(--gold-light)">
        <h3 style="text-align:center">Merci !</h3><p class="lead" style="margin:0">${esc(r.thanks)}</p></div>` : ''}`, 'alt');
  }

  function placesSection(id, kick, title, block, alt) {
    if (!block || !(block.places || []).length) return '';
    return section(id, kick, title, `
      ${block.intro ? `<p class="lead">${esc(block.intro)}</p>` : ''}
      <div class="card info-card reveal">
        ${block.places.map((p) => placeHTML(p)).join('')}
      </div>`, alt ? 'alt' : '');
  }

  function placeHTML(p) {
    return `<div class="place">
      <h3>${esc(p.name)}</h3>
      ${p.desc ? `<p>${esc(p.desc)}</p>` : ''}
      ${p.meta ? `<div class="meta">${esc(p.meta)}</div>` : ''}
    </div>`;
  }

  function dirItem(it) {
    const parts = [];
    if (it.address) parts.push(esc(it.address));
    if (it.phone) parts.push(`<span class="tel" data-notranslate>${esc(it.phone)}</span>`);
    return `<div class="dir-item">
      <div class="n">${esc(it.name)}${it.type ? `<small>${esc(it.type)}</small>` : ''}</div>
      <div class="a">${parts.join(' · ')}</div>
    </div>`;
  }

  function directory(id, kick, title, block, alt) {
    if (!block || !(block.groups || []).length) return '';
    return section(id, kick, title, `
      ${block.intro ? `<p class="lead">${esc(block.intro)}</p>` : ''}
      ${block.groups.map((grp) => `
        <div class="reveal" style="margin-bottom:34px">
          <div class="group-title">${esc(grp.title)}</div>
          <div class="card info-card">${(grp.items || []).map(dirItem).join('')}</div>
        </div>`).join('')}`, alt ? 'alt' : '');
  }

  function digoinCharolles(dc) {
    if (!dc) return '';
    const col = (b) => b ? `
      <div class="reveal">
        <div class="group-title">${esc(b.title)}</div>
        <div class="card info-card">${(b.places || []).map(placeHTML).join('')}</div>
      </div>` : '';
    return section('digoin', 'À deux pas de Paray', 'Digoin & Charolles', `
      ${dc.intro ? `<p class="lead">${esc(dc.intro)}</p>` : ''}
      <div class="grid cols-2">${col(dc.digoin)}${col(dc.charolles)}</div>`, 'alt');
  }

  function numbers(n) {
    if (!n) return '';
    const cards = (arr) => (arr || []).map((x) => `
      <div class="phone-card">
        <div class="pl">${esc(x.label)}</div>
        <div class="pn">${x.number ? `<a href="tel:${esc(String(x.number).replace(/[^+0-9]/g, ''))}" data-notranslate>${esc(x.number)}</a>` : '—'}</div>
      </div>`).join('');
    return section('numeros', 'En cas de besoin', 'Numéros utiles', `
      <div class="grid cols-2">
        <div class="reveal"><div class="group-title">Urgences</div><div class="phones">${cards(n.emergency)}</div></div>
        <div class="reveal"><div class="group-title">Au quotidien</div><div class="phones">${cards(n.daily)}</div></div>
      </div>`);
  }

  function goodbye(g) {
    if (!g) return '';
    return sectionWrap('', false, `
      <div class="kicker">À bientôt</div>
      <h2 class="section-title">${esc(g.title || 'Merci')}</h2>
      <div class="title-rule"></div>
      <p class="lead">${esc(g.text || '')}</p>
      <div style="text-align:center;color:var(--gold);letter-spacing:.4em;margin-top:10px">✦ ✦ ✦</div>`, 'alt');
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
  function setupInteractions(data) {
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
    NAV.forEach(([id]) => { const s = el(id); if (s) spy.observe(s); });

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
