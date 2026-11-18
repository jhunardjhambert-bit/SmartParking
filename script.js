const $ = s => document.querySelector(s);
const FLOORS = ['A', 'B', 'C', 'D'], SLOTS = 40, KEY = 'olivarezParking';
const USER = '251C-0758', PASS = 'olivarian123';

/* ---------- data (auto-saved in the browser) ---------- */
const pad = n => String(n).padStart(2, '0');
const now = () => { const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };

function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.parking) return d; } catch (e) {}
  return { parking: {   // starting data
    C40: { plate: 'HDFH', time: '2026-11-12 09:53:05' },
    D15: { plate: 'FDHHFDHFD', time: '2026-11-12 09:53:23' },
    D38: { plate: 'FHHFD', time: '2026-11-12 09:53:12' },
    D40: { plate: 'HFDH', time: '2026-11-12 09:53:19' } }, history: [] };
}
let db = load(), floor = 'A', view = 'floor', tab = 'current';
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };

/* ---------- screens ---------- */
const show = id => { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id)); };

/* ---------- dialog (replaces JOptionPane) ---------- */
function ask(title, msg, { input = false, ok = 'Yes', cancel = 'No' } = {}) {
  return new Promise(res => {
    $('#mt').textContent = title; $('#mm').textContent = msg;
    const i = $('#mi'); i.hidden = !input; i.value = '';
    $('#mo').textContent = ok; $('#mc').textContent = cancel || ''; $('#mc').hidden = !cancel;
    $('#modal').classList.add('open'); if (input) i.focus();
    const done = v => { $('#modal').classList.remove('open'); res(v); };
    $('#mo').onclick = () => done(input ? i.value : true);
    $('#mc').onclick = () => done(input ? null : false);
    i.onkeydown = e => { if (e.key === 'Enter') $('#mo').click(); };
  });
}

/* ---------- records screen ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function renderRecords() {
  const q = $('#search').value.trim().toUpperCase();
  let head, rows;
  if (tab === 'current') {
    head = ['Slot', 'Plate Number', 'Date & Time In', 'Status'];
    rows = Object.entries(db.parking).map(([id, o]) => [id, o.plate, o.time, 'Occupied'])
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  } else {
    head = ['Slot', 'Plate Number', 'Time In', 'Time Out'];
    rows = db.history.map(h => [h.slot, h.plate, h.in, h.out]).reverse();   // newest first
  }
  rows = rows.filter(r => !q || r[0].toUpperCase().includes(q) || r[1].toUpperCase().includes(q));

  $('#rtable').innerHTML =
    `<thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>` +
    (rows.length
      ? rows.map(r => `<tr>${r.map((c, i) => `<td>${i === 3 && tab === 'current'
          ? `<span class="badge">${c}</span>` : esc(c)}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="4" class="empty">No records found.</td></tr>`) +
    '</tbody>';
}

/* ---------- parking screen ---------- */
function buildNav() {
  $('#nav').innerHTML = FLOORS.map((f, i) =>
    `<button data-f="${f}"><img src="images/nav-light.png" alt="">Floor ${i + 1}</button>`).join('');
  $('#nav').onclick = e => { const b = e.target.closest('button'); if (b) { floor = b.dataset.f; view = 'floor'; render(); } };
}

function render() {
  const L = $('#left'), R = $('#right'); L.innerHTML = R.innerHTML = '';
  let occupied = 0;
  for (let n = 1; n <= SLOTS; n++) {
    const id = floor + n, o = db.parking[id], d = document.createElement('div');
    if (o) occupied++;
    d.className = 'slot ' + (o ? 'occ' : 'avail');
    d.setAttribute('role', 'button'); d.tabIndex = 0;
    d.innerHTML = `<b>${id}</b><span>${o ? 'Occupied' : 'Available'}</span>`;   // A1 ... A40
    d.title = o ? `${id} - ${o.plate}` : id;
    d.onclick = () => slotClicked(id);
    d.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); slotClicked(id); } };
    ((n - 1) % 10 < 5 ? L : R).appendChild(d);
  }

  // header + counters
  const TOTAL = FLOORS.length * SLOTS, parked = Object.keys(db.parking).length;
  if (view === 'records') {
    $('#floorTitle').textContent = 'Parking Records';
    $('#floorSub').textContent = `All floors \u2013 ${TOTAL} slots`;
    $('#cntOcc').textContent = parked;
    $('#cntAvail').textContent = TOTAL - parked;
    renderRecords();
  } else {
    $('#floorTitle').textContent = `Floor ${FLOORS.indexOf(floor) + 1}`;
    $('#floorSub').textContent = `Slots ${floor}1 \u2013 ${floor}${SLOTS}`;
    $('#cntOcc').textContent = occupied;
    $('#cntAvail').textContent = SLOTS - occupied;
  }
  $('main').classList.toggle('records-view', view === 'records');
  $('#rec').classList.toggle('on', view === 'records');

  document.querySelectorAll('#nav button').forEach(b => {
    const on = view === 'floor' && b.dataset.f === floor;
    b.classList.toggle('on', on);
    b.querySelector('img').src = `images/nav-${on ? 'dark' : 'light'}.png`;
  });
}

async function slotClicked(id) {
  const o = db.parking[id];
  if (!o) {                                   // green slot: park a car
    if (!await ask('Confirmation', `Occupy slot ${id}?`)) return;
    let p = await ask('Plate Number', `Enter plate number for slot ${id}:`, { input: true, ok: 'OK', cancel: 'Cancel' });
    if (p === null) return;
    p = p.trim().toUpperCase();
    if (!p) { await ask('Cancelled', 'Plate number is required. Slot not occupied.', { ok: 'OK', cancel: '' }); return; }
    db.parking[id] = { plate: p, time: now() }; save(); render();
    await ask('Slot Occupied', `Slot: ${id}\nPlate: ${p}\nDate/Time: ${db.parking[id].time}`, { ok: 'OK', cancel: '' });
  } else {                                    // red slot: car leaves
    if (!await ask('Confirmation', `Slot: ${id}\nPlate: ${o.plate}\nParked since: ${o.time}\n\nMake this slot available?`)) return;
    db.history.push({ slot: id, plate: o.plate, in: o.time, out: now() });
    delete db.parking[id]; save(); render();
  }
}

/* ---------- events ---------- */
$('#continue').onclick = () => { show('login'); $('#uid').focus(); };
$('#closeLogin').onclick = () => show('welcome');
$('#confirm').onclick = async () => {
  if ($('#uid').value === USER && $('#pw').value === PASS) {
    await ask('Login', 'Login Successful!', { ok: 'OK', cancel: '' });
    $('#uid').value = $('#pw').value = ''; floor = 'A'; view = 'floor'; render(); show('app');
  } else ask('Login', 'Incorrect Username or Password!', { ok: 'OK', cancel: '' });
};
[$('#uid'), $('#pw')].forEach(i => i.onkeydown = e => { if (e.key === 'Enter') $('#confirm').click(); });
$('#logout').onclick = async () => {
  if (await ask('Logout Confirmation', 'Are you sure you want to log out?')) {
    await ask('Logout', 'Successfully logged out!', { ok: 'OK', cancel: '' }); show('login');
  }
};

/* records button, tabs and search */
$('#rec').onclick = () => { view = view === 'records' ? 'floor' : 'records'; render(); };
$('#tabs').onclick = e => {
  const b = e.target.closest('.tab'); if (!b) return;
  tab = b.dataset.t;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t === b));
  renderRecords();
};
$('#search').oninput = renderRecords;

buildNav(); render();