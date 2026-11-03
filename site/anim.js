'use strict';
/* Animations : écran d'ouverture avec le logo, changement d'onglet, apparition des événements, fiche d'événement. Désactivées si le téléphone demande moins de mouvement. */
(function () {
    var LOGO = 'data:image/png;base64,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';
  try {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    var css = document.createElement('style');
    css.textContent = [
      '#xsplash{position:fixed;inset:0;z-index:100;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;transition:opacity .5s ease}',
      '#xsplash.out{opacity:0}',
      '#xsplash img{display:block;width:min(78vw,420px);height:auto;opacity:0;transform:translateY(10px) scale(.96);animation:xs-logo .8s .1s cubic-bezier(.22,1,.36,1) forwards}',
      '#xsplash .xs-bar{width:min(46vw,240px);height:3px;margin-top:26px;background:#eceed2;overflow:hidden;opacity:0;animation:xs-fade .4s .5s ease forwards}',
      '#xsplash .xs-bar i{display:block;height:100%;width:100%;background:#D6D837;transform:translateX(-100%);animation:xs-run 1.1s .6s cubic-bezier(.4,0,.2,1) forwards}',
      '@keyframes xs-logo{to{opacity:1;transform:none}}@keyframes xs-fade{to{opacity:1}}@keyframes xs-run{to{transform:none}}',
      '@keyframes xa-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}',
      '@keyframes xa-fade{from{opacity:0}to{opacity:1}}',
      '@keyframes xa-up{from{transform:translateY(40px);opacity:.6}to{transform:none;opacity:1}}',
      '@keyframes xa-from-r{from{opacity:0;transform:translateX(44px)}to{opacity:1;transform:none}}',
      '@keyframes xa-from-l{from{opacity:0;transform:translateX(-44px)}to{opacity:1;transform:none}}',
      '.xa-r{animation:xa-from-r .5s cubic-bezier(.22,1,.36,1) both}',
      '.xa-l{animation:xa-from-l .5s cubic-bezier(.22,1,.36,1) both}',
      'html.xa-run,html.xa-run body{overflow-x:hidden}',
      '.xa-item{animation:xa-in .4s cubic-bezier(.2,.8,.2,1) both}',
      '.backdrop:not([hidden]){animation:xa-fade .2s ease both}',
      '.backdrop:not([hidden]) .sheet{animation:xa-up .3s cubic-bezier(.2,.8,.2,1) both}',
      '.xnav button{transition:color .2s ease,border-color .2s ease,transform .15s ease}.xnav button:active{transform:scale(.94)}',
      '.btn:active,.chip:active,.row:active{transform:scale(.98)}.btn,.chip,.row{transition:transform .12s ease}'
    ].join('');
    document.head.appendChild(css);

    /* Écran d'ouverture : logo sur fond blanc, à chaque ouverture de l'application (pas à chaque rechargement rapproché). */
    var show = true;
    try {
      var last = parseInt(localStorage.getItem('numixs-splash-at') || '0', 10);
      show = !last || Date.now() - last > 180000;
      localStorage.setItem('numixs-splash-at', String(Date.now()));
    } catch (e) {}
    if (show) {
      var im = new Image();
      im.alt = '';
      im.onload = function () {
        var s = document.createElement('div');
        s.id = 'xsplash'; s.setAttribute('aria-hidden', 'true');
        s.appendChild(im);
        var bar = document.createElement('div'); bar.className = 'xs-bar'; bar.innerHTML = '<i></i>';
        s.appendChild(bar);
        document.body.appendChild(s);
        setTimeout(function () { s.classList.add('out'); }, 1700);
        setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 2300);
      };
      im.src = LOGO;
    }

    /* Changement d'onglet : la page glisse depuis la droite (ou la gauche si on revient en arrière). */
    var order = ['agenda', 'billets', 'reseau', 'alertes'], cur = 0, runTimer = null, lastEl = null;
    function replay(el, dir) {
      if (!el) return;
      if (lastEl && lastEl !== el) lastEl.classList.remove('xa-r', 'xa-l');
      lastEl = el;
      el.classList.remove('xa-r', 'xa-l'); void el.offsetWidth; el.classList.add(dir);
      document.documentElement.classList.add('xa-run');
      clearTimeout(runTimer);
      runTimer = setTimeout(function () { el.classList.remove('xa-r', 'xa-l'); document.documentElement.classList.remove('xa-run'); }, 650);
    }
    document.addEventListener('click', function (x) {
      var b = x.target.closest && x.target.closest('[data-tab]');
      if (!b) return;
      var t = b.getAttribute('data-tab'), idx = order.indexOf(t);
      if (idx < 0 || idx === cur) return;
      var dir = idx > cur ? 'xa-r' : 'xa-l';
      cur = idx;
      setTimeout(function () {
        var target = t === 'agenda' ? document.getElementById('view') : document.querySelector('.xv');
        replay(target, dir);
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
