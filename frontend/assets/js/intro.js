/* Écran d'ouverture : la basilique se dessine, puis le rideau se lève. Une fois par session. */
(function () {
  var skip = location.hash || matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { if (sessionStorage.getItem('introSeen')) skip = true; } catch (e) {}
  if (skip) return;
  var root = document.documentElement;
  root.classList.add('intro-on');
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

  var closed = false;
  function close() {
    if (closed) return; closed = true;
    try { sessionStorage.setItem('introSeen', '1'); } catch (e) {}
    box.classList.add('out');
    setTimeout(function () { root.classList.remove('intro-on'); box.remove(); }, 850);
  }
  box.addEventListener('click', close);
  setTimeout(close, 8200); // filet de sécurité

  fetch('content.json').then(function (r) { return r.json(); }).then(function (d) {
    var m = d.meta || {};
    box.querySelector('.i-kick').textContent = m.city || '';
    box.querySelector('.i-name').textContent = m.apartmentName || '';
  }).catch(function () {});

  requestAnimationFrame(function () { requestAnimationFrame(function () { box.classList.add('go'); }); });
  setTimeout(close, 5800);
})();
