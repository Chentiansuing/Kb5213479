/* ============================================================
   v18.0 引擎：Windows 更新 / 便笺 / 实时字幕 / 放大镜
              小组件可配置 / 专注会话 / 投影多屏幕
   运行于主 IIFE 内（插入在 v17.js 之后、boot 之前）。
   ============================================================ */
var V18 = { capTimer: 0, capIdx: 0, magRAF: 0, magMx: 0, magMy: 0, projOpen: false,
  _updBusy: false, _updStage: '', _updPct: 0, _updAvailable: false };
state.v18 = state.v18 || {};

function v18T(k, ctx) { return _t(k, ctx); }
function v18Esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function v18Save() { try { localStorage.setItem('win11_v18', JSON.stringify(state.v18)); } catch (e) {} }
function v18Load() {
  try {
    var r = localStorage.getItem('win11_v18');
    if (r) { var o = JSON.parse(r) || {}; Object.keys(o).forEach(function (k) { state.v18[k] = o[k]; }); }
  } catch (e) {}
  var s = state.v18;
  s.upd = s.upd || { pendingRestart: false, build: '26100.1800', lastCheck: 0, history: [] };
  s.sticky = s.sticky || { notes: [] };
  if (!s.sticky.notes) s.sticky.notes = [];
  s.widgets = (s.widgets && s.widgets.length) ? s.widgets : ['weather', 'calendar', 'news', 'system'];
  s.cap = s.cap || { on: false, pos: 'bottom', size: 'm' };
  s.mag = s.mag || { on: false, zoom: 1 };
  s.focus = s.focus || { doneToday: 0, lastDate: '' };
  // 跨日重置专注计数
  var today = new Date().toDateString();
  if (s.focus.lastDate !== today) { s.focus.lastDate = today; s.focus.doneToday = 0; v18Save(); }
}

/* ============================================================
   包裹：新增应用类型 update / sticky / focus
   ============================================================ */
var _v18RenderContent = AppWindows._renderContent;
AppWindows._renderContent = function (win, type) {
  if (type === 'update') { v18RenderUpdate(win.querySelector('.win-body')); return; }
  if (type === 'sticky') { v18RenderStickyApp(win.querySelector('.win-body')); return; }
  if (type === 'focus') { v18RenderFocus(win.querySelector('.win-body')); return; }
  return _v18RenderContent.apply(this, arguments);
};
var _v18DefTitle = AppWindows._defaultTitle;
AppWindows._defaultTitle = function (type) {
  if (type === 'update') return v18T('app_update');
  if (type === 'sticky') return v18T('app_sticky');
  if (type === 'focus') return v18T('app_focus');
  return _v18DefTitle.apply(this, arguments);
};
var _v18DefIcon = AppWindows._defaultIcon;
AppWindows._defaultIcon = function (type) {
  if (type === 'update') return '<svg viewBox="0 0 24 24"><use href="#v18-update"/></svg>';
  if (type === 'sticky') return '<svg viewBox="0 0 24 24"><use href="#v18-sticky"/></svg>';
  if (type === 'focus') return '<svg viewBox="0 0 24 24"><use href="#v18-focus"/></svg>';
  return _v18DefIcon.apply(this, arguments);
};

/* ============================================================
   屏幕切换同步：离开桌面时隐藏 v18 浮层
   ============================================================ */
var _v18Go = go;
go = function (id) { var r = _v18Go.apply(this, arguments); v18SyncDesk(); return r; };

function v18OnDesk() {
  var d = $('#s-desktop');
  return !!(d && d.classList.contains('active'));
}
function v18SyncDesk() {
  var on = v18OnDesk();
  var cap = $('#v18Captions');
  if (cap) cap.hidden = !(on && state.v18.cap.on);
  var bar = $('#v18MagBar');
  if (bar) bar.hidden = !(on && state.v18.mag.on);
  var proj = $('#v18Project');
  if (proj) proj.hidden = !(on && V18.projOpen);
  var mon = $('#v18Monitor');
  if (mon) mon.hidden = !(on && (state.v18.projMode === 'ext' || state.v18.projMode === 'sec'));
  var banner = $('#v18UpdateBanner');
  if (banner) banner.hidden = !(on && state.v18.upd.pendingRestart);
  if (!on) v18MagClearTransform();
  else if (state.v18.mag.on) v18MagApply();
}

/* ============================================================
   1. Windows 更新
   ============================================================ */
function v18UpdNow() {
  var d = new Date();
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}
function v18RenderUpdate(body) {
  var u = state.v18.upd;
  var history = u.history.slice(0, 6);
  var histHTML = history.length ? history.map(function (h) {
    return '<div class="v18-upd-item"><span class="v18-ui-k">' + v18Esc(h.name) + '</span>' +
      '<span>' + v18Esc(h.kind) + '</span><span class="v18-ui-s ok">' + v18T('upd_installed') + ' · ' + v18Esc(h.date) + '</span></div>';
  }).join('') : '<div class="v18-upd-build" style="margin-top:0">' + v18T('upd_history_empty') + '</div>';

  var heroExtra = '';
  if (V18._updBusy) {
    heroExtra = '<div class="v18-upd-status" id="v18UpdStatus">' + v18T(V18._updStage) + '</div>' +
      '<div class="v18-prog"><i id="v18UpdProg" style="width:' + (V18._updPct || 0) + '%"></i></div>';
  } else if (u.pendingRestart) {
    heroExtra = '<div class="v18-upd-status">' + v18T('upd_pending') + '</div>' +
      '<button class="v18-btn" id="v18UpdRestart">' + v18T('upd_restart') + '</button>';
  } else if (V18._updAvailable) {
    heroExtra = '<div class="v18-upd-status">' + v18T('upd_available') + '</div>' +
      '<button class="v18-btn" id="v18UpdDownload">' + v18T('upd_download') + '</button>';
  } else {
    heroExtra = '<div class="v18-upd-status">' + v18T('upd_up_to_date') + '</div>';
  }

  body.innerHTML = '<div class="v18-upd">' +
    '<div class="v18-upd-hero">' +
      '<span class="v18-uh-ic"><svg viewBox="0 0 24 24"><use href="#v18-update"/></svg></span>' +
      '<div><b>' + v18T('upd_title') + '</b>' +
        '<span>' + (u.lastCheck ? v18T('upd_last_check', { t: u.lastCheck }) : v18T('upd_hint')) + '</span></div>' +
      '<div class="v18-uh-btn"><button class="v18-btn" id="v18UpdCheck">' + v18T('upd_check') + '</button></div>' +
    '</div>' +
    '<div id="v18UpdProgress">' + heroExtra + '</div>' +
    '<div class="v18-upd-list-title">' + v18T('upd_history') + '</div>' +
    '<div id="v18UpdHistory">' + histHTML + '</div>' +
    '<div class="v18-upd-build">' + v18T('upd_build', { b: u.build }) + '</div>' +
  '</div>';

  var checkBtn = $('#v18UpdCheck'); if (checkBtn) checkBtn.addEventListener('click', v18CheckUpdate);
  var dl = $('#v18UpdDownload'); if (dl) dl.addEventListener('click', v18DownloadInstall);
  var rs = $('#v18UpdRestart'); if (rs) rs.addEventListener('click', v18ApplyAndRestart);
}
function v18CheckUpdate() {
  if (V18._updBusy) return;
  V18._updBusy = true; V18._updStage = 'upd_checking'; V18._updPct = 0;
  v18RefreshUpdateBody();
  setTimeout(function () {
    V18._updBusy = false; V18._updAvailable = true;
    state.v18.upd.lastCheck = v18UpdNow(); v18Save();
    v18RefreshUpdateBody();
  }, 1400);
}
function v18DownloadInstall() {
  if (V18._updBusy) return;
  V18._updBusy = true; V18._updAvailable = false; V18._updStage = 'upd_downloading'; V18._updPct = 0;
  v18RefreshUpdateBody();
  var timer = setInterval(function () {
    V18._updPct += Math.random() * 14 + 6;
    if (V18._updPct >= 100) {
      V18._updPct = 100; V18._updStage = 'upd_installing'; V18._updPct = 0;
      v18RefreshUpdateBody();
      clearInterval(timer);
      var t2 = setInterval(function () {
        V18._updPct += Math.random() * 16 + 7;
        if (V18._updPct >= 100) {
          V18._updPct = 100; clearInterval(t2);
          V18._updBusy = false;
          state.v18.upd.pendingRestart = true; v18Save();
          v18PushNotif('upd_notif_title', 'upd_notif_body');
          v18SyncDesk();
          v18RefreshUpdateBody();
        } else v18RefreshUpdateBody();
      }, 420);
    } else v18RefreshUpdateBody();
  }, 320);
}
function v18RefreshUpdateBody() {
  var host = $('#v18UpdProgress');
  if (!host) return;
  if (V18._updBusy) {
    host.innerHTML = '<div class="v18-upd-status" id="v18UpdStatus">' +
      v18T(V18._updStage, { p: Math.floor(V18._updPct) }) + '</div>' +
      '<div class="v18-prog"><i style="width:' + Math.floor(V18._updPct) + '%"></i></div>';
  } else if (state.v18.upd.pendingRestart) {
    host.innerHTML = '<div class="v18-upd-status">' + v18T('upd_pending') + '</div>' +
      '<button class="v18-btn" id="v18UpdRestart">' + v18T('upd_restart') + '</button>';
    var rs = $('#v18UpdRestart'); if (rs) rs.addEventListener('click', v18ApplyAndRestart);
  } else if (V18._updAvailable) {
    host.innerHTML = '<div class="v18-upd-status">' + v18T('upd_available') + '</div>' +
      '<button class="v18-btn" id="v18UpdDownload">' + v18T('upd_download') + '</button>';
    var dl = $('#v18UpdDownload'); if (dl) dl.addEventListener('click', v18DownloadInstall);
  } else {
    host.innerHTML = '<div class="v18-upd-status">' + v18T('upd_up_to_date') + '</div>';
  }
}
function v18ApplyAndRestart() {
  var u = state.v18.upd;
  u.pendingRestart = false;
  u.history.unshift({ name: 'Windows 11 18.0 功能更新', kind: v18T('upd_feature'), date: new Date().toLocaleDateString() });
  u.history.unshift({ name: '2026-11 累积更新', kind: v18T('upd_quality'), date: new Date().toLocaleDateString() });
  var parts = u.build.split('.');
  parts[parts.length - 1] = String(parseInt(parts[parts.length - 1] || '0', 10) + 1);
  u.build = parts.join('.');
  v18Save();
  v18SyncDesk();
  toast(v18T('upd_installed'));
  if (typeof runPower === 'function') runPower('restart');
}

/* 桌面横幅按钮 */
function v18BindBanner() {
  var r = $('#v18UbRestart'); if (r) r.addEventListener('click', v18ApplyAndRestart);
  var s = $('#v18UbSnooze'); if (s) s.addEventListener('click', function () {
    var banner = $('#v18UpdateBanner'); if (banner) banner.hidden = true;
    toast(v18T('upd_snooze'));
  });
}

/* ============================================================
   2. 便笺
   ============================================================ */
var V18_STICKY_COLORS = ['yellow', 'green', 'blue', 'pink', 'purple'];
function v18StickyLayer() {
  var desk = $('#s-desktop'); if (!desk) return null;
  var layer = $('#v18StickyLayer');
  if (!layer) { layer = document.createElement('div'); layer.id = 'v18StickyLayer'; desk.appendChild(layer); }
  return layer;
}
function v18NewNote() {
  var notes = state.v18.sticky.notes;
  var id = 'n' + Date.now() + Math.floor(Math.random() * 1000);
  var note = { id: id, text: '', color: V18_STICKY_COLORS[notes.length % V18_STICKY_COLORS.length],
    x: 60 + (notes.length % 5) * 36, y: 60 + Math.floor(notes.length / 5) * 36 };
  notes.unshift(note); v18Save();
  v18RenderNotes(); v18RefreshStickyApp();
  return note;
}
function v18DeleteNote(id) {
  state.v18.sticky.notes = state.v18.sticky.notes.filter(function (n) { return n.id !== id; });
  v18Save(); v18RenderNotes(); v18RefreshStickyApp();
}
function v18UpdateNote(id, patch) {
  var n = state.v18.sticky.notes.find(function (x) { return x.id === id; });
  if (!n) return;
  Object.keys(patch).forEach(function (k) { n[k] = patch[k]; });
  v18Save();
}
function v18RenderNotes() {
  var layer = v18StickyLayer(); if (!layer) return;
  var notes = state.v18.sticky.notes;
  // 保留焦点顺序：已渲染过的保持 DOM 顺序；全部重建简单
  layer.innerHTML = '';
  notes.forEach(function (n) {
    var el = document.createElement('div');
    el.className = 'v18-note v18-note-c-' + n.color;
    el.dataset.id = n.id;
    el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
    var colorsHTML = V18_STICKY_COLORS.map(function (c) {
      return '<i data-color="' + c + '" style="background:' + v18ColorHex(c) + '" title="' + v18T('sticky_col_' + c) + '"></i>';
    }).join('');
    el.innerHTML =
      '<div class="v18-note-bar">' +
        '<button class="v18-nb-color" data-action="color" title="' + v18T('sticky_color') + '" aria-label="color"><svg viewBox="0 0 24 24" width="12" height="12"><use href="#v18-sticky"/></svg></button>' +
        '<span class="v18-nb-spacer"></span>' +
        '<button class="v18-nb-del" data-action="delete" title="' + v18T('sticky_delete') + '" aria-label="delete">✕</button>' +
      '</div>' +
      '<div class="v18-note-colors">' + colorsHTML + '</div>' +
      '<textarea placeholder="' + v18T('sticky_hint') + '">' + v18Esc(n.text) + '</textarea>';
    layer.appendChild(el);
    v18BindNote(el, n);
  });
}
function v18ColorHex(c) {
  return { yellow: '#fff4b8', green: '#c8f0c8', blue: '#b8dcff', pink: '#ffc8d8', purple: '#e0c8ff' }[c] || '#fff4b8';
}
function v18BindNote(el, n) {
  var ta = el.querySelector('textarea');
  ta.addEventListener('input', function () { v18UpdateNote(n.id, { text: ta.value }); v18RefreshStickyApp(); });
  el.querySelector('[data-action="delete"]').addEventListener('click', function (e) { e.stopPropagation(); v18DeleteNote(n.id); });
  var colorBtn = el.querySelector('[data-action="color"]');
  var palette = el.querySelector('.v18-note-colors');
  colorBtn.addEventListener('click', function (e) { e.stopPropagation(); palette.classList.toggle('open'); });
  palette.addEventListener('click', function (e) {
    var sw = e.target.closest('i[data-color]'); if (!sw) return;
    e.stopPropagation();
    var c = sw.dataset.color;
    v18UpdateNote(n.id, { color: c });
    el.className = 'v18-note v18-note-c-' + c;
    palette.classList.remove('open');
    v18RefreshStickyApp();
  });
  document.addEventListener('click', function () { palette.classList.remove('open'); });
  // 拖拽
  var bar = el.querySelector('.v18-note-bar');
  bar.addEventListener('mousedown', function (e) {
    if (e.target.closest('button')) return;
    e.preventDefault();
    var startX = e.clientX, startY = e.clientY, ox = n.x, oy = n.y, moved = false;
    var layer = v18StickyLayer(); if (layer) layer.appendChild(el); // 置顶
    function onMove(ev) {
      moved = true;
      var nx = ox + (ev.clientX - startX), ny = oy + (ev.clientY - startY);
      nx = Math.max(0, Math.min(window.innerWidth - 120, nx));
      ny = Math.max(0, Math.min(window.innerHeight - 120, ny));
      el.style.left = nx + 'px'; el.style.top = ny + 'px';
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (moved) { v18UpdateNote(n.id, { x: parseInt(el.style.left, 10), y: parseInt(el.style.top, 10) }); }
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
function v18RenderStickyApp(body) {
  var notes = state.v18.sticky.notes;
  var cards = notes.length ? notes.map(function (n) {
    var prev = (n.text || '').slice(0, 60).replace(/\n/g, ' ');
    return '<div class="v18-sa-card v18-note-c-' + n.color + '" data-focus="' + n.id + '">' +
      (prev ? v18Esc(prev) : '<span class="v18-sa-empty">' + v18T('sticky_new') + '…</span>') + '</div>';
  }).join('') : '<div class="v18-sa-empty-state">' + v18T('sticky_empty') + '</div>';
  body.innerHTML = '<div class="v18-sticky-app">' +
    '<div class="v18-sa-head"><b>' + v18T('sticky_title') + '</b>' +
      '<button class="v18-btn" id="v18SaNew">' + v18T('sticky_new') + '</button></div>' +
    '<div class="v18-sa-grid" id="v18SaGrid">' + cards + '</div></div>';
  $('#v18SaNew').addEventListener('click', v18NewNote);
  var grid = $('#v18SaGrid');
  if (grid) grid.addEventListener('click', function (e) {
    var card = e.target.closest('[data-focus]'); if (!card) return;
    var layer = v18StickyLayer(); if (!layer) return;
    var el = layer.querySelector('.v18-note[data-id="' + card.dataset.focus + '"]');
    if (el) { layer.appendChild(el); el.querySelector('textarea').focus(); }
  });
}
function v18RefreshStickyApp() {
  var body = document.querySelector('.v18-sticky-app');
  if (!body) return;
  var win = body.closest('.win');
  var wb = win ? win.querySelector('.win-body') : null;
  if (wb) v18RenderStickyApp(wb);
}

/* ============================================================
   3. 实时字幕
   ============================================================ */
var V18_CAP_LINES = ['cap_line1', 'cap_line2', 'cap_line3', 'cap_line4', 'cap_line5', 'cap_line6'];
function v18CapApply() {
  var cap = $('#v18Captions'); if (!cap) return;
  cap.classList.toggle('v18-cap-top', state.v18.cap.pos === 'top');
  cap.classList.toggle('v18-cap-bottom', state.v18.cap.pos !== 'top');
  cap.setAttribute('data-size', state.v18.cap.size);
  $$('#v18CapMenu [data-cap-pos]').forEach(function (b) { b.classList.toggle('on', b.dataset.capPos === state.v18.cap.pos); });
  $$('#v18CapMenu [data-cap-size]').forEach(function (b) { b.classList.toggle('on', b.dataset.capSize === state.v18.cap.size); });
  var tile = document.querySelector('.qp-tile[data-v18="captions"]');
  if (tile) tile.classList.toggle('on', !!state.v18.cap.on);
}
function v18CapTick() {
  var text = $('#v18CapText'); if (!text) return;
  var key = V18_CAP_LINES[V18.capIdx % V18_CAP_LINES.length];
  V18.capIdx++;
  var full = v18T(key), i = 0;
  text.textContent = '';
  var t = setInterval(function () {
    if (!document.body.contains(text)) { clearInterval(t); return; }
    i += 2; text.textContent = full.slice(0, i);
    if (i >= full.length) clearInterval(t);
  }, 18);
}
function v18CapToggle(force) {
  var on = force === undefined ? !state.v18.cap.on : !!force;
  state.v18.cap.on = on; v18Save();
  if (on) { V18.capIdx = 0; v18CapTick(); V18.capTimer = setInterval(v18CapTick, 3600); }
  else { if (V18.capTimer) { clearInterval(V18.capTimer); V18.capTimer = 0; } var t = $('#v18CapText'); if (t) t.textContent = ''; }
  v18CapApply(); v18SyncDesk();
}
function v18BindCaptions() {
  var set = $('#v18CapSet'); if (set) set.addEventListener('click', function () { var m = $('#v18CapMenu'); if (m) m.hidden = !m.hidden; });
  var menu = $('#v18CapMenu');
  if (menu) menu.addEventListener('click', function (e) {
    var bp = e.target.closest('[data-cap-pos]'), bs = e.target.closest('[data-cap-size]');
    if (bp) { state.v18.cap.pos = bp.dataset.capPos; v18Save(); v18CapApply(); }
    if (bs) { state.v18.cap.size = bs.dataset.capSize; v18Save(); v18CapApply(); }
  });
}

/* ============================================================
   4. 放大镜
   ============================================================ */
function v18MagApply() {
  var desk = $('#s-desktop'); if (!desk) return;
  var z = state.v18.mag.zoom;
  if (z <= 1) { desk.style.transform = ''; return; }
  var mx = V18.magMx, my = V18.magMy;
  if (!mx && !my) { mx = window.innerWidth / 2; my = window.innerHeight / 2; }
  desk.style.transformOrigin = '0 0';
  desk.style.transform = 'translate(' + (mx * (1 - z)) + 'px,' + (my * (1 - z)) + 'px) scale(' + z + ')';
  var v = $('#v18MagVal'); if (v) v.textContent = Math.round(z * 100) + '%';
}
function v18MagClearTransform() { var desk = $('#s-desktop'); if (desk) desk.style.transform = ''; }
function v18MagToggle(force) {
  var on = force === undefined ? !state.v18.mag.on : !!force;
  state.v18.mag.on = on; v18Save();
  if (on) { v18MagApply(); v18MagStartMove(); }
  else { v18MagClearTransform(); v18MagStopMove(); }
  var tile = document.querySelector('.qp-tile[data-v18="magnifier"]');
  if (tile) tile.classList.toggle('on', !!on);
  v18SyncDesk();
}
function v18MagStartMove() {
  v18MagStopMove();
  document.addEventListener('mousemove', v18MagOnMove, true);
}
function v18MagStopMove() { document.removeEventListener('mousemove', v18MagOnMove, true); }
function v18MagOnMove(e) {
  V18.magMx = e.clientX; V18.magMy = e.clientY;
  if (!V18.magRAF) V18.magRAF = requestAnimationFrame(function () { V18.magRAF = 0; v18MagApply(); });
}
function v18MagZoom(delta) {
  var z = Math.max(1, Math.min(4, +(state.v18.mag.zoom + delta).toFixed(2)));
  state.v18.mag.zoom = z; v18Save(); v18MagApply();
}
function v18BindMag() {
  var i = $('#v18MagIn'); if (i) i.addEventListener('click', function () { v18MagZoom(0.25); });
  var o = $('#v18MagOut'); if (o) o.addEventListener('click', function () { v18MagZoom(-0.25); });
  var c = $('#v18MagClose'); if (c) c.addEventListener('click', function () { v18MagToggle(false); });
}

/* ============================================================
   5. 小组件可配置
   ============================================================ */
var V18_WG_TYPES = ['weather', 'calendar', 'news', 'system', 'photos', 'mail', 'todo', 'clock'];
function v18WgCard(type) {
  if (type === 'weather') return '<div class="wg-card wg-weather" data-wg="weather">' +
    '<div class="wg-top"><span class="wg-label" data-i18n="wg_weather">天气</span><span class="wg-loc">北京</span></div>' +
    '<div class="wg-weather-main"><div class="wg-temp">22°</div><div class="wg-cond">晴</div></div>' +
    '<div class="wg-forecast"><div><b>今天</b><span>22°</span></div><div><b>周二</b><span>20°</span></div><div><b>周三</b><span>24°</span></div><div><b>周四</b><span>19°</span></div></div></div>';
  if (type === 'calendar') return '<div class="wg-card wg-cal" data-wg="calendar">' +
    '<div class="wg-top"><span class="wg-label" data-i18n="wg_calendar">日历</span></div>' +
    '<div class="wg-cal-big" id="wgCalBig">15</div><div class="wg-cal-date" id="wgCalDate">星期日</div>' +
    '<div class="wg-cal-grid" id="wgCalGrid"></div></div>';
  if (type === 'news') return '<div class="wg-card wg-news" data-wg="news">' +
    '<div class="wg-top"><span class="wg-label" data-i18n="wg_news">资讯</span></div>' +
    '<div class="wg-news-item"><b>科技巨头发布新一代 AI 芯片</b><span>2 小时前</span></div>' +
    '<div class="wg-news-item"><b>全球气候峰会达成新协议</b><span>4 小时前</span></div>' +
    '<div class="wg-news-item"><b>新款操作系统开始推送</b><span>今天</span></div></div>';
  if (type === 'system') return '<div class="wg-card wg-sys" data-wg="system">' +
    '<div class="wg-top"><span class="wg-label" data-i18n="wg_system">系统</span></div>' +
    '<div class="wg-meter"><span>存储</span><div class="wg-meter-bar"><i style="width:58%"></i></div><b>58%</b></div>' +
    '<div class="wg-meter"><span>内存</span><div class="wg-meter-bar"><i style="width:42%"></i></div><b>42%</b></div>' +
    '<div class="wg-meter"><span>电池</span><div class="wg-meter-bar"><i style="width:76%"></i></div><b>76%</b></div></div>';
  if (type === 'photos') return '<div class="wg-card wg-photos" data-wg="photos">' +
    '<div class="wg-top"><span class="wg-label" data-i18n="wg_photos_cap">收藏</span></div>' +
    '<div class="wg-ph-grid"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>';
  if (type === 'mail') return '<div class="wg-card wg-mail" data-wg="mail">' +
    '<div class="wg-top"><span class="wg-label">' + v18T('wg_mail_cap', { n: 3 }) + '</span></div>' +
    '<div class="wg-mail-list">' +
      '<div class="wg-mail-row"><i></i><div><b>张小明</b><span>项目进度同步…</span></div></div>' +
      '<div class="wg-mail-row"><i></i><div><b>李华</b><span>会议邀请</span></div></div>' +
      '<div class="wg-mail-row"><i></i><div><b>王芳</b><span>周报已提交</span></div></div>' +
    '</div></div>';
  if (type === 'todo') return '<div class="wg-card wg-todo" data-wg="todo">' +
    '<div class="wg-top"><span class="wg-label">' + v18T('wg_todo_cap', { n: 3 }) + '</span></div>' +
    '<div class="wg-todo-list">' +
      '<div class="wg-todo-row done"><i></i><span>完成设计稿</span></div>' +
      '<div class="wg-todo-row done"><i></i><span>回复邮件</span></div>' +
      '<div class="wg-todo-row"><i></i><span>准备演示</span></div>' +
    '</div></div>';
  if (type === 'clock') return '<div class="wg-card wg-clock" data-wg="clock">' +
    '<div class="wg-top"><span class="wg-label" data-i18n="wg_clock_cap">世界时钟</span></div>' +
    '<div class="wg-clock-face"></div><div class="wg-clock-tz">伦敦 · 伦敦时间</div></div>';
  return '';
}
function v18WgExistingSel(type) {
  return { weather: '.wg-weather', calendar: '.wg-cal', news: '.wg-news', system: '.wg-sys' }[type];
}
function v18SyncWidgets() {
  var grid = $('#widgetsPanel .wg-grid'); if (!grid) return;
  var enabled = state.v18.widgets;
  // 清除旧卡片（v18 统一重建，避免遗留静态卡重复或失控）
  Array.prototype.slice.call(grid.querySelectorAll('.wg-card')).forEach(function (c) { c.remove(); });
  // 按顺序重建已启用的卡片
  enabled.forEach(function (t) {
    var wrap = document.createElement('div');
    wrap.innerHTML = v18WgCard(t);
    var card = wrap.firstChild;
    grid.appendChild(card);
    v18WgInjectCtl(card, t);
  });
  // 添加行（去重）
  var addRow = grid.querySelector('.wg-add-row');
  if (!addRow) {
    addRow = document.createElement('div'); addRow.className = 'wg-add-row';
    addRow.innerHTML = '<button class="wg-add-btn" id="v18WgAdd"><svg viewBox="0 0 24 24" width="14" height="14"><use href="#v18-add"/></svg><span data-i18n="wg_add">添加小组件</span></button>';
    grid.appendChild(addRow);
    addRow.querySelector('button').addEventListener('click', v18OpenWgPicker);
  }
  if (typeof _apply === 'function') _apply();
  if (typeof renderWidgetsCalendar === 'function') renderWidgetsCalendar();
}
function v18WgInjectCtl(card, type) {
  var old = card.querySelector('.wg-ctl'); if (old) old.remove();
  var ctl = document.createElement('div'); ctl.className = 'wg-ctl';
  ctl.innerHTML =
    '<button data-wg-act="up" title="' + v18T('wg_up') + '"><svg viewBox="0 0 24 24"><use href="#v18-chevron-up"/></svg></button>' +
    '<button data-wg-act="down" title="' + v18T('wg_down') + '"><svg viewBox="0 0 24 24"><use href="#v18-chevron-down"/></svg></button>' +
    '<button class="wg-rm" data-wg-act="rm" title="' + v18T('wg_remove') + '"><svg viewBox="0 0 24 24"><use href="#v18-close"/></svg></button>';
  card.appendChild(ctl);
  ctl.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-wg-act]'); if (!b) return;
    e.stopPropagation();
    var list = state.v18.widgets, idx = list.indexOf(type);
    if (idx < 0) return;
    if (b.dataset.wgAct === 'up' && idx > 0) { var t = list[idx]; list[idx] = list[idx - 1]; list[idx - 1] = t; }
    if (b.dataset.wgAct === 'down' && idx < list.length - 1) { var t2 = list[idx]; list[idx] = list[idx + 1]; list[idx + 1] = t2; }
    if (b.dataset.wgAct === 'rm') { list.splice(idx, 1); }
    v18Save(); v18SyncWidgets();
  });
}
function v18OpenWgPicker() {
  var picker = $('#v18WgPicker'); if (!picker) return;
  var grid = $('#v18WgpGrid');
  grid.innerHTML = V18_WG_TYPES.map(function (t) {
    var on = state.v18.widgets.indexOf(t) >= 0;
    return '<div class="v18-wgp-item' + (on ? ' on' : '') + '" data-wg-t="' + t + '">' +
      '<svg viewBox="0 0 24 24"><use href="#v18-' + (t === 'photos' ? 'photos' : t === 'mail' ? 'mail' : t === 'todo' ? 'todo' : t === 'clock' ? 'clock2' : 'add') + '"/></svg>' +
      '<span data-i18n="wg_t_' + t + '">' + v18T('wg_t_' + t) + '</span>' +
      (on ? '<svg class="v18-wgp-check" viewBox="0 0 24 24"><use href="#v18-check"/></svg>' : '') +
      '</div>';
  }).join('');
  if (typeof _apply === 'function') _apply();
  picker.hidden = false;
}
function v18BindWgPicker() {
  var grid = $('#v18WgpGrid');
  if (grid) grid.addEventListener('click', function (e) {
    var item = e.target.closest('[data-wg-t]'); if (!item) return;
    var t = item.dataset.wgT, list = state.v18.widgets, idx = list.indexOf(t);
    if (idx >= 0) list.splice(idx, 1); else list.push(t);
    v18Save(); v18OpenWgPicker(); v18SyncWidgets();
  });
  var close = $('#v18WgpClose'); if (close) close.addEventListener('click', function () { $('#v18WgPicker').hidden = true; });
  var done = $('#v18WgpDone'); if (done) done.addEventListener('click', function () { $('#v18WgPicker').hidden = true; });
}

/* ============================================================
   6. 专注会话
   ============================================================ */
var V18Focus = { timer: 0, total: 1800, remain: 1800, running: false, preset: 30 };
function v18Fmt(sec) {
  var m = Math.floor(sec / 60), s = sec % 60;
  return ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2);
}
function v18RenderFocus(body) {
  body.innerHTML = '<div class="v18-focus-app">' +
    '<div class="v18-focus-ring">' +
      '<svg viewBox="0 0 200 200"><circle class="v18-fr-bg" cx="100" cy="100" r="90"/>' +
      '<circle class="v18-fr-fg" id="v18Fg" cx="100" cy="100" r="90" stroke-dasharray="565.48" stroke-dashoffset="0"/></svg>' +
      '<div class="v18-focus-time"><b id="v18FTime">' + v18Fmt(V18Focus.remain) + '</b><span id="v18FState">' + (V18Focus.running ? v18T('focus_running') : '') + '</span></div>' +
    '</div>' +
    '<div class="v18-focus-presets" id="v18FPresets">' +
      [15, 30, 60].map(function (m) {
        return '<button data-preset="' + m + '" class="' + (V18Focus.preset === m ? 'on' : '') + '">' + v18T('focus_min', { m: m }) + '</button>';
      }).join('') + '</div>' +
    '<div class="v18-focus-actions">' +
      '<button class="v18-btn" id="v18FStart">' + v18T('focus_start') + '</button>' +
      '<button class="v18-btn sec" id="v18FReset">' + v18T('focus_reset') + '</button>' +
    '</div>' +
    '<div class="v18-focus-stats" id="v18FStats">' + v18T('focus_sessions', { n: state.v18.focus.doneToday }) + '</div>' +
  '</div>';
  $('#v18FPresets').addEventListener('click', function (e) {
    var b = e.target.closest('[data-preset]'); if (!b || V18Focus.running) return;
    V18Focus.preset = +b.dataset.preset; V18Focus.total = V18Focus.preset * 60; V18Focus.remain = V18Focus.total;
    v18RefreshFocus();
  });
  $('#v18FStart').addEventListener('click', v18FocusToggle);
  $('#v18FReset').addEventListener('click', v18FocusReset);
  v18RefreshFocus();
}
function v18RefreshFocus() {
  var app = document.querySelector('.v18-focus-app'); if (!app) return;
  var t = $('#v18FTime'), st = $('#v18FState'), fg = $('#v18Fg');
  if (t) t.textContent = v18Fmt(V18Focus.remain);
  if (st) st.textContent = V18Focus.running ? v18T('focus_running') : (V18Focus.remain === V18Focus.total ? '' : v18T('focus_pause'));
  if (fg) { var C = 565.48; fg.style.strokeDashoffset = C * (1 - V18Focus.remain / V18Focus.total); }
  var start = $('#v18FStart'); if (start) start.textContent = V18Focus.running ? v18T('focus_pause') : (V18Focus.remain < V18Focus.total ? v18T('focus_resume') : v18T('focus_start'));
  var stats = $('#v18FStats'); if (stats) stats.textContent = v18T('focus_sessions', { n: state.v18.focus.doneToday });
}
function v18FocusToggle() {
  if (V18Focus.running) { V18Focus.running = false; v18FocusClearDnd(); clearInterval(V18Focus.timer); v18RefreshFocus(); return; }
  V18Focus.running = true;
  v18FocusSetDnd();
  V18Focus.timer = setInterval(function () {
    V18Focus.remain--;
    if (V18Focus.remain <= 0) {
      V18Focus.remain = 0; clearInterval(V18Focus.timer); V18Focus.running = false;
      v18FocusClearDnd();
      state.v18.focus.doneToday = (state.v18.focus.doneToday || 0) + 1; v18Save();
      v18FocusCelebrate();
    }
    v18RefreshFocus();
  }, 1000);
  v18RefreshFocus();
}
function v18FocusReset() {
  V18Focus.running = false; clearInterval(V18Focus.timer); v18FocusClearDnd();
  V18Focus.total = V18Focus.preset * 60; V18Focus.remain = V18Focus.total;
  v18RefreshFocus();
}
function v18FocusSetDnd() {
  if (state.v15) { state.v15.focusUntil = Date.now() + V18Focus.total * 1000; if (typeof v15SyncFocus === 'function') v15SyncFocus(); }
}
function v18FocusClearDnd() {
  if (state.v15) { state.v15.focusUntil = 0; if (typeof v15SyncFocus === 'function') v15SyncFocus(); }
}
function v18FocusCelebrate() {
  var app = document.querySelector('.v18-focus-app');
  if (!app) { toast(v18T('focus_complete')); return; }
  var box = document.createElement('div'); box.className = 'v18-focus-celebrate';
  box.innerHTML = '<div class="v18-fc-emoji">🎉</div><div>' + v18T('focus_complete') + '</div>';
  app.appendChild(box);
  toast(v18T('focus_complete'));
  setTimeout(function () { if (box.parentNode) box.remove(); }, 2600);
}

/* ============================================================
   7. 投影（Win+P 风格）
   ============================================================ */
function v18ProjOpen() {
  V18.projOpen = true; v18SyncDesk(); v18ProjRender();
}
function v18ProjClose() {
  V18.projOpen = false; var p = $('#v18Project'); if (p) p.hidden = true;
}
function v18ProjRender() {
  $$('#v18Project [data-proj]').forEach(function (b) { b.classList.toggle('on', b.dataset.proj === state.v18.projMode); });
  var st = $('#v18ProjStatus'); if (st) {
    st.textContent = state.v18.projMode === 'pc' ? v18T('proj_none') :
      (state.v18.projMode === 'ext' ? v18T('proj_extended') : v18T('proj_preview'));
  }
  v18SyncDesk();
}
function v18ProjSet(mode) {
  state.v18.projMode = mode; v18Save();
  v18ProjRender();
  if (mode === 'ext' || mode === 'sec') v18RenderMonitor();
}
function v18RenderMonitor() {
  var screen = $('#v18MonScreen'); if (!screen) return;
  var now = new Date();
  var hh = ('0' + now.getHours()).slice(-2), mm = ('0' + now.getMinutes()).slice(-2);
  screen.innerHTML =
    '<div class="v18-mon-clock">' + hh + ':' + mm + '</div>' +
    '<div class="v18-mon-apps">' +
      '<span>' + v18T('app_update') + '</span>' +
      '<span>' + v18T('app_focus') + '</span>' +
      '<span>' + v18T('app_sticky') + '</span>' +
    '</div>' +
    '<div class="v18-mon-taskbar"><i></i><i></i><i></i></div>';
  if (typeof _apply === 'function') _apply();
}
function v18BindProject() {
  var list = $('#v18Project .v18-proj-list');
  if (list) list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-proj]'); if (!b) return;
    v18ProjSet(b.dataset.proj);
  });
  var c = $('#v18ProjClose'); if (c) c.addEventListener('click', v18ProjClose);
  // 第二屏幕拖拽
  var drag = $('#v18MonDrag'), mon = $('#v18Monitor');
  if (drag && mon) {
    drag.addEventListener('mousedown', function (e) {
      if (e.target.closest('button')) return;
      e.preventDefault();
      var rect = mon.getBoundingClientRect();
      var sx = e.clientX, sy = e.clientY, ox = rect.left, oy = rect.top, moved = false;
      function mv(ev) { moved = true; mon.style.right = 'auto'; mon.style.left = (ox + ev.clientX - sx) + 'px'; mon.style.top = (oy + ev.clientY - sy) + 'px'; }
      function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
  }
  var mc = $('#v18MonClose'); if (mc) mc.addEventListener('click', function () {
    state.v18.projMode = 'pc'; v18Save(); v18ProjRender();
  });
  // 托盘投影图标 / 快捷设置 tile 由 v18BindQuickSettings 处理
}

/* ============================================================
   快捷设置 v18 磁贴分发 + 全局绑定
   ============================================================ */
function v18BindQuickSettings() {
  var grid = document.querySelector('.qp-grid');
  if (grid) {
    grid.addEventListener('click', function (e) {
      var tile = e.target.closest('[data-v18]'); if (!tile) return;
      var a = tile.dataset.v18;
      if (a === 'captions') v18CapToggle();
      else if (a === 'magnifier') v18MagToggle();
      else if (a === 'project') v18ProjOpen();
    });
  }
  // 托盘「投影到这台电脑」图标 → 打开投影面板
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tray="project"]'); if (!t) return;
    e.stopPropagation(); v18ProjOpen();
  }, true);
}

/* 通知中心：v18 新功能通知置顶 */
function v18PushNotif(titleKey, bodyKey) {
  var body = $('#notifCenter .nc-body'); if (!body) return;
  var n = document.createElement('div'); n.className = 'nc-notif';
  n.innerHTML = '<div class="nc-n-head"><b data-i18n="' + titleKey + '">' + v18T(titleKey) + '</b><button class="nc-n-close">✕</button></div>' +
    '<span data-i18n="' + bodyKey + '">' + v18T(bodyKey) + '</span>';
  body.insertBefore(n, body.firstChild);
  if (typeof v15SyncNcEmpty === 'function') v15SyncNcEmpty();
}
function v18SeedNotif() {
  var body = $('#notifCenter .nc-body'); if (!body) return;
  // 若已有 v18 通知则不重复
  if (body.querySelector('[data-i18n="notif_v18_title"]')) return;
  v18PushNotif('notif_v18_title', 'notif_v18_body');
}

/* ============================================================
   初始化
   ============================================================ */
function v18Init() {
  v18Load();
  v18BindBanner();
  v18BindCaptions();
  v18BindMag();
  v18BindProject();
  v18BindQuickSettings();
  v18BindWgPicker();
  v18RenderNotes();
  v18SyncWidgets();
  v18CapApply();
  v18ProjRender();
  v18SeedNotif();
  v18SyncDesk();
  // 语言切换时重建小组件/便签/投影
  document.addEventListener('click', function (e) {
    var lb = e.target.closest('.lang-btn'); if (!lb) return;
    setTimeout(function () { v18SyncWidgets(); v18RenderMonitor(); v18RefreshFocus(); v18RefreshStickyApp(); v18CapApply(); v18ProjRender(); }, 60);
  }, true);
}
v18Init();

window.__v18 = {
  update: v18ApplyAndRestart,
  captions: function (on) { v18CapToggle(on); },
  magnifier: function (on) { v18MagToggle(on); },
  project: v18ProjOpen,
  widgets: v18SyncWidgets,
  newNote: v18NewNote
};
