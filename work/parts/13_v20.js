/* ============================================================
   v20.0 引擎：截图工具 / Windows 安全中心 / OneDrive / 地图
              附近共享 / 移动热点 / 录音机
   运行于主 IIFE 内（插入在 v19.js 之后、boot 之前）。
   ============================================================ */
var V20 = {
  nearbyOn: false, nearbyScan: 0, nearbySend: 0,
  hsOn: false, recTimer: 0, recStart: 0, recElapsed: 0, recPlaying: 0
};
state.v20 = state.v20 || {};

function v20T(k, ctx) { return _t(k, ctx); }
function v20Esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function v20Save() { try { localStorage.setItem('win11_v20', JSON.stringify(state.v20)); } catch (e) {} }
function v20Load() {
  try {
    var r = localStorage.getItem('win11_v20');
    if (r) { var o = JSON.parse(r) || {}; Object.keys(o).forEach(function (k) { state.v20[k] = o[k]; }); }
  } catch (e) {}
  var s = state.v20;
  s.snip = s.snip || { mode: 'rect', delay: 0, gallery: [] };
  if (!s.snip.gallery) s.snip.gallery = [];
  s.security = s.security || { lastScan: 0 };
  s.od = s.od || { paused: false, used: 63, total: 100 };
  s.maps = s.maps || { zoom: 1, traffic: false, pin: { x: 50, y: 50, label: 'maps_here' } };
  if (!s.maps.pin) s.maps.pin = { x: 50, y: 50, label: 'maps_here' };
  s.recorder = s.recorder || { recordings: [] };
  if (!s.recorder.recordings) s.recorder.recordings = [];
  s.nearby = s.nearby || { on: false, visibility: 'my', devices: [] };
  s.hs = s.hs || { on: false, band: '5g' };
}

/* ============================================================
   包裹：新增应用类型 snip / security / onedrive / maps / recorder
   ============================================================ */
var _v20RenderContent = AppWindows._renderContent;
AppWindows._renderContent = function (win, type) {
  var b = win.querySelector('.win-body');
  if (type === 'snip') { v20RenderSnip(b); return; }
  if (type === 'security') { v20RenderSecurity(b); return; }
  if (type === 'onedrive') { v20RenderOneDrive(b); return; }
  if (type === 'maps') { v20RenderMaps(b); return; }
  if (type === 'recorder') { v20RenderRecorder(b); return; }
  return _v20RenderContent.apply(this, arguments);
};
var _v20DefTitle = AppWindows._defaultTitle;
AppWindows._defaultTitle = function (type) {
  if (type === 'snip') return v20T('app_snip');
  if (type === 'security') return v20T('app_security');
  if (type === 'onedrive') return v20T('app_onedrive');
  if (type === 'maps') return v20T('app_maps');
  if (type === 'recorder') return v20T('app_recorder');
  return _v20DefTitle.apply(this, arguments);
};
var _v20DefIcon = AppWindows._defaultIcon;
AppWindows._defaultIcon = function (type) {
  if (type === 'snip') return '<svg viewBox="0 0 24 24"><use href="#v20-snip"/></svg>';
  if (type === 'security') return '<svg viewBox="0 0 24 24"><use href="#v20-shield"/></svg>';
  if (type === 'onedrive') return '<svg viewBox="0 0 24 24"><use href="#v20-cloud"/></svg>';
  if (type === 'maps') return '<svg viewBox="0 0 24 24"><use href="#v20-maps"/></svg>';
  if (type === 'recorder') return '<svg viewBox="0 0 24 24"><use href="#v20-recorder"/></svg>';
  return _v20DefIcon.apply(this, arguments);
};

/* ============================================================
   屏幕切换同步
   ============================================================ */
var _v20Go = go;
go = function (id) { var r = _v20Go.apply(this, arguments); v20SyncDesk(); return r; };

function v20OnDesk() {
  var d = $('#s-desktop');
  return !!(d && d.classList.contains('active'));
}
function v20SyncDesk() {
  var on = v20OnDesk();
  var nb = $('#v20Nearby'); if (nb) nb.hidden = !(on && V20.nearbyOn);
  var hs = $('#v20Hotspot'); if (hs) hs.hidden = !(on && V20.hsOn);
}
function v20TileState() {
  var tiles = document.querySelectorAll('.qp-grid [data-v20]');
  Array.prototype.forEach.call(tiles, function (t) {
    var a = t.dataset.v20;
    if (a === 'nearby') t.classList.toggle('on', !!state.v20.nearby.on);
    if (a === 'hotspot') t.classList.toggle('on', !!state.v20.hs.on);
  });
}

/* ============================================================
   1. 截图工具
   ============================================================ */
var V20_SNIP_GRADS = [
  'linear-gradient(135deg,#7c5cff,#b9a6ff)', 'linear-gradient(135deg,#0f6cbd,#4fb3ff)',
  'linear-gradient(135deg,#d13438,#ff8a80)', 'linear-gradient(135deg,#107c10,#6ee7a8)',
  'linear-gradient(135deg,#c19c00,#ffe066)', 'linear-gradient(135deg,#8764b8,#e0c8ff)',
  'linear-gradient(135deg,#008575,#5ce6c9)', 'linear-gradient(135deg,#5c2d91,#b49ae0)'
];
function v20FmtTime(ts) {
  var d = new Date(ts), z = function (n) { return ('0' + n).slice(-2); };
  return z(d.getHours()) + ':' + z(d.getMinutes());
}
function v20RenderSnip(body) {
  var st = state.v20.snip;
  var modes = [
    { id: 'rect', key: 'snip_mode_rect' },
    { id: 'window', key: 'snip_mode_window' },
    { id: 'full', key: 'snip_mode_full' }
  ];
  var gallery = st.gallery.slice().sort(function (a, b) { return b.ts - a.ts; });
  body.innerHTML =
    '<div class="v20-snip" style="position:relative">' +
      '<div class="v20-snip-flash" id="v20SnipFlash"></div>' +
      '<div class="v20-snip-bar">' +
        modes.map(function (m) {
          return '<button class="v20-chip' + (st.mode === m.id ? ' on' : '') + '" data-mode="' + m.id + '">' + v20Esc(v20T(m.key)) + '</button>';
        }).join('') +
        '<button class="v20-chip' + (st.delay === 3 ? ' on' : '') + '" data-delay="3">' + v20Esc(v20T('snip_delay')) + ': ' + (st.delay === 3 ? v20Esc(v20T('snip_delay3')) : v20Esc(v20T('snip_delay_off'))) + '</button>' +
        '<button class="v20-btn v20-snip-new" id="v20SnipNew">' + v20Esc(v20T('snip_new')) + '</button>' +
      '</div>' +
      '<div class="v20-sec">' + v20Esc(v20T('snip_gallery')) + ' · ' + gallery.length + '</div>' +
      '<div class="v20-gallery">' +
        (gallery.length ? gallery.map(function (g) {
          return '<div class="v20-snip-item" data-id="' + g.id + '">' +
            '<div class="v20-snip-thumb" style="background:' + g.grad + '"></div>' +
            '<div class="v20-snip-meta"><span>' + v20Esc(v20FmtTime(g.ts)) + '</span>' +
            '<button data-act="copy">' + v20Esc(v20T('snip_copy')) + '</button>' +
            '<button data-act="share">' + v20Esc(v20T('snip_share')) + '</button></div>' +
          '</div>';
        }).join('') : '<div class="v20-empty">' + v20Esc(v20T('snip_empty')) + '</div>') +
      '</div>' +
    '</div>';

  var bar = body.querySelector('.v20-snip-bar');
  if (bar) bar.addEventListener('click', function (e) {
    var b = e.target.closest('[data-mode]'); if (b) { st.mode = b.dataset.mode; v20Save(); v20RenderSnip(body); return; }
    var d = e.target.closest('[data-delay]'); if (d) { st.delay = st.delay === 3 ? 0 : 3; v20Save(); v20RenderSnip(body); return; }
  });
  var nw = $('#v20SnipNew');
  if (nw) nw.addEventListener('click', function () { v20DoSnip(body); });
  var gal = body.querySelector('.v20-gallery');
  if (gal) gal.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'copy') toast(v20T('toast_snip_copied'));
    else toast(v20T('snip_saved'));
  });
}
function v20DoSnip(body) {
  var st = state.v20.snip;
  var flash = body.querySelector('#v20SnipFlash');
  function cap() {
    if (flash) { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }
    var grad = V20_SNIP_GRADS[Math.floor(Math.random() * V20_SNIP_GRADS.length)];
    st.gallery.push({ id: 'sn' + Date.now(), ts: Date.now(), grad: grad });
    if (st.gallery.length > 24) st.gallery = st.gallery.slice(-24);
    v20Save();
    v20RenderSnip(body);
    toast(v20T('snip_saved'));
  }
  if (st.delay === 3) setTimeout(cap, 3000); else cap();
}

/* ============================================================
   2. Windows 安全中心
   ============================================================ */
function v20RenderSecurity(body) {
  var cards = [
    { key: 'sec_card1', on: true },
    { key: 'sec_card2', on: true },
    { key: 'sec_card3', on: true },
    { key: 'sec_card4', on: true },
    { key: 'sec_card5', on: false }
  ];
  body.innerHTML =
    '<div class="v20-sec">' +
      '<div class="v20-sec-hero">' +
        '<div class="v20-shield-big"><svg viewBox="0 0 24 24"><use href="#v20-shield"/></svg></div>' +
        '<div><b>' + v20Esc(v20T('sec_hero_good')) + '</b>' +
        '<span>' + v20Esc(v20T('sec_defs')) + '</span></div>' +
        '<button class="v20-btn" id="v20SecScan">' + v20Esc(v20T('sec_scan')) + '</button>' +
      '</div>' +
      '<div class="v20-cards">' +
        cards.map(function (c) {
          return '<div class="v20-card"><div class="v20-card-ic"><svg viewBox="0 0 24 24"><use href="#v20-shield"/></svg></div>' +
            '<div><b>' + v20Esc(v20T(c.key)) + '</b>' +
            '<em class="' + (c.on ? 'ok' : 'warn') + '">' + v20Esc(v20T(c.on ? 'sec_on' : 'sec_off')) + '</em></div></div>';
        }).join('') +
      '</div>' +
      '<div class="v20-sec">' + v20Esc(v20T('sec_history')) + '</div>' +
      '<div class="v20-hist">' +
        '<div class="v20-hist-item"><b>' + v20Esc(v20T('sec_threat1_t')) + '</b><span>' + v20Esc(v20T('sec_threat1_d')) + '</span></div>' +
        '<div class="v20-hist-item"><b>' + v20Esc(v20T('sec_threat2_t')) + '</b><span>' + v20Esc(v20T('sec_threat2_d')) + '</span></div>' +
      '</div>' +
    '</div>';
  var sc = $('#v20SecScan');
  if (sc) sc.addEventListener('click', function () { v20DoScan(body); });
}
function v20DoScan(body) {
  var host = body.querySelector('.v20-sec'); if (!host) return;
  var ov = document.createElement('div');
  ov.className = 'v20-sec-overlay';
  ov.innerHTML = '<div class="v20-spinner"></div><b>' + v20Esc(v20T('sec_scanning')) + '</b>' +
    '<div class="v20-prog"><i id="v20SecProg"></i></div><span id="v20SecPct" style="font-size:12px;opacity:.6">0%</span>';
  host.appendChild(ov);
  var t0 = Date.now(), dur = 2400;
  var timer = setInterval(function () {
    var p = Math.min(100, Math.round((Date.now() - t0) / dur * 100));
    var bar = ov.querySelector('#v20SecProg'); if (bar) bar.style.width = p + '%';
    var pt = ov.querySelector('#v20SecPct'); if (pt) pt.textContent = p + '%';
    if (p >= 100) {
      clearInterval(timer);
      setTimeout(function () {
        if (ov.parentNode) ov.remove();
        state.v20.security.lastScan = Date.now();
        v20Save();
        toast(v20T('toast_scan_done'));
      }, 320);
    }
  }, 90);
}

/* ============================================================
   3. OneDrive
   ============================================================ */
function v20RenderOneDrive(body) {
  var od = state.v20.od;
  var pct = Math.round(od.used / od.total * 100);
  var free = Math.max(0, od.total - od.used);
  var files = [
    { k: 'od_file1', sz: '2.4 MB', t: od.lastSync || Date.now() - 60000 },
    { k: 'od_file2', sz: '840 KB', t: Date.now() - 3600000 },
    { k: 'od_file3', sz: '12.1 MB', t: Date.now() - 86400000 },
    { k: 'od_file4', sz: '4 KB', t: Date.now() - 172800000 }
  ];
  var breakdown = [
    { label: '文件', v: Math.round(od.used * 0.55), c: '#7c5cff' },
    { label: '图片', v: Math.round(od.used * 0.22), c: '#0f6cbd' },
    { label: '其他', v: Math.max(1, od.used - Math.round(od.used * 0.55) - Math.round(od.used * 0.22)), c: '#c19c00' }
  ];
  var statusKey = od.paused ? 'od_paused' : 'od_up_to_date';
  body.innerHTML =
    '<div class="v20-od">' +
      '<div class="v20-od-hero">' +
        '<div class="v20-od-ic"><svg viewBox="0 0 24 24"><use href="#v20-cloud"/></svg></div>' +
        '<div><b>' + v20Esc(v20T('od_status')) + '</b><span>' + v20Esc(v20T(statusKey)) + '</span></div>' +
        '<button class="v20-btn sec" id="v20OdPause">' + v20Esc(v20T(od.paused ? 'od_resume' : 'od_pause')) + '</button>' +
        '<button class="v20-btn" id="v20OdFree">' + v20Esc(v20T('od_free')) + '</button>' +
      '</div>' +
      '<div class="v20-od-storage">' +
        '<div class="v20-od-ring" id="v20OdRing" style="--pct:' + pct + '"><b>' + pct + '%</b></div>' +
        '<div class="v20-od-stats">' +
          '<div class="v20-big">' + v20Esc(v20T('od_used_val', { u: od.used, t: od.total })) + '</div>' +
          '<span>' + v20Esc(v20T('od_quota', { f: free })) + '</span>' +
          '<div class="v20-od-bars">' +
            breakdown.map(function (b) {
              var w = Math.round(b.v / od.total * 100);
              return '<div class="v20-od-bar"><span>' + v20Esc(b.label) + '</span><i><em style="width:' + w + '%;background:' + b.c + '"></em></i><em>' + b.v + ' GB</em></div>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="v20-sec">' + v20Esc(v20T('od_recent')) + '</div>' +
      '<div class="v20-od-files">' +
        files.map(function (f) {
          return '<div class="v20-od-file"><svg viewBox="0 0 24 24"><use href="#v14-folder"/></svg>' +
            '<span>' + v20Esc(v20T(f.k)) + '</span><em>' + f.sz + ' · ' + v20Esc(v20FmtTime(f.t)) + '</em></div>';
        }).join('') +
      '</div>' +
    '</div>';
  var ps = $('#v20OdPause');
  if (ps) ps.addEventListener('click', function () { od.paused = !od.paused; v20Save(); v20RenderOneDrive(body); });
  var fr = $('#v20OdFree');
  if (fr) fr.addEventListener('click', function () {
    od.used = Math.max(12, od.used - 15);
    v20Save();
    v20RenderOneDrive(body);
  });
}

/* ============================================================
   4. 地图
   ============================================================ */
var V20_MAP_LOCS = [
  { k: 'maps_loc1', x: 52, y: 38 }, { k: 'maps_loc2', x: 68, y: 55 },
  { k: 'maps_loc3', x: 44, y: 70 }, { k: 'maps_loc4', x: 58, y: 62 },
  { k: 'maps_loc5', x: 40, y: 48 }
];
function v20RenderMaps(body) {
  var m = state.v20.maps;
  body.innerHTML =
    '<div class="v20-maps">' +
      '<div class="v20-maps-top">' +
        '<input class="v20-maps-search" id="v20MapsSearch" placeholder="' + v20Esc(v20T('maps_search_ph')) + '">' +
        '<button class="v20-btn" id="v20MapsGo">' + v20Esc(v20T('maps_search')) + '</button>' +
      '</div>' +
      '<div class="v20-maps-area" id="v20MapsArea">' +
        '<svg id="v20MapsSvg" viewBox="0 0 800 520" preserveAspectRatio="xMidYMid slice" style="transform:scale(' + m.zoom + ');transform-origin:center">' +
          '<rect width="800" height="520" fill="#e8f0e4"/>' +
          '<path d="M0 360 Q200 320 400 360 T800 340" fill="#bcd9f0" opacity=".7"/>' +
          '<path d="M120 120 Q260 100 380 180" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round"/>' +
          '<path d="M60 280 L740 300" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/>' +
          '<path d="M300 40 L340 500" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/>' +
          '<path d="M520 60 L560 480" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>' +
          '<path d="M0 200 L800 220" fill="none" stroke="#ffe6a8" stroke-width="6"/>' +
          '<circle cx="180" cy="140" r="42" fill="#c7e6b8" opacity=".7"/>' +
          '<circle cx="640" cy="400" r="55" fill="#c7e6b8" opacity=".7"/>' +
          '<rect x="420" y="120" width="90" height="70" rx="6" fill="#d8d8d8" opacity=".5"/>' +
        '</svg>' +
        '<div class="v20-maps-pin" id="v20MapsPin" style="left:' + m.pin.x + '%;top:' + m.pin.y + '%">' +
          '<svg viewBox="0 0 24 24" fill="var(--accent,#6b4de6)"><path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>' +
        '</div>' +
        '<div class="v20-maps-zoom">' +
          '<button id="v20MapsIn" title="' + v20Esc(v20T('maps_zoom_in')) + '">+</button>' +
          '<button id="v20MapsOut" title="' + v20Esc(v20T('maps_zoom_out')) + '">−</button>' +
        '</div>' +
        '<div class="v20-maps-fav"><b>' + v20Esc(v20T('maps_fav')) + '</b>' +
          V20_MAP_LOCS.map(function (l, i) { return '<button data-i="' + i + '">' + v20Esc(v20T(l.k)) + '</button>'; }).join('') +
        '</div>' +
        '<button class="v20-chip v20-maps-traffic' + (m.traffic ? ' on' : '') + '" id="v20MapsTraffic">' + v20Esc(v20T('maps_traffic')) + '</button>' +
      '</div>' +
    '</div>';
  var go = $('#v20MapsGo'), inp = $('#v20MapsSearch');
  function doSearch() {
    var v = (inp && inp.value || '').trim();
    if (!v) return;
    var hit = V20_MAP_LOCS.filter(function (l) { return v20T(l.k).indexOf(v) >= 0; })[0];
    if (hit) v20PinTo(hit.k, hit.x, hit.y);
    else v20PinTo(null, 20 + Math.random() * 60, 20 + Math.random() * 60);
    if (inp) inp.value = '';
  }
  if (go) go.addEventListener('click', doSearch);
  if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
  var fav = body.querySelector('.v20-maps-fav');
  if (fav) fav.addEventListener('click', function (e) {
    var b = e.target.closest('[data-i]'); if (!b) return;
    var l = V20_MAP_LOCS[+b.dataset.i]; if (l) v20PinTo(l.k, l.x, l.y);
  });
  var zin = $('#v20MapsIn'), zout = $('#v20MapsOut');
  if (zin) zin.addEventListener('click', function () { m.zoom = Math.min(2, +(m.zoom + 0.2).toFixed(2)); v20Save(); v20ApplyMapsZoom(); });
  if (zout) zout.addEventListener('click', function () { m.zoom = Math.max(0.6, +(m.zoom - 0.2).toFixed(2)); v20Save(); v20ApplyMapsZoom(); });
  var tr = $('#v20MapsTraffic');
  if (tr) tr.addEventListener('click', function () { m.traffic = !m.traffic; v20Save(); tr.classList.toggle('on', m.traffic); toast(v20T('maps_traffic_on')); });
}
function v20ApplyMapsZoom() {
  var svg = $('#v20MapsSvg'); if (svg) svg.style.transform = 'scale(' + state.v20.maps.zoom + ')';
}
function v20PinTo(labelKey, x, y) {
  var m = state.v20.maps;
  m.pin = { x: x, y: y, label: labelKey || 'maps_here' };
  v20Save();
  var pin = $('#v20MapsPin');
  if (pin) { pin.style.left = x + '%'; pin.style.top = y + '%'; }
}

/* ============================================================
   5. 录音机
   ============================================================ */
function v20FmtDur(ms) {
  var s = Math.floor(ms / 1000), m = Math.floor(s / 60); s = s % 60;
  return m + ':' + ('0' + s).slice(-2);
}
function v20RenderRecorder(body) {
  var rec = state.v20.recorder;
  var list = rec.recordings.slice().sort(function (a, b) { return b.ts - a.ts; });
  body.innerHTML =
    '<div class="v20-rec' + (V20.recTimer ? ' rec' : '') + '">' +
      '<div class="v20-rec-top">' +
        '<button class="v20-rec-btn' + (V20.recTimer ? ' rec' : '') + '" id="v20RecBtn" aria-label="rec">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="7"/></svg>' +
        '</button>' +
        '<div class="v20-rec-timer" id="v20RecTimer">' + v20Esc(v20FmtDur(V20.recTimer ? Date.now() - V20.recStart + V20.recElapsed : V20.recElapsed)) + '</div>' +
        '<div class="v20-rec-wave" id="v20RecWave"></div>' +
      '</div>' +
      '<div class="v20-sec">' + v20Esc(v20T('rec_list')) + ' · ' + list.length + '</div>' +
      '<div class="v20-rec-list">' +
        (list.length ? list.map(function (r) {
          return '<div class="v20-rec-item" data-id="' + r.id + '">' +
            '<button class="v20-rec-play" data-act="play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>' +
            '<div style="flex:1"><b>' + v20Esc(r.name) + '</b><em>' + v20Esc(r.dur) + ' · ' + v20Esc(v20FmtTime(r.ts)) + '</em></div>' +
          '</div>';
        }).join('') : '<div class="v20-empty">' + v20Esc(v20T('rec_empty')) + '</div>') +
      '</div>' +
    '</div>';
  var wave = $('#v20RecWave');
  if (wave && !wave.children.length) {
    var h = ''; for (var i = 0; i < 18; i++) h += '<i></i>'; wave.innerHTML = h;
  }
  var btn = $('#v20RecBtn');
  if (btn) btn.addEventListener('click', v20RecToggle);
  var lst = body.querySelector('.v20-rec-list');
  if (lst) lst.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    toast(v20T('rec_play'));
  });
  if (V20.recTimer) v20RecTick();
}
function v20RecTick() {
  var t = $('#v20RecTimer');
  if (t) t.textContent = v20FmtDur(Date.now() - V20.recStart + V20.recElapsed);
}
function v20RecToggle() {
  if (V20.recTimer) {
    clearInterval(V20.recTimer); V20.recTimer = 0;
    V20.recElapsed += Date.now() - V20.recStart;
    var dur = v20FmtDur(V20.recElapsed);
    var rec = state.v20.recorder;
    rec.recordings.push({ id: 'rc' + Date.now(), name: v20T('rec_name1') + ' ' + (rec.recordings.length + 1), dur: dur, ts: Date.now() });
    if (rec.recordings.length > 30) rec.recordings = rec.recordings.slice(-30);
    V20.recElapsed = 0;
    v20Save();
    v20RefreshRecorder();
  } else {
    V20.recStart = Date.now();
    V20.recTimer = setInterval(v20RecTick, 500);
    v20RefreshRecorder();
  }
}
function v20RefreshRecorder() {
  var w = document.querySelector('.app-window[data-type="recorder"]');
  if (w) v20RenderRecorder(w.querySelector('.win-body'));
}

/* ============================================================
   6. 附近共享
   ============================================================ */
var V20_NB_DEVICES = [
  { k: 'nb_dev1', sig: 3 }, { k: 'nb_dev2', sig: 4 }, { k: 'nb_dev3', sig: 2 }
];
function v20NearbyToggle(force) {
  var on = force === undefined ? !state.v20.nearby.on : !!force;
  state.v20.nearby.on = on;
  V20.nearbyOn = on;
  if (V20.nearbyScan) { clearTimeout(V20.nearbyScan); V20.nearbyScan = 0; }
  v20Save();
  v20TileState();
  if (on) { v20RenderNearby(); toast(v20T('toast_nearby_on')); }
  else toast(v20T('toast_nearby_off'));
  v20SyncDesk();
}
function v20RenderNearby() {
  var nb = state.v20.nearby;
  var vis = $('#v20NbVis'); if (vis) vis.textContent = v20T(nb.visibility === 'everyone' ? 'nb_everyone' : 'nb_my_devices');
  var scan = $('#v20NbScan'); if (scan) scan.hidden = false;
  var list = $('#v20NbList'); if (list) list.innerHTML = '';
  V20.nearbyScan = setTimeout(function () {
    var l = $('#v20NbList'); if (!l) return;
    var s2 = $('#v20NbScan'); if (s2) s2.hidden = true;
    l.innerHTML = V20_NB_DEVICES.map(function (d) {
      var sig = '';
      for (var i = 0; i < 4; i++) sig += '<i style="height:' + (3 + i * 3) + 'px;' + (i < d.sig ? '' : 'opacity:.2') + '"></i>';
      return '<button class="v20-nb-dev" data-dev="' + d.k + '">' +
        '<span class="v20-av"><svg viewBox="0 0 24 24"><use href="#v20-nearby"/></svg></span>' +
        '<span><b>' + v20Esc(v20T(d.k)) + '</b><span>' + v20Esc(v20T('nb_devices')) + '</span></span>' +
        '<span class="v20-sig">' + sig + '</span>' +
        '</button>';
    }).join('');
  }, 900);
}
function v20BindNearby() {
  var c = $('#v20NbClose');
  if (c) c.addEventListener('click', function () { v20NearbyToggle(false); });
  var list = $('#v20NbList');
  if (list) list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-dev]'); if (!b) return;
    var key = b.dataset.dev;
    var prog = document.createElement('div');
    prog.className = 'v20-nb-prog'; prog.innerHTML = '<i></i>';
    b.appendChild(prog);
    var bar = prog.querySelector('i');
    var t0 = Date.now(), dur = 1500;
    var timer = setInterval(function () {
      var p = Math.min(100, Math.round((Date.now() - t0) / dur * 100));
      if (bar) bar.style.width = p + '%';
      if (p >= 100) {
        clearInterval(timer);
        setTimeout(function () {
          if (prog.parentNode) prog.remove();
          toast(v20T('nb_sent', { d: v20T(key) }));
        }, 260);
      }
    }, 80);
  });
}

/* ============================================================
   7. 移动热点
   ============================================================ */
function v20HotspotToggle(force) {
  var on = force === undefined ? !state.v20.hs.on : !!force;
  state.v20.hs.on = on;
  V20.hsOn = on;
  v20Save();
  v20TileState();
  v20RenderHotspot();
  toast(v20T(on ? 'toast_hotspot_on' : 'toast_hotspot_off'));
  v20SyncDesk();
}
function v20RenderHotspot() {
  var hs = state.v20.hs;
  var st = $('#v20HsState'); if (st) st.textContent = v20T(hs.on ? 'hs_on' : 'hs_off');
  var body = $('#v20HsBody'); if (!body) return;
  var devs = hs.on ? [
    { k: 'hs_dev1', mac: '18:5E:0F:..' }, { k: 'hs_dev2', mac: 'AC:BC:32:..' }
  ] : [];
  body.innerHTML =
    '<div class="v20-hs-row"><span class="lab">' + v20Esc(v20T('hs_share')) + '</span>' +
      '<span class="v20-toggle' + (hs.on ? ' on' : '') + '" id="v20HsToggle"></span></div>' +
    '<div class="v20-hs-row"><span class="lab">' + v20Esc(v20T('hs_ssid')) + '</span><span class="val">DESKTOP-PC</span></div>' +
    '<div class="v20-hs-row"><span class="lab">' + v20Esc(v20T('hs_pass')) + '</span><span class="val">w11sim2024</span></div>' +
    '<div class="v20-hs-row"><span class="lab">' + v20Esc(v20T('hs_band')) + '</span>' +
      '<div class="v20-hs-chips">' +
        '<button data-band="5g" class="' + (hs.band === '5g' ? 'on' : '') + '">' + v20Esc(v20T('hs_band5')) + '</button>' +
        '<button data-band="2g" class="' + (hs.band === '2g' ? 'on' : '') + '">' + v20Esc(v20T('hs_band2')) + '</button>' +
      '</div></div>' +
    (hs.on ? '<div class="v20-sec" style="margin-top:4px">' + v20Esc(v20T('hs_devices')) + ' · ' + devs.length + '</div>' +
      '<div class="v20-hs-devs">' + devs.map(function (d) {
        return '<div class="v20-hs-dev"><span class="dot"></span><span>' + v20Esc(v20T(d.k)) + '</span><em>' + d.mac + '</em></div>';
      }).join('') + '</div>' : '');
  var tg = $('#v20HsToggle');
  if (tg) tg.addEventListener('click', function () { v20HotspotToggle(); });
  var chips = body.querySelector('.v20-hs-chips');
  if (chips) chips.addEventListener('click', function (e) {
    var b = e.target.closest('[data-band]'); if (!b) return;
    hs.band = b.dataset.band; v20Save(); v20RenderHotspot();
  });
}
function v20BindHotspot() {
  var c = $('#v20HsClose');
  if (c) c.addEventListener('click', function () { v20HotspotToggle(false); });
}

/* ============================================================
   快捷设置分发 + 快捷键
   ============================================================ */
function v20BindQuickSettings() {
  var grid = document.querySelector('.qp-grid');
  if (grid) grid.addEventListener('click', function (e) {
    var tile = e.target.closest('[data-v20]'); if (!tile) return;
    var a = tile.dataset.v20;
    if (a === 'nearby') v20NearbyToggle();
    else if (a === 'hotspot') v20HotspotToggle();
  });
}
function v20BindKeys() {
  document.addEventListener('keydown', function (e) {
    if (!v20OnDesk()) return;
    var tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;
    if (e.metaKey && !e.ctrlKey && !e.altKey) {
      var k = (e.key || '').toLowerCase();
      if (k === 'n') { e.preventDefault(); v20NearbyToggle(); }
    }
  });
}

/* ============================================================
   语言切换后刷新仍可见的动态面板与应用
   ============================================================ */
function v20OnLangChange() {
  v20RenderNearby();
  v20RenderHotspot();
  v20TileState();
  ['snip', 'security', 'onedrive', 'maps', 'recorder'].forEach(function (type) {
    var w = document.querySelector('.app-window[data-type="' + type + '"]');
    if (!w) return;
    var b = w.querySelector('.win-body');
    if (type === 'snip') v20RenderSnip(b);
    if (type === 'security') v20RenderSecurity(b);
    if (type === 'onedrive') v20RenderOneDrive(b);
    if (type === 'maps') v20RenderMaps(b);
    if (type === 'recorder') v20RenderRecorder(b);
  });
}

/* ============================================================
   初始化
   ============================================================ */
function v20Init() {
  v20Load();
  V20.nearbyOn = !!state.v20.nearby.on;
  V20.hsOn = !!state.v20.hs.on;
  v20BindNearby();
  v20BindHotspot();
  v20BindQuickSettings();
  v20BindKeys();
  v20RenderHotspot();
  v20TileState();
  v20SyncDesk();
  document.addEventListener('langchange', function () { setTimeout(v20OnLangChange, 40); });
}
v20Init();

window.__v20 = {
  nearby: function (on) { v20NearbyToggle(on); },
  hotspot: function (on) { v20HotspotToggle(on); },
  open: function (type) { window.__installer.openApp(type); },
  state: function () { return state.v20; }
};
