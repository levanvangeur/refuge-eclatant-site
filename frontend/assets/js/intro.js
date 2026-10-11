/* Écran d'ouverture : la basilique se dessine, puis fusionne avec l'en-tête du livret (le logo glisse vers sa place).
 * Une fois par session ; ignoré si le lien pointe vers une section (#ancre) ou si le visiteur réduit les animations. */
(function () {
  var skip = location.hash || matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { if (sessionStorage.getItem('introSeen')) skip = true; } catch (e) {}
  if (skip) return;
  var root = document.documentElement;
  // intro-on : défilement bloqué ; intro-hide-hero / intro-logo-wait : l'en-tête réel attend la fusion
  root.classList.add('intro-on', 'intro-hide-hero', 'intro-logo-wait');
  var P = [
    ['M5,640 L90,640 Q105,640 105,630', 0],
    ['M105,630 L105,543 L155,510 Q162,505 162,495 L162,265 L236,5 L313,262 L313,413 L395,468 L395,395 L453,266 L510,395 L508,612', 1],
    ['M162,265 L225,268 Q255,270 255,300 L257,435 Q258,445 268,440 L313,413', 2],
    ['M395,395 L455,395 Q478,395 478,418 L478,625 Q480,640 495,640 L612,640', 2],
    ['M128,640 L258,640 L258,575 Q258,530 299,530 Q340,530 340,575 L340,640', 3]
  ];
  var box = document.createElement('div');
  box.id = 'intro'; box.setAttribute('aria-hidden', 'true');
  box.innerHTML = '<svg viewBox="-10 -10 638 670">' + P.map(function (p) {
    return '<path pathLength="1" style="--o:' + p[1] + '" d="' + p[0] + '"/>';
  }).join('') + '</svg><div class="i-kick" data-notranslate></div><div class="i-name" data-notranslate></div><div class="i-rule"></div><div class="i-welcome">Bienvenue, gérez votre séjour depuis cette interface</div>';
  root.appendChild(box);

  var merged = false, finished = false;

  // Fin : le vrai logo apparaît en fondu à la place du tracé, puis l'écran d'intro disparaît
  function finish() {
    if (finished) return; finished = true;
    root.classList.remove('intro-logo-wait');
    var svg = box.querySelector('svg');
    if (svg) { svg.style.transition = 'opacity .35s ease'; svg.style.opacity = '0'; }
    setTimeout(function () { root.classList.remove('intro-on', 'intro-merge', 'intro-hide-hero'); box.remove(); }, 450);
  }

  // Fusion : le fond s'efface, l'en-tête apparaît, le logo glisse jusqu'à son emplacement exact dans l'en-tête
  function merge() {
    if (merged) return; merged = true;
    try { sessionStorage.setItem('introSeen', '1'); } catch (e) {}
    window.scrollTo(0, 0);
    var go = function () {
      box.classList.add('merging');
      root.classList.remove('intro-hide-hero'); root.classList.add('intro-merge');
      var logo = document.querySelector('.hero img.logo'), svg = box.querySelector('svg');
      var b = logo && logo.getBoundingClientRect();
      if (svg && b && b.width) {
        var a = svg.getBoundingClientRect();
        var dx = (b.left + b.width / 2) - (a.left + a.width / 2);
        var dy = (b.top + b.height / 2) - (a.top + a.height / 2);
        svg.style.transition = 'transform 1.1s cubic-bezier(.65,0,.25,1)';
        svg.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + (b.width / a.width) + ')';
        setTimeout(finish, 1150);
      } else { setTimeout(finish, 700); }
    };
    // le livret se construit après le chargement de content.json : on l'attend (4 s max)
    var tries = 0;
    (function wait() { if (document.querySelector('.hero-content') || tries++ > 40) go(); else setTimeout(wait, 100); })();
  }
  box.addEventListener('click', merge);
  setTimeout(merge, 8200); // filet de sécurité

  fetch('content.json').then(function (r) { return r.json(); }).then(function (d) {
    var m = d.meta || {};
    box.querySelector('.i-kick').textContent = m.city || '';
    box.querySelector('.i-name').textContent = m.apartmentName || '';
  }).catch(function () {});

  requestAnimationFrame(function () { requestAnimationFrame(function () { box.classList.add('go'); }); });
  setTimeout(merge, 4400);
})();
