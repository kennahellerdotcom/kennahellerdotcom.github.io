// Magnetic grain: a fine layer of "iron filing" particles over the page, like the powder inside an
// Etch A Sketch seen up close. Every particle jitters around a home spot; near the mouse they are
// pulled into a loose swarm that trails the cursor, then drift slowly back home when it moves on.
// Tuning knobs are in CFG. Skipped on touch-only devices and when reduced motion is requested.
(function () {
  var CFG = {
    spacing: 22,       // px between particle home spots (smaller = denser grain)
    size: 1.6,         // particle size in CSS px
    color: '34,39,43', // ink, as r,g,b
    alpha: 0.24,       // base opacity of the grain
    radius: 150,       // reach of the "magnet" in px
    pull: 0.045,       // how hard the magnet pulls
    homeSpring: 0.012, // how quickly particles settle back home
    damping: 0.86,     // velocity kept each frame (higher = longer trails)
    jitter: 0.35,      // constant Brownian shimmer, px per frame
    avoid: 'tile'      // class name: never draw grain on top of these (the artwork)
  };

  if (!matchMedia('(pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:50;mix-blend-mode:multiply';
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  var W, H, dpr, P = [];
  var holes = document.getElementsByClassName(CFG.avoid); // live list, so filtered/re-laid tiles are picked up
  var mouse = { x: -9999, y: -9999, vx: 0, vy: 0, active: false };

  function seed() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    P = [];
    var s = CFG.spacing;
    for (var y = s / 2; y < H; y += s) {
      for (var x = s / 2; x < W; x += s) {
        // jittered grid so it reads as grain, not a pattern
        var hx = x + (Math.random() - .5) * s, hy = y + (Math.random() - .5) * s;
        var a = Math.random() * Math.PI * 2, r = 6 + Math.random() * CFG.radius * 0.35;
        P.push({
          hx: hx, hy: hy, x: hx, y: hy, vx: 0, vy: 0,
          ox: Math.cos(a) * r, oy: Math.sin(a) * r,          // where in the swarm this one wants to sit
          k: 0.6 + Math.random() * 0.8,                       // individual magnetism, so the swarm smears
          a: CFG.alpha * (0.45 + Math.random() * 0.55),
          s: CFG.size * (Math.random() < 0.15 ? 1.6 : 1)      // a few heavier filings
        });
      }
    }
  }

  addEventListener('mousemove', function (e) {
    mouse.vx = e.clientX - mouse.x; mouse.vy = e.clientY - mouse.y;
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
  }, { passive: true });
  document.addEventListener('mouseleave', function () { mouse.active = false; });
  var t; addEventListener('resize', function () { clearTimeout(t); t = setTimeout(seed, 150); });

  function frame() {
    ctx.clearRect(0, 0, W, H);
    // clip out every on-screen artwork so the grain only sits on the page around it
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H);
    for (var h = 0; h < holes.length; h++) {
      var r = holes[h].getBoundingClientRect();
      if (r.bottom > 0 && r.top < H && r.width) ctx.rect(r.left, r.top, r.width, r.height);
    }
    ctx.clip('evenodd');
    var R = CFG.radius, R2 = R * R, j = CFG.jitter;
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      var dx = mouse.x - p.x, dy = mouse.y - p.y, d2 = dx * dx + dy * dy;
      if (mouse.active && d2 < R2) {
        // falloff: strongest near the cursor; aim for this particle's spot in the swarm
        var f = (1 - Math.sqrt(d2) / R) * CFG.pull * p.k;
        p.vx += (mouse.x + p.ox - p.x) * f;
        p.vy += (mouse.y + p.oy - p.y) * f;
        // filings ride along with the stroke direction a little
        p.vx += mouse.vx * f * 0.6; p.vy += mouse.vy * f * 0.6;
      } else {
        p.vx += (p.hx - p.x) * CFG.homeSpring;
        p.vy += (p.hy - p.y) * CFG.homeSpring;
      }
      p.vx = p.vx * CFG.damping + (Math.random() - .5) * j;
      p.vy = p.vy * CFG.damping + (Math.random() - .5) * j;
      p.x += p.vx; p.y += p.vy;
      // moving filings catch the light: slightly darker while in motion
      var speed = Math.min(1, Math.abs(p.vx) + Math.abs(p.vy));
      ctx.fillStyle = 'rgba(' + CFG.color + ',' + Math.min(0.85, p.a + speed * 0.25).toFixed(3) + ')';
      ctx.fillRect(Math.round(p.x * dpr) / dpr, Math.round(p.y * dpr) / dpr, p.s, p.s);
    }
    ctx.restore();
    mouse.vx *= 0.5; mouse.vy *= 0.5;
    running = !document.hidden;
    if (running) requestAnimationFrame(frame);
  }
  // pause while the tab is hidden; restart exactly one loop when it comes back
  var running = false;
  function start() { if (!running && !document.hidden) { running = true; requestAnimationFrame(frame); } }
  document.addEventListener('visibilitychange', start);

  seed();
  start();
})();
