// Shared helpers for the redesign previews: category labels, responsive <img>, and an animated lightbox.
(function () {
  var CATS = { poster: 'Posters', illustration: 'Illustration', merch: 'Merch', branding: 'Branding' };
  var EASE = 'cubic-bezier(.2, .8, .2, 1)';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // artwork lives in img/ next to this script, wherever the page that loads it sits
  var IMG = (document.currentScript ? document.currentScript.src.replace(/[^\/]*$/, '') : '') + 'img/';

  function img(w, sizes) {
    var el = document.createElement('img');
    el.src = IMG + w.id + '-sm.jpg';
    el.srcset = IMG + w.id + '-sm.jpg 720w, ' + IMG + w.id + '.jpg 1600w';
    el.sizes = sizes || '(max-width: 700px) 50vw, 25vw';
    el.width = w.w;
    el.height = w.h;
    el.alt = w.title + ' — ' + w.client;
    el.loading = 'lazy';
    el.decoding = 'async';
    return el;
  }

  // Lightbox
  // open(items, index, { origin: fn(work) -> element }) — with an origin, the image zooms out of
  // that element on open and back into it on close; otherwise it fades.
  var box, bg, stage, pic, cap, btns, list = [], idx = 0, opts = {}, lastFocus, closing = false;

  function build() {
    box = document.createElement('div');
    box.className = 'lb';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Image viewer');
    box.innerHTML =
      '<div class="lb-bg"></div>' +
      '<div class="lb-stage"><img alt=""><div class="lb-cap" aria-live="polite"></div></div>' +
      '<button class="lb-btn lb-close" aria-label="Close">&times;</button>' +
      '<button class="lb-btn lb-prev" aria-label="Previous">&#8592;</button>' +
      '<button class="lb-btn lb-next" aria-label="Next">&#8594;</button>';
    document.body.appendChild(box);
    bg = box.querySelector('.lb-bg');
    stage = box.querySelector('.lb-stage');
    pic = stage.querySelector('img');
    cap = stage.querySelector('.lb-cap');
    btns = box.querySelectorAll('.lb-btn');
    box.querySelector('.lb-close').onclick = close;
    box.querySelector('.lb-prev').onclick = function () { go(-1); };
    box.querySelector('.lb-next').onclick = function () { go(1); };
    box.addEventListener('click', function (e) { if (e.target === bg || e.target === stage) close(); });
    var x0 = null;
    box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      x0 = null;
    });
    document.addEventListener('keydown', function (e) {
      if (!box.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    });
    addEventListener('resize', function () { if (box.classList.contains('open')) size(list[idx]); });
  }

  // Fit the artwork into the stage without upscaling past its real pixels
  function size(w) {
    var m = innerWidth <= 700;
    var aw = innerWidth - (m ? 24 : 128), ah = innerHeight - (m ? 56 + 72 + 54 : 56 + 24 + 54);
    var s = Math.min(aw / w.w, ah / w.h, 1);
    pic.style.width = Math.round(w.w * s) + 'px';
    pic.style.height = Math.round(w.h * s) + 'px';
  }

  function setWork(w) {
    size(w);
    pic.src = IMG + w.id + '-sm.jpg'; // already cached from the wall, so the first frame is instant
    pic.alt = w.title;
    var full = new Image();
    full.onload = function () { if (list[idx] === w) pic.src = full.src; };
    full.src = IMG + w.id + '.jpg';
    cap.innerHTML = '<b>' + w.title + '</b><span>' + w.client + '</span>';
    // warm the neighbours so arrowing through feels instant
    [-1, 1].forEach(function (d) { var n = list[(idx + d + list.length) % list.length]; if (n) new Image().src = IMG + n.id + '.jpg'; });
  }

  function originRect(w) {
    var el = opts.origin && opts.origin(w);
    if (!el || !el.isConnected) return null;
    var r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || !r.width) return null; // scrolled out of view: fade instead
    return { el: el, r: r };
  }

  function flip(from, to) {
    return 'translate(' + (from.left - to.left) + 'px,' + (from.top - to.top) + 'px) scale(' + (from.width / to.width) + ',' + (from.height / to.height) + ')';
  }

  function finishAll() { [pic, cap, bg].forEach(function (el) { el.getAnimations().forEach(function (a) { a.finish(); }); }); }

  function open(items, i, o) {
    if (!box) build();
    finishAll();
    closing = false;
    opts = o || {};
    lastFocus = document.activeElement;
    list = items; idx = i;
    setWork(list[idx]);
    box.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
    box.querySelector('.lb-close').focus({ preventScroll: true });
    if (reduce) return;

    var from = originRect(list[idx]);
    bg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
    [cap].concat([].slice.call(btns)).forEach(function (el) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: 220, easing: 'ease-out', fill: 'backwards' });
    });
    if (from) {
      from.el.style.visibility = 'hidden';
      var a = pic.animate([{ transform: flip(from.r, pic.getBoundingClientRect()), transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }],
        { duration: 460, easing: EASE });
      a.onfinish = a.oncancel = function () { from.el.style.visibility = ''; };
    } else {
      pic.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: EASE });
    }
  }

  function go(d) {
    if (closing || list.length < 2) return;
    finishAll();
    idx = (idx + d + list.length) % list.length;
    if (reduce) { setWork(list[idx]); return; }
    var out = { duration: 150, easing: 'ease-in', fill: 'forwards' };
    pic.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + (-d * 60) + 'px)' }], out);
    var a = cap.animate([{ opacity: 1 }, { opacity: 0 }], out);
    a.onfinish = function () {
      setWork(list[idx]);
      pic.getAnimations().forEach(function (x) { x.cancel(); });
      cap.getAnimations().forEach(function (x) { x.cancel(); });
      pic.animate([{ opacity: 0, transform: 'translateX(' + (d * 60) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: EASE });
      cap.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 60, easing: EASE, fill: 'backwards' });
    };
  }

  function done() {
    box.classList.remove('open');
    document.documentElement.style.overflow = '';
    closing = false;
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  function close() {
    if (closing) return;
    finishAll();
    closing = true;
    if (reduce) return done();
    var to = originRect(list[idx]);
    var fade = { duration: 200, easing: 'ease-in', fill: 'forwards' };
    bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: to ? 380 : 220, easing: 'ease-in', fill: 'forwards' });
    [cap].concat([].slice.call(btns)).forEach(function (el) { el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' }); });
    var a;
    if (to) {
      to.el.style.visibility = 'hidden';
      a = pic.animate([{ transform: 'none', transformOrigin: '0 0' }, { transform: flip(to.r, pic.getBoundingClientRect()), transformOrigin: '0 0' }],
        { duration: 380, easing: EASE, fill: 'forwards' });
    } else {
      a = pic.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }], fade);
    }
    a.onfinish = function () {
      if (to) to.el.style.visibility = '';
      [pic, cap, bg].concat([].slice.call(btns)).forEach(function (el) { el.getAnimations().forEach(function (x) { x.cancel(); }); });
      done();
    };
  }

  window.KH = { CATS: CATS, img: img, open: open, works: window.WORKS, EASE: EASE, reduce: reduce };
})();
