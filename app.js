'use strict';
(() => {
/* =========================================================================
   HQ — personlig dashboard (PWA). Lokal först, synk via Supabase.
   ========================================================================= */
const CFG = window.HQ_CONFIG || {};
const VERSION = '1.0.0';
const K = { data: 'hq.data.v1', ses: 'hq.session.v1', cfg: 'hq.cfg.v1', ui: 'hq.ui.v1' };
const ls = {
  get(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

/* ---------- utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const dayDiff = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.').replace(/\s/g, '')); return Number.isFinite(n) ? n : 0; };
const fmt = n => (Math.round(n * 10) / 10).toLocaleString('sv-SE');
const MON = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const WD = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];
const WDL = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];

function relDay(s) {
  if (!s) return '';
  const t = today(), diff = dayDiff(t, s), d = parseYmd(s);
  if (diff === 0) return 'Idag';
  if (diff === 1) return 'Imorgon';
  if (diff === -1) return 'Igår';
  if (diff > 1 && diff < 7) return cap(WDL[d.getDay()]);
  return `${cap(WD[d.getDay()])} ${d.getDate()} ${MON[d.getMonth()]}` + (d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '');
}
const longDate = s => { const d = parseYmd(s); return `${cap(WDL[d.getDay()])} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
function agoTs(ts) {
  if (!ts) return '';
  const d = new Date(ts), diff = dayDiff(ymd(d), today());
  if (diff <= 0) return 'idag';
  if (diff === 1) return 'igår';
  if (diff < 7) return `i ${WDL[d.getDay()]}s`;
  return `${d.getDate()} ${MON[d.getMonth()]}`;
}
function durWords(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + ' min' : ''}`.trim();
}
function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}
function until(time) {
  const [h, m] = time.split(':').map(Number), now = new Date();
  const mins = h * 60 + m - (now.getHours() * 60 + now.getMinutes());
  if (mins <= 0) return 'nu';
  if (mins < 60) return `om ${mins} min`;
  return `om ${Math.floor(mins / 60)} h${mins % 60 ? ' ' + (mins % 60) + ' min' : ''}`;
}
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  return { y, w: Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7) };
}
const weekStart = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
function periodKey(c) {
  const d = new Date();
  if (c === 'dag') return ymd(d);
  if (c === 'vecka') { const w = isoWeek(d); return `${w.y}-V${w.w}`; }
  if (c === 'manad') return ymd(d).slice(0, 7);
  return 'fri';
}
const debouncers = {};
const debounce = (key, fn, ms) => { clearTimeout(debouncers[key]); debouncers[key] = setTimeout(fn, ms); };

/* ---------- icons ---------- */
const sv = (p, w = 24, sw = 1.8) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const I = {
  home: sv('<path d="M3.8 10.4 12 3.8l8.2 6.6v8.6a1.6 1.6 0 0 1-1.6 1.6h-3.9v-5.4a1.2 1.2 0 0 0-1.2-1.2h-3a1.2 1.2 0 0 0-1.2 1.2v5.4H5.4A1.6 1.6 0 0 1 3.8 19z"/>'),
  cal: sv('<rect x="3.6" y="5" width="16.8" height="15.4" rx="3.6"/><path d="M3.6 9.8h16.8M8.2 3.2v3.4M15.8 3.2v3.4"/>'),
  dumbbell: sv('<path d="M6.6 7.2v9.6M17.4 7.2v9.6M3.8 9.6v4.8M20.2 9.6v4.8M6.6 12h10.8"/>'),
  bag: sv('<path d="M5.3 8.4h13.4l-.9 10.7a1.6 1.6 0 0 1-1.6 1.5H7.8a1.6 1.6 0 0 1-1.6-1.5z"/><path d="M9 8.4V7a3 3 0 0 1 6 0v1.4"/>'),
  note: sv('<rect x="4.6" y="3.6" width="14.8" height="16.8" rx="3.6"/><path d="M8.6 8.6h6.8M8.6 12h6.8M8.6 15.4h4"/>'),
  plus: sv('<path d="M12 5.2v13.6M5.2 12h13.6"/>'),
  search: sv('<circle cx="10.8" cy="10.8" r="6.4"/><path d="m15.6 15.6 4.6 4.6"/>'),
  gear: sv('<path d="M4 7.5h8.5M17.5 7.5H20M4 16.5h2.5M11.5 16.5H20"/><circle cx="15" cy="7.5" r="2.4"/><circle cx="9" cy="16.5" r="2.4"/>'),
  check: sv('<path d="m5 12.6 4.4 4.4L19 7.4"/>', 24, 2.1),
  checkB: sv('<path d="m5.5 12.5 4.2 4.2L18.5 7.6"/>', 14, 3),
  chevL: sv('<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>', 22, 2.1),
  chevR: sv('<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>', 18, 2.1),
  chevD: sv('<path d="m6 9.5 6 6 6-6"/>', 20, 2),
  close: sv('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', 20, 2),
  more: sv('<circle cx="5.8" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.2" cy="12" r="1.3" fill="currentColor"/>'),
  play: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M7.5 5.2v13.6a1 1 0 0 0 1.52.85l10.9-6.8a1 1 0 0 0 0-1.7L9.02 4.35A1 1 0 0 0 7.5 5.2z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M15.4 2.8a1 1 0 0 0-1.6.3l-1.1 2.4-4.3 2.9-3-.2a1 1 0 0 0-.8 1.7l3.4 3.4-4.6 5.9 5.9-4.6 3.4 3.4a1 1 0 0 0 1.7-.8l-.2-3 2.9-4.3 2.4-1.1a1 1 0 0 0 .3-1.6z"/></svg>',
  pinO: sv('<path d="M14.6 3.6 20.4 9.4l-2.6 1.2-3 4.4.2 3.2-3.6-3.6-4.8 4.8m4.8-4.8L7.8 11l3.2.2 4.4-3z"/>'),
  box: sv('<path d="M3.8 7.6 12 3.8l8.2 3.8v8.8L12 20.2l-8.2-3.8z"/><path d="M3.8 7.6 12 11.4l8.2-3.8M12 11.4v8.8"/>'),
  target: sv('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>'),
  listck: sv('<path d="M10.5 7h9.5M10.5 12h9.5M10.5 17h9.5"/><path d="m3.8 7 1.4 1.4L7.8 5.8M3.8 16.8l1.4 1.4 2.6-2.6"/>'),
  tag: sv('<path d="M3.8 12.4V5a1.2 1.2 0 0 1 1.2-1.2h7.4l7.9 7.9a1.6 1.6 0 0 1 0 2.2l-6.1 6.1a1.6 1.6 0 0 1-2.2 0z"/><circle cx="8.3" cy="8.3" r="1.4"/>'),
  share: sv('<path d="M12 3.6v11M8.2 7.2 12 3.6l3.8 3.6"/><path d="M7.6 10.6H6.2a1.4 1.4 0 0 0-1.4 1.4v7a1.4 1.4 0 0 0 1.4 1.4h11.6a1.4 1.4 0 0 0 1.4-1.4v-7a1.4 1.4 0 0 0-1.4-1.4h-1.4"/>', 16),
  task: sv('<circle cx="12" cy="12" r="8.2"/><path d="m8.4 12.2 2.4 2.4 4.8-4.8"/>'),
  sparkle: sv('<path d="M12 3.8v4M12 16.2v4M3.8 12h4M16.2 12h4M6.2 6.2l2.6 2.6M15.2 15.2l2.6 2.6M6.2 17.8l2.6-2.6M15.2 8.8l2.6-2.6"/>'),
};

/* ---------- domain constants ---------- */
const PRIO = { high: { l: 'Hög', r: 0 }, normal: { l: 'Normal', r: 1 }, low: { l: 'Låg', r: 2 } };
const OSTAT = [['ny', 'Ny'], ['bestalld', 'Beställd'], ['skickad', 'Skickad'], ['levererad', 'Levererad'], ['problem', 'Problem']];
const OSTAT_L = Object.fromEntries(OSTAT);
const NEXT_STATUS = { ny: 'bestalld', bestalld: 'skickad', skickad: 'levererad', problem: 'bestalld' };
const STAGES = [['bilder', 'Bilder'], ['text', 'Text'], ['pris', 'Pris'], ['publicerad', 'Publicerad']];
const CADENCE = { dag: 'Varje dag', vecka: 'Varje vecka', manad: 'Varje månad', fri: 'Ingen nollställning' };
const CAD_HINT = { dag: 'nollställs varje morgon', vecka: 'nollställs på måndag', manad: 'nollställs den 1:a', fri: 'nollställs manuellt' };
const TABS = [['idag', 'Idag', I.home], ['kalender', 'Kalender', I.cal], ['traning', 'Träning', I.dumbbell], ['butik', 'Butik', I.bag], ['noter', 'Noter', I.note]];

/* ---------- seed (deterministiska id:n => inga dubletter mellan enheter) ---------- */
function seed() {
  const S = (id, kind, o) => ({ id, kind, updatedAt: 0, deleted: false, createdAt: 0, ...o });
  const ex = (id, name, sets, reps) => ({ id, name, sets, reps, weight: '' });
  const it = (id, text) => ({ id, text });
  return [
    S('seed-tpl-1', 'template', { name: 'Överkropp', exercises: [ex('s1e1', 'Bänkpress', 4, 8), ex('s1e2', 'Skivstångsrodd', 4, 8), ex('s1e3', 'Axelpress', 3, 10), ex('s1e4', 'Latsdrag', 3, 10), ex('s1e5', 'Bicepscurl', 3, 12), ex('s1e6', 'Triceps pushdown', 3, 12)] }),
    S('seed-tpl-2', 'template', { name: 'Underkropp', exercises: [ex('s2e1', 'Knäböj', 4, 6), ex('s2e2', 'Rumänsk marklyft', 3, 8), ex('s2e3', 'Benpress', 3, 10), ex('s2e4', 'Utfallssteg', 3, 10), ex('s2e5', 'Vadpress', 4, 12)] }),
    S('seed-cl-1', 'checklist', { name: 'Veckostart', cadence: 'vecka', checked: [], period: '', items: [it('c1a', 'Gå igenom nya ordrar'), it('c1b', 'Följ upp leveranser hos leverantör'), it('c1c', 'Svara på kundmejl'), it('c1d', 'Kolla annonsresultat'), it('c1e', 'Planera veckans innehåll')] }),
    S('seed-cl-2', 'checklist', { name: 'Månadsavslut', cadence: 'manad', checked: [], period: '', items: [it('c2a', 'Stäm av intäkter och kostnader'), it('c2b', 'Spara kvitton och underlag'), it('c2c', 'Utvärdera produkterna'), it('c2d', 'Sätt mål för nästa månad')] }),
    S('seed-goal-1', 'goal', { title: 'Träningspass i veckan', type: 'auto-week', target: 4, unit: 'pass', current: 0, step: 1, deadline: '' }),
  ];
}

/* =========================================================================
   DB — lokal lagring
   ========================================================================= */
const DB = {
  items: {}, dirty: {}, lastPull: null,
  load() {
    const d = ls.get(K.data, null);
    if (d && d.items) { this.items = d.items; this.dirty = d.dirty || {}; this.lastPull = d.lastPull || null; }
    else { seed().forEach(i => { this.items[i.id] = i; }); this.persist(); }
  },
  persist() { ls.set(K.data, { items: this.items, dirty: this.dirty, lastPull: this.lastPull }); },
  list(kind) { return Object.values(this.items).filter(i => i.kind === kind && !i.deleted); },
  get(id) { const i = this.items[id]; return i && !i.deleted ? i : null; },
  put(obj) {
    obj.updatedAt = Math.max(Date.now(), ((this.items[obj.id] || {}).updatedAt || 0) + 1);
    obj.deleted = false;
    if (!obj.createdAt) obj.createdAt = Date.now();
    this.items[obj.id] = obj; this.dirty[obj.id] = 1;
    this.persist(); Sync.soon();
    return obj;
  },
  remove(id) {
    const it = this.items[id]; if (!it) return null;
    const prev = JSON.parse(JSON.stringify(it));
    it.deleted = true; it.updatedAt = Math.max(Date.now(), (it.updatedAt || 0) + 1);
    this.dirty[id] = 1; this.persist(); Sync.soon();
    return prev;
  },
};

/* =========================================================================
   Sync — Supabase (auth + REST), item-nivå, senaste ändring vinner
   ========================================================================= */
const AUTH_ERR = {
  'Invalid login credentials': 'Fel e-post eller lösenord.',
  'Email not confirmed': 'Bekräfta din e-post först – kolla inkorgen.',
  'User already registered': 'Kontot finns redan. Logga in i stället.',
  'Password should be at least 6 characters.': 'Lösenordet måste vara minst 6 tecken.',
};
const Sync = {
  state: 'local', msg: '', running: false, again: false, timer: null,
  cfg() {
    const c = ls.get(K.cfg, {});
    return { url: String(c.url || CFG.supabaseUrl || '').trim().replace(/\/+$/, ''), key: String(c.key || CFG.supabaseAnonKey || '').trim() };
  },
  configured() { const c = this.cfg(); return !!(c.url && c.key); },
  ses() { return ls.get(K.ses, null); },
  label() {
    return ({ local: 'Sparas bara på den här enheten', auth: 'Logga in för att synka', syncing: 'Synkar…', ok: 'Synkad', offline: 'Offline – synkar när du är online', error: 'Synkfel – tryck för detaljer' })[this.state];
  },
  setState(s, msg = '') {
    this.state = s; this.msg = msg;
    $$('[data-sync]').forEach(el => { el.dataset.state = s; const t = el.querySelector('.sync-t'); if (t) t.textContent = this.label(); });
  },
  async authCall(path, body) {
    const { url, key } = this.cfg();
    const r = await fetch(url + path, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let j = {}; try { j = await r.json(); } catch {}
    if (!r.ok) {
      const m = j.error_description || j.msg || j.message || j.error || `Fel ${r.status}`;
      const e = new Error(AUTH_ERR[m] || m); e.status = r.status; throw e;
    }
    return j;
  },
  saveSes(j) {
    ls.set(K.ses, { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, email: (j.user && j.user.email) || (this.ses() || {}).email || '' });
  },
  async signIn(email, password) {
    const j = await this.authCall('/auth/v1/token?grant_type=password', { email, password });
    this.saveSes(j); DB.lastPull = null; DB.persist();
    await this.run();
  },
  async signUp(email, password) {
    const j = await this.authCall('/auth/v1/signup', { email, password });
    if (j.access_token) { this.saveSes(j); await this.run(); return 'in'; }
    return 'confirm';
  },
  signOut() { ls.del(K.ses); this.setState(this.configured() ? 'auth' : 'local'); },
  async token() {
    const s = this.ses(); if (!s) throw Object.assign(new Error('auth'), { auth: true });
    if (Date.now() > s.expires_at - 60000) {
      try {
        const j = await this.authCall('/auth/v1/token?grant_type=refresh_token', { refresh_token: s.refresh_token });
        this.saveSes(j);
      } catch (e) {
        if (e.status && e.status < 500) throw Object.assign(new Error('auth'), { auth: true });
        throw e;
      }
    }
    return this.ses().access_token;
  },
  async rest(path, opts = {}, retry = true) {
    const { url, key } = this.cfg();
    const t = await this.token();
    const r = await fetch(`${url}/rest/v1/${path}`, { ...opts, headers: { apikey: key, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    if (r.status === 401 && retry) { const s = this.ses(); if (s) { s.expires_at = 0; ls.set(K.ses, s); } return this.rest(path, opts, false); }
    if (r.status === 401) throw Object.assign(new Error('auth'), { auth: true });
    const txt = await r.text();
    if (!r.ok) {
      let m = `HTTP ${r.status}`; try { const j = JSON.parse(txt); m = j.message || j.hint || m; } catch {}
      if (/relation .*items.* does not exist|Could not find the table/i.test(m)) m = 'Tabellen saknas – kör SQL-skriptet i Supabase (se guiden).';
      throw new Error(m);
    }
    return txt ? JSON.parse(txt) : null;
  },
  async pull() {
    let changed = false, offset = 0, maxTs = DB.lastPull;
    const since = DB.lastPull ? new Date(Date.parse(DB.lastPull) - 15000).toISOString() : null;
    for (;;) {
      let q = `items?select=id,kind,data,deleted,client_updated_at,updated_at&order=updated_at.asc,id.asc&limit=500&offset=${offset}`;
      if (since) q += `&updated_at=gt.${encodeURIComponent(since)}`;
      const rows = (await this.rest(q)) || [];
      for (const r of rows) {
        const loc = DB.items[r.id], ts = Number(r.client_updated_at) || 0;
        if (!loc || ts > (loc.updatedAt || 0)) {
          DB.items[r.id] = { ...(r.data || {}), id: r.id, kind: r.kind, deleted: !!r.deleted, updatedAt: ts };
          delete DB.dirty[r.id]; changed = true;
        }
        if (!maxTs || Date.parse(r.updated_at) > Date.parse(maxTs)) maxTs = r.updated_at;
      }
      if (rows.length < 500) break;
      offset += 500;
    }
    DB.lastPull = maxTs; DB.persist();
    return changed;
  },
  async push() {
    const ids = Object.keys(DB.dirty).filter(id => DB.items[id]);
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200), sent = {};
      const rows = chunk.map(id => {
        const { id: _id, kind, updatedAt, deleted, ...data } = DB.items[id];
        sent[id] = updatedAt;
        return { id, kind, data, deleted: !!deleted, client_updated_at: updatedAt };
      });
      await this.rest('items', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
      chunk.forEach(id => { if (DB.items[id] && DB.items[id].updatedAt === sent[id]) delete DB.dirty[id]; });
      DB.persist();
    }
  },
  async run() {
    if (!this.configured()) return this.setState('local');
    if (!this.ses()) return this.setState('auth');
    if (!navigator.onLine) return this.setState('offline');
    if (this.running) { this.again = true; return; }
    this.running = true; this.setState('syncing');
    try {
      const changed = await this.pull();
      await this.push();
      this.setState('ok');
      if (changed) App.refresh();
    } catch (e) {
      if (e.auth) { ls.del(K.ses); this.setState('auth'); }
      else if (e instanceof TypeError || !navigator.onLine) this.setState('offline');
      else this.setState('error', e.message);
    } finally {
      this.running = false;
      if (this.again) { this.again = false; this.soon(300); }
    }
  },
  soon(ms = 1200) { clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), ms); },
};

/* =========================================================================
   UI state
   ========================================================================= */
const UI = Object.assign({
  tab: 'idag', sub: { traning: 'pass', butik: 'todo', noter: 'notes' },
  calSel: null, calMonth: null, orderFilter: 'aktiva', exercise: null, openCl: {}, hideInstall: false,
  name: CFG.name || 'Fabinator', showDone: false,
}, ls.get(K.ui, {}));
UI.sub = Object.assign({ traning: 'pass', butik: 'todo', noter: 'notes' }, UI.sub || {});
const saveUI = () => ls.set(K.ui, { tab: UI.tab, sub: UI.sub, orderFilter: UI.orderFilter, exercise: UI.exercise, openCl: UI.openCl, hideInstall: UI.hideInstall, name: UI.name, showDone: UI.showDone });
const scrollPos = {};

/* =========================================================================
   Domain helpers
   ========================================================================= */
const byTask = (a, b) =>
  (!!a.done - !!b.done) ||
  (a.date || '9999').localeCompare(b.date || '9999') ||
  (a.time || '99').localeCompare(b.time || '99') ||
  (PRIO[a.priority || 'normal'].r - PRIO[b.priority || 'normal'].r) ||
  ((a.createdAt || 0) - (b.createdAt || 0));
const sessions = () => DB.list('session').filter(s => s.finishedAt).sort((a, b) => b.finishedAt - a.finishedAt);
const activeSession = () => DB.list('session').find(s => !s.finishedAt) || null;
function workoutsIn(scope) {
  const start = scope === 'week' ? weekStart() : today().slice(0, 7) + '-01';
  return sessions().filter(s => ymd(new Date(s.finishedAt)) >= start).length;
}
const setCount = s => { let d = 0, t = 0; (s.exercises || []).forEach(e => e.sets.forEach(x => { t++; if (x.done) d++; })); return { d, t }; };
function lastSetsFor(name) {
  const n = name.trim().toLowerCase();
  for (const s of sessions()) {
    const e = (s.exercises || []).find(x => x.name.trim().toLowerCase() === n);
    if (e) { const done = e.sets.filter(x => x.done); return done.length ? done : e.sets; }
  }
  return null;
}
function series(name) {
  const n = name.toLowerCase(), out = [];
  sessions().slice().reverse().forEach(s => {
    const e = (s.exercises || []).find(x => x.name.trim().toLowerCase() === n); if (!e) return;
    const sets = e.sets.filter(x => x.done && num(x.weight) > 0);
    const use = sets.length ? sets : e.sets.filter(x => num(x.weight) > 0);
    if (!use.length) return;
    const top = use.reduce((a, b) => (num(b.weight) > num(a.weight) || (num(b.weight) === num(a.weight) && num(b.reps) > num(a.reps)) ? b : a));
    out.push({ t: s.finishedAt, w: num(top.weight), r: num(top.reps) });
  });
  return out;
}
function exerciseNames() {
  const seen = new Map();
  sessions().forEach(s => (s.exercises || []).forEach(e => {
    const k = e.name.trim().toLowerCase();
    if (k && !seen.has(k) && e.sets.some(x => num(x.weight) > 0)) seen.set(k, e.name.trim());
  }));
  return [...seen.values()];
}
function goalValue(g) {
  if (g.type === 'auto-week') return workoutsIn('week');
  if (g.type === 'auto-month') return workoutsIn('month');
  return num(g.current);
}
function clChecked(c) { return (c.cadence !== 'fri' && c.period !== periodKey(c.cadence)) ? [] : (c.checked || []); }
const prodPct = p => Math.round(STAGES.filter(([k]) => p.stages && p.stages[k]).length / STAGES.length * 100);
const orderAge = o => (o.date ? dayDiff(o.date, today()) : 0);
const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'God natt' : h < 10 ? 'God morgon' : h < 17 ? 'Hej' : h < 23 ? 'God kväll' : 'God natt'; };
const isStandalone = () => navigator.standalone || matchMedia('(display-mode: standalone)').matches;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/* =========================================================================
   Components
   ========================================================================= */
function header(title, eyebrow, withSync = false) {
  return `<header class="hdr">
    <div class="hdr-top">
      <span class="eyebrow">${esc(eyebrow)}</span>
      <div class="hdr-act">
        <button class="icon-btn glass" data-act="search" aria-label="Sök">${I.search}</button>
        <button class="icon-btn glass" data-act="settings" aria-label="Inställningar">${I.gear}<span class="dot" data-sync data-state="${Sync.state}"></span></button>
      </div>
    </div>
    <h1 class="lt">${title}</h1>
    ${withSync ? `<button class="sync-line" data-sync data-state="${Sync.state}" data-act="settings"><i></i><span class="sync-t">${Sync.label()}</span></button>` : ''}
  </header>`;
}
const sec = (title, right, body, count) => `<section class="sec"><div class="sec-h"><h2>${title}${count != null ? `<span class="count">${count}</span>` : ''}</h2>${right || ''}</div>${body}</section>`;
const seg = (key, opts, cur) => `<div class="seg" data-key="${key}"><span class="seg-pill"></span>${opts.map(([v, l]) => `<button class="${v === cur ? 'on' : ''}" data-act="sub" data-key="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
const empty = (icon, tone, title, sub, btn) => `<div class="glass empty"><div class="empty-ic t-${tone}">${icon}</div><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}${btn || ''}</div>`;

function taskRow(t, o = {}) {
  const p = t.priority || 'normal', meta = [];
  if (o.showDate && t.date) meta.push(`<span class="${!t.done && t.date < today() ? 'late' : ''}">${relDay(t.date)}</span>`);
  if (t.time) meta.push(`<span>${t.time}</span>`);
  if (o.showCat !== false && t.category === 'butik') meta.push('<span>Butik</span>');
  if (t.note) meta.push(`<span>${esc(t.note.split('\n')[0].slice(0, 40))}</span>`);
  return `<div class="row task p-${p} ${t.done ? 'is-done' : ''}" data-act="task-edit" data-id="${t.id}" role="button" tabindex="0">
    <button class="check ${t.done ? 'on' : ''}" data-act="task-toggle" data-id="${t.id}" aria-label="${t.done ? 'Markera som ej klar' : 'Markera som klar'}">${I.checkB}</button>
    <div class="row-main"><div class="row-title">${esc(t.title)}</div>${meta.length ? `<div class="row-sub">${meta.join('<i class="sep">·</i>')}</div>` : ''}</div>
    ${p === 'high' && !t.done ? '<span class="flag">Hög</span>' : ''}
  </div>`;
}
const taskList = (arr, o) => `<div class="glass list">${arr.map(t => taskRow(t, o)).join('')}</div>`;

function orderCard(o) {
  const age = orderAge(o), nx = NEXT_STATUS[o.status];
  const meta = [o.customer && esc(o.customer), o.supplier && esc(o.supplier), o.tracking && `Spårning ${esc(o.tracking)}`,
    o.status !== 'levererad' && o.date ? `<span class="${(o.status === 'ny' && age >= 2) || (o.status === 'skickad' && age >= 14) ? 'old' : ''}">${age === 0 ? 'idag' : age === 1 ? '1 dag' : age + ' dagar'}</span>` : ''].filter(Boolean);
  return `<div class="order glass" data-act="order-edit" data-id="${o.id}" role="button" tabindex="0">
    <div class="o-top"><span class="o-no">${o.orderNo ? '#' + esc(String(o.orderNo).replace(/^#/, '')) : 'Order'}</span><span class="pill s-${o.status}">${OSTAT_L[o.status]}</span></div>
    <div class="o-prod">${esc(o.product || 'Produkt ej angiven')}</div>
    ${meta.length ? `<div class="o-meta">${meta.join('<span class="sep">·</span>')}</div>` : ''}
    ${nx ? `<button class="o-next" data-act="order-next" data-id="${o.id}">Markera som ${OSTAT_L[nx].toLowerCase()}${I.chevR}</button>` : ''}
  </div>`;
}
function orderRow(o) {
  return `<div class="row" data-act="order-edit" data-id="${o.id}" role="button" tabindex="0">
    <div class="row-main"><div class="row-title">${esc(o.product || 'Order')}</div><div class="row-sub">${o.orderNo ? '#' + esc(String(o.orderNo).replace(/^#/, '')) + '<i class="sep">·</i>' : ''}${esc(o.customer || '')}${o.date ? `<i class="sep">·</i>${orderAge(o) === 0 ? 'idag' : orderAge(o) + ' d'}` : ''}</div></div>
    <span class="pill s-${o.status}">${OSTAT_L[o.status]}</span>
  </div>`;
}
function sessionBanner(s) {
  const c = setCount(s);
  return `<button class="banner glass" data-act="sess-open" data-id="${s.id}">
    <span class="pulse"></span>
    <div><div class="banner-t">Pass pågår · ${esc(s.name)}</div><div class="banner-s"><span data-timer="${s.startedAt}">${clock(Date.now() - s.startedAt)}</span> · ${c.d}/${c.t} set</div></div>
    <span class="chev">${I.chevR}</span>
  </button>`;
}
function goalCard(g) {
  const v = goalValue(g), tgt = num(g.target) || 1, pct = Math.min(100, Math.round(v / tgt * 100)), done = v >= tgt;
  const foot = [];
  if (g.type === 'auto-week') foot.push('Räknas från träningen · denna vecka');
  else if (g.type === 'auto-month') foot.push('Räknas från träningen · denna månad');
  if (g.deadline) { const d = dayDiff(today(), g.deadline); foot.push(d < 0 ? 'Deadline passerad' : d === 0 ? 'Deadline idag' : `${d} dagar kvar`); }
  return `<div class="goal glass" data-act="goal-edit" data-id="${g.id}" role="button" tabindex="0">
    <div class="g-top"><h3>${esc(g.title)}</h3><span class="g-pct ${done ? 'done' : ''}">${done ? 'Klart' : pct + ' %'}</span></div>
    <div class="g-val"><b>${fmt(v)}</b> / ${fmt(tgt)} ${esc(g.unit || '')}</div>
    <div class="bar ${done ? 'done' : ''} ${v <= 0 ? 'zero' : ''}"><i style="width:${pct}%"></i></div>
    <div class="g-foot"><span>${foot.join(' · ') || '&nbsp;'}</span>${g.type === 'manual' ? `<div class="stepper"><button data-act="goal-step" data-id="${g.id}" data-d="-1" aria-label="Minska">−</button><button data-act="goal-step" data-id="${g.id}" data-d="1" aria-label="Öka">+</button></div>` : ''}</div>
  </div>`;
}
function weekDots() {
  const start = parseYmd(weekStart()), days = new Set(sessions().map(s => ymd(new Date(s.finishedAt)))), t = today();
  return `<div class="week" aria-label="Pass denna vecka">${['M', 'T', 'O', 'T', 'F', 'L', 'S'].map((l, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i); const k = ymd(d);
    return `<span class="${k === t ? 'today' : ''}"><i class="${days.has(k) ? 'on' : ''}"></i>${l}</span>`;
  }).join('')}</div>`;
}
function installHint() {
  if (UI.hideInstall || isStandalone() || !isIOS()) return '';
  return `<div class="hint-card glass">
    <div class="hc-ic t-blue">${I.share}</div>
    <div><b>Lägg HQ på hemskärmen</b><p>Tryck på ${I.share} i Safari och välj <b style="display:inline">Lägg till på hemskärmen</b>.</p></div>
    <button class="icon-btn" data-act="hide-install" aria-label="Dölj">${I.close}</button>
  </div>`;
}

/* =========================================================================
   Views
   ========================================================================= */
function vIdag() {
  const t = today(), now = new Date(), nowHM = hm(now);
  const tasks = DB.list('task');
  const todays = tasks.filter(x => x.date === t).sort(byTask);
  const overdue = tasks.filter(x => !x.done && x.date && x.date < t).sort(byTask);
  const doneN = todays.filter(x => x.done).length;
  const act = DB.list('order').filter(o => o.status === 'ny' || o.status === 'problem')
    .sort((a, b) => (b.status === 'problem') - (a.status === 'problem') || (a.date || '').localeCompare(b.date || ''));
  const next = todays.find(x => !x.done && x.time && x.time >= nowHM);
  const active = activeSession(), last = sessions()[0];
  const tpls = DB.list('template').sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  const goals = DB.list('goal').sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).slice(0, 3);

  let h = header(`<span class="lt-pre">${greeting()},</span>${esc(UI.name)}`, `${WDL[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`, true);
  h += installHint();
  if (active) h += sessionBanner(active);
  h += `<div class="stats">
    <button class="stat glass" data-act="tab" data-tab="kalender"><span class="stat-ic t-green">${I.check}</span><span class="v">${doneN}<small>/${todays.length}</small></span><span class="l">Klara idag</span></button>
    <button class="stat glass" data-act="go-orders"><span class="stat-ic t-orange">${I.box}</span><span class="v">${act.length}</span><span class="l">${act.length === 1 ? 'Order att hantera' : 'Ordrar att hantera'}</span></button>
    <button class="stat glass" data-act="tab" data-tab="traning"><span class="stat-ic t-purple">${I.dumbbell}</span><span class="v">${workoutsIn('week')}</span><span class="l">Pass i veckan</span></button>
  </div>`;
  if (next) h += `<button class="next glass" data-act="task-edit" data-id="${next.id}"><div class="next-time">${next.time}</div><div class="next-body"><div class="next-k">Nästa · ${until(next.time)}</div><div class="next-title">${esc(next.title)}</div></div></button>`;

  let left = sec('Att göra idag', `<button class="link" data-act="task-new" data-date="${t}">Lägg till</button>`,
    todays.length ? taskList(todays) : empty(I.task, 'green', 'Inget planerat idag', 'Lägg till det viktigaste du vill få gjort.', `<button class="btn tinted" data-act="task-new" data-date="${t}">${I.plus}Ny uppgift</button>`));
  if (overdue.length) left += sec('Försenat', '', taskList(overdue, { showDate: true }), overdue.length);

  let right = sec('Butiken', `<button class="link" data-act="go-orders">Alla ordrar</button>`,
    act.length ? `<div class="glass list plain">${act.slice(0, 4).map(orderRow).join('')}</div>`
      : `<div class="glass list plain"><div class="row" data-act="go-orders"><span class="stat-ic t-green" style="margin:0;width:32px;height:32px">${I.check}</span><div class="row-main"><div class="row-title">Inga ordrar väntar</div><div class="row-sub">Allt är beställt hos leverantören</div></div><span class="chev">${I.chevR}</span></div></div>`);
  right += sec('Träning', `<button class="link" data-act="tab" data-tab="traning">Alla pass</button>`,
    `<div class="glass train-card">
      <div class="tc-top"><div><div class="tc-k">Senaste pass</div><div class="tc-v">${last ? `${esc(last.name)} · ${agoTs(last.finishedAt)}` : 'Inget loggat ännu'}</div></div>${weekDots()}</div>
      ${active ? '' : `<div class="tc-start">${tpls.map(tp => `<button class="chip" data-act="sess-start" data-id="${tp.id}">${I.play}${esc(tp.name)}</button>`).join('')}</div>`}
    </div>`);
  if (goals.length) right += sec('Mål', `<button class="link" data-act="go-goals">Alla mål</button>`,
    `<div class="glass list" style="padding:2px 0">${goals.map(g => { const v = goalValue(g), tg = num(g.target) || 1, p = Math.min(100, Math.round(v / tg * 100)); return `<div class="goal-mini" data-act="goal-edit" data-id="${g.id}" role="button"><div class="gm-t">${esc(g.title)}<span>${fmt(v)} / ${fmt(tg)}</span></div><div class="bar thin ${v >= tg ? 'done' : ''} ${v <= 0 ? 'zero' : ''}"><i style="width:${p}%"></i></div></div>`; }).join('')}</div>`);
  return h + `<div class="cols"><div>${left}</div><div>${right}</div></div>`;
}

function vKalender() {
  const t = today(), sel = UI.calSel || t, m = UI.calMonth || sel.slice(0, 7);
  const [y, mo] = m.split('-').map(Number);
  const first = new Date(y, mo - 1, 1), off = (first.getDay() + 6) % 7, days = new Date(y, mo, 0).getDate();
  const tasks = DB.list('task'), byDate = {};
  tasks.forEach(x => { if (x.date) (byDate[x.date] = byDate[x.date] || []).push(x); });
  const rows = Math.ceil((off + days) / 7);
  let cells = '';
  for (let i = 0; i < rows * 7; i++) {
    const d = new Date(y, mo - 1, 1 - off + i), k = ymd(d), list = (byDate[k] || []).sort(byTask);
    const dots = list.slice(0, 3).map(x => `<i class="${x.done ? 'd' : x.priority === 'high' ? 'h' : x.priority === 'low' ? 'l' : ''}"></i>`).join('');
    const cls = [d.getMonth() !== mo - 1 && 'out', k === t && 'today', k === sel && 'sel', (d.getDay() === 0 || d.getDay() === 6) && 'wknd'].filter(Boolean).join(' ');
    cells += `<button class="day ${cls}" data-act="cal-sel" data-d="${k}" aria-label="${longDate(k)}${list.length ? ', ' + list.length + ' uppgifter' : ''}"><b>${d.getDate()}</b><span class="dots">${dots}</span></button>`;
  }
  const dayTasks = (byDate[sel] || []).sort(byTask);
  const undated = tasks.filter(x => !x.date && !x.done).sort(byTask);
  let h = header('Kalender', `Vecka ${isoWeek(parseYmd(sel)).w}`);
  h += `<div class="cols"><div>
    <div class="glass cal">
      <div class="cal-nav">
        <h2>${cap(MONTHS[mo - 1])} <span>${y}</span></h2>
        ${m !== t.slice(0, 7) || sel !== t ? `<button class="cal-today" data-act="cal-today">Idag</button>` : ''}
        <button class="icon-btn" data-act="cal-month" data-d="-1" aria-label="Föregående månad">${I.chevL}</button>
        <button class="icon-btn" data-act="cal-month" data-d="1" aria-label="Nästa månad"><span style="transform:scaleX(-1);display:block">${I.chevL}</span></button>
      </div>
      <div class="cal-wd">${['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(d => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid ${UI._slide || ''}">${cells}</div>
    </div></div><div>`;
  UI._slide = '';
  h += sec(sel === t ? 'Idag' : longDate(sel), `<button class="link" data-act="task-new" data-date="${sel}">Lägg till</button>`,
    dayTasks.length ? taskList(dayTasks) : empty(I.cal, 'blue', 'Inget inplanerat', relDay(sel) === 'Idag' ? 'Dagen är fri.' : `${longDate(sel)} är fri.`, `<button class="btn tinted" data-act="task-new" data-date="${sel}">${I.plus}Planera något</button>`),
    dayTasks.length ? `${dayTasks.filter(x => x.done).length}/${dayTasks.length}` : null);
  if (undated.length) h += sec('Utan datum', '', taskList(undated), undated.length);
  return h + '</div></div>';
}

function vTraning() {
  const sub = UI.sub.traning, act = activeSession();
  let h = header('Träning', `${workoutsIn('week')} pass denna vecka`);
  h += seg('traning', [['pass', 'Pass'], ['historik', 'Historik'], ['utveckling', 'Utveckling']], sub);
  if (act) h += sessionBanner(act);
  if (sub === 'pass') {
    const tpls = DB.list('template').sort((a, b) => a.name.localeCompare(b.name, 'sv'));
    h += `<div class="grid-cards">${tpls.map(tp => {
      const last = sessions().find(s => s.templateId === tp.id), ex = tp.exercises.filter(e => e.name.trim());
      return `<div class="tpl glass">
        <div class="tpl-h"><div><h3>${esc(tp.name)}</h3><p>${ex.length} övningar · ${last ? 'senast ' + agoTs(last.finishedAt) : 'inte kört än'}</p></div>
          <button class="icon-btn sm" data-act="tpl-edit" data-id="${tp.id}" aria-label="Redigera ${esc(tp.name)}">${I.more}</button></div>
        <div class="tpl-ex">${ex.slice(0, 4).map(e => `<span>${esc(e.name)}</span>`).join('')}${ex.length > 4 ? `<span>+${ex.length - 4}</span>` : ''}</div>
        <button class="btn sm" data-act="sess-start" data-id="${tp.id}">${I.play}Starta pass</button>
      </div>`;
    }).join('')}<button class="add-card" data-act="tpl-new">${I.plus}Nytt pass</button></div>`;
  } else if (sub === 'historik') {
    const list = sessions();
    if (!list.length) h += empty(I.dumbbell, 'purple', 'Ingen historik än', 'Avslutade pass hamnar här med datum, tid och vad du gjort.');
    else {
      const groups = {};
      list.forEach(s => { const d = new Date(s.finishedAt), k = `${cap(MONTHS[d.getMonth()])} ${d.getFullYear()}`; (groups[k] = groups[k] || []).push(s); });
      h += Object.entries(groups).map(([k, arr], gi) => `<div class="sub-h ${gi === 0 ? 'first' : ''}">${k} · ${arr.length} pass</div><div class="glass list dated">${arr.map(s => {
        const d = new Date(s.finishedAt), c = setCount(s);
        return `<div class="row" data-act="sess-open" data-id="${s.id}" role="button" tabindex="0"><div class="datebox"><b>${d.getDate()}</b><span>${WD[d.getDay()]}</span></div><div class="row-main"><div class="row-title">${esc(s.name)}</div><div class="row-sub">${hm(new Date(s.startedAt))}–${hm(d)}<i class="sep">·</i>${durWords(s.finishedAt - s.startedAt)}<i class="sep">·</i>${c.d}/${c.t} set</div></div><span class="chev">${I.chevR}</span></div>`;
      }).join('')}</div>`).join('');
    }
  } else {
    const names = exerciseNames();
    if (!names.length) h += empty(I.sparkle, 'purple', 'Din viktkurva visas här', 'Logga vikter i dina pass så ser du utvecklingen per övning.');
    else {
      const cur = names.find(n => n.toLowerCase() === String(UI.exercise || '').toLowerCase()) || names[0];
      const s = series(cur), pr = s.reduce((a, b) => (b.w > a.w ? b : a), s[0]), lastE = s[s.length - 1], diff = lastE.w - s[0].w;
      h += `<div class="chips">${names.map(n => `<button class="chip ${n === cur ? 'on' : ''}" data-act="ex-pick" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div>`;
      h += `<div class="kpis">
        <div class="glass kpi"><div class="k">Rekord</div><div class="v">${fmt(pr.w)}<small> kg</small></div><div class="d">${agoTs(pr.t)}</div></div>
        <div class="glass kpi"><div class="k">Senast</div><div class="v">${fmt(lastE.w)}<small> kg</small></div><div class="d">× ${fmt(lastE.r)} reps</div></div>
        <div class="glass kpi"><div class="k">Förändring</div><div class="v ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">${diff > 0 ? '+' : ''}${fmt(diff)}<small> kg</small></div><div class="d">${s.length} pass</div></div>
      </div>`;
      h += `<div class="glass chart"><div class="chart-h"><b>${esc(cur)}</b><span>Tyngsta set per pass</span></div><div data-chart="${esc(cur)}"></div></div>`;
      h += sec('Logg', '', `<div class="glass list plain">${s.slice().reverse().slice(0, 12).map(p => { const d = new Date(p.t); return `<div class="row"><div class="row-main"><div class="row-title">${fmt(p.w)} kg × ${fmt(p.r)}</div><div class="row-sub">${cap(WD[d.getDay()])} ${d.getDate()} ${MON[d.getMonth()]}</div></div>${p.w === pr.w ? '<span class="flag" style="color:var(--green);background:color-mix(in srgb,var(--green) 13%,transparent)">Rekord</span>' : ''}</div>`; }).join('')}</div>`);
    }
  }
  return h;
}

function vButik() {
  const sub = UI.sub.butik;
  const openOrders = DB.list('order').filter(o => o.status !== 'levererad').length;
  let h = header('Butiken', openOrders ? `${openOrders} aktiva ordrar` : 'Vencare');
  h += seg('butik', [['todo', 'Att göra'], ['ordrar', 'Ordrar'], ['listor', 'Checklistor'], ['produkter', 'Produkter']], sub);
  if (sub === 'todo') {
    const all = DB.list('task').filter(x => x.category === 'butik'), t = today();
    const open = all.filter(x => !x.done), done = all.filter(x => x.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    const g = [['Försenat', open.filter(x => x.date && x.date < t), 'late'], ['Idag', open.filter(x => x.date === t)], ['Kommande', open.filter(x => x.date && x.date > t)], ['Utan datum', open.filter(x => !x.date)]].filter(x => x[1].length);
    h += `<button class="add-card" data-act="task-new" data-cat="butik" style="margin-bottom:6px">${I.plus}Ny uppgift för butiken</button>`;
    if (!open.length) h += `<div style="margin-top:12px">${empty(I.task, 'green', 'Inget kvar att göra', 'Snyggt jobbat. Lägg till nästa sak när den dyker upp.')}</div>`;
    h += g.map(([l, arr, c]) => `<div class="sub-h ${c || ''}">${l}</div>${taskList(arr.sort(byTask), { showDate: l !== 'Idag', showCat: false })}`).join('');
    if (done.length) {
      h += `<div class="sub-h" style="display:flex;justify-content:space-between"><span>Klara · ${done.length}</span><button class="link" style="font-size:13px;text-transform:none;letter-spacing:0" data-act="toggle-done">${UI.showDone ? 'Dölj' : 'Visa'}</button></div>`;
      if (UI.showDone) h += taskList(done.slice(0, 30), { showCat: false });
    }
  } else if (sub === 'ordrar') {
    const all = DB.list('order'), f = UI.orderFilter;
    const cnt = k => (k === 'aktiva' ? all.filter(o => o.status !== 'levererad') : all.filter(o => o.status === k)).length;
    const list = (f === 'aktiva' ? all.filter(o => o.status !== 'levererad') : all.filter(o => o.status === f))
      .sort((a, b) => f === 'levererad' ? (b.date || '').localeCompare(a.date || '') : (OSTAT.findIndex(x => x[0] === a.status) - OSTAT.findIndex(x => x[0] === b.status)) || (a.date || '').localeCompare(b.date || ''));
    const order = { problem: -1 };
    if (f === 'aktiva') list.sort((a, b) => (order[a.status] || 0) - (order[b.status] || 0));
    h += `<div class="chips">${[['aktiva', 'Aktiva'], ...OSTAT.filter(x => x[0] !== 'levererad'), ['levererad', 'Levererade']].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="order-filter" data-v="${k}">${l}<span class="n">${cnt(k)}</span></button>`).join('')}</div>`;
    h += `<button class="add-card" data-act="order-new" style="margin-bottom:10px">${I.plus}Ny order</button>`;
    h += list.length ? `<div class="grid-cards">${list.map(orderCard).join('')}</div>` : empty(I.box, 'orange', f === 'aktiva' ? 'Inga aktiva ordrar' : `Inga ordrar med status ${(OSTAT_L[f] || '').toLowerCase()}`, 'Nya ordrar lägger du till med knappen ovan.');
  } else if (sub === 'listor') {
    const cls = DB.list('checklist').sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    h += `<div class="stack">${cls.map(c => {
      const ch = clChecked(c), n = c.items.filter(i => ch.includes(i.id)).length, tot = c.items.length, pct = tot ? Math.round(n / tot * 100) : 0, open = !!UI.openCl[c.id];
      return `<div class="cl glass ${open ? 'open' : ''}" data-cl="${c.id}">
        <button class="cl-h" data-act="cl-toggle" data-id="${c.id}" aria-expanded="${open}">
          <span class="ring-wrap ${tot && n === tot ? 'done' : ''}"><span class="ring" style="--p:${pct}"></span><b>${n}/${tot}</b></span>
          <div class="cl-t"><h3>${esc(c.name)}</h3><p>${CADENCE[c.cadence]} · ${CAD_HINT[c.cadence]}</p></div>
          <span class="chev">${I.chevD}</span>
        </button>
        <div class="cl-body"><div>
          ${c.items.map(i => { const on = ch.includes(i.id); return `<button class="cl-item ${on ? 'on' : ''}" data-act="cl-check" data-id="${c.id}" data-item="${i.id}"><span class="check sm ${on ? 'on' : ''}">${I.checkB}</span><span>${esc(i.text)}</span></button>`; }).join('')}
          <div class="cl-foot"><button class="btn secondary" data-act="cl-reset" data-id="${c.id}">Nollställ</button><button class="btn secondary" data-act="cl-edit" data-id="${c.id}">Redigera</button></div>
        </div></div>
      </div>`;
    }).join('')}<button class="add-card" data-act="cl-new">${I.plus}Ny checklista</button></div>`;
  } else {
    const ps = DB.list('product').sort((a, b) => prodPct(a) - prodPct(b) || (a.createdAt || 0) - (b.createdAt || 0));
    h += `<button class="add-card" data-act="prod-new" style="margin-bottom:10px">${I.plus}Ny produkt</button>`;
    h += ps.length ? `<div class="grid-cards">${ps.map(p => {
      const pct = prodPct(p);
      return `<div class="prod glass">
        <div class="prod-h" data-act="prod-edit" data-id="${p.id}" role="button" tabindex="0"><h3>${esc(p.name)}</h3><span>${pct === 100 ? 'Klar' : pct + ' %'}</span></div>
        <div class="bar thin ${pct === 100 ? 'done' : ''} ${pct === 0 ? 'zero' : ''}"><i style="width:${pct}%"></i></div>
        <div class="stages">${STAGES.map(([k, l]) => `<button class="stage ${p.stages && p.stages[k] ? 'on' : ''}" data-act="prod-stage" data-id="${p.id}" data-k="${k}"><i>${I.checkB}</i>${l}</button>`).join('')}</div>
      </div>`;
    }).join('')}</div>` : empty(I.tag, 'blue', 'Inga produkter ännu', 'Följ varje produkt från bilder och text till pris och publicering.');
  }
  return h;
}

function vNoter() {
  const sub = UI.sub.noter;
  let h = header(sub === 'mal' ? 'Mål' : 'Anteckningar', sub === 'mal' ? 'Följ det som spelar roll' : 'Idéer och tankar');
  h += seg('noter', [['notes', 'Anteckningar'], ['mal', 'Mål']], sub);
  if (sub === 'notes') {
    const ns = DB.list('note').sort((a, b) => (!!b.pinned - !!a.pinned) || (b.updatedAt - a.updatedAt));
    h += `<button class="add-card" data-act="note-new" style="margin-bottom:12px">${I.plus}Ny anteckning</button>`;
    h += ns.length ? `<div class="notes">${ns.map(n => {
      const title = (n.title || '').trim() || (n.body || '').trim().split('\n')[0] || 'Ny anteckning';
      const body = (n.title || '').trim() ? n.body : (n.body || '').trim().split('\n').slice(1).join('\n');
      return `<div class="ncard glass" data-act="note-edit" data-id="${n.id}" role="button" tabindex="0"><h3>${esc(title)}</h3><p>${esc((body || '').trim())}</p><time>${n.pinned ? I.pin : ''}${agoTs(n.updatedAt) === 'idag' ? hm(new Date(n.updatedAt)) : cap(agoTs(n.updatedAt))}</time></div>`;
    }).join('')}</div>` : empty(I.note, 'orange', 'Inga anteckningar', 'Fånga idéer innan de försvinner.');
  } else {
    const gs = DB.list('goal').sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    h += `<div class="grid-cards">${gs.map(goalCard).join('')}<button class="add-card" data-act="goal-new">${I.plus}Nytt mål</button></div>`;
  }
  return h;
}

const VIEWS = { idag: vIdag, kalender: vKalender, traning: vTraning, butik: vButik, noter: vNoter };

/* =========================================================================
   App render
   ========================================================================= */
const segPrev = {};
const App = {
  render(anim = false) {
    const v = $('#view');
    v.innerHTML = VIEWS[UI.tab]();
    if (anim) { v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); }
    syncTabbar(); post();
  },
  refresh() {
    const a = document.activeElement;
    if (a && $('#view').contains(a) && /INPUT|TEXTAREA/.test(a.tagName)) return;
    this.render(false);
  },
};
function buildTabbar() {
  $('#tabbar').innerHTML = `<div class="tabs glass" role="tablist"><span class="tab-pill"></span>${TABS.map(([k, l, ic]) => `<button class="tab" role="tab" data-act="tab" data-tab="${k}">${ic}<span>${l}</span></button>`).join('')}</div><button class="fab" data-act="quick" aria-label="Lägg till">${I.plus}</button>`;
}
function syncTabbar() {
  const i = TABS.findIndex(t => t[0] === UI.tab);
  $$('.tab').forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-selected', k === i); });
  const p = $('.tab-pill'); if (p) p.style.transform = `translateX(${i * 100}%)`;
}
function post() {
  $$('.seg[data-key]').forEach(s => {
    const btns = $$('button', s), idx = btns.findIndex(b => b.classList.contains('on')), pill = $('.seg-pill', s), prev = segPrev[s.dataset.key];
    pill.style.width = `calc((100% - 6px) / ${btns.length})`;
    if (prev != null && prev !== idx) { pill.style.transition = 'none'; pill.style.transform = `translateX(${prev * 100}%)`; void pill.offsetWidth; pill.style.transition = ''; }
    pill.style.transform = `translateX(${idx * 100}%)`; segPrev[s.dataset.key] = idx;
  });
  $$('[data-chart]').forEach(drawChart);
  const g = $('.cal-grid');
  if (g) {
    let x0 = null, y0 = 0;
    g.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    g.addEventListener('touchend', e => {
      if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dy) < 45) moveMonth(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
}
function moveMonth(d) {
  const m = UI.calMonth || (UI.calSel || today()).slice(0, 7);
  const [y, mo] = m.split('-').map(Number), nd = new Date(y, mo - 1 + d, 1);
  UI.calMonth = ymd(nd).slice(0, 7); UI._slide = d > 0 ? 'slide-l' : 'slide-r'; App.render();
}

/* ---------- chart ---------- */
function drawChart(el) {
  const pts = series(el.dataset.chart), W = Math.max(260, el.clientWidth), H = Math.round(Math.min(230, Math.max(170, W * .5)));
  if (pts.length < 2) { el.innerHTML = `<p class="hint" style="padding:30px 10px;text-align:center">Logga ${pts.length ? 'ett pass till' : 'några pass'} med den här övningen för att se kurvan.</p>`; return; }
  const L = 38, R = 14, T = 16, B = 26, ws = pts.map(p => p.w);
  let lo = Math.min(...ws), hi = Math.max(...ws);
  const raw = Math.max((hi - lo) / 2, 1), mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(v => v >= raw);
  lo = Math.max(0, Math.floor(lo / step) * step); hi = Math.ceil(hi / step) * step; if (hi === lo) hi = lo + step;
  const x = i => L + (W - L - R) * (i / (pts.length - 1)), y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.w).toFixed(1)}`).join('');
  const area = `${line}L${x(pts.length - 1).toFixed(1)},${H - B}L${L},${H - B}Z`;
  const ticks = []; for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  const d0 = new Date(pts[0].t), d1 = new Date(pts[pts.length - 1].t), li = pts.length - 1, pr = Math.max(...ws);
  const gid = 'g' + Math.random().toString(36).slice(2, 7);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Viktkurva">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>
    ${ticks.map(v => `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`).join('')}
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${line}" style="fill:none;stroke:var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.w).toFixed(1)}" r="${i === li ? 5 : 3}" style="fill:${p.w === pr ? 'var(--green)' : 'var(--accent)'};stroke:var(--bg)" stroke-width="${i === li ? 3 : 1.5}"/>`).join('')}
    <text x="${L}" y="${H - 6}">${d0.getDate()} ${MON[d0.getMonth()]}</text>
    <text x="${W - R}" y="${H - 6}" text-anchor="end">${d1.getDate()} ${MON[d1.getMonth()]}</text>
  </svg>`;
}

/* =========================================================================
   Sheets
   ========================================================================= */
const topSheet = () => { const s = $$('.sheet-wrap:not(.closing)'); return s[s.length - 1] || null; };
function openSheet({ title = '', body = '', full = false, left = 'Avbryt', leftAct = 'sheet-close', right = null, rightAct = null, rightHtml = null, onClose = null, attrs = '' }) {
  const w = document.createElement('div');
  w.className = 'sheet-wrap';
  w.innerHTML = `<div class="sheet-bd" data-act="sheet-close"></div>
    <div class="sheet ${full ? 'full' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title.replace(/<[^>]+>/g, ''))}" ${attrs}>
      <div class="grabber"></div>
      <div class="sheet-head">
        <button class="sh-btn" data-act="${leftAct}">${left}</button>
        <div class="sh-title">${title}</div>
        ${rightHtml || (right ? `<button class="sh-btn strong" data-act="${rightAct}">${right}</button>` : '<span></span>')}
      </div>
      <div class="sheet-body">${body}</div>
    </div>`;
  w._onClose = onClose;
  document.body.appendChild(w);
  document.documentElement.classList.add('sheet-open');
  void w.offsetWidth;
  requestAnimationFrame(() => w.classList.add('open'));
  dragToClose(w);
  return w;
}
function closeSheet(w = topSheet()) {
  if (!w || w.classList.contains('closing')) return;
  const fn = w._onClose; w._onClose = null;
  if (fn) fn(w);
  w.classList.add('closing'); w.classList.remove('open');
  const s = $('.sheet', w); s.style.transform = '';
  setTimeout(() => { w.remove(); if (!$('.sheet-wrap')) document.documentElement.classList.remove('sheet-open'); }, 360);
}
function dragToClose(w) {
  const sheet = $('.sheet', w), zones = [$('.grabber', w), $('.sheet-head', w)];
  let y0 = null, dy = 0, t0 = 0;
  const start = e => { if (e.target.closest('button,input,textarea')) return; y0 = e.touches ? e.touches[0].clientY : e.clientY; t0 = Date.now(); dy = 0; sheet.classList.add('dragging'); };
  const move = e => { if (y0 == null) return; dy = Math.max(0, (e.touches ? e.touches[0].clientY : e.clientY) - y0); sheet.style.transform = `translateY(${dy}px)`; };
  const end = () => {
    if (y0 == null) return; y0 = null; sheet.classList.remove('dragging');
    const v = dy / Math.max(1, Date.now() - t0);
    if (dy > 140 || (dy > 40 && v > .6)) closeSheet(w); else sheet.style.transform = '';
  };
  zones.forEach(z => { z.addEventListener('touchstart', start, { passive: true }); z.addEventListener('touchmove', move, { passive: true }); z.addEventListener('touchend', end); });
}
const radio = (name, opts, cur) => `<div class="opts">${opts.map(([v, l, extra]) => `<label class="opt"><input type="radio" name="${name}" value="${v}" ${v === cur ? 'checked' : ''}><span>${extra || ''}${l}</span></label>`).join('')}</div>`;
const field = (label, inner) => `<label class="field"><span>${label}</span>${inner}</label>`;
const formOf = () => $('form', topSheet());
const val = (f, n) => { const el = f.elements[n]; if (!el) return ''; return (el.value || '').trim(); };

/* toast */
let toastFn = null;
function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button data-act="toast-act">${esc(action.label)}</button>` : ''}`;
  toastFn = action ? action.fn : null;
  t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), action ? 5000 : 2200);
}
function removeWithUndo(id, label) {
  const prev = DB.remove(id);
  closeSheet(); App.render();
  if (prev) toast(`${label} raderad`, { label: 'Ångra', fn: () => { DB.put({ ...prev, deleted: false }); App.render(); } });
}
function armed(el, text) {
  if (el.dataset.armed) return true;
  el.dataset.armed = '1'; const old = el.innerHTML; el.textContent = text;
  setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.innerHTML = old; } }, 3200);
  return false;
}

/* ---------- task ---------- */
function taskSheet(t, def = {}) {
  const x = t || { title: '', date: def.date ?? '', time: '', priority: 'normal', category: def.cat || 'privat', note: '' };
  openSheet({
    title: t ? 'Uppgift' : 'Ny uppgift', right: t ? 'Spara' : 'Lägg till', rightAct: 'task-save',
    body: `<form data-id="${t ? t.id : ''}" data-submit="task-save" autocomplete="off">
      <label class="field"><input class="input big" name="title" placeholder="Vad behöver göras?" value="${esc(x.title)}" enterkeyhint="done" required></label>
      <div class="grid2">${field('Datum', `<input class="input" type="date" name="date" value="${esc(x.date)}">`)}${field('Tid', `<input class="input" type="time" name="time" value="${esc(x.time)}">`)}</div>
      <div class="field"><span class="lbl">Prioritet</span>${radio('priority', [['high', 'Hög', '<i class="pd" style="background:var(--red)"></i>'], ['normal', 'Normal', '<i class="pd" style="background:var(--accent)"></i>'], ['low', 'Låg', '<i class="pd" style="background:var(--text-3)"></i>']], x.priority || 'normal')}</div>
      <div class="field"><span class="lbl">Område</span>${radio('category', [['privat', 'Privat'], ['butik', 'Butik']], x.category || 'privat')}</div>
      ${field('Anteckning', `<textarea class="input" name="note" rows="3" placeholder="Valfritt">${esc(x.note)}</textarea>`)}
      ${t ? `<div class="del-row"><button type="button" class="btn danger" data-act="task-del" data-id="${t.id}">Radera uppgift</button></div>` : ''}
    </form>`,
  });
  if (!t) $('input[name=title]', topSheet()).focus({ preventScroll: true });
}

/* ---------- quick add ---------- */
function nextWeekday(name) { const i = WDL.indexOf(name.toLowerCase()); const d = new Date(); let diff = (i - d.getDay() + 7) % 7; if (diff === 0) diff = 7; d.setDate(d.getDate() + diff); return ymd(d); }
function dateFrom(day, month) { const d = new Date(), y = d.getFullYear(); let r = new Date(y, month - 1, day); if (ymd(r) < today()) r = new Date(y + 1, month - 1, day); return ymd(r); }
function parseQuick(s, base) {
  let txt = ' ' + s + ' ';
  const r = { priority: base.priority, category: base.category, date: base.date, time: '', hits: [] };
  const take = (re, fn) => { txt = txt.replace(re, (...m) => { fn(m); return ' '; }); };
  take(/\s!{1,3}(?=\s)/, () => { r.priority = 'high'; r.hits.push('p'); });
  take(/\s#butik(?=\s)/i, () => { r.category = 'butik'; r.hits.push('c'); });
  take(/\s#privat(?=\s)/i, () => { r.category = 'privat'; r.hits.push('c'); });
  take(/\s(?:kl\.?\s*)?([01]?\d|2[0-3])[:.]([0-5]\d)(?=\s)/i, m => { r.time = pad(m[1]) + ':' + m[2]; });
  if (!r.time) take(/\skl\.?\s*([01]?\d|2[0-3])(?=\s)/i, m => { r.time = pad(m[1]) + ':00'; });
  take(/\s(i\s?övermorgon|övermorgon)(?=\s)/i, () => { r.date = addDays(today(), 2); r.hits.push('d'); });
  take(/\s(i\s?morgon)(?=\s)/i, () => { r.date = addDays(today(), 1); r.hits.push('d'); });
  take(/\s(idag|ikväll)(?=\s)/i, () => { r.date = today(); r.hits.push('d'); });
  take(/\s(?:på\s+)?(måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag)(?=\s)/i, m => { r.date = nextWeekday(m[1]); r.hits.push('d'); });
  take(/\s(\d{1,2})\/(\d{1,2})(?=\s)/, m => { if (+m[2] >= 1 && +m[2] <= 12) { r.date = dateFrom(+m[1], +m[2]); r.hits.push('d'); } });
  take(/\s(\d{1,2})\s+(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)[a-zåäö]*\.?(?=\s)/i, m => { r.date = dateFrom(+m[1], MON.indexOf(m[2].toLowerCase()) + 1); r.hits.push('d'); });
  if (r.time && !r.date) r.date = today();
  r.title = txt.replace(/\s+/g, ' ').trim();
  return r;
}
function quickSheet() {
  const def = { date: UI.tab === 'kalender' ? (UI.calSel || today()) : '', category: UI.tab === 'butik' ? 'butik' : 'privat', priority: 'normal' };
  const w = openSheet({
    title: 'Snabbt tillägg', right: 'Lägg till', rightAct: 'quick-save', attrs: 'data-quick',
    body: `<div class="qa-links">
        <button class="qa-link" data-act="qa-order"><i class="t-orange">${I.box}</i>Order</button>
        <button class="qa-link" data-act="qa-note"><i class="t-blue">${I.note}</i>Anteckning</button>
        <button class="qa-link" data-act="qa-session"><i class="t-purple">${I.dumbbell}</i>Starta pass</button>
        <button class="qa-link" data-act="qa-product"><i class="t-green">${I.tag}</i>Produkt</button>
      </div>
      <form data-submit="quick-save" autocomplete="off" data-date="${def.date}">
        <input class="input big" name="q" placeholder="Ny uppgift…" enterkeyhint="done" autocomplete="off">
        <div class="preview" id="qa-prev"></div>
        <div class="field"><span class="lbl">Prioritet</span>${radio('priority', [['high', 'Hög'], ['normal', 'Normal'], ['low', 'Låg']], def.priority)}</div>
        <div class="field"><span class="lbl">Område</span>${radio('category', [['privat', 'Privat'], ['butik', 'Butik']], def.category)}</div>
        <p class="hint">Skriv naturligt, t.ex. <code>imorgon 14:00 ring leverantören #butik !</code> – datum, tid, <code>#butik</code> och <code>!</code> för hög prioritet känns igen automatiskt.</p>
      </form>`,
  });
  const inp = $('input[name=q]', w); inp.focus({ preventScroll: true });
  quickPreview();
}
function quickPreview() {
  const w = topSheet(); if (!w || !$('[data-quick]', w)) return;
  const f = $('form', w), q = f.elements.q.value;
  const r = parseQuick(q, { priority: f.elements.priority.value, category: f.elements.category.value, date: f.dataset.date || '' });
  const chips = [];
  if (r.date) chips.push(`<span>${relDay(r.date)}</span>`);
  if (r.time) chips.push(`<span>kl ${r.time}</span>`);
  if (r.priority === 'high') chips.push('<span class="h">Hög prioritet</span>');
  if (r.category === 'butik') chips.push('<span class="b">Butik</span>');
  $('#qa-prev', w).innerHTML = chips.length ? chips.join('') : '<em>Utan datum · Hamnar under ”Utan datum”</em>';
  if (r.hits.includes('p')) f.querySelector('input[name=priority][value=high]').checked = true;
  if (r.hits.includes('c')) f.querySelector(`input[name=category][value=${r.category}]`).checked = true;
}

/* ---------- order ---------- */
function orderSheet(o) {
  const x = o || { orderNo: '', customer: '', product: '', supplier: '', status: 'ny', tracking: '', date: today(), note: '' };
  const suppliers = [...new Set(DB.list('order').map(z => (z.supplier || '').trim()).filter(Boolean))];
  openSheet({
    title: o ? 'Order' : 'Ny order', right: 'Spara', rightAct: 'order-save',
    body: `<form data-id="${o ? o.id : ''}" data-submit="order-save" autocomplete="off">
      <div class="grid2">${field('Ordernummer', `<input class="input" name="orderNo" inputmode="numeric" placeholder="1042" value="${esc(x.orderNo)}">`)}${field('Orderdatum', `<input class="input" type="date" name="date" value="${esc(x.date)}">`)}</div>
      ${field('Produkt', `<input class="input" name="product" placeholder="Vad beställdes?" value="${esc(x.product)}">`)}
      ${field('Kund', `<input class="input" name="customer" placeholder="Namn" value="${esc(x.customer)}" autocomplete="off">`)}
      <div class="field"><span class="lbl">Status</span><div class="opts wrap">${OSTAT.map(([v, l]) => `<label class="opt"><input type="radio" name="status" value="${v}" ${v === x.status ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
      ${field('Leverantör', `<input class="input" name="supplier" placeholder="T.ex. leverantörens namn" value="${esc(x.supplier)}" list="sup-list"><datalist id="sup-list">${suppliers.map(s => `<option value="${esc(s)}">`).join('')}</datalist>`)}
      ${field('Spårningsnummer', `<input class="input" name="tracking" placeholder="Valfritt" value="${esc(x.tracking)}" autocapitalize="characters">`)}
      ${field('Anteckning', `<textarea class="input" name="note" rows="3" placeholder="Valfritt">${esc(x.note)}</textarea>`)}
      ${o ? `<div class="del-row"><button type="button" class="btn danger" data-act="order-del" data-id="${o.id}">Radera order</button></div>` : ''}
    </form>`,
  });
}

/* ---------- note ---------- */
function noteSheet(n) {
  const id = n ? n.id : uid();
  const w = openSheet({
    title: '', full: true, left: n && n.pinned ? 'Lossa' : 'Fäst', leftAct: 'note-pin', right: 'Klar', rightAct: 'sheet-close',
    body: `<div class="note-ed" data-note="${id}">
      <div class="note-meta">${n ? 'Ändrad ' + agoTs(n.updatedAt) + ' ' + hm(new Date(n.updatedAt)) : 'Ny anteckning'}</div>
      <input class="note-title" name="title" placeholder="Rubrik" value="${esc(n ? n.title : '')}" autocomplete="off">
      <textarea class="note-body" name="body" placeholder="Skriv något…">${esc(n ? n.body : '')}</textarea>
      ${n ? `<div style="padding:16px 0 4px"><button class="btn danger" data-act="note-del" data-id="${id}">Radera anteckning</button></div>` : ''}
    </div>`,
    onClose: () => {
      saveNote(id, true);
      const it = DB.get(id); if (it && !(it.title || '').trim() && !(it.body || '').trim()) { DB.remove(id); }
      App.render();
    },
  });
  w.dataset.noteId = id;
  if (!n) $('.note-title', w).focus({ preventScroll: true });
}
function saveNote(id, now = false) {
  const go = () => {
    const ed = $(`[data-note="${id}"]`); if (!ed) return;
    const title = $('.note-title', ed).value, body = $('.note-body', ed).value;
    const ex = DB.items[id];
    if (ex && !ex.deleted && ex.title === title && ex.body === body) return;
    if (!ex && !title.trim() && !body.trim()) return;
    const base = ex && !ex.deleted ? ex : { id, kind: 'note', pinned: false };
    DB.put({ ...base, title, body });
  };
  if (now) { clearTimeout(debouncers['note' + id]); go(); } else debounce('note' + id, go, 500);
}

/* ---------- template ---------- */
const exRow = e => `<div class="ex-row" data-eid="${e.id}">
  <input class="input" name="ex-name" placeholder="Övning" value="${esc(e.name)}" autocomplete="off">
  <button type="button" class="icon-btn sm" data-act="ex-del" aria-label="Ta bort övning">${I.close}</button>
  <div class="ex-nums">
    <label><input class="input sm" name="ex-sets" inputmode="numeric" value="${esc(e.sets)}" placeholder="3"><span>set</span></label>
    <label><input class="input sm" name="ex-reps" inputmode="numeric" value="${esc(e.reps)}" placeholder="10"><span>reps</span></label>
    <label><input class="input sm" name="ex-kg" inputmode="decimal" value="${esc(e.weight)}" placeholder="–"><span>kg</span></label>
  </div>
</div>`;
function tplSheet(tp) {
  const x = tp || { name: '', exercises: [{ id: uid(), name: '', sets: 3, reps: 10, weight: '' }] };
  openSheet({
    title: tp ? 'Redigera pass' : 'Nytt pass', right: 'Spara', rightAct: 'tpl-save', full: true,
    body: `<form data-id="${tp ? tp.id : ''}" data-submit="tpl-save" autocomplete="off">
      ${field('Namn på passet', `<input class="input big" name="name" placeholder="T.ex. Push, Ben, Helkropp" value="${esc(x.name)}">`)}
      <span class="lbl" style="margin-top:6px">Övningar</span>
      <div id="ex-list">${x.exercises.map(exRow).join('')}</div>
      <button type="button" class="btn tinted" data-act="ex-add">${I.plus}Lägg till övning</button>
      <p class="hint" style="margin-top:12px">Kg är startvikt första gången. Därefter fylls vikterna i automatiskt från ditt senaste pass.</p>
      ${tp ? `<div class="del-row"><button type="button" class="btn danger" data-act="tpl-del" data-id="${tp.id}">Radera pass</button></div>` : ''}
    </form>`,
  });
  if (!tp) $('input[name=name]', topSheet()).focus({ preventScroll: true });
}

/* ---------- session ---------- */
function sessionBody(s) {
  const c = setCount(s), pct = c.t ? Math.round(c.d / c.t * 100) : 0;
  return `<div class="sess-top">
    <div class="sess-meta"><span>${s.finishedAt ? `${longDate(ymd(new Date(s.startedAt)))} · ${durWords(s.finishedAt - s.startedAt)}` : `Startade ${hm(new Date(s.startedAt))}`}</span><span><b data-count>${c.d}</b>/${c.t} set</span></div>
    <div class="bar ${pct === 100 ? 'done' : ''} ${pct === 0 ? 'zero' : ''}" data-prog><i style="width:${pct}%"></i></div>
  </div>
  ${s.exercises.map((e, i) => {
    const prev = s.finishedAt ? null : lastSetsFor(e.name), top = prev && prev.length ? prev.reduce((a, b) => (num(b.weight) > num(a.weight) ? b : a)) : null;
    return `<div class="ex">
      <div class="ex-h"><h3>${esc(e.name)}</h3><span>${top && num(top.weight) ? `Förra: ${fmt(num(top.weight))} kg × ${esc(top.reps)}` : esc(e.target || '')}</span></div>
      <div class="set-head"><span>Set</span><span>Reps</span><span>Kg</span><span></span></div>
      ${e.sets.map((x, j) => `<div class="set ${x.done ? 'done' : ''}">
        <span class="set-n">${j + 1}</span>
        <input class="input sm" inputmode="numeric" data-set="${i}:${j}:reps" value="${esc(x.reps)}" placeholder="–" aria-label="Reps set ${j + 1}">
        <input class="input sm" inputmode="decimal" data-set="${i}:${j}:weight" value="${esc(x.weight)}" placeholder="–" aria-label="Kg set ${j + 1}">
        <button class="check ${x.done ? 'on' : ''}" data-act="set-done" data-i="${i}" data-j="${j}" aria-label="Set ${j + 1} klart">${I.checkB}</button>
      </div>`).join('')}
      <button class="add-set" data-act="set-add" data-i="${i}">${I.plus}Lägg till set</button>
    </div>`;
  }).join('')}
  <form class="add-ex" data-submit="ex-quick"><input class="input" name="exname" placeholder="Lägg till övning…" autocomplete="off" enterkeyhint="done"><button class="btn tinted">Lägg till</button></form>
  ${s.finishedAt
    ? `<button class="btn danger" data-act="sess-del">Radera pass</button>`
    : `<button class="btn" data-act="sess-finish">Avsluta pass</button><button class="btn ghost" style="margin-top:6px" data-act="sess-discard">Avbryt pass</button>`}`;
}
function sessionSheet(id) {
  const s = DB.get(id); if (!s) return;
  const w = openSheet({
    title: esc(s.name), full: true, left: 'Stäng',
    rightHtml: s.finishedAt ? '<span></span>' : `<span class="sh-right"><span class="timer" data-timer="${s.startedAt}">${clock(Date.now() - s.startedAt)}</span></span>`,
    body: sessionBody(s), onClose: () => App.render(),
  });
  w.dataset.session = id;
}
function rerenderSession(w) {
  const s = DB.get(w.dataset.session); if (!s) return;
  const b = $('.sheet-body', w), st = b.scrollTop; b.innerHTML = sessionBody(s); b.scrollTop = st;
}
function startSession(tplId) {
  const act = activeSession();
  if (act) { toast('Du har redan ett pass igång'); sessionSheet(act.id); return; }
  const tp = DB.get(tplId); if (!tp) return;
  const s = {
    id: uid(), kind: 'session', templateId: tp.id, name: tp.name, startedAt: Date.now(), finishedAt: null,
    exercises: tp.exercises.filter(e => e.name.trim()).map(e => {
      const prev = lastSetsFor(e.name), n = Math.min(12, Math.max(1, parseInt(e.sets, 10) || 3));
      return {
        id: uid(), name: e.name.trim(), target: `${n} × ${e.reps || '–'}`,
        sets: Array.from({ length: n }, (_, k) => {
          const p = prev && (prev[k] || prev[prev.length - 1]);
          return { reps: String(e.reps || (p && p.reps) || ''), weight: String((p && p.weight) || e.weight || ''), done: false };
        }),
      };
    }),
  };
  DB.put(s); App.render(); sessionSheet(s.id);
}
function updateSessProgress(w, s) {
  const c = setCount(s), pct = c.t ? Math.round(c.d / c.t * 100) : 0, bar = $('[data-prog]', w);
  $('[data-count]', w).textContent = c.d;
  bar.classList.toggle('done', pct === 100); bar.classList.toggle('zero', pct === 0);
  $('i', bar).style.width = pct + '%';
}

/* ---------- checklist / product / goal ---------- */
function clSheet(c) {
  const x = c || { name: '', cadence: 'vecka', items: [] };
  openSheet({
    title: c ? 'Checklista' : 'Ny checklista', right: 'Spara', rightAct: 'cl-save',
    body: `<form data-id="${c ? c.id : ''}" data-submit="cl-save" autocomplete="off">
      ${field('Namn', `<input class="input" name="name" placeholder="T.ex. Veckostart" value="${esc(x.name)}">`)}
      <div class="field"><span class="lbl">Nollställs</span><div class="opts wrap">${Object.entries(CADENCE).map(([v, l]) => `<label class="opt"><input type="radio" name="cadence" value="${v}" ${v === x.cadence ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
      ${field('Punkter – en per rad', `<textarea class="input" name="items" rows="7" placeholder="Gå igenom ordrar&#10;Svara på mejl">${esc(x.items.map(i => i.text).join('\n'))}</textarea>`)}
      ${c ? `<div class="del-row"><button type="button" class="btn danger" data-act="cl-del" data-id="${c.id}">Radera checklista</button></div>` : ''}
    </form>`,
  });
  if (!c) $('input[name=name]', topSheet()).focus({ preventScroll: true });
}
function prodSheet(p) {
  const x = p || { name: '', supplier: '', link: '', note: '', stages: {} };
  openSheet({
    title: p ? 'Produkt' : 'Ny produkt', right: 'Spara', rightAct: 'prod-save',
    body: `<form data-id="${p ? p.id : ''}" data-submit="prod-save" autocomplete="off">
      ${field('Produktnamn', `<input class="input" name="name" placeholder="T.ex. Vitamin C-serum" value="${esc(x.name)}">`)}
      ${field('Leverantör', `<input class="input" name="supplier" placeholder="Valfritt" value="${esc(x.supplier)}">`)}
      ${field('Länk', `<input class="input" name="link" type="url" inputmode="url" placeholder="https://" value="${esc(x.link)}">`)}
      <div class="field"><span class="lbl">Klart</span><div class="opts wrap">${STAGES.map(([k, l]) => `<label class="opt"><input type="checkbox" name="st-${k}" ${x.stages && x.stages[k] ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
      ${field('Anteckning', `<textarea class="input" name="note" rows="3" placeholder="Valfritt">${esc(x.note)}</textarea>`)}
      ${p && p.link ? `<a class="btn secondary" href="${esc(p.link)}" target="_blank" rel="noopener" style="text-decoration:none;margin-bottom:10px">Öppna länk</a>` : ''}
      ${p ? `<div class="del-row"><button type="button" class="btn danger" data-act="prod-del" data-id="${p.id}">Radera produkt</button></div>` : ''}
    </form>`,
  });
  if (!p) $('input[name=name]', topSheet()).focus({ preventScroll: true });
}
function goalSheet(g) {
  const x = g || { title: '', type: 'manual', current: 0, target: '', unit: '', step: 1, deadline: '' };
  openSheet({
    title: g ? 'Mål' : 'Nytt mål', right: 'Spara', rightAct: 'goal-save',
    body: `<form data-id="${g ? g.id : ''}" data-submit="goal-save" data-type="${x.type}" autocomplete="off" class="goal-form">
      ${field('Mål', `<input class="input" name="title" placeholder="T.ex. Omsättning i oktober" value="${esc(x.title)}">`)}
      <div class="field"><span class="lbl">Räknas</span>${radio('gtype', [['manual', 'Manuellt'], ['auto-week', 'Pass/vecka'], ['auto-month', 'Pass/månad']], x.type)}</div>
      <div class="grid2">
        <label class="field manual-only"><span>Nuvarande</span><input class="input" name="current" inputmode="decimal" value="${esc(x.current)}"></label>
        ${field('Mål', `<input class="input" name="target" inputmode="decimal" placeholder="100" value="${esc(x.target)}">`)}
        ${field('Enhet', `<input class="input" name="unit" placeholder="kr, st, pass" value="${esc(x.unit)}">`)}
        <label class="field manual-only"><span>Steg för + / −</span><input class="input" name="step" inputmode="decimal" value="${esc(x.step || 1)}"></label>
      </div>
      ${field('Deadline', `<input class="input" type="date" name="deadline" value="${esc(x.deadline)}">`)}
      ${g ? `<div class="del-row"><button type="button" class="btn danger" data-act="goal-del" data-id="${g.id}">Radera mål</button></div>` : ''}
    </form>`,
  });
  toggleGoalFields();
  if (!g) $('input[name=title]', topSheet()).focus({ preventScroll: true });
}
function toggleGoalFields() {
  const f = $('.goal-form', topSheet()); if (!f) return;
  const manual = f.elements.gtype.value === 'manual';
  $$('.manual-only', f).forEach(el => { el.hidden = !manual; });
  if (!manual && !f.elements.unit.value) f.elements.unit.value = 'pass';
}

/* ---------- search ---------- */
function searchSheet() {
  const w = openSheet({
    title: 'Sök', full: true, left: 'Stäng',
    body: `<div class="search-box">${I.search}<input id="search-in" class="input" type="search" placeholder="Uppgifter, ordrar, anteckningar…" autocomplete="off" enterkeyhint="search"></div><div id="search-res"></div>`,
  });
  $('#search-in', w).focus({ preventScroll: true });
  runSearch('');
}
function hl(text, q, around = 0) {
  text = String(text || ''); const i = text.toLowerCase().indexOf(q);
  if (i < 0) return esc(around ? text.slice(0, around * 2) : text);
  let a = 0, b = text.length;
  if (around) { a = Math.max(0, i - around); b = Math.min(text.length, i + q.length + around); }
  return (a > 0 ? '…' : '') + esc(text.slice(a, i)) + `<mark>${esc(text.slice(i, i + q.length))}</mark>` + esc(text.slice(i + q.length, b)) + (b < text.length ? '…' : '');
}
function runSearch(raw) {
  const out = $('#search-res'); if (!out) return;
  const q = raw.trim().toLowerCase();
  if (!q) { out.innerHTML = '<p class="hint" style="text-align:center;padding:40px 20px">Sök bland uppgifter, ordrar, anteckningar, produkter, pass och checklistor.</p>'; return; }
  const has = (...f) => f.some(v => String(v || '').toLowerCase().includes(q));
  const row = (act, id, ic, tone, title, sub) => `<div class="row" data-act="${act}" data-id="${id}" role="button" tabindex="0"><span class="res-ic t-${tone}">${ic}</span><div class="row-main"><div class="row-title">${title}</div>${sub ? `<div class="row-sub">${sub}</div>` : ''}</div><span class="chev">${I.chevR}</span></div>`;
  const groups = [
    ['Uppgifter', DB.list('task').filter(t => has(t.title, t.note)).sort(byTask).map(t => row('task-edit', t.id, I.task, t.done ? 'green' : 'blue', hl(t.title, q), [t.date ? relDay(t.date) : 'Utan datum', t.done ? 'Klar' : '', t.note && t.note.toLowerCase().includes(q) ? hl(t.note, q, 24) : ''].filter(Boolean).join(' · ')))],
    ['Ordrar', DB.list('order').filter(o => has(o.orderNo, o.customer, o.product, o.supplier, o.tracking, o.note)).map(o => row('order-edit', o.id, I.box, 'orange', hl(o.product || 'Order', q), [o.orderNo ? '#' + hl(o.orderNo, q) : '', hl(o.customer, q), OSTAT_L[o.status], o.tracking && o.tracking.toLowerCase().includes(q) ? hl(o.tracking, q) : ''].filter(Boolean).join(' · ')))],
    ['Anteckningar', DB.list('note').filter(n => has(n.title, n.body)).map(n => row('note-edit', n.id, I.note, 'orange', hl(n.title || (n.body || '').split('\n')[0] || 'Anteckning', q), (n.body || '').toLowerCase().includes(q) ? hl(n.body, q, 30) : ''))],
    ['Produkter', DB.list('product').filter(p => has(p.name, p.note, p.supplier)).map(p => row('prod-edit', p.id, I.tag, 'green', hl(p.name, q), prodPct(p) + ' % klar'))],
    ['Träning', [...DB.list('template').filter(t => has(t.name, ...t.exercises.map(e => e.name))).map(t => row('tpl-edit', t.id, I.dumbbell, 'purple', hl(t.name, q), 'Passmall')),
      ...sessions().filter(s => has(s.name, ...s.exercises.map(e => e.name))).slice(0, 8).map(s => row('sess-open', s.id, I.dumbbell, 'purple', hl(s.name, q), `${longDate(ymd(new Date(s.finishedAt)))}`))]],
    ['Checklistor & mål', [...DB.list('checklist').filter(c => has(c.name, ...c.items.map(i => i.text))).map(c => row('cl-edit', c.id, I.listck, 'blue', hl(c.name, q), CADENCE[c.cadence])),
      ...DB.list('goal').filter(g => has(g.title)).map(g => row('goal-edit', g.id, I.target, 'red', hl(g.title, q), `${fmt(goalValue(g))} / ${fmt(num(g.target))} ${esc(g.unit || '')}`))]],
  ].filter(g => g[1].length);
  out.innerHTML = groups.length ? groups.map(([l, rows]) => `<div class="res-g"><h4>${l}</h4><div class="list">${rows.join('')}</div></div>`).join('')
    : `<p class="hint" style="text-align:center;padding:40px 20px">Inga träffar för ”${esc(raw.trim())}”.</p>`;
}

/* ---------- settings ---------- */
function settingsBody() {
  const c = Sync.cfg(), s = Sync.ses();
  let sync;
  if (!Sync.configured() || UI._editCfg) {
    sync = `${field('Project URL', `<input class="input" name="url" inputmode="url" autocapitalize="off" spellcheck="false" placeholder="https://xxxx.supabase.co" value="${esc(c.url)}">`)}
      ${field('Anon public key', `<input class="input" name="key" autocapitalize="off" spellcheck="false" placeholder="eyJhbGciOi…" value="${esc(c.key)}">`)}
      <button class="btn" data-act="cfg-save">Spara anslutning</button>
      <p class="hint" style="margin-top:10px">Finns i Supabase under <b>Project Settings → API</b>. Gratisnivån räcker gott.</p>`;
  } else if (!s) {
    sync = `${field('E-post', `<input class="input" name="email" type="email" autocomplete="username" autocapitalize="off" placeholder="namn@exempel.se">`)}
      ${field('Lösenord', `<input class="input" name="password" type="password" autocomplete="current-password" placeholder="Minst 6 tecken">`)}
      <div class="btn-row"><button class="btn" data-act="auth-in">Logga in</button><button class="btn secondary" data-act="auth-up">Skapa konto</button></div>
      <p class="hint" style="margin-top:10px">Logga in med samma konto på iPhone och dator så synkas allt automatiskt.</p>`;
  } else {
    sync = `<div class="acct"><span class="acct-av">${esc((s.email || '?')[0].toUpperCase())}</span><div><b>Inloggad</b><p>${esc(s.email)}</p></div></div>
      <button class="sync-line" data-sync data-state="${Sync.state}" style="margin:0 0 12px"><i></i><span class="sync-t">${Sync.label()}</span></button>
      ${Sync.state === 'error' ? `<p class="form-msg err" style="margin:0 0 12px">${esc(Sync.msg)}</p>` : ''}
      <div class="btn-row"><button class="btn secondary" data-act="sync-now">Synka nu</button><button class="btn secondary" data-act="auth-out">Logga ut</button></div>`;
  }
  return `<div class="group-label">Profil</div>
    <div class="panel">${field('Namn i hälsningen', `<input class="input" name="uname" value="${esc(UI.name)}" autocomplete="off">`)}</div>
    <div class="group-label">Synk mellan enheter</div>
    <div class="panel">${sync}<p class="form-msg" id="auth-msg"></p>
      ${Sync.configured() && !UI._editCfg ? `<button class="link" style="font-size:14px;margin-top:6px" data-act="cfg-edit">Ändra Supabase-anslutning</button>` : ''}</div>
    <div class="group-label">Säkerhetskopia</div>
    <div class="panel"><div class="btn-row"><button class="btn secondary" data-act="export">Exportera</button><button class="btn secondary" data-act="import">Importera</button></div>
      <p class="hint" style="margin-top:10px">Sparar allt som en fil. Bra att ha, även om allt synkas.</p></div>
    <p class="ver">HQ ${VERSION}</p>`;
}
function settingsSheet() {
  const w = openSheet({ title: 'Inställningar', left: 'Stäng', body: `<div id="settings-body">${settingsBody()}</div>`, onClose: () => { UI._editCfg = false; } });
  w.dataset.settings = '1';
}
const rerenderSettings = () => { const b = $('#settings-body'); if (b) b.innerHTML = settingsBody(); };
function authMsg(text, kind = 'err') { const m = $('#auth-msg'); if (m) { m.className = `form-msg ${kind}`; m.textContent = text; } }

/* =========================================================================
   Actions
   ========================================================================= */
function goTab(tab) {
  if (tab === UI.tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  scrollPos[UI.tab] = window.scrollY; UI.tab = tab; saveUI();
  App.render(true); window.scrollTo(0, scrollPos[tab] || 0);
}
const ACT = {
  'tab': el => goTab(el.dataset.tab),
  'sub': el => { UI.sub[el.dataset.key] = el.dataset.v; saveUI(); App.render(); },
  'go-orders': () => { UI.sub.butik = 'ordrar'; UI.orderFilter = 'aktiva'; goTab('butik'); App.render(); },
  'go-goals': () => { UI.sub.noter = 'mal'; goTab('noter'); App.render(); },
  'search': () => searchSheet(),
  'settings': () => settingsSheet(),
  'quick': () => quickSheet(),
  'sheet-close': () => closeSheet(),
  'toast-act': () => { const f = toastFn; toastFn = null; $('#toast').classList.remove('show'); if (f) f(); },
  'hide-install': () => { UI.hideInstall = true; saveUI(); App.render(); },

  /* tasks */
  'task-new': el => taskSheet(null, { date: el.dataset.date || '', cat: el.dataset.cat || (UI.tab === 'butik' ? 'butik' : 'privat') }),
  'task-edit': el => taskSheet(DB.get(el.dataset.id)),
  'task-toggle': el => {
    const t = DB.get(el.dataset.id); if (!t) return;
    t.done = !t.done; t.doneAt = t.done ? Date.now() : null; DB.put(t);
    el.classList.toggle('on', t.done); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    const row = el.closest('.row'); if (row) row.classList.toggle('is-done', t.done);
    if (t.done) toast('Klar', { label: 'Ångra', fn: () => { t.done = false; t.doneAt = null; DB.put(t); App.render(); } });
    debounce('rerender', () => { App.render(); if ($('#search-in')) runSearch($('#search-in').value); }, 650);
  },
  'task-save': () => {
    const f = formOf(), title = val(f, 'title');
    if (!title) { f.elements.title.focus(); return; }
    const ex = f.dataset.id ? DB.get(f.dataset.id) : null;
    DB.put({ ...(ex || { id: uid(), kind: 'task', done: false }), title, date: val(f, 'date'), time: val(f, 'time'), priority: f.elements.priority.value, category: f.elements.category.value, note: val(f, 'note') });
    closeSheet(); App.render(); if (!ex) toast('Uppgift tillagd');
  },
  'task-del': el => removeWithUndo(el.dataset.id, 'Uppgift'),
  'quick-save': () => {
    const f = formOf(), q = f.elements.q.value.trim();
    if (!q) { f.elements.q.focus(); return; }
    const r = parseQuick(q, { priority: f.elements.priority.value, category: f.elements.category.value, date: f.dataset.date || '' });
    DB.put({ id: uid(), kind: 'task', done: false, title: r.title || q, date: r.date, time: r.time, priority: r.priority, category: r.category, note: '' });
    closeSheet(); App.render(); toast(r.date ? `Tillagd · ${relDay(r.date)}${r.time ? ' ' + r.time : ''}` : 'Tillagd');
  },
  'qa-order': () => { closeSheet(); orderSheet(null); },
  'qa-note': () => { closeSheet(); noteSheet(null); },
  'qa-product': () => { closeSheet(); prodSheet(null); },
  'qa-session': () => { closeSheet(); const a = activeSession(); if (a) sessionSheet(a.id); else { UI.sub.traning = 'pass'; goTab('traning'); App.render(); } },

  /* calendar */
  'cal-sel': el => { UI.calSel = el.dataset.d; const m = el.dataset.d.slice(0, 7); if (m !== (UI.calMonth || '')) { UI._slide = el.dataset.d > (UI.calMonth || '') + '-01' ? 'slide-l' : 'slide-r'; } UI.calMonth = m; App.render(); },
  'cal-month': el => moveMonth(+el.dataset.d),
  'cal-today': () => { UI.calSel = today(); UI.calMonth = today().slice(0, 7); App.render(); },

  /* training */
  'tpl-new': () => tplSheet(null),
  'tpl-edit': el => tplSheet(DB.get(el.dataset.id)),
  'ex-add': () => { const l = $('#ex-list', topSheet()); l.insertAdjacentHTML('beforeend', exRow({ id: uid(), name: '', sets: 3, reps: 10, weight: '' })); const i = $$('input[name=ex-name]', l).pop(); i.focus(); },
  'ex-del': el => { const r = el.closest('.ex-row'); r.style.transition = 'opacity .2s, transform .2s'; r.style.opacity = '0'; r.style.transform = 'scale(.96)'; setTimeout(() => r.remove(), 180); },
  'tpl-save': () => {
    const f = formOf(), name = val(f, 'name');
    if (!name) { f.elements.name.focus(); return; }
    const exercises = $$('.ex-row', f).map(r => ({ id: r.dataset.eid, name: $('[name=ex-name]', r).value.trim(), sets: parseInt($('[name=ex-sets]', r).value, 10) || 3, reps: $('[name=ex-reps]', r).value.trim(), weight: $('[name=ex-kg]', r).value.trim() })).filter(e => e.name);
    const ex = f.dataset.id ? DB.get(f.dataset.id) : null;
    DB.put({ ...(ex || { id: uid(), kind: 'template' }), name, exercises });
    closeSheet(); App.render(); toast(ex ? 'Pass sparat' : 'Pass skapat');
  },
  'tpl-del': el => removeWithUndo(el.dataset.id, 'Pass'),
  'sess-start': el => startSession(el.dataset.id),
  'sess-open': el => sessionSheet(el.dataset.id),
  'set-done': el => {
    const w = el.closest('.sheet-wrap'), s = DB.get(w.dataset.session); if (!s) return;
    const set = s.exercises[+el.dataset.i].sets[+el.dataset.j];
    set.done = !set.done; set.doneAt = set.done ? Date.now() : null; DB.put(s);
    el.classList.toggle('on', set.done); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    el.closest('.set').classList.toggle('done', set.done);
    updateSessProgress(w, s);
  },
  'set-add': el => {
    const w = el.closest('.sheet-wrap'), s = DB.get(w.dataset.session); if (!s) return;
    const e = s.exercises[+el.dataset.i], l = e.sets[e.sets.length - 1] || {};
    e.sets.push({ reps: l.reps || '', weight: l.weight || '', done: false }); DB.put(s); rerenderSession(w);
  },
  'sess-finish': el => {
    const w = el.closest('.sheet-wrap'), s = DB.get(w.dataset.session); if (!s) return;
    if (setCount(s).d === 0 && !armed(el, 'Inga set avbockade – tryck igen')) return;
    s.finishedAt = Date.now(); DB.put(s); closeSheet(w); App.render();
    toast(`Pass sparat · ${durWords(s.finishedAt - s.startedAt)}`);
  },
  'sess-discard': el => { if (!armed(el, 'Tryck igen för att avbryta passet')) return; removeWithUndo(el.closest('.sheet-wrap').dataset.session, 'Pass'); },
  'sess-del': el => { if (!armed(el, 'Tryck igen för att radera')) return; removeWithUndo(el.closest('.sheet-wrap').dataset.session, 'Pass'); },
  'ex-pick': el => { UI.exercise = el.dataset.v; saveUI(); App.render(); },

  /* orders */
  'order-filter': el => { UI.orderFilter = el.dataset.v; saveUI(); App.render(); },
  'order-new': () => orderSheet(null),
  'order-edit': el => orderSheet(DB.get(el.dataset.id)),
  'order-next': el => {
    const o = DB.get(el.dataset.id); if (!o) return;
    const prev = o.status; o.status = NEXT_STATUS[o.status]; DB.put(o); App.render();
    toast(`Markerad som ${OSTAT_L[o.status].toLowerCase()}`, { label: 'Ångra', fn: () => { o.status = prev; DB.put(o); App.render(); } });
  },
  'order-save': () => {
    const f = formOf(), ex = f.dataset.id ? DB.get(f.dataset.id) : null;
    const o = { ...(ex || { id: uid(), kind: 'order' }) };
    ['orderNo', 'customer', 'product', 'supplier', 'tracking', 'date', 'note'].forEach(k => { o[k] = val(f, k); });
    o.orderNo = o.orderNo.replace(/^#/, '');
    o.status = f.elements.status.value || 'ny';
    if (!o.product && !o.orderNo && !o.customer) { f.elements.product.focus(); return; }
    DB.put(o); closeSheet(); App.render(); toast(ex ? 'Order sparad' : 'Order tillagd');
  },
  'order-del': el => removeWithUndo(el.dataset.id, 'Order'),

  /* checklists */
  'cl-toggle': el => { const id = el.dataset.id, card = el.closest('.cl'); UI.openCl[id] = !UI.openCl[id]; if (!UI.openCl[id]) delete UI.openCl[id]; saveUI(); card.classList.toggle('open', !!UI.openCl[id]); el.setAttribute('aria-expanded', !!UI.openCl[id]); },
  'cl-check': el => {
    const c = DB.get(el.dataset.id); if (!c) return;
    const pk = periodKey(c.cadence); let ch = clChecked(c).slice(); const i = el.dataset.item;
    ch = ch.includes(i) ? ch.filter(x => x !== i) : [...ch, i];
    c.checked = ch; c.period = pk; DB.put(c);
    const on = ch.includes(i), chk = $('.check', el);
    el.classList.toggle('on', on); chk.classList.toggle('on', on); chk.classList.remove('pop'); void chk.offsetWidth; chk.classList.add('pop');
    const card = el.closest('.cl'), n = c.items.filter(x => ch.includes(x.id)).length, tot = c.items.length;
    $('.ring', card).style.setProperty('--p', tot ? Math.round(n / tot * 100) : 0);
    $('.ring-wrap b', card).textContent = `${n}/${tot}`;
    $('.ring-wrap', card).classList.toggle('done', tot && n === tot);
    if (tot && n === tot) toast(`${c.name} klar`);
  },
  'cl-reset': el => { const c = DB.get(el.dataset.id); if (!c) return; const prev = c.checked; c.checked = []; c.period = periodKey(c.cadence); DB.put(c); App.render(); toast('Nollställd', { label: 'Ångra', fn: () => { c.checked = prev; DB.put(c); App.render(); } }); },
  'cl-new': () => clSheet(null),
  'cl-edit': el => clSheet(DB.get(el.dataset.id)),
  'cl-save': () => {
    const f = formOf(), name = val(f, 'name'); if (!name) { f.elements.name.focus(); return; }
    const ex = f.dataset.id ? DB.get(f.dataset.id) : null, old = ex ? ex.items : [];
    const items = f.elements.items.value.split('\n').map(s => s.trim()).filter(Boolean).map(text => { const m = old.find(o => o.text === text); return m || { id: uid(), text }; });
    const c = DB.put({ ...(ex || { id: uid(), kind: 'checklist', checked: [], period: '' }), name, cadence: f.elements.cadence.value, items });
    if (!ex) UI.openCl[c.id] = true; saveUI();
    closeSheet(); App.render();
  },
  'cl-del': el => removeWithUndo(el.dataset.id, 'Checklista'),

  /* products */
  'prod-new': () => prodSheet(null),
  'prod-edit': el => prodSheet(DB.get(el.dataset.id)),
  'prod-stage': el => {
    const p = DB.get(el.dataset.id); if (!p) return;
    p.stages = { ...(p.stages || {}), [el.dataset.k]: !(p.stages || {})[el.dataset.k] }; DB.put(p);
    el.classList.toggle('on', !!p.stages[el.dataset.k]);
    const card = el.closest('.prod'), pct = prodPct(p), bar = $('.bar', card);
    $('.prod-h span', card).textContent = pct === 100 ? 'Klar' : pct + ' %';
    bar.classList.toggle('done', pct === 100); bar.classList.toggle('zero', pct === 0); $('i', bar).style.width = pct + '%';
    if (pct === 100) toast(`${p.name} är klar`);
  },
  'prod-save': () => {
    const f = formOf(), name = val(f, 'name'); if (!name) { f.elements.name.focus(); return; }
    const ex = f.dataset.id ? DB.get(f.dataset.id) : null;
    const stages = Object.fromEntries(STAGES.map(([k]) => [k, f.elements['st-' + k].checked]));
    DB.put({ ...(ex || { id: uid(), kind: 'product' }), name, supplier: val(f, 'supplier'), link: val(f, 'link'), note: val(f, 'note'), stages });
    closeSheet(); App.render();
  },
  'prod-del': el => removeWithUndo(el.dataset.id, 'Produkt'),

  /* notes */
  'note-new': () => noteSheet(null),
  'note-edit': el => noteSheet(DB.get(el.dataset.id)),
  'note-pin': el => {
    const w = topSheet(), id = w.dataset.noteId; saveNote(id, true);
    const n = DB.get(id); if (!n) { toast('Skriv något först'); return; }
    n.pinned = !n.pinned; DB.put(n); el.textContent = n.pinned ? 'Lossa' : 'Fäst'; toast(n.pinned ? 'Fäst överst' : 'Lossad');
  },
  'note-del': el => { const w = topSheet(); w._onClose = null; removeWithUndo(el.dataset.id, 'Anteckning'); },

  /* goals */
  'goal-new': () => goalSheet(null),
  'goal-edit': el => goalSheet(DB.get(el.dataset.id)),
  'goal-step': el => { const g = DB.get(el.dataset.id); if (!g) return; g.current = Math.max(0, num(g.current) + (+el.dataset.d) * (num(g.step) || 1)); DB.put(g); App.render(); },
  'goal-save': () => {
    const f = formOf(), title = val(f, 'title'); if (!title) { f.elements.title.focus(); return; }
    const ex = f.dataset.id ? DB.get(f.dataset.id) : null;
    DB.put({ ...(ex || { id: uid(), kind: 'goal' }), title, type: f.elements.gtype.value, current: num(val(f, 'current')), target: num(val(f, 'target')) || 1, unit: val(f, 'unit'), step: num(val(f, 'step')) || 1, deadline: val(f, 'deadline') });
    closeSheet(); App.render();
  },
  'goal-del': el => removeWithUndo(el.dataset.id, 'Mål'),
  'toggle-done': () => { UI.showDone = !UI.showDone; saveUI(); App.render(); },

  /* settings & sync */
  'cfg-edit': () => { UI._editCfg = true; rerenderSettings(); },
  'cfg-save': () => {
    const b = $('#settings-body'), url = $('[name=url]', b).value.trim(), key = $('[name=key]', b).value.trim();
    if (!/^https:\/\/.+/.test(url) || key.length < 20) { authMsg('Kontrollera URL och nyckel – URL ska börja med https://'); return; }
    ls.set(K.cfg, { url, key }); UI._editCfg = false; DB.lastPull = null; DB.persist();
    Sync.setState(Sync.ses() ? 'syncing' : 'auth'); rerenderSettings(); Sync.run().then(rerenderSettings);
  },
  'auth-in': async el => {
    const b = $('#settings-body'), email = $('[name=email]', b).value.trim(), pw = $('[name=password]', b).value;
    if (!email || !pw) { authMsg('Fyll i e-post och lösenord.'); return; }
    el.disabled = true; el.textContent = 'Loggar in…';
    try { await Sync.signIn(email, pw); rerenderSettings(); App.render(); toast('Inloggad – synkar'); }
    catch (e) { authMsg(e instanceof TypeError ? 'Kunde inte nå Supabase. Kontrollera URL och internet.' : e.message); el.disabled = false; el.textContent = 'Logga in'; }
  },
  'auth-up': async el => {
    const b = $('#settings-body'), email = $('[name=email]', b).value.trim(), pw = $('[name=password]', b).value;
    if (!email || pw.length < 6) { authMsg('Ange e-post och ett lösenord på minst 6 tecken.'); return; }
    el.disabled = true; el.textContent = 'Skapar…';
    try {
      const r = await Sync.signUp(email, pw);
      if (r === 'in') { rerenderSettings(); App.render(); toast('Konto skapat – synkar'); }
      else { authMsg('Konto skapat! Bekräfta via mejlet vi skickade, och logga sedan in här.', 'ok'); el.disabled = false; el.textContent = 'Skapa konto'; }
    } catch (e) { authMsg(e instanceof TypeError ? 'Kunde inte nå Supabase. Kontrollera URL och internet.' : e.message); el.disabled = false; el.textContent = 'Skapa konto'; }
  },
  'auth-out': el => { if (!armed(el, 'Tryck igen')) return; Sync.signOut(); rerenderSettings(); App.render(); toast('Utloggad – datan finns kvar på enheten'); },
  'sync-now': async el => { el.disabled = true; await Sync.run(); el.disabled = false; rerenderSettings(); toast(Sync.state === 'ok' ? 'Allt är synkat' : Sync.label()); },
  'export': () => {
    const data = { app: 'HQ', version: VERSION, exported: new Date().toISOString(), items: Object.values(DB.items) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    a.download = `hq-backup-${today()}.json`; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  },
  'import': () => $('#import-file').click(),
};

/* =========================================================================
   Events
   ========================================================================= */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  if (el.tagName === 'A') return;
  e.preventDefault(); fn(el, e);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && topSheet()) { closeSheet(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-act]')) { e.preventDefault(); e.target.click(); }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!$('#search-in')) searchSheet(); }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, key = f.dataset.submit;
  if (key === 'ex-quick') {
    const w = f.closest('.sheet-wrap'), s = DB.get(w.dataset.session), name = f.elements.exname.value.trim(); if (!s || !name) return;
    const prev = lastSetsFor(name), p = prev && prev[prev.length - 1];
    s.exercises.push({ id: uid(), name, target: '', sets: Array.from({ length: 3 }, () => ({ reps: (p && p.reps) || '', weight: (p && p.weight) || '', done: false })) });
    DB.put(s); rerenderSession(w); const b = $('.sheet-body', w); b.scrollTop = b.scrollHeight; return;
  }
  if (key && ACT[key]) ACT[key](f);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.set) {
    const w = t.closest('.sheet-wrap'), id = w.dataset.session, [i, j, k] = t.dataset.set.split(':');
    const s = DB.get(id); if (!s) return;
    s.exercises[+i].sets[+j][k] = t.value;
    debounce('sess' + id, () => { const cur = DB.get(id); if (cur) DB.put(cur); }, 400);
    return;
  }
  if (t.id === 'search-in') { runSearch(t.value); return; }
  if (t.closest('[data-note]')) { saveNote(t.closest('[data-note]').dataset.note); return; }
  if (t.name === 'q' && t.closest('[data-quick]')) { quickPreview(); return; }
  if (t.name === 'uname') { UI.name = t.value.trim() || 'Fabinator'; saveUI(); debounce('nm', () => App.render(), 300); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.name === 'gtype') toggleGoalFields();
  if ((t.name === 'priority' || t.name === 'category') && t.closest('[data-quick]')) quickPreview();
  if (t.id === 'import-file' && t.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result), items = Array.isArray(d) ? d : d.items; if (!Array.isArray(items)) throw new Error();
        let n = 0;
        items.forEach(it => { if (!it || !it.id || !it.kind) return; const loc = DB.items[it.id]; if (!loc || (it.updatedAt || 0) > (loc.updatedAt || 0)) { DB.items[it.id] = it; DB.dirty[it.id] = 1; n++; } });
        DB.persist(); Sync.soon(200); App.render(); toast(`${n} poster importerade`);
      } catch { toast('Filen kunde inte läsas'); }
      t.value = '';
    };
    r.readAsText(t.files[0]);
  }
});

/* timers & lifecycle */
setInterval(() => { $$('[data-timer]').forEach(el => { el.textContent = clock(Date.now() - +el.dataset.timer); }); }, 1000);
let lastDay = today();
setInterval(() => {
  if (document.hidden || topSheet()) return;
  if (today() !== lastDay) { lastDay = today(); UI.calSel = null; UI.calMonth = null; }
  if (UI.tab === 'idag') App.refresh();
}, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { Sync.run(); if (!topSheet()) App.refresh(); } });
addEventListener('online', () => Sync.run());
addEventListener('offline', () => Sync.setState('offline'));
setInterval(() => { if (!document.hidden) Sync.run(); }, 45000);
addEventListener('pagehide', () => { const w = $('[data-note]'); if (w) saveNote(w.dataset.note, true); DB.persist(); });

/* boot */
DB.load();
const params = new URLSearchParams(location.search);
if (params.get('tab') && VIEWS[params.get('tab')]) UI.tab = params.get('tab');
buildTabbar();
Sync.state = !Sync.configured() ? 'local' : !Sync.ses() ? 'auth' : navigator.onLine ? 'syncing' : 'offline';
App.render(true);
Sync.run();
if (params.get('ny') === 'uppgift') setTimeout(quickSheet, 300);
if (params.toString()) history.replaceState(null, '', location.pathname);
window.HQ = { DB, Sync, UI, App };
})();
