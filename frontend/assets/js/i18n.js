/* ────────────────────────────────────────────────────────────
   Traduction à la volée — le français est la source unique.
   Les drapeaux traduisent la page en direct via un service de
   traduction, avec mise en cache (localStorage) et repli propre.
   ──────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const LANGS = [
    { code: 'fr', flag: '🇫🇷', label: 'Français' },
    { code: 'en', flag: '🇬🇧', label: 'English' },
    { code: 'es', flag: '🇪🇸', label: 'Español' },
    { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
    { code: 'it', flag: '🇮🇹', label: 'Italiano' },
  ];
  const CACHE_KEY = 'booklet_tr_';   // + lang
  const STORE_LANG = 'booklet_lang';

  let nodes = [];        // { node, fr } — nœuds texte traduisibles
  let originals = [];    // textes FR d'origine (index aligné sur nodes)
  let current = 'fr';

  const note = document.getElementById('translateNote');
  function toast(msg, ms) {
    if (!note) return;
    note.textContent = msg; note.classList.add('show');
    clearTimeout(toast._t);
    if (ms) toast._t = setTimeout(() => note.classList.remove('show'), ms);
  }
  function hideToast() { if (note) note.classList.remove('show'); }

  // Faut-il traduire ce nœud ?
  function skip(node) {
    let p = node.parentElement;
    while (p) {
      const t = p.tagName;
      if (t === 'SCRIPT' || t === 'STYLE' || t === 'NOSCRIPT') return true;
      if (p.hasAttribute('data-notranslate')) return true;
      p = p.parentElement;
    }
    return false;
  }

  function collect() {
    nodes = []; originals = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const v = n.nodeValue;
        if (!v || !v.trim()) return NodeFilter.FILTER_REJECT;
        if (!/[a-zA-Zà-üÀ-Ü]/.test(v)) return NodeFilter.FILTER_REJECT; // ignore chiffres/symboles seuls
        if (skip(n)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) { nodes.push(n); originals.push(n.nodeValue); }
    // Éléments d'en-tête (nom appartement dans la nav) — on laisse tel quel (nom propre)
  }

  function restoreFR() {
    nodes.forEach((n, i) => { n.nodeValue = originals[i]; });
    document.documentElement.lang = 'fr';
  }

  function applyMap(lang, map) {
    nodes.forEach((n, i) => {
      const key = originals[i].trim();
      const tr = map[key];
      if (tr != null) {
        // conserve les espaces de bordure d'origine
        const lead = originals[i].match(/^\s*/)[0];
        const trail = originals[i].match(/\s*$/)[0];
        n.nodeValue = lead + tr + trail;
      }
    });
    document.documentElement.lang = lang;
  }

  function loadCache(lang) {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY + lang) || '{}'); } catch (e) { return {}; }
  }
  function saveCache(lang, map) {
    try { localStorage.setItem(CACHE_KEY + lang, JSON.stringify(map)); } catch (e) {}
  }

  // Traduit un LOT de textes en une seule requête (Google gtx).
  // Les chaînes sont jointes par des retours à la ligne ; l'endpoint les
  // renvoie alignées. On vérifie le compte : en cas de désalignement, on
  // renvoie null pour déclencher un repli chaîne par chaîne.
  async function gtxBatch(texts, lang, tries) {
    const safe = texts.map((t) => t.replace(/\s*\n\s*/g, ' '));
    const joined = safe.join('\n');
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl='
      + lang + '&dt=t&q=' + encodeURIComponent(joined);
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json();
      if (!Array.isArray(j) || !Array.isArray(j[0])) return null;
      const full = j[0].map((s) => (s && s[0]) ? s[0] : '').join('');
      const parts = full.split('\n');
      if (parts.length !== texts.length) return null; // désalignement
      return parts.map((p) => p.trim());
    } catch (e) {
      if ((tries || 0) < 1) { await new Promise((r) => setTimeout(r, 350)); return gtxBatch(texts, lang, (tries || 0) + 1); }
      return null;
    }
  }

  // Repli : une chaîne (gtx puis MyMemory).
  async function translateOne(text, lang) {
    try {
      const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl='
        + lang + '&dt=t&q=' + encodeURIComponent(text);
      const r = await fetch(url);
      if (r.ok) {
        const j = await r.json();
        if (Array.isArray(j) && Array.isArray(j[0])) return j[0].map((seg) => (seg && seg[0]) ? seg[0] : '').join('');
      }
    } catch (e) {}
    try {
      const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=fr|' + lang;
      const r = await fetch(url);
      if (r.ok) { const j = await r.json(); if (j && j.responseData && j.responseData.translatedText) return j.responseData.translatedText; }
    } catch (e) {}
    return null;
  }

  async function translateTo(lang) {
    const cache = loadCache(lang);
    const uniq = [];
    const seen = new Set();
    originals.forEach((o) => {
      const k = o.trim();
      if (!seen.has(k)) { seen.add(k); if (cache[k] == null) uniq.push(k); }
    });

    if (uniq.length === 0) { applyMap(lang, cache); hideToast(); return true; }

    // Découpe en lots (≤ 40 chaînes ou ≤ 3000 caractères encodés par requête)
    const batches = []; let cur = []; let curLen = 0;
    for (const t of uniq) {
      const l = t.length + 1;
      if (cur.length && (cur.length >= 40 || curLen + l > 3000)) { batches.push(cur); cur = []; curLen = 0; }
      cur.push(t); curLen += l;
    }
    if (cur.length) batches.push(cur);

    toast('Traduction…', 0);
    let failed = 0, doneB = 0;
    const CONC = 4; let bi = 0;
    async function worker() {
      while (bi < batches.length) {
        const batch = batches[bi++];
        let res = await gtxBatch(batch, lang);
        if (!res) { // repli chaîne par chaîne (alignement garanti)
          res = [];
          for (const t of batch) res.push(await translateOne(t, lang));
        }
        batch.forEach((t, i) => { if (res[i] != null && res[i] !== '') cache[t] = res[i]; else failed++; });
        doneB++;
        if (batches.length > 1) toast('Traduction… ' + Math.round((doneB / batches.length) * 100) + '%', 0);
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONC, batches.length) }, worker));
    saveCache(lang, cache);

    if (failed > uniq.length * 0.5) {
      toast('Traduction indisponible pour le moment — affichage en français.', 3500);
      restoreFR(); setActive('fr'); current = 'fr';
      try { localStorage.setItem(STORE_LANG, 'fr'); } catch (e) {}
      return false;
    }
    applyMap(lang, cache);
    toast(failed ? 'Traduit ✓' : 'Traduit ✓', 1600);
    return true;
  }

  function setActive(lang) {
    document.querySelectorAll('.flag-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });
  }

  async function switchTo(lang) {
    if (lang === current) return;
    current = lang;
    setActive(lang);
    try { localStorage.setItem(STORE_LANG, lang); } catch (e) {}
    if (lang === 'fr') { restoreFR(); hideToast(); return; }
    await translateTo(lang);
  }

  function buildFlags() {
    const wrap = document.getElementById('langFlags');
    if (!wrap) return;
    wrap.innerHTML = LANGS.map((l) =>
      `<button class="flag-btn" data-lang="${l.code}" title="${l.label}" aria-label="${l.label}">${l.flag}</button>`).join('');
    wrap.querySelectorAll('.flag-btn').forEach((b) => {
      b.addEventListener('click', () => switchTo(b.getAttribute('data-lang')));
    });
  }

  function init() {
    collect();
    buildFlags();
    let saved = 'fr';
    try { saved = localStorage.getItem(STORE_LANG) || 'fr'; } catch (e) {}
    setActive('fr');
    current = 'fr';
    if (saved !== 'fr') { switchTo(saved); } // retraduit automatiquement à la volée
  }

  window.I18N = { init };
})();
