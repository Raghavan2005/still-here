'use strict';
/* Opening story: a crowd of dots, the snap, the ones left behind. Canvas + captions, no video, no audio. */
(function () {
  const el = document.getElementById('story'); if (!el) return;
  const cv = el.querySelector('canvas'), ctx = cv.getContext('2d');
  const cap = document.getElementById('story-cap'), act = document.getElementById('story-act');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let seen = false;
  try { seen = sessionStorage.getItem('story-seen') === '1'; } catch (e) {}
  const forced = /[?&]story\b/.test(location.search);

  /* [seconds, label, text, big?] */
  const SCRIPT = [
    [0.4, 'Yesterday · 11:42 a.m.', ''],
    [1.8, '', '8 billion people. An ordinary morning.'],
    [4.8, '', 'Then, in one instant, half of them were gone.'],
    [8.2, '', 'Not killed. Gone.\nNo warning. No bodies.'],
    [10.8, '', 'Some of those left behind cannot ask for help.'],
    [13.2, '', 'A baby cannot phone.\nA bedridden woman cannot post.'],
    [15.6, '', 'Nobody knows they are there.'],
    [17.8, 'Day 1 after the Snap', 'Today is the day after.'],
    [20.0, 'Find them. Fast. Safely.', 'STILL HERE', true]
  ];
  const T_SNAP = 4.4, T_AMBER = 10.8, T_END = 20.0;

  let W, H, dpr, dots = [], parts = [], t0 = 0, last = 0, raf = 0, idx = -1, done = false;

  function size() {
    dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = W < 600 ? 13 : 30, rows = W < 600 ? 22 : 15;
    const old = dots.map(d => [d.gone, d.amber]);
    dots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      dots.push({ x: (c + .5 + (r % 2) * .25) * W / cols, y: (r + .5) * H / rows, gone: old[i] ? old[i][0] : Math.random() < .5, amber: false, spawned: false, ph: Math.random() * 6, rad: 2.2 + Math.random() * 1.6 });
      dots[i].tg = T_SNAP + (dots[i].x / W) * 2.4 + Math.random() * .5;
    }
    const keep = dots.filter(d => !d.gone); // a handful of survivors who stay silent
    for (let k = 0; k < 8 && keep.length; k++) keep.splice(Math.floor(Math.random() * keep.length), 1)[0].amber = true;
  }

  function caption(i) {
    const [, label, text, big] = SCRIPT[i];
    cap.innerHTML = (label ? `<p class="l"></p>` : '') + (text ? `<p class="t${big ? ' big' : ''}"></p>` : '');
    if (label) cap.querySelector('.l').textContent = label;
    if (text) cap.querySelector('.t').textContent = text;
    if (text) cap.querySelector('.t').style.whiteSpace = 'pre-line';
  }

  function frame(now) {
    const t = (now - t0) / 1000, dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
    while (idx + 1 < SCRIPT.length && t >= SCRIPT[idx + 1][0]) { idx++; caption(idx); if (idx === SCRIPT.length - 1) act.hidden = false; }
    ctx.clearRect(0, 0, W, H);
    // survivors and the ones still standing
    for (const d of dots) {
      if (d.gone && t >= d.tg) {
        if (!d.spawned) { d.spawned = true; for (let k = 0; k < 5; k++) parts.push({ x: d.x + (Math.random() - .5) * 6, y: d.y + (Math.random() - .5) * 6, vx: 25 + Math.random() * 70, vy: -15 - Math.random() * 45, born: t, life: 2 + Math.random() * 2, s: 1 + Math.random() * 2 }); }
        continue;
      }
      const amber = d.amber && t >= T_AMBER;
      const wob = reduce ? 0 : Math.sin(t * 1.3 + d.ph) * .6;
      ctx.beginPath(); ctx.arc(d.x, d.y + wob, amber ? d.rad + 1.4 : d.rad, 0, 6.283);
      ctx.fillStyle = amber ? '#e0a100' : 'rgba(244,239,230,.5)'; ctx.fill();
      if (amber) { // a call nobody hears: rings that fade before reaching anyone
        for (let k = 0; k < 2; k++) {
          const p = ((t - T_AMBER) * .55 + d.ph / 6.3 + k * .5) % 1;
          ctx.beginPath(); ctx.arc(d.x, d.y, 6 + p * 46, 0, 6.283);
          ctx.strokeStyle = `rgba(224,161,0,${.55 * (1 - p)})`; ctx.lineWidth = 1.5; ctx.stroke();
        }
      }
    }
    // ash
    parts = parts.filter(p => t - p.born < p.life);
    for (const p of parts) {
      const a = t - p.born; p.x += p.vx * dt * (1 + a * .4); p.y += p.vy * dt + Math.sin(a * 3 + p.x) * 15 * dt;
      ctx.fillStyle = `rgba(206,196,178,${.8 * (1 - a / p.life)})`; ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    // the flash
    const f = t - T_SNAP;
    if (f > 0 && f < .6) { ctx.fillStyle = `rgba(255,236,190,${.45 * (1 - f / .6)})`; ctx.fillRect(0, 0, W, H); }
    raf = requestAnimationFrame(frame);
  }

  function end() {
    if (done) return; done = true; cancelAnimationFrame(raf);
    try { sessionStorage.setItem('story-seen', '1'); } catch (e) {}
    if (window.speechSynthesis) speechSynthesis.cancel();
    el.classList.add('out'); document.body.classList.remove('storying');
    setTimeout(() => { el.hidden = true; }, 1000);
    const h = document.querySelector('#top-of-site h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  function start() {
    done = false; idx = -1; parts = []; el.hidden = false; el.classList.remove('out'); act.hidden = true; cap.innerHTML = '';
    document.body.classList.add('storying'); size();
    dots.forEach(d => { d.spawned = false; });
    if (reduce) { // no motion: go straight to the closing card
      idx = SCRIPT.length - 1; caption(idx); act.hidden = false; return;
    }
    t0 = last = performance.now(); raf = requestAnimationFrame(frame);
    el.querySelector('#story-skip').focus({ preventScroll: true });
  }

  document.getElementById('story-skip').onclick = end;
  document.getElementById('story-go').onclick = end;
  document.getElementById('story-replay').onclick = () => { cancelAnimationFrame(raf); start(); };
  addEventListener('keydown', e => { if (!done && !el.hidden && (e.key === 'Escape')) end(); });
  addEventListener('resize', () => { if (!done) size(); });
  document.querySelectorAll('[data-replay-story]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); scrollTo(0, 0); start(); }));

  if (seen && !forced) { el.hidden = true; } else { start(); }
})();
