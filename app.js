'use strict';
/* STILL HERE – prototype. No backend: state lives in memory + localStorage, data is fake.
   Screens: home · report (4 steps) · nearby · visit · handover. */

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const ME = { name: 'Ravi', vouch: 'Vouched by Ward 12 volunteer group' };

const WHO = {
  baby:   { label: 'Baby or small child',        pts: 5, generic: 'Small child' },
  elder:  { label: 'Older person, can\'t move',  pts: 3, generic: 'Older person' },
  ill:    { label: 'Ill or after surgery',       pts: 3, generic: 'Person recovering' },
  disab:  { label: 'Person with a disability',   pts: 2, generic: 'Person with disability' },
  other:  { label: 'Someone else',               pts: 2, generic: 'Person' }
};
const NEED = {
  water:  { label: 'No food or water', pts: 2 },
  meds:   { label: 'Needs medicine',   pts: 3 },
  locked: { label: 'Locked in',        pts: 3 },
  stuck:  { label: 'Cannot get up',    pts: 2 },
  alone:  { label: 'Completely alone', pts: 1 }
};
const SINCE = { '<3':{label:'Under 3 hours',pts:0}, '3-12':{label:'3 – 12 hours',pts:2}, '12+':{label:'Since yesterday',pts:4} };
const HOW = {
  family: { label: 'I am family', trust: 2 },
  staff:  { label: 'Hospital / school / care staff', trust: 2 },
  saw:    { label: 'I heard or saw something', trust: 1 }
};

/* Urgency is a plain sum anyone can read. Level is shown with colour + shape + words (never colour alone). */
function urgency(c) {
  let s = (WHO[c.who]?.pts || 0) + (SINCE[c.since]?.pts || 0);
  (c.needs || []).forEach(n => s += NEED[n].pts);
  if (s >= 9) return { k: 'red',   icon: '▲', text: 'Go now · hours matter', score: s };
  if (s >= 6) return { k: 'amber', icon: '●', text: 'Today',                 score: s };
  return            { k: 'blue',  icon: '■', text: 'Within a day',          score: s };
}

/* Placeholder 'photos' for demo data. Real ones are shrunk to ~360px so they send on a weak line. */
function sample(bg, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${bg}"/><circle cx="100" cy="78" r="36" fill="#f4efe6"/><path d="M30 200c6-48 40-70 70-70s64 22 70 70z" fill="#f4efe6"/><text x="100" y="22" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#fff">${label}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
function shrink(file, cb) {
  const r = new FileReader();
  r.onload = () => { const i = new Image(); i.onload = () => {
    const k = Math.min(1, 360 / Math.max(i.width, i.height)), c = document.createElement('canvas');
    c.width = i.width * k; c.height = i.height * k; c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
    cb(c.toDataURL('image/jpeg', .6)); }; i.src = r.result; };
  r.readAsDataURL(file);
}

/* ---------- state ---------- */
let S = load() || {
  signal: 'good',               // good | weak | none
  outbox: [],                   // things saved on the phone, waiting for signal
  cases: [
    { id: 'c1', who: 'baby',  needs: ['alone','water','locked'], since: '3-12', how: 'saw',    zone: 'Lanka Gate lane', dist: 350, age: 40,  confirms: 2, status: 'open',
      addr: 'House 14, Lanka Gate Lane', flat: 'Ground floor, green door', name: 'Baby Aarav', phone: '98xxxxxx12', photo: sample('#1f5a8a','SAMPLE PHOTO') },
    { id: 'c2', who: 'elder', needs: ['stuck','meds'],            since: '12+',  how: 'family', zone: 'Assi Ghat road',  dist: 800, age: 190, confirms: 1, status: 'open',
      addr: 'Sunder Apartments, Assi Road', flat: 'Flat 3B', name: 'Mrs Devi', phone: '98xxxxxx45', photo: sample('#a35a00','SAMPLE PHOTO') },
    { id: 'c3', who: 'ill',   needs: ['meds'],                    since: '3-12', how: 'staff',  zone: 'BHU gate area',   dist: 1200, age: 75, confirms: 1, status: 'open',
      addr: 'Shanti Nursing Home, Ward 2', flat: 'Bed 6', name: 'Mr Rao', phone: 'Ward desk', photo: null },
    { id: 'c4', who: 'elder', needs: ['stuck'], since: '12+', how: 'family', zone: 'Lanka Gate lane', dist: 60, age: 0, confirms: 1, status: 'held', heldBy: 'Ravi', next: 'was due 2 hours ago', overdue: true,
      addr: 'House 9, Lanka Gate Lane', flat: 'Flat 2A', name: 'Mrs Kapoor', phone: '98xxxxxx77', photo: null }
  ],
  mine: [{ id: 'm1', label: 'Mother, Varanasi (you reported)', status: 'Someone is going · Meena, 6 min away', k: 'green' }],
  claim: null, visit: null
};
function save() { try { localStorage.setItem('stillhere2', JSON.stringify(S)); } catch (e) {} }
function load() { try { return JSON.parse(localStorage.getItem('stillhere2')); } catch (e) { return null; } }
let draft = {}, step = 1, view = 'home';

/* ---------- chrome ---------- */
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 3200); }

function chrome() {
  const sig = $('#sig'), b = $('#banner');
  sig.className = S.signal === 'good' ? '' : S.signal;
  sig.textContent = { good: '● Signal OK', weak: '◐ Weak signal', none: '○ No signal' }[S.signal];
  if (S.signal === 'good') { b.hidden = true; return; }
  b.hidden = false; b.className = S.signal === 'none' ? 'none' : '';
  const n = S.outbox.length;
  b.innerHTML = S.signal === 'none'
    ? `No signal. Everything you do is saved on this phone.${n ? ` <b>${n} waiting to send.</b>` : ''}<small>No data at all? Send the text instead: <a href="sms:+910000000000?body=${encodeURIComponent(smsText())}">SMS to 5-2-0-0-0</a></small>`
    : `Weak signal. Short forms only. Photos are turned off.${n ? ` <b>${n} waiting.</b>` : ''}`;
}
function smsText() {
  const d = draft;
  if (!d.who) return 'HELP <type> <need> <street + flat> <door word>';
  return `HELP ${d.who} ${(d.needs || []).join('+')} ${d.since || ''} ${d.addr || ''} ${d.flat || ''} ${d.door || ''}`.trim();
}
$('#sig').onclick = () => {
  S.signal = { good: 'weak', weak: 'none', none: 'good' }[S.signal];
  if (S.signal === 'good' && S.outbox.length) { toast(`Signal back. Sent ${S.outbox.length} saved item(s).`); S.outbox = []; }
  save(); chrome(); render();
};
function send(item) {
  if (S.signal === 'none') { S.outbox.push(item); save(); chrome(); return 'saved'; }
  return 'sent';
}

/* ---------- router ---------- */
function go(v) { view = v; $('#phone').scrollTop = 0; render(); }
function render() {
  chrome(); ({ home, report, nearby, visit, handover, done, visits })[view]();
  const tabs = $('#tabs'), main = ['home', 'nearby', 'visits'].includes(view);
  tabs.hidden = !main;
  tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.go === view));
  $('#tabdot').hidden = !S.cases.some(c => c.status === 'held' && c.overdue);
  board();
}
const steps = i => `<div class="stepper">${['Walk', 'Knock', 'Look', 'Hand over'].map((l, k) => `<span class="${k < i ? 'past' : k === i ? 'on' : ''}">${l}</span>`).join('')}</div>`;
let filter = 'all';
const FILTERS = [{ k: 'all', l: 'Everyone', fn: () => true }, { k: 'child', l: 'Children', fn: c => c.who === 'baby' },
  { k: 'meds', l: 'Needs medicine', fn: c => c.needs.includes('meds') }, { k: 'locked', l: 'Locked in', fn: c => c.needs.includes('locked') }];
const back = (to, label = '← Back') => `<button class="back" data-go="${to}">${label}</button>`;
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) { if (g.dataset.go === 'report') { draft = {}; step = 1; } go(g.dataset.go); }
});

/* ---------- 1. HOME ---------- */
function home() {
  const over = S.cases.filter(c => c.status === 'held' && c.overdue);
  const mine = S.mine.map(m => `<div class="card ${m.k}"><span class="tag ${m.k}">${esc(m.status)}</span><h3>${esc(m.label)}</h3></div>`).join('');
  $('#screen').innerHTML = `
    <h1>Who are you worried about?</h1>
    <button class="big go" data-go="report">Someone needs help<small>Tell us where they are. 1 minute.</small></button>
    <button class="big" data-go="nearby">I can go and check<small>${S.cases.filter(c => c.status === 'open').length} people near you need someone</small></button>
    ${over.length ? `<button class="big" style="border-color:var(--red)" data-go="visits"><span class="tag red">▲ ${over.length} check overdue</span><br>Someone you promised to look in on<small>Tap to see who</small></button>` : ''}
    ${S.mine.length ? `<h2>Your people</h2>${mine}` : ''}
    <p class="mute">You are helping as <b>${ME.name}</b>. ${ME.vouch}.</p>`;
}

/* ---------- 2. REPORT ---------- */
function report() {
  const prog = `<div class="prog">${[1,2,3,4].map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>`;
  const nav = (next, ok, label = 'Next') => `<div class="row" style="margin-top:18px"><button class="big" id="bk" style="min-height:64px">Back</button><button class="big go" id="nx" ${ok ? '' : 'disabled'} style="min-height:64px">${label}</button></div>`;
  let h = back('home', '← Cancel') + prog;

  if (step === 1) {
    h += `<h1>Who is it?</h1>` + Object.entries(WHO).map(([k, v]) => `<button class="big ${draft.who === k ? 'sel' : ''}" data-who="${k}">${v.label}</button>`).join('');
    $('#screen').innerHTML = h;
    document.querySelectorAll('[data-who]').forEach(b => b.onclick = () => { draft.who = b.dataset.who; step = 2; render(); });
    return;
  }
  if (step === 2) {
    draft.needs = draft.needs || [];
    h += `<h1>What is wrong right now?</h1><p class="mute">Tap all that apply.</p><div class="grid">` +
      Object.entries(NEED).map(([k, v]) => `<button class="chip ${draft.needs.includes(k) ? 'sel' : ''}" data-need="${k}">${v.label}</button>`).join('') + `</div>
      <h2>Last time someone looked after them</h2><div class="grid" style="grid-template-columns:1fr">` +
      Object.entries(SINCE).map(([k, v]) => `<button class="chip ${draft.since === k ? 'sel' : ''}" data-since="${k}">${v.label}</button>`).join('') + `</div>` + nav(3, draft.since && draft.needs.length);
    $('#screen').innerHTML = h;
    document.querySelectorAll('[data-need]').forEach(b => b.onclick = () => { const k = b.dataset.need; draft.needs = draft.needs.includes(k) ? draft.needs.filter(x => x !== k) : [...draft.needs, k]; render(); });
    document.querySelectorAll('[data-since]').forEach(b => b.onclick = () => { draft.since = b.dataset.since; render(); });
  }
  if (step === 3) {
    h += `<h1>Where?</h1>
      <label for="a">Building and street</label><input id="a" value="${esc(draft.addr)}" autocomplete="off" placeholder="e.g. Sunder Apartments, Assi Road">
      <label for="f">Flat, floor, door colour</label><input id="f" value="${esc(draft.flat)}" autocomplete="off" placeholder="e.g. 3B, blue door">
      <h2>How do you know?</h2><div class="grid" style="grid-template-columns:1fr">` +
      Object.entries(HOW).map(([k, v]) => `<button class="chip ${draft.how === k ? 'sel' : ''}" data-how="${k}">${v.label}</button>`).join('') + `</div>
      <h2>Photo <span style="text-transform:none;letter-spacing:0">(optional)</span></h2>
      ${draft.photo ? `<img class="photo sm" src="${draft.photo}" alt="Photo you added">` : ''}
      <label class="filebtn ${S.signal === 'good' ? '' : 'off'}">${S.signal === 'good' ? (draft.photo ? 'Change photo' : 'Add a photo of them') : 'Photos are off on weak signal. Add one later.'}
        <input id="ph" type="file" accept="image/*" capture="environment" ${S.signal === 'good' ? '' : 'disabled'}></label>
      <p class="mute" style="margin-top:8px">Only the helper who commits sees it, at the door. It helps them find the right person.</p>` +
      nav(4, true, 'Next');
    $('#screen').innerHTML = h;
    const sync = () => { draft.addr = $('#a').value.trim(); draft.flat = $('#f').value.trim(); $('#nx').disabled = !(draft.addr && draft.flat && draft.how); };
    $('#a').oninput = $('#f').oninput = sync;
    document.querySelectorAll('[data-how]').forEach(b => b.onclick = () => { sync(); draft.how = b.dataset.how; render(); });
    sync();
    const ph = $('#ph'); if (ph) ph.onchange = () => { if (ph.files[0]) shrink(ph.files[0], d => { sync(); draft.photo = d; render(); }); };
  }
  if (step === 4) {
    const u = urgency(draft), w = WHO[draft.who];
    h += `<h1>Check, then send</h1>
      <div class="card ${u.k}"><span class="tag ${u.k}">${u.icon} ${u.text}</span><h3>${w.label}</h3><div class="meta">${draft.needs.map(n => NEED[n].label).join(' · ')}<br>${esc(draft.addr)} · ${esc(draft.flat)}</div></div>
      <div class="priv"><b>What helpers can see before they commit</b>${w.generic} · ${draft.needs.map(n => NEED[n].label.toLowerCase()).join(', ')} · about 400 m away.<br>
        <b style="margin-top:8px">What they cannot see</b>Name, address, flat, photo, your phone number. These appear in stages, only after one vetted helper says "I'll go".${draft.photo ? `<br><img class="photo sm" src="${draft.photo}" alt="Your photo">` : ''}</div>
      <label for="d">Door word <span class="mute">(optional)</span></label>
      <input id="d" placeholder="A word the person knows. You give it to the helper." autocomplete="off" value="${esc(draft.door)}">
      <label for="p">Your phone number</label><input id="p" inputmode="tel" placeholder="So the helper can call you" value="${esc(draft.phone)}">
      <p class="mute" style="margin-top:10px">Reports that are wrong lower your reliability. Reports confirmed by a visit raise it.</p>` + nav(0, true, 'Send');
    $('#screen').innerHTML = h;
    const sync = () => { draft.door = $('#d').value.trim(); draft.phone = $('#p').value.trim(); $('#nx').disabled = draft.phone.length < 6; };
    $('#d').oninput = $('#p').oninput = sync; sync();
    $('#nx').onclick = () => {
      const r = send({ type: 'report', draft: { ...draft } });
      S.cases.unshift({ id: 'n' + Date.now(), who: draft.who, needs: draft.needs, since: draft.since, how: draft.how, zone: 'Your area', dist: 400, age: 0, confirms: 1, status: 'open', addr: draft.addr, flat: draft.flat, name: 'Reported person', door: draft.door, phone: draft.phone, photo: draft.photo || null });
      S.mine.unshift({ id: 'm' + Date.now(), label: `${w.generic}, ${draft.addr}`, status: r === 'saved' ? 'Saved on phone · will send when signal returns' : 'Sent · looking for a helper', k: r === 'saved' ? 'amber' : 'blue' });
      save(); toast(r === 'saved' ? 'Saved on this phone. It will send by itself.' : 'Sent. We will tell you when someone is on the way.'); go('home');
    };
    $('#bk').onclick = () => { step = 3; render(); };
    return;
  }
  if (step === 2 || step === 3) {
    $('#bk').onclick = () => { step--; render(); };
    $('#nx').onclick = () => { step++; render(); };
  }
}

/* ---------- 3. NEARBY (what a stranger is allowed to see) ---------- */
function nearby() {
  const open = S.cases.filter(c => c.status === 'open' && FILTERS.find(f => f.k === filter).fn(c)).sort((a, b) => urgency(b).score - urgency(a).score || a.dist - b.dist);
  const busy = !!S.claim;
  $('#screen').innerHTML = back('home') + `<h1>Near you</h1>
    <p class="mute">No names and no addresses here. The address appears only after you say you'll go, and your name is logged against it.</p>
    ${busy ? `<div class="warn">You already have a visit open. Finish it first. One at a time, so nobody is left waiting for a helper who isn't coming.</div>` : ''}
    <div class="grid">${FILTERS.map(f => `<button class="chip ${filter === f.k ? 'sel' : ''}" data-f="${f.k}">${f.l}</button>`).join('')}</div>` +
    (open.length ? open.map(c => {
      const u = urgency(c), w = WHO[c.who];
      const conf = c.confirms > 1 ? `${c.confirms} people reported` : (c.how === 'staff' ? 'Reported by care staff' : 'Single report, unconfirmed');
      return `<div class="card ${u.k}"><span class="tag ${u.k}">${u.icon} ${u.text}</span><h3>${w.generic}</h3>
        <div class="meta">${c.needs.map(n => NEED[n].label).join(' · ')}<br>${esc(c.zone)} · ${c.dist >= 1000 ? (c.dist/1000).toFixed(1) + ' km' : '~' + Math.round(c.dist/50)*50 + ' m'} · reported ${c.age ? c.age + ' min ago' : 'just now'}<br>${conf}${c.photo ? ' · photo on file' : ''}</div>
        <button class="big go" style="min-height:62px;margin:0" data-claim="${c.id}" ${busy ? 'disabled' : ''}>I'll go</button></div>`;
    }).join('') : `<p>Nobody waiting near you right now.</p>`);
  document.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; render(); });
  document.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => {
    const c = S.cases.find(x => x.id === b.dataset.claim); c.status = 'claimed';
    S.claim = c.id; S.visit = { stage: 'walk', found: {}, claimedAt: Date.now() };
    send({ type: 'claim', id: c.id }); save(); go('visit');
  });
}

/* ---------- 4. VISIT ---------- */
function visit() {
  const c = S.cases.find(x => x.id === S.claim); if (!c) return go('nearby');
  const v = S.visit, w = WHO[c.who];
  if (v.stage === 'walk') {
    $('#screen').innerHTML = `${steps(0)}<h1>Go to this building</h1>
      <div class="reveal"><span class="tag">Street only, for now</span><div class="addr">${esc(c.addr)}</div></div>
      <div class="reveal locked"><span class="tag">Flat and door</span><div class="addr">Hidden until you are at the building</div><p class="mute" style="margin:6px 0 0">Tap below when you are standing outside. This stops the flat being passed around by people who never arrive.</p></div>
      ${['baby','ill'].includes(c.who) ? `<div class="warn">A child or sick person may be inside. Bring one other person if you can. Tell someone where you are going.</div>` : ''}
      <p class="mute">This visit is held for you for 90 minutes, then goes back to the list.</p>
      <button class="big go" id="here">I'm outside the building</button>
      <button class="big" id="drop">I can't go after all<small>It goes back to the list straight away</small></button>`;
    $('#here').onclick = () => { v.stage = 'door'; save(); render(); };
    $('#drop').onclick = () => { c.status = 'open'; S.claim = null; S.visit = null; save(); go('nearby'); };
    return;
  }
  if (v.stage === 'door') {
    $('#screen').innerHTML = `${steps(1)}<h1>Knock</h1>
      <div class="reveal"><span class="tag">Flat</span><div class="addr">${esc(c.flat)}</div><div style="margin-top:6px">${esc(c.name)}</div></div>
      ${c.photo ? `<h2>Who you are looking for</h2><img class="photo" src="${c.photo}" alt="Photo of the person"><p class="mute">Shown to you only, only now. Do not save or share it.</p>` : ''}
      ${c.phone ? `<p>Reporter's number: <b>${esc(c.phone)}</b></p>` : ''}
      ${c.door ? `<div class="warn">The family gave a door word. Say it through the door so they know you are not a stranger. The reporter will send it by call or SMS.</div>` : ''}
      <button class="big go" id="in">I'm inside, I can see the person</button>
      <button class="big" id="noone">Nobody here, or wrong address<small>Closes the report. Tell us honestly. No blame.</small></button>
      <button class="big" id="stuck">Door is locked, no answer<small>Marks it "needs two people". Stays on the list.</small></button>`;
    $('#in').onclick = () => { v.stage = 'found'; save(); render(); };
    $('#noone').onclick = () => { c.status = 'empty'; S.claim = null; S.visit = null; send({ type: 'empty', id: c.id }); save(); toast('Closed. Thank you for checking.'); go('home'); };
    $('#stuck').onclick = () => { c.status = 'open'; c.needs = [...new Set([...c.needs, 'locked'])]; c.confirms++; S.claim = null; S.visit = null; save(); toast('Back on the list, marked "locked in".'); go('home'); };
    return;
  }
  /* found */
  const Q = [['water','Has water'],['food','Has food'],['meds','Has medicine they need'],['power','Electricity works'],['alone','Safe to leave alone']];
  const state = ['ok', 'weak', 'crit'];
  $('#screen').innerHTML = `${steps(2)}<h1>What do they need?</h1>
    <h2>How are they?</h2><div class="row">${[['ok','Okay'],['weak','Weak'],['crit','Very bad']].map(([k, l]) => `<button class="chip ${v.found.state === k ? 'sel' : ''}" data-st="${k}">${l}</button>`).join('')}</div>
    ${v.found.state === 'crit' ? `<div class="warn">Call the medical line now: <b>Ward 12 clinic</b> (the one doctor left). Stay with them.</div>` : ''}
    <h2>Tap yes or no</h2>` +
    Q.map(([k, l]) => `<div class="toggle"><span>${l}</span><span class="yn"><button class="y ${v.found[k] === 'y' ? 'sel' : ''}" data-q="${k}" data-a="y">Yes</button><button class="n ${v.found[k] === 'n' ? 'sel' : ''}" data-q="${k}" data-a="n">No</button></span></div>`).join('') +
    `<button class="big go" id="nx" style="margin-top:14px" ${v.found.state && Q.every(([k]) => v.found[k]) ? '' : 'disabled'}>Next: who stays responsible</button>`;
  document.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { v.found.state = b.dataset.st; save(); render(); });
  document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { v.found[b.dataset.q] = b.dataset.a; save(); render(); });
  $('#nx').onclick = () => { v.stage = 'handover'; save(); go('handover'); };
}

/* ---------- 5. HANDOVER: you cannot close the visit without a name and a time ---------- */
function handover() {
  const c = S.cases.find(x => x.id === S.claim); if (!c) return go('home');
  const v = S.visit; v.h = v.h || {};
  const needs = [];
  ['water','food','meds','power'].forEach(k => { if (v.found[k] === 'n') needs.push({ water:'Bring water', food:'Bring food', meds:'Medicine missing', power:'No electricity' }[k]); });
  const left = v.found.alone === 'n';
  const who = [['me', 'I will look after them'], ['neigh', 'A neighbour agreed'], ['kin', 'Family is on the way'], ['none', 'Nobody yet']];
  const when = [['2h', 'In 2 hours'], ['tonight', 'Tonight, 8 pm'], ['morning', 'Tomorrow, 8 am']];
  $('#screen').innerHTML = back('visit') + `${steps(3)}<h1>Who is responsible now?</h1>
    ${needs.length ? `<div class="warn">Still missing: ${needs.join(' · ')}</div>` : ''}
    ${left ? `<div class="warn"><b>Not safe to leave alone.</b> Do not go until someone is with them, or tell us "Nobody yet" and we'll find a second person.</div>` : ''}
    <div class="grid" style="grid-template-columns:1fr">${who.map(([k, l]) => `<button class="chip ${v.h.who === k ? 'sel' : ''}" data-w="${k}">${l}</button>`).join('')}</div>
    ${['neigh','kin'].includes(v.h.who) ? `<label for="n">Their name and phone</label><input id="n" value="${esc(v.h.name)}" placeholder="e.g. Sunil, 4B, 98xxxxxx12">` : ''}
    <h2>Next check by</h2><div class="grid" style="grid-template-columns:1fr">${when.map(([k, l]) => `<button class="chip ${v.h.when === k ? 'sel' : ''}" data-t="${k}">${l}</button>`).join('')}</div>
    <p class="mute">If nobody logs a check by then, the case goes back to the top of the list as <b>overdue</b>.</p>
    <button class="big go" id="fin" disabled>${v.h.who === 'none' ? 'Return to list, still needs a carer' : 'Done'}</button>`;
  const ok = () => v.h.who && v.h.when && (!['neigh','kin'].includes(v.h.who) || (v.h.name || '').length > 3);
  const n = $('#n'); if (n) n.oninput = () => { v.h.name = n.value.trim(); $('#fin').disabled = !ok(); };
  $('#fin').disabled = !ok();
  document.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { v.h.who = b.dataset.w; save(); render(); });
  document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { v.h.when = b.dataset.t; save(); render(); });
  $('#fin').onclick = () => {
    const holder = { me: ME.name, neigh: v.h.name, kin: v.h.name, none: null }[v.h.who];
    const whenL = when.find(x => x[0] === v.h.when)[1].toLowerCase();
    c.status = holder ? 'held' : 'open'; c.heldBy = holder; c.next = whenL; c.overdue = false; if (!holder) { c.needs = [...new Set([...c.needs, 'alone'])]; c.since = '12+'; }
    send({ type: 'handover', id: c.id, found: v.found, h: v.h });
    v.result = { holder, whenL, name: c.name, bad: needs };
    S.last = v.result; S.claim = null; S.visit = null;
    S.mine.unshift({ id: 'h' + Date.now(), label: `${c.name} · ${esc(c.flat)}`, status: holder ? `Held by ${holder} · next check ${whenL}` : 'Needs a carer · back on list', k: holder ? 'green' : 'red' });
    save(); go('done');
  };
}

function done() {
  const r = S.last || {};
  $('#screen').innerHTML = `<div class="done"><div class="tick">${r.holder ? '✔' : '▲'}</div>
    <h1>${r.holder ? 'Someone is responsible.' : 'Back on the list.'}</h1>
    <p>${r.holder ? `<b>${esc(r.holder)}</b> is looking after ${esc(r.name)}. Next check: <b>${esc(r.whenL)}</b>.` : `${esc(r.name)} still needs a carer. The next helper will see what you found.`}</p>
    <p class="mute">${S.signal === 'none' ? 'Saved on your phone. It sends when the signal is back.' : 'The person who reported has been told.'}</p>
    <button class="big go" data-go="home">Back to start</button></div>`;
}


/* ---------- my visits: promised checks ---------- */
function visits() {
  const held = S.cases.filter(c => c.status === 'held');
  $('#screen').innerHTML = `<h1>People you are checking</h1><p class="mute">Each one has a next-check time. Miss it and they go back to the top of the list.</p>` +
    (held.length ? held.map(c => `<div class="card ${c.overdue ? 'red' : 'green'}"><span class="tag ${c.overdue ? 'red' : 'green'}">${c.overdue ? '▲ Check overdue' : '✔ On time'}</span>
      <h3>${esc(c.name)} · ${esc(c.flat)}</h3><div class="meta">${WHO[c.who].generic} · ${esc(c.addr)}<br>Held by ${esc(c.heldBy)} · next check ${esc(c.next)}</div>
      <div class="row"><button class="chip" data-ok="${c.id}">Checked, fine</button><button class="chip" data-bad="${c.id}">Needs help again</button></div></div>`).join('')
    : `<p>Nobody yet. Tap Nearby to find someone who needs a visit.</p>`);
  document.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => { const c = S.cases.find(x => x.id === b.dataset.ok); c.overdue = false; c.next = 'tomorrow, 8 am'; save(); toast('Logged. Next check tomorrow, 8 am.'); render(); });
  document.querySelectorAll('[data-bad]').forEach(b => b.onclick = () => { const c = S.cases.find(x => x.id === b.dataset.bad); c.status = 'open'; c.heldBy = null; c.overdue = false; c.needs = [...new Set([...c.needs, 'alone'])]; c.since = '12+'; c.age = 0; save(); toast('Back on the list at the top.'); render(); });
}

/* ---------- world map: coarse city counts only, never a point ---------- */
const MASK = ["000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", "000000000000000000000000000000000000000111111000001111111111111000000000000000000000000000000000000000000000000000000000000000000000000000000000", "000000000000000000000000000000000001111111000111111111111111111100000000000000000000000000000000000000000000000000000000000000000000000000000000", "000000000000000000000000000000000000011100000000111111111111111100000000000000000000000000000000000000000000000011110000000000000000000000000000", "000000000000000000000001100000000000000000000000001111111111111000000000000000000000000000000000000000000011111111111000000000000000000000000000", "000000000000000000000001011111000010111111000000000111111111111000000000000000000000000000000000000110111111111111111111111100011111000000000000", "000000111111111111111111111111100111001000111000000111111111000000000000000000011111111000000001111111111111111111111111111111111111111111111111", "111000111111111111111111111111111111111000011110000111111000000000000000000001111111111111111111111111111111111111111111111111111111111111111111", "000000111111111111111111111111111111000000011100000011100000000110000000000011111111111111111111111111111111111111111111111111111111111111111111", "000000111111111111111111111111111110000001110000000000100000000000000000001111100111111111111111111111111111111111111111111111111111111011111100", "000000001110000001111111111111111110000001111010000000000000000000000000001111100111111111111111111111111111111111111111111111111100000011000000", "000000000000000000111111111111111111100001111111000000000000000000000010000001101111111111111111111111111111111111111111111111110000001110000000", "000000000000000000001111111111111111111001111111100000000000000000001111000111111111111111111111111111111111111111111111111111100000001110000000", "000000000000000000000111111111111111111111111111110000000000000000000011111111111111111111111111111111111111111111111111111111111100000000000000", "000000000000000000000011111111111111111111111100010000000000000000000001111111111111111111111111111111111111111111111111111111110000000000000000", "000000000000000000000001111111111111101111111110000000000000000000000001111111111111111111111111111111111111111111111111111111110000000000000000", "000000000000000000000011111111111111111111111000000000000000000000000101111111111111000011101111111111111111111111111111111111000100000000000000", "000000000000000000000011111111111111111111110000000000000000000000001111100001111111111011110111111111111111111111111111111100000000000000000000", "000000000000000000000001111111111111111111000000000000000000000000001111000000101101111111110111111111111111111111111111001100001000000000000000", "000000000000000000000001111111111111111111000000000000000000000000000111111100000001111111111111111111111111111111111111100100010000000000000000", "000000000000000000000000111111111111111110000000000000000000000000000111111110000000001111111111111111111111111111111111000001100000000000000000", "000000000000000000000000011111111111111100000000000000000000000000001111111111101111011111111111111111111111111111111111100000000000000000000000", "000000000000000000000000001111111100000100000000000000000000000000001111111111111111111111111111111111111111111111111111100000000000000000000000", "000000000000000000000000000111111100000100000000000000000000000000111111111111111111111111110111111111111111111111111111000000000000000000000000", "000000000000000000000000000001111000000000000000000000000000000000111111111111111111111111111111000111111111111111111110000000000000000000000000", "000000000000000000000000000000111000100011000000000000000000000001111111111111111111111011111111000011111110011111111000000000000000000000000000", "000000000000000000000000000000111101100000010000000000000000000001111111111111111111111111111110000001111100011111100000000000000000000000000000", "000000000000000000000000000000001111100000000000000000000000000001111111111111111111111101111100000001111000001111100000100000000000000000000000", "000000000000000000000000000000000001111000000000000000000000000001111111111111111111111111110000000000110000000111110000000000000000000000000000", "000000000000000000000000000000000000011000010000000000000000000000111111111111111111111111010000000000110000000101110000000000000000000000000000", "000000000000000000000000000000000000000001111111000000000000000000111111111111111111111111111000000000010000000000000000011000000000000000000000", "000000000000000000000000000000000000000001111111100000000000000000011111111111111111111111110000000000000000000010000000000000000000000000000000", "000000000000000000000000000000000000000001111111111100000000000000000000001111111111111111110000000000000000000011000110000000000000000000000000", "000000000000000000000000000000000000000011111111111100000000000000000000000011111111111111000000000000000000000111001110000000000000000000000000", "000000000000000000000000000000000000000011111111111111000000000000000000000011111111111110000000000000000000000011001110000000000000000000000000", "000000000000000000000000000000000000000011111111111111111000000000000000000011111111111110000000000000000000000001100000100000111100000000000000", "000000000000000000000000000000000000000011111111111111111100000000000000000001111111111100000000000000000000000000100000000000011110000000000000", "000000000000000000000000000000000000000011111111111111111100000000000000000001111111111100000000000000000000000000001000000000001111000000000000", "000000000000000000000000000000000000000001111111111111111100000000000000000001111111111110000000000000000000000000000000000000000000000000000000", "000000000000000000000000000000000000000001111111111111111000000000000000000001111111111110010000000000000000000000000000000011100100000000000000", "000000000000000000000000000000000000000000111111111111111000000000000000000001111111111100110000000000000000000000000000001111101100000000000000", "000000000000000000000000000000000000000000001111111111110000000000000000000001111111111000110000000000000000000000000000111111111110000000000000", "000000000000000000000000000000000000000000001111111111110000000000000000000001111111110001110000000000000000000000000011111111111111000000000000", "000000000000000000000000000000000000000000001111111111000000000000000000000000111111110001100000000000000000000000000111111111111111100000000000", "000000000000000000000000000000000000000000001111111110000000000000000000000000111111110000100000000000000000000000000111111111111111100000000000", "000000000000000000000000000000000000000000011111111110000000000000000000000000111111100000000000000000000000000000000011111111111111110000000000", "000000000000000000000000000000000000000000011111111100000000000000000000000000011111100000000000000000000000000000000011111111111111110000000000", "000000000000000000000000000000000000000000011111111000000000000000000000000000011111000000000000000000000000000000000011110000111111100000000000", "000000000000000000000000000000000000000000011111110000000000000000000000000000000000000000000000000000000000000000000000000000011111100000000000", "000000000000000000000000000000000000000000011111100000000000000000000000000000000000000000000000000000000000000000000000000000001110000000000010", "000000000000000000000000000000000000000000011110000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", "000000000000000000000000000000000000000000011100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000", "000000000000000000000000000000000000000000111100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000", "000000000000000000000000000000000000000000111000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", "000000000000000000000000000000000000000000111000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", "000000000000000000000000000000000000000000011000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000", "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"];
const CITIES = [ // name, lat, lon, waiting, helpers, held, longest wait (h)
  ['Varanasi', 25.3, 83.0, 214, 96, 61, 5], ['Delhi', 28.6, 77.2, 1840, 410, 530, 7], ['Mumbai', 19.1, 72.9, 1520, 380, 410, 6],
  ['Lagos', 6.5, 3.4, 1260, 150, 120, 9], ['Cairo', 30.0, 31.2, 980, 210, 190, 6], ['Nairobi', -1.3, 36.8, 420, 90, 70, 6],
  ['London', 51.5, -0.1, 760, 300, 280, 4], ['Berlin', 52.5, 13.4, 410, 220, 160, 4], ['New York', 40.7, -74.0, 1320, 520, 460, 5],
  ['Mexico City', 19.4, -99.1, 1480, 260, 240, 8], ['São Paulo', -23.5, -46.6, 1710, 330, 300, 8], ['Jakarta', -6.2, 106.8, 1390, 240, 200, 8],
  ['Tokyo', 35.7, 139.7, 1100, 620, 600, 3], ['Sydney', -33.9, 151.2, 260, 150, 140, 3]
].map(([n, lat, lon, w, h, held, hrs]) => ({ n, lat, lon, w, h, held, hrs, x: (lon + 180) / 2.5, y: (85 - lat) / 2.5 }));
let mapSel = 'Varanasi';
const lvl = c => { const r = c.w / c.h; return r >= 4 ? { k: 'red', i: '▲', t: 'Short of helpers' } : r >= 2 ? { k: 'amber', i: '●', t: 'Stretched' } : { k: 'green', i: '■', t: 'Covered for now' }; };
function drawMap() {
  const svg = $('#worldmap'); if (!svg) return;
  if (!svg.dataset.built) {
    let d = ''; MASK.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === '1') d += `M${x} ${y}h.72v.72h-.72z`; });
    svg.innerHTML = `<path class="land" d="${d}"/><g id="bubs"></g>`; svg.dataset.built = 1;
    svg.addEventListener('click', e => { const g = e.target.closest('[data-c]'); if (g) { mapSel = g.dataset.c; drawMap(); } });
    svg.addEventListener('keydown', e => { const g = e.target.closest('[data-c]'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); mapSel = g.dataset.c; drawMap(); $(`#worldmap [data-c="${mapSel}"]`)?.focus(); } });
    $('#map-list').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { mapSel = b.dataset.c; drawMap(); } });
  }
  const live = CITIES.map(c => c.n === 'Varanasi' ? { ...c, w: c.w + S.cases.filter(x => x.status === 'open').length - 3 } : c);
  $('#bubs').innerHTML = live.slice().sort((a, b) => b.w - a.w).map(c => {
    const L = lvl(c), r = 0.8 + Math.sqrt(c.w) / 11;
    return `<g class="bub b-${L.k} ${c.n === mapSel ? 'sel' : ''}" data-c="${c.n}" tabindex="0" role="button" aria-label="${c.n}: ${c.w} waiting, ${c.h} helpers. ${L.t}"><circle cx="${c.x}" cy="${c.y}" r="${r}"/>${c.n === 'Varanasi' ? `<circle class="you" cx="${c.x}" cy="${c.y}" r="${r + 1.4}"/>` : ''}${c.n === mapSel ? `<text x="${c.x}" y="${c.y - r - 1}" text-anchor="middle">${c.n}</text>` : ''}</g>`;
  }).join('');
  const tw = live.reduce((a, c) => a + c.w, 0), th = live.reduce((a, c) => a + c.h, 0);
  $('#map-sum').innerHTML = `<span>${tw.toLocaleString()} waiting in these cities</span><span>${th.toLocaleString()} helpers</span><span>${(tw / th).toFixed(1)} waiting per helper</span><span>▲ short · ● stretched · ■ covered</span>`;
  const c = live.find(x => x.n === mapSel), L = lvl(c);
  $('#map-detail').innerHTML = `<span class="tag ${L.k}">${L.i} ${L.t}</span><h3>${c.n}${c.n === 'Varanasi' ? ' <small style="font:600 14px system-ui">(you are here)</small>' : ''}</h3>
    <div class="nums"><div><b>${c.w}</b><span>waiting</span></div><div><b>${c.h}</b><span>helpers</span></div><div><b>${c.held}</b><span>being checked</span></div></div>
    <p style="margin:0 0 8px;font-size:15px">About ${(c.w / c.h).toFixed(1)} people waiting per helper. Longest wait ${c.hrs} hours.</p>
    <a href="#app">${L.k === 'green' ? 'Open the app and keep going' : 'Recruit neighbours here: open the app'}</a>`;
  $('#map-list').innerHTML = live.slice().sort((a, b) => b.w / b.h - a.w / a.h).map(x => { const l = lvl(x); return `<button data-c="${x.n}" class="${x.n === mapSel ? 'sel' : ''}"><span>${l.i} ${x.n}</span><span>${(x.w / x.h).toFixed(1)} per helper</span></button>`; }).join('');
}

/* ---------- care-staff board (website section) ---------- */
function board() {
  drawMap();
  const t = $('#board-table'); if (!t) return;
  const label = { open: 'Waiting for a helper', claimed: 'Helper on the way', held: 'Held, next check set', empty: 'Closed, nobody there' };
  const rows = S.cases.slice().sort((a, b) => urgency(b).score - urgency(a).score);
  const late = c => (c.status === 'open' && c.age >= 120) || (c.status === 'held' && c.overdue);
  const n = f => rows.filter(f).length;
  $('#board-sum').innerHTML = `<span>${n(c => c.status === 'open')} waiting</span><span>${n(c => c.status === 'claimed')} on the way</span><span>${n(c => c.status === 'held')} held</span><span>${n(late)} late or overdue</span>`;
  t.innerHTML = `<tr><th>Urgency</th><th>Who</th><th>Zone</th><th>Status</th><th>Waiting</th></tr>` + rows.map(c => {
    const u = urgency(c);
    return `<tr class="${late(c) ? 'late' : ''}"><td><span class="tag ${u.k}">${u.icon} ${u.text}</span></td><td>${WHO[c.who].generic}</td><td>${esc(c.zone)}</td><td>${c.status === 'held' && c.overdue ? 'Check overdue' : (label[c.status] || c.status)}${c.status === 'claimed' ? ' · ' + ME.name : ''}</td><td>${c.age ? c.age + ' min' : 'just now'}</td></tr>`;
  }).join('');
}
$('#bigtext').onclick = e => { const on = $('#phone').classList.toggle('xl'); e.target.setAttribute('aria-pressed', on); };
$('#reset').onclick = () => { try { localStorage.removeItem('stillhere2'); } catch (e) {} location.reload(); };

/* read the screen aloud: for people in shock, or who read slowly */
$('#listen').onclick = e => {
  if (!('speechSynthesis' in window)) return toast('This phone cannot read aloud.');
  const sp = speechSynthesis;
  if (sp.speaking) { sp.cancel(); e.target.classList.remove('on'); return; }
  const u = new SpeechSynthesisUtterance($('#screen').innerText.replace(/[▲●■✔]/g, ''));
  u.onend = u.onerror = () => e.target.classList.remove('on');
  e.target.classList.add('on'); sp.speak(u);
};
render();
