/* ═══════════════════════════════════════════════════════════
   AppVoyageurs — admin.js
   Toute la logique du back-office : auth JWT, CRUD complet,
   upload images, navigation entre vues.
═══════════════════════════════════════════════════════════ */

'use strict';

const API = '';
let token = localStorage.getItem('av_token') || null;
let allProperties = [];
let allRooms = [];
let selectedPropId = null;

// ══════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();

  if (token) {
    showApp();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
  }

  document.getElementById('login-form').addEventListener('submit', handleLogin);
});

// ══════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');

  try {
    const res = await apiFetch('/api/auth/login', 'POST', { username, password }, false);
    token = res.token;
    localStorage.setItem('av_token', token);
    errEl.classList.add('hidden');
    showApp();
  } catch (err) {
    errEl.textContent = err.message || 'Identifiants incorrects';
    errEl.classList.remove('hidden');
  }
}

function logout() {
  token = null;
  localStorage.removeItem('av_token');
  location.reload();
}

async function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  try {
    const me = await apiFetch('/api/auth/me');
    document.getElementById('sb-username').textContent = me.username;
  } catch {
    logout();
    return;
  }

  await loadGlobalData();
  navigate('dashboard');
  lucide.createIcons();
}

// ══════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════
const VIEW_TITLES = {
  dashboard: 'Dashboard',
  properties: 'Logements',
  rooms: 'Pièces & Photos',
  equipment: 'Équipements',
  rules: 'Règles & Informations',
  booking: 'Réservation directe',
  settings: 'Paramètres',
};

window.navigate = function(view) {
  document.querySelectorAll('.section-view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));

  document.getElementById(`view-${view}`).classList.add('active');
  document.querySelector(`[data-view="${view}"]`).classList.add('active');
  document.getElementById('topbar-title').textContent = VIEW_TITLES[view] || view;

  const loaders = {
    dashboard: loadDashboard,
    properties: loadProperties,
    rooms: loadRoomsView,
    equipment: loadEquipmentView,
    rules: loadRulesView,
    booking: loadBookingView,
    settings: loadSettingsView,
  };

  if (loaders[view]) loaders[view]();
  setTimeout(() => lucide.createIcons(), 100);
};

// ══════════════════════════════════════════════════════════
// DONNÉES GLOBALES
// ══════════════════════════════════════════════════════════
async function loadGlobalData() {
  try {
    allProperties = await apiFetch('/api/properties/admin/all');

    // Charge toutes les pièces pour tous les logements
    const roomsArrays = await Promise.all(
      allProperties.map(p => apiFetch(`/api/rooms/${p.id}`).catch(() => []))
    );
    allRooms = roomsArrays.flat();

    populatePropSelects();
    populateRoomSelects();
  } catch (err) {
    console.error('loadGlobalData:', err);
  }
}

function populatePropSelects() {
  const selects = ['rooms-prop-select', 'rules-prop-select', 'booking-prop-select', 'mr-prop-id'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = allProperties.map(p =>
      `<option value="${p.id}">${esc(p.name)}</option>`
    ).join('');
    if (current) el.value = current;
  });
}

function populateRoomSelects() {
  const selects = ['equip-room-filter', 'me-room-id'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isFilter = id === 'equip-room-filter';
    el.innerHTML = (isFilter ? '<option value="">— Toutes —</option>' : '') +
      allRooms.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
  });
}

// ══════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════
async function loadDashboard() {
  document.getElementById('stat-props').textContent = allProperties.length;
  document.getElementById('stat-rooms').textContent = allRooms.length;

  let equipCount = 0;
  for (const room of allRooms) {
    try {
      const eq = await apiFetch(`/api/equipment/${room.id}`);
      equipCount += eq.length;
    } catch {}
  }
  document.getElementById('stat-equip').textContent = equipCount;

  // Nom du site dans la sidebar
  try {
    const settings = await apiFetch('/api/rules/settings/all', 'GET', null, false);
    if (settings.site_name) document.getElementById('sb-sitename').textContent = settings.site_name;
  } catch {}
}

// ══════════════════════════════════════════════════════════
// LOGEMENTS
// ══════════════════════════════════════════════════════════
async function loadProperties() {
  const tbody = document.getElementById('props-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="text-muted">Chargement…</td></tr>';

  try {
    allProperties = await apiFetch('/api/properties/admin/all');
    populatePropSelects();

    if (!allProperties.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-muted">Aucun logement. Cliquez sur "Ajouter".</td></tr>';
      return;
    }

    tbody.innerHTML = allProperties.map(p => `
      <tr>
        <td><strong>${esc(p.name)}</strong></td>
        <td style="color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.tagline || '—')}</td>
        <td><span class="badge ${p.active ? 'badge-green' : 'badge-gray'}">${p.active ? 'Actif' : 'Inactif'}</span></td>
        <td>
          <div class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="editProp(${p.id})">
              <i data-lucide="pencil"></i> Éditer
            </button>
            <button class="btn btn-ghost btn-sm" onclick="selectPropForImage(${p.id}, '${esc(p.name)}')">
              <i data-lucide="image"></i> Image
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteProp(${p.id}, '${esc(p.name)}')">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    setTimeout(() => lucide.createIcons(), 50);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-danger">${err.message}</td></tr>`;
  }
}

window.openModal = function(type) {
  // Reset
  if (type === 'prop') {
    document.getElementById('mp-id').value = '';
    document.getElementById('mp-name').value = '';
    document.getElementById('mp-tagline').value = '';
    document.getElementById('mp-desc').value = '';
    document.getElementById('mp-active').value = '1';
    document.getElementById('modal-prop-title').textContent = 'Nouveau logement';
  } else if (type === 'room') {
    document.getElementById('mr-id').value = '';
    document.getElementById('mr-name').value = '';
    document.getElementById('mr-desc').value = '';
    document.getElementById('mr-order').value = '0';
    document.getElementById('modal-room-title').textContent = 'Nouvelle pièce';
    populatePropSelects();
  } else if (type === 'equip') {
    document.getElementById('me-id').value = '';
    document.getElementById('me-name').value = '';
    document.getElementById('me-icon').value = 'wrench';
    document.getElementById('me-instructions').value = '';
    document.getElementById('me-tips').value = '';
    document.getElementById('modal-equip-title').textContent = 'Nouvel équipement';
    populateRoomSelects();
  }
  document.getElementById(`modal-${type}`).classList.remove('hidden');
  setTimeout(() => lucide.createIcons(), 50);
};

window.closeModal = function(type) {
  document.getElementById(`modal-${type}`).classList.add('hidden');
};

window.editProp = async function(id) {
  const p = allProperties.find(x => x.id === id);
  if (!p) return;
  document.getElementById('mp-id').value = p.id;
  document.getElementById('mp-name').value = p.name;
  document.getElementById('mp-tagline').value = p.tagline || '';
  document.getElementById('mp-desc').value = p.description || '';
  document.getElementById('mp-active').value = String(p.active);
  document.getElementById('modal-prop-title').textContent = 'Modifier le logement';
  document.getElementById('modal-prop').classList.remove('hidden');
};

window.saveProp = async function() {
  const id = document.getElementById('mp-id').value;
  const body = {
    name: document.getElementById('mp-name').value.trim(),
    tagline: document.getElementById('mp-tagline').value.trim(),
    description: document.getElementById('mp-desc').value.trim(),
    active: document.getElementById('mp-active').value,
  };
  if (!body.name) return toast('Le nom est requis', 'error');

  try {
    if (id) {
      await apiFetch(`/api/properties/${id}`, 'PUT', body);
      toast('Logement mis à jour');
    } else {
      await apiFetch('/api/properties', 'POST', body);
      toast('Logement créé');
    }
    closeModal('prop');
    await loadGlobalData();
    loadProperties();
  } catch (err) {
    toast(err.message, 'error');
  }
};

window.deleteProp = async function(id, name) {
  if (!confirm(`Supprimer "${name}" et tout son contenu ?`)) return;
  try {
    await apiFetch(`/api/properties/${id}`, 'DELETE');
    toast('Logement supprimé');
    await loadGlobalData();
    loadProperties();
  } catch (err) {
    toast(err.message, 'error');
  }
};

window.selectPropForImage = function(id, name) {
  selectedPropId = id;
  document.getElementById('prop-image-card').style.display = 'block';
  document.getElementById('prop-image-card').querySelector('.card-title').textContent = `Image principale — ${name}`;
  document.getElementById('prop-image-card').scrollIntoView({ behavior: 'smooth' });
};

window.uploadPropImage = async function(input) {
  if (!input.files[0] || !selectedPropId) return;
  const fd = new FormData();
  fd.append('image', input.files[0]);

  try {
    toast('Upload en cours…', 'info');
    const res = await apiFetchForm(`/api/properties/${selectedPropId}/image`, fd);
    document.getElementById('prop-img-preview').innerHTML =
      `<img src="/uploads/${res.filename}?t=${Date.now()}" style="max-height:200px;border:1px solid var(--border);">`;
    toast('Image mise à jour');
  } catch (err) {
    toast(err.message, 'error');
  }
};

// ══════════════════════════════════════════════════════════
// PIÈCES
// ══════════════════════════════════════════════════════════
async function loadRoomsView() {
  populatePropSelects();
  if (allProperties.length) {
    document.getElementById('rooms-prop-select').value = allProperties[0].id;
    await loadRoomsForProp();
  }
}

window.loadRoomsForProp = async function() {
  const propId = document.getElementById('rooms-prop-select').value;
  if (!propId) return;

  const container = document.getElementById('rooms-list');
  container.innerHTML = '<p class="text-muted">Chargement…</p>';

  try {
    const rooms = await apiFetch(`/api/rooms/${propId}`);

    if (!rooms.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="door-open" style="width:40px;height:40px;"></i>
          <p>Aucune pièce. Cliquez sur "Ajouter une pièce".</p>
        </div>`;
      setTimeout(() => lucide.createIcons(), 50);
      return;
    }

    container.innerHTML = rooms.map(room => `
      <div class="card mb-4">
        <div class="card-header">
          <span class="card-title">${esc(room.name)}</span>
          <div class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="editRoom(${room.id})">
              <i data-lucide="pencil"></i> Éditer
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteRoom(${room.id}, '${esc(room.name)}')">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1rem;">${esc(room.description || 'Aucune description')}</p>

        <!-- Images -->
        <div style="margin-bottom:1rem;">
          <p style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-dim);margin-bottom:0.5rem;">Photos</p>
          <div class="img-grid" id="imgs-${room.id}">
            ${(room.images || []).map(img => `
              <div class="img-thumb">
                <img src="/uploads/${img.filename}" alt="${esc(img.alt_text || '')}">
                <button class="img-thumb-del" onclick="deleteRoomImage(${room.id}, ${img.id})" title="Supprimer">
                  <i data-lucide="x" style="width:12px;height:12px;"></i>
                </button>
              </div>
            `).join('')}
          </div>
          <div class="upload-zone" style="margin-top:0.75rem;padding:1.5rem;" onclick="triggerRoomUpload(${room.id})">
            <input type="file" id="room-img-${room.id}" accept="image/*" onchange="uploadRoomImage(${room.id}, this)">
            <i data-lucide="image-plus" style="width:24px;height:24px;" class="upload-icon"></i>
            <p style="margin-top:0.25rem;">Ajouter une photo</p>
          </div>
        </div>
      </div>
    `).join('');

    // Met à jour allRooms
    allRooms = [...allRooms.filter(r => r.property_id !== Number(propId)), ...rooms];
    populateRoomSelects();

    setTimeout(() => lucide.createIcons(), 50);
  } catch (err) {
    container.innerHTML = `<p class="text-danger">${err.message}</p>`;
  }
};

window.triggerRoomUpload = function(roomId) {
  document.getElementById(`room-img-${roomId}`).click();
};

window.uploadRoomImage = async function(roomId, input) {
  if (!input.files[0]) return;
  const fd = new FormData();
  fd.append('image', input.files[0]);

  try {
    toast('Upload en cours…', 'info');
    const res = await apiFetchForm(`/api/rooms/${roomId}/images`, fd);
    toast('Photo ajoutée');
    // Recharge la vue
    await loadRoomsForProp();
  } catch (err) {
    toast(err.message, 'error');
  }
};

window.deleteRoomImage = async function(roomId, imgId) {
  if (!confirm('Supprimer cette photo ?')) return;
  try {
    await apiFetch(`/api/rooms/${roomId}/images/${imgId}`, 'DELETE');
    toast('Photo supprimée');
    await loadRoomsForProp();
  } catch (err) {
    toast(err.message, 'error');
  }
};

window.editRoom = async function(id) {
  const room = allRooms.find(r => r.id === id);
  if (!room) return;
  document.getElementById('mr-id').value = room.id;
  document.getElementById('mr-prop-id').value = room.property_id;
  document.getElementById('mr-name').value = room.name;
  document.getElementById('mr-desc').value = room.description || '';
  document.getElementById('mr-order').value = room.order_index ?? 0;
  document.getElementById('modal-room-title').textContent = 'Modifier la pièce';
  document.getElementById('modal-room').classList.remove('hidden');
};

window.saveRoom = async function() {
  const id = document.getElementById('mr-id').value;
  const body = {
    property_id: document.getElementById('mr-prop-id').value,
    name: document.getElementById('mr-name').value.trim(),
    description: document.getElementById('mr-desc').value.trim(),
    order_index: Number(document.getElementById('mr-order').value),
  };
  if (!body.name) return toast('Le nom est requis', 'error');

  try {
    if (id) {
      await apiFetch(`/api/rooms/${id}`, 'PUT', body);
      toast('Pièce mise à jour');
    } else {
      await apiFetch('/api/rooms', 'POST', body);
      toast('Pièce créée');
    }
    closeModal('room');
    await loadGlobalData();
    await loadRoomsForProp();
  } catch (err) {
    toast(err.message, 'error');
  }
};

window.deleteRoom = async function(id, name) {
  if (!confirm(`Supprimer la pièce "${name}" et toutes ses photos ?`)) return;
  try {
    await apiFetch(`/api/rooms/${id}`, 'DELETE');
    toast('Pièce supprimée');
    await loadGlobalData();
    await loadRoomsForProp();
  } catch (err) {
    toast(err.message, 'error');
  }
};

// ══════════════════════════════════════════════════════════
// ÉQUIPEMENTS
// ══════════════════════════════════════════════════════════
async function loadEquipmentView() {
  populateRoomSelects();
  await loadEquipForRoom();
}

window.loadEquipForRoom = async function() {
  const roomId = document.getElementById('equip-room-filter').value;
  const tbody = document.getElementById('equip-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Chargement…</td></tr>';

  try {
    let items = [];
    if (roomId) {
      items = await apiFetch(`/api/equipment/${roomId}`);
      items = items.map(e => ({ ...e, roomName: allRooms.find(r => r.id === e.room_id)?.name || '—' }));
    } else {
      for (const room of allRooms) {
        const eq = await apiFetch(`/api/equipment/${room.id}`).catch(() => []);
        items.push(...eq.map(e => ({ ...e, roomName: room.name })));
      }
    }

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Aucun équipement.</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(e => `
      <tr>
        <td><i data-lucide="${e.icon || 'wrench'}" style="width:16px;height:16px;color:var(--gold);"></i></td>
        <td><strong>${esc(e.name)}</strong></td>
        <td><span class="badge badge-gray">${esc(e.roomName)}</span></td>
        <td style="color:var(--text-muted);max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(e.instructions || '—')}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="editEquip(${e.id})">
              <i data-lucide="pencil"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteEquip(${e.id}, '${esc(e.name)}')">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    setTimeout(() => lucide.createIcons(), 50);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-danger">${err.message}</td></tr>`;
  }
};

window.editEquip = async function(id) {
  // Cherche dans toutes les pièces
  let found = null;
  for (const room of allRooms) {
    try {
      const items = await apiFetch(`/api/equipment/${room.id}`);
      found = items.find(e => e.id === id);
      if (found) break;
    } catch {}
  }
  if (!found) return;

  populateRoomSelects();
  document.getElementById('me-id').value = found.id;
  document.getElementById('me-room-id').value = found.room_id;
  document.getElementById('me-name').value = found.name;
  document.getElementById('me-icon').value = found.icon || 'wrench';
  document.getElementById('me-instructions').value = found.instructions || '';
  document.getElementById('me-tips').value = found.tips || '';
  document.getElementById('modal-equip-title').textContent = 'Modifier l\'équipement';
  document.getElementById('modal-equip').classList.remove('hidden');
};

window.saveEquip = async function() {
  const id = document.getElementById('me-id').value;
  const body = {
    room_id: document.getElementById('me-room-id').value,
    name: document.getElementById('me-name').value.trim(),
    icon: document.getElementById('me-icon').value,
    instructions: document.getElementById('me-instructions').value.trim(),
    tips: document.getElementById('me-tips').value.trim(),
  };
  if (!body.name) return toast('Le nom est requis', 'error');

  try {
    if (id) {
      await apiFetch(`/api/equipment/${id}`, 'PUT', body);
      toast('Équipement mis à jour');
    } else {
      await apiFetch('/api/equipment', 'POST', body);
      toast('Équipement créé');
    }
    closeModal('equip');
    await loadEquipForRoom();
  } catch (err) {
    toast(err.message, 'error');
  }
};

window.deleteEquip = async function(id, name) {
  if (!confirm(`Supprimer "${name}" ?`)) return;
  try {
    await apiFetch(`/api/equipment/${id}`, 'DELETE');
    toast('Équipement supprimé');
    await loadEquipForRoom();
  } catch (err) {
    toast(err.message, 'error');
  }
};

// ══════════════════════════════════════════════════════════
// RÈGLES
// ══════════════════════════════════════════════════════════
async function loadRulesView() {
  populatePropSelects();
  if (allProperties.length) {
    document.getElementById('rules-prop-select').value = allProperties[0].id;
    await loadRules();
  }
}

window.loadRules = async function() {
  const propId = document.getElementById('rules-prop-select').value;
  if (!propId) return;

  try {
    const rules = await apiFetch(`/api/rules/${propId}`);
    document.getElementById('r-checkin-time').value  = rules.check_in_time  || '15:00';
    document.getElementById('r-checkout-time').value = rules.check_out_time || '11:00';
    document.getElementById('r-checkin-inst').value  = rules.check_in_instructions  || '';
    document.getElementById('r-checkout-inst').value = rules.check_out_instructions || '';
    document.getElementById('r-trash').value          = rules.trash_instructions    || '';
    document.getElementById('r-wifi-name').value      = rules.wifi_name             || '';
    document.getElementById('r-wifi-pass').value      = rules.wifi_password         || '';
    document.getElementById('r-house-rules').value    = rules.house_rules           || '';
  } catch (err) {
    toast('Impossible de charger les règles', 'error');
  }
};

window.saveRules = async function(e) {
  e.preventDefault();
  const propId = document.getElementById('rules-prop-select').value;
  if (!propId) return toast('Sélectionnez un logement', 'error');

  const body = {
    check_in_time:          document.getElementById('r-checkin-time').value,
    check_out_time:         document.getElementById('r-checkout-time').value,
    check_in_instructions:  document.getElementById('r-checkin-inst').value,
    check_out_instructions: document.getElementById('r-checkout-inst').value,
    trash_instructions:     document.getElementById('r-trash').value,
    wifi_name:              document.getElementById('r-wifi-name').value,
    wifi_password:          document.getElementById('r-wifi-pass').value,
    house_rules:            document.getElementById('r-house-rules').value,
  };

  try {
    await apiFetch(`/api/rules/${propId}`, 'PUT', body);
    toast('Règles enregistrées');
  } catch (err) {
    toast(err.message, 'error');
  }
};

// ══════════════════════════════════════════════════════════
// RÉSERVATION
// ══════════════════════════════════════════════════════════
async function loadBookingView() {
  populatePropSelects();
  if (allProperties.length) {
    document.getElementById('booking-prop-select').value = allProperties[0].id;
    await loadBooking();
  }
}

window.loadBooking = async function() {
  const propId = document.getElementById('booking-prop-select').value;
  if (!propId) return;

  try {
    const b = await apiFetch(`/api/rules/booking/${propId}`);
    document.getElementById('b-price').value    = b.price_per_night || '';
    document.getElementById('b-currency').value = b.currency || 'EUR';
    document.getElementById('b-url').value      = b.booking_url || '';
    document.getElementById('b-active').value   = String(b.is_active ?? 1);
  } catch {}
};

window.saveBooking = async function(e) {
  e.preventDefault();
  const propId = document.getElementById('booking-prop-select').value;
  if (!propId) return toast('Sélectionnez un logement', 'error');

  const body = {
    price_per_night: Number(document.getElementById('b-price').value),
    currency: document.getElementById('b-currency').value,
    booking_url: document.getElementById('b-url').value.trim(),
    is_active: document.getElementById('b-active').value,
  };

  try {
    await apiFetch(`/api/rules/booking/${propId}`, 'PUT', body);
    toast('Réservation mise à jour');
  } catch (err) {
    toast(err.message, 'error');
  }
};

// ══════════════════════════════════════════════════════════
// PARAMÈTRES
// ══════════════════════════════════════════════════════════
async function loadSettingsView() {
  try {
    const s = await apiFetch('/api/rules/settings/all', 'GET', null, false);
    document.getElementById('s-sitename').value = s.site_name || '';
    document.getElementById('s-phone').value    = s.help_phone || '';
    document.getElementById('s-email').value    = s.help_email || '';
  } catch {}
}

window.saveSettings = async function(e) {
  e.preventDefault();
  const fields = [
    { key: 'site_name',   id: 's-sitename' },
    { key: 'help_phone',  id: 's-phone' },
    { key: 'help_email',  id: 's-email' },
  ];

  try {
    await Promise.all(fields.map(f =>
      apiFetch(`/api/rules/settings/${f.key}`, 'PUT', { value: document.getElementById(f.id).value.trim() })
    ));

    const siteName = document.getElementById('s-sitename').value.trim();
    if (siteName) document.getElementById('sb-sitename').textContent = siteName;
    toast('Paramètres enregistrés');
  } catch (err) {
    toast(err.message, 'error');
  }
};

window.changePassword = async function(e) {
  e.preventDefault();
  const cur  = document.getElementById('s-cur-pass').value;
  const nw   = document.getElementById('s-new-pass').value;
  const conf = document.getElementById('s-confirm-pass').value;

  if (nw !== conf) return toast('Les mots de passe ne correspondent pas', 'error');
  if (nw.length < 8) return toast('Minimum 8 caractères', 'error');

  try {
    await apiFetch('/api/auth/change-password', 'POST', { currentPassword: cur, newPassword: nw });
    toast('Mot de passe modifié ! Reconnectez-vous.');
    document.getElementById('s-cur-pass').value = '';
    document.getElementById('s-new-pass').value = '';
    document.getElementById('s-confirm-pass').value = '';
    setTimeout(logout, 2000);
  } catch (err) {
    toast(err.message, 'error');
  }
};

// ══════════════════════════════════════════════════════════
// UTILITAIRES HTTP
// ══════════════════════════════════════════════════════════
async function apiFetch(url, method = 'GET', body = null, useAuth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (useAuth && token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(API + url, opts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      logout();
    }
    throw new Error(data.error || `Erreur ${res.status}`);
  }
  return data;
}

async function apiFetchForm(url, formData) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API + url, { method: 'POST', headers, body: formData });
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
  el.innerHTML = `<i data-lucide="${icons[type] || 'info'}" style="width:14px;height:14px;flex-shrink:0;"></i> ${esc(msg)}`;

  container.appendChild(el);
  lucide.createIcons({ nodes: [el] });

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    el.style.transition = 'all 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, 3500);
};

// ══════════════════════════════════════════════════════════
// UTILITAIRE XSS
// ══════════════════════════════════════════════════════════
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
