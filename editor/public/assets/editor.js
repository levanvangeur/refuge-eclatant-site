/* ────────────────────────────────────────────────────────────
   Éditeur du livret — charge content.json, édite, enregistre,
   téléverse des photos et publie (avec aperçu/confirmation).
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  let content = null;
  const $ = (id) => document.getElementById(id);
  const elh = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const slug = (s) => String(s || 'piece').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'piece';

  /* ─────────── Enregistrement (auto-save) ─────────── */
  let saveTimer = null;
  function setState(txt, cls) { const s = $('saveState'); s.textContent = txt; s.className = 'save-state ' + (cls || ''); }
  function scheduleSave() {
    setState('Modifications non enregistrées…', 'saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 700);
  }
  async function save() {
    setState('Enregistrement…', 'saving');
    try {
      const r = await fetch('/api/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content) });
      if (!r.ok) throw new Error((await r.json()).error || r.status);
      setState('Enregistré ✓', 'saved');
    } catch (e) { setState('Erreur : ' + e.message, 'error'); }
  }

  function toast(msg, cls) {
    const t = $('toast'); t.textContent = msg; t.className = 'toast show ' + (cls || '');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.className = 'toast', 2600);
  }

  /* ─────────── Widgets ─────────── */
  function fieldText(obj, key, label, opts) {
    opts = opts || {};
    const f = elh('div', 'field');
    if (label) f.appendChild(elh('label', null, label));
    const input = opts.textarea ? elh('textarea') : elh('input');
    if (!opts.textarea) input.type = 'text';
    input.value = obj[key] == null ? '' : obj[key];
    if (opts.ph) input.placeholder = opts.ph;
    input.addEventListener('input', () => { obj[key] = input.value; scheduleSave(); });
    f.appendChild(input);
    return f;
  }

  // Liste de chaînes (paragraphes, puces…)
  function stringList(arr, opts) {
    opts = opts || {};
    const box = elh('div');
    function render() {
      box.innerHTML = '';
      arr.forEach((val, i) => {
        const row = elh('div', 'list-row');
        row.appendChild(elh('span', 'handle', '⋮⋮'));
        const ta = elh('textarea'); ta.value = val;
        ta.addEventListener('input', () => { arr[i] = ta.value; scheduleSave(); });
        row.appendChild(ta);
        const up = elh('button', 'btn sm', '↑'); up.onclick = () => { if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; scheduleSave(); render(); } };
        const dn = elh('button', 'btn sm', '↓'); dn.onclick = () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; scheduleSave(); render(); } };
        const del = elh('button', 'btn sm danger', '✕'); del.onclick = () => { arr.splice(i, 1); scheduleSave(); render(); };
        row.append(up, dn, del);
        box.appendChild(row);
      });
      const add = elh('button', 'addbtn', '+ ' + (opts.addLabel || 'Ajouter une ligne'));
      add.onclick = () => { arr.push(''); scheduleSave(); render(); };
      box.appendChild(add);
    }
    render();
    return box;
  }

  // Liste d'objets (fields = [{key,label,full,textarea,ph}])
  function objectList(arr, fields, opts) {
    opts = opts || {};
    const box = elh('div');
    function render() {
      box.innerHTML = '';
      arr.forEach((item, i) => {
        const wrap = elh('div', 'obj-item');
        const head = elh('div', 'obj-head');
        head.appendChild(elh('span', 'obj-title', (opts.titleKey ? (item[opts.titleKey] || '') : '') || ('#' + (i + 1))));
        const tools = elh('div');
        const up = elh('button', 'btn sm', '↑'); up.onclick = () => { if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; scheduleSave(); render(); } };
        const dn = elh('button', 'btn sm', '↓'); dn.onclick = () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; scheduleSave(); render(); } };
        const del = elh('button', 'btn sm danger', '✕'); del.onclick = () => { arr.splice(i, 1); scheduleSave(); render(); };
        tools.append(up, dn, del); head.appendChild(tools);
        wrap.appendChild(head);
        const grid = elh('div', 'obj-grid');
        fields.forEach((fl) => {
          const f = fieldText(item, fl.key, fl.label, { textarea: fl.textarea, ph: fl.ph });
          if (fl.full || fl.textarea) f.classList.add('full');
          // maj du titre en direct
          if (opts.titleKey === fl.key) f.querySelector('input,textarea').addEventListener('input', (e) => { head.querySelector('.obj-title').textContent = e.target.value || ('#' + (i + 1)); });
          grid.appendChild(f);
        });
        wrap.appendChild(grid);
        box.appendChild(wrap);
      });
      const add = elh('button', 'addbtn', '+ ' + (opts.addLabel || 'Ajouter'));
      add.onclick = () => { const o = {}; fields.forEach((f) => o[f.key] = ''); arr.push(o); scheduleSave(); render(); };
      box.appendChild(add);
    }
    render();
    return box;
  }

  // Champ « étiquettes » (équipements)
  function tagInput(arr) {
    const wrap = elh('div', 'tag-input');
    function render() {
      wrap.innerHTML = '';
      arr.forEach((t, i) => {
        const tag = elh('span', 'tag'); tag.appendChild(elh('span', null, t));
        const x = elh('button', null, '✕'); x.onclick = () => { arr.splice(i, 1); scheduleSave(); render(); };
        tag.appendChild(x); wrap.appendChild(tag);
      });
      const inp = elh('input'); inp.placeholder = 'Ajouter un équipement + Entrée';
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && inp.value.trim()) { e.preventDefault(); arr.push(inp.value.trim()); scheduleSave(); render(); wrap.querySelector('input').focus(); }
      });
      wrap.appendChild(inp);
    }
    render();
    return wrap;
  }

  // Éditeur galerie (pièces + photos)
  function roomsEditor(rooms) {
    const box = elh('div');
    function render() {
      box.innerHTML = '';
      rooms.forEach((room, ri) => {
        const rb = elh('div', 'room-block');
        const head = elh('div', 'obj-head');
        head.appendChild(elh('span', 'obj-title', room.name || 'Pièce'));
        const tools = elh('div');
        const up = elh('button', 'btn sm', '↑'); up.onclick = () => { if (ri > 0) { [rooms[ri - 1], rooms[ri]] = [rooms[ri], rooms[ri - 1]]; scheduleSave(); render(); } };
        const dn = elh('button', 'btn sm', '↓'); dn.onclick = () => { if (ri < rooms.length - 1) { [rooms[ri + 1], rooms[ri]] = [rooms[ri], rooms[ri + 1]]; scheduleSave(); render(); } };
        const del = elh('button', 'btn sm danger', '✕'); del.onclick = () => { if (confirm('Supprimer cette pièce ?')) { rooms.splice(ri, 1); scheduleSave(); render(); } };
        tools.append(up, dn, del); head.appendChild(tools); rb.appendChild(head);

        const nameF = fieldText(room, 'name', 'Nom de la pièce');
        nameF.querySelector('input').addEventListener('input', (e) => head.querySelector('.obj-title').textContent = e.target.value || 'Pièce');
        rb.appendChild(nameF);

        rb.appendChild(elh('label', null, 'Équipements'));
        if (!Array.isArray(room.equipment)) room.equipment = [];
        rb.appendChild(tagInput(room.equipment));

        rb.appendChild(elh('label', null, 'Photos'));
        if (!Array.isArray(room.images)) room.images = [];
        const thumbs = elh('div', 'thumbs');
        room.images.forEach((src, ii) => {
          const th = elh('div', 'thumb');
          const img = elh('img'); img.src = '/preview/' + src; th.appendChild(img);
          const rm = elh('button', 'rm', '✕'); rm.onclick = () => { room.images.splice(ii, 1); scheduleSave(); render(); };
          const l = elh('button', 'mv l', '‹'); l.onclick = () => { if (ii > 0) { [room.images[ii - 1], room.images[ii]] = [room.images[ii], room.images[ii - 1]]; scheduleSave(); render(); } };
          const r = elh('button', 'mv r', '›'); r.onclick = () => { if (ii < room.images.length - 1) { [room.images[ii + 1], room.images[ii]] = [room.images[ii], room.images[ii + 1]]; scheduleSave(); render(); } };
          th.append(rm, l, r); thumbs.appendChild(th);
        });
        rb.appendChild(thumbs);

        const up2 = elh('div', 'uploader');
        const file = elh('input'); file.type = 'file'; file.accept = 'image/*'; file.multiple = true;
        file.addEventListener('change', async () => {
          if (!file.files.length) return;
          const fd = new FormData(); Array.from(file.files).forEach((f) => fd.append('photos', f));
          toast('Téléversement…');
          try {
            const r = await fetch('/api/upload?folder=rooms/' + slug(room.name), { method: 'POST', body: fd });
            const j = await r.json();
            if (!j.ok) throw new Error(j.error || 'échec');
            room.images.push(...j.paths); scheduleSave(); render(); toast('Photos ajoutées ✓', 'ok');
          } catch (e) { toast('Erreur upload : ' + e.message, 'err'); }
        });
        up2.appendChild(file); rb.appendChild(up2);
        box.appendChild(rb);
      });
      const add = elh('button', 'addbtn', '+ Ajouter une pièce');
      add.onclick = () => { rooms.push({ name: 'Nouvelle pièce', equipment: [], images: [] }); scheduleSave(); render(); };
      box.appendChild(add);
    }
    render();
    return box;
  }

  /* ─────────── Panneaux ─────────── */
  function card(title, node) { const c = elh('div', 'card'); if (title) c.appendChild(elh('h3', null, title)); if (node) c.appendChild(node); return c; }
  function head(title, desc) { const h = elh('div', 'panel-head'); h.appendChild(elh('h2', null, title)); if (desc) h.appendChild(elh('p', null, desc)); return h; }

  const DIR_FIELDS = [
    { key: 'name', label: 'Nom', full: true },
    { key: 'type', label: 'Type / catégorie' },
    { key: 'phone', label: 'Téléphone' },
    { key: 'address', label: 'Adresse', full: true },
  ];
  const PLACE_FIELDS = [
    { key: 'name', label: 'Nom', full: true },
    { key: 'desc', label: 'Description', textarea: true },
    { key: 'meta', label: 'Infos (horaires, distance…)', full: true },
  ];

  function directoryPanel(block) {
    const frag = elh('div');
    frag.appendChild(card('Introduction', fieldText(block, 'intro', 'Texte d\'introduction', { textarea: true })));
    if (!Array.isArray(block.groups)) block.groups = [];
    const groupsBox = elh('div');
    function renderGroups() {
      groupsBox.innerHTML = '';
      block.groups.forEach((grp, gi) => {
        const c = elh('div', 'card');
        const h = elh('div', 'obj-head');
        h.appendChild(elh('h3', null, grp.title || 'Catégorie'));
        const tools = elh('div');
        const up = elh('button', 'btn sm', '↑'); up.onclick = () => { if (gi > 0) { [block.groups[gi - 1], block.groups[gi]] = [block.groups[gi], block.groups[gi - 1]]; scheduleSave(); renderGroups(); } };
        const dn = elh('button', 'btn sm', '↓'); dn.onclick = () => { if (gi < block.groups.length - 1) { [block.groups[gi + 1], block.groups[gi]] = [block.groups[gi], block.groups[gi + 1]]; scheduleSave(); renderGroups(); } };
        const del = elh('button', 'btn sm danger', '✕'); del.onclick = () => { if (confirm('Supprimer cette catégorie ?')) { block.groups.splice(gi, 1); scheduleSave(); renderGroups(); } };
        tools.append(up, dn, del); h.appendChild(tools); c.appendChild(h);
        const tf = fieldText(grp, 'title', 'Titre de la catégorie');
        tf.querySelector('input').addEventListener('input', (e) => h.querySelector('h3').textContent = e.target.value || 'Catégorie');
        c.appendChild(tf);
        if (!Array.isArray(grp.items)) grp.items = [];
        c.appendChild(objectList(grp.items, DIR_FIELDS, { titleKey: 'name', addLabel: 'Ajouter une adresse' }));
        groupsBox.appendChild(c);
      });
      const add = elh('button', 'addbtn', '+ Ajouter une catégorie');
      add.onclick = () => { block.groups.push({ title: 'Nouvelle catégorie', items: [] }); scheduleSave(); renderGroups(); };
      groupsBox.appendChild(add);
    }
    renderGroups();
    frag.appendChild(groupsBox);
    return frag;
  }

  function placesPanel(block) {
    const frag = elh('div');
    frag.appendChild(card('Introduction', fieldText(block, 'intro', 'Texte d\'introduction', { textarea: true })));
    if (!Array.isArray(block.places)) block.places = [];
    frag.appendChild(card('Lieux', objectList(block.places, PLACE_FIELDS, { titleKey: 'name', addLabel: 'Ajouter un lieu' })));
    return frag;
  }

  // Définition des panneaux (ordre du menu)
  function panels() {
    const d = content;
    return [
      ['meta', 'Présentation', () => {
        const f = elh('div');
        f.appendChild(card('Identité', (() => { const g = elh('div');
          g.appendChild(fieldText(d.meta, 'apartmentName', 'Nom de l\'appartement'));
          g.appendChild(fieldText(d.meta, 'tagline', 'Accroche'));
          g.appendChild(fieldText(d.meta, 'city', 'Ville'));
          g.appendChild(fieldText(d.meta, 'region', 'Région'));
          g.appendChild(fieldText(d.meta, 'motto', 'Devise (entre guillemets)'));
          g.appendChild(fieldText(d.meta, 'bookingUrl', 'Lien du bouton « Réservez votre prochain séjour »'));
          return g; })()));
        return f;
      }],
      ['welcome', 'Mot de bienvenue', () => {
        const f = elh('div');
        f.appendChild(card('Titre', fieldText(d.welcome, 'title', 'Titre')));
        d.welcome.paragraphs = d.welcome.paragraphs || [];
        f.appendChild(card('Paragraphes', stringList(d.welcome.paragraphs, { addLabel: 'Ajouter un paragraphe' })));
        f.appendChild(card('Signature', fieldText(d.welcome, 'signature', 'Signature')));
        return f;
      }],
      ['practical', 'Infos pratiques', () => {
        const f = elh('div');
        const w = d.practical.wifi || (d.practical.wifi = {});
        f.appendChild(card('Wi-Fi', (() => { const g = elh('div'); g.appendChild(fieldText(w, 'network', 'Réseau (SSID)')); g.appendChild(fieldText(w, 'password', 'Mot de passe')); return g; })()));
        const ar = d.practical.arrival || (d.practical.arrival = {});
        f.appendChild(card('Arrivée & départ', (() => { const g = elh('div');
          g.appendChild(fieldText(ar, 'checkIn', 'Heure d\'arrivée'));
          g.appendChild(fieldText(ar, 'checkOut', 'Heure de départ'));
          g.appendChild(fieldText(ar, 'keys', 'Remise des clés', { textarea: true }));
          g.appendChild(fieldText(ar, 'instructions', 'Instructions détaillées (optionnel)', { textarea: true }));
          return g; })()));
        const ad = d.practical.address || (d.practical.address = {});
        f.appendChild(card('Adresse & accès', (() => { const g = elh('div');
          g.appendChild(fieldText(ad, 'full', 'Adresse complète'));
          g.appendChild(fieldText(ad, 'floor', 'Étage / porte'));
          g.appendChild(fieldText(ad, 'buildingCode', 'Code immeuble'));
          g.appendChild(fieldText(ad, 'parking', 'Stationnement', { textarea: true }));
          return g; })()));
        const as = d.practical.assistance || (d.practical.assistance = {});
        as.phones = as.phones || [];
        const cc = elh('div');
        cc.appendChild(elh('label', null, 'Téléphones d\'assistance'));
        cc.appendChild(stringList(as.phones, { addLabel: 'Ajouter un numéro' }));
        cc.appendChild(fieldText(as, 'availability', 'Disponibilité'));
        f.appendChild(card('Assistance', cc));
        return f;
      }],
      ['comfort', 'Le logement', () => {
        const f = elh('div');
        f.appendChild(card('Introduction', fieldText(d.comfort, 'intro', 'Introduction', { textarea: true })));
        d.comfort.sections = d.comfort.sections || [];
        const box = elh('div');
        function r() {
          box.innerHTML = '';
          d.comfort.sections.forEach((s, si) => {
            const c = elh('div', 'card');
            const h = elh('div', 'obj-head'); h.appendChild(elh('h3', null, s.title || 'Rubrique'));
            const del = elh('button', 'btn sm danger', '✕'); del.onclick = () => { d.comfort.sections.splice(si, 1); scheduleSave(); r(); };
            h.appendChild(del); c.appendChild(h);
            const tf = fieldText(s, 'title', 'Titre'); tf.querySelector('input').addEventListener('input', (e) => h.querySelector('h3').textContent = e.target.value);
            c.appendChild(tf);
            s.items = s.items || [];
            c.appendChild(stringList(s.items, { addLabel: 'Ajouter une consigne' }));
            box.appendChild(c);
          });
          const add = elh('button', 'addbtn', '+ Ajouter une rubrique'); add.onclick = () => { d.comfort.sections.push({ title: 'Nouvelle rubrique', items: [] }); scheduleSave(); r(); };
          box.appendChild(add);
        }
        r(); f.appendChild(box);
        return f;
      }],
      ['gallery', 'Galerie (photos)', () => {
        const f = elh('div');
        f.appendChild(card('Introduction', fieldText(d.gallery, 'intro', 'Introduction')));
        d.gallery.rooms = d.gallery.rooms || [];
        f.appendChild(card('Pièces & photos', roomsEditor(d.gallery.rooms)));
        return f;
      }],
      ['rules', 'Règles', () => {
        const f = elh('div');
        d.rules.respect = d.rules.respect || []; d.rules.beforeLeaving = d.rules.beforeLeaving || [];
        f.appendChild(card('Le respect des lieux', stringList(d.rules.respect, { addLabel: 'Ajouter une règle' })));
        f.appendChild(card('Avant votre départ', stringList(d.rules.beforeLeaving, { addLabel: 'Ajouter une consigne' })));
        f.appendChild(card('Remerciement', fieldText(d.rules, 'thanks', 'Message de remerciement', { textarea: true })));
        return f;
      }],
      ['discover', 'Découvrir', () => placesPanel(d.discover)],
      ['stroll', 'Flâner & respirer', () => placesPanel(d.stroll)],
      ['eat', 'Où manger', () => directoryPanel(d.eat)],
      ['drinks', 'Bars & gourmandises', () => directoryPanel(d.drinks)],
      ['services', 'Services & locations', () => directoryPanel(d.services)],
      ['shops', 'Commerces & courses', () => directoryPanel(d.shops)],
      ['escapes', 'Grandes escapades', () => placesPanel(d.escapes)],
      ['digoinCharolles', 'Digoin & Charolles', () => {
        const f = elh('div');
        f.appendChild(card('Introduction', fieldText(d.digoinCharolles, 'intro', 'Introduction', { textarea: true })));
        ['digoin', 'charolles'].forEach((key) => {
          const b = d.digoinCharolles[key] || (d.digoinCharolles[key] = { title: '', places: [] });
          b.places = b.places || [];
          const c = elh('div', 'card');
          c.appendChild(fieldText(b, 'title', 'Titre (' + key + ')'));
          c.appendChild(objectList(b.places, PLACE_FIELDS, { titleKey: 'name', addLabel: 'Ajouter un lieu' }));
          f.appendChild(c);
        });
        return f;
      }],
      ['numbers', 'Numéros utiles', () => {
        const f = elh('div');
        const NF = [{ key: 'label', label: 'Libellé' }, { key: 'number', label: 'Numéro' }];
        d.numbers.emergency = d.numbers.emergency || []; d.numbers.daily = d.numbers.daily || [];
        f.appendChild(card('Urgences', objectList(d.numbers.emergency, NF, { titleKey: 'label', addLabel: 'Ajouter un numéro' })));
        f.appendChild(card('Au quotidien', objectList(d.numbers.daily, NF, { titleKey: 'label', addLabel: 'Ajouter un numéro' })));
        return f;
      }],
      ['goodbye', 'Au revoir', () => {
        const f = elh('div');
        f.appendChild(card('Titre', fieldText(d.goodbye, 'title', 'Titre')));
        f.appendChild(card('Message', fieldText(d.goodbye, 'text', 'Message d\'au revoir', { textarea: true })));
        return f;
      }],
    ];
  }

  /* ─────────── Publication ─────────── */
  function openPublish() {
    const modal = $('publishModal'), body = $('publishBody');
    modal.classList.add('open');
    body.innerHTML = '<p><span class="spin"></span> Analyse des changements…</p>';
    fetch('/api/status').then((r) => r.json()).then((j) => {
      if (j.error) { body.innerHTML = '<p style="color:var(--danger)">Erreur : ' + j.error + '</p>'; return; }
      if (j.clean) { body.innerHTML = '<p>Aucun changement à publier — le site en ligne est déjà à jour.</p>'; $('publishConfirm').style.display = 'none'; return; }
      $('publishConfirm').style.display = '';
      const kindCls = (k) => k === 'Ajouté' ? 'add' : (k === 'Supprimé' ? 'del' : 'mod');
      let h = '<p style="margin-bottom:14px">Ces changements seront publiés en ligne :</p>';
      h += j.files.map((f) => `<div class="chg"><span class="k ${kindCls(f.kind)}">${f.kind}</span><span class="f">${f.file}</span></div>`).join('');
      h += '<div class="field" style="margin-top:18px"><label>Description de la mise à jour (optionnel)</label><input type="text" id="commitMsg" placeholder="ex. Mise à jour des restaurants"></div>';
      body.innerHTML = h;
    }).catch((e) => body.innerHTML = '<p style="color:var(--danger)">Erreur : ' + e.message + '</p>');
  }
  function closePublish() { $('publishModal').classList.remove('open'); $('publishConfirm').style.display = ''; }
  async function doPublish() {
    const btn = $('publishConfirm'); const msg = (document.getElementById('commitMsg') || {}).value || '';
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Publication…';
    try {
      await save(); // garantir l'enregistrement
      const r = await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) });
      const j = await r.json();
      if (!j.ok) throw new Error((j.step ? '[' + j.step + '] ' : '') + (j.error || 'échec'));
      closePublish(); toast('Publié ✓ — Netlify déploie la mise à jour.', 'ok');
    } catch (e) { toast('Publication : ' + e.message, 'err'); }
    finally { btn.disabled = false; btn.textContent = 'Publier maintenant'; }
  }

  /* ─────────── Init ─────────── */
  function buildNav(list) {
    const nav = $('sidenav'); nav.innerHTML = '';
    list.forEach(([id, label], i) => {
      const a = elh('a', i === 0 ? 'active' : '', label); a.href = '#' + id; a.dataset.id = id;
      a.onclick = (e) => { e.preventDefault(); show(id); };
      nav.appendChild(a);
    });
  }
  const cachePanels = {};
  let PANELS = [];
  function show(id) {
    const main = $('main'); main.innerHTML = '';
    document.querySelectorAll('.sidenav a').forEach((a) => a.classList.toggle('active', a.dataset.id === id));
    const def = PANELS.find((p) => p[0] === id); if (!def) return;
    main.appendChild(head(def[1]));
    const panel = elh('div', 'panel active');
    panel.appendChild(def[2]());
    main.appendChild(panel);
    window.scrollTo(0, 0);
  }

  async function init() {
    try {
      const cfg = await (await fetch('/api/config')).json();
      $('appName').textContent = cfg.appName || 'Livret';
      document.title = 'Éditeur — ' + (cfg.appName || 'Livret');
      content = await (await fetch('/api/content')).json();
    } catch (e) { document.getElementById('main').innerHTML = '<p style="padding:40px;color:var(--danger)">Impossible de charger le contenu : ' + e.message + '</p>'; return; }
    PANELS = panels();
    buildNav(PANELS.map((p) => [p[0], p[1]]));
    show(PANELS[0][0]);
    setState('Prêt', 'saved');

    $('publishBtn').onclick = openPublish;
    $('publishCancel').onclick = closePublish;
    $('publishModal').addEventListener('click', (e) => { if (e.target === $('publishModal')) closePublish(); });
    $('publishConfirm').onclick = doPublish;
  }
  init();
})();
