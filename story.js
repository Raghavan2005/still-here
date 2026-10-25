'use strict';
/* Opening story: a crowd of dots, the snap, the ones left behind.
   Canvas for picture, WebAudio for sound (all synthesised, no files). Starts on a tap because browsers block autoplay audio. */
(function () {
  const el = document.getElementById('story'); if (!el) return;
  const cv = el.querySelector('canvas'), ctx = cv.getContext('2d');
  const cap = document.getElementById('story-cap'), act = document.getElementById('story-act'), gate = document.getElementById('story-gate');
  const muteBtn = document.getElementById('story-mute');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let seen = false;
  try { seen = sessionStorage.getItem('story-seen') === '1'; } catch (e) {}
  const forced = /[?&]story\b/.test(location.search);

  /* [seconds, label, text, big?] */
  const SCRIPT = [
    [0.6, 'Yesterday · 11:42 a.m.', ''],
    [2.4, '', '8 billion people.\nAn ordinary morning.'],
    [6.0, '', 'Someone is making tea.\nA child is late for school.'],
    [9.6, '', 'A nurse is finishing a night shift.\nA grandmother is calling her son.'],
    [13.2, '', 'In a flat, a baby is asleep.\nHer mother is in the next room.'],
    [17.0, 'Yesterday', '11:42', true],
    [20.2, '', 'Then, in one instant,\nhalf of them were gone.'],
    [24.0, '', 'Not killed. Gone.\nNo warning. No bodies.'],
    [28.0, '', 'Half of every family.\nHalf of every hospital.\nHalf of every police station.'],
    [32.4, '', 'The people who would rescue others are grieving too.\nNo help is coming from outside.'],
    [37.2, '', 'But some of those left behind\ncannot ask for help.'],
    [41.0, '', 'A baby cannot phone.\nA bedridden woman cannot post.'],
    [44.8, '', 'Nobody knows they are there.'],
    [48.4, 'Day 1 after the Snap', 'Today is the day after.'],
    [51.6, 'Find them. Fast. Safely.', 'STILL HERE', true]
  ];
  const T_SNAP = 19.0, T_AMBER = 37.2, T_END = 51.6;

  let W, H, dpr, dots = [], parts = [], t0 = 0, last = 0, raf = 0, idx = -1, done = false, running = false;
  let wantSound = true, ac = null, master = null, soundOn = true, closeTimer = 0;

  /* ---------------- picture ---------------- */
  function size() {
    dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = W < 600 ? 13 : 30, rows = W < 600 ? 22 : 15;
    const old = dots.map(d => [d.gone, d.amber]);
    dots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      dots.push({ x: (c + .5 + (r % 2) * .25) * W / cols, y: (r + .5) * H / rows, gone: old[i] ? old[i][0] : Math.random() < .5, amber: false, spawned: false, ph: Math.random() * 6, rad: 2.2 + Math.random() * 1.6 });
      dots[i].tg = T_SNAP + (dots[i].x / W) * 2.6 + Math.random() * .5;
    }
    const keep = dots.filter(d => !d.gone);
    for (let k = 0; k < 8 && keep.length; k++) keep.splice(Math.floor(Math.random() * keep.length), 1)[0].amber = true;
  }

  function caption(i) {
    const [, label, text, big] = SCRIPT[i];
    cap.innerHTML = (label ? `<p class="l"></p>` : '') + (text ? `<p class="t${big ? ' big' : ''}"></p>` : '');
    if (label) cap.querySelector('.l').textContent = label;
    if (text) { const p = cap.querySelector('.t'); p.textContent = text; p.style.whiteSpace = 'pre-line'; }
  }

  function draw(t, dt) {
    ctx.clearRect(0, 0, W, H);
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
    parts = parts.filter(p => t - p.born < p.life);
    for (const p of parts) {
      const a = t - p.born; p.x += p.vx * dt * (1 + a * .4); p.y += p.vy * dt + Math.sin(a * 3 + p.x) * 15 * dt;
      ctx.fillStyle = `rgba(206,196,178,${.8 * (1 - a / p.life)})`; ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    const f = t - T_SNAP;
    if (f > 0 && f < .6) { ctx.fillStyle = `rgba(255,236,190,${.5 * (1 - f / .6)})`; ctx.fillRect(0, 0, W, H); }
  }

  function frame(now) {
    const t = (now - t0) / 1000, dt = Math.min(.05, (now - last) / 1000 || .016); last = now;
    while (idx + 1 < SCRIPT.length && t >= SCRIPT[idx + 1][0]) { idx++; caption(idx); if (idx === SCRIPT.length - 1) act.hidden = false; }
    draw(t, dt);
    raf = requestAnimationFrame(frame);
  }

  /* ---------------- sound ---------------- */
  function startAudio() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    stopAudio(true);
    ac = new AC(); if (ac.state === 'suspended') ac.resume();
    const comp = ac.createDynamicsCompressor();
    master = ac.createGain(); master.gain.value = soundOn ? .9 : 0; master.connect(comp); comp.connect(ac.destination);
    // echo bus: gives high notes and the boom a long empty-room tail
    const dly = ac.createDelay(1), fb = ac.createGain(), lp = ac.createBiquadFilter(), wet = ac.createGain();
    dly.delayTime.value = .43; fb.gain.value = .42; lp.type = 'lowpass'; lp.frequency.value = 1800; wet.gain.value = .55;
    dly.connect(lp); lp.connect(fb); fb.connect(dly); lp.connect(wet); wet.connect(master);
    const bus = ac.createGain(); bus.connect(master); bus.connect(dly);

    const S = ac.currentTime + .15;               // story time zero
    const at = s => S + s;
    const brown = (() => { const n = ac.sampleRate * 4, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } return b; })();
    const white = (() => { const n = ac.sampleRate * 2, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; })();

    const gainNode = (dest) => { const g = ac.createGain(); g.gain.value = 0; g.connect(dest || master); return g; };
    const env = (g, t, a, peak, d) => { const p = g.gain || g; p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(peak, t + a); p.exponentialRampToValueAtTime(.0001, t + a + d); };
    const tone = (f, t, a, peak, d, type, dest, f2) => { const o = ac.createOscillator(), g = gainNode(dest); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d); env(g, t, a, peak, d); o.connect(g); o.start(t); o.stop(t + a + d + .1); };
    const noise = (buf, ft, f0, f1, q, t, dur, gfn, dest) => { const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = gainNode(dest); s.buffer = buf; s.loop = true; fl.type = ft; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur); gfn(g.gain, t, dur); s.connect(fl); fl.connect(g); s.start(t); s.stop(t + dur + .2); return g; };

    // 1. ordinary morning: warm pad, crowd murmur, birds. All of it cut dead at the snap.
    const pad = gainNode(); pad.gain.setValueAtTime(0, at(0)); pad.gain.linearRampToValueAtTime(.05, at(3)); pad.gain.setValueAtTime(.05, at(T_SNAP - .05)); pad.gain.linearRampToValueAtTime(0, at(T_SNAP));
    [[110, 'triangle', 0], [164.8, 'triangle', 4], [220, 'sine', -3], [277.2, 'sine', 2]].forEach(([f, ty, dt]) => { const o = ac.createOscillator(); o.type = ty; o.frequency.value = f; o.detune.value = dt; o.connect(pad); o.start(at(0)); o.stop(at(T_SNAP)); });
    const mur = noise(brown, 'bandpass', 520, 0, .7, at(0), T_SNAP, (g, t, d) => { g.setValueAtTime(0, t); g.linearRampToValueAtTime(.075, t + 2.5); g.setValueAtTime(.075, t + d - .05); g.linearRampToValueAtTime(0, t + d); });
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .35; lg.gain.value = .02; lfo.connect(lg); lg.connect(mur.gain); lfo.start(at(0)); lfo.stop(at(T_SNAP));
    for (let t = 2.2; t < T_SNAP - 6; t += 1.1 + Math.random() * 1.6) { const f = 2600 + Math.random() * 1800; tone(f, at(t), .01, .03, .09, 'sine', bus, f * 1.35); tone(f * 1.1, at(t + .16), .01, .025, .08, 'sine', bus, f * 1.5); }
    // clock ticks, tightening towards 11:42
    for (let t = 13; t < T_SNAP - 1.5; t += (t < 16 ? 1 : .5)) { noise(white, 'highpass', 2500, 0, .5, at(t), .05, (g, tt, d) => env(g, tt, .001, .09, d)); tone(1100, at(t), .001, .03, .05, 'sine'); }
    // 2. the swell and the snap
    noise(white, 'bandpass', 300, 4200, 1.2, at(T_SNAP - 1.6), 1.6, (g, t, d) => { g.setValueAtTime(0, t); g.linearRampToValueAtTime(.34, t + d); });
    tone(90, at(T_SNAP - 1.6), 1.6, .1, .02, 'sawtooth', master, 700);
    tone(72, at(T_SNAP), .004, .95, 3.2, 'sine', bus, 24);
    tone(144, at(T_SNAP), .004, .35, 1.2, 'sine', master, 40);
    noise(white, 'lowpass', 3500, 110, .7, at(T_SNAP), 1.5, (g, t, d) => env(g, t, .004, .65, d), bus);
    noise(white, 'highpass', 3000, 0, .5, at(T_SNAP), .08, (g, t, d) => env(g, t, .001, .5, d));
    // 3. ash hiss, then near silence with a low room tone
    noise(white, 'bandpass', 6000, 0, .8, at(T_SNAP + .3), 4.6, (g, t, d) => { g.setValueAtTime(0, t); g.linearRampToValueAtTime(.05, t + .8); g.linearRampToValueAtTime(0, t + d); });
    noise(brown, 'lowpass', 150, 0, .5, at(T_SNAP + 1.2), T_END + 12 - T_SNAP, (g, t, d) => { g.setValueAtTime(0, t); g.linearRampToValueAtTime(.035, t + 3); });
    // grief: a very low drone that creeps in after the silence
    const dr = gainNode(); dr.gain.setValueAtTime(0, at(T_SNAP + 3)); dr.gain.linearRampToValueAtTime(.07, at(T_AMBER)); dr.gain.linearRampToValueAtTime(.025, at(T_END + 4));
    [[55, 0], [82.4, 5], [58, 0]].forEach(([f, dt]) => { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = dt; o.connect(dr); o.start(at(T_SNAP + 3)); o.stop(at(T_END + 12)); });
    // 4. the ones who cannot ask: a heartbeat and calls nobody answers
    for (let t = T_AMBER; t < T_END - .6; t += 1.15) { tone(52, at(t), .01, .55, .2, 'sine'); tone(48, at(t + .23), .01, .34, .18, 'sine'); }
    const pent = [880, 987.8, 1174.7, 1318.5, 784];
    for (let t = T_AMBER + 1; t < T_END - 1; t += 2.3 + Math.random() * .9) tone(pent[Math.floor(Math.random() * pent.length)], at(t), .01, .05, 2.2, 'sine', bus);
    // 5. the day after: one open chord, held
    [146.8, 220, 293.7, 370, 440].forEach((f, i) => tone(f, at(T_END - .4 + i * .15), 1.8, .042, 8, i % 2 ? 'sine' : 'triangle', bus));
    return ac;
  }
  function stopAudio(now) {
    clearTimeout(closeTimer);
    if (!ac) return;
    const a = ac, m = master; ac = master = null;
    try { m.gain.setTargetAtTime(0, a.currentTime, now ? .01 : .25); } catch (e) {}
    closeTimer = setTimeout(() => { try { a.close(); } catch (e) {} }, now ? 80 : 1500);
  }
  function setMute(on) {
    soundOn = on; muteBtn.textContent = on ? 'Sound on' : 'Sound off'; muteBtn.setAttribute('aria-pressed', String(!on));
    if (ac && master) master.gain.setTargetAtTime(on ? .9 : 0, ac.currentTime, .05);
  }

  /* ---------------- flow ---------------- */
  function end() {
    if (done) return; done = true; running = false; cancelAnimationFrame(raf); stopAudio();
    try { sessionStorage.setItem('story-seen', '1'); } catch (e) {}
    el.classList.add('out'); document.body.classList.remove('storying');
    try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {}
    setTimeout(() => { el.hidden = true; }, 1000);
    const h = document.querySelector('#top-of-site h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  function showGate() { // first thing seen: dots at rest, a clear choice about sound
    cancelAnimationFrame(raf); stopAudio(true); running = false; done = false; idx = -1; parts = [];
    el.hidden = false; el.classList.remove('out'); act.hidden = true; muteBtn.hidden = true;
    document.body.classList.add('storying'); size(); dots.forEach(d => { d.spawned = false; }); draw(0, .016);
    if (reduce) { idx = SCRIPT.length - 1; caption(idx); act.hidden = false; gate.hidden = true; return; }
    cap.innerHTML = `<p class="l">Best with sound</p><p class="t">Day 1 after<br>the Snap</p>`;
    gate.hidden = false; document.getElementById('gate-sound').focus({ preventScroll: true });
  }
  function begin(withSound) {
    try { const r = document.documentElement; if (!document.fullscreenElement && r.requestFullscreen) r.requestFullscreen().catch(() => {}); } catch (e) {}
    gate.hidden = true; act.hidden = true; cap.innerHTML = ''; idx = -1; parts = []; done = false; running = true;
    dots.forEach(d => { d.spawned = false; });
    wantSound = withSound; muteBtn.hidden = !withSound; setMute(withSound);
    if (withSound) startAudio();        // inside the tap, so the browser allows it
    t0 = last = performance.now(); raf = requestAnimationFrame(frame);
    document.getElementById('story-skip').focus({ preventScroll: true });
  }

  document.getElementById('story-skip').onclick = end;
  document.getElementById('story-go').onclick = end;
  document.getElementById('gate-sound').onclick = () => begin(true);
  document.getElementById('gate-quiet').onclick = () => begin(false);
  document.getElementById('story-replay').onclick = () => { cancelAnimationFrame(raf); stopAudio(true); begin(wantSound); };
  muteBtn.onclick = () => setMute(!soundOn);
  addEventListener('keydown', e => { if (!done && !el.hidden && e.key === 'Escape') end(); });
  addEventListener('resize', () => { if (!done) { size(); if (!running) draw(0, .016); } });
  document.querySelectorAll('[data-replay-story]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); scrollTo(0, 0); showGate(); }));
  document.addEventListener('visibilitychange', () => { if (ac) document.hidden ? ac.suspend() : ac.resume(); });

  if (seen && !forced) { el.hidden = true; document.body.classList.remove('storying'); } else { showGate(); }
})();
