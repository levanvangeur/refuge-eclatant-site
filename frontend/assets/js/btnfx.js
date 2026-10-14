/* Ajoute le décor animé (fond vivant) derrière chaque bouton animé du livret. Les couleurs des boutons ne changent pas. */
(function () {
  'use strict';
  const pop = (l, t, s, d) => `<span class="fx fx-pop" style="left:${l}px;top:${t}px;font-size:${s}px;animation-delay:${d}s"></span>`;
  const zz = (c, l, s, d) => `<span class="fx fx-z" data-z="${c}" style="left:${l}px;font-size:${s}px;animation-delay:${d}s"></span>`;
  const FX = {
    arrivee: '<span class="fx fx-sun"></span>',
    depart: '<span class="fx fx-st a"></span><span class="fx fx-st b"></span><span class="fx fx-st c"></span>',
    keybox: '<span class="fx fx-ring"></span><span class="fx fx-ring r2"></span>',
    reserve: '',
    frigo: '<span class="fx fx-snow a"></span><span class="fx fx-snow b"></span>',
    menage: pop(24, 8, 14, 0) + pop(70, 28, 10, .9) + pop(130, 4, 12, 1.7) + pop(200, 30, 16, .5) + pop(250, 6, 12, 1.3) + pop(292, 28, 10, 2.1),
    linge: zz('z', 30, 16, 0) + zz('Z', 48, 22, 1) + zz('z', 250, 16, 2) + zz('Z', 268, 24, 3),
  };

  function kindOf(b) {
    const href = b.getAttribute('href') || '';
    if (b.hasAttribute('data-keybox-btn')) return 'keybox';
    if (b.classList.contains('hero-cta') || b.classList.contains('nav-cta')) return 'reserve';
    if (b.classList.contains('fr-btn')) return 'frigo';
    if (/type=arrivee$/.test(href)) return 'arrivee';
    if (/type=depart$/.test(href)) return 'depart';
    if (/type=menage$/.test(href)) return 'menage';
    if (/type=linge$/.test(href)) return 'linge';
    return '';
  }

  // Calques « fait main » (hachures, grain, contour tremblé) : au-dessus des animations, sous le texte
  const HAND = '<span class="fxh fxh-hatch"></span><span class="fxh fxh-grain"></span><span class="fxh fxh-pen"></span><span class="fxh fxh-pen p2"></span>';
  function ensureFilters() {
    if (document.getElementById('fxFilters')) return;
    document.body.insertAdjacentHTML('beforeend', '<svg id="fxFilters" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
      + '<filter id="fxRough"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="3" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="3.2"/></filter>'
      + '<filter id="fxRough2"><feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="2" seed="11" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="3.6"/></filter>'
      + '<filter id="fxRough3" x="-15%" y="-40%" width="130%" height="180%"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="5" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="1.7"/></filter>'
      + '</defs></svg>');
  }

  // Petits boutons (téléphone, WhatsApp, carte, copier, avis, haut de page, langue) : même rendu, version fine
  const MINI = '<span class="fxh fxh-hatch"></span><span class="fxh fxh-grain"></span><span class="fxh fxh-pen mini"></span>';
  const MINI_SEL = '.map-link, .icon-btn, .copy-btn, .platform-btn, .to-top, .lang-current';

  window.btnFx = function () {
    ensureFilters();
    document.querySelectorAll(MINI_SEL).forEach((b) => {
      if (b.dataset.fxm) return;
      b.dataset.fxm = '1';
      b.insertAdjacentHTML('afterbegin', MINI.replace(/<span /g, '<span aria-hidden="true" '));
    });
    document.querySelectorAll('.el-btn, .fr-btn, .hero-cta, .nav-cta').forEach((b) => {
      if (b.dataset.fx) return;
      const k = kindOf(b);
      if (!k) return;
      b.dataset.fx = k;
      b.insertAdjacentHTML('afterbegin', (FX[k] + HAND).replace(/<span /g, '<span aria-hidden="true" '));
    });
  };
})();
