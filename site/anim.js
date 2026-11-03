'use strict';
/* Animations : écran d'ouverture avec le logo, changement d'onglet, apparition des événements, fiche d'événement. Désactivées si le téléphone demande moins de mouvement. */
(function () {
    var LOGO = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3862 2094"><path fill="#3E3E3D" fill-rule="evenodd" d="M3254 1800l-5 4l-2 6l1 86l9 7l41 -1l7 -8l0 -20l-2 -2l-11 1l-1 15l-3 3l-24 0l-3 -3l0 -31l2 -3l35 0l5 -3l2 -4l0 -39l-8 -8zM3264 1811l27 2l-1 28l-26 1l-3 -3l0 -25zM3114 1800l-2 2l0 93l2 4l6 4l33 -3l6 3l10 0l2 -2l0 -99l-2 -2l-12 2l0 84l-3 3l-25 1l-3 -3l0 -85zM2889 1800l-2 2l0 99l12 2l2 -2l0 -99zM2634 1800l-7 9l0 85l5 7l5 2l41 -1l7 -9l0 -19l-12 -2l-2 16l-3 3l-24 0l-3 -3l0 -31l2 -3l35 0l6 -5l0 -43l-7 -6zM2644 1811l24 0l3 3l0 25l-3 3l-24 0l-3 -3l0 -25zM2315 1800l-2 2l0 94l2 4l5 3l33 -3l7 3l11 -1l1 -100l-2 -2l-12 2l0 84l-2 3l-26 1l-3 -3l0 -85zM1949 1800l-2 2l0 91l2 6l5 4l34 -3l6 3l10 0l2 -2l0 -99l-2 -2l-12 2l0 84l-2 3l-26 1l-3 -3l0 -85zM1454 1800l-7 8l1 89l9 6l42 -1l4 -2l3 -7l-1 -87l-6 -6zM1464 1812l25 0l3 3l0 72l-3 3l-25 0l-3 -3l0 -72zM1320 1801l-5 11l2 24l40 34l1 17l-3 3l-23 0l-3 -3l0 -18l-11 -2l-3 3l1 26l9 7l40 -1l6 -7l0 -29l-41 -36l-1 -15l2 -3l25 0l2 18l11 2l2 -2l0 -23l-7 -7zM1227 1800l-2 2l0 98l3 3l9 0l2 -2l0 -99zM1095 1801l-4 6l0 20l2 2l11 -2l0 -13l3 -3l25 0l3 3l0 25l-3 3l-33 0l-8 5l-2 8l1 42l7 6l33 -3l6 3l10 0l2 -2l-1 -96l-6 -5zM1106 1853l26 0l3 3l0 31l-3 3l-26 0l-3 -3l0 -31zM686 1801l-5 10l1 17l11 1l2 -2l0 -13l3 -3l24 0l3 2l0 27l-3 2l-32 0l-9 6l-1 47l8 8l32 -3l17 3l2 -2l-1 -96l-7 -5zM695 1854l27 -1l3 2l-1 34l-27 1l-3 -2zM2990 1800l-10 8l-3 9l1 72l12 12l29 2l3 3l0 33l3 3l8 0l3 -3l0 -137l-2 -2l-14 2zM3000 1811l19 1l3 3l0 72l-3 3l-20 0l-8 -8l0 -63zM2809 1800l-12 -1l-15 3l-19 -2l-2 2l0 99l2 2l12 -2l0 -85l3 -3l20 -1l3 3l0 16l12 2l2 -2l0 -24zM2450 1800l-2 2l0 99l11 2l3 -3l0 -85l22 -3l8 3l0 86l12 2l2 -2l0 -85l3 -3l25 -1l3 3l0 85l3 3l9 0l2 -2l-1 -97l-8 -5l-36 4l-8 -4l-28 3zM2233 1801l-16 -2l-17 3l-20 -2l-2 2l0 99l2 2l9 0l3 -3l0 -85l28 -3l3 3l0 86l2 2l12 -2l0 -94zM1637 1801l-16 -2l-17 3l-20 -2l-2 2l0 99l2 2l12 -2l0 -85l3 -3l25 -1l3 3l0 85l3 3l11 -2l0 -95zM913 1800l-2 2l0 99l2 2l12 -2l0 -85l3 -3l24 -1l3 3l0 85l3 3l9 0l2 -2l0 -85l3 -3l25 -1l3 3l0 86l12 2l2 -2l0 -94l-2 -4l-6 -4l-40 3l-6 -3l-26 3zM558 1795l-2 2l0 104l2 2l49 0l2 -2l-2 -7l-33 0l-3 -3l0 -94zM2676 1767l-17 -1l-15 24l9 0zM2887 1760l-1 15l13 2l2 -2l-1 -15zM1226 1760l-1 15l12 2l2 -16l-2 -2zM1869 1737l-9 0l-3 3l0 58l-30 2l-11 8l-4 8l0 71l4 9l10 7l27 -3l6 3l10 0l2 -2l0 -162zM1834 1812l20 0l3 3l0 73l-3 2l-19 1l-9 -8l0 -63zM1117 1312l-15 11l-5 14l0 259l3 10l9 11l19 6l121 0l11 -2l15 -11l6 -17l0 -253l-2 -9l-11 -15l-18 -6l-123 0zM1143 1348l91 0l3 3l0 231l-3 3l-91 0l-3 -3l0 -231zM981 1310l-2 2l0 309l2 2l38 0l3 -3l0 -307l-3 -3zM566 1316l-8 9l-4 10l-1 62l2 2l39 0l2 -2l0 -48l3 -3l89 0l2 3l0 88l-3 3l-108 0l-17 6l-6 6l-6 15l0 132l5 13l7 7l19 6l41 -2l66 -8l4 8l39 0l2 -2l0 -281l-6 -17l-7 -7l-18 -6l-118 0zM595 1473l92 0l3 3l0 105l-3 3l-92 2l-3 -3l0 -107zM1524 1314l-18 -6l-44 2l-63 8l-5 -8l-40 0l-2 2l0 309l2 2l40 0l2 -2l0 -267l3 -3l91 -2l3 3l0 269l2 2l40 0l2 -2l0 -282l-5 -17zM823 1213l-2 2l0 92l-3 3l-34 0l-2 2l1 35l35 1l3 3l1 249l6 12l14 9l76 2l2 -2l-1 -35l-52 -1l-3 -3l0 -231l3 -3l52 -1l1 -35l-2 -2l-51 0l-3 -3l0 -92l-2 -2zM398 1213l-2 2l0 92l-3 3l-33 0l-2 2l0 34l2 2l34 0l2 3l1 247l5 12l15 11l76 2l2 -2l0 -34l-2 -2l-52 0l-2 -3l0 -231l2 -3l52 0l2 -2l0 -34l-2 -2l-51 0l-3 -3l0 -92l-2 -2zM980 1188l-2 2l1 51l43 0l1 -51l-2 -2zM3561 1148l-17 14l-8 20l-1 104l5 20l17 23l176 145l0 92l-3 3l-128 0l-3 -3l0 -104l-2 -2l-61 0l-2 2l0 117l4 18l6 11l13 11l26 7l167 0l21 -5l16 -12l10 -23l1 -113l-5 -22l-8 -14l-13 -13l-173 -141l0 -80l2 -3l129 0l3 3l0 90l2 2l60 0l2 -2l0 -102l-4 -19l-15 -20l-26 -9l-171 0zM3177 1143l-1 5l94 207l9 25l-111 244l2 2l60 0l3 -2l78 -182l4 -3l81 186l64 1l2 -2l-111 -246l2 -9l102 -225l-62 -1l-71 163l-7 10l-75 -173zM3026 1143l-3 3l0 477l3 3l60 0l3 -3l0 -478l-2 -2zM2044 1143l-2 2l0 439l8 25l12 12l24 8l76 -4l89 -12l3 3l2 10l62 -1l1 -480l-2 -2l-61 0l-2 2l0 415l-3 3l-141 4l-3 -3l0 -419l-2 -2zM2427 1145l1 480l62 1l3 -3l0 -414l2 -3l117 -4l22 0l3 3l1 420l61 1l3 -3l0 -414l9 -4l133 -3l2 3l0 418l3 3l62 -1l1 -442l-7 -22l-11 -12l-24 -9l-34 0l-142 18l-12 -10l-22 -8l-62 2l-100 14l-5 -3l-2 -10l-62 0zM1914 1147l-21 -7l-37 0l-129 16l-3 -2l0 -8l-3 -3l-61 0l-2 2l0 479l2 2l61 0l3 -3l0 -414l9 -4l133 -3l3 3l0 418l3 3l61 0l2 -2l0 -442l-8 -23zM127 1121l-14 7l-11 17l0 125l6 15l10 14l139 163l1 118l-2 3l-107 0l-2 -3l0 -118l-2 -2l-42 0l-2 2l1 136l4 9l10 10l17 6l140 0l9 -2l15 -11l7 -18l-1 -135l-11 -22l-144 -168l-1 -104l2 -3l107 0l2 3l0 108l2 2l42 0l2 -2l-1 -127l-5 -10l-8 -8l-15 -6zM3022 1024l-2 2l0 85l2 2l64 0l2 -2l0 -85l-2 -2zM2993 766l-5 -2l-46 8l-103 12l-167 14l-221 12l-198 6l-248 3l-221 -1l-288 -8l-255 -14l-2 4l11 5l52 12l130 24l214 26l127 10l121 6l262 2l125 -4l133 -8l91 -8l149 -18l120 -20l102 -22l115 -34zM808 495l0 17l8 15l14 13l31 17l77 26l149 32l136 20l169 18l204 14l213 7l347 -3l227 -12l178 -16l170 -22l117 -20l124 -28l60 -18l19 -9l-1 -3l-6 -1l-68 14l-166 20l-148 12l-178 10l-167 6l-243 4l-409 -4l-292 -12l-144 -10l-144 -14l-88 -12l-92 -18l-44 -14l-16 -8l-10 -9l-1 -6l8 -10l23 -12l61 -18l67 -12l5 -4l-4 -4l-71 5l-64 12l-18 6l-18 10l-9 9z"/><path fill="#D6D837" fill-rule="evenodd" d="M826 606l3 14l12 12l50 26l76 25l120 28l156 26l171 20l204 15l254 8l215 -2l167 -7l144 -10l125 -12l151 -20l154 -28l84 -20l27 -10l-1 -4l-7 -1l-116 14l-153 12l-344 16l-356 4l-368 -6l-314 -16l-121 -10l-124 -14l-88 -14l-56 -13l-46 -18l-10 -9l-3 -7zM1260 413l0 23l3 12l14 24l18 16l38 18l41 11l102 18l91 10l90 6l165 4l140 -1l199 -7l101 -10l97 -14l117 -24l58 -16l0 -4l-6 -2l-175 15l-129 5l-159 0l-343 -11l-146 -9l-121 -13l-72 -12l-32 -8l-20 -9l-8 -9l10 -12l22 -9l38 -10l82 -14l203 -18l132 -6l130 -2l4 -3l-3 -5l-61 -9l-172 -14l-174 -1l-92 6l-68 9l-42 10l-37 16l-23 21z"/><path fill="#939393" fill-rule="evenodd" d=""/></svg>');
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
