'use strict';

// ══════════════════════════════════════════════════════════
// ÉTAT GLOBAL
// ══════════════════════════════════════════════════════════
const PROPERTY_ID = new URLSearchParams(location.search).get('id') || 1;

// Voyageur
let currentImages = [];
let currentImageIndex = 0;
let helpOpen = false;
let propertyData = null;

// Admin
let adminToken = null; // jamais persisté — mot de passe requis à chaque visite
let adminDrawerOpen = false;
let adminRooms = [];
let activeDrawerTab = 'info';

// ══════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  document.getElementById('footer-year').textContent = new Date().getFullYear();

  // token jamais persisté — toujours null au chargement

  try {
    propertyData = await apiFetch(`/api/properties/${PROPERTY_ID}`, false);
    renderAll(propertyData);
  } catch {
    showLoadError();
  }

  setupNavScroll();
  setupScrollReveal();
  setupHelpButton();
  setupLightbox();
  setupAdminLoginForm();
  setupDrawerDragClose();
});

// ══════════════════════════════════════════════════════════
// ── VOYAGEUR : RENDU ─────────────────────────────────────
// ══════════════════════════════════════════════════════════
function renderAll(data) {
  updateMeta(data);
  renderHero(data);
  renderArrivee(data.rules);
  renderDepart(data.rules);
  renderWifi(data.rules);
  renderEquipements(data.rooms || []);
  renderConfort(data.rooms || []);
  renderStationnement(data.rules);
  renderReglement(data.rules);
  renderContact(data.settings);
  renderDecouvrir(data.rules);
  setTimeout(() => lucide.createIcons(), 60);
}

function updateMeta(data) {
  const title = `${data.name} — Location courte durée`;
  document.title = title;
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-desc').setAttribute('content', data.tagline || '');
}

let _heroTimer = null;

function renderHero(data) {
  const siteName = data.settings?.site_name || data.name;
  document.getElementById('nav-logo').textContent = siteName;
  document.getElementById('footer-name').textContent = siteName;
  document.getElementById('hero-eyebrow').textContent = 'Bienvenue au';
  document.getElementById('hero-title').textContent = data.name;
  document.getElementById('hero-tagline').textContent = data.tagline || '';

  // Priorité : hero_images (slideshow). Fallback : main_image seul.
  const heroImgs = data.hero_images && data.hero_images.length
    ? data.hero_images
    : data.main_image ? [{ filename: data.main_image }] : [];

  startHeroSlideshow(heroImgs);
}

function startHeroSlideshow(images) {
  if (_heroTimer) { clearInterval(_heroTimer); _heroTimer = null; }

  const hero = document.getElementById('hero');
  hero.querySelectorAll('.hero-slide').forEach(s => s.remove());

  if (!images.length) return;

  const overlay = document.getElementById('hero-overlay');

  // Créer un élément par photo, insérés AVANT l'overlay
  const slides = images.map((img, i) => {
    const div = document.createElement('div');
    div.className = 'hero-slide' + (i === 0 ? ' active' : '');
    div.style.backgroundImage = `url(/uploads/${img.filename})`;
    hero.insertBefore(div, overlay);
    return div;
  });

  // Précharger toutes les images en arrière-plan
  images.forEach(img => { const i = new Image(); i.src = `/uploads/${img.filename}`; });

  if (slides.length < 2) return; // une seule photo → pas besoin du timer

  let current = 0;
  _heroTimer = setInterval(() => {
    const prev = current;
    current = (current + 1) % slides.length;

    slides[current].classList.add('active');   // nouvelle slide monte
    slides[prev].classList.add('leaving');      // ancienne reste visible dessous
    slides[prev].classList.remove('active');

    // Une fois la transition terminée, on masque l'ancienne slide
    setTimeout(() => slides[prev].classList.remove('leaving'), 2200);
  }, 5500); // délai entre chaque photo
}


function renderEquipements(rooms) {
  const all = rooms.flatMap(r => (r.equipment || []).map(e => ({ ...e, roomName: r.name })));
  renderAccordionSection(
    all.filter(e => !e.category || e.category === 'equipement'),
    'equip-container',
    0,
    'Aucun équipement configuré.'
  );
}

function renderConfort(rooms) {
  const all = rooms.flatMap(r => (r.equipment || []).map(e => ({ ...e, roomName: r.name })));
  renderAccordionSection(
    all.filter(e => e.category === 'confort'),
    'confort-container',
    500,
    'Aucun élément de confort configuré.'
  );
}

function renderAccordionSection(items, containerId, idOffset, emptyMsg) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!items.length) { container.innerHTML = `<p style="color:var(--text-muted);padding:2rem 0;">${emptyMsg}</p>`; return; }
  container.innerHTML = items.map((eq, i) => `
    <div class="accordion-item" id="acc-${idOffset + i}">
      <button class="accordion-trigger" onclick="toggleAccordion(${idOffset + i})" aria-expanded="false">
        <div class="accordion-trigger-left">
          <div class="accordion-icon-wrap">${iconSvg(eq.icon, 16)}</div>
          <div><div class="accordion-trigger-name">${esc(eq.name)}</div><div class="accordion-room-tag">${esc(eq.roomName)}</div></div>
        </div>
        <i data-lucide="chevron-down" class="accordion-chevron" style="width:18px;height:18px;"></i>
      </button>
      <div class="accordion-body">
        <div class="accordion-body-inner">
          ${eq.instructions ? `<p class="accordion-instructions">${esc(eq.instructions)}</p>` : '<p style="color:var(--text-dim);font-size:0.85rem;">Pas d\'instructions disponibles.</p>'}
          ${eq.tips ? `<div class="accordion-tips">💡 ${esc(eq.tips)}</div>` : ''}
        </div>
      </div>
    </div>`).join('');
  setTimeout(() => lucide.createIcons(), 60);
}

function renderArrivee(rules) {
  const c = document.getElementById('arrivee-container');
  if (!rules) { c.innerHTML = ''; return; }
  c.innerHTML = renderCheckinBlock(rules.check_in_time || '15:00', rules.check_in_instructions || '');
}

function renderDepart(rules) {
  const c = document.getElementById('depart-container');
  if (!rules) { c.innerHTML = ''; return; }
  c.innerHTML = renderCheckinBlock(rules.check_out_time || '11:00', rules.check_out_instructions || '');
}

function renderCheckinBlock(time, text) {
  const lines = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
  const timeHtml = `<div class="checkin-time">${esc(time)}</div>`;
  if (!lines.length) return timeHtml;
  const stepsHtml = lines.map(line => `
    <div class="checkin-step">
      <span class="checkin-dot"></span>
      <p class="checkin-step-text">${esc(line)}</p>
    </div>`).join('');
  return `${timeHtml}<div class="checkin-steps">${stepsHtml}</div>`;
}

function renderWifi(rules) {
  const c = document.getElementById('wifi-container');
  if (!rules || (!rules.wifi_name && !rules.wifi_password)) {
    c.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">Informations Wi-Fi à configurer.</p>';
    return;
  }
  const makeCopiable = (val, label) => `
    <div class="wifi-field reveal">
      <p class="wifi-field-label">${label}</p>
      <div class="wifi-field-row">
        <span class="wifi-value" id="wifi-${label}">${esc(val)}</span>
        <button class="wifi-copy-btn" onclick="copyToClipboard('${esc(val)}', this)" title="Copier">
          <i data-lucide="copy" style="width:14px;height:14px;"></i>
        </button>
      </div>
    </div>`;
  c.innerHTML = `<div class="wifi-card reveal">
    <div class="wifi-card-icon"><i data-lucide="wifi" style="width:28px;height:28px;color:var(--gold);"></i></div>
    ${rules.wifi_name     ? makeCopiable(rules.wifi_name,     'Réseau') : ''}
    ${rules.wifi_password ? makeCopiable(rules.wifi_password, 'Mot de passe') : ''}
  </div>`;
  setTimeout(() => { lucide.createIcons(); setupScrollReveal(); }, 60);
}

window.copyToClipboard = function(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const icon = btn.querySelector('i');
    if (icon) { icon.setAttribute('data-lucide', 'check'); lucide.createIcons({ nodes: [icon] }); }
    setTimeout(() => { if (icon) { icon.setAttribute('data-lucide', 'copy'); lucide.createIcons({ nodes: [icon] }); } }, 2000);
  });
};

function renderStationnement(rules) {
  const c = document.getElementById('stationnement-container');
  if (!rules || !rules.parking_instructions) {
    c.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">Informations de stationnement à configurer.</p>';
    return;
  }
  c.innerHTML = `
    <div class="info-card reveal">
      <p class="info-card-text">${esc(rules.parking_instructions).replace(/\n/g,'<br>')}</p>
    </div>`;
  setTimeout(() => setupScrollReveal(), 60);
}

function renderReglement(rules) {
  const c = document.getElementById('reglement-container');
  if (!rules) { c.innerHTML = ''; return; }
  let html = '';
  if (rules.house_rules) {
    html += `<div class="info-card reveal"><p class="info-card-text">${esc(rules.house_rules).replace(/\n/g,'<br>')}</p></div>`;
  }
  if (!html) html = '<p style="color:var(--text-muted);font-size:0.9rem;">Règlement à configurer.</p>';
  c.innerHTML = html;
  setTimeout(() => { lucide.createIcons(); setupScrollReveal(); }, 60);
}

function renderContact(settings) {
  const c = document.getElementById('contact-container');
  if (!settings) { c.innerHTML = ''; return; }
  const phone = settings.help_phone || '';
  const email = settings.help_email || '';

  // Bouton flottant
  if (phone) { document.getElementById('help-phone-num').textContent = phone; document.getElementById('help-phone-link').href = `tel:${phone.replace(/\s/g, '')}`; }
  if (email) { document.getElementById('help-email-addr').textContent = email; document.getElementById('help-email-link').href = `mailto:${email}`; }

  c.innerHTML = `
    <div class="contact-grid reveal">
      ${phone ? `<a href="tel:${esc(phone.replace(/\s/g,''))}" class="contact-card">
        <div class="contact-card-icon"><i data-lucide="phone" style="width:24px;height:24px;"></i></div>
        <p class="contact-card-label">Appeler</p>
        <p class="contact-card-value">${esc(phone)}</p>
      </a>` : ''}
      ${email ? `<a href="mailto:${esc(email)}" class="contact-card">
        <div class="contact-card-icon"><i data-lucide="mail" style="width:24px;height:24px;"></i></div>
        <p class="contact-card-label">Email</p>
        <p class="contact-card-value">${esc(email)}</p>
      </a>` : ''}
    </div>`;
  if (!phone && !email) c.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">Contact à configurer dans Paramètres.</p>';
  setTimeout(() => { lucide.createIcons(); setupScrollReveal(); }, 60);
}

function renderDecouvrir(rules) {
  const c = document.getElementById('decouvrir-container');
  if (!rules || !rules.places_to_discover) {
    c.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">Suggestions à configurer.</p>';
    return;
  }
  c.innerHTML = `
    <div class="info-card reveal">
      <p class="info-card-text">${esc(rules.places_to_discover).replace(/\n/g,'<br>')}</p>
    </div>`;
  setTimeout(() => setupScrollReveal(), 60);
}


function renderBooking(property, bookings) {
  const container = document.getElementById('booking-container');
  const list = Array.isArray(bookings) ? bookings : (bookings ? [bookings] : []);
  if (!list.length) {
    container.innerHTML = `<div style="text-align:center;padding:3rem;border:1px solid var(--border);color:var(--text-muted);">Lien de réservation à configurer dans le panneau admin.</div>`;
    return;
  }
  const imgSrc = property.main_image ? `/uploads/${property.main_image}` : null;
  const imgHtml = imgSrc
    ? `<img src="${imgSrc}" alt="${esc(property.name)}" loading="lazy">`
    : `<div style="width:100%;height:100%;background:var(--surface-2);display:flex;align-items:center;justify-content:center;"><i data-lucide="home" style="width:48px;height:48px;color:var(--border-light);"></i></div>`;

  container.innerHTML = list.map(b => {
    const symbol = b.currency === 'USD' ? '$' : b.currency === 'GBP' ? '£' : '€';
    return `
    <div class="booking-card reveal">
      <div class="booking-card-image">${imgHtml}</div>
      <div class="booking-card-body">
        <div>
          <div class="saving-badge"><i data-lucide="tag" style="width:12px;height:12px;"></i> ${esc(b.label || 'Réservation directe')}</div>
          <h3 style="font-family:var(--font-display);font-size:1.8rem;font-weight:300;margin-bottom:0.5rem;">${esc(property.name)}</h3>
          <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:2rem;">${esc(property.tagline || '')}</p>
          ${b.price_per_night > 0 ? `
            <p class="booking-price">${b.price_per_night}${symbol} <small>/ nuit</small></p>
            <p style="font-size:0.78rem;color:var(--text-dim);margin-top:0.25rem;">Frais de ménage non inclus</p>` : ''}
        </div>
        <div style="margin-top:2rem;">
          <a href="${esc(b.booking_url)}" target="_blank" rel="noopener" class="btn-primary" style="display:inline-flex;">
            <i data-lucide="calendar-check" style="width:16px;height:16px;"></i> Réserver maintenant
          </a>
        </div>
      </div>
    </div>`;
  }).join('');
  setTimeout(() => { lucide.createIcons(); setupScrollReveal(); }, 60);
}

function showLoadError() {
  document.getElementById('booking-container').innerHTML =
    `<div style="text-align:center;padding:4rem 2rem;color:var(--text-muted);">Impossible de charger les données.<br>Vérifiez que le serveur est lancé (<code>npm start</code>).</div>`;
}

// ══════════════════════════════════════════════════════════
// ── CAROUSEL ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════
const carouselImages = {}; // roomId → [url, ...]

window.carSlide = function(roomId, dir) {
  const car = document.getElementById(`car-${roomId}`);
  if (!car) return;
  car.scrollBy({ left: dir * car.clientWidth, behavior: 'smooth' });
};

window.carGoTo = function(roomId, idx) {
  const car = document.getElementById(`car-${roomId}`);
  if (!car) return;
  car.scrollTo({ left: idx * car.clientWidth, behavior: 'smooth' });
};

window.openLightboxFromRoom = function(roomId, idx) {
  currentImages = carouselImages[roomId] || [];
  currentImageIndex = idx;
  if (currentImages[idx]) openLightbox(currentImages[idx]);
};

// ══════════════════════════════════════════════════════════
// ── HOTSPOTS VOYAGEUR ────────────────────────────────────
// ══════════════════════════════════════════════════════════

// Calcule la position réelle d'un hotspot en tenant compte du crop object-fit:cover
function positionHotspot(hotspotEl, img) {
  const xPct = parseFloat(hotspotEl.dataset.x);
  const yPct = parseFloat(hotspotEl.dataset.y);
  if (isNaN(xPct) || isNaN(yPct)) return;
  if (!img.naturalWidth || !img.clientWidth) return;

  const natW = img.naturalWidth,  natH = img.naturalHeight;
  const cW   = img.clientWidth,   cH   = img.clientHeight;
  const natR = natW / natH,       cR   = cW / cH;

  let scale, ox, oy;
  if (natR > cR) {
    // image plus large → ajustée sur la hauteur, bords latéraux coupés
    scale = cH / natH; ox = (cW - natW * scale) / 2; oy = 0;
  } else {
    // image plus haute → ajustée sur la largeur, haut/bas coupés
    scale = cW / natW; ox = 0; oy = (cH - natH * scale) / 2;
  }

  hotspotEl.style.left = ((xPct / 100 * natW * scale + ox) / cW * 100) + '%';
  hotspotEl.style.top  = ((yPct / 100 * natH * scale + oy) / cH * 100) + '%';
}

function setupHotspotPositions() {
  const slides = document.querySelectorAll('.carousel-slide');
  if (!slides.length) return;

  // ResizeObserver pour recalculer quand le conteneur change de taille
  const ro = new ResizeObserver(() => {
    slides.forEach(slide => {
      const img = slide.querySelector('img');
      if (!img) return;
      slide.querySelectorAll('.hotspot').forEach(h => positionHotspot(h, img));
    });
  });

  slides.forEach(slide => {
    const img = slide.querySelector('img');
    if (!img) return;
    const update = () => slide.querySelectorAll('.hotspot').forEach(h => positionHotspot(h, img));
    if (img.complete && img.naturalWidth) update();
    else img.addEventListener('load', update);
    ro.observe(slide);
  });
}

window.toggleHotspotPopup = function(e, dotEl) {
  e.stopPropagation();
  const popup = dotEl.querySelector('.hotspot-popup');
  const isOpen = popup.classList.contains('visible');

  closeAllHotspotPopups();
  if (isOpen) return;

  // Positionnement viewport-aware pour éviter les débordements
  popup.style.cssText = '';
  const dotRect = dotEl.getBoundingClientRect();
  const popupW  = Math.min(220, Math.floor(window.innerWidth * 0.70));
  popup.style.width = popupW + 'px';

  // Horizontal : droite si assez de place, sinon gauche
  if (window.innerWidth - dotRect.right > popupW + 16) {
    popup.style.left = '110%';
  } else {
    popup.style.right = '110%'; popup.style.left = 'auto';
  }
  // Vertical : bas si assez de place, sinon haut
  if (window.innerHeight - dotRect.bottom > 160) {
    popup.style.top = '0';
  } else {
    popup.style.bottom = '0'; popup.style.top = 'auto';
  }

  popup.classList.add('visible');
};

function closeAllHotspotPopups() {
  document.querySelectorAll('.hotspot-popup.visible').forEach(p => p.classList.remove('visible'));
}

// ══════════════════════════════════════════════════════════
// ── VOYAGEUR : INTERACTIONS ───────────────────────────────
// ══════════════════════════════════════════════════════════
function setupNavScroll() {
  window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 80);
  }, { passive: true });
}

function setupScrollReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal:not(.visible)').forEach(el => obs.observe(el));
}

function setupLightbox() {
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox-prev').addEventListener('click', () => navigateLightbox(-1));
  document.getElementById('lightbox-next').addEventListener('click', () => navigateLightbox(1));
  document.getElementById('lightbox').addEventListener('click', e => { if (e.target === document.getElementById('lightbox')) closeLightbox(); });
  document.addEventListener('keydown', e => {
    if (!document.getElementById('lightbox').classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });
}

function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
  document.body.style.overflow = '';
}
function navigateLightbox(dir) {
  if (!currentImages.length) return;
  currentImageIndex = (currentImageIndex + dir + currentImages.length) % currentImages.length;
  document.getElementById('lightbox-img').src = currentImages[currentImageIndex];
}

window.toggleAccordion = function(i) {
  const item = document.getElementById(`acc-${i}`);
  const body = item.querySelector('.accordion-body');
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.accordion-item.open').forEach(el => {
    el.classList.remove('open');
    el.querySelector('.accordion-body').style.maxHeight = '0';
    el.querySelector('.accordion-trigger').setAttribute('aria-expanded', 'false');
  });
  if (!isOpen) {
    item.classList.add('open');
    body.style.maxHeight = item.querySelector('.accordion-body-inner').scrollHeight + 'px';
    item.querySelector('.accordion-trigger').setAttribute('aria-expanded', 'true');
  }
};

function setupHelpButton() {
  document.getElementById('help-btn').addEventListener('click', () => {
    helpOpen = !helpOpen;
    document.getElementById('help-modal').classList.toggle('active', helpOpen);
  });
  document.addEventListener('click', e => {
    if (helpOpen && !e.target.closest('#help-btn') && !e.target.closest('#help-modal')) {
      helpOpen = false;
      document.getElementById('help-modal').classList.remove('active');
    }
  });
}
window.closeHelp = () => { helpOpen = false; document.getElementById('help-modal').classList.remove('active'); };

// ══════════════════════════════════════════════════════════
// ── ADMIN : AUTHENTIFICATION ──────────────────────────────
// ══════════════════════════════════════════════════════════
window.handleAdminTrigger = function() {
  // Auth temporairement désactivée — ouvre le drawer directement
  applyAdminActiveState();
  openAdminDrawer();
};

window.closeAdminLogin = function() {
  document.getElementById('admin-login-modal').style.display = 'none';
  document.getElementById('adm-login-error').style.display = 'none';
};

function setupAdminLoginForm() {
  document.getElementById('admin-login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('adm-username').value.trim();
    const password = document.getElementById('adm-password').value;
    const errEl = document.getElementById('adm-login-error');
    try {
      const res = await apiFetch('/api/auth/login', false, 'POST', { username, password });
      adminToken = res.token;
      // token en mémoire uniquement, pas de localStorage
      errEl.style.display = 'none';
      document.getElementById('admin-login-form').reset();
      closeAdminLogin();
      applyAdminActiveState();
      openAdminDrawer();
    } catch (err) {
      errEl.textContent = err.message || 'Identifiants incorrects';
      errEl.style.display = 'block';
    }
  });

  // Ferme login modal sur clic backdrop
  document.getElementById('admin-login-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('admin-login-modal')) closeAdminLogin();
  });
}

function applyAdminActiveState() {
  const btn = document.getElementById('admin-nav-btn');
  btn.classList.add('admin-active');
  btn.title = 'Ouvrir le panneau d\'édition';
}

window.adminLogout = function() {
  adminToken = null;
  // rien à supprimer du localStorage
  closeAdminDrawer();
  document.getElementById('admin-nav-btn').classList.remove('admin-active');
  toast('Déconnecté', 'info');
};

// ══════════════════════════════════════════════════════════
// ── ADMIN : DRAWER ────────────────────────────────────────
// ══════════════════════════════════════════════════════════
async function openAdminDrawer() {
  adminDrawerOpen = true;
  document.getElementById('admin-drawer').classList.add('open');
  document.getElementById('drawer-backdrop').classList.add('active');
  document.body.style.overflow = 'hidden';
  await adminLoadDrawerData();
  switchDrawerTab(activeDrawerTab);
  setTimeout(() => lucide.createIcons(), 60);
}

window.closeAdminDrawer = function() {
  adminDrawerOpen = false;
  document.getElementById('admin-drawer').classList.remove('open');
  document.getElementById('drawer-backdrop').classList.remove('active');
  document.body.style.overflow = '';
};

// Swipe-to-close sur mobile
function setupDrawerDragClose() {
  const drawer = document.getElementById('admin-drawer');
  let startX = 0;
  drawer.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  drawer.addEventListener('touchend', e => {
    if (e.changedTouches[0].clientX - startX > 80) closeAdminDrawer();
  }, { passive: true });
}

window.switchDrawerTab = function(tab) {
  activeDrawerTab = tab;
  document.querySelectorAll('.drw-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.drw-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`drw-${tab}`)?.classList.add('active');

  const loaders = {
    info: adminLoadInfo, equip: adminLoadEquip,
    rules: adminLoadRules, booking: adminLoadBooking, settings: adminLoadSettings,
  };
  if (loaders[tab]) loaders[tab]();
};

async function adminLoadDrawerData() {
  try {
    propertyData = await apiFetch(`/api/properties/${PROPERTY_ID}`, false);
    adminRooms = propertyData.rooms || [];
    const nameEl = document.getElementById('drawer-prop-name');
    if (nameEl) nameEl.textContent = propertyData.name;
    populateRoomSelects();
  } catch(err) {
    console.error('Erreur chargement drawer:', err);
  }
}

function populateRoomSelects() {
  // Rooms masquées de l'UI
}

// ── Info logement ──
async function adminLoadInfo() {
  if (!propertyData) return;
  document.getElementById('dp-name').value    = propertyData.name || '';
  document.getElementById('dp-tagline').value = propertyData.tagline || '';
  document.getElementById('dp-desc').value    = propertyData.description || '';
  document.getElementById('dp-active').value  = String(propertyData.active ?? 1);
  adminLoadHeroGrid();
}

async function adminLoadHeroGrid() {
  const grid = document.getElementById('dp-hero-grid');
  if (!grid) return;
  try {
    const data = await apiFetch(`/api/properties/${PROPERTY_ID}`, false);
    const imgs = data.hero_images || [];
    grid.innerHTML = imgs.length
      ? imgs.map(img => `
          <div style="position:relative;aspect-ratio:16/9;overflow:hidden;border:1px solid var(--adm-border);border-radius:3px;">
            <img src="/uploads/${esc(img.filename)}" style="width:100%;height:100%;object-fit:cover;">
            <button onclick="adminDeleteHeroImage(${img.id})"
              style="position:absolute;top:3px;right:3px;background:rgba(0,0,0,0.75);border:none;color:#fff;width:20px;height:20px;border-radius:50%;cursor:pointer;font-size:11px;line-height:1;display:flex;align-items:center;justify-content:center;">✕</button>
          </div>`).join('')
      : '<p style="font-size:0.75rem;color:var(--adm-text-muted);grid-column:1/-1;">Aucune photo d\'accueil.</p>';
  } catch {}
}


window.adminSaveProp = async function(e) {
  e.preventDefault();
  try {
    await apiFetch(`/api/properties/${PROPERTY_ID}`, true, 'PUT', {
      name:        document.getElementById('dp-name').value.trim(),
      tagline:     document.getElementById('dp-tagline').value.trim(),
      description: document.getElementById('dp-desc').value.trim(),
      active:      document.getElementById('dp-active').value,
    });
    toast('Logement mis à jour');
    await refreshPage();
  } catch (err) { toast(err.message, 'error'); }
};

window.adminUploadHeroImages = async function(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  toast(`Upload de ${files.length} photo(s)…`, 'info');
  try {
    for (const file of files) {
      const fd = new FormData();
      fd.append('image', file);
      await apiFetchForm(`/api/properties/${PROPERTY_ID}/hero`, fd);
    }
    toast(files.length > 1 ? `${files.length} photos ajoutées` : 'Photo ajoutée');
    await adminLoadHeroGrid();
    await refreshPage();
  } catch (err) { toast(err.message, 'error'); }
  input.value = '';
};

window.adminDeleteHeroImage = async function(imgId) {
  if (!confirm('Supprimer cette photo d\'accueil ?')) return;
  try {
    await apiFetch(`/api/properties/${PROPERTY_ID}/hero/${imgId}`, true, 'DELETE');
    toast('Photo supprimée');
    await adminLoadHeroGrid();
    await refreshPage();
  } catch (err) { toast(err.message, 'error'); }
};

// ── Équipements ──
let currentEquipList = [];

window.adminLoadEquip = async function() {
  try {
    let items = [];
    for (const room of adminRooms) {
      const raw = await apiFetch(`/api/equipment/${room.id}`, false).catch(() => []);
      items.push(...raw);
    }
    // Tri global par order_index (les items viennent de plusieurs rooms
    // différentes — la concat room par room ne respecte pas l'ordre voulu)
    items.sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.id - b.id);
    currentEquipList = items;
    const eq = items.filter(e => !e.category || e.category === 'equipement');
    const co = items.filter(e => e.category === 'confort');
    renderEquipAdminList(eq, 'drw-equip-list',   'equipement');
    renderEquipAdminList(co, 'drw-confort-list', 'confort');
    setTimeout(() => lucide.createIcons(), 60);
  } catch (err) {
    document.getElementById('drw-equip-list').innerHTML = `<p style="color:#e05555;">${err.message}</p>`;
  }
};

function renderEquipAdminList(items, containerId, category) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<p style="font-size:0.78rem;color:var(--adm-text-dim,#55555a);">Aucun élément.</p>';
    return;
  }
  el.innerHTML = items.map((e, i) => `
    <div class="equip-row" data-id="${e.id}" data-category="${e.category||'equipement'}">
      <div class="equip-row-order">
        <button class="equip-order-btn" onclick="moveEquip(${e.id},'${category}',-1)" ${i === 0 ? 'disabled' : ''}>▲</button>
        <span class="equip-order-num">${i + 1}</span>
        <button class="equip-order-btn" onclick="moveEquip(${e.id},'${category}',1)" ${i === items.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
      <span style="color:var(--gold);flex-shrink:0;">${iconSvg(e.icon, 14)}</span>
      <p class="equip-row-name">${esc(e.name)}</p>
      <div style="display:flex;gap:0.3rem;flex-shrink:0;">
        <button class="adm-btn adm-btn-ghost adm-btn-xs" onclick="adminEditEquip(${e.id})"><i data-lucide="pencil" style="width:11px;height:11px;"></i></button>
        <button class="adm-btn adm-btn-danger-xs" onclick="adminDeleteEquip(${e.id},'${esc(e.name)}')"><i data-lucide="trash-2" style="width:11px;height:11px;"></i></button>
      </div>
    </div>`).join('');
}

window.moveEquip = async function(id, category, dir) {
  const list = currentEquipList.filter(i => (i.category || 'equipement') === category);
  const idx  = list.findIndex(i => i.id === id);
  const to   = idx + dir;
  if (to < 0 || to >= list.length) return;

  // Échanger les deux items
  [list[idx], list[to]] = [list[to], list[idx]];

  try {
    for (let i = 0; i < list.length; i++) {
      await apiFetch(`/api/equipment/${list[i].id}/order`, true, 'PUT', { order_index: i + 1 });
    }
    await adminLoadEquip();
    await refreshPage();
  } catch (err) { toast(err.message, 'error'); }
};

window.openEquipForm = function(category) {
  const cat = category || 'equipement';
  document.getElementById('ef-id').value = '';
  document.getElementById('ef-name').value = '';
  document.getElementById('ef-icon').value = 'wrench';
  document.getElementById('ef-category').value = cat;
  document.getElementById('ef-instructions').value = '';
  document.getElementById('ef-tips').value = '';
  document.getElementById('equip-form-title').textContent = cat === 'confort' ? 'Nouvel élément de confort' : 'Nouvel équipement';
  document.getElementById('equip-form-block').style.display = 'block';
};
window.closeEquipForm = function() { document.getElementById('equip-form-block').style.display = 'none'; };

window.adminEditEquip = function(id) {
  const found = currentEquipList.find(e => e.id === id);
  if (!found) return;
  const cat = found.category || 'equipement';
  document.getElementById('ef-id').value = found.id;
  document.getElementById('ef-name').value = found.name;
  document.getElementById('ef-icon').value = found.icon || 'wrench';
  document.getElementById('ef-category').value = cat;
  document.getElementById('ef-instructions').value = found.instructions || '';
  document.getElementById('ef-tips').value = found.tips || '';
  document.getElementById('equip-form-title').textContent = cat === 'confort' ? 'Modifier confort' : 'Modifier équipement';
  document.getElementById('equip-form-block').style.display = 'block';
  document.getElementById('equip-form-block').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.adminSaveEquip = async function() {
  const id = document.getElementById('ef-id').value;
  const roomId = adminRooms[0]?.id;
  if (!roomId) return toast('Aucune pièce disponible', 'error');
  const body = {
    room_id: roomId,
    name: document.getElementById('ef-name').value.trim(),
    icon: document.getElementById('ef-icon').value,
    category: document.getElementById('ef-category').value,
    instructions: document.getElementById('ef-instructions').value.trim(),
    tips: document.getElementById('ef-tips').value.trim(),
  };
  if (!body.name) return toast('Nom requis', 'error');
  try {
    if (id) { await apiFetch(`/api/equipment/${id}`, true, 'PUT', body); toast('Mis à jour'); }
    else     { await apiFetch('/api/equipment', true, 'POST', body); toast('Créé'); }
    closeEquipForm();
    await adminLoadEquip();
    await refreshPage();
  } catch (err) { toast(err.message, 'error'); }
};

window.adminDeleteEquip = async function(id, name) {
  if (!confirm(`Supprimer "${name}" ?`)) return;
  try {
    await apiFetch(`/api/equipment/${id}`, true, 'DELETE');
    toast('Équipement supprimé');
    await adminLoadEquip();
    await refreshPage();
  } catch (err) { toast(err.message, 'error'); }
};

// ── Règles ──
async function adminLoadRules() {
  try {
    const r = await apiFetch(`/api/rules/${PROPERTY_ID}`, false);
    document.getElementById('dr-checkin-time').value  = r.check_in_time  || '15:00';
    document.getElementById('dr-checkout-time').value = r.check_out_time || '11:00';
    document.getElementById('dr-checkin-inst').value  = r.check_in_instructions  || '';
    document.getElementById('dr-checkout-inst').value = r.check_out_instructions || '';
    document.getElementById('dr-wifi-name').value     = r.wifi_name || '';
    document.getElementById('dr-wifi-pass').value     = r.wifi_password || '';
    document.getElementById('dr-trash').value         = r.trash_instructions || '';
    document.getElementById('dr-house-rules').value   = r.house_rules || '';
    document.getElementById('dr-parking').value       = r.parking_instructions || '';
    document.getElementById('dr-places').value        = r.places_to_discover || '';
  } catch {}
}

window.adminSaveRules = async function() {
  try {
    await apiFetch(`/api/rules/${PROPERTY_ID}`, true, 'PUT', {
      check_in_time:          document.getElementById('dr-checkin-time').value,
      check_out_time:         document.getElementById('dr-checkout-time').value,
      check_in_instructions:  document.getElementById('dr-checkin-inst').value,
      check_out_instructions: document.getElementById('dr-checkout-inst').value,
      wifi_name:              document.getElementById('dr-wifi-name').value,
      wifi_password:          document.getElementById('dr-wifi-pass').value,
      trash_instructions:     document.getElementById('dr-trash').value,
      house_rules:            document.getElementById('dr-house-rules').value,
      parking_instructions:   document.getElementById('dr-parking').value,
      places_to_discover:     document.getElementById('dr-places').value,
    });
    toast('Contenu enregistré');
    await refreshPage();
  } catch (err) { toast(err.message, 'error'); }
};

// ── Réservation ──
async function adminLoadBooking() {
  try {
    const list = await apiFetch(`/api/rules/booking/${PROPERTY_ID}`, false);
    renderAdminBookingList(Array.isArray(list) ? list : []);
  } catch {}
}

function renderAdminBookingList(list) {
  const el = document.getElementById('booking-list');
  if (!list.length) {
    el.innerHTML = `<p style="font-size:0.8rem;color:var(--adm-text-muted);">Aucun lien pour l'instant.</p>`;
    return;
  }
  el.innerHTML = list.map(b => `
    <div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.6rem;background:var(--adm-surface-2,#1a1a22);border:1px solid var(--adm-border);border-radius:4px;">
      <div style="flex:1;min-width:0;">
        <p style="font-size:0.8rem;font-weight:600;color:var(--adm-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(b.label || 'Sans nom')}</p>
        <p style="font-size:0.7rem;color:var(--adm-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(b.booking_url)}</p>
        ${b.price_per_night > 0 ? `<p style="font-size:0.7rem;color:var(--gold);">${b.price_per_night} ${b.currency}/nuit</p>` : ''}
      </div>
      <button class="adm-btn adm-btn-ghost adm-btn-xs" onclick="adminDeleteBooking(${b.id})" title="Supprimer">
        <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
      </button>
    </div>
  `).join('');
  lucide.createIcons();
}

window.adminAddBooking = async function(e) {
  e.preventDefault();
  try {
    await apiFetch(`/api/rules/booking/${PROPERTY_ID}`, true, 'POST', {
      label:           document.getElementById('db-label').value.trim(),
      price_per_night: Number(document.getElementById('db-price').value) || 0,
      currency:        document.getElementById('db-currency').value,
      booking_url:     document.getElementById('db-url').value.trim(),
      is_active:       1,
    });
    // Vide le formulaire
    document.getElementById('db-label').value = '';
    document.getElementById('db-url').value   = '';
    document.getElementById('db-price').value = '';
    toast('Lien ajouté ✓');
    await adminLoadBooking();
    await refreshPage();
  } catch (err) { toast(err.message, 'error'); }
};

window.adminDeleteBooking = async function(id) {
  try {
    await apiFetch(`/api/rules/booking/item/${id}`, true, 'DELETE');
    toast('Lien supprimé');
    await adminLoadBooking();
    await refreshPage();
  } catch (err) { toast(err.message, 'error'); }
};

// ── Paramètres ──
async function adminLoadSettings() {
  try {
    const s = await apiFetch('/api/rules/settings/all', false);
    document.getElementById('ds-sitename').value = s.site_name || '';
    document.getElementById('ds-phone').value    = s.help_phone || '';
    document.getElementById('ds-email').value    = s.help_email || '';
  } catch {}
}

window.adminSaveSettings = async function(e) {
  e.preventDefault();
  try {
    await Promise.all([
      apiFetch('/api/rules/settings/site_name',  true, 'PUT', { value: document.getElementById('ds-sitename').value.trim() }),
      apiFetch('/api/rules/settings/help_phone', true, 'PUT', { value: document.getElementById('ds-phone').value.trim() }),
      apiFetch('/api/rules/settings/help_email', true, 'PUT', { value: document.getElementById('ds-email').value.trim() }),
    ]);
    toast('Paramètres enregistrés');
    await refreshPage();
  } catch (err) { toast(err.message, 'error'); }
};

window.adminChangePassword = async function(e) {
  e.preventDefault();
  const cur  = document.getElementById('ds-cur-pass').value;
  const nw   = document.getElementById('ds-new-pass').value;
  const conf = document.getElementById('ds-confirm-pass').value;
  if (nw !== conf) return toast('Les mots de passe ne correspondent pas', 'error');
  if (nw.length < 8) return toast('Minimum 8 caractères', 'error');
  try {
    await apiFetch('/api/auth/change-password', true, 'POST', { currentPassword: cur, newPassword: nw });
    toast('Mot de passe changé — reconnexion dans 2s');
    ['ds-cur-pass','ds-new-pass','ds-confirm-pass'].forEach(id => document.getElementById(id).value = '');
    setTimeout(adminLogout, 2000);
  } catch (err) { toast(err.message, 'error'); }
};

// ══════════════════════════════════════════════════════════
// ── UTILITAIRES ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════

// Rafraîchit la page voyageur sans rechargement complet
async function refreshPage() {
  try {
    propertyData = await apiFetch(`/api/properties/${PROPERTY_ID}`, false);
    adminRooms = propertyData.rooms || [];
    renderAll(propertyData);
    document.getElementById('drawer-prop-name').textContent = propertyData.name;
    populateRoomSelects();
  } catch {}
}

// Fetch avec ou sans JWT
async function apiFetch(url, needAuth = false, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (needAuth && adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) { adminToken = null; localStorage.removeItem('av_token'); }
    throw new Error(data.error || `Erreur ${res.status}`);
  }
  return data;
}

async function apiFetchForm(url, formData) {
  const headers = {};
  if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
  const res = await fetch(url, { method: 'POST', headers, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

// Toast notifications
window.toast = function(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  const icons = { success: 'check-circle', error: 'x-circle', info: 'info' };
  el.className = `toast toast-${type}`;
  el.innerHTML = `<i data-lucide="${icons[type]||'info'}" style="width:14px;height:14px;flex-shrink:0;"></i> ${esc(msg)}`;
  container.appendChild(el);
  lucide.createIcons({ nodes: [el] });
  setTimeout(() => { el.style.opacity='0'; el.style.transform='translateY(10px)'; el.style.transition='all 0.3s'; setTimeout(() => el.remove(), 300); }, 3500);
};

// ══════════════════════════════════════════════════════════
// ── ADMIN : MODAL HOTSPOT ────────────────────────────────
// ══════════════════════════════════════════════════════════
let hmImageId = null;
let hmPending = null;
let hmMode = 'existing'; // 'existing' | 'free'

function hmSetMode(mode) {
  hmMode = mode;
  document.getElementById('hm-mode-existing').classList.toggle('active', mode === 'existing');
  document.getElementById('hm-mode-free').classList.toggle('active', mode === 'free');
  document.getElementById('hm-block-existing').style.display = mode === 'existing' ? 'block' : 'none';
  document.getElementById('hm-block-free').style.display     = mode === 'free'     ? 'block' : 'none';
}

function hmCancel() {
  hmPending = null;
  document.getElementById('hotspot-place-form').classList.remove('open');
  const p = document.querySelector('#hotspot-modal-img-wrap .hm-dot-pending');
  if (p) p.remove();
}

async function hmConfirm() {
  if (!hmPending || !hmImageId) return;
  try {
    if (hmMode === 'existing') {
      const equipId = document.getElementById('hm-equip-select').value;
      if (!equipId) { toast('Sélectionnez un équipement', 'error'); return; }
      await apiFetch('/api/hotspots', true, 'POST', {
        room_image_id: hmImageId,
        equipment_id:  Number(equipId),
        x_percent: hmPending.x,
        y_percent: hmPending.y,
      });
    } else if (hmMode === 'free') {
      const label       = document.getElementById('hm-free-label').value.trim();
      const description = document.getElementById('hm-free-desc').value.trim();
      if (!label) { toast('Le titre est requis', 'error'); return; }
      await apiFetch('/api/hotspots', true, 'POST', {
        room_image_id: hmImageId,
        label, description,
        x_percent: hmPending.x,
        y_percent: hmPending.y,
      });
    }
    toast('Point ajouté ✓');
    hmCancel();
    await renderHmDots();
    await refreshPage();
  } catch (err) { toast(err.message, 'error'); }
}

// Câblage des boutons du formulaire (une seule fois au chargement)
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('hm-mode-existing').addEventListener('click', function(e) { e.stopPropagation(); hmSetMode('existing'); });
  document.getElementById('hm-mode-free').addEventListener('click',     function(e) { e.stopPropagation(); hmSetMode('free'); });
  document.getElementById('hm-confirm-btn').addEventListener('click',   function(e) { e.stopPropagation(); hmConfirm(); });
  document.getElementById('hm-cancel-btn').addEventListener('click',    function(e) { e.stopPropagation(); hmCancel(); });
});

window.openHotspotModal = async function(imageId, filename, roomName) {
  hmImageId = imageId;
  hmPending = null;

  document.getElementById('hm-room-name').textContent = roomName;
  document.getElementById('hm-photo').src = `/uploads/${filename}`;
  document.getElementById('hotspot-modal').classList.add('open');
  document.body.style.overflow = 'hidden';

  // Équipements disponibles
  const sel = document.getElementById('hm-equip-select');
  sel.innerHTML = adminRooms.flatMap(r =>
    (r.equipment || []).map(e => `<option value="${e.id}">${esc(r.name)} — ${esc(e.name)}</option>`)
  ).join('');

  hmSetMode('existing');
  await renderHmDots();
  hmCancel();
};

window.closeHotspotModal = function() {
  document.getElementById('hotspot-modal').classList.remove('open');
  document.body.style.overflow = '';
  hmImageId = null; hmPending = null;
};

window.handleHotspotPhotoClick = function(e) {
  if (e.target.closest('#hotspot-place-form') || e.target.closest('.hm-dot')) return;

  const wrap    = document.getElementById('hotspot-modal-img-wrap');
  const imgRect = document.getElementById('hm-photo').getBoundingClientRect();

  const x = ((e.clientX - imgRect.left) / imgRect.width)  * 100;
  const y = ((e.clientY - imgRect.top)  / imgRect.height) * 100;
  if (x < 0 || x > 100 || y < 0 || y > 100) return;

  hmPending = { x, y };

  let dot = wrap.querySelector('.hm-dot-pending');
  if (!dot) { dot = document.createElement('div'); dot.className = 'hm-dot hm-dot-pending'; wrap.appendChild(dot); }
  dot.style.left = `${x}%`;
  dot.style.top  = `${y}%`;

  const form = document.getElementById('hotspot-place-form');
  form.style.left   = x > 60 ? 'auto' : `${x}%`;
  form.style.right  = x > 60 ? `${100 - x}%` : 'auto';
  form.style.top    = y > 70 ? 'auto' : `${y + 5}%`;
  form.style.bottom = y > 70 ? `${100 - y + 5}%` : 'auto';
  form.classList.add('open');

  // Vide les champs note libre
  document.getElementById('hm-free-label').value = '';
  document.getElementById('hm-free-desc').value  = '';
};

async function renderHmDots() {
  if (!hmImageId) return;
  // Supprime les anciens dots (sauf pending)
  document.querySelectorAll('#hotspot-modal-img-wrap .hm-dot:not(.hm-dot-pending)').forEach(d => d.remove());
  document.getElementById('hm-hotspots-list').innerHTML = '';

  try {
    const hotspots = await apiFetch(`/api/hotspots/image/${hmImageId}`, false);
    const wrap = document.getElementById('hotspot-modal-img-wrap');
    const img  = document.getElementById('hm-photo');

    hotspots.forEach((h, i) => {
      // Couleur selon le type
      const typeColor = h.hotspot_type === 'navigation' ? '#6ec6ff'
                      : h.hotspot_type === 'note'       ? '#a78bfa'
                      :                                   'var(--gold)';
      const typeIcon  = h.hotspot_type === 'navigation' ? '↗'
                      : h.hotspot_type === 'note'       ? '📝'
                      :                                   '⚙';

      // Dot sur la photo
      const dot = document.createElement('div');
      dot.className = 'hm-dot';
      dot.textContent = i + 1;
      dot.style.left = `${h.x_percent}%`;
      dot.style.top  = `${h.y_percent}%`;
      dot.style.background = typeColor;
      dot.title = `Supprimer : ${h.name}`;
      dot.onclick = (e) => { e.stopPropagation(); deleteHotspot(h.id); };
      wrap.appendChild(dot);

      // Liste sous la photo
      const tag = document.createElement('div');
      tag.style.cssText = 'display:flex;align-items:center;gap:0.4rem;padding:0.3rem 0.6rem;background:var(--adm-surface-2);border:1px solid var(--adm-border);font-size:0.75rem;color:var(--adm-text-muted);';
      tag.innerHTML = `
        <span style="width:16px;height:16px;border-radius:50%;background:${typeColor};color:#060608;display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:700;flex-shrink:0;">${i+1}</span>
        <span style="font-size:0.7rem;opacity:0.6;">${typeIcon}</span>
        ${esc(h.name)}
        <button onclick="deleteHotspot(${h.id})" style="margin-left:auto;background:none;border:none;cursor:pointer;color:#e05555;font-size:0.75rem;" title="Supprimer">✕</button>`;
      document.getElementById('hm-hotspots-list').appendChild(tag);
    });
  } catch {}
}


async function deleteHotspot(id) {
  if (!confirm('Supprimer ce point ?')) return;
  try {
    await apiFetch(`/api/hotspots/${id}`, true, 'DELETE');
    toast('Point supprimé');
    await renderHmDots();
    await refreshPage();
  } catch (err) { toast(err.message, 'error'); }
}

// Icône Lucide inline
function iconSvg(name, size = 14) {
  const map = { tv:'tv-2', wifi:'wifi', wind:'wind', flame:'flame', square:'square', droplets:'droplets', coffee:'coffee', moon:'moon', sun:'sun', droplet:'droplet', tool:'wrench', zap:'zap', thermometer:'thermometer' };
  return `<i data-lucide="${map[name]||name||'wrench'}" style="width:${size}px;height:${size}px;display:inline-block;vertical-align:middle;"></i>`;
}

// Échappe HTML (protection XSS)
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
