'use strict';

// ══════════════════════════════════════════════════════════
// ÉTAT GLOBAL
// ══════════════════════════════════════════════════════════
let adminToken = null;
let adminDrawerOpen = false;
let selectedPropId = null;
let allProperties = [];

// ══════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  document.getElementById('footer-year').textContent = new Date().getFullYear();
  setupAdminLoginForm();
  await Promise.all([loadProperties(), loadSiteName()]);
});

async function loadSiteName() {
  try {
    const s = await apiFetch('/api/rules/settings/all', false);
    if (s.site_name) {
      document.getElementById('nav-logo').textContent = s.site_name;
      document.getElementById('footer-name').textContent = s.site_name;
      document.title = `Nos appartements — ${s.site_name}`;
    }
  } catch {}
}

// ══════════════════════════════════════════════════════════
// CHARGEMENT & RENDU DES APPARTEMENTS
// ══════════════════════════════════════════════════════════
async function loadProperties() {
  try {
    const props = await apiFetch('/api/properties');
    allProperties = props;
    renderProperties(props);
  } catch {
    document.getElementById('properties-grid').innerHTML =
      '<p style="color:var(--text-muted);text-align:center;padding:4rem 0;">Impossible de charger les appartements.</p>';
  }
}

function renderProperties(props) {
  const grid = document.getElementById('properties-grid');
  const empty = document.getElementById('no-properties');

  if (!props.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = props.map(p => {
    const photos = buildPhotoList(p);
    const hasMultiple = photos.length > 1;
    return `
    <article class="prop-card reveal" data-id="${p.id}">
      <div class="prop-card-photos" id="photos-${p.id}">
        ${photos.length ? photos.map((src, i) => `
          <div class="prop-photo-slide ${i === 0 ? 'active' : ''}" data-index="${i}">
            <img src="${src}" alt="${esc(p.name)}" loading="${i === 0 ? 'eager' : 'lazy'}">
          </div>`).join('') : `
          <div class="prop-photo-placeholder">
            <i data-lucide="image-off" style="width:48px;height:48px;color:var(--text-dim);"></i>
          </div>`}
        ${hasMultiple ? `
          <button class="prop-photo-nav prev" onclick="slidePhoto(${p.id},-1)" aria-label="Photo précédente">
            <i data-lucide="chevron-left" style="width:18px;height:18px;"></i>
          </button>
          <button class="prop-photo-nav next" onclick="slidePhoto(${p.id},1)" aria-label="Photo suivante">
            <i data-lucide="chevron-right" style="width:18px;height:18px;"></i>
          </button>
          <div class="prop-photo-dots">
            ${photos.map((_,i) => `<span class="prop-dot ${i===0?'active':''}" onclick="goToSlide(${p.id},${i})"></span>`).join('')}
          </div>` : ''}
      </div>
      <div class="prop-card-body">
        <h2 class="prop-card-name">${esc(p.name)}</h2>
        ${p.tagline ? `<p class="prop-card-tagline">${esc(p.tagline)}</p>` : ''}
        ${p.description ? `<p class="prop-card-desc">${esc(p.description)}</p>` : ''}
        <a href="/?id=${p.id}" class="btn-primary prop-card-cta">
          <i data-lucide="arrow-right" style="width:15px;height:15px;"></i>
          Découvrir cet appartement
        </a>
      </div>
    </article>`;
  }).join('');

  setTimeout(() => { lucide.createIcons(); setupScrollReveal(); }, 60);
}

function buildPhotoList(p) {
  const photos = [];
  if (p.main_image) photos.push(imgUrl(p.main_image));
  if (p.gallery && p.gallery.length) {
    p.gallery.forEach(g => {
      const url = imgUrl(g.filename);
      if (!photos.includes(url)) photos.push(url);
    });
  }
  return photos;
}

// ── Carrousel ──────────────────────────────────────────────
window.slidePhoto = function(propId, dir) {
  const container = document.getElementById(`photos-${propId}`);
  const slides = container.querySelectorAll('.prop-photo-slide');
  const dots = container.querySelectorAll('.prop-dot');
  let current = [...slides].findIndex(s => s.classList.contains('active'));
  slides[current].classList.remove('active');
  dots[current]?.classList.remove('active');
  current = (current + dir + slides.length) % slides.length;
  slides[current].classList.add('active');
  dots[current]?.classList.add('active');
};

window.goToSlide = function(propId, index) {
  const container = document.getElementById(`photos-${propId}`);
  const slides = container.querySelectorAll('.prop-photo-slide');
  const dots = container.querySelectorAll('.prop-dot');
  slides.forEach((s, i) => { s.classList.toggle('active', i === index); });
  dots.forEach((d, i) => { d.classList.toggle('active', i === index); });
};

// ── Scroll reveal ──────────────────────────────────────────
function setupScrollReveal() {
  const els = document.querySelectorAll('.reveal:not(.revealed)');
  if (!els.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); } });
  }, { threshold: 0.08 });
  els.forEach(el => io.observe(el));
}

// ══════════════════════════════════════════════════════════
// ADMIN — AUTH
// ══════════════════════════════════════════════════════════
window.handleAdminTrigger = function() {
  if (adminToken) {
    openAdminDrawer();
  } else {
    document.getElementById('admin-login-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('adm-username').focus(), 50);
  }
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
      errEl.style.display = 'none';
      document.getElementById('admin-login-form').reset();
      closeAdminLogin();
      openAdminDrawer();
    } catch (err) {
      errEl.textContent = err.message || 'Identifiants invalides';
      errEl.style.display = 'block';
    }
  });
}

// ══════════════════════════════════════════════════════════
// ADMIN — DRAWER
// ══════════════════════════════════════════════════════════
function openAdminDrawer() {
  adminDrawerOpen = true;
  document.getElementById('admin-drawer').style.transform = 'translateX(0)';
  document.getElementById('admin-overlay').style.display = 'block';
  adminLoadProps();
  adminLoadSettings();
}

window.closeAdminDrawer = function() {
  adminDrawerOpen = false;
  document.getElementById('admin-drawer').style.transform = 'translateX(100%)';
  document.getElementById('admin-overlay').style.display = 'none';
};

window.switchTab = function(tab) {
  document.querySelectorAll('.drw-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('drw-props').style.display = tab === 'props' ? '' : 'none';
  document.getElementById('drw-settings').style.display = tab === 'settings' ? '' : 'none';
};

// ══════════════════════════════════════════════════════════
// ADMIN — APPARTEMENTS
// ══════════════════════════════════════════════════════════
async function adminLoadProps() {
  const list = document.getElementById('props-list');
  try {
    const props = await apiFetch('/api/properties/admin/all', true);
    allProperties = props;
    if (!props.length) { list.innerHTML = '<p style="color:var(--adm-text-muted,#8a8a95);font-size:0.82rem;">Aucun appartement.</p>'; return; }
    list.innerHTML = props.map(p => `
      <div class="adm-list-item" style="margin-bottom:0.5rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
          <div style="flex:1;min-width:0;">
            <p style="font-size:0.85rem;font-weight:500;color:var(--adm-text,#f0f0f0);truncate;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.name)}</p>
            ${p.tagline ? `<p style="font-size:0.75rem;color:var(--adm-text-muted,#8a8a95);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.tagline)}</p>` : ''}
          </div>
          <div style="display:flex;gap:0.25rem;flex-shrink:0;">
            <span style="font-size:0.65rem;padding:0.1rem 0.4rem;border:1px solid ${p.active ? 'var(--gold-dim,#7a6040)' : 'var(--adm-border,#2a2a30)'};color:${p.active ? 'var(--gold,#c9a96e)' : 'var(--adm-text-dim,#555560)'};">${p.active ? 'Actif' : 'Masqué'}</span>
            <button class="adm-btn adm-btn-ghost adm-btn-sm" onclick="editProp(${p.id})" title="Modifier">
              <i data-lucide="pencil" style="width:12px;height:12px;"></i>
            </button>
            <button class="adm-btn adm-btn-ghost adm-btn-sm" onclick="selectPropForGallery(${p.id})" title="Gérer les photos">
              <i data-lucide="images" style="width:12px;height:12px;"></i>
            </button>
            <a href="/?id=${p.id}" target="_blank" class="adm-btn adm-btn-ghost adm-btn-sm" title="Voir la page voyageur">
              <i data-lucide="external-link" style="width:12px;height:12px;"></i>
            </a>
          </div>
        </div>
      </div>`).join('');
    setTimeout(() => lucide.createIcons(), 60);
  } catch(err) {
    list.innerHTML = `<p style="color:#e05050;font-size:0.8rem;">${esc(err.message)}</p>`;
  }
}

window.openNewPropForm = function() {
  document.getElementById('prop-form-title').textContent = 'Nouvel appartement';
  document.getElementById('pf-id').value = '';
  document.getElementById('pf-name').value = '';
  document.getElementById('pf-tagline').value = '';
  document.getElementById('pf-desc').value = '';
  document.getElementById('pf-active-group').style.display = 'none';
  document.getElementById('prop-form-block').style.display = 'block';
  document.getElementById('prop-gallery-block').style.display = 'none';
  document.getElementById('pf-name').focus();
};

window.editProp = function(id) {
  const p = allProperties.find(x => x.id === id);
  if (!p) return;
  document.getElementById('prop-form-title').textContent = 'Modifier l\'appartement';
  document.getElementById('pf-id').value = p.id;
  document.getElementById('pf-name').value = p.name || '';
  document.getElementById('pf-tagline').value = p.tagline || '';
  document.getElementById('pf-desc').value = p.description || '';
  document.getElementById('pf-active').checked = !!p.active;
  document.getElementById('pf-active-group').style.display = 'block';
  document.getElementById('prop-form-block').style.display = 'block';
  document.getElementById('prop-gallery-block').style.display = 'none';
  document.getElementById('pf-name').focus();
};

window.closePropForm = function() {
  document.getElementById('prop-form-block').style.display = 'none';
};

window.adminSaveProp = async function() {
  const id = document.getElementById('pf-id').value;
  const name = document.getElementById('pf-name').value.trim();
  const tagline = document.getElementById('pf-tagline').value.trim();
  const description = document.getElementById('pf-desc').value.trim();
  const active = document.getElementById('pf-active').checked ? 1 : 0;
  if (!name) { toast('Le nom est requis', 'error'); return; }
  try {
    if (id) {
      await apiFetch(`/api/properties/${id}`, true, 'PUT', { name, tagline, description, active });
      toast('Appartement mis à jour');
    } else {
      await apiFetch('/api/properties', true, 'POST', { name, tagline, description });
      toast('Appartement créé');
    }
    closePropForm();
    await adminLoadProps();
    await loadProperties();
  } catch(err) {
    toast(err.message || 'Erreur', 'error');
  }
};

// ── Sélection pour galerie ─────────────────────────────────
window.selectPropForGallery = async function(id) {
  selectedPropId = id;
  const block = document.getElementById('prop-gallery-block');
  block.style.display = 'block';
  document.getElementById('prop-form-block').style.display = 'none';
  await adminLoadGallery();
  block.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

async function adminLoadGallery() {
  if (!selectedPropId) return;
  const gridEl = document.getElementById('prop-gallery-grid');
  const previewEl = document.getElementById('prop-main-img-preview');
  try {
    const p = await apiFetch(`/api/properties/${selectedPropId}`, false);
    previewEl.innerHTML = p.main_image
      ? `<img src="${imgUrl(p.main_image)}" style="width:100%;height:80px;object-fit:cover;border:1px solid var(--adm-border,#2a2a30);" alt="Photo principale">`
      : `<p style="font-size:0.75rem;color:var(--adm-text-dim,#555560);">Aucune photo hero définie</p>`;
    const gallery = p.gallery || [];
    if (!gallery.length) { gridEl.innerHTML = '<p style="font-size:0.75rem;color:var(--adm-text-dim,#555560);grid-column:1/-1;">Aucune photo de galerie.</p>'; return; }
    gridEl.innerHTML = gallery.map(g => `
      <div style="position:relative;aspect-ratio:1;overflow:hidden;background:var(--adm-surface-2,#1a1a1e);">
        <img src="${imgUrl(g.filename)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" alt="">
        <button onclick="adminDeleteGalleryImg(${g.id})" style="position:absolute;top:3px;right:3px;background:rgba(0,0,0,.7);border:none;cursor:pointer;padding:3px;display:flex;align-items:center;justify-content:center;" title="Supprimer">
          <i data-lucide="x" style="width:10px;height:10px;color:#f0f0f0;"></i>
        </button>
      </div>`).join('');
    setTimeout(() => lucide.createIcons(), 60);
  } catch(err) {
    gridEl.innerHTML = `<p style="color:#e05050;font-size:0.75rem;">${esc(err.message)}</p>`;
  }
}

window.adminUploadMainImg = async function(input) {
  if (!input.files[0] || !selectedPropId) return;
  const fd = new FormData(); fd.append('image', input.files[0]);
  try {
    await apiFetchForm(`/api/properties/${selectedPropId}/image`, fd);
    toast('Photo principale mise à jour');
    await adminLoadGallery();
    await loadProperties();
  } catch(err) { toast(err.message || 'Erreur upload', 'error'); }
  input.value = '';
};

window.adminUploadGalleryImg = async function(input) {
  if (!input.files[0] || !selectedPropId) return;
  const fd = new FormData(); fd.append('image', input.files[0]);
  try {
    await apiFetchForm(`/api/properties/${selectedPropId}/gallery`, fd);
    toast('Photo ajoutée');
    await adminLoadGallery();
    await loadProperties();
  } catch(err) { toast(err.message || 'Erreur upload', 'error'); }
  input.value = '';
};

window.adminDeleteGalleryImg = async function(imgId) {
  if (!selectedPropId) return;
  try {
    await apiFetch(`/api/properties/${selectedPropId}/gallery/${imgId}`, true, 'DELETE');
    toast('Photo supprimée');
    await adminLoadGallery();
    await loadProperties();
  } catch(err) { toast(err.message || 'Erreur', 'error'); }
};

// ══════════════════════════════════════════════════════════
// ADMIN — PARAMÈTRES
// ══════════════════════════════════════════════════════════
async function adminLoadSettings() {
  try {
    const s = await apiFetch('/api/rules/settings/all', false);
    document.getElementById('ds-phone').value = s.help_phone || '';
    document.getElementById('ds-email').value = s.help_email || '';
    document.getElementById('ds-sitename').value = s.site_name || '';
    if (s.site_name) {
      document.getElementById('nav-logo').textContent = s.site_name;
      document.getElementById('footer-name').textContent = s.site_name;
    }
  } catch {}
}

window.adminSaveSettings = async function(e) {
  e.preventDefault();
  const phone = document.getElementById('ds-phone').value.trim();
  const email = document.getElementById('ds-email').value.trim();
  const sitename = document.getElementById('ds-sitename').value.trim();
  try {
    await Promise.all([
      apiFetch('/api/rules/settings/site_name',  true, 'PUT', { value: sitename }),
      apiFetch('/api/rules/settings/help_phone', true, 'PUT', { value: phone }),
      apiFetch('/api/rules/settings/help_email', true, 'PUT', { value: email }),
    ]);
    toast('Paramètres enregistrés');
    if (sitename) {
      document.getElementById('nav-logo').textContent = sitename;
      document.getElementById('footer-name').textContent = sitename;
    }
  } catch(err) { toast(err.message || 'Erreur', 'error'); }
};

// ══════════════════════════════════════════════════════════
// API HELPERS
// ══════════════════════════════════════════════════════════
async function apiFetch(url, needAuth = false, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (needAuth && adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) adminToken = null;
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

// ══════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════
window.toast = function(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const icons = { success: 'check-circle', error: 'x-circle', info: 'info' };
  el.innerHTML = `<i data-lucide="${icons[type]||'info'}" style="width:14px;height:14px;flex-shrink:0;"></i> ${esc(msg)}`;
  container.appendChild(el);
  lucide.createIcons({ nodes: [el] });
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(() => el.remove(), 300); }, 3500);
};

function imgUrl(filename) {
  if (!filename) return '';
  return /^https?:\/\//.test(filename) ? filename : '/uploads/' + filename;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
