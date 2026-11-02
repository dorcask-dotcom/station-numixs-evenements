'use strict';
/* Animations : écran d'ouverture, changement d'onglet, apparition des événements, fiche d'événement. Désactivées si le téléphone demande moins de mouvement. */
(function () {
  try {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    var css = document.createElement('style');
    css.textContent = [
      '#xsplash{position:fixed;inset:0;z-index:100;background:#D6D837;color:#3E3E3D;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;pointer-events:none;transition:opacity .45s ease,transform .45s ease}',
      '#xsplash.out{opacity:0;transform:scale(1.04)}',
      '#xsplash .xs-name{font-family:var(--font-display,"Saira Extra Condensed",sans-serif);font-weight:700;font-size:clamp(34px,11.5vw,68px);line-height:1;white-space:nowrap;letter-spacing:.01em;opacity:0;transform:translateY(16px);animation:xs-rise .6s .25s cubic-bezier(.2,.8,.2,1) forwards}',
      '#xsplash .xs-tag{margin-top:10px;font-family:var(--font-display,"Saira Extra Condensed",sans-serif);font-size:clamp(14px,4.4vw,20px);letter-spacing:.22em;text-transform:uppercase;white-space:nowrap;opacity:0;animation:xs-rise .6s .5s cubic-bezier(.2,.8,.2,1) forwards}',
      '#xsplash .xs-px{display:flex;gap:8px;margin-bottom:22px}',
      '#xsplash .xs-px i{display:block;width:18px;height:18px;background:#3E3E3D;opacity:0;transform:scale(.2);animation:xs-pop .35s cubic-bezier(.3,1.6,.5,1) forwards}',
      '#xsplash .xs-px i:nth-child(2){animation-delay:.08s;background:#fff}#xsplash .xs-px i:nth-child(3){animation-delay:.16s;background:#0064EC}#xsplash .xs-px i:nth-child(4){animation-delay:.24s}',
      '@keyframes xs-rise{to{opacity:1;transform:none}}@keyframes xs-pop{to{opacity:1;transform:none}}',
      '@keyframes xa-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}',
      '@keyframes xa-fade{from{opacity:0}to{opacity:1}}',
      '@keyframes xa-up{from{transform:translateY(40px);opacity:.6}to{transform:none;opacity:1}}',
      '.xa-page{animation:xa-in .32s cubic-bezier(.2,.8,.2,1) both}',
      '.xa-item{animation:xa-in .4s cubic-bezier(.2,.8,.2,1) both}',
      '.backdrop:not([hidden]){animation:xa-fade .2s ease both}',
      '.backdrop:not([hidden]) .sheet{animation:xa-up .3s cubic-bezier(.2,.8,.2,1) both}',
      '.xnav button{transition:color .2s ease,border-color .2s ease,transform .15s ease}.xnav button:active{transform:scale(.94)}',
      '.btn:active,.chip:active,.row:active{transform:scale(.98)}.btn,.chip,.row{transition:transform .12s ease}'
    ].join('');
    document.head.appendChild(css);

    /* Écran d'ouverture : une fois par ouverture de l'application. */
    var seen = false;
    try { seen = sessionStorage.getItem('numixs-splash') === '1'; sessionStorage.setItem('numixs-splash', '1'); } catch (e) {}
    if (!seen) {
      var s = document.createElement('div');
      s.id = 'xsplash'; s.setAttribute('aria-hidden', 'true');
      s.innerHTML = '<div class="xs-px"><i></i><i></i><i></i><i></i></div><div class="xs-name">Station numixs</div><div class="xs-tag">La maison du numérique</div>';
      document.body.appendChild(s);
      setTimeout(function () { s.classList.add('out'); }, 1250);
      setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 1850);
    }

    /* Changement d'onglet. */
    function replay(el) {
      if (!el) return;
      el.classList.remove('xa-page'); void el.offsetWidth; el.classList.add('xa-page');
      setTimeout(function () { el.classList.remove('xa-page'); }, 450);
    }
    document.addEventListener('click', function (x) {
      var b = x.target.closest && x.target.closest('[data-tab]');
      if (!b) return;
      setTimeout(function () {
        var xv = document.querySelector('.xv');
        var target = b.getAttribute('data-tab') === 'agenda' ? document.getElementById('view') : xv;
        replay(target);
      }, 30);
    }, true);

    /* Apparition en cascade des événements de l'agenda. */
    var view = document.getElementById('view');
    function stagger() {
      if (!view) return;
      var n = 0;
      [].forEach.call(view.querySelectorAll('.row,.day,.empty'), function (el) {
        if (el.getAttribute('data-xa')) return;
        el.setAttribute('data-xa', '1');
        el.classList.add('xa-item');
        el.style.animationDelay = Math.min(n, 10) * 45 + 'ms';
        n++;
        setTimeout(function () { el.classList.remove('xa-item'); el.style.animationDelay = ''; }, 900);
      });
    }
    if (view && window.MutationObserver) {
      new MutationObserver(function () { stagger(); }).observe(view, { childList: true });
    }
    stagger();
  } catch (e) { /* les animations ne doivent jamais gêner l'application */ }
})();
