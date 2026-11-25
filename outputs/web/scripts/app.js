(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ===== i18n 辅助 ===== */
  function _t(k, ctx) {
    if (window.__i18n && typeof window.__i18n.t === 'function') {
      return window.__i18n.t(k, ctx);
    }
    return k;
  }
  function _apply() {
    if (window.__i18n && typeof window.__i18n.apply === 'function') {
      window.__i18n.apply();
    }
  }

  var state = {
    disk: [], selected: null, edition: '', account: 'personal',
    userName: 'Administrator', deviceName: 'DESKTOP-7F3K9Q', installStart: 0,
    quickTiles: { wifi: true, bt: true, airplane: false, night: false, focus: false },
    theme: { mode: 'light', accent: '#0067c0', wall: 1 },
    volume: 62, brightness: 80,
    notes: '', npFile: '', folderSeq: 0, photoIndex: 1, storeInstalled: {},
    tempFiles: {}, tempDir: '', tempApi: false,
    update: { phase: 'idle', pct: 0, installed: false, available: true, checked: false, last: '', paused: 0 },
    recovery: { phase: 'idle', pct: 0, mode: '' },
    verTab: 'editions',
    openWindows: {}, // id -> win element
    winZCounter: 1000,
    // v6.0：虚拟桌面、资源管理器增强、新应用与 Edge 数据
    desktops: [{ id: 1, name: '' }], currentDesk: 1, deskSeq: 1,
    expFolders: {}, expView: 'icons', expSort: 'name', tempDeleted: {},
    paint: { color: '#1b2430', size: 6, tool: 'brush' },
    player: { index: 0, playing: false, pct: 0 },
    bookmarks: [
      { title: 'Microsoft', url: 'https://www.microsoft.com/windows/windows-11' },
      { title: 'Bing', url: 'https://www.bing.com' },
      { title: 'GitHub', url: 'https://github.com' }
    ],
    downloads: [{ name: 'Windows11.iso', done: true }],
    // v8.0：安装速度档位、辅助功能、深色模式、实时日志
    v8: {
      speed: 'standard',
      access: { narrator: false, magnifier: false, contrast: false, bigtext: false },
      encrypt: true,
      dark: false,
      log: [], logSeq: 0, logPaused: false,
      instStartAt: 0, instEndAt: 0
    },
    // v9.0：无人值守、安装源、清理、人脸、音效等
    v9: {
      source: '',
      unattend: { on: false, edition: true, key: true, partition: true, oobe: true },
      unattendRunning: false, unattendPaused: false, unattendStep: '',
      faceDone: false, m2Done: false,
      sound: false,
      bootMenuUsed: false, firstBoot: true,
      bloat: { 1: true, 2: true, 3: false, 4: true, 5: false },
      cleaned: 0
    }
  };

  var timers = [];
  var toastTimer = 0;
  var modalOpen = false;
  var okHandler = null;
  var screens = $$('.screen');

  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers() {
    timers.forEach(clearTimeout); timers = [];
    try { if (state._raf) cancelAnimationFrame(state._raf); } catch(e){}
    if (state._clockTimer) { clearInterval(state._clockTimer); state._clockTimer = 0; }
  }
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }
  function go(id) {
    if (!document.getElementById('s-' + id)) return;
    clearTimers();
    screens.forEach(function (s) { s.classList.toggle('active', s.id === 's-' + id); });
    // 安装界面的 Shift+F10 使用独立窗口层；回到桌面后移回桌面层，保持开始菜单在最上方。
    var targetLayer = id === 'desktop' ? $('#winLayer') : $('#setupWinLayer');
    if (targetLayer) {
      Object.values(state.openWindows).forEach(function (w) {
        if (w.parentElement !== targetLayer) targetLayer.appendChild(w);
      });
    }
    try { history.replaceState(null, '', '#' + id); } catch (e) { }
    closeStart(); closeNotif();
    updateVersionBadge(id);
    _apply();
    var h = hooks[id];
    if (h) h();
  }
  function closeStart() { var sm = $('#startMenu'); if (sm) sm.classList.remove('open'); }
  function closeNotif() { var nc = $('#notifCenter'); if (nc) nc.classList.remove('open'); }

  function openModal(opt) {
    $('#mTitle').textContent = opt.title || '';
    $('#mBody').innerHTML = opt.body || '';
    var ok = $('#mOk'), cancel = $('#mCancel');
    ok.textContent = opt.ok || _t('modal_default_ok');
    if (opt.cancel === null) { cancel.style.display = 'none'; }
    else { cancel.style.display = ''; cancel.textContent = opt.cancel || _t('modal_default_cancel'); }
    okHandler = opt.onOk || null;
    modalOpen = true;
    $('#modal').classList.add('open');
    if (opt.after) opt.after();
  }
  function closeModal() { modalOpen = false; okHandler = null; $('#modal').classList.remove('open'); }

  function updateVersionBadge() {
    var badge = $('#versionBadge');
    if (!badge) return;
    badge.textContent = 'v20.0';
  }

  /* ============================================================
   * v4.0：主题、偏好与桌面个性化
   * ============================================================ */
  var PREFS_KEY = 'windows11_sim_prefs';
  var TEMP_KEY = 'windows11_sim_temp';
  var savePrefsTimer = 0;

  function loadPrefs() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p.theme && p.theme.mode) state.theme.mode = p.theme.mode === 'dark' ? 'dark' : 'light';
        if (p.theme && p.theme.accent) state.theme.accent = p.theme.accent;
        if (p.theme && p.theme.wall) state.theme.wall = p.theme.wall;
        if (typeof p.volume === 'number') state.volume = p.volume;
        if (typeof p.brightness === 'number') state.brightness = p.brightness;
        if (p.quick) {
          state.quickTiles.wifi = !!p.quick.wifi;
          state.quickTiles.bt = !!p.quick.bt;
          state.quickTiles.airplane = !!p.quick.airplane;
          state.quickTiles.night = !!p.quick.night;
        }
        if (typeof p.notes === 'string') state.notes = p.notes;
        if (typeof p.npFile === 'string' && p.npFile) state.npFile = p.npFile;
        if (p.store) state.storeInstalled = p.store;
        if (typeof p.photoIndex === 'number') state.photoIndex = p.photoIndex;
        if (p.update && p.update.installed) state.update.installed = true;
      }
    } catch (e) { /* 忽略损坏的本地偏好 */ }
    state.tempFiles = fsLocalAll();
  }
  function prefsSnapshot() {
    return {
      theme: state.theme, volume: state.volume, brightness: state.brightness,
      quick: { wifi: state.quickTiles.wifi, bt: state.quickTiles.bt,
               airplane: state.quickTiles.airplane, night: state.quickTiles.night },
      notes: state.notes, npFile: state.npFile,
      store: state.storeInstalled, photoIndex: state.photoIndex,
      update: { installed: state.update.installed }
    };
  }
  function savePrefs() {
    var prefs = prefsSnapshot();
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* 隐私模式忽略 */ }
    // v5.0：同时把设置写入服务器的 Temp 目录（延迟合并，避免滑块频繁请求）
    clearTimeout(savePrefsTimer);
    savePrefsTimer = setTimeout(function () {
      fsSave('settings.json', JSON.stringify(prefs, null, 2), null);
    }, 900);
  }

  /* ============================================================
   * v5.0：Temp 目录文件存储（服务器 API 优先，localStorage 兜底）
   * ============================================================ */
  function fsLocalAll() {
    try {
      var raw = localStorage.getItem(TEMP_KEY);
      var obj = raw ? JSON.parse(raw) : null;
      return obj && typeof obj === 'object' ? obj : {};
    } catch (e) { return {}; }
  }
  function fsLocalSet(name, content) {
    try {
      var all = fsLocalAll();
      all[name] = content;
      localStorage.setItem(TEMP_KEY, JSON.stringify(all));
    } catch (e) { /* 配额或隐私模式 */ }
  }
  function fsSave(name, content, cb) {
    fsLocalSet(name, content);
    state.tempFiles[name] = content;
    var finished = false;
    function finish(ok, res) {
      if (finished) return;
      finished = true;
      if (cb) cb(ok, res);
    }
    try {
      fetch('api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ name: name, content: content })
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (j) {
        state.tempApi = true;
        if (j && j.dir) state.tempDir = j.dir;
        finish(true, j);
      }).catch(function () { finish(false, null); });
    } catch (e) { finish(false, null); }
    setTimeout(function () { finish(false, null); }, 1600);
  }
  function fsList(cb) {
    fetch('api/list', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        state.tempApi = true;
        if (j && j.dir) state.tempDir = j.dir;
        (j && j.files ? j.files : []).forEach(function (f) {
          var n = typeof f === 'string' ? f : (f && f.name);
          if (n && n !== 'settings.json' && !state.tempDeleted[n] && !(n in state.tempFiles)) state.tempFiles[n] = '';
        });
        if (cb) cb();
      })
      .catch(function () { if (cb) cb(); });
  }
  function fsLoad(name, cb) {
    fetch('api/load?name=' + encodeURIComponent(name), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        state.tempApi = true;
        state.tempFiles[name] = j && typeof j.content === 'string' ? j.content : '';
        if (cb) cb(state.tempFiles[name]);
      })
      .catch(function () {
        var all = fsLocalAll();
        if (typeof all[name] === 'string') state.tempFiles[name] = all[name];
        if (cb) cb(state.tempFiles[name] || '');
      });
  }
  function tempPathOf(name) {
    var dir = state.tempDir || '%TEMP%\\windows11-sim';
    return dir + '\\' + name;
  }
  function mixHex(hex, target, ratio) {
    var h = String(hex || '#0067c0').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    var tr = parseInt(target.slice(0, 2), 16), tg = parseInt(target.slice(2, 4), 16), tb = parseInt(target.slice(4, 6), 16);
    var m = function (a, c) { return Math.round(a + (c - a) * ratio).toString(16).padStart(2, '0'); };
    return '#' + m(r, tr) + m(g, tg) + m(b, tb);
  }
  function applyTheme() {
    var t = state.theme;
    document.body.dataset.theme = t.mode === 'dark' ? 'dark' : 'light';
    document.body.dataset.night = state.quickTiles.night ? '1' : '0';
    var root = document.documentElement.style;
    root.setProperty('--accent', t.accent);
    root.setProperty('--accent-hover', mixHex(t.accent, 'ffffff', 0.16));
    root.setProperty('--accent-press', mixHex(t.accent, '000000', 0.12));
    var wall = $('#wall');
    if (wall) wall.dataset.wall = String(t.wall || 1);
    syncQuickPanel();
  }
  function syncQuickPanel() {
    $$('#quickPanel .qp-tile').forEach(function (b) {
      // v9.0：音效磁贴状态来自 state.v9.sound
      var on = b.dataset.qc === 'sound' ? state.v9.sound : !!state.quickTiles[b.dataset.qc];
      b.classList.toggle('on', on);
    });
    var st = $('#qsStatus');
    if (st) st.textContent = state.quickTiles.wifi ? _t('qs_connected') : _t('qs_disconnected');
    var br = $('#qsBright'), vol = $('#qsVol');
    if (br) { br.value = state.brightness; $('#qsBrightVal').textContent = String(state.brightness); }
    if (vol) { vol.value = state.volume; $('#qsVolVal').textContent = String(state.volume); }
  }

  /* ============================================================
   * 窗口管理系统
   * ============================================================ */
  var AppWindows = {
    _focusedId: null,
    _layer: function () {
      var active = $('.screen.active');
      return active && active.id === 's-desktop' ? $('#winLayer') : $('#setupWinLayer');
    },
    open: function (type, opts) {
      opts = opts || {};
      // 默认同类型单例；只有显式 multi:true 时才重复打开。
      var existingId = opts.id && state.openWindows[opts.id] ? opts.id : null;
      if (!existingId && !opts.multi) {
        Object.keys(state.openWindows).some(function (id) {
          if (state.openWindows[id].dataset.type === type) { existingId = id; return true; }
          return false;
        });
      }
      if (existingId) {
        this.focus(existingId);
        return state.openWindows[existingId];
      }
      var id = opts.id || type + '-' + Date.now() + '-' + Math.floor(Math.random() * 999);

      var layer = this._layer();
      if (!layer) return null;

      var win = document.createElement('div');
      win.className = 'app-window focused';
      win.dataset.id = id;
      win.dataset.type = type;
      win.dataset.desk = String(state.currentDesk);

      var size = {
        w: Math.min(opts.width || 820, Math.max(360, layer.clientWidth - 24)),
        h: Math.min(opts.height || 540, Math.max(220, layer.clientHeight - 24))
      };
      var all = Object.values(state.openWindows);
      var offsetX = (all.length % 8) * 26;
      var offsetY = (all.length % 8) * 22;
      var baseLeft = Math.max(20, Math.round((layer.clientWidth - size.w) / 2 + offsetX - 100));
      var baseTop = Math.max(20, Math.round((layer.clientHeight - size.h) / 2 + offsetY - 60));

      win.style.width = size.w + 'px';
      win.style.height = size.h + 'px';
      win.style.left = baseLeft + 'px';
      win.style.top = baseTop + 'px';
      win.style.zIndex = ++state.winZCounter;

      var title = opts.title || this._defaultTitle(type);
      var icon = opts.icon || this._defaultIcon(type);

      win.innerHTML =
        '<div class="win-bar">' +
          '<div class="win-icon">' + icon + '</div>' +
          '<div class="win-title">' + title + '</div>' +
          '<div class="win-ctrls">' +
            '<button class="win-btn min" title="' + _t('win_min') + '">' + this._svg('min') + '</button>' +
            '<button class="win-btn max" title="' + _t('win_max') + '">' + this._svg('max') + '</button>' +
            '<button class="win-btn close" title="' + _t('win_close') + '">' + this._svg('close') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="win-body"></div>' +
        '<div class="win-resize" title=""></div>';

      layer.appendChild(win);
      state.openWindows[id] = win;

      this._bindWindow(win, id);
      this._renderContent(win, type, opts);
      this.focus(id);
      this._onWindowChange();

      return win;
    },

    _defaultTitle: function (type) {
      var map = {
        explorer: _t('icon_pc'), cmd: '管理员: C:\\Windows\\System32\\cmd.exe',
        edge: 'Microsoft Edge', recycle: _t('icon_recycle'), settings: _t('app_settings'),
        terminal: 'Windows Terminal', setup: _t('setup_title'),
        calc: _t('app_calc'), notepad: _t('app_notepad'), photos: _t('app_photos'),
        store: _t('app_store'), paint: _t('app_paint'), clock: _t('app_clock'),
        player: _t('app_player'), camera: _t('app_camera'), mail: _t('app_mail'),
        weather: _t('app_weather')
      };
      return map[type] || type;
    },
    _defaultIcon: function (type) {
      var s = { width: 16, height: 16, viewBox: '0 0 24 24' };
      if (type === 'cmd' || type === 'terminal')
        return '<svg viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" rx="1.5" fill="#0c0c0c"/><path d="M3.5 5.5l3 2.5-3 2.5M7.5 10.5h4" stroke="#4ec9b0" stroke-width="1.3" stroke-linecap="round"/></svg>';
      if (type === 'explorer')
        return '<svg viewBox="0 0 24 24"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l1.6 2H19.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-10Z" fill="#f5c04a" stroke="#c99a2e" stroke-width="1.2"/></svg>';
      if (type === 'edge')
        return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#0f9bd7"/><path d="M5 15c1.5-4 4.5-6 8-6 4 0 6 2 6 4.5 0 3.5-3.5 5.5-7 5.5-3 0-5.5-1-7-4Z" fill="#31c3f0"/></svg>';
      if (type === 'recycle')
        return '<svg viewBox="0 0 24 24" fill="none"><path d="M5 8h14l-1.2 11.4a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" stroke="#4a5a6b" stroke-width="1.5"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8" stroke="#4a5a6b" stroke-width="1.5"/></svg>';
      if (type === 'settings')
        return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="#0067c0"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" stroke="#0067c0" stroke-width="1.5" stroke-linecap="round"/></svg>';
      if (type === 'setup')
        return '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="9" height="9" fill="#0067c0"/><rect x="13" y="2" width="9" height="9" fill="#0067c0"/><rect x="2" y="13" width="9" height="9" fill="#0067c0"/><rect x="13" y="13" width="9" height="9" fill="#0067c0"/></svg>';
      if (type === 'calc')
        return '<svg viewBox="0 0 16 16"><rect x="2.5" y="1.5" width="11" height="13" rx="1.6" fill="#4c9a2a"/><rect x="4.4" y="3.4" width="7.2" height="2.4" rx=".5" fill="#fff" opacity=".9"/><g fill="#fff"><circle cx="5.2" cy="8.4" r=".85"/><circle cx="8" cy="8.4" r=".85"/><circle cx="10.8" cy="8.4" r=".85"/><circle cx="5.2" cy="11.2" r=".85"/><circle cx="8" cy="11.2" r=".85"/><circle cx="10.8" cy="11.2" r=".85"/></g></svg>';
      if (type === 'notepad')
        return '<svg viewBox="0 0 16 16"><path d="M4 1.6h5l3 3v9.8H4V1.6Z" fill="#5c2d91"/><path d="M9 1.6v3h3" fill="#3f1d66"/><path d="M6 7h4M6 9h4M6 11h2.5" stroke="#fff" stroke-width="1" stroke-linecap="round"/></svg>';
      if (type === 'photos')
        return '<svg viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="1.4" fill="#2b88d8"/><circle cx="5.6" cy="6.3" r="1.05" fill="#fff"/><path d="M2.6 12.1l3.3-3.2 2.2 2.1 2.2-2.6 3 3.1" stroke="#fff" stroke-width="1.2" stroke-linejoin="round" fill="none"/></svg>';
      if (type === 'store')
        return '<svg viewBox="0 0 16 16"><path d="M3.6 5h8.8l-.8 8.2H4.4L3.6 5Z" fill="#0067b8"/><path d="M6 5V3.9a2 2 0 0 1 4 0V5" stroke="#fff" stroke-width="1.2" fill="none"/></svg>';
      if (type === 'paint')
        return '<svg viewBox="0 0 16 16" fill="none"><path d="M8 2a6 6 0 0 0 0 12c1 0 1.6-.7 1.6-1.5 0-.5-.3-.9-.3-1.4 0-.7.6-1.3 1.4-1.3H12A2 2 0 0 0 14 7.8C14 4.6 11.3 2 8 2Z" stroke="#c2410c" stroke-width="1.2"/><circle cx="5.6" cy="6" r=".8" fill="#c2410c"/><circle cx="8.2" cy="4.8" r=".8" fill="#c2410c"/><circle cx="10.7" cy="6.2" r=".8" fill="#c2410c"/></svg>';
      if (type === 'clock')
        return '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#0f6cbd" stroke-width="1.3"/><path d="M8 4.6V8l2.4 1.6" stroke="#0f6cbd" stroke-width="1.3" stroke-linecap="round"/></svg>';
      if (type === 'player')
        return '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" fill="#c42b1c"/><path d="M6.5 5.2l4.2 2.8-4.2 2.8V5.2Z" fill="#fff"/></svg>';
      if (type === 'camera')
        return '<svg viewBox="0 0 16 16" fill="none"><rect x="1.6" y="4.4" width="12.8" height="9.2" rx="2" fill="#2b88d8"/><path d="M5.6 4.4l1-1.6h2.8l1 1.6" fill="#2b88d8"/><circle cx="8" cy="9" r="2.6" stroke="#fff" stroke-width="1.3"/></svg>';
      if (type === 'mail')
        return '<svg viewBox="0 0 16 16" fill="none"><rect x="1.8" y="3.4" width="12.4" height="9.2" rx="1.6" fill="#0f6cbd"/><path d="M2.4 4.4L8 8.8l5.6-4.4" stroke="#fff" stroke-width="1.2"/></svg>';
      if (type === 'weather')
        return '<svg viewBox="0 0 16 16" fill="none"><circle cx="6" cy="6" r="2.4" fill="#f5c04a"/><path d="M5.4 11.4h5.4a2.4 2.4 0 0 0 .2-4.8A3.2 3.2 0 0 0 5.4 7.4a2 2 0 0 0 0 4Z" fill="#bcd7f0"/></svg>';
      return '<svg viewBox="0 0 16 16"><rect x="1" y="1" width="14" height="14" rx="2" fill="#0067c0"/></svg>';
    },
    _svg: function (kind) {
      if (kind === 'close')
        return '<svg viewBox="0 0 10 10"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1.4"/></svg>';
      if (kind === 'min')
        return '<svg viewBox="0 0 10 10"><rect x="1.5" y="4.5" width="7" height="1" fill="currentColor"/></svg>';
      if (kind === 'max')
        return '<svg viewBox="0 0 10 10"><rect x="1.5" y="1.5" width="7" height="7" stroke="currentColor" stroke-width="1" fill="none"/></svg>';
      return '';
    },

    _bindWindow: function (win, id) {
      var self = this;
      var bar = win.querySelector('.win-bar');
      var startX, startY, origLeft, origTop, dragging = false;

      bar.addEventListener('mousedown', function (e) {
        if (e.target.closest('.win-btn')) return;
        if (win.dataset.maxed === '1') return;
        self.focus(id);
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        origLeft = win.offsetLeft; origTop = win.offsetTop;
        e.preventDefault();
      });
      document.addEventListener('mousemove', function (e) {
        if (!dragging) return;
        var layer = win.parentElement;
        var maxX = layer.clientWidth - 40, maxY = layer.clientHeight - 40;
        win.style.left = Math.max(0, Math.min(maxX, origLeft + e.clientX - startX)) + 'px';
        win.style.top = Math.max(0, Math.min(maxY, origTop + e.clientY - startY)) + 'px';
      });
      document.addEventListener('mouseup', function () { dragging = false; });

      // v3.0：双击标题栏最大化 / 还原
      bar.addEventListener('dblclick', function (e) {
        if (e.target.closest('.win-btn')) return;
        self.toggleMax(id);
      });

      // v3.0：右下角拖拽缩放
      var grip = win.querySelector('.win-resize');
      if (grip) {
        var rzStartX, rzStartY, rzW, rzH, resizing = false;
        grip.addEventListener('mousedown', function (e) {
          e.stopPropagation(); e.preventDefault();
          self.focus(id);
          resizing = true;
          rzStartX = e.clientX; rzStartY = e.clientY;
          rzW = win.offsetWidth; rzH = win.offsetHeight;
        });
        document.addEventListener('mousemove', function (e) {
          if (!resizing) return;
          var w = Math.max(420, rzW + e.clientX - rzStartX);
          var h = Math.max(280, rzH + e.clientY - rzStartY);
          win.style.width = w + 'px';
          win.style.height = h + 'px';
          win.dataset.maxed = '0';
        });
        document.addEventListener('mouseup', function () { resizing = false; });
      }

      win.addEventListener('mousedown', function () { self.focus(id); });

      win.querySelector('.win-btn.close').addEventListener('click', function (e) {
        e.stopPropagation(); self.close(id);
      });
      win.querySelector('.win-btn.min').addEventListener('click', function (e) {
        e.stopPropagation(); self.minimize(id);
      });
      win.querySelector('.win-btn.max').addEventListener('click', function (e) {
        e.stopPropagation(); self._showSnapPicker(id, this);
      });
    },

    focus: function (id) {
      var win = state.openWindows[id];
      if (!win) return;
      Object.values(state.openWindows).forEach(function (w) { w.classList.remove('focused'); });
      win.classList.add('focused');
      win.classList.remove('minimized');
      win.style.zIndex = ++state.winZCounter;
      this._focusedId = id;
      this._onWindowChange();
      // 聚焦窗口里的第一个可聚焦元素
      var body = win.querySelector('.win-body');
      if (body) {
        var input = body.querySelector('input, textarea');
        if (input) later(function () { try { input.focus(); } catch(e){} }, 50);
      }
    },
    close: function (id) {
      var win = state.openWindows[id];
      if (!win) return;
      win.remove();
      delete state.openWindows[id];
      if (this._focusedId === id) this._focusedId = null;
      this._onWindowChange();
    },
    minimize: function (id) {
      var win = state.openWindows[id];
      if (!win) return;
      win.classList.add('minimized');
      this._focusedId = null;
      this._onWindowChange();
    },
    toggleMax: function (id) {
      var win = state.openWindows[id];
      if (!win) return;
      if (win.dataset.maxed === '1') {
        win.style.width = win.dataset._w; win.style.height = win.dataset._h;
        win.style.left = win.dataset._l; win.style.top = win.dataset._t;
        win.dataset.maxed = '0';
        win.dataset._snapped = '0';
        win.dataset.snap = '';
      } else {
        if (win.dataset._snapped !== '1') {
          win.dataset._w = win.style.width; win.dataset._h = win.style.height;
          win.dataset._l = win.style.left; win.dataset._t = win.style.top;
        }
        var layer = win.parentElement;
        win.style.width = (layer.clientWidth - 20) + 'px';
        win.style.height = (layer.clientHeight - 20) + 'px';
        win.style.left = '10px'; win.style.top = '10px';
        win.dataset.maxed = '1';
        win.dataset.snap = 'full';
      }
    },
    // v6.0：贴靠布局（左/右半屏、四分之一、最大化）
    snap: function (id, mode) {
      var win = state.openWindows[id];
      if (!win) return;
      var layer = win.parentElement;
      if (!layer) return;
      var W = layer.clientWidth, H = layer.clientHeight, m = 10;
      if (win.dataset.maxed !== '1' && win.dataset._snapped !== '1') {
        win.dataset._w = win.style.width; win.dataset._h = win.style.height;
        win.dataset._l = win.style.left; win.dataset._t = win.style.top;
      }
      win.dataset._snapped = '1';
      win.dataset.snap = mode;
      win.dataset.maxed = mode === 'full' ? '1' : '0';
      var halfW = Math.round((W - 3 * m) / 2);
      var halfH = Math.round((H - 3 * m) / 2);
      var x = m, y = m, w = W - 2 * m, h = H - 2 * m;
      if (mode === 'left') { w = halfW; }
      else if (mode === 'right') { w = halfW; x = W - m - halfW; }
      else if (mode === 'tl') { w = halfW; h = halfH; }
      else if (mode === 'bl') { w = halfW; h = halfH; y = H - m - halfH; }
      else if (mode === 'tr') { w = halfW; h = halfH; x = W - m - halfW; }
      else if (mode === 'br') { w = halfW; h = halfH; x = W - m - halfW; y = H - m - halfH; }
      win.style.left = x + 'px'; win.style.top = y + 'px';
      win.style.width = w + 'px'; win.style.height = h + 'px';
      this.focus(id);
    },
    restore: function (id) {
      var win = state.openWindows[id];
      if (!win) return;
      if (win.dataset._w) {
        win.style.width = win.dataset._w; win.style.height = win.dataset._h;
        win.style.left = win.dataset._l; win.style.top = win.dataset._t;
      }
      win.dataset.maxed = '0';
      win.dataset._snapped = '0';
      win.dataset.snap = '';
    },
    _showSnapPicker: function (id, anchor) {
      var picker = $('#snapPicker'), desk = $('#s-desktop');
      if (!picker || !desk) return;
      state._snapTarget = id;
      picker.classList.add('open');
      var r = anchor.getBoundingClientRect(), base = desk.getBoundingClientRect();
      var w = picker.offsetWidth || 214, h = picker.offsetHeight || 240;
      var left = Math.max(8, Math.min(r.left - base.left - w + 34, desk.clientWidth - w - 8));
      var top = Math.min(r.bottom - base.top + 6, desk.clientHeight - h - 60);
      picker.style.left = left + 'px';
      picker.style.top = Math.max(8, top) + 'px';
    },
    // v6.0：虚拟桌面 - 仅显示当前桌面的窗口
    syncDesk: function () {
      Object.keys(state.openWindows).forEach(function (id) {
        var w = state.openWindows[id];
        w.classList.toggle('hidden-desk', String(w.dataset.desk || 1) !== String(state.currentDesk));
      });
    },
    closeAll: function () {
      Object.keys(state.openWindows).forEach(function (id) {
        state.openWindows[id].remove();
      });
      state.openWindows = {};
      this._focusedId = null;
      this._onWindowChange();
    },

    _onWindowChange: function () {
      var self = this;
      this.syncDesk();
      var types = {};
      Object.values(state.openWindows).forEach(function (w) {
        if (String(w.dataset.desk || 1) !== String(state.currentDesk)) return;
        var t = w.dataset.type;
        if (!types[t]) types[t] = [];
        types[t].push(w.dataset.id);
      });
      // 任务栏 running icon 高亮
      $$('.tb-btn.running').forEach(function (btn) {
        var winType = btn.dataset.winType;
        if (!winType) return;
        btn.classList.toggle('active', !!types[winType]);
      });
      // v3.0：任务栏显示已打开窗口（v6.0 只显示当前桌面）
      var host = $('#tbWins');
      if (!host) return;
      host.innerHTML = '';
      Object.keys(state.openWindows).forEach(function (id) {
        var w = state.openWindows[id];
        if (String(w.dataset.desk || 1) !== String(state.currentDesk)) return;
        var type = w.dataset.type;
        var title = (w.querySelector('.win-title') || {}).textContent || self._defaultTitle(type);
        var b = document.createElement('button');
        b.className = 'tb-win' +
          (w.classList.contains('minimized') ? ' min' : '') +
          (self._focusedId === id && !w.classList.contains('minimized') ? ' active' : '');
        b.dataset.id = id;
        b.title = title;
        b.innerHTML = self._defaultIcon(type) + '<span>' + title + '</span>';
        host.appendChild(b);
      });
    },

    // v3.0：语言切换后刷新已打开窗口的标题与按钮提示
    retitleAll: function () {
      var self = this;
      Object.keys(state.openWindows).forEach(function (id) {
        var w = state.openWindows[id];
        var t = w.querySelector('.win-title');
        if (t) t.textContent = self._defaultTitle(w.dataset.type);
        var mn = w.querySelector('.win-btn.min'), mx = w.querySelector('.win-btn.max'), cl = w.querySelector('.win-btn.close');
        if (mn) mn.title = _t('win_min');
        if (mx) mx.title = _t('win_max');
        if (cl) cl.title = _t('win_close');
      });
      this._onWindowChange();
    },

    /* ========== 窗口内容渲染 ========== */
    _renderContent: function (win, type, opts) {
      var body = win.querySelector('.win-body');
      if (type === 'explorer') this._renderExplorer(body, opts);
      else if (type === 'cmd' || type === 'terminal') this._renderCmd(body, win);
      else if (type === 'edge') this._renderEdge(body);
      else if (type === 'recycle') this._renderRecycle(body);
      else if (type === 'settings') this._renderSettings(body, opts.page);
      else if (type === 'setup') this._renderSetupUpgrade(body, win);
      else if (type === 'calc') this._renderCalc(body);
      else if (type === 'notepad') this._renderNotepad(body, opts);
      else if (type === 'photos') this._renderPhotos(body);
      else if (type === 'store') this._renderStore(body);
      else if (type === 'paint') this._renderPaint(body);
      else if (type === 'clock') this._renderClock(body);
      else if (type === 'player') this._renderMedia(body);
      else if (type === 'camera') v13RenderCamera(body);
      else if (type === 'mail') v13RenderMail(body);
      else if (type === 'weather') v13RenderWeather(body);
    },

    _renderExplorer: function (body, opts) {
      var self = this;
      var navItems = [
        { id: 'quick', label: _t('exp_quick'), icon: '<svg viewBox="0 0 16 16"><path d="M8 2l2 4 4.5.6-3.4 3.2.9 4.6L8 12.5 4 14.4l.9-4.6L1.5 6.6 6 6Z" fill="#f5c04a"/></svg>' },
        { id: 'pc', label: _t('icon_pc'), icon: '<svg viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="9" rx="1" stroke="#0067c0" stroke-width="1.2" fill="none"/><path d="M6 13h4M8 12v1.5" stroke="#0067c0" stroke-width="1.2"/></svg>' },
        { id: 'desktop', label: _t('exp_desktop'), icon: '<svg viewBox="0 0 16 16"><rect x="3" y="2" width="10" height="7" rx="1" stroke="#4a5a6b" stroke-width="1.2" fill="none"/><path d="M6 13h4M8 9v4" stroke="#4a5a6b" stroke-width="1.2"/></svg>' },
        { id: 'docs', label: _t('exp_docs'), icon: '<svg viewBox="0 0 16 16"><path d="M4 2h5l3 3v9H4V2Z" stroke="#4a5a6b" stroke-width="1.2" fill="none"/></svg>' },
        { id: 'dl', label: _t('exp_dl'), icon: '<svg viewBox="0 0 16 16" fill="none"><path d="M8 2v7M5.5 6.5L8 9l2.5-2.5M3 13h10" stroke="#4a5a6b" stroke-width="1.3" stroke-linecap="round"/></svg>' },
        { id: 'pics', label: _t('exp_pics'), icon: '<svg viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="1" stroke="#4a5a6b" stroke-width="1.2" fill="none"/><circle cx="5.5" cy="6.5" r="1" fill="#4a5a6b"/><path d="M2.5 12l3.5-3 3 2.5 2.5-2 2 2.5" stroke="#4a5a6b" stroke-width="1.2" fill="none"/></svg>' },
        { id: 'music', label: _t('exp_music'), icon: '<svg viewBox="0 0 16 16" fill="none"><path d="M5 11V5l8-1v6" stroke="#4a5a6b" stroke-width="1.3" stroke-linecap="round"/><circle cx="5" cy="11" r="1.6" fill="#4a5a6b"/><circle cx="13" cy="10" r="1.6" fill="#4a5a6b"/></svg>' },
        { id: 'temp', label: _t('exp_temp'), icon: '<svg viewBox="0 0 16 16" fill="none"><path d="M4 2.5h8v11H4z" stroke="#4a5a6b" stroke-width="1.2"/><path d="M6 5.5h4M6 8h4M6 10.5h2.5" stroke="#4a5a6b" stroke-width="1.1" stroke-linecap="round"/></svg>' }
      ];

      var driveIcon = '<svg viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" rx="4" fill="#0067c0"/><text x="16" y="21" text-anchor="middle" fill="#fff" font-size="12" font-weight="600">C:</text></svg>';
      var driveIconD = '<svg viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" rx="4" fill="#4c9a2a"/><text x="16" y="21" text-anchor="middle" fill="#fff" font-size="12" font-weight="600">D:</text></svg>';
      var folderIcon = '<svg viewBox="0 0 32 32"><path d="M3 9a2 2 0 0 1 2-2h7l2 3h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" fill="#f5c04a" stroke="#c99a2e" stroke-width="1"/></svg>';
      var pcIcon = AppWindows._defaultIcon('explorer');
      var rcIcon = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 8h14l-1.2 11.4a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" stroke="#4a5a6b" stroke-width="1.5"/></svg>';
      var setupIcon = '<svg viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" rx="6" fill="#0067c0"/><g fill="#fff"><rect x="11" y="11" width="4.5" height="4.5"/><rect x="16.5" y="11" width="4.5" height="4.5"/><rect x="11" y="16.5" width="4.5" height="4.5"/><rect x="16.5" y="16.5" width="4.5" height="4.5"/></g></svg>';
      var docIcon = '<svg viewBox="0 0 32 32"><path d="M7 4h13l5 5v19H7V4Z" fill="#2b579a"/><path d="M7 4h13v5h5" stroke="#1e3f6b" stroke-width="1" fill="none"/></svg>';
      var txtIcon = '<svg viewBox="0 0 32 32"><path d="M7 4h13l5 5v19H7V4Z" fill="#f5f7fa" stroke="#8b98aa" stroke-width="1"/><path d="M10 12h11M10 16h11M10 20h8" stroke="#6b7888" stroke-width="1.4" stroke-linecap="round"/></svg>';
      var xlsIcon = '<svg viewBox="0 0 32 32"><rect x="5" y="4" width="22" height="24" rx="1" fill="#217346"/><text x="16" y="23" text-anchor="middle" fill="#fff" font-size="14" font-weight="700">X</text></svg>';
      var exeIcon = '<svg viewBox="0 0 32 32"><rect x="5" y="4" width="22" height="24" rx="4" fill="#0067c0"/><text x="16" y="22" text-anchor="middle" fill="#fff" font-size="9" font-weight="600">EXE</text></svg>';
      var jpgIcon = '<svg viewBox="0 0 32 32"><rect x="3" y="4" width="26" height="24" rx="2" fill="#f0a04a"/><rect x="6" y="7" width="20" height="14" fill="#5ab4d9"/><circle cx="10" cy="11" r="2" fill="#ffd75e"/><path d="M6 21l6-5 4 3 3-2 6 4" stroke="#fff" stroke-width="1.2" fill="none"/></svg>';
      var mp3Icon = '<svg viewBox="0 0 32 32"><rect x="5" y="4" width="22" height="24" rx="4" fill="#c42b1c"/><circle cx="16" cy="20" r="4" fill="#fff"/></svg>';
      var isoIcon = '<svg viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" rx="3" fill="#5c2d91"/><text x="16" y="21" text-anchor="middle" fill="#fff" font-size="8" font-weight="600">ISO</text></svg>';

      var contentMap = {
        pc: [
          { name: _t('exp_local_disk') + ' (C:)', type: 'drive', target: 'c', icon: driveIcon },
          { name: _t('exp_data_disk') + ' (D:)', type: 'drive', target: 'd', icon: driveIconD }
        ],
        c: [
          { name: 'Windows', type: 'folder', target: 'c-win', icon: folderIcon },
          { name: 'Users', type: 'folder', target: 'c-users', icon: folderIcon },
          { name: 'Program Files', type: 'folder', target: 'c-pf', icon: folderIcon }
        ],
        'c-win': [
          { name: 'System32', type: 'folder', target: 'c-sys', icon: folderIcon },
          { name: 'explorer.exe', type: 'file', icon: exeIcon },
          { name: 'notepad.exe', type: 'file', icon: exeIcon }
        ],
        'c-sys': [
          { name: 'cmd.exe', type: 'file', icon: exeIcon },
          { name: 'kernel32.dll', type: 'file', icon: exeIcon }
        ],
        'c-users': [
          { name: state.userName || 'Administrator', type: 'folder', target: 'c-user', icon: folderIcon }
        ],
        'c-user': [
          { name: _t('exp_desktop'), type: 'folder', target: 'desktop', icon: folderIcon },
          { name: _t('exp_docs'), type: 'folder', target: 'docs', icon: folderIcon },
          { name: _t('exp_dl'), type: 'folder', target: 'dl', icon: folderIcon },
          { name: _t('exp_pics'), type: 'folder', target: 'pics', icon: folderIcon },
          { name: _t('exp_appdata'), type: 'folder', target: 'c-appdata', icon: folderIcon }
        ],
        'c-appdata': [
          { name: 'Local', type: 'folder', target: 'c-local', icon: folderIcon }
        ],
        'c-local': [
          { name: _t('exp_temp'), type: 'folder', target: 'temp', icon: folderIcon }
        ],
        'c-pf': [],
        d: [
          { name: _t('folder_new'), type: 'folder', target: 'd-new', icon: folderIcon },
          { name: 'backup', type: 'folder', target: 'd-backup', icon: folderIcon }
        ],
        'd-new': [],
        'd-backup': [
          { name: 'Windows11.iso', type: 'file', icon: isoIcon }
        ],
        desktop: [
          { name: _t('icon_pc'), type: 'shortcut', target: 'pc', icon: pcIcon },
          { name: _t('icon_recycle'), type: 'shortcut', app: 'recycle', icon: rcIcon },
          { name: _t('icon_reinstall'), type: 'shortcut', app: 'setup', icon: setupIcon }
        ],
        docs: [
          { name: '演示文档.docx', type: 'file', icon: docIcon },
          { name: '工作计划.xlsx', type: 'file', icon: xlsIcon },
          { name: '说明.txt', type: 'file', app: 'notepad', icon: docIcon }
        ],
        dl: [
          { name: 'setup.exe', type: 'file', icon: exeIcon }
        ],
        pics: [
          { name: _t('ph_caption_1') + '.jpg', type: 'file', app: 'photos', icon: jpgIcon },
          { name: _t('ph_caption_2') + '.jpg', type: 'file', app: 'photos', icon: jpgIcon }
        ],
        music: [
          { name: '歌曲.mp3', type: 'file', icon: mp3Icon }
        ],
        temp: [],
        quick: []
      };
      var titles = {
        quick: _t('exp_quick'), pc: _t('icon_pc'), desktop: _t('exp_desktop'),
        docs: _t('exp_docs'), dl: _t('exp_dl'), pics: _t('exp_pics'), music: _t('exp_music'),
        temp: _t('exp_temp'),
        c: _t('exp_local_disk') + ' (C:)', d: _t('exp_data_disk') + ' (D:)',
        'c-win': 'Windows', 'c-users': 'Users', 'c-pf': 'Program Files',
        'c-sys': 'System32', 'c-user': state.userName || 'Administrator',
        'c-appdata': _t('exp_appdata'), 'c-local': 'Local',
        'd-new': _t('folder_new'), 'd-backup': 'backup'
      };
      var parents = {
        c: 'pc', d: 'pc', 'c-win': 'c', 'c-users': 'c', 'c-pf': 'c', 'c-sys': 'c-win',
        'c-user': 'c-users', 'c-appdata': 'c-user', 'c-local': 'c-appdata', temp: 'c-local',
        'd-new': 'd', 'd-backup': 'd'
      };

      // v6.0：合并本次会话中新建的文件夹
      Object.keys(state.expFolders).forEach(function (fid) {
        var f = state.expFolders[fid];
        if (!contentMap[fid]) contentMap[fid] = [];
        titles[fid] = f.name;
        parents[fid] = f.parent;
        if (!contentMap[f.parent]) contentMap[f.parent] = [];
        var has = contentMap[f.parent].some(function (x) { return x.target === fid; });
        if (!has) contentMap[f.parent].push({ name: f.name, type: 'folder', target: fid, icon: folderIcon });
      });

      var startPath = contentMap[opts.path] ? opts.path : 'pc';
      var tabs = [{ current: startPath, stack: [startPath] }];
      var active = 0;
      var selName = '', selPath = '';

      function tab() { return tabs[active]; }

      function pathOf(id) {
        var segs = [];
        var cur = id;
        while (cur) { segs.unshift({ id: cur, label: titles[cur] || cur }); cur = parents[cur]; }
        return segs;
      }

      function tempItems() {
        return Object.keys(state.tempFiles).sort().filter(function (n) {
          return n !== 'settings.json';
        }).map(function (n) {
          return { name: n, type: 'file', file: n, icon: txtIcon };
        });
      }

      function renderTabs() {
        var host = body.querySelector('.exp-tabs'); if (!host) return;
        host.innerHTML = tabs.map(function (t, i) {
          var label = titles[t.current] || t.current;
          return '<div class="exp-tab' + (i === active ? ' active' : '') + '" data-tab="' + i + '" title="' + label + '">' +
            '<span>' + label + '</span>' +
            '<button class="tab-close" data-tabclose="' + i + '" title="' + _t('exp_close_tab') + '">×</button></div>';
        }).join('') + '<button class="exp-newtab" id="expNewTab" title="' + _t('exp_tab_new') + '">+</button>';
      }

      function visibleItems() {
        var t = tab();
        if (t.current === 'temp') contentMap.temp = tempItems();
        var items = (contentMap[t.current] || []).slice();
        var qEl = body.querySelector('#expSearch');
        var q = qEl ? qEl.value.trim().toLowerCase() : '';
        if (q) items = items.filter(function (it) { return String(it.name).toLowerCase().indexOf(q) >= 0; });
        var sort = state.expSort || 'name';
        items.sort(function (a, b) {
          var af = a.type === 'file' ? 1 : 0, bf = b.type === 'file' ? 1 : 0;
          if (af !== bf) return af - bf;
          if (sort === 'type' && a.type !== b.type) return String(a.type) < String(b.type) ? -1 : 1;
          return String(a.name).localeCompare(String(b.name));
        });
        return items;
      }

      function renderList() {
        var t = tab();
        var items = visibleItems();
        var container = body.querySelector('.explorer__files');
        container.className = 'explorer__files' + (state.expView === 'list' ? ' list' : '');
        container.innerHTML = items.map(function (it) {
          var sel = selName && selPath === t.current && selName === it.name ? ' sel' : '';
          return '<div class="explorer__file' + sel + '" data-name="' + it.name + '"' +
            ' data-target="' + (it.target || '') + '" data-app="' + (it.app || '') + '"' +
            ' data-file="' + (it.file || '') + '">' +
            '<div class="fi-icon">' + it.icon + '</div>' +
            '<div class="fi-name">' + it.name + '</div></div>';
        }).join('');
        var pathEl = body.querySelector('.explorer__path');
        pathEl.innerHTML = pathOf(t.current).map(function (s) {
          return '<span class="seg" data-path="' + s.id + '">' + s.label + '</span>';
        }).join('<span class="sep">›</span>');
        var empty = body.querySelector('.explorer__empty');
        var qEl = body.querySelector('#expSearch');
        container.style.display = items.length ? '' : 'none';
        empty.style.display = items.length ? 'none' : '';
        empty.textContent = qEl && qEl.value.trim() ? _t('exp_no_match') : _t('exp_empty');
        var back = body.querySelector('#expBack');
        if (back) back.disabled = t.stack.length < 2;
        var viewBtn = body.querySelector('#expView');
        if (viewBtn) viewBtn.textContent = state.expView === 'list' ? _t('exp_view_icons') : _t('exp_view_list');
        var sortSel = body.querySelector('#expSort');
        if (sortSel) sortSel.value = state.expSort;
        body.querySelectorAll('.nav-item').forEach(function (x) {
          x.classList.toggle('active', x.dataset.id === t.current);
        });
        renderTabs();
      }

      function navigate(id) {
        if (!id || (!contentMap[id] && id !== 'temp')) return;
        var t = tab();
        t.current = id;
        selName = '';
        if (t.stack[t.stack.length - 1] !== id) t.stack.push(id);
        renderList();
      }

      function newFolder() {
        var t = tab();
        if (t.current === 'temp' || t.current === 'quick') { toast(_t('exp_protected')); return; }
        state.folderSeq++;
        var id = 'fx' + Date.now() + '-' + state.folderSeq;
        var name = _t('folder_new') + (state.folderSeq > 1 ? ' (' + state.folderSeq + ')' : '');
        state.expFolders[id] = { name: name, parent: t.current };
        contentMap[id] = [];
        titles[id] = name; parents[id] = t.current;
        (contentMap[t.current] = contentMap[t.current] || []).unshift({ name: name, type: 'folder', target: id, icon: folderIcon });
        renderList();
        toast(_t('exp_folder_created', { name: name }));
      }

      function deleteSelected() {
        var t = tab();
        if (!selName || selPath !== t.current) { toast(_t('exp_protected')); return; }
        var items = contentMap[t.current] || [];
        var idx = -1, item = null;
        items.forEach(function (x, i) { if (x.name === selName) { idx = i; item = x; } });
        if (!item) return;
        if (item.target && state.expFolders[item.target]) {
          var removed = item.target;
          Object.keys(state.expFolders).forEach(function (fid) {
            if (fid === removed || state.expFolders[fid].parent === removed) delete state.expFolders[fid];
          });
          items.splice(idx, 1);
          selName = ''; renderList();
          toast(_t('exp_deleted', { name: item.name }));
          return;
        }
        if (item.file && Object.prototype.hasOwnProperty.call(state.tempFiles, item.file)) {
          delete state.tempFiles[item.file];
          state.tempDeleted[item.file] = true;
          try {
            var all = fsLocalAll();
            delete all[item.file];
            localStorage.setItem(TEMP_KEY, JSON.stringify(all));
          } catch (e) { /* 忽略本地存储异常 */ }
          selName = ''; renderList();
          toast(_t('exp_deleted', { name: item.name }));
          return;
        }
        toast(_t('exp_protected'));
      }

      body.className = 'explorer';
      body.innerHTML =
        '<div class="exp-tabs"></div>' +
        '<div class="explorer__body">' +
          '<div class="explorer__nav">' +
            '<div class="nav-hd">' + _t('exp_quick') + '</div>' +
            navItems.map(function (n) {
              return '<div class="nav-item" data-id="' + n.id + '">' + n.icon + '<span>' + n.label + '</span></div>';
            }).join('') +
          '</div>' +
          '<div class="explorer__main">' +
            '<div class="explorer__ribbon">' +
              '<button id="expBack" title="' + _t('exp_back') + '">‹ ' + _t('exp_back') + '</button>' +
              '<button>' + _t('exp_file') + '</button><button>' + _t('exp_home') + '</button>' +
              '<button>' + _t('exp_share') + '</button><button>' + _t('exp_view') + '</button>' +
            '</div>' +
            '<div class="exp-tools">' +
              '<button id="expNewFolder">' + _t('exp_new_folder') + '</button>' +
              '<button id="expDelete">' + _t('exp_delete') + '</button>' +
              '<span class="grow"></span>' +
              '<select id="expSort" title="' + _t('exp_sort') + '">' +
                '<option value="name">' + _t('exp_sort') + ': ' + _t('exp_sort_name') + '</option>' +
                '<option value="type">' + _t('exp_sort') + ': ' + _t('exp_sort_type') + '</option>' +
              '</select>' +
              '<button id="expView">' + _t('exp_view_list') + '</button>' +
              '<input id="expSearch" placeholder="' + _t('exp_search_ph') + '" autocomplete="off" spellcheck="false">' +
            '</div>' +
            '<div class="explorer__path"></div>' +
            '<div class="explorer__content">' +
              '<div class="explorer__files"></div>' +
              '<div class="explorer__empty">' + _t('exp_empty') + '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      // 标签页
      body.querySelector('.exp-tabs').addEventListener('click', function (e) {
        var close = e.target.closest('[data-tabclose]');
        if (close) {
          e.stopPropagation();
          var idx = Number(close.dataset.tabclose);
          if (tabs.length <= 1) {
            tabs[0] = { current: 'pc', stack: ['pc'] };
            active = 0;
          } else {
            tabs.splice(idx, 1);
            if (active >= tabs.length) active = tabs.length - 1;
            else if (active > idx) active--;
          }
          renderList();
          return;
        }
        var tabEl = e.target.closest('[data-tab]');
        if (tabEl) { active = Number(tabEl.dataset.tab); renderList(); return; }
        if (e.target.closest('#expNewTab')) {
          tabs.push({ current: 'quick', stack: ['quick'] });
          active = tabs.length - 1;
          renderList();
        }
      });

      body.querySelectorAll('.nav-item').forEach(function (ni) {
        ni.addEventListener('click', function () {
          var t = tab();
          t.current = ni.dataset.id;
          t.stack = [ni.dataset.id];
          selName = '';
          renderList();
        });
      });
      var backBtn = body.querySelector('#expBack');
      if (backBtn) backBtn.addEventListener('click', function () {
        var t = tab();
        if (t.stack.length < 2) return;
        t.stack.pop();
        t.current = t.stack[t.stack.length - 1];
        selName = '';
        renderList();
      });
      body.querySelector('.explorer__path').addEventListener('click', function (e) {
        var seg = e.target.closest('.seg'); if (!seg) return;
        var t = tab();
        var idx = -1;
        for (var i = 0; i < t.stack.length; i++) if (t.stack[i] === seg.dataset.path) idx = i;
        if (idx >= 0) { t.stack = t.stack.slice(0, idx + 1); t.current = t.stack[t.stack.length - 1]; renderList(); }
        else navigate(seg.dataset.path);
      });

      // v6.0：工具栏（新建、删除、排序、视图、搜索）
      body.querySelector('#expNewFolder').addEventListener('click', newFolder);
      body.querySelector('#expDelete').addEventListener('click', deleteSelected);
      body.querySelector('#expSort').addEventListener('change', function () {
        state.expSort = this.value; renderList();
      });
      body.querySelector('#expView').addEventListener('click', function () {
        state.expView = state.expView === 'list' ? 'icons' : 'list';
        renderList();
      });
      body.querySelector('#expSearch').addEventListener('input', function () { renderList(); });

      var filesEl = body.querySelector('.explorer__files');
      filesEl.addEventListener('click', function (e) {
        var f = e.target.closest('.explorer__file'); if (!f) return;
        selName = f.dataset.name; selPath = tab().current;
        body.querySelectorAll('.explorer__file.sel').forEach(function (x) { x.classList.remove('sel'); });
        f.classList.add('sel');
      });
      filesEl.addEventListener('dblclick', function (e) {
        var f = e.target.closest('.explorer__file'); if (!f) return;
        if (f.dataset.target) { navigate(f.dataset.target); return; }
        if (f.dataset.file) {
          var nm = f.dataset.file;
          fsLoad(nm, function (txt) {
            AppWindows.open('notepad', { multi: true, file: nm, content: txt });
          });
          return;
        }
        if (f.dataset.app) { AppWindows.open(f.dataset.app, { multi: f.dataset.app !== 'setup' }); return; }
        toast(_t('toast_demo_unavailable', { name: f.dataset.name || _t('exp_file') }));
      });

      renderList();
      fsList(function () { if (body.isConnected) renderList(); });
    },

    _renderCmd: function (body, win) {
      body.className = 'terminal';
      body.innerHTML =
        '<div class="term-out" id="cmdOut"></div>' +
        '<div class="term-line">' +
          '<span class="term-prompt">' + (state.deviceName || 'DESKTOP') + ' C:\\Windows\\System32&gt;</span>' +
          '<input class="term-input" id="cmdInput" spellcheck="false" autocomplete="off">' +
        '</div>';
      var out = body.querySelector('#cmdOut');
      var input = body.querySelector('#cmdInput');
      var hist = []; var hIdx = -1;

      function log(text, cls) {
        var div = document.createElement('div');
        if (cls) div.className = cls;
        div.textContent = text;
        out.appendChild(div);
        out.scrollTop = out.scrollHeight;
      }
      function logHTML(html, cls) {
        var div = document.createElement('div');
        if (cls) div.className = cls;
        div.innerHTML = html;
        out.appendChild(div);
        out.scrollTop = out.scrollHeight;
      }

      log('Microsoft Windows [版本 10.0.22631.3672]', 'term-title');
      log('(c) Microsoft Corporation. 保留所有权利。');
      log('');

      function runCmd(raw) {
        logHTML('<span class="term-prompt">' + (state.deviceName || 'DESKTOP') + ' C:\\Windows\\System32&gt;</span>' + raw);
        if (!raw.trim()) return;
        hist.push(raw); hIdx = hist.length;
        var parts = raw.trim().split(/\s+/);
        var cmd = parts[0].toLowerCase();
        var args = parts.slice(1).join(' ');

        var cmds = {
          help: function () {
            var list = ['help        显示可用命令列表', 'ver         显示 Windows 版本', 'cls         清除屏幕',
              'dir         列出当前目录', 'whoami      显示当前用户名', 'hostname    显示计算机名',
              'ipconfig    网络配置信息', 'systeminfo  系统信息概览', 'tasklist    运行中的进程',
              'echo text   输出文本', 'date        显示当前日期', 'time        显示当前时间',
              'cd [path]   切换目录', 'exit        关闭命令提示符'];
            list.forEach(function (l) { log(l, 'term-help'); });
          },
          ver: function () { log('Microsoft Windows [版本 10.0.22631.3672]'); },
          winver: function () { v9ShowWinver(); log('winver: 已打开“关于 Windows”对话框'); },
          updatehistory: function () { v9ShowUpdateHistory(); log('updatehistory: 已打开更新历史记录'); },
          cls: function () { out.innerHTML = ''; },
          dir: function () {
            log(' 驱动器 C 中的卷没有标签。');
            log(' 卷的序列号是 3A7F-8D21');
            log('');
            log(' C:\\Windows\\System32 的目录');
            log('');
            log('2024/01/15  10:23    <DIR>          .');
            log('2024/01/15  10:23    <DIR>          ..');
            log('2024/01/14  22:15         1,234,567 explorer.exe');
            log('2024/01/14  22:15         3,456,789 cmd.exe');
            log('2024/01/14  22:15           456,789 notepad.exe');
            log('2024/01/14  22:15         8,901,234 kernel32.dll');
            log('              4 个文件     14,049,379 字节');
            log('              2 个目录  123,456,789,012 可用字节');
          },
          whoami: function () { log((state.deviceName || 'DESKTOP') + '\\' + (state.userName || 'Administrator')); },
          hostname: function () { log(state.deviceName || 'DESKTOP-7F3K9Q'); },
          ipconfig: function () {
            log('Windows IP 配置');
            log('');
            log('无线网络适配器 Wi-Fi:', 'term-title');
            log('   连接特定 DNS 后缀 . . . . . . . : localdomain');
            log('   IPv4 地址 . . . . . . . . . . . : 192.168.1.105');
            log('   子网掩码  . . . . . . . . . . . : 255.255.255.0');
            log('   默认网关  . . . . . . . . . . . : 192.168.1.1');
            log('');
            log('以太网适配器 蓝牙网络连接:', 'term-title');
            log('   媒体状态  . . . . . . . . . . . : 媒体已断开');
          },
          systeminfo: function () {
            log('主机名:                 ' + (state.deviceName || 'DESKTOP-7F3K9Q'));
            log('OS 名称:                Microsoft Windows 11 Pro');
            log('OS 版本:                10.0.22631');
            log('系统类型:               x64-based PC');
            log('总物理内存:             16,384 MB');
            log('可用物理内存:           8,192 MB');
            log('处理器:                 Intel(R) Core(TM) i5-13400F @ 2.50GHz');
            log('系统启动时间:           2026/11/15 09:23:14');
          },
          tasklist: function () {
            log('映像名称                       PID  会话名             会话#       内存使用');
            log('========================= ======== ================ =========== ============');
            var procs = [
              ['System', '4', 'Services', '0', '124,560 K'],
              ['explorer.exe', '3216', 'Console', '1', '456,789 K'],
              ['msedge.exe', '4892', 'Console', '1', '123,456 K'],
              ['msedge.exe', '5012', 'Console', '1', '234,567 K'],
              ['chrome.exe', '6234', 'Console', '1', '345,678 K'],
              ['WeChat.exe', '7123', 'Console', '1', '198,765 K'],
              ['Code.exe', '8234', 'Console', '1', '567,890 K'],
              ['cmd.exe', '9012', 'Console', '1', '12,345 K'],
            ];
            procs.forEach(function (p) { log(p.join('   ')); });
          },
          echo: function () { log(args || ''); },
          date: function () {
            var d = new Date();
            log(d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate());
          },
          time: function () {
            var d = new Date();
            log(String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0'));
          },
          cd: function () { log('C:\\Windows\\System32' + (args ? '\\' + args : '')); },
          exit: function () { AppWindows.close(win.dataset.id); },
          calc: function () { AppWindows.open('edge', { id: 'edge-' + Date.now() }); },
          notepad: function () { toast('Notepad demo mode'); },
        };

        if (cmds[cmd]) cmds[cmd]();
        else log("'" + cmd + "' 不是内部或外部命令，也不是可运行的程序或批处理文件。", 'term-warn');
      }

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          runCmd(input.value);
          input.value = '';
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (hist.length) { hIdx = Math.max(0, hIdx - 1); input.value = hist[hIdx]; }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (hist.length) { hIdx = Math.min(hist.length, hIdx + 1); input.value = hIdx >= hist.length ? '' : hist[hIdx]; }
        }
      });

      later(function () { try { input.focus(); } catch(e){} }, 100);
    },

    _renderEdge: function (body) {
      body.className = 'edge';
      var tabs = [{ title: _t('edge_newtab'), url: '', history: [''], hi: 0 }];
      var active = 0;

      function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
      }
      function tab() { return tabs[active]; }
      function hostOf(u) {
        try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; }
      }
      function norm(v) {
        v = String(v || '').trim();
        if (!v) return '';
        if (/^(https?:)?\/\//i.test(v)) return v.replace(/^\/\//, 'https://');
        if (/^[\w-]+(\.[\w-]+)+([\/?#].*)?$/.test(v)) return 'https://' + v;
        return 'https://www.bing.com/search?q=' + encodeURIComponent(v);
      }
      function real(url) {
        url = url || 'https://www.bing.com';
        try {
          var w = window.open(url, '_blank');
          if (w) {
            try { w.opener = null; } catch (e) {}
          } else {
            toast(_t('edge_popup'));
          }
        } catch (e) { toast(_t('edge_popup')); }
      }
      function renderTabs() {
        var host = body.querySelector('.edge__tabs'); if (!host) return;
        host.innerHTML = tabs.map(function (t, i) {
          return '<div class="edge__tab' + (i === active ? ' active' : '') + '" data-tab="' + i + '" title="' + esc(t.title) + '">' +
            '<span>' + esc(t.title || _t('edge_newtab')) + '</span>' +
            '<button class="tab-close" data-tabclose="' + i + '">×</button></div>';
        }).join('') + '<button class="edge__newtab" id="ebNewTab" title="' + _t('edge_newtab') + '">+</button>';
      }
      // v6.0：书签栏与下载面板
      function renderBookmarks() {
        var host = body.querySelector('.edge__bookmarks'); if (!host) return;
        host.innerHTML = state.bookmarks.map(function (b, i) {
          return '<button data-bm="' + i + '" title="' + esc(b.url) + '">' + esc(b.title) + '</button>';
        }).join('');
      }
      function renderDownloads() {
        var host = body.querySelector('#ebDl'); if (!host) return;
        host.innerHTML = '<b>' + _t('edge_downloads') + '</b>' +
          (state.downloads.length ? state.downloads.map(function (d) {
            return '<div class="edge-dl-item"><span>' + esc(d.name) + '</span><em>' + (d.done ? '100%' : '…') + '</em></div>';
          }).join('') : '<div class="edge-dl-item">' + _t('edge_dl_empty') + '</div>');
      }
      function addBookmark() {
        var t = tab();
        if (!t.url) { toast(_t('edge_bookmark_add')); return; }
        var exists = state.bookmarks.some(function (b) { return b.url === t.url; });
        if (!exists) state.bookmarks.push({ title: hostOf(t.url), url: t.url });
        renderBookmarks();
        toast(_t('edge_bookmarked'));
      }
      function renderPage() {
        var t = tab();
        var content = body.querySelector('#ebContent');
        var input = body.querySelector('#ebUrl');
        if (input) input.value = t.url;
        var back = body.querySelector('[data-eb="back"]');
        var fwd = body.querySelector('[data-eb="forward"]');
        if (back) back.disabled = t.hi <= 0;
        if (fwd) fwd.disabled = t.hi >= t.history.length - 1;
        if (!t.url) {
          content.innerHTML =
            '<div class="edge__newtab">' +
              '<div class="eb-logo">Microsoft Edge</div>' +
              '<div class="eb-search">' +
                '<svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.6" stroke="currentColor" stroke-width="1.4"/><path d="M10.6 10.6L14 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
                '<input id="ebSearch" placeholder="' + _t('edge_search_ph') + '">' +
              '</div>' +
              '<div style="margin-top:26px;color:#8b98aa;font-size:12px;">' + _t('edge_real_hint') + '</div>' +
              '<div class="eb-links">' +
                '<button class="eb-link" data-real="https://www.microsoft.com/windows/windows-11">' + _t('edge_link_learn') + '</button>' +
                '<button class="eb-link" data-real="https://www.bing.com">Bing</button>' +
                '<button class="eb-link" data-real="https://github.com">GitHub</button>' +
              '</div>' +
            '</div>';
        } else {
          content.innerHTML =
            '<div class="edge__blocked"><div class="bl-card">' +
              '<div class="bl-ico"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M3 12h18M12 3c2.6 2.5 4 5.5 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.5-4-9s1.4-6.5 4-9Z" stroke="currentColor" stroke-width="1.4"/></svg></div>' +
              '<b>' + _t('edge_blocked_title') + '</b>' +
              '<span>' + esc(t.url) + '</span>' +
              '<div style="margin-top:8px;font-size:11.5px;color:#8b98aa;line-height:1.6;">' + _t('edge_real_hint') + '</div>' +
              '<div class="bl-actions"><button class="btn primary" data-real="' + esc(t.url) + '">' + _t('edge_real') + '</button></div>' +
            '</div></div>';
        }
        renderTabs();
      }
      function go(v) {
        var t = tab();
        var url = norm(v);
        if (!url) return;
        t.url = url;
        t.title = hostOf(url) || _t('edge_newtab');
        t.history = t.history.slice(0, t.hi + 1);
        t.history.push(url); t.hi = t.history.length - 1;
        renderPage();
      }

      body.innerHTML =
        '<div class="edge__tabs"></div>' +
        '<div class="edge__bookmarks"></div>' +
        '<div class="edge__bar">' +
          '<button class="eb-nav" data-eb="back" title="后退"><svg viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>' +
          '<button class="eb-nav" data-eb="forward" title="前进"><svg viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>' +
          '<button class="eb-nav" data-eb="refresh" title="刷新"><svg viewBox="0 0 16 16" fill="none"><path d="M3 8a5 5 0 1 1 1.5 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M3 4v4h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>' +
          '<div class="eb-url"><svg viewBox="0 0 16 16"><rect x="7" y="3" width="2" height="4"/><rect x="11" y="7" width="2" height="6"/><rect x="3" y="7" width="2" height="6"/><path d="M7 7h2l2 6H5l2-6Z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>' +
            '<input id="ebUrl" spellcheck="false" autocomplete="off" placeholder="' + _t('edge_search_ph') + '"></div>' +
          '<button class="eb-nav" data-eb="bookmark" title="' + _t('edge_bookmark_add') + '"><svg viewBox="0 0 16 16" fill="none"><path d="M4.5 2.5h7v11l-3.5-2.6L4.5 13.5v-11Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg></button>' +
          '<button class="eb-nav" data-eb="downloads" title="' + _t('edge_downloads') + '"><svg viewBox="0 0 16 16" fill="none"><path d="M8 2.5v6.5M5.5 6.5L8 9l2.5-2.5M3 12.5h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>' +
          '<button class="eb-real" data-eb="real">' + _t('edge_real') + '</button>' +
        '</div>' +
        '<div class="edge__content" id="ebContent"></div>' +
        '<div class="edge__dl" id="ebDl"></div>';

      body.addEventListener('click', function (e) {
        var close = e.target.closest('[data-tabclose]');
        if (close) {
          e.stopPropagation();
          var idx = Number(close.dataset.tabclose);
          if (tabs.length <= 1) {
            tabs = [{ title: _t('edge_newtab'), url: '', history: [''], hi: 0 }];
            active = 0;
          } else {
            tabs.splice(idx, 1);
            if (active >= tabs.length) active = tabs.length - 1;
            else if (active > idx) active--;
          }
          renderPage();
          return;
        }
        var tabEl = e.target.closest('[data-tab]');
        if (tabEl) { active = Number(tabEl.dataset.tab); renderPage(); return; }
        if (e.target.closest('#ebNewTab')) {
          tabs.push({ title: _t('edge_newtab'), url: '', history: [''], hi: 0 });
          active = tabs.length - 1;
          renderPage();
          return;
        }
        var realBtn = e.target.closest('[data-real]');
        if (realBtn) { real(realBtn.dataset.real); return; }
        var bm = e.target.closest('[data-bm]');
        if (bm) { go(state.bookmarks[Number(bm.dataset.bm)].url); return; }
        var eb = e.target.closest('[data-eb]');
        if (eb) {
          var t = tab();
          if (eb.dataset.eb === 'back' && t.hi > 0) { t.hi--; t.url = t.history[t.hi]; t.title = t.url ? hostOf(t.url) : _t('edge_newtab'); renderPage(); }
          else if (eb.dataset.eb === 'forward' && t.hi < t.history.length - 1) { t.hi++; t.url = t.history[t.hi]; t.title = t.url ? hostOf(t.url) : _t('edge_newtab'); renderPage(); }
          else if (eb.dataset.eb === 'refresh') renderPage();
          else if (eb.dataset.eb === 'bookmark') addBookmark();
          else if (eb.dataset.eb === 'downloads') {
            renderDownloads();
            var dl = body.querySelector('#ebDl');
            if (dl) dl.classList.toggle('open');
          }
          else if (eb.dataset.eb === 'real') real(t.url || 'https://www.bing.com');
        }
      });
      body.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        if (e.target.id === 'ebUrl') {
          e.preventDefault(); e.stopPropagation();
          go(e.target.value);
        } else if (e.target.id === 'ebSearch') {
          e.preventDefault(); e.stopPropagation();
          real(norm(e.target.value));
        }
      });

      renderBookmarks();
      renderDownloads();
      renderPage();
    },

    _renderRecycle: function (body) {
      body.className = 'recycle';
      body.innerHTML =
        '<svg viewBox="0 0 64 64" fill="none">' +
          '<path d="M15 20h34l-3.1 33.8a4 4 0 0 1-4 3.2H22.1a4 4 0 0 1-4-3.2L15 20Z" fill="rgba(200,215,235,.4)" stroke="#b0c4de" stroke-width="2"/>' +
          '<path d="M11 18h42" stroke="#b0c4de" stroke-width="2.4" stroke-linecap="round"/>' +
          '<path d="M26 18v-3a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3" stroke="#b0c4de" stroke-width="2"/>' +
        '</svg>' +
        '<div class="rc-title">回收站为空</div>' +
        '<div class="rc-sub">当你删除文件后，它们会临时存放在这里。</div>';
    },

    _renderSettings: function (body, page) {
      var self = this;
      page = page || 'home';
      body.className = 'settings';
      body.dataset.settingsPage = page;

      var nav = [
        ['home', _t('set_home'), '<svg viewBox="0 0 16 16" fill="none"><path d="M2.5 7.5 8 2.5l5.5 5v6H10v-3.5H6V13.5H2.5v-6Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>'],
        ['update', _t('set_update'), '<svg viewBox="0 0 16 16" fill="none"><path d="M13 8a5 5 0 1 1-1.5-3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M13 2.5V5h-2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'],
        ['system', _t('set_system'), '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3" fill="currentColor"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2M4.2 4.2l1.4 1.4M10.4 10.4l1.4 1.4M4.2 11.8l1.4-1.4M10.4 5.6l1.4-1.4" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>'],
        ['multitask', _t('set_multitask'), '<svg viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="7" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="6.5" y="8" width="7" height="5" rx="1" fill="#fff" stroke="currentColor" stroke-width="1.3"/></svg>'],
        ['bt', _t('set_bt'), '<svg viewBox="0 0 16 16"><path d="M3 5h10v6H3zM6 2.5l1 1.5H9l1-1.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M7 11.5h2v2H7z" fill="currentColor"/></svg>'],
        ['net', _t('set_net'), '<svg viewBox="0 0 16 16" fill="none"><path d="M2 6.5C3.7 5 5.7 4.2 8 4.2s4.3.8 6 2.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M4 9c1.1-.9 2.5-1.4 4-1.4S10.9 8.1 12 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="11.7" r="1" fill="currentColor"/></svg>'],
        ['personal', _t('set_personal'), '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'],
        ['apps', _t('set_apps'), '<svg viewBox="0 0 16 16"><rect x="2.5" y="3" width="11" height="10" rx="1.2" stroke="currentColor" stroke-width="1.4" fill="none"/><rect x="4.5" y="5.5" width="4" height="2.5" rx=".4" fill="currentColor"/><rect x="4.5" y="9" width="7" height="1.5" rx=".3" fill="currentColor"/><rect x="4.5" y="11" width="5" height="1" rx=".2" fill="currentColor"/></svg>'],
        ['account', _t('set_account'), '<svg viewBox="0 0 16 16"><circle cx="8" cy="6" r="3.5" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M2.5 14c1-2.5 3.5-4 5.5-4s4.5 1.5 5.5 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>'],
        ['time', _t('set_time'), '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M8 4v4l3 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'],
        ['privacy', _t('set_privacy'), '<svg viewBox="0 0 16 16"><path d="M8 2l5 2v4c0 3-2.5 5-5 6-2.5-1-5-3-5-6V4l5-2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/></svg>'],
        ['versions', _t('set_versions'), '<svg viewBox="0 0 16 16" fill="none"><path d="M5.5 4h8M5.5 8h8M5.5 12h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="2.7" cy="4" r="1" fill="currentColor"/><circle cx="2.7" cy="8" r="1" fill="currentColor"/><circle cx="2.7" cy="12" r="1" fill="currentColor"/></svg>'],
        ['recovery', _t('set_recovery'), '<svg viewBox="0 0 16 16" fill="none"><path d="M3 8a5 5 0 1 0 1.5-3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M3 2.5V5h2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'],
        ['about', _t('about_title'), '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M8 7v4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="4.8" r="1" fill="currentColor"/></svg>']
      ];

      function row(title, desc, extra, pageId) {
        return '<div class="settings__row' + (pageId ? ' clickable" data-page="' + pageId : '') + '">' +
          '<div class="sr-left"><div><div class="sr-title">' + title + '</div>' +
          (desc ? '<div class="sr-desc">' + desc + '</div>' : '') + '</div></div>' +
          (extra || (pageId ? '<span>›</span>' : '')) + '</div>';
      }
      function card(pageId, title, desc, icon) {
        return '<button class="set-card" data-page="' + pageId + '">' +
          '<span class="sc-ico">' + icon + '</span>' +
          '<span><span class="sc-t" style="display:block">' + title + '</span>' +
          '<span class="sc-d" style="display:block">' + desc + '</span></span></button>';
      }

      var main = '';
      if (page === 'home') {
        var updStatus = state.update.installed ? _t('upd_installed')
          : (state.update.phase === 'available' ? _t('upd_available') : _t('upd_uptodate'));
        var recStatus = state.recovery.phase === 'idle' ? _t('rec_reset_desc') : _t('rec_reset');
        var initial = (state.userName || 'A').charAt(0).toUpperCase();
        main =
          '<h2>' + _t('set_home') + '</h2>' +
          '<div class="set-home-hero"><span class="avatar">' + initial + '</span><div>' +
            '<div class="sh-name">' + _t('set_home_hello', { name: state.userName || 'Administrator' }) + '</div>' +
            '<div class="sh-dev">' + _t('set_home_device') + ' · ' + state.deviceName + '</div></div></div>' +
          '<div class="set-home-hd">' + _t('set_home_quick') + '</div>' +
          '<div class="set-cards">' +
            card('update', _t('set_update'), updStatus,
              '<svg viewBox="0 0 16 16" fill="none"><path d="M13 8a5 5 0 1 1-1.5-3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M13 2.5V5h-2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>') +
            card('personal', _t('set_personal'), _t('set_theme_desc'),
              '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>') +
            card('recovery', _t('set_recovery'), recStatus,
              '<svg viewBox="0 0 16 16" fill="none"><path d="M3 8a5 5 0 1 0 1.5-3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M3 2.5V5h2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>') +
            card('versions', _t('set_versions'), _t('set_versions_desc'),
              '<svg viewBox="0 0 16 16" fill="none"><path d="M5.5 4h8M5.5 8h8M5.5 12h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="2.7" cy="4" r="1" fill="currentColor"/><circle cx="2.7" cy="8" r="1" fill="currentColor"/><circle cx="2.7" cy="12" r="1" fill="currentColor"/></svg>') +
            card('system', _t('set_system'), _t('set_system_sub'),
              '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3" fill="currentColor"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2" stroke="currentColor" stroke-width="1.3"/></svg>') +
            card('about', _t('about_title'), _t('about_desc'),
              '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M8 7v4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="4.8" r="1" fill="currentColor"/></svg>') +
          '</div>' +
          '<div class="set-home-tip">' + _t('set_home_tip') + '</div>';
      } else if (page === 'update') {
        var u = state.update;
        var paused = u.paused && u.paused > Date.now();
        var title = '', desc = '', action = '', bar = -1, good = false;
        if (u.phase === 'checking') {
          title = _t('upd_checking'); desc = _t('upd_available_desc');
        } else if (u.phase === 'available') {
          title = _t('upd_available'); desc = _t('upd_available_desc');
          action = '<button class="btn primary" data-upd="download">' + _t('upd_download') + '</button>' +
                   '<button class="btn" data-upd="pause">' + _t('upd_pause') + '</button>';
        } else if (u.phase === 'downloading') {
          title = _t('upd_downloading', { pct: Math.round(u.pct) }); desc = _t('upd_available_desc'); bar = u.pct;
        } else if (u.phase === 'installing') {
          title = _t('upd_installing', { pct: Math.round(u.pct) }); desc = _t('upd_available_desc'); bar = u.pct;
        } else if (u.phase === 'ready') {
          title = _t('upd_ready'); desc = _t('upd_available_desc');
          action = '<button class="btn primary" data-upd="restart">' + _t('upd_restart') + '</button>';
        } else if (paused) {
          title = _t('upd_paused', { date: new Date(u.paused).toLocaleDateString() });
          desc = _t('upd_opt_desc');
          action = '<button class="btn primary" data-upd="check">' + _t('upd_check') + '</button>';
        } else if (u.installed) {
          title = _t('upd_installed'); desc = _t('upd_installed_desc'); good = true;
          action = '<button class="btn primary" data-upd="check">' + _t('upd_check') + '</button>';
        } else {
          title = _t('upd_uptodate'); desc = _t('upd_uptodate_desc', { time: u.last || _t('upd_never') }); good = true;
          action = '<button class="btn primary" data-upd="check">' + _t('upd_check') + '</button>';
        }
        var updIcon = '<svg viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 1 1-2.3-5.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M20 4v4h-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        main =
          '<h2>' + _t('set_update') + '</h2><p class="s-sub">' + _t('upd_sub') + '</p>' +
          '<div class="upd-hero"><span class="uh-ico' + (good ? ' good' : '') + '">' + updIcon + '</span>' +
            '<div class="upd-info"><b>' + title + '</b><span>' + desc + '</span>' +
              (bar >= 0 ? '<div class="upd-bar"><i style="width:' + Math.max(0, Math.min(100, Math.round(bar))) + '%"></i></div>' : '') +
            '</div>' + action + '</div>' +
          '<div class="switch-row"><div class="txt"><b>' + _t('upd_opt') + '</b><span>' + _t('upd_opt_desc') + '</span></div><div class="switch on"></div></div>' +
          '<div class="settings__row"><div class="sr-left"><div><div class="sr-title">' + _t('upd_feature') + '</div>' +
            '<div class="sr-desc">' + _t('upd_feature_desc') + '</div></div></div>' +
            '<span class="sr-val">' + (u.installed ? _t('upd_installed_25h2') : _t('about_os')) + '</span></div>' +
          '<h2 style="font-size:14px;margin-top:24px;">' + _t('upd_history') + '</h2>' +
          '<div class="about-rows">' +
            '<div class="about-row"><span>' + _t('upd_hist_1') + '</span></div>' +
            '<div class="about-row"><span>' + _t('upd_hist_2') + '</span></div>' +
          '</div>';
      } else if (page === 'recovery') {
        var r = state.recovery;
        var rbody;
        if (r.phase === 'idle') {
          rbody = '<div class="rec-opts">' +
            '<button class="rec-opt" data-rec="cloud"><b>' + _t('rec_cloud') + '</b><span>' + _t('rec_cloud_desc') + '</span></button>' +
            '<button class="rec-opt" data-rec="local"><b>' + _t('rec_local') + '</b><span>' + _t('rec_local_desc') + '</span></button>' +
            '</div><div class="rec-warn">' + _t('rec_warn') + '</div>';
        } else {
          var rlabel = r.phase === 'downloading' ? _t('rec_downloading', { pct: Math.round(r.pct) })
            : r.phase === 'preparing' ? _t('rec_preparing') : _t('rec_ready');
          rbody = '<div class="rec-progress"><div class="rec-stage">' + rlabel + '</div>' +
            (r.phase !== 'ready' ? '<div class="upd-bar"><i style="width:' + Math.max(0, Math.min(100, Math.round(r.pct))) + '%"></i></div>' : '') +
            '<div class="rec-actions">' +
              (r.phase === 'ready' ? '<button class="btn primary" data-rec="reboot">' + _t('rec_restart') + '</button>' : '') +
              '<button class="btn" data-rec="cancel">' + _t('rec_cancel') + '</button>' +
            '</div></div>';
        }
        main =
          '<h2>' + _t('set_recovery') + '</h2><p class="s-sub">' + _t('rec_sub') + '</p>' +
          '<div class="rec-panel"><b>' + _t('rec_reset') + '</b><i>' + _t('rec_reset_desc') + '</i>' + rbody + '</div>';
      } else if (page === 'versions') {
        var eds = ['ver_home', 'ver_pro', 'ver_edu', 'ver_ent'];
        var vrows = [
          ['ver_bitlocker', [1, 1, 1, 1]],
          ['ver_remote', [0, 1, 1, 1]],
          ['ver_hyperv', [0, 1, 1, 1]],
          ['ver_domain', [0, 1, 0, 1]],
          ['ver_gp', [0, 1, 1, 1]],
          ['ver_ram', ['ver_ram_home', 'ver_ram_pro', 'ver_ram_edu', 'ver_ram_ent']]
        ];
        var table = '<table class="ver-table"><thead><tr><th>' + _t('ver_col_feature') + '</th>' +
          eds.map(function (e) { return '<th>' + _t(e) + '</th>'; }).join('') + '</tr></thead><tbody>';
        vrows.forEach(function (vr) {
          table += '<tr><td>' + _t(vr[0]) + '</td>' + vr[1].map(function (v) {
            if (typeof v === 'string') return '<td>' + _t(v) + '</td>';
            return v ? '<td><span class="yes">' + _t('ver_yes') + '</span></td>'
                     : '<td><span class="no">' + _t('ver_no') + '</span></td>';
          }).join('') + '</tr>';
        });
        table += '</tbody></table>';
        var sims = [
          ['ver_v50', 'ver_v50_d', 1], ['ver_v40', 'ver_v40_d', 0], ['ver_v31', 'ver_v31_d', 0],
          ['ver_v30', 'ver_v30_d', 0], ['ver_v21', 'ver_v21_d', 0], ['ver_v20', 'ver_v20_d', 0]
        ];
        var list = sims.map(function (s) {
          return '<div class="ver-item"><span class="v-dot' + (s[2] ? '' : ' old') + '"></span><div><b>' +
            _t(s[0]) + '</b><span>' + _t(s[1]) + '</span></div></div>';
        }).join('');
        main =
          '<h2>' + _t('set_versions') + '</h2><p class="s-sub">' + _t('set_versions_desc') + '</p>' +
          '<div class="ver-tabs">' +
            '<button data-ver-tab="editions" class="' + (state.verTab !== 'sim' ? 'on' : '') + '">' + _t('ver_tab_editions') + '</button>' +
            '<button data-ver-tab="sim" class="' + (state.verTab === 'sim' ? 'on' : '') + '">' + _t('ver_tab_sim') + '</button>' +
          '</div>' +
          (state.verTab === 'sim' ? '<div class="ver-list">' + list + '</div>' : table);
      } else if (page === 'personal') {
        var accents = ['#0067c0', '#8b5cf6', '#e3008c', '#0f7b3f', '#c2410c'];
        var walls = [[1, 'set_wallpaper_1'], [2, 'set_wallpaper_2'], [3, 'set_wallpaper_3'], [4, 'set_wallpaper_4'], [5, 'set_wallpaper_5'], [6, 'set_wallpaper_6'], [7, 'set_wallpaper_7']];
        main =
          '<h2>' + _t('set_personal') + '</h2><p class="s-sub">' + _t('set_theme_desc') + '</p>' +
          '<div class="set-block"><b>' + _t('set_theme') + '</b><i>' + _t('set_theme_desc') + '</i>' +
            '<div class="set-seg">' +
              '<button data-theme-mode="light" class="' + (state.theme.mode === 'light' ? 'on' : '') + '">' + _t('set_theme_light') + '</button>' +
              '<button data-theme-mode="dark" class="' + (state.theme.mode === 'dark' ? 'on' : '') + '">' + _t('set_theme_dark') + '</button>' +
            '</div></div>' +
          '<div class="set-block"><b>' + _t('set_accent') + '</b><i>' + _t('set_accent_desc') + '</i>' +
            '<div class="set-swatches">' + accents.map(function (c) {
              return '<button class="set-swatch' + (state.theme.accent === c ? ' on' : '') + '" data-accent="' + c + '" style="background:' + c + '" title="' + c + '"></button>';
            }).join('') + '</div></div>' +
          '<div class="set-block"><b>' + _t('set_wallpaper') + '</b><i>&nbsp;</i>' +
            '<div class="set-walls">' + walls.map(function (w) {
              return '<button class="set-wall' + (Number(state.theme.wall) === w[0] ? ' on' : '') + '" data-wall="' + w[0] + '" title="' + _t(w[1]) + '"></button>';
            }).join('') + '</div></div>' +
          '<div class="set-block"><b>' + _t('set_anim') + '</b><i>' + _t('set_anim_desc') + '</i>' +
            '<div class="set-seg">' +
              '<button data-anim="full" class="' + (v14IsStill() ? '' : 'on') + '">' + _t('set_anim_full') + '</button>' +
              '<button data-anim="reduced" class="' + (v14IsStill() ? 'on' : '') + '">' + _t('set_anim_reduced') + '</button>' +
            '</div></div>' +
          '<div class="settings__row clickable" data-page="time"><div class="sr-left"><div><div class="sr-title">' + _t('set_lang') + '</div><div class="sr-desc">' + _t('set_time_desc') + '</div></div></div><span>›</span></div>';
      } else if (page === 'time') {
        var i18nLib = window.__i18n || {};
        var meta = i18nLib.meta || [];
        var codes = i18nLib.supported || ['zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'ko-KR'];
        var cur = i18nLib.current || 'zh-CN';
        var fallbackLabel = { 'zh-CN': '简体中文', 'zh-TW': '繁體中文', 'en-US': 'English', 'ja-JP': '日本語', 'ko-KR': '한국어' };
        var labelOf = {};
        meta.forEach(function (m) { labelOf[m.code] = m.label; });
        main =
          '<h2>' + _t('set_time') + '</h2><p class="s-sub">' + _t('set_time_desc') + '</p>' +
          '<div class="set-block"><b>' + _t('set_lang') + '</b><i>' + _t('set_lang_desc') + '</i>' +
            '<div class="set-langs">' + codes.map(function (c) {
              return '<button class="set-lang' + (c === cur ? ' on' : '') + '" data-setlang="' + c + '">' +
                (labelOf[c] || fallbackLabel[c] || c) + '</button>';
            }).join('') + '</div></div>' +
          row(_t('set_region'), '', '<span class="sr-val">' + _t('set_region_value') + '</span>') +
          row(_t('set_keyboard'), '', '<span class="sr-val">' + _t('set_keyboard_value') + '</span>');
      } else if (page === 'privacy') {
        var priv = [['p_loc', 'p_loc_d'], ['p_find', 'p_find_d'], ['p_diag', 'p_diag_d'], ['p_ink', 'p_ink_d'], ['p_tailor', 'p_tailor_d'], ['p_ad', 'p_ad_d'], ['p_local', 'p_local_d']];
        main =
          '<h2>' + _t('set_privacy') + '</h2><p class="s-sub">' + _t('set_privacy_desc') + '</p>' +
          priv.map(function (p, i) {
            return '<div class="switch-row"><div class="txt"><b>' + _t(p[0]) + '</b><span>' + _t(p[1]) + '</span></div>' +
              '<div class="switch' + (i === 5 || i === 3 ? '' : ' on') + '"></div></div>';
          }).join('');
      } else if (page === 'apps') {
        var appList = [['app_explorer', 'explorer'], ['app_edge', 'edge'], ['app_settings', 'settings'], ['app_calc', 'calc'], ['app_notepad', 'notepad'], ['app_photos', 'photos']];
        main =
          '<h2>' + _t('set_apps') + '</h2><p class="s-sub">' + _t('set_apps_count') + '</p>' +
          appList.map(function (a) {
            return '<div class="settings__row clickable" data-open-app="' + a[1] + '"><div class="sr-left"><div>' +
              '<div class="sr-title">' + _t(a[0]) + '</div><div class="sr-desc">' + _t('set_apps_desc') + '</div></div></div><span>›</span></div>';
          }).join('');
      } else if (page === 'multitask') {
        main =
          '<h2>' + _t('set_multitask') + '</h2><p class="s-sub">' + _t('set_multitask_desc') + '</p>' +
          row(_t('set_taskview'), _t('set_taskview_desc'), '<div class="switch on"></div>') +
          row(_t('set_snap'), _t('set_snap_desc'), '<div class="switch on"></div>') +
          row(_t('set_alt'), _t('set_alt_desc'), '<div class="switch on"></div>') +
          row(_t('set_desks'), _t('set_desks_desc', { n: state.desktops.length }),
            '<button class="btn" data-mt="newdesk">' + _t('set_new_desk') + '</button>') +
          row(_t('set_widgets'), _t('set_widgets_desc'), '<div class="switch on"></div>') +
          row(_t('set_open_tv'), '', '<button class="btn" data-mt="tv">' + _t('set_open_tv') + '</button>');
      } else if (page === 'about') {
        var langBtn = document.querySelector('.lang-switch button.on');
        var lang = langBtn ? langBtn.textContent : '简体中文';
        main =
          '<h2>' + _t('about_title') + '</h2>' +
          '<div class="about-hero">' +
            '<div class="about-logo"><svg viewBox="0 0 64 64"><g fill="#fff"><rect x="2" y="2" width="27" height="27"/><rect x="35" y="2" width="27" height="27"/><rect x="2" y="35" width="27" height="27"/><rect x="35" y="35" width="27" height="27"/></g></svg></div>' +
            '<div><div class="about-name">Windows 11</div><div class="about-ver">' + _t('about_version') + ' 20.0.0 · ' + _t('about_edition') + ': ' + (state.edition || 'Pro') + '</div></div>' +
          '</div>' +
          '<div class="about-rows">' +
            '<div class="about-row"><b>' + _t('about_os') + '</b><span>25H2</span></div>' +
            '<div class="about-row"><b>' + _t('about_device') + '</b><span>' + state.deviceName + '</span></div>' +
            '<div class="about-row"><b>' + _t('about_user') + '</b><span>' + (state.userName || 'Administrator') + '</span></div>' +
            '<div class="about-row"><b>' + _t('about_language') + '</b><span>' + lang + '</span></div>' +
            '<div class="about-row"><b>' + _t('about_build') + '</b><span>26200.6.0 · ' + _t('about_sim') + '</span></div>' +
          '</div>' +
          '<div class="about-actions"><button class="btn" data-page="system">' + _t('about_back') + '</button>' +
            '<button class="btn primary" id="aboutRestart">' + _t('about_restart') + '</button></div>' +
          '<div class="about-note">' + _t('about_note') + '</div>';
      } else if (page === 'bt') {
        main = '<h2>' + _t('set_bt') + '</h2><p class="s-sub">' + _t('set_bt_desc') + '</p>' +
          '<div class="set-empty">' + _t('set_bt_empty') + '</div>';
      } else if (page === 'net') {
        main = '<h2>' + _t('set_net') + '</h2><p class="s-sub">' + _t('set_net_desc') + '</p>' +
          row(_t('qs_wifi'), _t('set_net_status'), '<span class="sr-val">' + (state.quickTiles.wifi ? 'On' : 'Off') + '</span>');
      } else if (page === 'account') {
        main = '<h2>' + _t('set_account') + '</h2><p class="s-sub">' + _t('set_account_desc') + '</p>' +
          row(_t('about_user'), state.userName || 'Administrator', '<span class="sr-val">' + _t('set_account_type') + '</span>') +
          row(_t('about_device'), state.deviceName, '');
      } else {
        main =
          '<h2>' + _t('set_system') + '</h2><p class="s-sub">' + _t('set_system_sub') + '</p>' +
          row(_t('set_display'), _t('set_display_desc'), '<span class="sr-val">' + state.brightness + '%</span>') +
          row(_t('set_sound'), _t('set_sound_desc'), '<span class="sr-val">' + state.volume + '%</span>') +
          row(_t('set_fullscreen'), _t('set_fullscreen_desc'), '<button class="btn" data-fullscreen>' + _t('set_fullscreen_btn') + '</button>') +
          row(_t('set_notifications'), _t('set_notif_desc'), '') +
          row(_t('set_power'), _t('set_power_desc'), '') +
          row(_t('set_storage'), _t('set_storage_desc'), '') +
          row(_t('set_backup'), _t('set_backup_desc'), '<button class="btn" data-backup>' + _t('set_backup_btn') + '</button>') +
          row(_t('set_versions'), _t('set_versions_desc'), '', 'versions') +
          row(_t('about_title'), _t('about_desc'), '', 'about');
      }

      body.innerHTML =
        '<div class="settings__nav">' +
          nav.map(function (it) {
            return '<div class="s-item' + (page === it[0] ? ' active' : '') + '" data-nav="' + it[0] + '">' + it[2] + it[1] + '</div>';
          }).join('') +
        '</div>' +
        '<div class="settings__main">' + main + '</div>';

      function renderUpd() { self._renderSettings(body, 'update'); }
      function renderRec() { self._renderSettings(body, 'recovery'); }
      function updStep() {
        if (!body.isConnected || body.dataset.settingsPage !== 'update') return;
        var uu = state.update;
        if (uu.phase === 'downloading') {
          uu.pct = Math.min(100, uu.pct + 4 + Math.random() * 7);
          if (uu.pct >= 100) { uu.phase = 'installing'; uu.pct = 0; }
          renderUpd();
          if (uu.phase === 'downloading') body._updTimer = setTimeout(updStep, 240);
          else body._updTimer = setTimeout(updStep, 300);
          return;
        }
        if (uu.phase === 'installing') {
          uu.pct = Math.min(100, uu.pct + 5 + Math.random() * 8);
          if (uu.pct >= 100) { uu.phase = 'ready'; uu.pct = 100; }
          renderUpd();
          if (uu.phase === 'installing') body._updTimer = setTimeout(updStep, 240);
        }
      }
      function recStep() {
        if (!body.isConnected || body.dataset.settingsPage !== 'recovery') return;
        var rr = state.recovery;
        if (rr.phase === 'downloading') {
          rr.pct = Math.min(100, rr.pct + 3 + Math.random() * 6);
          if (rr.pct >= 100) rr.phase = 'preparing';
          renderRec();
          if (rr.phase === 'downloading') body._recTimer = setTimeout(recStep, 220);
          else body._recTimer = setTimeout(function () {
            if (!body.isConnected || body.dataset.settingsPage !== 'recovery') return;
            state.recovery.phase = 'ready';
            renderRec();
          }, 1600);
          return;
        }
        if (rr.phase === 'preparing') {
          rr.phase = 'ready';
          renderRec();
        }
      }

      body.onclick = function (e) {
        var navEl = e.target.closest('.s-item');
        if (navEl) { self._renderSettings(body, navEl.dataset.nav); return; }
        var pg = e.target.closest('[data-page]');
        if (pg) { self._renderSettings(body, pg.dataset.page); return; }

        var vt = e.target.closest('[data-ver-tab]');
        if (vt) { state.verTab = vt.dataset.verTab; self._renderSettings(body, 'versions'); return; }

        var mode = e.target.closest('[data-theme-mode]');
        if (mode) {
          state.theme.mode = mode.dataset.themeMode;
          applyTheme(); savePrefs(); toast(_t('set_saved'));
          self._renderSettings(body, 'personal');
          return;
        }
        var accent = e.target.closest('[data-accent]');
        if (accent) {
          state.theme.accent = accent.dataset.accent;
          applyTheme(); savePrefs(); toast(_t('set_saved'));
          self._renderSettings(body, 'personal');
          return;
        }
        var wall = e.target.closest('[data-wall]');
        if (wall) {
          state.theme.wall = Number(wall.dataset.wall);
          applyTheme(); savePrefs(); toast(_t('set_saved'));
          self._renderSettings(body, 'personal');
          return;
        }
        var lang = e.target.closest('[data-setlang]');
        if (lang && window.__i18n) {
          window.__i18n.switch(lang.dataset.setlang);
          var wrap = lang.parentElement;
          Array.prototype.forEach.call(wrap.children, function (b) { b.classList.toggle('on', b === lang); });
          return;
        }
        var openApp = e.target.closest('[data-open-app]');
        if (openApp) { AppWindows.open(openApp.dataset.openApp, { multi: true }); return; }

        if (e.target.closest('[data-fullscreen]')) { toggleFullscreen(); return; }
        if (e.target.closest('[data-backup]')) {
          fsSave('settings.json', JSON.stringify(prefsSnapshot(), null, 2), function (ok) {
            toast(ok ? _t('set_backup_done', { path: tempPathOf('settings.json') }) : _t('np_saved_local'));
          });
          return;
        }

        var mt = e.target.closest('[data-mt]');
        if (mt) {
          if (mt.dataset.mt === 'newdesk') {
            createDesktop();
            self._renderSettings(body, 'multitask');
          } else if (mt.dataset.mt === 'tv') {
            openTaskView();
          }
          return;
        }

        var updBtn = e.target.closest('[data-upd]');
        if (updBtn) {
          clearTimeout(body._updTimer);
          var act = updBtn.dataset.upd;
          if (act === 'check') {
            state.update.phase = 'checking';
            state.update.installed = false;
            state.update.paused = 0;
            state.update.last = new Date().toLocaleString();
            renderUpd();
            body._updTimer = setTimeout(function () {
              if (!body.isConnected || body.dataset.settingsPage !== 'update') return;
              state.update.phase = 'available';
              renderUpd();
            }, 1400);
          } else if (act === 'download') {
            state.update.phase = 'downloading'; state.update.pct = 0;
            renderUpd();
            body._updTimer = setTimeout(updStep, 220);
          } else if (act === 'pause') {
            state.update.paused = Date.now() + 7 * 86400000;
            state.update.phase = 'idle';
            renderUpd();
          } else if (act === 'restart') {
            state.update.installed = true;
            state.update.phase = 'idle';
            state.update.pct = 0;
            savePrefs();
            toast(_t('toast_update_done'));
            runPower('restart');
          }
          return;
        }

        var recBtn = e.target.closest('[data-rec]');
        if (recBtn) {
          clearTimeout(body._recTimer);
          var ract = recBtn.dataset.rec;
          if (ract === 'cloud' || ract === 'local') {
            state.recovery = { phase: ract === 'cloud' ? 'downloading' : 'preparing', pct: 0, mode: ract };
            renderRec();
            body._recTimer = setTimeout(recStep, 220);
          } else if (ract === 'cancel') {
            state.recovery = { phase: 'idle', pct: 0, mode: '' };
            renderRec();
          } else if (ract === 'reboot') {
            state.recovery.phase = 'resetting';
            renderRec();
            var ps = $('#powerScreen'), txt = $('#psText'), hint = $('#psHint');
            if (ps) {
              ps.classList.add('open'); ps.classList.remove('asleep');
              if (txt) txt.textContent = _t('rec_resetting');
              if (hint) hint.textContent = '';
            }
            later(function () {
              if (ps) ps.classList.remove('open', 'asleep');
              state.update = { phase: 'idle', pct: 0, installed: false, available: true, checked: false, last: '', paused: 0 };
              state.recovery = { phase: 'idle', pct: 0, mode: '' };
              resetExperience();
              toast(_t('toast_reset_done'));
            }, 2400);
          }
          return;
        }

        if (e.target.closest('#aboutRestart')) {
          self.closeAll();
          resetExperience();
        }
      };
    },

    /* ---- 计算器（v4.0） ---- */
    _renderCalc: function (body) {
      body.className = 'calc';
      body.tabIndex = 0;
      body.innerHTML =
        '<div class="calc__disp"><div class="calc__expr" id="calcExpr"></div><div class="calc__num" id="calcNum">0</div></div>' +
        '<div class="calc__keys">' +
          '<button class="calc__k op" data-k="C">C</button>' +
          '<button class="calc__k op" data-k="back">⌫</button>' +
          '<button class="calc__k op" data-k="%">%</button>' +
          '<button class="calc__k op" data-k="/">÷</button>' +
          '<button class="calc__k" data-k="7">7</button><button class="calc__k" data-k="8">8</button>' +
          '<button class="calc__k" data-k="9">9</button><button class="calc__k op" data-k="*">×</button>' +
          '<button class="calc__k" data-k="4">4</button><button class="calc__k" data-k="5">5</button>' +
          '<button class="calc__k" data-k="6">6</button><button class="calc__k op" data-k="-">−</button>' +
          '<button class="calc__k" data-k="1">1</button><button class="calc__k" data-k="2">2</button>' +
          '<button class="calc__k" data-k="3">3</button><button class="calc__k op" data-k="+">+</button>' +
          '<button class="calc__k" data-k="sign">±</button><button class="calc__k" data-k="0">0</button>' +
          '<button class="calc__k" data-k=".">.</button><button class="calc__k eq" data-k="=">=</button>' +
        '</div>';

      var cur = '0', acc = null, op = null, fresh = true, expr = '';
      var numEl = body.querySelector('#calcNum');
      var exprEl = body.querySelector('#calcExpr');

      function fmt(n) {
        if (!isFinite(n)) return 'Error';
        var s = String(Math.round(n * 1e10) / 1e10);
        return s.length > 14 ? String(Number(n.toPrecision(10))) : s;
      }
      function calculate(a, b, o) {
        if (o === '+') return a + b;
        if (o === '-') return a - b;
        if (o === '*') return a * b;
        if (o === '/') return b === 0 ? NaN : a / b;
        return b;
      }
      function update() {
        numEl.textContent = cur;
        exprEl.textContent = expr;
      }
      function press(k) {
        if (/^[0-9]$/.test(k)) {
          if (fresh) { cur = k; fresh = false; }
          else cur = cur === '0' ? k : (cur.length < 14 ? cur + k : cur);
        } else if (k === '.') {
          if (fresh) { cur = '0.'; fresh = false; }
          else if (cur.indexOf('.') < 0) cur += '.';
        } else if (k === 'C') {
          cur = '0'; acc = null; op = null; fresh = true; expr = '';
        } else if (k === 'back') {
          if (!fresh) cur = cur.length > 1 ? cur.slice(0, -1) : '0';
          if (cur === '-') cur = '0';
        } else if (k === 'sign') {
          cur = cur.charAt(0) === '-' ? cur.slice(1) : (cur === '0' ? '0' : '-' + cur);
        } else if (k === '%') {
          cur = fmt(parseFloat(cur) / 100); fresh = true;
        } else if (k === '+' || k === '-' || k === '*' || k === '/') {
          var val = parseFloat(cur);
          if (acc !== null && op && !fresh) { acc = calculate(acc, val, op); cur = fmt(acc); }
          else acc = val;
          op = k; fresh = true;
          expr = fmt(acc) + ' ' + ({ '+': '+', '-': '−', '*': '×', '/': '÷' }[k]);
        } else if (k === '=') {
          if (op && acc !== null) {
            var v = calculate(acc, parseFloat(cur), op);
            expr = fmt(acc) + ' ' + ({ '+': '+', '-': '−', '*': '×', '/': '÷' }[op]) + ' ' + cur + ' =';
            cur = fmt(v); acc = null; op = null; fresh = true;
          }
        }
        update();
      }

      body.querySelector('.calc__keys').addEventListener('click', function (e) {
        var b = e.target.closest('[data-k]'); if (!b) return;
        press(b.dataset.k);
      });
      body.addEventListener('keydown', function (e) {
        var k = e.key;
        if (/^[0-9.]$/.test(k) || k === '+' || k === '-' || k === '*' || k === '/') { press(k); e.preventDefault(); e.stopPropagation(); }
        else if (k === 'Enter' || k === '=') { press('='); e.preventDefault(); e.stopPropagation(); }
        else if (k === 'Backspace') { press('back'); e.preventDefault(); e.stopPropagation(); }
        else if (k === 'Escape' || k === 'c' || k === 'C') { press('C'); e.preventDefault(); e.stopPropagation(); }
      });
      later(function () { try { body.focus(); } catch (e) {} }, 60);
    },

    /* ---- 记事本（v4.0） ---- */
    _renderNotepad: function (body, opts) {
      opts = opts || {};
      var fileName = opts.file || state.npFile || 'notes.txt';
      var content = typeof opts.content === 'string' ? opts.content
        : (state.tempFiles[fileName] != null ? state.tempFiles[fileName] : (state.notes || ''));
      state.npFile = fileName;

      body.className = 'np';
      body.innerHTML =
        '<div class="np__bar">' +
          '<button class="np__btn" id="npNew" data-i18n="np_new">新建</button>' +
          '<button class="np__btn" id="npSave" data-i18n="np_save">保存</button>' +
          '<button class="np__btn" id="npOpen" data-i18n="np_open">打开</button>' +
          '<input class="np__name" id="npName" data-i18n-ph="np_name_ph" placeholder="文件名" spellcheck="false">' +
        '</div>' +
        '<textarea class="np__area" id="npArea" data-i18n-ph="np_placeholder" placeholder="在此输入内容…" spellcheck="false"></textarea>' +
        '<div class="np__status">' +
          '<span id="npChars"></span><span id="npLines"></span><span class="np__path" id="npPath"></span>' +
        '</div>';

      var area = body.querySelector('#npArea');
      var chars = body.querySelector('#npChars');
      var lines = body.querySelector('#npLines');
      var nameEl = body.querySelector('#npName');
      var pathEl = body.querySelector('#npPath');
      area.value = content || '';
      nameEl.value = fileName;

      function stat() {
        var v = area.value;
        chars.textContent = v.length + ' ' + _t('np_chars');
        lines.textContent = (v ? v.split('\n').length : 0) + ' ' + _t('np_lines');
        pathEl.textContent = tempPathOf(nameEl.value || state.npFile);
        pathEl.title = pathEl.textContent;
      }
      function cleanName() {
        var nm = (nameEl.value || '').trim().replace(/[\\/:*?"<>|]/g, '_');
        if (!nm) nm = 'notes.txt';
        if (!/\.[A-Za-z0-9]{1,6}$/.test(nm)) nm += '.txt';
        nameEl.value = nm;
        return nm;
      }
      function save() {
        var nm = cleanName();
        state.npFile = nm;
        state.notes = area.value;
        stat();
        toast(_t('np_saving'));
        fsSave(nm, area.value, function (ok) {
          toast(ok ? _t('np_saved_temp', { path: tempPathOf(nm) }) : _t('np_saved_local'));
        });
      }
      function openPicker() {
        var names = Object.keys(state.tempFiles).filter(function (n) { return n !== 'settings.json'; }).sort();
        if (!names.length) { toast(_t('np_no_files')); return; }
        var list = names.map(function (n) {
          var safe = String(n).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
          });
          return '<button class="np-file" data-openfile="' + safe + '">' +
            '<svg viewBox="0 0 16 16" fill="none"><path d="M3.5 1.8h5.2l3 3v9.4H3.5V1.8Z" stroke="currentColor" stroke-width="1.2"/><path d="M5.6 7h4.4M5.6 9.3h4.4M5.6 11.6h2.8" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>' +
            safe + '</button>';
        }).join('');
        openModal({
          title: _t('np_open_title'),
          body: '<div class="np-files">' + list + '</div>',
          cancel: null,
          after: function () {
            $$('#mBody [data-openfile]').forEach(function (btn) {
              btn.addEventListener('click', function () {
                var nm = btn.dataset.openfile;
                fsLoad(nm, function (txt) {
                  area.value = txt;
                  state.notes = txt;
                  state.npFile = nm;
                  nameEl.value = nm;
                  stat();
                  closeModal();
                  toast(_t('np_loaded', { name: nm }));
                });
              });
            });
          }
        });
      }

      var notesTimer = 0;
      function autosave() {
        clearTimeout(notesTimer);
        notesTimer = setTimeout(function () { savePrefs(); }, 700);
      }
      area.addEventListener('input', function () { state.notes = area.value; stat(); autosave(); });
      area.addEventListener('blur', function () { savePrefs(); });
      nameEl.addEventListener('change', stat);
      nameEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); save(); }
      });
      body.querySelector('#npSave').addEventListener('click', save);
      body.querySelector('#npOpen').addEventListener('click', openPicker);
      body.querySelector('#npNew').addEventListener('click', function () {
        area.value = ''; state.notes = ''; savePrefs(); stat(); toast(_t('np_cleared')); area.focus();
      });
      stat();
      later(function () { try { area.focus(); } catch (e) {} }, 80);
    },

    /* ---- 照片（v4.0） ---- */
    _renderPhotos: function (body) {
      body.className = 'photos';
      var total = 3;
      if (!state.photoIndex || state.photoIndex < 1 || state.photoIndex > total) state.photoIndex = 1;
      body.innerHTML =
        '<div class="photos__stage">' +
          '<div class="ph-art" id="phArt" data-art="1"></div>' +
          '<div class="photos__cap" id="phCap"></div>' +
        '</div>' +
        '<div class="photos__bar">' +
          '<button class="photos__btn" id="phPrev" data-i18n="ph_prev">上一张</button>' +
          '<span class="photos__idx" id="phIdx"></span>' +
          '<button class="photos__btn" id="phNext" data-i18n="ph_next">下一张</button>' +
        '</div>';

      function show() {
        body.querySelector('#phArt').dataset.art = String(state.photoIndex);
        body.querySelector('#phCap').textContent = _t('ph_caption_' + state.photoIndex);
        body.querySelector('#phIdx').textContent = state.photoIndex + ' / ' + total;
      }
      body.querySelector('#phPrev').addEventListener('click', function () {
        state.photoIndex = state.photoIndex > 1 ? state.photoIndex - 1 : total; show();
      });
      body.querySelector('#phNext').addEventListener('click', function () {
        state.photoIndex = state.photoIndex < total ? state.photoIndex + 1 : 1; show();
      });
      show();
    },

    /* ---- Microsoft Store（v4.0） ---- */
    _renderStore: function (body) {
      var apps = [
        ['store_app_1', '#2b88d8', 'Photos'],
        ['store_app_2', '#4c9a2a', 'Calc'],
        ['store_app_3', '#5c2d91', 'NP'],
        ['store_app_4', '#c42b1c', 'MP'],
        ['store_app_5', '#3a6ea5', 'W'],
        ['store_app_6', '#8a5600', 'M']
      ];
      body.className = 'store';
      body.innerHTML =
        '<div class="store__hero"><b>Microsoft Store</b><span data-i18n="store_sub">精选应用、游戏和设备</span></div>' +
        '<div class="store__hd" data-i18n="store_featured">精选应用</div>' +
        '<div class="store__grid">' + apps.map(function (a, i) {
          var done = !!state.storeInstalled[a[2]];
          return '<div class="store__card"><div class="store__app">' +
            '<span class="store__ico" style="background:' + a[1] + '">' + a[2] + '</span>' +
            '<span class="store__name">' + _t(a[0]) + '</span></div>' +
            '<button class="store__get' + (done ? ' done' : '') + '" data-store="' + a[2] + '">' +
            (done ? _t('store_installed') : _t('store_get')) + '</button></div>';
        }).join('') + '</div>';

      body.querySelector('.store__grid').addEventListener('click', function (e) {
        var b = e.target.closest('[data-store]'); if (!b || b.classList.contains('done')) return;
        state.storeInstalled[b.dataset.store] = true;
        b.classList.add('done');
        b.textContent = _t('store_installed');
        var card = b.closest('.store__card');
        var name = card ? card.querySelector('.store__name').textContent : b.dataset.store;
        toast(_t('store_install_done', { name: name }));
      });
    },

    /* ---- 画图（v6.0） ---- */
    _renderPaint: function (body) {
      var colors = ['#1b2430', '#0067c0', '#c42b1c', '#0f7b3f', '#f5c04a', '#8b5cf6'];
      body.className = 'paint';
      body.innerHTML =
        '<div class="paint__bar">' +
          '<button data-paint="brush" class="' + (state.paint.tool !== 'eraser' ? 'on' : '') + '">' + _t('paint_brush') + '</button>' +
          '<button data-paint="eraser" class="' + (state.paint.tool === 'eraser' ? 'on' : '') + '">' + _t('paint_eraser') + '</button>' +
          '<div class="paint__colors">' + colors.map(function (c) {
            return '<button class="paint__sw' + (state.paint.color === c ? ' on' : '') + '" data-color="' + c + '" style="background:' + c + '"></button>';
          }).join('') + '</div>' +
          '<label class="paint__size">' + _t('paint_size') + '<input type="range" id="paintSize" min="1" max="30" value="' + state.paint.size + '"></label>' +
          '<span class="grow"></span>' +
          '<button data-paint="clear">' + _t('paint_clear') + '</button>' +
          '<button data-paint="save">' + _t('paint_save') + '</button>' +
        '</div>' +
        '<div class="paint__stage"><canvas id="paintCanvas" width="760" height="460"></canvas></div>';

      var canvas = body.querySelector('#paintCanvas');
      var ctx = canvas.getContext('2d');
      function clearCanvas() { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      clearCanvas();

      var drawing = false, last = null;
      function pos(e) {
        var r = canvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
      }
      function stroke(a, b) {
        ctx.strokeStyle = state.paint.tool === 'eraser' ? '#fff' : state.paint.color;
        ctx.lineWidth = state.paint.size;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      canvas.addEventListener('pointerdown', function (e) {
        drawing = true; last = pos(e);
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
        e.preventDefault();
      });
      canvas.addEventListener('pointermove', function (e) {
        if (!drawing) return;
        var p = pos(e); stroke(last, p); last = p;
      });
      canvas.addEventListener('pointerup', function () { drawing = false; });
      canvas.addEventListener('pointerleave', function () { drawing = false; });

      body.querySelector('.paint__bar').addEventListener('click', function (e) {
        var tool = e.target.closest('[data-paint]');
        if (tool) {
          var act = tool.dataset.paint;
          if (act === 'brush' || act === 'eraser') {
            state.paint.tool = act;
            body.querySelectorAll('[data-paint="brush"],[data-paint="eraser"]').forEach(function (b) {
              b.classList.toggle('on', b.dataset.paint === act);
            });
          } else if (act === 'clear') {
            clearCanvas();
          } else if (act === 'save') {
            try {
              var a = document.createElement('a');
              a.href = canvas.toDataURL('image/png');
              a.download = 'paint-' + Date.now() + '.png';
              document.body.appendChild(a); a.click(); a.remove();
            } catch (err) { /* 忽略 */ }
            toast(_t('paint_saved'));
          }
          return;
        }
        var sw = e.target.closest('[data-color]');
        if (sw) {
          state.paint.color = sw.dataset.color;
          state.paint.tool = 'brush';
          body.querySelectorAll('.paint__sw').forEach(function (b) { b.classList.toggle('on', b.dataset.color === state.paint.color); });
          body.querySelectorAll('[data-paint="brush"],[data-paint="eraser"]').forEach(function (b) {
            b.classList.toggle('on', b.dataset.paint === 'brush');
          });
        }
      });
      body.querySelector('#paintSize').addEventListener('input', function () { state.paint.size = Number(this.value); });
    },

    /* ---- 时钟：秒表与计时器（v6.0） ---- */
    _renderClock: function (body) {
      body.className = 'clock-app';
      var st = state.clock || (state.clock = { tab: 'stopwatch' });
      var swElapsed = 0, swStart = 0, swRunning = false;
      var tmLeftMs = 5 * 60000, tmRunning = false, tmEnd = 0, tmMinutes = 5;

      body.innerHTML =
        '<div class="clock__tabs">' +
          '<button data-clk-tab="stopwatch" class="' + (st.tab !== 'timer' ? 'on' : '') + '">' + _t('clock_stopwatch') + '</button>' +
          '<button data-clk-tab="timer" class="' + (st.tab === 'timer' ? 'on' : '') + '">' + _t('clock_timer') + '</button>' +
        '</div>' +
        '<div class="clock__body" id="clkBody"></div>';

      function fmtSw(ms) {
        var total = ms / 1000;
        var m = Math.floor(total / 60), s = total - m * 60;
        return String(m).padStart(2, '0') + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
      }
      function fmtTm(ms) {
        var total = Math.max(0, Math.round(ms / 1000));
        var m = Math.floor(total / 60), s = total % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      }
      function render() {
        var host = body.querySelector('#clkBody'); if (!host) return;
        if (st.tab === 'timer') {
          var deg = Math.max(0, Math.min(360, (1 - tmLeftMs / Math.max(1000, tmMinutes * 60000)) * 360));
          host.innerHTML =
            '<div class="clock__ring" id="clkRing" style="background:conic-gradient(var(--accent) ' + deg + 'deg, rgba(0,0,0,.06) 0)">' +
              '<div id="clkRingText">' + fmtTm(tmLeftMs) + '</div></div>' +
            '<div class="clock__mins">' +
              '<input id="clkMin" type="number" min="1" max="99" value="' + tmMinutes + '">' + _t('clock_minutes') +
            '</div>' +
            '<div class="clock__actions">' +
              '<button class="primary" data-clk="tm-toggle">' + (tmRunning ? _t('clock_pause') : _t('clock_start')) + '</button>' +
              '<button data-clk="tm-reset">' + _t('clock_reset') + '</button>' +
            '</div>';
          var minEl = host.querySelector('#clkMin');
          if (minEl) minEl.addEventListener('change', function () {
            tmMinutes = Math.max(1, Math.min(99, Number(this.value) || 5));
            this.value = String(tmMinutes);
            if (!tmRunning) { tmLeftMs = tmMinutes * 60000; render(); }
          });
        } else {
          host.innerHTML =
            '<div class="clock__time" id="clkSw">' + fmtSw(swElapsed + (swRunning ? Date.now() - swStart : 0)) + '</div>' +
            '<div class="clock__sub">' + _t('clock_stopwatch') + '</div>' +
            '<div class="clock__actions">' +
              '<button class="primary" data-clk="sw-toggle">' + (swRunning ? _t('clock_pause') : _t('clock_start')) + '</button>' +
              '<button data-clk="sw-reset">' + _t('clock_reset') + '</button>' +
            '</div>';
        }
      }
      body.addEventListener('click', function (e) {
        var tabBtn = e.target.closest('[data-clk-tab]');
        if (tabBtn) {
          st.tab = tabBtn.dataset.clkTab;
          body.querySelectorAll('[data-clk-tab]').forEach(function (b) {
            b.classList.toggle('on', b.dataset.clkTab === st.tab);
          });
          render();
          return;
        }
        var b = e.target.closest('[data-clk]'); if (!b) return;
        var act = b.dataset.clk;
        if (act === 'sw-toggle') {
          if (swRunning) { swElapsed += Date.now() - swStart; swRunning = false; }
          else { swStart = Date.now(); swRunning = true; }
          render();
        } else if (act === 'sw-reset') {
          swElapsed = 0; swRunning = false; swStart = 0; render();
        } else if (act === 'tm-toggle') {
          if (tmRunning) { tmLeftMs = Math.max(0, tmEnd - Date.now()); tmRunning = false; }
          else { tmEnd = Date.now() + tmLeftMs; tmRunning = true; }
          render();
        } else if (act === 'tm-reset') {
          tmRunning = false; tmLeftMs = tmMinutes * 60000; render();
        }
      });
      var tick = setInterval(function () {
        if (!body.isConnected) { clearInterval(tick); return; }
        if (st.tab === 'timer') {
          if (!tmRunning) return;
          tmLeftMs = Math.max(0, tmEnd - Date.now());
          var ring = body.querySelector('#clkRing'), txt = body.querySelector('#clkRingText');
          if (ring) {
            var deg = Math.max(0, Math.min(360, (1 - tmLeftMs / Math.max(1000, tmMinutes * 60000)) * 360));
            ring.style.background = 'conic-gradient(var(--accent) ' + deg + 'deg, rgba(0,0,0,.06) 0)';
          }
          if (txt) txt.textContent = fmtTm(tmLeftMs);
          if (tmLeftMs <= 0) {
            tmRunning = false;
            toast(_t('clock_done'));
            render();
          }
        } else if (swRunning) {
          var el = body.querySelector('#clkSw');
          if (el) el.textContent = fmtSw(swElapsed + (Date.now() - swStart));
        }
      }, 100);
      render();
    },

    /* ---- 媒体播放器（v6.0） ---- */
    _renderMedia: function (body) {
      var tracks = [
        { title: 'Aurora', artist: 'Windows Sounds', dur: 208 },
        { title: 'Bloom', artist: 'Fluent Studio', dur: 186 },
        { title: 'Midnight Drive', artist: 'Redmond Beats', dur: 231 }
      ];
      var p = state.player;
      if (p.index >= tracks.length) p.index = 0;
      var bars = '';
      for (var bi = 0; bi < 9; bi++) bars += '<i></i>';

      body.className = 'media';
      body.innerHTML =
        '<div class="media__main">' +
          '<div class="media__cover"><span>♪</span></div>' +
          '<div class="media__title" id="mdTitle"></div>' +
          '<div class="media__artist" id="mdArtist"></div>' +
          '<div class="media__viz" id="mdViz">' + bars + '</div>' +
          '<div class="media__progress"><span id="mdCur">0:00</span>' +
            '<div class="media__track"><i id="mdBar"></i></div><span id="mdDur">0:00</span></div>' +
          '<div class="media__controls">' +
            '<button data-md="prev" title="' + _t('media_prev') + '">⏮</button>' +
            '<button class="play" data-md="play" id="mdPlay" title="' + _t('media_play') + '">▶</button>' +
            '<button data-md="next" title="' + _t('media_next') + '">⏭</button>' +
          '</div>' +
        '</div>' +
        '<div class="media__playlist"><div class="media__pl-hd">' + _t('media_tracks') + '</div>' +
          tracks.map(function (t, i) {
            return '<div class="media__item" data-track="' + i + '"><span>' + t.title + ' · ' + t.artist + '</span><em>' + fmt(t.dur) + '</em></div>';
          }).join('') +
        '</div>';

      function fmt(sec) {
        var s = Math.max(0, Math.round(sec));
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      }
      function render() {
        var tr = tracks[p.index];
        var titleEl = body.querySelector('#mdTitle');
        if (!titleEl) return;
        titleEl.textContent = tr.title;
        body.querySelector('#mdArtist').textContent = tr.artist;
        body.querySelector('#mdDur').textContent = fmt(tr.dur);
        body.querySelector('#mdCur').textContent = fmt(tr.dur * p.pct / 100);
        body.querySelector('#mdBar').style.width = Math.min(100, p.pct) + '%';
        var playBtn = body.querySelector('#mdPlay');
        if (playBtn) {
          playBtn.textContent = p.playing ? '❚❚' : '▶';
          playBtn.title = p.playing ? _t('media_pause') : _t('media_play');
        }
        var viz = body.querySelector('#mdViz');
        if (viz) viz.classList.toggle('play', p.playing);
        body.querySelectorAll('.media__item').forEach(function (it, i) {
          it.classList.toggle('on', i === p.index);
        });
      }
      body.addEventListener('click', function (e) {
        var b = e.target.closest('[data-md]');
        if (b) {
          var act = b.dataset.md;
          if (act === 'play') p.playing = !p.playing;
          else if (act === 'next') { p.index = (p.index + 1) % tracks.length; p.pct = 0; p.playing = true; }
          else if (act === 'prev') { p.index = (p.index + tracks.length - 1) % tracks.length; p.pct = 0; p.playing = true; }
          render();
          return;
        }
        var it = e.target.closest('[data-track]');
        if (it) { p.index = Number(it.dataset.track); p.pct = 0; p.playing = true; render(); }
      });
      var tick = setInterval(function () {
        if (!body.isConnected) { clearInterval(tick); return; }
        if (!p.playing) return;
        p.pct += 0.4;
        if (p.pct >= 100) { p.pct = 0; p.index = (p.index + 1) % tracks.length; }
        render();
      }, 300);
      render();
    },

    _renderSetupUpgrade: function (body, win) {
      var self = this;
      body.className = 'upg';
      body.innerHTML =
        '<h3>' + _t('upg_title') + '</h3>' +
        '<p>' + _t('upg_sub') + '</p>' +
        '<div class="upg-opts">' +
          '<div class="upg-opt" data-upg="keep">' +
            '<div class="uo-ico"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7.5L8 11l3-3.5M2.5 13.5h11" stroke="#0067c0" stroke-width="1.5" stroke-linecap="round"/></svg></div>' +
            '<div><div class="uo-t">' + _t('upg_keep') + '</div><div class="uo-d">' + _t('upg_keep_d') + '</div></div>' +
          '</div>' +
          '<div class="upg-opt" data-upg="custom">' +
            '<div class="uo-ico"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#0067c0" stroke-width="1.5"/><path d="M8 5v6M5 8h6" stroke="#0067c0" stroke-width="1.5" stroke-linecap="round"/></svg></div>' +
            '<div><div class="uo-t">' + _t('upg_custom') + '</div><div class="uo-d">' + _t('upg_custom_d') + '</div></div>' +
          '</div>' +
        '</div>' +
        '<p class="upg-note">' + _t('upg_note') + '</p>';

      body.onclick = function (e) {
        var opt = e.target.closest('.upg-opt'); if (!opt) return;
        if (opt.dataset.upg === 'custom') {
          self.close(win.dataset.id);
          resetExperience();
          return;
        }
        runUpgrade(body);
      };
    },
  };

  window.__appWindows = AppWindows;

  /* v3.0：桌面上的"升级安装"流程（保留文件、设置和应用） */
  function runUpgrade(body) {
    var stages = [['upg_stage_1', 0], ['upg_stage_2', 30], ['upg_stage_3', 68]];
    body.className = 'upg-progress';
    body.innerHTML =
      '<div class="ring"></div>' +
      '<div class="upg-pct"><span id="upgPct">0</span><em>%</em></div>' +
      '<div class="upg-stage" id="upgStage">' + _t(stages[0][0]) + '</div>' +
      '<div class="upg-bar"><i id="upgBar"></i></div>' +
      '<div class="upg-note">' + _t('upg_note') + '</div>';

    var pct = 0;
    var timer = setInterval(function () {
      if (!document.body.contains(body)) { clearInterval(timer); return; }
      pct = Math.min(100, pct + 1.5 + Math.random() * 2.5);
      var p = document.getElementById('upgPct');
      var bar = document.getElementById('upgBar');
      var st = document.getElementById('upgStage');
      if (!p || !bar) { clearInterval(timer); return; }
      p.textContent = String(Math.round(pct));
      bar.style.width = pct + '%';
      var idx = 0;
      for (var i = stages.length - 1; i >= 0; i--) { if (pct >= stages[i][1]) { idx = i; break; } }
      var txt = _t(stages[idx][0]);
      if (st && st.textContent !== txt) st.textContent = txt;
      if (pct >= 100) {
        clearInterval(timer);
        toast(_t('upg_done'));
        var w = body.closest('.app-window');
        later(function () { if (w) AppWindows.close(w.dataset.id); }, 1400);
      }
    }, 160);
  }

  /* ============================================================
   * 磁盘
   * ============================================================ */
  function initDisk() {
    state.disk = [
      { id: 'p1', nameKey: 'disk_name_recover', total: 0.5, free: 0, kind: 'recover' },
      { id: 'p2', nameKey: 'disk_name_efi', total: 0.1, free: 0, kind: 'system' },
      { id: 'p3', nameKey: 'disk_name_msr', total: 0.016, free: 0, kind: 'reserved' },
      { id: 'p4', nameKey: 'disk_name_primary', total: 29.0, free: 12.4, kind: 'primary' },
      { id: 'u1', nameKey: 'disk_name_unalloc', total: 34.4, free: 34.4, kind: 'unallocated', unallocated: true }
    ];
    state.selected = null;
  }
  function diskName(p) { return p.nameKey ? _t(p.nameKey) : (p.name || ''); }
  function diskType(p) { return p.kind && p.kind !== 'unallocated' ? _t('disk_type_' + p.kind) : ''; }
  function fmtSize(gb) { if (!gb || gb < 0.05) return '0 B'; return gb.toFixed(1) + ' GB'; }
  function renderDisk() {
    var rows = $('#diskRows'); if (!rows) return;
    rows.innerHTML = state.disk.map(function (p, i) {
      var cls = 'disk-row' + (state.selected === p.id ? ' sel' : '');
      var main = p.unallocated ? _t('disk_drive_unalloc') : _t('disk_drive_part', { n: i + 1 });
      var sub = p.unallocated ? '' : '<em>' + diskName(p) + '</em>';
      return '<div class="' + cls + '" data-id="' + p.id + '">' +
        '<div class="disk-name"><span>' + main + '</span>' + sub + '</div>' +
        '<div>' + fmtSize(p.total) + '</div>' +
        '<div>' + fmtSize(p.free) + '</div>' +
        '<div>' + diskType(p) + '</div></div>';
    }).join('');
    var next = $('#diskNext'), info = $('#diskInfo');
    var p = state.disk.filter(function (x) { return x.id === state.selected; })[0];
    var ok = !!p && p.kind === 'primary';
    if (next) next.disabled = !ok;
    if (info) {
      if (!p) info.textContent = _t('disk_info_none');
      else if (p.unallocated) info.textContent = _t('disk_info_unalloc');
      else info.textContent = _t('disk_info_selected', { name: diskName(p), size: fmtSize(p.total), type: diskType(p) });
    }
  }
  function selectPartition(id) { state.selected = id; renderDisk(); }
  function addUnallocated(gb) {
    if (gb <= 0.05) return;
    var exist = state.disk.filter(function (x) { return x.unallocated; })[0];
    if (exist) { exist.total += gb; exist.free += gb; }
    else state.disk.push({ id: 'u' + Date.now(), nameKey: 'disk_name_unalloc', total: gb, free: gb, kind: 'unallocated', unallocated: true });
  }
  function removePartition(id) {
    var idx = -1;
    for (var i = 0; i < state.disk.length; i++) if (state.disk[i].id === id) idx = i;
    if (idx < 0) return;
    var p = state.disk[idx]; if (p.unallocated) return;
    state.disk.splice(idx, 1);
    addUnallocated(p.total);
    if (state.selected === id) state.selected = null;
    renderDisk();
  }
  function doNewPartition(sizeMB) {
    var un = state.disk.filter(function (x) { return x.unallocated; })[0]; if (!un) return;
    var hasSys = state.disk.some(function (x) { return x.kind === 'system'; });
    var sizeGB = Math.min(sizeMB / 1024, un.total);
    var base = 'n' + Date.now(); var added = []; var overhead = 0;
    if (!hasSys) {
      added.push({ id: base + 'a', nameKey: 'disk_name_recover', total: 0.5, free: 0, kind: 'recover' });
      added.push({ id: base + 'b', nameKey: 'disk_name_efi', total: 0.1, free: 0, kind: 'system' });
      added.push({ id: base + 'c', nameKey: 'disk_name_msr', total: 0.016, free: 0, kind: 'reserved' });
      overhead = 0.616;
    }
    var mainSize = Math.max(1, sizeGB - overhead);
    var main = { id: base + 'd', nameKey: 'disk_name_primary', total: mainSize, free: mainSize, kind: 'primary' };
    added.push(main);
    var idx = state.disk.indexOf(un);
    state.disk.splice(idx, 1);
    state.disk.splice.apply(state.disk, [idx, 0].concat(added));
    addUnallocated(un.total - sizeGB);
    state.selected = main.id;
    renderDisk();
    toast(_t('toast_created_primary', { size: fmtSize(mainSize) }));
  }

  /* ============================================================
   * 安装 / 重启（v7.0：13 阶段 + 速度/时间 + 暂停/继续/取消）
   * ============================================================ */
  var INST_STAGES_KEYS = [
    'inst_stage_prep', 'inst_stage_phase1', 'inst_stage_phase2',
    'inst_stage_phase3', 'inst_stage_phase4', 'inst_stage_phase5',
    'inst_stage_phase6', 'inst_stage_phase7',
    'inst_stage_oobe1', 'inst_stage_oobe2', 'inst_stage_oobe3',
    'inst_stage_oobe4', 'inst_stage_oobe5', 'inst_stage_done'
  ];
  var INST_STAGES_PCT = [0, 4, 12, 28, 42, 52, 60, 68, 74, 82, 88, 94, 98, 100];
  var INST_ERRORS = [
    { code: '0x80300001', n: 'err_0x80300001_n', d: 'err_0x80300001_d' },
    { code: '0x80070057', n: 'err_0x80070057_n', d: 'err_0x80070057_d' },
    { code: '0x8007025d', n: 'err_0x8007025d_n', d: 'err_0x8007025d_d' },
    { code: '0x80004005', n: 'err_0x80004005_n', d: 'err_0x80004005_d' },
    { code: '0xC1900101', n: 'err_0xC1900101_n', d: 'err_0xC1900101_d' },
  ];
  var INST_SPEEDS = ['12 MB/s', '18 MB/s', '24 MB/s', '30 MB/s', '15 MB/s', '9 MB/s', '22 MB/s'];

  function startInstall() {
    var p = null;
    for (var i = 0; i < state.disk.length; i++) if (state.disk[i].id === state.selected) p = state.disk[i];
    var instTargetName = p ? (diskName(p) + '（' + fmtSize(p.total) + '）') : _t('inst_target_primary');
    $('#instTarget').textContent = instTargetName;

    // v8.0：按安装速度档位决定时长
    var DUR_MAP = { standard: 60000, fast: 20000, demo: 8000 };
    var dur = DUR_MAP[state.v8.speed] || 60000;
    var bar = $('#instBar'), pct = $('#instPct'), stage = $('#instStage');
    state.installStart = performance.now();
    state.installPaused = false; state.installPauseOffset = 0;
    state.installFrozen = 0;
    state.v8.instStartAt = Date.now();
    state.v8.instEndAt = 0;
    // v8.1：标题栏实时显示安装进度
    state._origTitle = document.title;
    // v8.0：重置并开始记录安装日志
    state.v8.log = []; state.v8.logSeq = 0;
    v8Log('Windows Setup 8.1 — build 26100.1742');
    v8Log('Install type: custom (clean install)');
    v8Log('Target: ' + instTargetName);
    v8Log('Simulation speed: ' + state.v8.speed);
    bar.style.width = '0%'; pct.textContent = '0';
    stage.textContent = _t('inst_stage_prep');

    // v7.0：增加安装信息栏 + 暂停/继续/取消按钮（如果存在）
    var infoBar = $('#instInfoBar');
    if (infoBar) infoBar.style.display = '';
    var pauseBtn = $('#instPause'), cancelBtn = $('#instCancel');
    if (pauseBtn) { pauseBtn.disabled = false; pauseBtn.textContent = _t('inst_pause'); }
    if (cancelBtn) cancelBtn.disabled = false;

    var pausedFrom = 0;
    if (pauseBtn) pauseBtn.onclick = function () {
      state.installPaused = !state.installPaused;
      if (state.installPaused) { pausedFrom = performance.now(); pauseBtn.textContent = _t('inst_resume'); }
      else { state.installPauseOffset += performance.now() - pausedFrom; pauseBtn.textContent = _t('inst_pause'); }
    };
    if (cancelBtn) cancelBtn.onclick = function () {
      $('#mTitle').textContent = _t('inst_cancel');
      $('#mBody').innerHTML = '<p>' + _t('inst_cancel_conf') + '</p>';
      $('#mOk').textContent = _t('inst_cancel'); $('#mCancel').style.display = ''; $('#mCancel').textContent = _t('modal_default_cancel');
      okHandler = function () { clearTimers(); $('#instCancel').disabled = true; $('#instPause').disabled = true; go('disk'); return true; };
      modalOpen = true; $('#modal').classList.add('open');
    };

    // v8.0：约 8% 概率触发错误（演示模式不触发，避免打断演示）
    var willError = state.v8.speed !== 'demo' && Math.random() < 0.08;
    var errorAt = 0.4 + Math.random() * 0.4;
    var speedIdx = 0;

    function fmtTime(ms) {
      var s = Math.max(0, Math.round(ms / 1000));
      return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }

    function frame(now) {
      if (state.installPaused) { state._raf = requestAnimationFrame(frame); return; }
      var elapsed = now - state.installStart - state.installPauseOffset;
      var t = Math.min(1, elapsed / dur);
      var v = Math.round((1 - Math.pow(1 - t, 1.7)) * 100);
      bar.style.width = v + '%'; pct.textContent = String(v);
      document.title = v + '% · ' + (state._origTitle || 'Windows 11 安装程序');

      var idx = 0;
      for (var j = INST_STAGES_PCT.length - 1; j >= 0; j--) { if (v >= INST_STAGES_PCT[j]) { idx = j; break; } }
      var stageText = _t(INST_STAGES_KEYS[idx]);
      if (stage.textContent !== stageText) { stage.textContent = stageText; v8Log(stageText + ' (' + v + '%)'); }

      // v7.0：速度、已用、剩余时间
      if (v % 8 === 0) speedIdx = Math.floor(Math.random() * INST_SPEEDS.length);
      $('#instSpeed').textContent = INST_SPEEDS[speedIdx];
      $('#instUsed').textContent = fmtTime(elapsed);
      var remain = (dur - elapsed) * (1 - v / 100);
      $('#instRemain').textContent = fmtTime(remain);

      // v11.0：故障注入 → 蓝屏（安装到 47% 时触发一次）
      if (state.v11 && state.v11.inject && !state.v11.bsodShown && v >= 47) {
        state.v11.bsodShown = true;
        v8Log('FATAL: CRITICAL_PROCESS_DIED at ' + v + '% (injected)', 'err');
        clearTimers();
        state._raf = 0;
        document.title = state._origTitle || document.title;
        setTimeout(function () { go('bsod'); }, 500);
        return;
      }

      // v7.0：模拟错误（小概率）
      if (willError && t > errorAt && v > 15) {
        var err = INST_ERRORS[Math.floor(Math.random() * INST_ERRORS.length)];
        state._lastError = err;
        v8Log('FATAL: installation failed with error ' + err.code, 'err');
        v8Log('See CBS.log / setupact.log for details', 'warn');
        document.title = state._origTitle || document.title;
        clearTimers();
        setTimeout(function () { go('installerr'); }, 600);
        return;
      }

      if (t < 1) { state._raf = requestAnimationFrame(frame); }
      else {
        bar.style.width = '100%'; pct.textContent = '100';
        stage.textContent = _t('inst_stage_done');
        $('#instRemain').textContent = '00:00';
        state._raf = 0;
        state.v8.instEndAt = Date.now();
        v8Log('Installation completed successfully');
        v8Log('Image applied on ' + instTargetName + ' — rebooting');
        document.title = state._origTitle || document.title;
        if (pauseBtn) pauseBtn.disabled = true;
        if (cancelBtn) cancelBtn.disabled = true;
        later(function () { go('restart'); }, 1800);
      }
    }
    state._raf = requestAnimationFrame(frame);
  }

  // v7.0：安装错误页渲染
  function renderInstallError() {
    var err = state._lastError || INST_ERRORS[Math.floor(Math.random() * INST_ERRORS.length)];
    $('#errCode').textContent = err.code;
    $('#errTitle').textContent = _t(err.n);
    $('#errDesc').textContent = _t(err.d);
  }

  function startRestart() {
    var n = 10;
    var c = $('#restartCount'), num = $('#restartNum');
    c.textContent = String(n); num.textContent = String(n);
    _apply(); c.textContent = String(n); num.textContent = String(n);
    function tick() {
      n--; var val = String(Math.max(n, 0));
      c.textContent = val; num.textContent = val;
      if (n <= 0) go('prepare1');
      else later(tick, 1000);
    }
    later(tick, 1000);
  }

  /* ============================================================
   * 桌面
   * ============================================================ */
  function startClock() {
    function upd() {
      var d = new Date();
      var pad = function (v) { return String(v).length < 2 ? '0' + v : String(v); };
      var hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
      var ds = d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate());
      var ct = $('#clockTime'), cd = $('#clockDate');
      if (ct) ct.textContent = hm;
      if (cd) cd.textContent = ds;
      var lt = $('#lockTime'), ld = $('#lockDate');
      if (lt) lt.textContent = hm;
      if (ld) {
        try { ld.textContent = new Intl.DateTimeFormat(document.documentElement.lang || 'zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(d); }
        catch (e) { ld.textContent = ds; }
      }
    }
    upd(); state._clockTimer = setInterval(upd, 1000);
  }
  function enterDesktop() {
    var name = state.userName || 'Administrator';
    $('#smUser').textContent = name;
    $('#smAvatar').textContent = name.charAt(0).toUpperCase();
    var lk = $('#lockUser'), la = $('#lockAvatar');
    if (lk) lk.textContent = name;
    if (la) la.textContent = name.charAt(0).toUpperCase();
    var lu = $('#lsUser'), lsa = $('#lsAvatar');
    if (lu) lu.textContent = name;
    if (lsa) lsa.textContent = name.charAt(0).toUpperCase();
    startClock();
    _apply();
    applyTheme();
    buildAllApps();
    renderCalendar(calYear, calMonth);
    renderWidgetsCalendar();
    syncQuickPanel();
    fsList(function () { /* Temp 目录文件在资源管理器中按需刷新 */ });
    var wt = $('#welcomeToast');
    if (wt) wt.classList.add('show');
    later(function () { if (wt) wt.classList.remove('show'); }, 9000);
    updateVersionBadge();
  }

  function resetExperience() {
    AppWindows.closeAll();
    initDisk(); renderDisk();
    state.edition = ''; state.selected = null; state.userName = 'Administrator'; state.deviceName = 'DESKTOP-7F3K9Q'; state.account = 'personal';
    state.update = { phase: 'idle', pct: 0, installed: false, available: true, checked: false, last: '', paused: 0 };
    state.recovery = { phase: 'idle', pct: 0, mode: '' };
    $('#keyInput').value = ''; $('#keyNext').disabled = true;
    $('#editionNext').disabled = true; $('#licenseCheck').checked = false; $('#licenseNext').disabled = true;
    $('#typeNext').disabled = true;
    $$('#typeList .opt').forEach(function (o) { o.classList.remove('sel'); });
    $$('#editionList .opt').forEach(function (o) { o.classList.remove('sel'); });
    $$('#accList .opt').forEach(function (o) { o.classList.remove('sel'); });
    $('#accNext').disabled = true;
    $('#startSearch').value = ''; toggleAllApps(false); filterStartApps();
    closeQuick(); closeNotif(); closeStart();
    var cm = $('#ctxMenu'); if (cm) cm.classList.remove('open');
    var pm = $('#powerMenu'); if (pm) pm.classList.remove('open');
    var ps = $('#powerScreen'); if (ps) ps.classList.remove('open', 'asleep');
    var lk = $('#lockScreen'); if (lk) lk.classList.remove('open', 'stage-signin');
    // v6.0：重置多桌面、贴靠、搜索、小组件与新应用状态
    var tvEl = $('#taskView'); if (tvEl) tvEl.classList.remove('open');
    var soEl = $('#searchOverlay'); if (soEl) soEl.classList.remove('open');
    var spEl = $('#snapPicker'); if (spEl) spEl.classList.remove('open');
    var wpEl = $('#widgetsPanel'); if (wpEl) wpEl.classList.remove('open');
    var atEl = $('#altTab'); if (atEl) atEl.classList.remove('open');
    altOpen = false;
    state.desktops = [{ id: 1, name: '' }]; state.currentDesk = 1; state.deskSeq = 1;
    state.expFolders = {}; state.expView = 'icons'; state.expSort = 'name'; state.tempDeleted = {};
    state.player = { index: 0, playing: false, pct: 0 };
    state.paint = { color: '#1b2430', size: 6, tool: 'brush' };
    $('#deviceInput').value = state.deviceName;
    $('#localUser').value = ''; $('#localPass').value = ''; $('#localPass2').value = '';
    $('#localErr').style.display = 'none'; $('#msEmail').value = '';
    $('#wifiStatus').textContent = ''; $('#netNext').disabled = true;
    $$('#wifiList .wifi').forEach(function (w) { w.classList.remove('on'); });
    go('boot');
  }

  /* ============================================================
   * v9.0 大型更新：音效 / 动态通知 / 无人值守 / 清理 / 人脸 / 2FA / 启动菜单
   * ============================================================ */
  var _v9Audio = null;
  function v9Sfx(type) {
    if (!state.v9.sound) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!_v9Audio) _v9Audio = new AC();
      if (_v9Audio.state === 'suspended') _v9Audio.resume();
      var t0 = _v9Audio.currentTime;
      var notes = {
        click: [{ f: 880, d: 0.05, g: 0.05 }],
        error: [{ f: 320, d: 0.12, g: 0.08 }, { f: 240, d: 0.16, g: 0.08 }],
        done:  [{ f: 523, d: 0.12, g: 0.06 }, { f: 659, d: 0.12, g: 0.06 }, { f: 784, d: 0.22, g: 0.06 }],
        boot:  [{ f: 392, d: 0.3, g: 0.05 }, { f: 587, d: 0.4, g: 0.05 }]
      }[type] || [{ f: 880, d: 0.05, g: 0.05 }];
      var at = t0;
      notes.forEach(function (n) {
        var osc = _v9Audio.createOscillator(), gain = _v9Audio.createGain();
        osc.type = 'sine'; osc.frequency.value = n.f;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(n.g, at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + n.d);
        osc.connect(gain); gain.connect(_v9Audio.destination);
        osc.start(at); osc.stop(at + n.d + 0.02);
        at += n.d * 0.85;
      });
    } catch (e) { /* 音频不可用时静默 */ }
  }
  // 全局点击音效
  document.addEventListener('click', function (e) {
    var el = e.target.closest('button, .opt, .switch, .chip, .wifi, .dicon, .qp-tile');
    if (el) v9Sfx('click');
  });

  // v9.0：动态通知推送（插入通知中心顶部）
  function v9PushNotif(titleKey, bodyKey, icon) {
    var body = document.querySelector('#notifCenter .nc-body');
    if (!body) return;
    var empty = body.querySelector('.nn-empty');
    if (empty) empty.style.display = 'none';
    var item = document.createElement('div');
    item.className = 'nc-notif v9-new';
    item.innerHTML = '<div class="nn-icon">' + (icon || '★') + '</div><div><div class="nn-title">' +
      _t(titleKey) + '</div><div class="nn-body">' + _t(bodyKey) + '</div></div>';
    body.insertBefore(item, body.firstChild);
  }

  // v9.0：winver / 更新历史 模态框
  function v9ShowWinver() {
    openModal({
      title: _t('wv_title'),
      body: '<div class="wv-box">' +
        '<svg width="44" height="44" viewBox="0 0 64 64"><g fill="#0067c0"><rect x="2" y="2" width="27" height="27" rx="1.5"/><rect x="35" y="2" width="27" height="27" rx="1.5"/><rect x="2" y="35" width="27" height="27" rx="1.5"/><rect x="35" y="35" width="27" height="27" rx="1.5"/></g></svg>' +
        '<div class="wv-rows">' +
        '<div><span>' + _t('wv_os') + '</span><b>' + _t('wv_os_v') + '</b></div>' +
        '<div><span>' + _t('wv_version') + '</span><b>' + _t('wv_version_v') + '</b></div>' +
        '<div><span>' + _t('wv_build') + '</span><b>' + _t('wv_build_v') + '</b></div>' +
        '</div>' +
        '<p class="wv-sim">' + _t('wv_sim') + '</p>' +
        '</div>',
      ok: _t('wv_ok'), cancel: null, onOk: function () { return true; }
    });
  }
  function v9ShowUpdateHistory() {
    openModal({
      title: _t('uh_title'),
      body: '<div class="uh-list">' +
        '<div class="uh-item"><span class="uh-ic">★</span><b>' + _t('uh_v13_t') + '</b><i>2026/11/21</i></div>' +
        '<div class="uh-item"><span class="uh-ic">★</span><b>' + _t('uh_v12_t') + '</b><i>2026/11/21</i></div>' +
        '<div class="uh-item"><span class="uh-ic">★</span><b>' + _t('uh_v11_t') + '</b><i>2026/11/21</i></div>' +
        '<div class="uh-item"><span class="uh-ic">★</span><b>' + _t('uh_v10_t') + '</b><i>2026/11/19</i></div>' +
        '<div class="uh-item"><span class="uh-ic">✓</span><b>' + _t('uh_1') + '</b><i>2026/11/10</i></div>' +
        '<div class="uh-item"><span class="uh-ic">✓</span><b>' + _t('uh_2') + '</b><i>2026/11/08</i></div>' +
        '<div class="uh-item"><span class="uh-ic">✓</span><b>' + _t('uh_3') + '</b><i>2026/11/05</i></div>' +
        '<div class="uh-item"><span class="uh-ic">✓</span><b>' + _t('uh_4') + '</b><i>2026/11/02</i></div>' +
        '</div>',
      ok: _t('uh_ok'), cancel: null, onOk: function () { return true; }
    });
  }

  // v9.0：磁盘清理
  var CL_CATS = [
    { k: 'cl_cat_temp', size: 1240 }, { k: 'cl_cat_old', size: 5320 },
    { k: 'cl_cat_bin', size: 860 }, { k: 'cl_cat_thumb', size: 240 },
    { k: 'cl_cat_logs', size: 180 }, { k: 'cl_cat_cache', size: 2960 }
  ];
  function v9RenderCleanup(scanned) {
    var host = $('#clList'); if (!host) return;
    if (!scanned) {
      host.innerHTML = '<div class="cl-empty">' +
        '<div class="cl-scan-ic">🔍</div>' +
        '<button class="btn primary" id="clScan">' + _t('cl_scan') + '</button></div>';
      var b = $('#clScan');
      if (b) b.addEventListener('click', function () { v9DoScan(); });
      var tot = $('#clTotal'); if (tot) tot.style.display = 'none';
      var cb = $('#clClean'); if (cb) cb.disabled = true;
      return;
    }
    var html = '';
    CL_CATS.forEach(function (c, i) {
      html += '<div class="switch-row cl-row" data-cl="' + i + '">' +
        '<div class="txt"><b>' + _t(c.k) + '</b><span>' + (c.size >= 1024 ? (c.size / 1024).toFixed(1) + ' GB' : c.size + ' MB') + '</span></div>' +
        '<div class="switch on"></div></div>';
    });
    host.innerHTML = html;
    var total = CL_CATS.reduce(function (a, c) { return a + c.size; }, 0);
    var tot = $('#clTotal'); if (tot) tot.style.display = '';
    var ts = $('#clTotalSize');
    if (ts) ts.textContent = total >= 1024 ? (total / 1024).toFixed(1) + ' GB' : total + ' MB';
    var cb = $('#clClean'); if (cb) { cb.disabled = false; cb.textContent = _t('cl_clean'); }
  }
  function v9DoScan() {
    var host = $('#clList'); if (!host) return;
    host.innerHTML = '<div class="cl-scanning"><div class="cl-scan-bar"><i id="clScanBar"></i></div>' +
      '<span>' + _t('cl_scanning') + '</span></div>';
    var p = 0;
    var timer = setInterval(function () {
      p += 8 + Math.random() * 14;
      var bar = $('#clScanBar');
      if (bar) bar.style.width = Math.min(100, p) + '%';
      if (p >= 100) {
        clearInterval(timer);
        v9RenderCleanup(true);
        v8Log('Disk cleanup scan complete: ' + CL_CATS.length + ' categories found');
      }
    }, 110);
    timers.push(timer);
  }

  // v9.0：人脸识别
  var _v9FaceTimer = 0;
  function v9FaceScan() {
    var stage = $('#faceStage'), status = $('#faceStatus'), btn = $('#faceScan');
    if (!stage) return;
    stage.classList.add('scanning');
    if (status) status.textContent = _t('face_scanning');
    if (btn) { btn.disabled = true; btn.textContent = _t('face_scanning'); }
    v8Log('Windows Hello: scanning facial features...');
    var p = 0;
    if (_v9FaceTimer) clearInterval(_v9FaceTimer);
    _v9FaceTimer = setInterval(function () {
      p += 5 + Math.random() * 8;
      if (p >= 100) {
        clearInterval(_v9FaceTimer); _v9FaceTimer = 0;
        // 85% 概率识别成功
        if (Math.random() < 0.85) {
          stage.classList.remove('scanning');
          stage.classList.add('ok');
          if (status) { status.textContent = '✓ ' + _t('face_success'); status.classList.add('ok'); }
          if (btn) { btn.disabled = false; btn.textContent = _t('face_ok'); btn.onclick = function () { go('hello'); }; }
          state.v9.faceDone = true;
          v9Sfx('done');
          v8Log('Windows Hello: face recognition succeeded');
        } else {
          stage.classList.remove('scanning');
          if (status) { status.textContent = _t('face_fail'); status.classList.add('fail'); }
          if (btn) { btn.disabled = false; btn.textContent = _t('face_retry'); }
          v9Sfx('error');
          v8Log('Windows Hello: no face detected', 'warn');
        }
      }
    }, 120);
  }

  // v9.0：无人值守安装引擎（按屏幕就绪驱动，避免与自动跳转竞争）
  var _v9UaQueue = [], _v9UaI = 0, _v9UaPoll = 0, _v9UaWait = 0;
  function v9UaStart() {
    state.v9.unattend.on = true;
    state.v9.unattendRunning = true;
    state.v9.unattendPaused = false;
    var strip = $('#uaStrip');
    if (strip) strip.classList.add('show');
    v9Sfx('boot');
    v8Log('Unattended setup started (answer file: unattend.xml)');
    _v9UaI = 0;
    _v9UaQueue = [
      { id: 'unattend', t: 'boot_check', fn: function () { go('bootcheck'); } },
      { id: 'bootcheck', t: 'boot_check', fn: function () {
          // 无人值守默认使用“快速”速度档
          var chip = $('#speedChips .chip[data-speed="fast"]');
          if (chip) chip.click(); else state.v8.speed = 'fast';
        } },
      { id: 'lang', t: 'ua_step_lang', fn: function () { var b = $('#s-lang .btn.primary'); if (b) b.click(); } },
      { id: 'key', t: 'ua_step_key', fn: function () { var b = $('#btnNoKey'); if (b) b.click(); } },
      { id: 'edition', t: 'ua_edition', fn: function () {
          var ed = document.querySelector('#editionList .opt[data-edition="pro"]') || document.querySelector('#editionList .opt');
          if (ed) ed.click();
          var nx = $('#editionNext');
          if (nx && !nx.disabled) nx.click();
        } },
      { id: 'license', t: 'ua_step_license', fn: function () {
          var lc = $('#licenseCheck'); if (lc && !lc.checked) lc.click();
          var ln = $('#licenseNext'); if (ln && !ln.disabled) ln.click();
        } },
      { id: 'type', t: 'ua_step_type', fn: function () {
          var ct = document.querySelector('#typeList .opt[data-type="custom"]');
          if (ct) ct.click();
          var tn = $('#typeNext'); if (tn && !tn.disabled) tn.click();
        } },
      { id: 'disk', t: 'title_disk', fn: function () {
          // 自动选择第一个主分区
          var rows = $$('#diskRows .disk-row');
          for (var i = 0; i < rows.length; i++) {
            var p = state.disk.filter(function (x) { return x.id === rows[i].dataset.id; })[0];
            if (p && p.kind === 'primary') { selectPartition(p.id); break; }
          }
          var nx = $('#diskNext'); if (nx && !nx.disabled) nx.click();
        } },
      { id: 'restore', t: 'restore_title', fn: function () { var sk = $('#restoreSkip'); if (sk) sk.click(); } },
      { id: 'install', t: 'inst_stage_prep', fn: function () { /* 等待安装完成自动跳转 */ } },
      { id: 'restart', t: 'rst_title', fn: function () { var rb = $('#btnRestartNow'); if (rb) rb.click(); } },
      { id: 'region', t: 'ua_step_region', fn: function () { var b = $('#s-region .btn.primary'); if (b) b.click(); } },
      { id: 'keyboard', t: 'ua_step_keyboard', fn: function () {
          var b = $('#s-keyboard .btn.primary'); if (b) b.click();
          later(function () { var b2 = $('#s-keyboard2 .btn.primary'); if (b2) b2.click(); }, 400);
        } },
      { id: 'keyboard2', t: 'ua_step_keyboard', fn: function () {
          var b = $('#s-keyboard2 .btn.primary'); if (b) b.click();
        } },
      { id: 'hello', t: 'hello_pin_create', fn: function () { var sk = $('#helloSkip'); if (sk) sk.click(); } },
      { id: 'cloud', t: 'cloud_title', fn: function () { var sk = $('#s-cloud .link'); if (sk) sk.click(); } },
      { id: 'updatesetup', t: 'upd_title', fn: function () { var sk = $('#updSkip'); if (sk) sk.click(); } },
      { id: 'privacy', t: 'privacy_title', fn: function () { var b = $('#s-privacy .btn.primary'); if (b) b.click(); } },
      { id: 'encrypt', t: 'encrypt_title', fn: function () { var b = $('#s-encrypt .btn.primary'); if (b) b.click(); } },
      { id: 'access', t: 'access_title', fn: function () { var b = $('#s-access .btn.primary'); if (b) b.click(); } },
      { id: 'connect', t: 'connect_title', fn: function () { var b = $('#s-connect .btn.primary'); if (b) b.click(); } },
      { id: 'bloat', t: 'bl_title', fn: function () { var sa = $('#blSkipAll'); if (sa) sa.click(); } },
      { id: 'custom', t: 'custom_title', fn: function () { var b = $('#s-custom .btn.primary'); if (b) b.click(); } },
      { id: 'done', t: 'done_title', fn: function () { var st = $('#s-done .btn.primary'); if (st) st.click(); } }
    ];
    v9UaRun();
  }
  function v9UaSetStep(text) {
    state.v9.unattendStep = text;
    var el = $('#uaStep');
    if (el) el.textContent = _t('ua_running', { n: _t(text) || text });
  }
  function v9UaRun() {
    if (_v9UaPoll) { clearTimeout(_v9UaPoll); _v9UaPoll = 0; }
    if (!state.v9.unattendRunning) return;
    if (_v9UaI >= _v9UaQueue.length) { v9UaFinish(); return; }
    var step = _v9UaQueue[_v9UaI];
    var cur = (location.hash || '').replace('#', '');
    if (cur !== step.id) {
      // 若当前屏幕对应队列中更后面的步骤（如专业版自动跳过许可/类型页），直接前进到该步
      for (var j = _v9UaI + 1; j < _v9UaQueue.length; j++) {
        if (_v9UaQueue[j].id === cur) { _v9UaI = j; _v9UaWait = 0; v9UaRun(); return; }
      }
      _v9UaWait++;
      // 超时 60 秒自动跳过该步，避免卡死
      if (_v9UaWait > 240) { _v9UaWait = 0; _v9UaI++; v9UaRun(); return; }
      _v9UaPoll = setTimeout(v9UaRun, 250);
      return;
    }
    _v9UaWait = 0;
    v9UaSetStep(step.t);
    try { step.fn(); } catch (e) { }
    _v9UaI++;
    _v9UaPoll = setTimeout(v9UaRun, 500);
  }
  function v9UaFinish() {
    state.v9.unattendRunning = false;
    state.v9.unattend.on = false;
    var strip = $('#uaStrip');
    if (strip) strip.classList.remove('show');
    v9Sfx('done');
    v8Log('Unattended setup completed');
    toast(_t('ua_finished'));
    v9PushNotif('done_title', 'done_desc', '✓');
  }
  function v9UaStop() {
    state.v9.unattendRunning = false;
    if (_v9UaPoll) { clearTimeout(_v9UaPoll); _v9UaPoll = 0; }
    var strip = $('#uaStrip');
    if (strip) strip.classList.remove('show');
    v8Log('Unattended setup cancelled by user', 'warn');
    toast(_t('ua_skip_this'));
  }

  // v9.0：双系统启动菜单
  var _v9BmTimer = 0;
  function v9StartBootMenu() {
    var items = $$('#bmList .bm-item');
    var sel = 0;
    items.forEach(function (x, i) { x.classList.toggle('on', i === 0); });
    var n = 10;
    var timerEl = $('#bmTimer');
    if (timerEl) timerEl.textContent = _t('bm_timer', { s: n });
    if (_v9BmTimer) clearInterval(_v9BmTimer);
    _v9BmTimer = setInterval(function () {
      n--;
      if (timerEl) timerEl.textContent = _t('bm_timer', { s: Math.max(n, 0) });
      if (n <= 0) { clearInterval(_v9BmTimer); go('prepare1'); }
    }, 1000);
    timers.push(_v9BmTimer);
    function pick() {
      clearInterval(_v9BmTimer);
      var os = items[sel].dataset.os;
      v8Log('Boot manager: ' + (os === 'win10' ? 'Windows 10' : 'Windows 11') + ' selected');
      go('prepare1');
    }
    items.forEach(function (x, i) {
      x.onclick = function () { sel = i; items.forEach(function (y, j) { y.classList.toggle('on', j === i); }); };
      x.ondblclick = pick;
    });
    var keyHandler = function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach(function (y, j) { y.classList.toggle('on', j === sel); });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        document.removeEventListener('keydown', keyHandler, true);
        pick();
      }
    };
    document.addEventListener('keydown', keyHandler, true);
  }

  // v9.0：首次开机动画
  function v9PlayBootAnim() {
    var msg = $('#baMsg'), hint = $('#baHint');
    if (msg) msg.textContent = _t('ba_preparing');
    if (hint) hint.textContent = _t('ba_hint');
    v9Sfx('boot');
    later(function () {
      if (msg) msg.textContent = _t('ba_welcome');
      if (hint) hint.textContent = '';
    }, 2200);
    later(function () {
      state.v9.firstBoot = false;
      go('desktop');
      v9PushNotif('done_title', 'done_desc', '✓');
    }, 3400);
  }

  /* ============================================================
   * v8.0 特大更新：日志引擎 / 深色模式 / 辅助功能 / 更新检查 / 导航历史
   * ============================================================ */
  function v8Log(text, level) {
    if (!text) return;
    var s = state.v8;
    s.logSeq++;
    var d = new Date();
    var p2 = function (n) { return String(n).length < 2 ? '0' + n : String(n); };
    var ts = p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()) + '.' + String(d.getMilliseconds()).padStart(3, '0');
    s.log.push({ ts: ts, text: String(text), level: level || 'info' });
    if (s.log.length > 500) s.log.shift();
    var ov = $('#logOverlay');
    if (ov && ov.classList.contains('open')) v8RenderLog();
  }
  function v8LogText() {
    return state.v8.log.map(function (x) {
      return x.ts + '  [' + (x.level === 'err' ? 'ERR' : x.level === 'warn' ? 'WRN' : 'INF') + ']  ' + x.text;
    }).join('\n');
  }
  function v8RenderLog() {
    var body = $('#logBody'); if (!body) return;
    var fEl = $('#logFilter');
    var f = fEl ? fEl.value.trim().toLowerCase() : '';
    var rows = state.v8.log.filter(function (x) {
      return !f || (x.text + ' ' + x.level).toLowerCase().indexOf(f) >= 0;
    });
    if (!rows.length) { body.textContent = _t('log_empty'); return; }
    body.innerHTML = rows.map(function (x) {
      var cls = x.level === 'err' ? 'lg-err' : (x.level === 'warn' ? 'lg-warn' : '');
      var tag = x.level === 'err' ? 'ERR' : (x.level === 'warn' ? 'WRN' : 'INF');
      var t = (x.ts + '  [' + tag + ']  ' + x.text).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      return '<span class="' + cls + '">' + t + '</span>';
    }).join('\n');
    var auto = $('#logAuto');
    if (!auto || auto.checked) body.scrollTop = body.scrollHeight;
  }
  function v8OpenLog() {
    var ov = $('#logOverlay'); if (!ov) return;
    ov.classList.add('open');
    var badge = $('#logBadge');
    if (badge) {
      badge.textContent = state.v8.logPaused ? _t('log_paused') : _t('log_live');
      badge.classList.toggle('paused', !!state.v8.logPaused);
    }
    v8RenderLog();
  }
  function v8CloseLog() { var ov = $('#logOverlay'); if (ov) ov.classList.remove('open'); }

  function v8ExportLog() {
    var name = 'setup-log.txt';
    var content = v8LogText() || _t('log_empty');
    fetch('/api/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, content: content })
    }).then(function (r) { return r.json(); }).then(function () {
      toast(_t('log_exported'));
    }).catch(function () {
      toast(_t('log_exported'));
    });
  }

  function v8ApplyDark() {
    document.body.classList.toggle('v8-dark', !!state.v8.dark);
    var b = $('#v8Theme');
    if (b) b.textContent = state.v8.dark ? '☀️' : '🌙';
    try { localStorage.setItem('win11_v8_dark', state.v8.dark ? '1' : '0'); } catch (e) {}
  }

  function v8SyncAccess() {
    var a = state.v8.access;
    $$('#accessList [data-access]').forEach(function (row) {
      var sw = row.querySelector('.switch');
      if (sw) sw.classList.toggle('on', !!a[row.dataset.access]);
    });
    var pv = $('#accessPreview');
    if (pv) {
      pv.classList.toggle('bigtext', !!a.bigtext);
      pv.classList.toggle('contrast', !!a.contrast);
    }
  }

  // v8.1：设备加密开关同步
  function v8SyncEncrypt() {
    var tgl = $('#encryptToggle'), st = $('#encryptState');
    if (!tgl) return;
    var on = tgl.classList.contains('on');
    if (st) {
      st.textContent = on ? _t('encrypt_on') : _t('encrypt_off');
      st.classList.toggle('off', !on);
    }
    state.v8.encrypt = on;
  }

  var v8UpdTimer = 0;
  function v8RunUpdates() {
    var items = $$('#updList .upd-item');
    var bar = $('#updBar'), pct = $('#updPct'), status = $('#updStatus'), next = $('#updNext');
    items.forEach(function (it) {
      it.classList.remove('done', 'active');
      var ic = it.querySelector('.upd-ic'); if (ic) ic.textContent = '◌';
    });
    if (bar) bar.style.width = '0%';
    if (pct) pct.textContent = '0%';
    if (next) next.disabled = true;
    if (status) status.textContent = _t('upd_checking');
    if (v8UpdTimer) { clearInterval(v8UpdTimer); v8UpdTimer = 0; }
    var total = items.length || 1;
    var idx = 0;
    v8Log('Windows Update: checking for updates...');
    later(function () {
      if (status) status.textContent = _t('upd_found', { n: total });
      v8Log('Windows Update: ' + total + ' update(s) found');
      step();
    }, 900);
    function step() {
      if (idx >= total) {
        if (bar) bar.style.width = '100%';
        if (pct) pct.textContent = '100%';
        if (status) status.textContent = _t('upd_done');
        if (next) next.disabled = false;
        v8Log('Windows Update: all updates installed');
        return;
      }
      items.forEach(function (x) { x.classList.remove('active'); });
      var it = items[idx];
      it.classList.add('active');
      var ic = it.querySelector('.upd-ic'); if (ic) ic.textContent = '↓';
      var p = 0;
      v8UpdTimer = setInterval(function () {
        p += 9 + Math.random() * 12;
        if (p >= 100) {
          p = 100;
          clearInterval(v8UpdTimer); v8UpdTimer = 0;
          it.classList.remove('active');
          it.classList.add('done');
          if (ic) ic.textContent = '✓';
          v8Log('Installed: ' + it.textContent.trim().slice(0, 60));
          idx++;
          step();
          return;
        }
        var overall = Math.round(((idx + p / 100) / total) * 100);
        if (bar) bar.style.width = overall + '%';
        if (pct) pct.textContent = overall + '%';
        if (status) status.textContent = (p > 55) ? _t('upd_installing') : _t('upd_downloading', { p: Math.round(p) });
      }, 120);
    }
  }

  var v8OrigGo = go;
  go = function (id) {
    if (!document.getElementById('s-' + id)) return;
    if (v8UpdTimer) { clearInterval(v8UpdTimer); v8UpdTimer = 0; }
    var st = state._navStack || (state._navStack = []);
    var cur = (location.hash || '').replace('#', '');
    if (cur && cur !== id && !state._navBack) { st.push(cur); if (st.length > 40) st.shift(); }
    state._navBack = false;
    v8OrigGo(id);
  };
  function v8Back() {
    var st = state._navStack || [];
    if (!st.length) return;
    var prev = st.pop();
    state._navBack = true;
    v8OrigGo(prev);
  }

  /* ============================================================
   * hooks
   * ============================================================ */
  var hooks = {
    boot: function () {
      _apply();
      updateVersionBadge('boot');
      v8Log('Boot loader started — Windows Setup 8.1');
      // v8.1：启动动画后进入欢迎页（不再直接进检查页）
      later(function () {
        v8Log('Boot loader finished, showing welcome screen');
        go('welcome');
      }, 2200);
    },
    welcome: function () {
      _apply();
      v8Log('Welcome screen: install now / repair');
    },
    restore: function () {
      _apply();
      var tgl = $('#restoreToggle'), prog = $('#restoreProg'), bar = $('#restoreBar'),
          status = $('#restoreStatus'), next = $('#restoreNext'), skip = $('#restoreSkip');
      if (!tgl) return;
      var on = tgl.classList.contains('on');
      if (prog) prog.style.display = 'none';
      if (next) { next.disabled = !on; next.textContent = _t('restore_ok'); }
      if (skip) skip.style.display = '';
      if (on) {
        if (next) next.disabled = true;
        if (prog) prog.style.display = '';
        v8Log('Creating system restore point "before setup"');
        var p = 0;
        var steps = [_t('restore_scan'), _t('restore_creating'), _t('restore_write')];
        var si = 0;
        if (status) status.textContent = steps[0];
        var timer = setInterval(function () {
          p += 6 + Math.random() * 10;
          if (si < 2 && p > (si + 1) * 33) { si++; if (status) status.textContent = steps[si]; }
          if (p >= 100) {
            p = 100; clearInterval(timer);
            if (status) status.textContent = _t('restore_done');
            v8Log('Restore point created successfully');
            if (next) next.disabled = false;
            return;
          }
          if (bar) bar.style.width = p + '%';
        }, 130);
        timers.push(timer);
      } else {
        v8Log('Restore point creation skipped');
      }
    },
    encrypt: function () {
      _apply();
      v8SyncEncrypt();
    },
    whatsnew: function () {
      _apply();
      var tag = $('#wnVerTag');
      if (tag) tag.textContent = 'v' + (_t('version_v20') || '20.0');
    },
    hist: function () {
      _apply();
      // 渲染已保存的安装配置列表
      var list = (function () {
        try { return JSON.parse(localStorage.getItem('win11_hist') || '[]'); } catch(e) { return []; }
      })();
      var host = $('#histList');
      if (!host) return;
      if (!list.length) {
        host.innerHTML = '<div class="hist-list"><div class="hist-item" style="justify-content:center; color:#6b7280;">📦 ' + _t('hist_none') + '</div></div>';
        $('#histRestoreBtn').disabled = true;
        $('#histRestoreBtn').textContent = _t('hist_restore');
        host.onclick = null;
        return;
      }
      var html = '<div class="hist-list">';
      list.forEach(function (item, i) {
        html += '<div class="hist-item" data-idx="' + i + '">' +
          '<div class="hi-ic">💾</div>' +
          '<div class="hi-info">' +
          '<div class="hi-name">' + _t('hist_name', { i: i + 1 }) + ' — ' + (item.edition || '专业版') + '</div>' +
          '<div class="hi-meta">' + _t('hist_time', { t: item.time || '未知时间' }) + ' · ' + _t('hist_source', { s: item.source || '本地保存' }) + '</div>' +
          '</div>' +
          '<button class="link hist-del" data-del="' + i + '" title="删除">✕</button>' +
          '</div>';
      });
      html += '</div>';
      host.innerHTML = html;
      var btn = $('#histRestoreBtn'); btn.disabled = true;
      function sel(idx) {
        $$('#histList .hist-item').forEach(function (x) { x.classList.remove('sel'); });
        var el = document.querySelector('#histList .hist-item[data-idx="' + idx + '"]');
        if (el) el.classList.add('sel');
        btn.disabled = false;
      }
      host.onclick = function (e) {
        var del = e.target.closest('.hist-del');
        if (del) {
          e.stopPropagation();
          var i = parseInt(del.dataset.del, 10);
          list.splice(i, 1);
          try { localStorage.setItem('win11_hist', JSON.stringify(list)); } catch(e) {}
          hooks.hist();
          return;
        }
        var item = e.target.closest('#histList .hist-item');
        if (item) { sel(parseInt(item.dataset.idx, 10)); }
      };
      btn.onclick = function () {
        var active = document.querySelector('#histList .hist-item.sel');
        if (!active) return;
        var idx = parseInt(active.dataset.idx, 10);
        var item = list[idx];
        if (item && item.edition) {
          state.edition = item.edition;
          state.deviceName = item.deviceName || state.deviceName;
        }
        toast(_t('toast_hist_restored') || '安装配置已恢复');
        go('bootcheck');
      };
    },
    compare: function () {
      _apply();
    },
    source: function () {
      _apply();
      $$('#srcList .opt').forEach(function (o) { o.classList.remove('sel'); });
      $('#srcNext').disabled = true;
    },
    unattend: function () {
      _apply();
      $$('#uaPresets [data-ua]').forEach(function (row) {
        var sw = row.querySelector('.switch');
        if (sw) sw.classList.toggle('on', !!state.v9.unattend[row.dataset.ua]);
      });
    },
    cleanup: function () {
      _apply();
      v9RenderCleanup(false);
    },
    face: function () {
      _apply();
      var stage = $('#faceStage'), status = $('#faceStatus'), btn = $('#faceScan');
      if (stage) { stage.classList.remove('scanning', 'ok'); }
      if (status) { status.classList.remove('ok', 'fail'); status.textContent = _t('face_hint'); }
      if (btn) {
        btn.disabled = false;
        btn.textContent = state.v9.faceDone ? _t('face_ok') : _t('face_scan');
        btn.onclick = function () {
          if (state.v9.faceDone) { go('hello'); return; }
          v9FaceScan();
        };
      }
    },
    msauth: function () {
      _apply();
      var d = $('#m2Desc');
      if (d) d.textContent = _t('m2_desc', { e: $('#msEmail') && $('#msEmail').value.trim() || 'you@example.com' });
      var c = $('#m2Code'); if (c) c.value = '';
      var v = $('#m2Verify'); if (v) v.disabled = true;
      var e2 = $('#m2Err'); if (e2) e2.style.display = 'none';
      v8Log('Microsoft account: 2FA code sent to ' + (($('#msEmail') && $('#msEmail').value.trim()) || 'inbox'));
    },
    bloat: function () {
      _apply();
      v9SyncBloat();
    },
    bootmenu: function () {
      _apply();
      v9StartBootMenu();
    },
    bootanim: function () {
      _apply();
      v9PlayBootAnim();
    },
    scan: function () {
      _apply();
      var score = 96 + Math.floor(Math.random() * 5);
      var sc = $('#scanScore'); if (sc) sc.textContent = String(score);
      var sv = $('#scanScoreVal'); if (sv) sv.textContent = _t('scan_score_val', { n: score });
      v8Log('System scan: compatibility score ' + score + '/100');
    },
    access: function () {
      _apply();
      v8SyncAccess();
    },
    updatesetup: function () {
      _apply();
      v8RunUpdates();
    },
    bootcheck: function () {
      _apply();
      var checks = $$('#bootCheck .boot-item');
      var pass = $('#bootPass');
      checks.forEach(function (el) { el.classList.remove('pass'); });
      if (pass) pass.style.display = 'none';
      checks.forEach(function (el, i) {
        later(function () { el.classList.add('pass'); }, (i + 1) * 220);
      });
      later(function () {
        if (pass) pass.style.display = '';
        v8Log('System requirements check passed (CPU / RAM / Storage / Secure Boot / TPM 2.0)');
      }, checks.length * 220 + 320);
      later(function () { go('lang'); }, checks.length * 220 + 5200);
    },
    disk: function () { _apply(); renderDisk(); },
    install: function () { _apply(); startInstall(); },
    installerr: function () { _apply(); renderInstallError(); },
    restart: function () {
      _apply();
      // v9.0：首次安装后 35% 概率出现双系统启动菜单
      if (!state.v9.bootMenuUsed && Math.random() < 0.35) {
        state.v9.bootMenuUsed = true;
        v8Log('Boot manager appeared (dual-boot detected)');
        later(function () { go('bootmenu'); }, 400);
        return;
      }
      startRestart();
    },
    prepare1: function () { _apply(); later(function () { go('region'); }, 2800); },
    region: function () { _apply(); },
    keyboard: function () { _apply(); },
    keyboard2: function () {
      _apply();
      // v7.0 特大更新：跳过旧的 device/account 流程，直接进 netcheck
      // （旧 network 页保留但不经过它）
      later(function () { go('netcheck'); }, 100);
    },
    network: function () { _apply(); },
    netcheck: function () {
      _apply();
      var sub = $('#netcheckSub');
      var connected = Math.random() < 0.85;
      if (sub) sub.textContent = _t('net_checking');
      later(function () {
        if (connected) {
          if (sub) sub.textContent = _t('net_have');
        } else {
          if (sub) sub.textContent = _t('net_none_desc');
        }
        later(function () { go('hello'); }, 1000);
      }, 1800);
    },
    limited: function () { _apply(); },
    hello: function () {
      _apply();
      var pin = $('#helloPin'), pin2 = $('#helloPin2');
      if (pin) pin.value = '';
      if (pin2) pin2.value = '';
      checkHelloPin();
    },
    cloud: function () { _apply(); },
    privacy: function () { _apply(); },
    connect: function () { _apply(); },
    final: function () {
      _apply();
      $('#finalName').textContent = state.userName || 'Administrator';
      later(function () { go('done'); }, 2400);
    },
    done: function () {
      _apply();
      var nm = state.userName || 'Administrator';
      $('#doneName').textContent = nm;
      // v8.0：填充安装摘要
      var edEl = document.querySelector('#editionList .opt.sel .opt__t');
      var edition = edEl ? edEl.textContent : (state.edition || 'Windows 11');
      var p = null;
      for (var i = 0; i < state.disk.length; i++) if (state.disk[i].id === state.selected) p = state.disk[i];
      if (!p) { for (var k = 0; k < state.disk.length; k++) if (state.disk[k].total > 0) { p = state.disk[k]; break; } }
      var durMs = (state.v8.instEndAt || Date.now()) - (state.v8.instStartAt || Date.now());
      var dsec = Math.max(1, Math.round(durMs / 1000));
      var durStr = String(Math.floor(dsec / 60)).padStart(2, '0') + ':' + String(dsec % 60).padStart(2, '0');
      var se = $('#sumEdition'); if (se) se.textContent = edition;
      var sd = $('#sumDevice'); if (sd) sd.textContent = state.deviceName;
      var sp = $('#sumPartition'); if (sp) sp.textContent = p ? (diskName(p) + ' · ' + fmtSize(p.total)) : '—';
      var sdu = $('#sumDuration'); if (sdu) sdu.textContent = durStr;
      v8Log('OOBE completed — device name ' + state.deviceName);
      // v7.0 特大更新：安装完成自动保存配置
      (function saveConfig() {
        try {
          var list = JSON.parse(localStorage.getItem('win11_hist') || '[]');
          var exists = list.some(function (x) { return x.edition === state.edition && x.deviceName === state.deviceName; });
          if (!exists && state.edition) {
            var now = new Date();
            var t = now.getFullYear() + '/' + String(now.getMonth() + 1).padStart(2, '0') + '/' + String(now.getDate()).padStart(2, '0');
            list.unshift({
              edition: state.edition, deviceName: state.deviceName,
              time: t, source: '自动保存'
            });
            list = list.slice(0, 5);
            localStorage.setItem('win11_hist', JSON.stringify(list));
          }
        } catch(e) {}
      })();
      // v8.0：停留在完成页，让用户查看安装摘要；点击“开始使用”再进入桌面
    },
    device: function () { _apply(); $('#deviceInput').value = state.deviceName; },
    acc: function () { _apply(); },
    acctype: function () { _apply(); },
    msaccount: function () { _apply(); },
    local: function () { _apply(); },
    custom: function () { _apply(); },
    desktop: function () {
      // v9.0：安装完成后首次进入桌面先播放开机动画
      if (state.v9.firstBoot) { go('bootanim'); return; }
      _apply(); enterDesktop();
    }
  };

  document.addEventListener('langchange', function () {
    var active = $('.screen.active');
    var id = active ? active.id.replace(/^s-/, '') : '';
    if (id === 'disk') renderDisk();
    else if (id === 'install') {
      var pctEl = $('#instPct');
      var pctNum = parseInt((pctEl || {}).textContent || '0', 10);
      var idx = 0;
      for (var i = INST_STAGES_PCT.length - 1; i >= 0; i--) { if (pctNum >= INST_STAGES_PCT[i]) { idx = i; break; } }
      var stg = $('#instStage'); if (stg) stg.textContent = _t(INST_STAGES_KEYS[idx]);
      var err = $('#errStage'); if (err) err.textContent = _t(INST_STAGES_KEYS[idx]);
      var selected = state.disk.filter(function (x) { return x.id === state.selected; })[0];
      var tgt = $('#instTarget');
      if (tgt && selected) tgt.textContent = diskName(selected) + '（' + fmtSize(selected.total) + '）';
    }
    else if (id === 'installerr') renderInstallError();
    else if (id === 'final') $('#finalName').textContent = state.userName || 'Administrator';
    else if (id === 'desktop') {
      var n = state.userName || 'Administrator'; $('#smUser').textContent = n; $('#smAvatar').textContent = n.charAt(0).toUpperCase();
      buildAllApps();
      renderCalendar(calYear, calMonth);
      renderWidgetsCalendar();
      syncQuickPanel();
      filterStartApps();
      var tvLang = $('#taskView'); if (tvLang && tvLang.classList.contains('open')) renderTaskView();
      var soLang = $('#searchOverlay'); if (soLang && soLang.classList.contains('open')) renderSearch();
    }
    AppWindows.retitleAll();
    Object.keys(state.openWindows).forEach(function (wid) {
      var w = state.openWindows[wid];
      if (w.dataset.type === 'settings') {
        var b = w.querySelector('.settings, .win-body');
        if (b) AppWindows._renderSettings(b, b.dataset.settingsPage || 'home');
      }
    });
  });

  /* ============================================================
   * 事件绑定
   * ============================================================ */
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-go]');
    if (g && !g.disabled) { go(g.dataset.go); return; }
    var j = e.target.closest('[data-jump]');
    if (j) { go(j.dataset.jump); return; }
    var cs = e.target.closest('[data-close-setup]');
    if (cs) { confirmExit(); return; }
  });

  function confirmExit() {
    $('#mTitle').textContent = _t('toast_close_title');
    $('#mBody').innerHTML = '<p>' + _t('toast_close_body') + '</p>';
    $('#mOk').textContent = _t('btn_close_ok'); $('#mCancel').style.display = ''; $('#mCancel').textContent = _t('btn_close_cancel');
    okHandler = function () { AppWindows.closeAll(); go('boot'); };
    modalOpen = true; $('#modal').classList.add('open');
  }

  var btnCloseSetup = $('#btnCloseSetup'); if (btnCloseSetup) btnCloseSetup.addEventListener('click', confirmExit);
  var btnRepair = $('#btnRepair'); if (btnRepair) btnRepair.addEventListener('click', function () { toast(_t('toast_demo_repair')); });

  /* 密钥输入修复：25 字符后解锁 + 可选：按 Enter 自动进 edition */
  var keyInput = $('#keyInput');
  if (keyInput) {
    keyInput.addEventListener('input', function () {
      var raw = keyInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 25);
      var out = raw.replace(/(.{5})/g, '$1-').replace(/-$/, '');
      keyInput.value = out;
      $('#keyNext').disabled = raw.length < 25;
    });
  }
  $('#btnNoKey').addEventListener('click', function () { keyInput.value = ''; $('#keyNext').disabled = true; go('edition'); });

  /* 版本 */
  $('#editionList').addEventListener('click', function (e) {
    var opt = e.target.closest('.opt'); if (!opt) return;
    $$('#editionList .opt').forEach(function (o) { o.classList.remove('sel'); });
    opt.classList.add('sel'); state.edition = opt.dataset.edition; $('#editionNext').disabled = false;
  });
  $('#editionNext').addEventListener('click', function () { go('license'); });

  /* 许可：必须滚动到底部才能勾选（贴近真实安装程序） */
  var KEY_EDITIONS = {
    'VK7JGNPHTMC97JM9MPGT3V66T': 'Windows 11 专业版',
    'W269NWFGWXYVC9B4J6C9T83GX': 'Windows 11 专业版',
    'TX9XD98N7V6WMQ6BX7FGH8Q99': 'Windows 11 家庭版',
    'NPPR9FWDCXD2C8JH872K2YT43': 'Windows 11 企业版',
    'NW6C2QMPVWD7KKK3GKT6VCFB2': 'Windows 11 教育版'
  };
  var termsBox = document.querySelector('#s-license .terms');
  function resetLicenseScroll() {
    var cb = $('#licenseCheck'), hint = $('#licenseScrollHint');
    if (cb) { cb.checked = false; cb.disabled = true; }
    if (hint) hint.style.display = '';
    var nx = $('#licenseNext'); if (nx) nx.disabled = true;
    if (termsBox) termsBox.scrollTop = 0;
  }
  if (termsBox) {
    termsBox.addEventListener('scroll', function () {
      if (termsBox.scrollTop + termsBox.clientHeight >= termsBox.scrollHeight - 8) {
        var cb = $('#licenseCheck'); if (cb) cb.disabled = false;
        var hint = $('#licenseScrollHint'); if (hint) hint.style.display = 'none';
      }
    });
  }
  var v12OrigLicenseHook = hooks.license;
  hooks.license = function () { if (v12OrigLicenseHook) v12OrigLicenseHook(); resetLicenseScroll(); };

  /* 产品密钥：格式校验 + 按密钥识别版本 */
  keyInput.addEventListener('input', function () {
    var raw = keyInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 25);
    var out = raw.replace(/(.{5})/g, '$1-').replace(/-$/, '');
    keyInput.value = out;
    $('#keyNext').disabled = raw.length < 25;
    state._keyRaw = raw;
  });
  $('#keyNext').onclick = null;
  $('#keyNext').addEventListener('click', function () {
    var raw = state._keyRaw || keyInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (raw.length !== 25) return;
    var edition = KEY_EDITIONS[raw];
    if (!edition) {
      openModal({
        title: _t('key_invalid_title'),
        body: '<p>' + _t('key_invalid_desc') + '</p>',
        ok: _t('modal_default_ok'),
        cancel: null
      });
      return;
    }
    $$('#editionList .opt').forEach(function (o) {
      if (o.dataset.edition === edition) {
        o.classList.add('sel');
        state.edition = edition;
        $('#editionNext').disabled = false;
      } else o.classList.remove('sel');
    });
    toast(_t('key_edition_ok', { n: edition }));
    go('edition');
  });

  /* 许可 */
  $('#licenseCheck').addEventListener('change', function () { $('#licenseNext').disabled = !this.checked || this.disabled; });
  $('#licenseNext').addEventListener('click', function () { if (!$('#licenseCheck').disabled) go('type'); });

  /* 安装类型 */
  $('#typeList').addEventListener('click', function (e) {
    var opt = e.target.closest('.opt'); if (!opt) return;
    if (opt.dataset.type === 'upgrade' || opt.dataset.type === 'keepfiles') { toast(_t('type_hint_upgrade2')); return; }
    $$('#typeList .opt').forEach(function (o) { o.classList.remove('sel'); });
    opt.classList.add('sel'); $('#typeNext').disabled = false;
  });
  $('#typeNext').addEventListener('click', function () { go('disk'); });

  /* 磁盘 */
  $('#diskRows').addEventListener('click', function (e) {
    var row = e.target.closest('.disk-row'); if (!row || row.classList.contains('head')) return;
    selectPartition(row.dataset.id);
  });
  $('#btnRefresh').addEventListener('click', function () { renderDisk(); toast(_t('toast_refresh')); });
  $('#btnNew').addEventListener('click', function () {
    var un = state.disk.filter(function (x) { return x.unallocated; })[0];
    if (!un) { toast(_t('toast_no_unalloc')); return; }
    var def = Math.floor(un.total * 1024);
    $('#mTitle').textContent = _t('modal_new_title');
    $('#mBody').innerHTML = '<p>' + _t('modal_new_body') + '</p>' +
      '<div class="fld"><label class="fld__label">' + _t('modal_new_label') + '</label>' +
      '<input class="inp" id="newSize" type="number" value="' + def + '" min="1024"></div>';
    $('#mOk').textContent = _t('modal_new_ok'); $('#mCancel').style.display = ''; $('#mCancel').textContent = _t('modal_default_cancel');
    okHandler = function () {
      var el = document.getElementById('newSize'); var v = parseInt(el ? el.value : '', 10);
      if (!v || v < 1024) { toast(_t('modal_new_err')); return false; }
      doNewPartition(Math.min(v, def)); return true;
    };
    modalOpen = true; $('#modal').classList.add('open');
  });
  $('#btnDelete').addEventListener('click', function () {
    var p = state.disk.filter(function (x) { return x.id === state.selected; })[0];
    if (!p) { toast(_t('toast_select_part_first')); return; }
    if (p.unallocated) { toast(_t('toast_unalloc_no_delete')); return; }
    $('#mTitle').textContent = _t('modal_delete_title');
    $('#mBody').innerHTML = '<p>' + _t('modal_delete_body', { name: diskName(p) }) + '</p>';
    $('#mOk').textContent = _t('modal_delete_ok'); $('#mCancel').style.display = ''; $('#mCancel').textContent = _t('modal_default_cancel');
    okHandler = function () { removePartition(p.id); toast(_t('toast_deleted')); };
    modalOpen = true; $('#modal').classList.add('open');
  });
  $('#btnFormat').addEventListener('click', function () {
    var p = state.disk.filter(function (x) { return x.id === state.selected; })[0];
    if (!p) { toast(_t('toast_select_part_first')); return; }
    if (p.unallocated) { toast(_t('toast_unalloc_no_format')); return; }
    if (p.kind !== 'primary') { toast(_t('toast_system_part_no_format')); return; }
    $('#mTitle').textContent = _t('modal_format_title');
    $('#mBody').innerHTML = '<p>' + _t('modal_format_body', { name: diskName(p) }) + '</p>';
    $('#mOk').textContent = _t('modal_format_ok'); $('#mCancel').style.display = ''; $('#mCancel').textContent = _t('modal_default_cancel');
    okHandler = function () { p.free = p.total; renderDisk(); toast(_t('toast_formatted', { size: fmtSize(p.total) })); };
    modalOpen = true; $('#modal').classList.add('open');
  });
  $('#btnDriver').addEventListener('click', function () { v11OpenDrv(); });
  // v7.0 特大更新：GPT 转换 + 扩展分区
  $('#btnGpt').addEventListener('click', function () {
    $('#mTitle').textContent = _t('disk_gpt_convert');
    $('#mBody').innerHTML = '<p>' + _t('disk_guid_warn') + '</p>' +
      '<p style="margin-top:10px;color:#6b7280;font-size:12px;">' + _t('disk_gpt') + ' 格式支持 UEFI 安全启动和超过 2TB 的磁盘。</p>';
    $('#mOk').textContent = _t('disk_gpt_convert'); $('#mCancel').style.display = ''; $('#mCancel').textContent = _t('modal_default_cancel');
    okHandler = function () { toast(_t('toast_gpt_converted') || '磁盘已转换为 GPT'); renderDisk(); };
    modalOpen = true; $('#modal').classList.add('open');
  });
  $('#btnExtend').addEventListener('click', function () {
    var p = state.disk.filter(function (x) { return x.id === state.selected; })[0];
    if (!p) { toast(_t('toast_select_part_first')); return; }
    $('#mTitle').textContent = _t('disk_extend');
    $('#mBody').innerHTML = '<p>' + _t('disk_primary_req') + '</p>' +
      '<div class="fld"><label class="fld__label">' + _t('disk_apply_size') + '</label>' +
      '<input class="inp" id="extendSize" type="number" value="4096" min="512"></div>';
    $('#mOk').textContent = _t('disk_apply_ok'); $('#mCancel').style.display = ''; $('#mCancel').textContent = _t('modal_default_cancel');
    okHandler = function () {
      var el = document.getElementById('extendSize'); var v = parseInt(el ? el.value : '', 10);
      if (!v || v < 512) { toast('无效大小'); return false; }
      p.free += v * 1024 * 1024; renderDisk(); toast('分区已扩展');
    };
    modalOpen = true; $('#modal').classList.add('open');
  });
  $('#diskNext').addEventListener('click', function () { go('restore'); });

  /* 重启 */
  $('#btnRestartNow').addEventListener('click', function () { go('prepare1'); });

  /* 键盘布局 */
  $('#kbList').addEventListener('click', function (e) {
    var opt = e.target.closest('.opt'); if (!opt) return;
    $$('#kbList .opt').forEach(function (o) { o.classList.remove('sel'); }); opt.classList.add('sel');
  });
  $('#kb2List').addEventListener('click', function (e) {
    var opt = e.target.closest('.opt'); if (!opt) return;
    $$('#kb2List .opt').forEach(function (o) { o.classList.remove('sel'); }); opt.classList.add('sel');
  });

  /* Wi-Fi */
  $('#wifiList').addEventListener('click', function (e) {
    var w = e.target.closest('.wifi'); if (!w) return;
    // v10.0：加密网络先要求输入安全密钥
    if (w.dataset.lock === '1') { v10AskWifi(w); return; }
    v10WifiConnect(w);
  });

  /* v7.0：Windows Hello PIN */
  var helloPin = $('#helloPin'), helloPin2 = $('#helloPin2'), helloNext = $('#helloNext'), helloErr = $('#helloErr');
  function checkHelloPin() {
    if (!helloPin || !helloPin2 || !helloNext) return;
    var v1 = helloPin.value.trim(), v2 = helloPin2.value.trim();
    helloNext.disabled = !(v1.length >= 4 && v1 === v2);
    if (helloErr) {
      if (v1.length > 0 && v2.length > 0 && v1 !== v2) { helloErr.textContent = _t('hello_pin_mismatch') || '两次输入的 PIN 不一致'; helloErr.style.display = ''; }
      else { helloErr.style.display = 'none'; }
    }
  }
  if (helloPin) helloPin.addEventListener('input', checkHelloPin);
  if (helloPin2) helloPin2.addEventListener('input', checkHelloPin);
  if (helloNext) helloNext.addEventListener('click', function () {
    var v1 = helloPin.value.trim(), v2 = helloPin2.value.trim();
    if (v1.length >= 4 && v1 === v2) { go('cloud'); }
  });

  /* v7.0：安装错误页按钮 */
  var errRetry = $('#errRetry'), errCustom = $('#errCustom'), errDump = $('#errDump');
  if (errRetry) errRetry.addEventListener('click', function () {
    state.selected = null; clearTimers(); go('disk');
  });
  if (errCustom) errCustom.addEventListener('click', function () { go('disk'); });
  if (errDump) errDump.addEventListener('click', function () { v8OpenLog(); });

  /* 设备名 */
  $('#deviceInput').addEventListener('input', function () { $('#deviceNext').disabled = !this.value.trim(); });
  $('#deviceNext').addEventListener('click', function () {
    var v = $('#deviceInput').value.trim(); if (!v) { toast(_t('toast_device_empty')); return; }
    state.deviceName = v; go('acctype');
  });

  /* 账户类型 */
  $('#accList').addEventListener('click', function (e) {
    var opt = e.target.closest('.opt'); if (!opt) return;
    $$('#accList .opt').forEach(function (o) { o.classList.remove('sel'); }); opt.classList.add('sel');
    state.account = opt.dataset.acc; $('#accNext').disabled = false;
  });
  $('#accNext').addEventListener('click', function () {
    if (state.account === 'work') { toast(_t('toast_work_demo')); return; }
    go('msaccount');
  });

  /* 微软账户 */
  $('#msNext').addEventListener('click', function () {
    var v = $('#msEmail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { toast(_t('toast_invalid_email')); return; }
    var name = v.split('@')[0].replace(/[^A-Za-z0-9\u4e00-\u9fa5]/g, '');
    state.userName = name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Administrator';
    go('privacy');
  });

  /* 本地账户 */
  $('#localNext').addEventListener('click', function () {
    var u = $('#localUser').value.trim(); var p1 = $('#localPass').value; var p2 = $('#localPass2').value;
    var err = $('#localErr');
    if (!u) { err.textContent = _t('err_local_user'); err.style.display = ''; return; }
    if (p1 !== p2) { err.textContent = _t('err_local_mismatch'); err.style.display = ''; return; }
    err.style.display = 'none'; state.userName = u; go('privacy');
  });

  /* 隐私开关 */
  document.addEventListener('click', function (e) {
    var sw = e.target.closest('.switch'); if (!sw) return;
    sw.classList.toggle('on');
    // v8.0：辅助功能开关同步到预览
    var row = sw.closest('[data-access]');
    if (row) {
      state.v8.access[row.dataset.access] = sw.classList.contains('on');
      v8SyncAccess();
    }
  });

  /* ============ v9.0 事件绑定 ============ */
  // 欢迎页：立即安装 → 先选安装源
  if ($('#welcomeInstall')) $('#welcomeInstall').addEventListener('click', function () { go('bootcheck'); });
  if ($('#welcomeUnattend')) $('#welcomeUnattend').addEventListener('click', function () { go('unattend'); });

  // 安装源
  if ($('#srcList')) $('#srcList').addEventListener('click', function (e) {
    var opt = e.target.closest('.opt'); if (!opt) return;
    $$('#srcList .opt').forEach(function (o) { o.classList.remove('sel'); });
    opt.classList.add('sel');
    state.v9.source = opt.dataset.src;
    $('#srcNext').disabled = false;
    v8Log('Installation source selected: ' + (_t('src_' + opt.dataset.src) || opt.dataset.src));
  });
  if ($('#srcNext')) $('#srcNext').addEventListener('click', function () {
    if (state.v9.source) toast(_t('src_selected', { n: _t('src_' + state.v9.source) }));
    go('image');
  });

  // 无人值守
  if ($('#uaPresets')) $('#uaPresets').addEventListener('click', function (e) {
    var row = e.target.closest('[data-ua]'); if (!row) return;
    var sw = row.querySelector('.switch'); if (!sw) return;
    sw.classList.toggle('on');
    state.v9.unattend[row.dataset.ua] = sw.classList.contains('on');
  });
  if ($('#uaStart')) $('#uaStart').addEventListener('click', function () { v9UaStart(); });
  if ($('#uaStop')) $('#uaStop').addEventListener('click', v9UaStop);
  if ($('#uaPause')) $('#uaPause').addEventListener('click', function () {
    state.v9.unattendPaused = !state.v9.unattendPaused;
    this.textContent = state.v9.unattendPaused ? _t('ua_continue') : _t('inst_pause');
  });

  // 磁盘清理
  if ($('#btnCleanup')) $('#btnCleanup').addEventListener('click', function () { go('cleanup'); });
  if ($('#clSkip')) $('#clSkip').addEventListener('click', function () { go('disk'); });
  if ($('#clClean')) $('#clClean').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true; btn.textContent = _t('cl_cleaning');
    var freed = 0;
    var rows = $$('#clList .cl-row');
    rows.forEach(function (r) {
      if (r.querySelector('.switch').classList.contains('on')) {
        freed += CL_CATS[Number(r.dataset.cl)].size;
        r.style.opacity = '.45';
      }
    });
    state.v9.cleaned = freed;
    v8Log('Disk cleanup: freed ' + freed + ' MB');
    later(function () {
      toast(_t('cl_done', { s: freed >= 1024 ? (freed / 1024).toFixed(1) + ' GB' : freed + ' MB' }));
      go('disk');
    }, 900);
  });

  // 人脸识别
  if ($('#facePin')) $('#facePin').addEventListener('click', function () { go('hello'); });

  // 两步验证
  var m2Code = $('#m2Code'), m2Verify = $('#m2Verify'), m2Err = $('#m2Err');
  if (m2Code) m2Code.addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 6);
    if (m2Verify) m2Verify.disabled = this.value.length !== 6;
    if (m2Err) m2Err.style.display = 'none';
  });
  if (m2Verify) m2Verify.addEventListener('click', function () {
    var v = m2Code ? m2Code.value.trim() : '';
    if (v.length !== 6) { if (m2Err) { m2Err.textContent = _t('m2_wrong'); m2Err.style.display = ''; } return; }
    state.v9.m2Done = true;
    v9Sfx('done');
    v8Log('Microsoft account: 2FA verification passed');
    go('privacy');
  });
  if ($('#m2Resend')) $('#m2Resend').addEventListener('click', function () {
    toast(_t('m2_sent'));
    v8Log('Microsoft account: verification code resent');
  });

  // 软件推荐
  function v9SyncBloat() {
    var n = 0;
    $$('#blList [data-bl]').forEach(function (row) {
      var on = !!state.v9.bloat[row.dataset.bl];
      var sw = row.querySelector('.switch');
      if (sw) sw.classList.toggle('on', on);
      if (on) n++;
    });
    var btn = $('#blNext');
    if (btn) btn.textContent = n ? _t('bl_install', { n: n }) : _t('connect_skip');
  }
  if ($('#blList')) $('#blList').addEventListener('click', function (e) {
    var row = e.target.closest('[data-bl]'); if (!row) return;
    var sw = row.querySelector('.switch'); if (!sw) return;
    sw.classList.toggle('on');
    state.v9.bloat[row.dataset.bl] = sw.classList.contains('on');
    v9SyncBloat();
  });
  if ($('#blSkipAll')) $('#blSkipAll').addEventListener('click', function () {
    Object.keys(state.v9.bloat).forEach(function (k) { state.v9.bloat[k] = false; });
    v9SyncBloat();
    v8Log('Recommended software: all skipped');
    go('custom');
  });
  if ($('#blNext')) $('#blNext').addEventListener('click', function () {
    var n = 0;
    Object.keys(state.v9.bloat).forEach(function (k) { if (state.v9.bloat[k]) n++; });
    if (n) {
      toast(_t('bl_done'));
      v8Log('Recommended software: ' + n + ' item(s) installed');
    }
    go('custom');
  });

  // 快速设置：音效开关（独立监听，避免与快捷开关逻辑耦合）
  var qpGrid = $('#quickPanel .qp-grid');
  if (qpGrid) qpGrid.addEventListener('click', function (e) {
    var b = e.target.closest('[data-qc="sound"]'); if (!b) return;
    state.v9.sound = !state.v9.sound;
    b.classList.toggle('on', state.v9.sound);
    try { localStorage.setItem('win11_v9_sound', state.v9.sound ? '1' : '0'); } catch (err) {}
    if (state.v9.sound) v9Sfx('click');
    toast(_t('snd_name') + '：' + (state.v9.sound ? _t('snd_on') : _t('snd_off')));
  });

  /* ============ v8.1 事件绑定 ============ */
  // 欢迎页
  if ($('#welcomeWhatsNew')) $('#welcomeWhatsNew').addEventListener('click', function () { go('whatsnew'); });
  if ($('#welcomeImport')) $('#welcomeImport').addEventListener('click', function () {
    var list = [];
    try { list = JSON.parse(localStorage.getItem('win11_hist') || '[]'); } catch (e) {}
    if (list.length) { go('hist'); }
    else { toast(_t('welcome_no_config')); }
  });
  if ($('#welcomeRepair')) $('#welcomeRepair').addEventListener('click', function () {
    openModal({
      title: _t('repair_title'),
      body: '<p>' + _t('repair_desc') + '</p>' +
        '<div class="repair-list">' +
        '<div class="repair-item" data-rp="startup"><b>' + _t('repair_startup') + '</b><span>' + _t('repair_startup_d') + '</span></div>' +
        '<div class="repair-item" data-rp="restore"><b>' + _t('repair_restore') + '</b><span>' + _t('repair_restore_d') + '</span></div>' +
        '<div class="repair-item" data-rp="cmd"><b>' + _t('repair_cmd') + '</b><span>' + _t('repair_cmd_d') + '</span></div>' +
        '<div class="repair-item" data-rp="uninstall"><b>' + _t('repair_uninstall') + '</b><span>' + _t('repair_uninstall_d') + '</span></div>' +
        '</div>',
      ok: _t('repair_exit'),
      cancel: null,
      onOk: function () { return true; },
      after: function () {
        $$('#modal .repair-item').forEach(function (el) {
          el.addEventListener('click', function () {
            var key = el.dataset.rp;
            var name = _t('repair_' + key);
            toast(_t('repair_running', { n: name }));
            v8Log('Repair tool: ' + name);
            later(function () {
              var doneKey = 'repair_' + key + '_ok';
              toast(_t(doneKey));
              v8Log('Repair finished: ' + _t(doneKey));
            }, 1400);
          });
        });
      }
    });
  });

  // 系统还原点
  if ($('#restoreToggle')) $('#restoreToggle').addEventListener('click', function () {
    this.classList.toggle('on');
    hooks.restore();
  });
  if ($('#restoreSkip')) $('#restoreSkip').addEventListener('click', function () {
    v8Log('Restore point skipped — proceeding to install');
    go('install');
  });
  if ($('#restoreNext')) $('#restoreNext').addEventListener('click', function () { go('install'); });

  // 设备加密
  if ($('#encryptToggle')) $('#encryptToggle').addEventListener('click', function () {
    this.classList.toggle('on');
    v8SyncEncrypt();
    v8Log('Device encryption ' + (this.classList.contains('on') ? 'enabled' : 'disabled'));
  });
  if ($('#encryptMore')) $('#encryptMore').addEventListener('click', function () {
    var d = $('#encryptDetail'); if (!d) return;
    var open = d.style.display === 'none' || !d.style.display;
    d.style.display = open ? '' : 'none';
    this.textContent = open ? _t('encrypt_less') : _t('encrypt_more');
  });
  if ($('#encryptBackup')) $('#encryptBackup').addEventListener('click', function () {
    toast(_t('encrypt_backup') + ' ✓');
  });

  // 新功能页
  if ($('#wnClose')) $('#wnClose').addEventListener('click', function () { v8Back(); });
  if ($('#doneWhatsNew')) $('#doneWhatsNew').addEventListener('click', function () { go('whatsnew'); });

  /* v8.0 事件绑定 ============ */
  if ($('#scanOpen')) $('#scanOpen').addEventListener('click', function () { go('scan'); });

  if ($('#speedChips')) $('#speedChips').addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    $$('#speedChips .chip').forEach(function (x) { x.classList.remove('on'); });
    b.classList.add('on');
    state.v8.speed = b.dataset.speed || 'standard';
    toast(_t('speed_title') + '：' + b.textContent);
  });

  if ($('#instOpenLog')) $('#instOpenLog').addEventListener('click', v8OpenLog);
  if ($('#logClose')) $('#logClose').addEventListener('click', v8CloseLog);
  if ($('#logPause')) $('#logPause').addEventListener('click', function () {
    state.v8.logPaused = !state.v8.logPaused;
    this.textContent = state.v8.logPaused ? _t('inst_resume') : _t('inst_pause');
    var badge = $('#logBadge');
    if (badge) {
      badge.textContent = state.v8.logPaused ? _t('log_paused') : _t('log_live');
      badge.classList.toggle('paused', state.v8.logPaused);
    }
  });
  if ($('#logExport')) $('#logExport').addEventListener('click', v8ExportLog);
  if ($('#logFilter')) $('#logFilter').addEventListener('input', function () { v8RenderLog(); });

  if ($('#v8Theme')) $('#v8Theme').addEventListener('click', function () {
    state.v8.dark = !state.v8.dark;
    v8ApplyDark();
  });
  function v8ToggleHelp() {
    var ov = $('#helpOverlay'); if (!ov) return;
    ov.classList.toggle('open');
  }
  if ($('#v8Help')) $('#v8Help').addEventListener('click', v8ToggleHelp);
  if ($('#helpClose')) $('#helpClose').addEventListener('click', v8ToggleHelp);

  if ($('#updSkip')) $('#updSkip').addEventListener('click', function () {
    if (v8UpdTimer) { clearInterval(v8UpdTimer); v8UpdTimer = 0; }
    go('privacy');
  });
  if ($('#updNext')) $('#updNext').addEventListener('click', function () { go('privacy'); });

  if ($('#sumExport')) $('#sumExport').addEventListener('click', function () {
    var edEl = document.querySelector('#editionList .opt.sel .opt__t');
    var edition = edEl ? edEl.textContent : (state.edition || 'Windows 11');
    var p = null;
    for (var i = 0; i < state.disk.length; i++) if (state.disk[i].id === state.selected) p = state.disk[i];
    var report = [
      'Windows 11 Setup Simulator 8.0 — Installation Report',
      'Generated: ' + new Date().toString(),
      '',
      'Edition       : ' + edition,
      'Device name   : ' + state.deviceName,
      'User name     : ' + state.userName,
      'Install target: ' + (p ? (diskName(p) + ' (' + fmtSize(p.total) + ')') : 'n/a'),
      'Speed profile : ' + state.v8.speed,
      'Started       : ' + new Date(state.v8.instStartAt || Date.now()).toString(),
      'Finished      : ' + new Date(state.v8.instEndAt || Date.now()).toString(),
      '',
      '--- Setup log ---',
      v8LogText()
    ].join('\n');
    fetch('/api/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'install-report.txt', content: report })
    }).then(function (r) { return r.json(); })
      .then(function () { toast(_t('sum_exported')); })
      .catch(function () { toast(_t('sum_exported')); });
  });

  /* 键盘快捷键 */
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      var lo = $('#logOverlay');
      if (lo && lo.classList.contains('open')) v8CloseLog(); else v8OpenLog();
      return;
    }
    if (e.key === 'Escape') {
      var lo2 = $('#logOverlay'), ho = $('#helpOverlay');
      if (lo2 && lo2.classList.contains('open')) { v8CloseLog(); return; }
      if (ho && ho.classList.contains('open')) { ho.classList.remove('open'); return; }
      v8Back();
    }
  });

  /* v8.0 初始化深色模式偏好 / v9.0 初始化音效偏好 */
  (function initV8Prefs() {
    try {
      if (localStorage.getItem('win11_v8_dark') === '1') state.v8.dark = true;
      if (localStorage.getItem('win11_v9_sound') === '1') state.v9.sound = true;
    } catch (e) {}
    v8ApplyDark();
    var sTile = $('#quickPanel [data-qc="sound"]');
    if (sTile) sTile.classList.toggle('on', state.v9.sound);
  })();

  /* 桌面图标 */
  $('#icoPC').addEventListener('dblclick', function () {
    AppWindows.open('explorer', { title: _t('icon_pc') });
  });
  $('#icoRecycle').addEventListener('dblclick', function () {
    AppWindows.open('recycle', { title: _t('icon_recycle') });
  });
  $('#icoSetup').addEventListener('dblclick', function () { AppWindows.open('setup'); });

  /* v4.0：启动应用（未实现的仍给出演示提示） */
  function openAppType(type) {
    if (!type) return;
    if (type === 'setup') { AppWindows.open('setup'); return; }
    AppWindows.open(type);
  }

  /* v3.1：开始菜单应用搜索（v4.0 同时覆盖所有应用列表） */
  function filterStartApps() {
    var input = $('#startSearch'), empty = $('#startNoResults');
    if (!input || !empty) return;
    var q = input.value.trim().toLowerCase(), visible = 0;
    $$('#startMenu .sm-app, #startMenu .sm-allapp').forEach(function (app) {
      var match = !q || app.textContent.toLowerCase().indexOf(q) >= 0;
      app.hidden = !match;
      if (match) visible++;
    });
    empty.hidden = visible !== 0;
  }
  function openStartSearch() {
    closeNotif();
    closeQuick();
    $('#startMenu').classList.add('open');
    var input = $('#startSearch');
    input.value = ''; filterStartApps();
    later(function () { try { input.focus(); } catch (e) {} }, 60);
  }
  function closeQuick() { var qp = $('#quickPanel'); if (qp) qp.classList.remove('open'); }

  /* v4.0：所有应用列表（由已固定的应用生成并按首字母分组） */
  var showAllApps = false;
  function buildAllApps() {
    var wrap = $('#allAppsList'); if (!wrap) return;
    var list = $$('#startMenu .sm-app').map(function (a) {
      var ico = a.querySelector('.i14');
      var labelEl = a.querySelector('[data-i18n]');
      var name = labelEl ? labelEl.textContent.trim() : a.textContent.trim();
      return {
        name: name, open: a.dataset.open,
        icon: ico ? ico.outerHTML.replace('<span class="i14', '<span class="i14 i14--sm') : ''
      };
    }).filter(function (x) { return x.open && x.name; });
    list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    var html = '', letter = '';
    list.forEach(function (x) {
      var l = x.name.charAt(0).toUpperCase();
      if (l !== letter) { letter = l; html += '<div class="sm-letter">' + l + '</div>'; }
      html += '<div class="sm-allapp" data-open="' + x.open + '">' + x.icon + x.name + '</div>';
    });
    wrap.innerHTML = html;
  }
  function toggleAllApps(force) {
    showAllApps = typeof force === 'boolean' ? force : !showAllApps;
    var list = $('#allAppsList'), grid = $('#startMenu .sm-grid'), btn = $('#allAppsBtn');
    if (!list || !grid || !btn) return;
    if (showAllApps) buildAllApps();
    list.hidden = !showAllApps;
    grid.style.display = showAllApps ? 'none' : '';
    btn.dataset.i18n = showAllApps ? 'start_back' : 'start_all_apps';
    btn.textContent = showAllApps ? _t('start_back') : _t('start_all_apps');
    filterStartApps();
  }

  /* 任务栏已打开窗口按钮（v3.0） */
  document.addEventListener('click', function (e) {
    var tw = e.target.closest('.tb-win');
    if (!tw) return;
    var id = tw.dataset.id, w = state.openWindows[id];
    if (!w) return;
    if (w.classList.contains('minimized') || !w.classList.contains('focused')) AppWindows.focus(id);
    else AppWindows.minimize(id);
  });

  /* 任务栏按钮（运行中的） */
  $$('.tb-btn.running').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var t = btn.dataset.winType; if (!t) return;
      // 查找已有实例
      var existing = null;
      Object.values(state.openWindows).forEach(function (w) { if (w.dataset.type === t) existing = w; });
      if (existing) {
        if (existing.classList.contains('minimized') || !existing.classList.contains('focused')) {
          AppWindows.focus(existing.dataset.id);
        } else {
          AppWindows.minimize(existing.dataset.id);
        }
      } else {
        AppWindows.open(t, { multi: true });
      }
    });
  });
  $$('.tb-btn:not(.running):not(#startBtn):not(#searchBtn):not(#widgetsBtn):not(#taskViewBtn)').forEach(function (btn) {
    btn.addEventListener('click', function () { toast(_t('toast_demo_unavailable', { name: btn.getAttribute('title') || '' })); });
  });
  // 开始菜单里的应用磁贴与所有应用列表
  $('#startMenu').addEventListener('click', function (e) {
    var app = e.target.closest('.sm-app, .sm-allapp'); if (!app) return;
    openAppType(app.dataset.open);
    closeStart();
  });
  var allAppsBtn = $('#allAppsBtn');
  if (allAppsBtn) allAppsBtn.addEventListener('click', function (e) {
    e.stopPropagation(); toggleAllApps();
  });

  /* 开始菜单与搜索 */
  $('#startBtn').addEventListener('click', function (e) {
    e.stopPropagation();
    if ($('#startMenu').classList.contains('open')) closeStart();
    else openStartSearch();
  });
  $('#startSearch').addEventListener('input', filterStartApps);
  $('#startSearch').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var first = $$('#startMenu .sm-app, #startMenu .sm-allapp').filter(function (app) { return !app.hidden; })[0];
    if (first) { e.preventDefault(); e.stopPropagation(); first.click(); }
  });
  $('#startMenu').addEventListener('click', function (e) { e.stopPropagation(); });
  $('#s-desktop').addEventListener('click', function (e) {
    if (!e.target.closest('.taskbar') && !e.target.closest('.dicon') && !e.target.closest('.app-window') && !e.target.closest('.start-menu')) {
      closeStart(); closeNotif(); closeQuick(); closeWidgets();
    }
  });

  /* v4.0：电源菜单 */
  var powerMenu = $('#powerMenu');
  $('#smPower').addEventListener('click', function (e) {
    e.stopPropagation();
    if (powerMenu) powerMenu.classList.toggle('open');
  });
  if (powerMenu) powerMenu.addEventListener('click', function (e) {
    var b = e.target.closest('[data-power]'); if (!b) return;
    powerMenu.classList.remove('open');
    closeStart();
    runPower(b.dataset.power);
  });
  function runPower(kind) {
    if (kind === 'lock') { openLockScreen(); return; }
    var ps = $('#powerScreen'), txt = $('#psText'), hint = $('#psHint');
    if (!ps) return;
    ps.classList.add('open'); ps.classList.remove('asleep');
    if (txt) txt.textContent = _t(kind === 'off' ? 'pw_shutting' : kind === 'restart' ? 'pw_restarting' : 'pw_sleeping');
    if (hint) hint.textContent = _t(kind === 'off' ? 'pw_off_hint' : 'pw_wake');
    if (kind === 'restart') {
      later(function () { ps.classList.remove('open', 'asleep'); AppWindows.closeAll(); }, 1900);
    } else if (kind === 'sleep') {
      later(function () { ps.classList.add('asleep'); }, 1100);
    } else {
      later(function () { ps.classList.add('asleep'); AppWindows.closeAll(); }, 1700);
    }
  }
  var powerScreen = $('#powerScreen');
  if (powerScreen) powerScreen.addEventListener('click', function () {
    if (!this.classList.contains('asleep')) return;
    this.classList.remove('open', 'asleep');
  });
  var lockScreen = $('#lockScreen');
  if (lockScreen) lockScreen.addEventListener('click', function (e) {
    if (e.target.closest('#lockSignin')) return;
    if (this.classList.contains('stage-signin')) return;
    showLockSignin();
  });
  var lockGoBtn = $('#lockGo'); if (lockGoBtn) lockGoBtn.addEventListener('click', signIn);
  var lockBackBtn = $('#lockBack');
  if (lockBackBtn) lockBackBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var lk = $('#lockScreen'); if (lk) lk.classList.remove('stage-signin');
  });
  var lockPassEl = $('#lockPass');
  if (lockPassEl) lockPassEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); signIn(); }
  });

  /* v5.0：全屏（F11 / 快速设置 / 设置） */
  function toggleFullscreen() {
    var d = document, el = d.documentElement;
    try {
      var active = d.fullscreenElement || d.webkitFullscreenElement;
      if (!active) {
        var req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (!req) { toast(_t('toast_full_fail')); return; }
        var p = req.call(el);
        if (p && p.catch) p.catch(function () { toast(_t('toast_full_fail')); });
        toast(_t('toast_full_on'));
      } else {
        var exit = d.exitFullscreen || d.webkitExitFullscreen;
        if (exit) exit.call(d);
        toast(_t('toast_full_off'));
      }
    } catch (e) { toast(_t('toast_full_fail')); }
  }
  document.addEventListener('click', function (e) {
    if (powerMenu && !e.target.closest('#powerMenu') && !e.target.closest('#smPower')) powerMenu.classList.remove('open');
  });

  /* 通知中心 */
  var notifBtn = $('#notifBtn');
  if (notifBtn) {
    notifBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeQuick();
      $('#notifCenter').classList.toggle('open');
    });
  }
  document.addEventListener('click', function (e) {
    var nc = $('#notifCenter');
    if (nc && nc.classList.contains('open') && !e.target.closest('#notifCenter') && !e.target.closest('#notifBtn')) {
      nc.classList.remove('open');
    }
    var qp = $('#quickPanel');
    if (qp && qp.classList.contains('open') && !e.target.closest('#quickPanel') && !e.target.closest('#qsBtn')) {
      qp.classList.remove('open');
    }
  });

  /* v4.0：快速设置 */
  var qsBtn = $('#qsBtn');
  if (qsBtn) qsBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    closeStart(); closeNotif();
    $('#quickPanel').classList.toggle('open');
    syncQuickPanel();
  });
  var quickPanel = $('#quickPanel');
  if (quickPanel) {
    quickPanel.addEventListener('click', function (e) { e.stopPropagation(); });
    quickPanel.querySelector('.qp-grid').addEventListener('click', function (e) {
      var b = e.target.closest('[data-qc]'); if (!b) return;
      var k = b.dataset.qc;
      // v9.0：音效磁贴由独立处理器管理（state.v9.sound），不纳入快捷开关状态
      if (k === 'sound') return;
      state.quickTiles[k] = !state.quickTiles[k];
      if (k === 'airplane' && state.quickTiles.airplane) {
        state.quickTiles.wifi = false; state.quickTiles.bt = false;
      } else if ((k === 'wifi' || k === 'bt') && state.quickTiles[k]) {
        state.quickTiles.airplane = false;
      }
      applyTheme(); savePrefs(); syncQuickPanel();
    });
    var br = $('#qsBright'), vol = $('#qsVol');
    if (br) br.addEventListener('input', function () {
      state.brightness = Number(br.value); $('#qsBrightVal').textContent = br.value; savePrefs();
    });
    if (vol) vol.addEventListener('input', function () {
      state.volume = Number(vol.value); $('#qsVolVal').textContent = vol.value; savePrefs();
    });
    var qsAll = $('#qsAll');
    if (qsAll) qsAll.addEventListener('click', function () {
      quickPanel.classList.remove('open');
      AppWindows.open('settings');
    });
    var qsFull = $('#qsFull');
    if (qsFull) qsFull.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleFullscreen();
    });
  }

  /* v4.0：日历 */
  var calYear = new Date().getFullYear(), calMonth = new Date().getMonth();
  function renderCalendar(y, m) {
    var grid = $('#calGrid'), week = $('#calWeek'), label = $('#calMonth');
    if (!grid || !week || !label) return;
    var locale = document.documentElement.lang || 'zh-CN';
    var first = new Date(y, m, 1);
    try {
      label.textContent = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(first);
    } catch (e) { label.textContent = y + '/' + (m + 1); }
    var wd = [];
    for (var i = 0; i < 7; i++) {
      try { wd.push(new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2024, 0, 7 + i))); }
      catch (e) { wd.push('SMTWTFS'.charAt(i)); }
    }
    week.innerHTML = wd.map(function (x) { return '<span>' + x + '</span>'; }).join('');
    var start = first.getDay();
    var days = new Date(y, m + 1, 0).getDate();
    var prevDays = new Date(y, m, 0).getDate();
    var today = new Date();
    var cells = '';
    for (var p = start - 1; p >= 0; p--) cells += '<div class="cal__day dim">' + (prevDays - p) + '</div>';
    for (var d = 1; d <= days; d++) {
      var isToday = d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
      cells += '<div class="cal__day' + (isToday ? ' today' : '') + '">' + d + '</div>';
    }
    var tail = 1;
    while ((start + days) % 7 !== 0) { cells += '<div class="cal__day dim">' + (tail++) + '</div>'; start++; }
    grid.innerHTML = cells;
  }
  var calPrev = $('#calPrev'), calNext = $('#calNext'), calToday = $('#calToday');
  if (calPrev) calPrev.addEventListener('click', function (e) {
    e.stopPropagation(); calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(calYear, calMonth);
  });
  if (calNext) calNext.addEventListener('click', function (e) {
    e.stopPropagation(); calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(calYear, calMonth);
  });
  if (calToday) calToday.addEventListener('click', function (e) {
    e.stopPropagation();
    var n = new Date(); calYear = n.getFullYear(); calMonth = n.getMonth(); renderCalendar(calYear, calMonth);
  });

  /* ============================================================
   * v6.0：任务视图、虚拟桌面、窗口切换、贴靠、搜索、小组件、锁屏
   * ============================================================ */
  function closeTaskView() { var tv = $('#taskView'); if (tv) tv.classList.remove('open'); }

  function switchDesktop(id) {
    var exists = state.desktops.some(function (d) { return d.id === id; });
    if (!exists) return;
    state.currentDesk = id;
    AppWindows._focusedId = null;
    AppWindows._onWindowChange();
    renderTaskView();
  }
  function createDesktop() {
    state.deskSeq++;
    state.desktops.push({ id: state.deskSeq, name: '' });
    state.currentDesk = state.deskSeq;
    AppWindows._focusedId = null;
    AppWindows._onWindowChange();
    renderTaskView();
    toast(_t('toast_desk_created'));
  }
  function closeDesktop(id) {
    if (state.desktops.length <= 1) return;
    Object.keys(state.openWindows).forEach(function (wid) {
      var w = state.openWindows[wid];
      if (String(w.dataset.desk || 1) === String(id)) AppWindows.close(wid);
    });
    state.desktops = state.desktops.filter(function (d) { return d.id !== id; });
    if (state.currentDesk === id) state.currentDesk = state.desktops[0].id;
    AppWindows._onWindowChange();
    renderTaskView();
    toast(_t('toast_desk_closed'));
  }
  function renderTaskView() {
    var tvDesks = $('#tvDesks'), tvWins = $('#tvWins');
    if (!tvDesks || !tvWins) return;
    tvDesks.innerHTML = state.desktops.map(function (d, i) {
      return '<div class="tv-desk' + (d.id === state.currentDesk ? ' active' : '') + '" data-desk="' + d.id + '">' +
        '<div class="tv-thumb"></div><div class="tv-desk-name"><span>' + _t('tv_desk', { n: i + 1 }) + '</span>' +
        (state.desktops.length > 1 ? '<button class="tv-desk-close" data-closedesk="' + d.id + '" title="' + _t('tv_close_desk') + '">×</button>' : '') +
        '</div></div>';
    }).join('');
    var html = '';
    Object.keys(state.openWindows).forEach(function (id) {
      var w = state.openWindows[id];
      if (String(w.dataset.desk || 1) !== String(state.currentDesk)) return;
      var title = (w.querySelector('.win-title') || {}).textContent || AppWindows._defaultTitle(w.dataset.type);
      html += '<div class="tv-win" data-win="' + id + '">' +
        '<button class="tw-close" data-winclose="' + id + '" title="' + _t('win_close') + '">×</button>' +
        '<div class="tw-hd">' + AppWindows._defaultIcon(w.dataset.type) + '<span>' + title + '</span></div>' +
        '<div class="tw-prev"></div></div>';
    });
    tvWins.innerHTML = html || '<div class="tv-empty">' + _t('tv_empty') + '</div>';
  }
  function openTaskView() {
    closeStart(); closeNotif(); closeQuick(); closeWidgets(); closeSearch();
    var tv = $('#taskView'); if (!tv) return;
    renderTaskView();
    tv.classList.add('open');
  }

  var taskViewEl = $('#taskView');
  if (taskViewEl) {
    taskViewEl.addEventListener('click', function (e) {
      if (e.target === this) { closeTaskView(); return; }
      var cd = e.target.closest('[data-closedesk]');
      if (cd) { e.stopPropagation(); closeDesktop(Number(cd.dataset.closedesk)); return; }
      var d = e.target.closest('[data-desk]');
      if (d) { switchDesktop(Number(d.dataset.desk)); return; }
      var wc = e.target.closest('[data-winclose]');
      if (wc) { e.stopPropagation(); AppWindows.close(wc.dataset.winclose); renderTaskView(); return; }
      var win = e.target.closest('[data-win]');
      if (win) { closeTaskView(); AppWindows.focus(win.dataset.win); }
    });
  }
  var tvClose = $('#tvClose'); if (tvClose) tvClose.addEventListener('click', closeTaskView);
  var tvNewDesk = $('#tvNewDesk'); if (tvNewDesk) tvNewDesk.addEventListener('click', createDesktop);
  var taskViewBtn = $('#taskViewBtn');
  if (taskViewBtn) taskViewBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var tv = $('#taskView');
    if (tv && tv.classList.contains('open')) closeTaskView();
    else openTaskView();
  });

  /* ---- Ctrl+Tab 窗口切换 ---- */
  var altOpen = false, altIndex = 0, altIds = [];
  function altCandidates() {
    var ids = Object.keys(state.openWindows).filter(function (id) {
      var w = state.openWindows[id];
      return String(w.dataset.desk || 1) === String(state.currentDesk);
    });
    ids.sort(function (a, b) {
      return Number(state.openWindows[b].style.zIndex || 0) - Number(state.openWindows[a].style.zIndex || 0);
    });
    return ids;
  }
  function renderAltTab() {
    var host = $('#altList'); if (!host) return;
    host.innerHTML = altIds.map(function (id, i) {
      var w = state.openWindows[id]; if (!w) return '';
      var title = (w.querySelector('.win-title') || {}).textContent || AppWindows._defaultTitle(w.dataset.type);
      return '<div class="at-card' + (i === altIndex ? ' sel' : '') + '" data-alt="' + i + '">' +
        '<div class="ac-prev"></div><div class="ac-name">' + AppWindows._defaultIcon(w.dataset.type) + '<span>' + title + '</span></div></div>';
    }).join('');
  }
  function openAltTab() {
    altIds = altCandidates();
    if (!altIds.length) return;
    altOpen = true; altIndex = 0;
    renderAltTab();
    $('#altTab').classList.add('open');
  }
  function commitAltTab() {
    if (!altOpen) return;
    var id = altIds[altIndex];
    altOpen = false;
    $('#altTab').classList.remove('open');
    if (id && state.openWindows[id]) AppWindows.focus(id);
  }
  function cancelAltTab() { altOpen = false; $('#altTab').classList.remove('open'); }
  var altTabEl = $('#altTab');
  if (altTabEl) altTabEl.addEventListener('click', function (e) {
    var card = e.target.closest('[data-alt]');
    if (card) { altIndex = Number(card.dataset.alt); commitAltTab(); return; }
    if (e.target === this) cancelAltTab();
  });

  /* ---- 全局搜索 ---- */
  var searchTab = 'all', searchResults = [];
  var SETTINGS_PAGES = ['home', 'update', 'system', 'multitask', 'bt', 'net', 'personal',
    'apps', 'account', 'time', 'privacy', 'versions', 'recovery', 'about'];
  function searchApps() {
    return $$('#startMenu .sm-app').map(function (a) {
      var labelEl = a.querySelector('[data-i18n]');
      return { kind: 'app', key: a.dataset.open, label: labelEl ? labelEl.textContent.trim() : a.textContent.trim() };
    }).filter(function (x) { return x.key && x.label; });
  }
  function searchSettings() {
    return SETTINGS_PAGES.map(function (p) {
      var label = p === 'about' ? _t('about_title') : _t('set_' + p);
      var descKey = 'set_' + p + '_desc';
      var desc = _t(descKey);
      return { kind: 'setting', key: p, label: label, desc: desc === descKey ? '' : desc };
    });
  }
  function searchFiles() {
    var out = [];
    Object.keys(state.tempFiles).forEach(function (n) {
      if (n !== 'settings.json') out.push({ kind: 'file', key: n, label: n, desc: _t('exp_temp'), file: n });
    });
    ['演示文档.docx', '工作计划.xlsx', '说明.txt'].forEach(function (n) {
      out.push({ kind: 'file', key: n, label: n, desc: _t('exp_docs'), doc: n });
    });
    return out;
  }
  function renderSearch() {
    var list = $('#searchList'), input = $('#globalSearch');
    if (!list || !input) return;
    var q = input.value.trim().toLowerCase();
    var all = [];
    if (searchTab === 'all' || searchTab === 'apps') all = all.concat(searchApps());
    if (searchTab === 'all' || searchTab === 'settings') all = all.concat(searchSettings());
    if (searchTab === 'all' || searchTab === 'files') all = all.concat(searchFiles());
    if (q) all = all.filter(function (x) { return (x.label + ' ' + (x.desc || '')).toLowerCase().indexOf(q) >= 0; });
    all = all.slice(0, 24);
    searchResults = all;
    list.innerHTML = all.length ? all.map(function (x, i) {
      var ico = x.kind === 'app' ? AppWindows._defaultIcon(x.key)
        : x.kind === 'setting'
          ? '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.6" stroke="currentColor" stroke-width="1.3"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2" stroke="currentColor" stroke-width="1.3"/></svg>'
          : '<svg viewBox="0 0 16 16" fill="none"><path d="M4 2h5l3 3v9H4V2Z" stroke="currentColor" stroke-width="1.2"/><path d="M6 7.5h4M6 9.8h4M6 12h2.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>';
      return '<button class="search-item' + (i === 0 ? ' sel' : '') + '" data-si="' + i + '">' +
        '<span class="si-ico">' + ico + '</span><span><span class="si-t">' + x.label + '</span>' +
        (x.desc ? '<span class="si-d">' + x.desc + '</span>' : '') + '</span></button>';
    }).join('') : '<div class="search-empty">' + _t('search_none') + '</div>';
  }
  function openSearchItem(i) {
    var x = searchResults[i]; if (!x) return;
    closeSearch();
    if (x.kind === 'app') openAppType(x.key);
    else if (x.kind === 'setting') openSettingsPage(x.key);
    else if (x.kind === 'file') {
      if (x.file) AppWindows.open('notepad', { multi: true, file: x.file, content: state.tempFiles[x.file] || '' });
      else AppWindows.open('explorer', { path: 'docs' });
    }
  }
  function openSearch() {
    closeStart(); closeNotif(); closeQuick(); closeWidgets(); closeTaskView();
    var ov = $('#searchOverlay'); if (!ov) return;
    searchTab = 'all';
    $$('#searchOverlay [data-search-tab]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.searchTab === 'all');
    });
    var input = $('#globalSearch');
    if (input) input.value = '';
    renderSearch();
    ov.classList.add('open');
    later(function () { try { if (input) input.focus(); } catch (e) { /* 忽略 */ } }, 80);
  }
  function closeSearch() { var ov = $('#searchOverlay'); if (ov) ov.classList.remove('open'); }

  var searchOverlayEl = $('#searchOverlay');
  if (searchOverlayEl) {
    searchOverlayEl.addEventListener('click', function (e) {
      if (e.target === this) { closeSearch(); return; }
      var tabBtn = e.target.closest('[data-search-tab]');
      if (tabBtn) {
        searchTab = tabBtn.dataset.searchTab;
        $$('#searchOverlay [data-search-tab]').forEach(function (b) {
          b.classList.toggle('on', b.dataset.searchTab === searchTab);
        });
        renderSearch();
        return;
      }
      var item = e.target.closest('[data-si]');
      if (item) openSearchItem(Number(item.dataset.si));
    });
  }
  var globalSearchEl = $('#globalSearch');
  if (globalSearchEl) {
    globalSearchEl.addEventListener('input', renderSearch);
    globalSearchEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); openSearchItem(0); }
    });
  }
  var searchBtnEl = $('#searchBtn');
  if (searchBtnEl) searchBtnEl.addEventListener('click', function (e) { e.stopPropagation(); openSearch(); });
  var searchCloseEl = $('#searchClose'); if (searchCloseEl) searchCloseEl.addEventListener('click', closeSearch);

  /* ---- 小组件 ---- */
  function renderWidgetsCalendar() {
    var big = $('#wgCalBig'), date = $('#wgCalDate'), grid = $('#wgCalGrid');
    if (!big || !grid) return;
    var n = new Date();
    big.textContent = String(n.getDate());
    if (date) {
      try {
        date.textContent = new Intl.DateTimeFormat(document.documentElement.lang || 'zh-CN',
          { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(n);
      } catch (e) { date.textContent = n.toLocaleDateString(); }
    }
    var start = new Date(n.getFullYear(), n.getMonth(), 1).getDay();
    var days = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
    var cells = '';
    for (var i = 0; i < start; i++) cells += '<span></span>';
    for (var d = 1; d <= days; d++) cells += '<span class="' + (d === n.getDate() ? 'today' : '') + '">' + d + '</span>';
    grid.innerHTML = cells;
  }
  function closeWidgets() { var p = $('#widgetsPanel'); if (p) p.classList.remove('open'); }
  function toggleWidgets(force) {
    var p = $('#widgetsPanel'); if (!p) return;
    var open = typeof force === 'boolean' ? force : !p.classList.contains('open');
    if (open) { closeStart(); closeNotif(); closeQuick(); closeTaskView(); closeSearch(); renderWidgetsCalendar(); }
    p.classList.toggle('open', open);
  }
  var widgetsBtn = $('#widgetsBtn');
  if (widgetsBtn) widgetsBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleWidgets(); });
  var wgCloseEl = $('#wgClose'); if (wgCloseEl) wgCloseEl.addEventListener('click', closeWidgets);
  var wgPersonEl = $('#wgPersonalize');
  if (wgPersonEl) wgPersonEl.addEventListener('click', function () { closeWidgets(); openSettingsPage('personal'); });
  var wgPanelEl = $('#widgetsPanel');
  if (wgPanelEl) wgPanelEl.addEventListener('click', function (e) { e.stopPropagation(); });

  /* ---- 贴靠布局 ---- */
  var snapPickerEl = $('#snapPicker');
  if (snapPickerEl) {
    snapPickerEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-snap]'); if (!b) return;
      var id = state._snapTarget;
      snapPickerEl.classList.remove('open');
      if (id && state.openWindows[id]) AppWindows.snap(id, b.dataset.snap);
    });
  }
  document.addEventListener('click', function (e) {
    if (snapPickerEl && snapPickerEl.classList.contains('open') &&
        !e.target.closest('#snapPicker') && !e.target.closest('.win-btn.max')) {
      snapPickerEl.classList.remove('open');
    }
    if (wgPanelEl && wgPanelEl.classList.contains('open') &&
        !e.target.closest('#widgetsPanel') && !e.target.closest('#widgetsBtn')) {
      wgPanelEl.classList.remove('open');
    }
  });

  /* ---- 锁屏两阶段登录 ---- */
  function openLockScreen() {
    var lk = $('#lockScreen'); if (!lk) return;
    lk.classList.add('open');
    lk.classList.remove('stage-signin');
    var nm = state.userName || 'Administrator', initial = nm.charAt(0).toUpperCase();
    ['#lockUser', '#lsUser'].forEach(function (s) { var el = $(s); if (el) el.textContent = nm; });
    ['#lockAvatar', '#lsAvatar'].forEach(function (s) { var el = $(s); if (el) el.textContent = initial; });
    var pass = $('#lockPass'); if (pass) pass.value = '';
  }
  function showLockSignin() {
    var lk = $('#lockScreen'); if (!lk) return;
    lk.classList.add('stage-signin');
    later(function () { var p = $('#lockPass'); if (p) { try { p.focus(); } catch (e) { /* 忽略 */ } } }, 80);
  }
  function signIn() {
    var lk = $('#lockScreen'); if (!lk) return;
    lk.classList.remove('open', 'stage-signin');
    toast(_t('lock_signin'));
  }

  /* v4.0：桌面右键菜单与新建文件夹 */
  var ctxMenu = $('#ctxMenu');
  $('#s-desktop').addEventListener('contextmenu', function (e) {
    if (!ctxMenu) return;
    if (e.target.closest('.app-window') || e.target.closest('.taskbar') ||
        e.target.closest('.start-menu') || e.target.closest('input, textarea')) return;
    e.preventDefault();
    closeStart(); closeNotif(); closeQuick();
    ctxMenu.classList.add('open');
    var w = ctxMenu.offsetWidth, h = ctxMenu.offsetHeight;
    ctxMenu.style.left = Math.max(4, Math.min(e.clientX, this.clientWidth - w - 8)) + 'px';
    ctxMenu.style.top = Math.max(4, Math.min(e.clientY, this.clientHeight - h - 58)) + 'px';
  });
  if (ctxMenu) ctxMenu.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ctx]'); if (!b) return;
    var act = b.dataset.ctx;
    ctxMenu.classList.remove('open');
    if (act === 'refresh') toast(_t('toast_refreshed'));
    else if (act === 'folder') createDesktopFolder();
    else if (act === 'personalize') openSettingsPage('personal');
    else if (act === 'display') openSettingsPage('system');
    else if (act === 'terminal') AppWindows.open('cmd');
  });
  function openSettingsPage(page) {
    var w = AppWindows.open('settings');
    if (!w) return;
    var b = w.querySelector('.settings, .win-body');
    if (b) AppWindows._renderSettings(b, page);
  }
  function createDesktopFolder() {
    state.folderSeq++;
    var name = _t('folder_new') + (state.folderSeq > 1 ? ' (' + state.folderSeq + ')' : '');
    var el = document.createElement('div');
    el.className = 'dicon';
    el.innerHTML =
      '<svg width="38" height="38" viewBox="0 0 48 48"><path d="M5 14a3 3 0 0 1 3-3h10l3 4.5h19a3 3 0 0 1 3 3V38a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V14Z" fill="#f5c04a" stroke="#e0b03c" stroke-width="1.2"/></svg>' +
      '<span></span>';
    el.querySelector('span').textContent = name;
    el.addEventListener('dblclick', function () {
      AppWindows.open('explorer', { title: name, path: 'desktop' });
    });
    var icons = $('#deskIcons');
    if (icons) icons.appendChild(el);
    toast(_t('toast_folder_created', { name: name }));
  }
  document.addEventListener('click', function (e) {
    if (ctxMenu && !e.target.closest('#ctxMenu')) ctxMenu.classList.remove('open');
  });

  /* 弹窗 */
  $('#mOk').addEventListener('click', function () { if (okHandler && okHandler() === false) return; closeModal(); });
  $('#mCancel').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });

  /* 全局键盘 */
  document.addEventListener('keydown', function (e) {
    var lockLay = $('#lockScreen');
    if (lockLay && lockLay.classList.contains('open')) {
      if (lockLay.classList.contains('stage-signin')) {
        if (e.key === 'Escape') { e.preventDefault(); lockLay.classList.remove('stage-signin'); }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); return; }
      showLockSignin();
      e.preventDefault();
      return;
    }
    if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); return; }
    // v6.0：Ctrl+Shift+F 全局搜索、Ctrl+Tab 窗口切换、Ctrl+Alt+方向键贴靠
    if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
      e.preventDefault(); openSearch(); return;
    }
    if (e.ctrlKey && e.key === 'Tab') {
      e.preventDefault();
      if (!altOpen) openAltTab();
      else if (altIds.length) { altIndex = (altIndex + 1) % altIds.length; renderAltTab(); }
      return;
    }
    if (e.ctrlKey && e.altKey && AppWindows._focusedId) {
      var fid = AppWindows._focusedId, fw = state.openWindows[fid];
      if (fw) {
        if (e.key === 'ArrowLeft') { e.preventDefault(); AppWindows.snap(fid, 'left'); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); AppWindows.snap(fid, 'right'); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); AppWindows.snap(fid, 'full'); return; }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (fw.dataset.maxed === '1' || fw.dataset._snapped === '1') AppWindows.restore(fid);
          return;
        }
      }
    }
    var ps = $('#powerScreen');
    if (ps && ps.classList.contains('asleep')) {
      ps.classList.remove('open', 'asleep'); e.preventDefault(); return;
    }
    // Shift+F10 命令提示符（安装中 / 桌面都能用）
    if (e.shiftKey && e.key === 'F10') {
      e.preventDefault();
      AppWindows.open('cmd');
      return;
    }
    if (e.altKey && e.key === 'F4' && AppWindows._focusedId) {
      e.preventDefault(); AppWindows.close(AppWindows._focusedId); return;
    }
    if (e.key === 'Escape') {
      if (modalOpen) { closeModal(); return; }
      var so = $('#searchOverlay'), tvEl2 = $('#taskView'), sp = $('#snapPicker'), wp = $('#widgetsPanel');
      if ((so && so.classList.contains('open')) || (tvEl2 && tvEl2.classList.contains('open')) ||
          (sp && sp.classList.contains('open')) || (wp && wp.classList.contains('open')) || altOpen) {
        closeSearch(); closeTaskView(); closeWidgets(); cancelAltTab();
        if (sp) sp.classList.remove('open');
        return;
      }
      var qp = $('#quickPanel'), cm = $('#ctxMenu'), pm = $('#powerMenu');
      if ($('#startMenu').classList.contains('open') || $('#notifCenter').classList.contains('open') ||
          (qp && qp.classList.contains('open')) || (cm && cm.classList.contains('open')) || (pm && pm.classList.contains('open'))) {
        closeStart(); closeNotif();
        if (qp) qp.classList.remove('open');
        if (cm) cm.classList.remove('open');
        if (pm) pm.classList.remove('open');
        return;
      }
      if (AppWindows._focusedId && state.openWindows[AppWindows._focusedId]) {
        AppWindows.close(AppWindows._focusedId); return;
      }
      return;
    }
    if (modalOpen) { if (e.key === 'Enter') { e.preventDefault(); $('#mOk').click(); } return; }

    var tag = (e.target.tagName || '').toLowerCase();
    var inInput = tag === 'input' || tag === 'select' || tag === 'textarea';
    var nativeEnter = tag === 'select' || tag === 'textarea' || tag === 'button';

    // 文本框里也可按 Enter 进入下一步；按钮、下拉框保留原生键盘行为。
    if (e.key === 'Enter' && !nativeEnter) {
      var a = $('.screen.active');
      var btn = a ? a.querySelector('[data-enter]') : null;
      if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
      return;
    }
    if (!inInput && !e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'd' || e.key === 'D')) {
      return;
    }
  });
  document.addEventListener('keyup', function (e) {
    if (e.key === 'Control' && altOpen) commitAltTab();
  });

  /* ============================================================
   * v10.0 大型更新
   * 安装助手 / 性能监视器 / Wi-Fi 扫描 / 配置导入导出 /
   * 成就系统 / 安装时间线 / 故障诊断中心 / 分区布局图
   * ============================================================ */
  state.v10 = {
    ach: {}, timeline: [], prev: null,
    diagSym: 0, diagDone: false
  };
  var ACH_KEY = 'win11_v10_ach', TL_KEY = 'win11_v10_timeline';
  var V10_ACH_ICONS = { 1: '🚀', 2: '⚡', 3: '🤖', 4: '🙂', 5: '💽', 6: '🩺', 7: '⏱️', 8: '🧩' };

  (function v10LoadAch() {
    try {
      var raw = localStorage.getItem(ACH_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === 'object') state.v10.ach = o;
      }
      var tlr = localStorage.getItem(TL_KEY);
      if (tlr) {
        var arr = JSON.parse(tlr);
        if (Array.isArray(arr)) state.v10.timeline = arr;
      }
    } catch (e) { /* 忽略损坏数据 */ }
  })();

  function v10SaveAch() {
    try { localStorage.setItem(ACH_KEY, JSON.stringify(state.v10.ach)); } catch (e) { }
  }
  function v10AchCount() {
    var n = 0;
    Object.keys(V10_ACH_ICONS).forEach(function (k) { if (state.v10.ach[k]) n++; });
    return n;
  }
  function v10Unlock(id) {
    if (state.v10.ach[id]) return;
    state.v10.ach[id] = Date.now();
    v10SaveAch();
    var name = _t('ach_n' + id);
    toast(_t('ach_toast', { n: name }));
    v8Log('Achievement unlocked: ' + name);
    v9Sfx('done');
    v10RenderAch();
  }
  function v10RenderAch() {
    var host = $('#achGrid');
    if (!host) return;
    var html = '';
    Object.keys(V10_ACH_ICONS).forEach(function (k) {
      var on = !!state.v10.ach[k];
      html += '<div class="ach-card' + (on ? ' on' : '') + '">' +
        '<span class="ac-ic">' + V10_ACH_ICONS[k] + '</span>' +
        '<div><b>' + _t('ach_n' + k) + '</b><span>' + _t('ach_d' + k) + '</span></div></div>';
    });
    host.innerHTML = html;
    var prog = $('#achProg');
    if (prog) prog.textContent = _t('ach_progress', { a: v10AchCount(), b: 8 });
  }
  function v10OpenAch() {
    v10RenderAch();
    var el = $('#achOverlay'); if (el) el.classList.add('open');
  }

  /* ---- 安装助手 ---- */
  function v10CopilotUpdate(id) {
    var cur = id || (location.hash || '').replace('#', '') || 'boot';
    var nameEl = $('#cpScreen'), hintEl = $('#cpHint');
    if (!nameEl) return;
    var host = document.getElementById('s-' + cur);
    var h = host ? (host.querySelector('h1') || host.querySelector('.dialog__title')) : null;
    nameEl.textContent = h ? h.textContent.trim() : cur;
    var key = 'cp_hint_' + cur, txt = _t(key);
    if (!txt || txt === key) txt = _t('cp_hint_default');
    if (hintEl) hintEl.textContent = txt;
  }
  function v10CopilotToggle(force) {
    var p = $('#copilotPanel'); if (!p) return;
    var open = typeof force === 'boolean' ? force : !p.classList.contains('open');
    p.classList.toggle('open', open);
    var b = $('#v10Copilot'); if (b) b.classList.toggle('on', open);
    if (open) v10CopilotUpdate();
  }

  /* ---- 安装时间线 ---- */
  function v10Note(id) {
    var tl = state.v10.timeline, now = Date.now();
    if (state.v10.prev) state.v10.prev.dur = now - state.v10.prev.at;
    var host = document.getElementById('s-' + id);
    var h = host ? (host.querySelector('h1') || host.querySelector('.dialog__title')) : null;
    var item = { id: id, name: h ? h.textContent.trim() : id, at: now, dur: 0 };
    tl.push(item);
    if (tl.length > 60) tl.shift();
    state.v10.prev = item;
    try { localStorage.setItem(TL_KEY, JSON.stringify(tl)); } catch (e) { }
    v10CopilotUpdate(id);
    // 成就触发点
    if (id === 'desktop') {
      v10Unlock(1);
      if (state.v8.speed === 'demo') v10Unlock(2);
      if (state.v9.unattend.on) v10Unlock(3);
    }
    if (id === 'bootmenu') v10Unlock(5);
    if (id !== 'face' && state.v9.faceDone) v10Unlock(4);
  }
  function v10RenderTimeline() {
    var host = $('#tlList'), tot = $('#tlTotal');
    if (!host) return;
    var tl = state.v10.timeline.filter(function (x) { return x.id !== 'boot'; });
    if (!tl.length) {
      host.innerHTML = '<div class="tl-empty">' + _t('tl_empty') + '</div>';
      if (tot) tot.textContent = '—';
      return;
    }
    var html = '', total = 0;
    tl.forEach(function (item) {
      total += item.dur || 0;
      html += '<div class="tl-item"><span class="tl-dot"></span><b>' + (item.name || item.id) + '</b>' +
        '<i>' + (item.dur ? Math.round(item.dur / 1000) + 's' : '—') + '</i></div>';
    });
    host.innerHTML = html;
    if (tot) tot.textContent = _t('tl_total', { t: Math.round(total / 1000) + 's' });
  }
  function v10OpenTimeline() {
    v10RenderTimeline();
    var el = $('#timeOverlay'); if (el) el.classList.add('open');
  }
  function v10ReplayTimeline() {
    var items = $$('#tlList .tl-item');
    if (!items.length) { toast(_t('tl_empty')); return; }
    items.forEach(function (el) { el.classList.remove('playing'); });
    toast(_t('tl_replaying'));
    v8Log('Timeline replay started (' + items.length + ' steps)');
    var i = 0;
    (function step() {
      if (i >= items.length) { v10Unlock(7); toast(_t('tl_done')); return; }
      items[i].classList.add('playing');
      try { items[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { }
      i++;
      later(step, 420);
    })();
  }

  /* ---- 性能监视器 ---- */
  var PERF_MAX = 40, perfTimer = 0;
  var perfData = { cpu: [], disk: [], net: [] };
  function v10PerfWalk(arr, base, amp) {
    var last = arr.length ? arr[arr.length - 1] : base;
    var v = Math.max(3, Math.min(99, last + (Math.random() - 0.5) * amp));
    arr.push(v);
    if (arr.length > PERF_MAX) arr.shift();
  }
  function v10PerfPush() {
    v10PerfWalk(perfData.cpu, 58, 26);
    v10PerfWalk(perfData.disk, 72, 34);
    v10PerfWalk(perfData.net, 32, 22);
    v10PerfDraw();
  }
  function v10PerfDraw() {
    var svg = $('#perfChart'); if (!svg) return;
    var colors = { cpu: '#0067c0', disk: '#0f7b3f', net: '#c07a00' };
    var html = '';
    ['cpu', 'disk', 'net'].forEach(function (key) {
      var arr = perfData[key]; if (arr.length < 2) return;
      var pts = arr.map(function (v, i) {
        var x = (i / (PERF_MAX - 1)) * 320;
        var y = 88 - (v / 100) * 82;
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      html += '<polyline fill="none" stroke="' + colors[key] + '" stroke-width="1.6" stroke-linejoin="round" points="' + pts + '"/>';
    });
    svg.innerHTML = html;
  }
  function v10PerfStart() {
    if (perfTimer) clearInterval(perfTimer);
    perfData = { cpu: [], disk: [], net: [] };
    for (var i = 0; i < 14; i++) {
      v10PerfWalk(perfData.cpu, 58, 26);
      v10PerfWalk(perfData.disk, 72, 34);
      v10PerfWalk(perfData.net, 32, 22);
    }
    v10PerfDraw();
    perfTimer = setInterval(v10PerfPush, 700);
    timers.push(perfTimer);
  }

  /* ---- 分区布局图 ---- */
  function v10RenderDiskMap() {
    var host = $('#diskMap'); if (!host) return;
    var total = 0;
    state.disk.forEach(function (p) { total += p.total; });
    if (!total) { host.innerHTML = ''; return; }
    var colors = ['#0067c0', '#2f9bf0', '#0f7b3f', '#c07a00', '#7a3fbf', '#c42b1c'];
    var html = '';
    state.disk.forEach(function (p, i) {
      var w = Math.max(5, (p.total / total) * 100);
      var isFree = p.kind === 'unallocated' || p.unallocated;
      var cls = 'diskmap__seg' + (isFree ? ' free' : '') + (state.selected === p.id ? ' sel' : '');
      var label = isFree ? _t('diskmap_free') : diskName(p);
      var bg = isFree ? '' : 'background:' + colors[i % colors.length] + ';';
      html += '<div class="' + cls + '" data-id="' + p.id + '" style="width:' + w.toFixed(2) + '%;' + bg + '" title="' + label + '">' + label + '</div>';
    });
    host.innerHTML = html;
  }
  var v10OrigRenderDisk = renderDisk;
  renderDisk = function () {
    var r = v10OrigRenderDisk.apply(null, arguments);
    v10RenderDiskMap();
    return r;
  };

  /* ---- Wi-Fi ---- */
  function v10WifiConnect(w) {
    $$('#wifiList .wifi').forEach(function (x) { x.classList.remove('on'); });
    w.classList.add('on');
    var s = $('#wifiStatus');
    if (s) s.textContent = _t('toast_wifi_connecting', { ssid: w.dataset.ssid });
    var nx = $('#netNext'); if (nx) nx.disabled = true;
    v8Log('Wi-Fi: connecting to ' + w.dataset.ssid);
    later(function () {
      if (s) s.textContent = _t('wifi_connected', { n: w.dataset.ssid });
      if (nx) nx.disabled = false;
    }, 1400);
  }
  function v10AskWifi(w) {
    var ssid = w.dataset.ssid;
    openModal({
      title: _t('wifi_pwd_title'),
      body: '<p>' + _t('wifi_pwd_desc', { n: ssid }) + '</p>' +
        '<input class="inp" id="wifiPwd" type="password" autocomplete="off" placeholder="' + _t('wifi_pwd_ph') + '" style="margin-top:10px;">' +
        '<div class="cfg-hint err" id="wifiPwdErr" style="display:none;">' + _t('wifi_pwd_short') + '</div>',
      ok: _t('wifi_connect'),
      cancel: _t('modal_default_cancel'),
      onOk: function () {
        var el = document.getElementById('wifiPwd');
        var v = el ? el.value : '';
        if (v.length < 8) {
          var er = document.getElementById('wifiPwdErr');
          if (er) er.style.display = '';
          return false;
        }
        v10WifiConnect(w);
        return true;
      }
    });
  }

  /* ---- 配置导出 / 导入 ---- */
  function v10ConfigSnapshot() {
    var p = null;
    for (var i = 0; i < state.disk.length; i++) if (state.disk[i].id === state.selected) p = state.disk[i];
    var ed = document.querySelector('#editionList .opt.sel .opt__t');
    return {
      app: 'Windows 11 Setup Simulator',
      version: '10.0',
      edition: ed ? ed.textContent.trim() : (state.edition || ''),
      deviceName: state.deviceName,
      userName: state.userName,
      partition: p ? { id: p.id, size: p.total } : null,
      source: state.v9.source || '',
      speed: state.v8.speed,
      unattend: state.v9.unattend,
      bloat: state.v9.bloat,
      dark: !!state.v8.dark,
      sound: !!state.v9.sound
    };
  }
  function v10OpenCfg() {
    var ta = $('#cfgText'), hint = $('#cfgHint');
    if (!ta) return;
    try { ta.value = JSON.stringify(v10ConfigSnapshot(), null, 2); } catch (e) { }
    if (hint) { hint.textContent = ''; hint.className = 'cfg-hint'; }
    var el = $('#cfgOverlay'); if (el) el.classList.add('open');
  }
  function v10ApplyCfg() {
    var ta = $('#cfgText'), hint = $('#cfgHint');
    if (!ta) return;
    var obj;
    try { obj = JSON.parse(ta.value); } catch (e) { obj = null; }
    if (!obj || typeof obj !== 'object') {
      if (hint) { hint.textContent = _t('cfg_invalid'); hint.className = 'cfg-hint err'; }
      return;
    }
    if (typeof obj.deviceName === 'string' && obj.deviceName.trim()) {
      state.deviceName = obj.deviceName.trim();
      if ($('#deviceInput')) $('#deviceInput').value = state.deviceName;
    }
    if (typeof obj.userName === 'string' && obj.userName.trim()) state.userName = obj.userName.trim();
    if (obj.source) state.v9.source = obj.source;
    if (obj.speed) state.v8.speed = obj.speed;
    if (obj.unattend && typeof obj.unattend === 'object') {
      Object.keys(state.v9.unattend).forEach(function (k) {
        if (k in obj.unattend) state.v9.unattend[k] = !!obj.unattend[k];
      });
    }
    if (obj.bloat && typeof obj.bloat === 'object') {
      Object.keys(state.v9.bloat).forEach(function (k) {
        if (k in obj.bloat) state.v9.bloat[k] = !!obj.bloat[k];
      });
    }
    if (typeof obj.sound === 'boolean') {
      state.v9.sound = obj.sound;
      var tile = $('#quickPanel [data-qc="sound"]');
      if (tile) tile.classList.toggle('on', obj.sound);
    }
    if (typeof obj.dark === 'boolean') { state.v8.dark = obj.dark; v8ApplyDark(); }
    if (hint) { hint.textContent = _t('cfg_applied'); hint.className = 'cfg-hint ok'; }
    v8Log('Configuration imported from JSON');
  }

  /* ---- 故障诊断 ---- */
  function v10DiagEnter() {
    state.v10.diagSym = 0;
    state.v10.diagDone = false;
    var steps = $('#diagSteps'); if (steps) steps.innerHTML = '';
    var res = $('#diagResult'); if (res) res.style.display = 'none';
    var fix = $('#diagFix'); if (fix) fix.style.display = 'none';
    var run = $('#diagRun'); if (run) { run.disabled = false; run.textContent = _t('diag_run'); }
    $$('#diagSyms .opt').forEach(function (o) { o.classList.remove('sel'); });
  }
  function v10DiagRun() {
    if (!state.v10.diagSym) { toast(_t('diag_none')); return; }
    var steps = $('#diagSteps'); if (!steps) return;
    var keys = ['diag_step1', 'diag_step2', 'diag_step3'];
    steps.innerHTML = keys.map(function (k) {
      return '<div class="diag-step"><span class="ds-ic"></span><span>' + _t(k) + '</span></div>';
    }).join('');
    var els = $$('#diagSteps .diag-step');
    var run = $('#diagRun'); if (run) { run.disabled = true; run.textContent = _t('diag_running'); }
    els.forEach(function (el, i) {
      later(function () { el.classList.add('run'); }, i * 900);
    });
    later(function () {
      els.forEach(function (el) { el.classList.remove('run'); el.classList.add('done'); });
    }, 2900);
    later(function () {
      var res = $('#diagResult'), txt = $('#diagResultText');
      if (res) res.style.display = '';
      if (txt) txt.textContent = _t('diag_r' + state.v10.diagSym);
      var fix = $('#diagFix'); if (fix) fix.style.display = '';
      if (run) { run.disabled = false; run.textContent = _t('diag_run'); }
      v8Log('Diagnostics: symptom #' + state.v10.diagSym + ' analyzed');
    }, 3200);
  }

  /* ---- 事件绑定 ---- */
  if ($('#v10Copilot')) $('#v10Copilot').addEventListener('click', function () { v10CopilotToggle(); });
  if ($('#cpClose')) $('#cpClose').addEventListener('click', function () { v10CopilotToggle(false); });
  if ($('#copilotPanel')) $('#copilotPanel').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cp]'); if (!b) return;
    var act = b.dataset.cp;
    if (act === 'log') v8OpenLog();
    else if (act === 'help') { var ov = $('#helpOverlay'); if (ov) ov.classList.toggle('open'); }
    else if (act === 'ach') v10OpenAch();
    else if (act === 'time') v10OpenTimeline();
  });

  if ($('#instPerfToggle')) $('#instPerfToggle').addEventListener('click', function () {
    var box = $('#instPerf'); if (!box) return;
    var open = box.style.display === 'none';
    box.style.display = open ? '' : 'none';
    this.textContent = open ? _t('perf_hide') : _t('perf_show');
    if (open) { v10PerfStart(); v10PerfDraw(); }
  });

  if ($('#instDiag')) $('#instDiag').addEventListener('click', function () { go('diag'); });
  if ($('#diagSyms')) $('#diagSyms').addEventListener('click', function (e) {
    var opt = e.target.closest('.opt'); if (!opt) return;
    $$('#diagSyms .opt').forEach(function (o) { o.classList.remove('sel'); });
    opt.classList.add('sel');
    state.v10.diagSym = Number(opt.dataset.sym) || 0;
  });
  if ($('#diagRun')) $('#diagRun').addEventListener('click', v10DiagRun);
  if ($('#diagFix')) $('#diagFix').addEventListener('click', function () {
    state.v10.diagDone = true;
    this.style.display = 'none';
    toast(_t('diag_fixed'));
    v8Log('Diagnostic fix applied');
    v9Sfx('done');
    v10Unlock(6);
  });

  if ($('#wifiScan')) $('#wifiScan').addEventListener('click', function () {
    var st = $('#wifiStatus'), btn = this;
    if (st) st.textContent = _t('wifi_scanning');
    btn.disabled = true;
    later(function () {
      var list = $('#wifiList');
      var pool = ['Xiaomi_AX6000', 'CMCC-5G-9A2F', 'Linksys-2.4G'];
      if (list) {
        var exist = $$('#wifiList .wifi').map(function (x) { return x.dataset.ssid; });
        var ssid = null;
        for (var i = 0; i < pool.length; i++) {
          if (exist.indexOf(pool[i]) < 0) { ssid = pool[i]; break; }
        }
        if (ssid) {
          var div = document.createElement('div');
          div.className = 'wifi new';
          div.dataset.ssid = ssid;
          div.innerHTML = '<div class="wifi__l"><span class="wifi__bars"><i></i><i></i><i></i></span>' +
            '<div><div>' + ssid + '<span class="wifi__flag">' + _t('wifi_new') + '</span></div>' +
            '<div class="wifi__meta">' + _t('net_sec') + '</div></div></div>' +
            '<span class="wifi__meta">' + _t('net_good') + '</span>';
          list.appendChild(div);
          v8Log('Wi-Fi scan: found new network ' + ssid);
        }
      }
      var n = $$('#wifiList .wifi').length;
      if (st) st.textContent = _t('wifi_scan_done', { n: n });
      btn.disabled = false;
    }, 1600);
  });

  if ($('#cfgExport')) $('#cfgExport').addEventListener('click', function () {
    v10OpenCfg();
    var txt = '';
    var ta = $('#cfgText'); if (ta) txt = ta.value;
    fsSave('install-config.json', txt, null);
    toast(_t('cfg_saved'));
    v8Log('Configuration exported to Temp/install-config.json');
    v10Unlock(8);
  });
  if ($('#cfgCopy')) $('#cfgCopy').addEventListener('click', function () {
    var ta = $('#cfgText'), hint = $('#cfgHint');
    if (!ta) return;
    function done() {
      if (hint) { hint.textContent = _t('cfg_copied'); hint.className = 'cfg-hint ok'; }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value).then(done, function () { ta.select(); done(); });
      } else { ta.select(); document.execCommand('copy'); done(); }
    } catch (e) { ta.select(); done(); }
  });
  if ($('#cfgApply')) $('#cfgApply').addEventListener('click', v10ApplyCfg);
  if ($('#cfgClose')) $('#cfgClose').addEventListener('click', function () { $('#cfgOverlay').classList.remove('open'); });

  if ($('#achClose')) $('#achClose').addEventListener('click', function () { $('#achOverlay').classList.remove('open'); });
  if ($('#achReset')) $('#achReset').addEventListener('click', function () {
    state.v10.ach = {};
    v10SaveAch();
    v10RenderAch();
    toast(_t('ach_reset_ok'));
  });

  if ($('#timelineOpen')) $('#timelineOpen').addEventListener('click', v10OpenTimeline);
  if ($('#tlClose')) $('#tlClose').addEventListener('click', function () { $('#timeOverlay').classList.remove('open'); });
  if ($('#tlReplay')) $('#tlReplay').addEventListener('click', v10ReplayTimeline);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var ids = ['cfgOverlay', 'timeOverlay', 'achOverlay'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && el.classList.contains('open')) {
        el.classList.remove('open');
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
    }
    var cp = $('#copilotPanel');
    if (cp && cp.classList.contains('open')) {
      v10CopilotToggle(false);
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('langchange', function () {
    v10CopilotUpdate();
    if ($('#achOverlay') && $('#achOverlay').classList.contains('open')) v10RenderAch();
  });

  // 安装开始时启动性能曲线；进入磁盘页时重绘布局图
  var v10OrigInstallHook = hooks.install;
  hooks.install = function () {
    v10OrigInstallHook();
    v10PerfStart();
  };
  hooks.diag = function () { _apply(); v10DiagEnter(); };
  var v10OrigDiskHook = hooks.disk;
  hooks.disk = function () { v10OrigDiskHook(); v10RenderDiskMap(); };

  // 记录页面进入时间线（在 v8 导航包装之上再包一层）
  var v10OrigGo = go;
  go = function (id) {
    var r = v10OrigGo.apply(null, arguments);
    if (document.getElementById('s-' + id)) v10Note(id);
    return r;
  };

  v10CopilotUpdate();
  v10RenderAch();

  /* ============================================================
   * v11.0 大型更新
   * 镜像选择 / 预检清单 / 驱动加载 / 命令面板 / 步骤地图 /
   * 系统信息 / 耗时对比 / 蓝屏模拟 / 日志导出
   * ============================================================ */
  state.v11 = { image: '', inject: false, bsodShown: false, drvLoaded: false };

  /* ---- 镜像选择 ---- */
  if ($('#imgList')) $('#imgList').addEventListener('click', function (e) {
    var opt = e.target.closest('.opt'); if (!opt) return;
    $$('#imgList .opt').forEach(function (o) { o.classList.remove('sel'); });
    opt.classList.add('sel');
    state.v11.image = opt.dataset.img;
    var nx = $('#imgNext'); if (nx) nx.disabled = false;
    toast(_t('img_selected', { n: _t('img_' + state.v11.image) }));
    v8Log('Installation image selected: ' + _t('img_' + state.v11.image));
  });
  if ($('#imgNext')) $('#imgNext').addEventListener('click', function () {
    if (state.v11.image) go('preflight');
  });

  /* ---- 安装前检查 ---- */
  function v11PreflightRun() {
    var rows = $$('#pfList .pf-row');
    var done = $('#pfDone'); if (done) done.style.display = 'none';
    var nx = $('#pfNext'); if (nx) nx.disabled = true;
    rows.forEach(function (r) {
      r.className = 'pf-row';
      var v = r.querySelector('.pf-val'); if (v) v.textContent = _t('pf_checking');
    });
    var i = 0;
    (function step() {
      if (i >= rows.length) {
        if (done) done.style.display = '';
        if (nx) nx.disabled = false;
        v8Log('Preflight checks completed: ' + rows.length + '/' + rows.length + ' passed');
        return;
      }
      var r = rows[i];
      r.classList.add('run');
      var v = r.querySelector('.pf-val'); if (v) v.textContent = _t('pf_checking');
      later(function () {
        r.classList.remove('run');
        var warn = r.dataset.pf === 'net' && state.v9.source === 'net' && !navigator.onLine;
        r.classList.add(warn ? 'warn' : 'ok');
        if (v) v.textContent = _t(warn ? 'pf_warn' : 'pf_pass');
        i++; step();
      }, 520);
    })();
  }
  hooks.preflight = function () { _apply(); v11PreflightRun(); };

  /* ---- 驱动加载 ---- */
  function v11OpenDrv() {
    var el = $('#drvOverlay'); if (el) el.classList.add('open');
  }
  if ($('#drvList')) $('#drvList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-drvbtn]'); if (!b) return;
    var row = b.closest('.drv-row');
    if (row && row.classList.contains('done')) return;
    var key = b.dataset.drvbtn;
    if (row) row.classList.add('done');
    b.disabled = true; b.textContent = '✓';
    toast(_t('drv_loaded', { n: _t('drv_' + key) }));
    v8Log('Driver loaded: ' + _t('drv_' + key));
    if (!state.v11.drvLoaded) {
      state.v11.drvLoaded = true;
      var un = state.disk.filter(function (x) { return x.unallocated; })[0];
      if (un) {
        un.unallocated = false;
        un.kind = 'primary';
        un.fs = 'NTFS';
        un.nameKey = '';
        un.name = '新加卷';
      } else {
        state.disk.push({ id: 'd' + Date.now(), name: '新加卷', total: 20, free: 20, kind: 'primary' });
      }
      renderDisk();
      v8Log('Storage controller detected, partition table refreshed');
    }
  });
  if ($('#drvClose')) $('#drvClose').addEventListener('click', function () { $('#drvOverlay').classList.remove('open'); });

  /* ---- 命令面板 ---- */
  var v11CmdSel = 0, v11CmdFiltered = [];
  function v11CmdDefs() {
    var defs = [
      { k: 'cmd_go_desktop', ic: '🖥', run: function () { v11CloseCmd(); go('desktop'); } },
      { k: 'cmd_go_install', ic: '⚙', run: function () { v11CloseCmd(); go('install'); } },
      { k: 'cmd_log', ic: '📜', run: function () { v11CloseCmd(); v8OpenLog(); } },
      { k: 'cmd_help', ic: '⌨', run: function () { v11CloseCmd(); var o = $('#helpOverlay'); if (o) o.classList.add('open'); } },
      { k: 'cmd_ach', ic: '🏆', run: function () { v11CloseCmd(); v10OpenAch(); } },
      { k: 'cmd_time', ic: '⏱', run: function () { v11CloseCmd(); v10OpenTimeline(); } },
      { k: 'cmd_map', ic: '🗺', run: function () { v11CloseCmd(); v11OpenMap(); } },
      { k: 'cmd_diag', ic: '🩺', run: function () { v11CloseCmd(); go('diag'); } },
      { k: 'cmd_dark', ic: '🌙', run: function () { v11CloseCmd(); var b = $('#v8Theme'); if (b) b.click(); } },
      { k: 'cmd_sound', ic: '🔊', run: function () { v11CloseCmd(); var t = $('#quickPanel [data-qc="sound"]'); if (t) t.click(); } },
      { k: 'cmd_exportlog', ic: '⤓', run: function () { v11CloseCmd(); v11ExportLog(); } },
      { k: 'cmd_sysinfo', ic: 'ℹ', run: function () { v11CloseCmd(); v11OpenSysinfo(); } },
      { k: 'cmd_cfg', ic: '{}', run: function () { v11CloseCmd(); v10OpenCfg(); } }
    ];
    defs.forEach(function (c) { c.name = _t(c.k); });
    return defs;
  }
  function v11RenderCmd() {
    var inp = $('#cmdInput');
    var q = (inp ? inp.value : '').trim().toLowerCase();
    var all = v11CmdDefs();
    v11CmdFiltered = q ? all.filter(function (c) { return c.name.toLowerCase().indexOf(q) >= 0; }) : all;
    if (v11CmdSel >= v11CmdFiltered.length) v11CmdSel = Math.max(0, v11CmdFiltered.length - 1);
    var host = $('#cmdList'); if (!host) return;
    if (!v11CmdFiltered.length) {
      host.innerHTML = '<div class="cmd__empty">' + _t('cmd_empty') + '</div>';
      return;
    }
    host.innerHTML = v11CmdFiltered.map(function (c, i) {
      return '<div class="cmd__item' + (i === v11CmdSel ? ' sel' : '') + '" data-i="' + i + '">' +
        '<span class="ci-ic">' + c.ic + '</span><span>' + c.name + '</span></div>';
    }).join('');
  }
  function v11OpenCmd() {
    var el = $('#cmdPalette'); if (!el) return;
    el.classList.add('open');
    v11CmdSel = 0;
    var inp = $('#cmdInput'); if (inp) inp.value = '';
    v11RenderCmd();
    setTimeout(function () { if (inp) inp.focus(); }, 30);
  }
  function v11CloseCmd() { var el = $('#cmdPalette'); if (el) el.classList.remove('open'); }

  if ($('#v11Cmd')) $('#v11Cmd').addEventListener('click', v11OpenCmd);
  if ($('#cmdInput')) $('#cmdInput').addEventListener('input', function () { v11CmdSel = 0; v11RenderCmd(); });
  if ($('#cmdList')) $('#cmdList').addEventListener('click', function (e) {
    var item = e.target.closest('.cmd__item'); if (!item) return;
    var c = v11CmdFiltered[Number(item.dataset.i)];
    if (c) c.run();
  });
  if ($('#cmdPalette')) $('#cmdPalette').addEventListener('click', function (e) {
    if (e.target === this) v11CloseCmd();
  });
  document.addEventListener('keydown', function (e) {
    var el = $('#cmdPalette');
    if (!el || !el.classList.contains('open')) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); v11CloseCmd(); }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      v11CmdSel = Math.min(v11CmdSel + 1, v11CmdFiltered.length - 1);
      v11RenderCmd();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      v11CmdSel = Math.max(v11CmdSel - 1, 0);
      v11RenderCmd();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      var c = v11CmdFiltered[v11CmdSel];
      if (c) c.run();
    }
  }, true);

  /* ---- 步骤地图 ---- */
  function v11OpenMap() {
    var host = $('#mapGrid'); if (!host) return;
    var cur = (location.hash || '').replace('#', '');
    host.innerHTML = screens.map(function (s) {
      var id = s.id.replace(/^s-/, '');
      var h = s.querySelector('h1') || s.querySelector('.dialog__title');
      var name = h ? h.textContent.trim() : id;
      return '<button class="map-item' + (id === cur ? ' cur' : '') + '" data-map="' + id + '">' + name + '</button>';
    }).join('');
    var el = $('#mapOverlay'); if (el) el.classList.add('open');
  }
  if ($('#mapGrid')) $('#mapGrid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-map]'); if (!b) return;
    var id = b.dataset.map;
    $('#mapOverlay').classList.remove('open');
    go(id);
  });
  if ($('#mapClose')) $('#mapClose').addEventListener('click', function () { $('#mapOverlay').classList.remove('open'); });
  if ($('#copilotPanel')) $('#copilotPanel').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cp]'); if (!b) return;
    if (b.dataset.cp === 'map') v11OpenMap();
    else if (b.dataset.cp === 'exportlog') v11ExportLog();
  });

  /* ---- 系统信息 ---- */
  function v11ElapsedMs() {
    if (state.v8.instStartAt && state.v8.instEndAt) return state.v8.instEndAt - state.v8.instStartAt;
    var total = 0;
    (state.v10.timeline || []).forEach(function (x) { total += x.dur || 0; });
    return total;
  }
  function v11OpenSysinfo() {
    var host = $('#sysRows'); if (!host) return;
    var ms = v11ElapsedMs();
    var rows = [
      ['sys_device', state.deviceName || 'DESKTOP-7F3K9Q'],
      ['sys_edition', state.edition || 'Windows 11 专业版'],
      ['sys_build', '26200.1742'],
      ['sys_cpu', 'Intel Core i7-13700H · 14 核 20 线程'],
      ['sys_ram', '16 GB DDR5-4800'],
      ['sys_disk', 'NVMe SSD 512 GB'],
      ['sys_gpu', 'Intel Iris Xe Graphics'],
      ['sys_source', state.v9.source ? _t('src_' + state.v9.source) : '—'],
      ['sys_image', state.v11.image ? _t('img_' + state.v11.image) : '—'],
      ['sys_elapsed', ms ? (ms / 1000).toFixed(1) + 's' : '—']
    ];
    host.innerHTML = rows.map(function (r) {
      return '<div class="sys-row"><span>' + _t(r[0]) + '</span><b>' + r[1] + '</b></div>';
    }).join('');
    var el = $('#sysinfoOverlay'); if (el) el.classList.add('open');
  }
  if ($('#sysinfoOpen')) $('#sysinfoOpen').addEventListener('click', v11OpenSysinfo);
  if ($('#sysClose')) $('#sysClose').addEventListener('click', function () { $('#sysinfoOverlay').classList.remove('open'); });

  /* ---- 耗时对比 ---- */
  function v11RenderBench() {
    var host = $('#benchBox'); if (!host) return;
    var actual = v11ElapsedMs();
    if (!actual) actual = 60000;
    var std = 60000, demo = 8000;
    var max = Math.max(actual, std, demo);
    function row(cls, label, ms) {
      var pct = Math.max(3, Math.round(ms / max * 100));
      return '<div class="bench__row ' + cls + '"><span>' + label + '</span>' +
        '<i><b style="width:' + pct + '%"></b></i><em>' + (ms / 1000).toFixed(1) + 's</em></div>';
    }
    host.innerHTML = '<div class="bench__head">' + _t('bench_title') + '</div>' +
      row('me', _t('bench_this'), actual) +
      row('', _t('bench_standard'), std) +
      row('', _t('bench_demo'), demo) +
      (actual < std ? '<div class="bench__note">' + _t('bench_faster', { n: Math.round(std / Math.max(actual, 1)) }) + '</div>' : '');
  }
  var v11OrigDoneHook = hooks.done;
  hooks.done = function () { if (v11OrigDoneHook) v11OrigDoneHook(); v11RenderBench(); };

  /* ---- 蓝屏模拟 ---- */
  function v11StartBsod() {
    var bar = $('#bsodBar'), pct = $('#bsodPct');
    var codes = ['CRITICAL_PROCESS_DIED', 'IRQL_NOT_LESS_OR_EQUAL', 'KERNEL_SECURITY_CHECK_FAILURE'];
    if ($('#bsodCode')) $('#bsodCode').textContent = codes[Math.floor(Math.random() * codes.length)];
    if (bar) bar.style.width = '0%';
    if (pct) pct.textContent = _t('bsod_progress', { n: 0 });
    var n = 0;
    (function tick() {
      n += Math.ceil(Math.random() * 14);
      if (n > 100) n = 100;
      if (bar) bar.style.width = n + '%';
      if (pct) pct.textContent = _t('bsod_progress', { n: n });
      if (n >= 100) {
        later(function () {
          state.v11.inject = false;
          state.v11.bsodShown = false;
          go('install');
        }, 1200);
        return;
      }
      later(tick, 320);
    })();
  }
  hooks.bsod = function () { _apply(); v11StartBsod(); };

  if ($('#instInject')) $('#instInject').addEventListener('click', function () {
    state.v11.inject = !state.v11.inject;
    this.classList.toggle('on', state.v11.inject);
    toast(_t(state.v11.inject ? 'bsod_on' : 'bsod_off'));
    v8Log('Fault injection ' + (state.v11.inject ? 'enabled' : 'disabled'));
  });

  /* ---- 日志导出 ---- */
  function v11ExportLog() {
    var txt = '';
    try { txt = v8LogText() || ''; } catch (e) { txt = ''; }
    if (!txt) txt = 'Windows 11 Setup Simulator 11.0\n(no log entries)';
    try {
      var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'windows11-setup-log.txt';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); if (a.parentNode) a.parentNode.removeChild(a); }, 1200);
    } catch (e) { }
    fsSave('setup-log.txt', txt, null);
    toast(_t('log_exported'));
    v8Log('Setup log exported to setup-log.txt');
  }

  /* ============================================================
   * v13.0：全应用可用 / 输入捕获 / 本地时间 / 新 UI
   * ============================================================ */
  state.v13 = { photos: 0, mails: [{ key: 1, time: '' }, { key: 2, time: '' }, { key: 3, time: '' }] };

  function v13NowHM() {
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  /* ---- 输入捕获（可取消） ---- */
  var v13Cap = { name: '', keys: null, mouse: null, release: null };
  function v13Capturing() {
    var b = $('#capBar');
    return !!(b && b.classList.contains('show'));
  }
  function v13Capture(name, keys, mouse, release) {
    if (!name) return;
    v13Cap.name = name; v13Cap.keys = keys; v13Cap.mouse = mouse; v13Cap.release = release;
    var b = $('#capBar'); if (!b) return;
    var n = $('#capApp');
    if (n) n.textContent = _t('cap_bar', { n: name });
    b.classList.add('show');
    document.body.classList.add('v13-capturing');
    v8Log('Input capture started: ' + name);
  }
  function v13ReleaseCapture() {
    var b = $('#capBar');
    if (!b || !b.classList.contains('show')) return;
    b.classList.remove('show');
    document.body.classList.remove('v13-capturing');
    var cb = v13Cap.release;
    v13Cap.keys = null; v13Cap.mouse = null; v13Cap.release = null;
    if (cb) cb();
    v8Log('Input capture released');
  }
  if ($('#capCancel')) $('#capCancel').addEventListener('click', v13ReleaseCapture);
  document.addEventListener('keydown', function (e) {
    if (!v13Capturing()) return;
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopImmediatePropagation();
      v13ReleaseCapture();
      return;
    }
    e.preventDefault(); e.stopImmediatePropagation();
    if (v13Cap.keys) v13Cap.keys(e);
  }, true);
  document.addEventListener('mousemove', function (e) {
    if (v13Cap.mouse) v13Cap.mouse(e);
  }, true);

  /* ---- 相机 ---- */
  function v13RenderCamera(body) {
    var FILTERS = ['none', 'grayscale(1)', 'sepia(.75)', 'saturate(1.9)', 'hue-rotate(200deg)'];
    var idx = 0, photos = state.v13.photos, recording = false, recTimer = 0, recSec = 0;
    body.innerHTML =
      '<div class="cam">' +
        '<div class="cam__stage" id="camStage">' +
          '<div class="cam__grid"></div>' +
          '<div class="cam__hud" id="camHud">1920×1080 · 30 fps</div>' +
          '<div class="cam__rec" id="camRec"></div>' +
          '<div class="cam__flash" id="camFlash"></div>' +
        '</div>' +
        '<div class="cam__bar">' +
          '<button class="cam__shutter" id="camShutter" aria-label="shutter"></button>' +
          '<div class="cam__meta"><b id="camCount"></b><span id="camFilter"></span></div>' +
          '<button class="btn" id="camRecord"></button>' +
        '</div>' +
        '<p class="cam__hint">' + _t('cam_hint') + '</p>' +
      '</div>';
    var stage = body.querySelector('#camStage');
    var hud = body.querySelector('#camHud');
    var flash = body.querySelector('#camFlash');
    var countEl = body.querySelector('#camCount');
    var filterEl = body.querySelector('#camFilter');
    var recEl = body.querySelector('#camRec');
    var recBtn = body.querySelector('#camRecord');

    function paint() {
      stage.style.filter = FILTERS[idx];
      filterEl.textContent = _t('cam_filter') + ' ' + (idx + 1) + '/' + FILTERS.length;
      countEl.textContent = _t('cam_photos', { n: photos });
    }
    function shoot() {
      photos++; state.v13.photos = photos;
      flash.classList.remove('go');
      void flash.offsetWidth;
      flash.classList.add('go');
      v9Sfx('click');
      paint();
      v8Log('Camera: photo #' + photos);
    }
    function stopRec() {
      recording = false;
      clearInterval(recTimer); recTimer = 0;
      recEl.classList.remove('on');
      recBtn.textContent = _t('cam_record');
      paint();
    }
    function startRec() {
      recording = true; recSec = 0;
      v13Capture(_t('app_camera'), function (e) {
        if (e.code === 'Space') { shoot(); return; }
        if (e.key === 'ArrowLeft') { idx = (idx + FILTERS.length - 1) % FILTERS.length; paint(); }
        if (e.key === 'ArrowRight') { idx = (idx + 1) % FILTERS.length; paint(); }
      }, function (e) {
        var r = stage.getBoundingClientRect();
        var x = Math.max(0, Math.round(e.clientX - r.left));
        var y = Math.max(0, Math.round(e.clientY - r.top));
        hud.textContent = x + ', ' + y + ' px · ' + _t('cam_recording');
      }, stopRec);
      recEl.classList.add('on');
      recBtn.textContent = _t('cam_stop');
      recTimer = setInterval(function () {
        recSec++;
        var mm = Math.floor(recSec / 60), ss = recSec % 60;
        hud.textContent = 'REC ' + (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;
      }, 1000);
      paint();
    }
    body.querySelector('#camShutter').addEventListener('click', shoot);
    recBtn.addEventListener('click', function () {
      if (recording) { v13ReleaseCapture(); stopRec(); }
      else startRec();
    });
    paint();
  }

  /* ---- 相机（增强版：12 滤镜 / 模式 / 画质 / 暂停 / 片段） ---- */
  v13RenderCamera = function (body) {
    var FILTERS = [
      { k: 'cam_f_none', css: 'none' },
      { k: 'cam_f_bw', css: 'grayscale(1) contrast(1.05)' },
      { k: 'cam_f_vintage', css: 'sepia(.75) contrast(.92) saturate(1.1)' },
      { k: 'cam_f_vivid', css: 'saturate(1.9) contrast(1.1)' },
      { k: 'cam_f_cool', css: 'hue-rotate(200deg) saturate(1.2)' },
      { k: 'cam_f_warm', css: 'sepia(.35) saturate(1.4) hue-rotate(-12deg)' },
      { k: 'cam_f_invert', css: 'invert(1)' },
      { k: 'cam_f_soft', css: 'blur(1.2px) brightness(1.06)' },
      { k: 'cam_f_contrast', css: 'contrast(1.65) brightness(.95)' },
      { k: 'cam_f_fade', css: 'saturate(.7) brightness(1.15)' },
      { k: 'cam_f_cyber', css: 'hue-rotate(290deg) saturate(1.7)' },
      { k: 'cam_f_noir', css: 'grayscale(1) contrast(1.5) brightness(.9)' }
    ];
    var BITRATE = { '720p': 4, '1080p': 8, '4K': 20 };
    var idx = 0, mode = 'photo', res = '1080p', fps = 30, mic = true;
    var recording = false, paused = false, recSec = 0, recTimer = 0;
    if (!state.v13.items) state.v13.items = [];

    body.innerHTML =
      '<div class="cam">' +
        '<div class="cam__stage">' +
          '<div class="cam__grid"></div>' +
          '<div class="cam__hud" id="camHud">' + res + ' · ' + fps + ' fps</div>' +
          '<div class="cam__mode-tag" id="camModeTag"></div>' +
          '<div class="cam__rec" id="camRec"></div>' +
          '<div class="cam__flash" id="camFlash"></div>' +
        '</div>' +
        '<div class="cam__filters" id="camFilters"></div>' +
        '<div class="cam__modes">' +
          '<div class="cam__seg" id="camMode">' +
            '<button data-mode="photo"></button><button data-mode="video"></button><button data-mode="timelapse"></button>' +
          '</div>' +
          '<select class="cam__sel" id="camRes"><option value="720p">720p</option><option value="1080p" selected>1080p</option><option value="4K">4K</option></select>' +
          '<select class="cam__sel" id="camFps"><option value="30">30 fps</option><option value="60">60 fps</option></select>' +
          '<button class="cam__mic" id="camMic"></button>' +
        '</div>' +
        '<div class="cam__bar">' +
          '<button class="cam__shutter" id="camShutter" aria-label="shutter"></button>' +
          '<div class="cam__meta"><b id="camCount"></b><span id="camInfo"></span></div>' +
          '<button class="btn cam__pause" id="camPause" style="display:none;"></button>' +
          '<button class="btn" id="camRecord"></button>' +
        '</div>' +
        '<div class="cam__strip"><div class="cam__strip-h">' + _t('cam_strip') + '</div><div class="cam__thumbs" id="camThumbs"></div></div>' +
        '<p class="cam__hint">' + _t('cam_hint') + '</p>' +
      '</div>';

    var stage = body.querySelector('.cam__stage');
    var hud = body.querySelector('#camHud');
    var tag = body.querySelector('#camModeTag');
    var flash = body.querySelector('#camFlash');
    var recEl = body.querySelector('#camRec');
    var countEl = body.querySelector('#camCount');
    var infoEl = body.querySelector('#camInfo');
    var recBtn = body.querySelector('#camRecord');
    var pauseBtn = body.querySelector('#camPause');
    var shutter = body.querySelector('#camShutter');
    var thumbs = body.querySelector('#camThumbs');

    function sizeMB(sec) {
      var b = BITRATE[res] * (fps === 60 ? 1.5 : 1);
      if (mode === 'timelapse') b *= 0.6;
      return Math.max(0, (b * sec) / 8);
    }
    function mmss(s) {
      var m = Math.floor(s / 60), x = s % 60;
      return (m < 10 ? '0' : '') + m + ':' + (x < 10 ? '0' : '') + x;
    }
    function paintFilters() {
      Array.prototype.forEach.call(body.querySelectorAll('#camFilters .cam__chip'), function (c, i) {
        c.classList.toggle('on', i === idx);
      });
      stage.style.filter = FILTERS[idx].css;
    }
    function paintMeta() {
      countEl.textContent = _t('cam_photos', { n: state.v13.photos });
      var last = state.v13.items[0];
      infoEl.textContent = last ? _t('cam_size', { n: last.size.toFixed(1) }) : _t(FILTERS[idx].k);
    }
    function paintMode() {
      Array.prototype.forEach.call(body.querySelectorAll('#camMode button'), function (b) {
        b.classList.toggle('on', b.dataset.mode === mode);
        b.textContent = _t('cam_mode_' + b.dataset.mode);
      });
      tag.textContent = mode === 'timelapse' ? '×4 ' + _t('cam_mode_timelapse') : _t('cam_mode_' + mode);
      hud.textContent = res + ' · ' + fps + ' fps';
    }
    function paintMic() {
      var m = body.querySelector('#camMic');
      m.classList.toggle('off', !mic);
      m.textContent = mic ? '🎤' : '🔇';
      m.title = _t(mic ? 'cam_mic_on' : 'cam_mic_off');
    }
    function renderStrip() {
      if (!state.v13.items.length) {
        thumbs.innerHTML = '<span class="cam__empty">' + _t('cam_empty_strip') + '</span>';
        return;
      }
      thumbs.innerHTML = state.v13.items.map(function (it) {
        return '<div class="cam__thumb ' + it.t + '" title="' + it.label + '">' +
          '<i></i><span>' + it.label + '</span></div>';
      }).join('');
    }
    function pushItem(it) {
      state.v13.items.unshift(it);
      state.v13.items = state.v13.items.slice(0, 8);
      renderStrip();
      paintMeta();
    }
    function shoot() {
      if (recording) { toast(_t('cam_record')); return; }
      state.v13.photos++;
      flash.classList.remove('go');
      void flash.offsetWidth;
      flash.classList.add('go');
      v9Sfx('click');
      pushItem({ t: 'photo', label: _t(FILTERS[idx].k), size: 0.6 });
      toast(_t('cam_saved_photo', { n: state.v13.photos }));
      paintMeta();
    }
    function stopRec(auto) {
      if (recTimer) { clearInterval(recTimer); recTimer = 0; }
      var sec = recSec, size = sizeMB(sec);
      recording = false; paused = false; recSec = 0;
      recEl.classList.remove('on');
      recBtn.textContent = _t('cam_record');
      pauseBtn.style.display = 'none';
      shutter.disabled = false;
      v13ReleaseCapture();
      pushItem({ t: 'video', label: mmss(sec || 1) + ' · ' + FILTERS[idx].k, size: size });
      toast(_t('cam_saved_video', { n: mmss(sec || 1) }));
      if (auto) toast(_t('cam_autostop'));
      paintMeta();
    }
    function startRec() {
      recording = true; paused = false; recSec = 0;
      recEl.classList.add('on');
      recBtn.textContent = _t('cam_stop');
      pauseBtn.style.display = '';
      pauseBtn.textContent = _t('cam_pause');
      shutter.disabled = true;
      v13Capture(_t('app_camera'), function (e) {
        if (e.code === 'Space') { shoot(); return; }
        if (e.key === 'ArrowLeft') { idx = (idx + FILTERS.length - 1) % FILTERS.length; paintFilters(); paintMeta(); }
        if (e.key === 'ArrowRight') { idx = (idx + 1) % FILTERS.length; paintFilters(); paintMeta(); }
        if (e.key === 'p' || e.key === 'P') togglePause();
      }, function (e) {
        var r = stage.getBoundingClientRect();
        var x = Math.max(0, Math.round(e.clientX - r.left));
        var y = Math.max(0, Math.round(e.clientY - r.top));
        hud.textContent = x + ', ' + y + ' px · ' + (paused ? _t('cam_pause') : _t('cam_recording'));
      }, function () { if (recording) stopRec(false); });
      tick();
    }
    function tick() {
      if (recTimer) clearInterval(recTimer);
      recTimer = setInterval(function () {
        if (!recording) return;
        if (!paused) recSec++;
        hud.textContent = 'REC ' + mmss(recSec) + ' · ' + sizeMB(recSec).toFixed(1) + ' MB';
        if (recSec >= 30) stopRec(true);
      }, 1000);
    }
    function togglePause() {
      if (!recording) return;
      paused = !paused;
      pauseBtn.textContent = _t(paused ? 'cam_resume' : 'cam_pause');
      recEl.classList.toggle('paused', paused);
      v8Log('Camera recording ' + (paused ? 'paused' : 'resumed') + ' at ' + mmss(recSec));
    }

    body.querySelector('#camFilters').innerHTML = FILTERS.map(function (f, i) {
      return '<button class="cam__chip' + (i === 0 ? ' on' : '') + '" data-f="' + i + '">' + _t(f.k) + '</button>';
    }).join('');
    body.querySelector('#camFilters').addEventListener('click', function (e) {
      var c = e.target.closest('.cam__chip'); if (!c) return;
      idx = Number(c.dataset.f);
      paintFilters(); paintMeta();
    });
    body.querySelector('#camMode').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      mode = b.dataset.mode;
      paintMode();
    });
    body.querySelector('#camRes').addEventListener('change', function () { res = this.value; paintMode(); });
    body.querySelector('#camFps').addEventListener('change', function () { fps = Number(this.value); paintMode(); });
    body.querySelector('#camMic').addEventListener('click', function () {
      mic = !mic; paintMic(); toast(_t(mic ? 'cam_mic_on' : 'cam_mic_off'));
    });
    shutter.addEventListener('click', shoot);
    pauseBtn.addEventListener('click', togglePause);
    recBtn.addEventListener('click', function () {
      if (recording) { v13ReleaseCapture(); stopRec(false); }
      else startRec();
    });

    paintFilters(); paintMode(); paintMic(); renderStrip(); paintMeta();
  };

  /* ---- 邮件 ---- */
  function v13RenderMail(body) {
    body.innerHTML =
      '<div class="mail">' +
        '<div class="mail__side">' +
          '<div class="mail__title">' + _t('mail_inbox') + '</div>' +
          '<div class="mail__list" id="mailList"></div>' +
          '<button class="btn primary mail__new" id="mailNew">' + _t('mail_compose') + '</button>' +
        '</div>' +
        '<div class="mail__main" id="mailMain"></div>' +
      '</div>';
    var list = body.querySelector('#mailList');
    var main = body.querySelector('#mailMain');
    if (!state.v13.mails[0].time) {
      state.v13.mails.forEach(function (m) { m.time = v13NowHM(); });
    }
    function openMail(m) {
      main.innerHTML =
        '<div class="mail__head"><h3>' + _t('mail_subject_' + m.key) + '</h3>' +
        '<div class="mail__from">' + _t('mail_from_team') + ' · ' + _t('mail_today') + ' ' + m.time + '</div></div>' +
        '<p class="mail__text">' + _t('mail_body_' + m.key) + '</p>';
      Array.prototype.forEach.call(list.children, function (c) { c.classList.toggle('on', c.dataset.key === String(m.key)); });
    }
    function renderList() {
      list.innerHTML = state.v13.mails.map(function (m) {
        return '<button class="mail__item" data-key="' + m.key + '">' +
          '<b>' + _t('mail_subject_' + m.key) + '</b>' +
          '<span>' + _t('mail_from_team') + ' · ' + m.time + '</span></button>';
      }).join('');
    }
    list.addEventListener('click', function (e) {
      var it = e.target.closest('.mail__item'); if (!it) return;
      var m = state.v13.mails.filter(function (x) { return String(x.key) === it.dataset.key; })[0];
      if (m) openMail(m);
    });
    body.querySelector('#mailNew').addEventListener('click', function () {
      main.innerHTML =
        '<div class="mail__form">' +
          '<label>' + _t('mail_to') + '<input class="inp" id="mTo" value="user@outlook.com"></label>' +
          '<label>' + _t('mail_subject') + '<input class="inp" id="mSub" placeholder=""></label>' +
          '<label>' + _t('mail_body') + '<textarea class="inp" id="mBody" rows="5"></textarea></label>' +
          '<div class="mail__actions"><button class="btn primary" id="mSend">' + _t('mail_send') + '</button></div>' +
        '</div>';
      main.querySelector('#mSend').addEventListener('click', function () {
        var sub = main.querySelector('#mSub').value.trim() || '—';
        var txt = main.querySelector('#mBody').value.trim();
        toast(_t('mail_sent'));
        v8Log('Mail sent: ' + sub);
        main.innerHTML = '<div class="mail__sent"><b>' + _t('mail_sent') + '</b><span>' + sub + '</span></div>' +
          (txt ? '<p class="mail__text">' + txt.replace(/</g, '&lt;') + '</p>' : '');
      });
    });
    renderList();
    openMail(state.v13.mails[0]);
  }

  /* ---- 天气 ---- */
  function v13RenderWeather(body) {
    var days = [
      { d: 1, t: 19, k: 'weather_clear' }, { d: 2, t: 21, k: 'weather_cloud' },
      { d: 3, t: 17, k: 'weather_rain' }, { d: 4, t: 15, k: 'weather_cloud' },
      { d: 5, t: 12, k: 'weather_snow' }
    ];
    var temp = 18;
    body.innerHTML =
      '<div class="wx">' +
        '<div class="wx__now">' +
          '<div class="wx__city">' + _t('weather_city') + '</div>' +
          '<div class="wx__temp" id="wxTemp">' + temp + '°</div>' +
          '<div class="wx__desc" id="wxDesc">' + _t('weather_clear') + '</div>' +
          '<div class="wx__meta">' + _t('weather_humidity') + ' 46% · ' + _t('weather_wind') + ' 12 km/h</div>' +
          '<div class="wx__time" id="wxTime"></div>' +
          '<button class="link" id="wxRefresh">' + _t('weather_refresh') + '</button>' +
        '</div>' +
        '<div class="wx__forecast"><div class="wx__fhead">' + _t('weather_forecast') + '</div><div class="wx__days" id="wxDays"></div></div>' +
      '</div>';
    function paintTime() {
      var t = body.querySelector('#wxTime');
      if (t) t.textContent = _t('weather_updated', { t: v13NowHM() });
    }
    body.querySelector('#wxDays').innerHTML = days.map(function (x) {
      var date = new Date(Date.now() + x.d * 86400000);
      return '<div class="wx__day"><b>' + (date.getMonth() + 1) + '/' + date.getDate() + '</b>' +
        '<span>' + _t(x.k) + '</span><em>' + x.t + '°</em></div>';
    }).join('');
    body.querySelector('#wxRefresh').addEventListener('click', function () {
      temp = 16 + Math.floor(Math.random() * 8);
      body.querySelector('#wxTemp').textContent = temp + '°';
      paintTime();
      toast(_t('weather_refresh'));
      v8Log('Weather refreshed at ' + v13NowHM());
    });
    paintTime();
  }

  /* ============================================================
   * 启动
   * ============================================================ */
/* ============================================================
   v14.0 引擎：图标体系、Dock 放大、指针视差、波纹与动效偏好
   性能约定：
   - 指针事件一律 passive，并用 requestAnimationFrame 合并写入
   - 只在桌面可见时运行动效，页面隐藏时暂停极光动画
   - 所有写入集中在 transform，不触发布局
   ============================================================ */
var V14_ANIM_KEY = 'windows11_sim_anim';
var v14 = { still: false, ticking: false, dockTicking: false, lastX: 0, raf: 0 };

/* ---- 图标：以 <use> 引用内联精灵，统一尺寸与配色 ---- */
function v14Icon(name, tone, size) {
  var cls = 'i14' + (size ? ' i14--' + size : '') + (tone ? ' t-' + tone : '');
  return '<span class="' + cls + '"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#v14-' + name + '"/></svg></span>';
}
var V14_APP_ICONS = {
  explorer: ['explorer', 'amber'], edge: ['edge', 'blue'], recycle: ['recycle', 'teal'],
  settings: ['settings', 'slate'], setup: ['setup', 'blue'], calc: ['calc', 'green'],
  notepad: ['notepad', 'violet'], photos: ['photos', 'blue'], store: ['store', 'blue'],
  paint: ['paint', 'red'], clock: ['clock', 'blue'], player: ['player', 'red'],
  camera: ['camera', 'teal'], mail: ['mail', 'blue'], weather: ['weather', 'amber'],
  cmd: ['terminal', 'ink'], terminal: ['terminal', 'ink'], folder: ['folder', 'amber'],
  grid: ['start', 'slate']
};
/* 标题栏 / 任务视图 / 搜索结果使用单色图标，保证小尺寸清晰 */
function v14MonoIcon(type) {
  var m = V14_APP_ICONS[type] || V14_APP_ICONS.grid;
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#v14-' + m[0] + '"/></svg>';
}
if (typeof AppWindows === 'object' && AppWindows) {
  AppWindows._defaultIcon = function (type) { return v14MonoIcon(type); };
}

/* ---- 动效偏好 ---- */
function v14ReadStill() {
  try { return localStorage.getItem(V14_ANIM_KEY) === 'reduced'; } catch (e) { return false; }
}
function v14IsStill() { return v14.still; }
function v14SetStill(on) {
  v14.still = !!on;
  document.body.classList.toggle('v14-still', v14.still);
  var bar = document.getElementById('tbCenter');
  if (bar) bar.querySelectorAll('.tb-btn').forEach(function (b) { b.style.transform = ''; });
  try { localStorage.setItem(V14_ANIM_KEY, v14.still ? 'reduced' : 'full'); } catch (e) { /* 隐私模式 */ }
  document.querySelectorAll('[data-anim]').forEach(function (b) {
    b.classList.toggle('on', (b.dataset.anim === 'reduced') === v14.still);
  });
}

/* ---- 任务栏 Dock 放大 ---- */
function v14BindDock() {
  var bar = document.getElementById('tbCenter');
  if (!bar) return;
  var btns = Array.prototype.slice.call(bar.querySelectorAll('.tb-btn'));
  function paint() {
    v14.dockTicking = false;
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var r = b.getBoundingClientRect();
      var d = Math.abs(v14.lastX - (r.left + r.width / 2));
      var t = Math.max(0, 1 - d / 130);
      var k = t * t;
      b.style.transform = 'translate3d(0,' + (-7 * k).toFixed(2) + 'px,0) scale(' + (1 + 0.34 * k).toFixed(3) + ')';
    }
  }
  bar.addEventListener('pointermove', function (e) {
    if (v14.still) return;
    v14.lastX = e.clientX;
    if (!v14.dockTicking) { v14.dockTicking = true; requestAnimationFrame(paint); }
  }, { passive: true });
  bar.addEventListener('pointerleave', function () {
    btns.forEach(function (b) { b.style.transform = ''; });
  });
}

/* ---- 壁纸视差与跟随光斑 ---- */
function v14BindParallax() {
  var desk = document.getElementById('s-desktop');
  var aurora = document.querySelector('#wall .v14-aurora');
  var spot = document.getElementById('v14Spot');
  if (!desk || !aurora) return;
  var px = 0, py = 0;
  document.addEventListener('pointermove', function (e) {
    if (v14.still || !desk.classList.contains('active')) return;
    px = (e.clientX / window.innerWidth - 0.5) * 2;
    py = (e.clientY / window.innerHeight - 0.5) * 2;
    if (v14.ticking) return;
    v14.ticking = true;
    requestAnimationFrame(function () {
      v14.ticking = false;
      aurora.style.transform = 'translate3d(' + (px * -14).toFixed(1) + 'px,' + (py * -10).toFixed(1) + 'px,0)';
      if (spot) spot.style.transform = 'translate3d(' + e.clientX.toFixed(0) + 'px,' + e.clientY.toFixed(0) + 'px,0)';
    });
  }, { passive: true });
}

/* ---- 按钮波纹 ---- */
function v14BindRipple() {
  document.addEventListener('pointerdown', function (e) {
    if (v14.still) return;
    var el = e.target.closest('.btn');
    if (!el || el.disabled) return;
    var r = el.getBoundingClientRect();
    var ink = document.createElement('span');
    var size = Math.max(r.width, r.height) * 1.1;
    ink.className = 'v14-ripple';
    ink.style.width = ink.style.height = size + 'px';
    ink.style.left = (e.clientX - r.left - size / 2) + 'px';
    ink.style.top = (e.clientY - r.top - size / 2) + 'px';
    el.appendChild(ink);
    setTimeout(function () { if (ink.parentNode) ink.parentNode.removeChild(ink); }, 620);
  }, { passive: true });
}

/* ---- 桌面初始化 ---- */
function v14OnDesktop() {
  var aurora = document.querySelector('#wall .v14-aurora');
  if (aurora) {
    aurora.style.animation = 'none';
    // 重新触发极光浮动，让每次进入桌面都有新鲜的动效
    void aurora.offsetWidth;
    aurora.style.animation = '';
  }
  var icons = document.getElementById('deskIcons');
  if (icons) {
    icons.classList.remove('v14-in');
    void icons.offsetWidth;
    icons.classList.add('v14-in');
  }
}

/* ---- 生命周期与事件绑定 ---- */
function v14Boot() {
  if (v14ReadStill()) v14SetStill(true);
  v14BindDock();
  v14BindParallax();
  v14BindRipple();

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-anim]');
    if (b) v14SetStill(b.dataset.anim === 'reduced');
  });

  // 页面隐藏时暂停高开销动画，返回后恢复
  document.addEventListener('visibilitychange', function () {
    document.body.classList.toggle('v14-hidden', document.hidden);
  });

  var origDesktop = hooks.desktop;
  hooks.desktop = function () {
    if (typeof origDesktop === 'function') origDesktop.apply(this, arguments);
    v14OnDesktop();
  };

  window.__v14 = {
    setStill: v14SetStill,
    icon: v14Icon,
    mono: v14MonoIcon,
    get still() { return v14.still; }
  };
}
v14Boot();

/* ============================================================
   v15.0 引擎：任务管理器、剪贴板历史、存储感知、专注助手、
   设置搜索、快捷键指南、动态主题、安装报告与通知清理
   约定：所有浮层复用 v14 的玻璃与弹簧动效；定时器在窗口关闭后自停。
   ============================================================ */
var V15_ANIM = 'windows11_sim_anim';
var V15_PALETTE = { 1: '#0067c0', 2: '#c2410c', 3: '#5b5bd6', 4: '#0f7b3f', 5: '#c0266b', 6: '#00707f', 7: '#6d3fe0' };
var V15 = {
  clip: [],
  pins: [],
  startup: { winsec: true, onedrive: true, teams: false, steam: true },
  focusUntil: 0,
  focusTick: 0,
  procs: {},
  st: { scanned: false, sizes: [2.4, 1.1, 3.6, 0.8], total: 4.0, cleaned: false },
  cpuHist: [], memHist: []
};
state.v15 = state.v15 || { focus: false, notifRead: false };

function v15Esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function v15GB(n) { return (Math.round(n * 10) / 10).toFixed(1) + ' GB'; }

/* ================= 剪贴板历史 ================= */
var V15_CLIP_MAX = 12;

function v15SelectionText() {
  var el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.selectionStart != null && el.selectionEnd > el.selectionStart) {
    return el.value.slice(el.selectionStart, el.selectionEnd);
  }
  return String(window.getSelection ? window.getSelection().toString() : '');
}
function v15PushClip(text) {
  text = String(text || '').trim();
  if (!text) return;
  V15.clip = V15.clip.filter(function (x) { return x !== text; });
  V15.clip.unshift(text);
  if (V15.clip.length > V15_CLIP_MAX) V15.clip.length = V15_CLIP_MAX;
  try { sessionStorage.setItem('win11_v15_clip', JSON.stringify(V15.clip)); } catch (e) { /* ignore */ }
  v15RenderClip();
}
function v15RenderClip() {
  var box = document.getElementById('v15ClipList');
  if (!box) return;
  if (!V15.clip.length) {
    box.innerHTML = '<div class="v15-clip-empty">' + _t('clip_empty') + '</div>';
    return;
  }
  /* 固定项排在最前，其余保持最近使用顺序 */
  var order = V15.clip.slice().sort(function (a, b) {
    return (V15.pins.indexOf(b) >= 0 ? 1 : 0) - (V15.pins.indexOf(a) >= 0 ? 1 : 0);
  });
  box.innerHTML = order.map(function (t) {
    var i = V15.clip.indexOf(t);
    var pinned = V15.pins.indexOf(t) >= 0;
    return '<div class="v15-clip-row' + (pinned ? ' pinned' : '') + '">' +
      '<button class="v15-clip-item" data-clip="' + i + '">' + v15Esc(t) + '</button>' +
      '<button class="v15-clip-pin" data-clip-pin="' + i + '" title="' + (pinned ? _t('clip_unpin') : _t('clip_pin')) + '">' + (pinned ? '★' : '☆') + '</button>' +
      '<button class="v15-clip-del" data-clip-del="' + i + '" title="' + _t('clip_delete') + '">×</button>' +
      '</div>';
  }).join('');
}
function v15SaveClip() {
  try {
    sessionStorage.setItem('win11_v15_clip', JSON.stringify(V15.clip));
    sessionStorage.setItem('win11_v15_pins', JSON.stringify(V15.pins));
  } catch (e) { /* ignore */ }
}
function v15TogglePin(i) {
  var t = V15.clip[i];
  if (t == null) return;
  var at = V15.pins.indexOf(t);
  if (at >= 0) V15.pins.splice(at, 1); else V15.pins.push(t);
  v15SaveClip();
  v15RenderClip();
}
function v15DeleteClip(i) {
  var t = V15.clip[i];
  if (t == null) return;
  V15.clip.splice(i, 1);
  var at = V15.pins.indexOf(t);
  if (at >= 0) V15.pins.splice(at, 1);
  v15SaveClip();
  v15RenderClip();
}
function v15OpenClip() {
  v15RenderClip();
  var lay = document.getElementById('v15Clip');
  if (lay) lay.hidden = false;
}
function v15CopyClip(i) {
  var text = V15.clip[i];
  if (!text) return;
  var done = function () { toast(_t('clip_copied')); v15CloseLayers(); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, done);
  } else {
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta); done();
  }
}

/* ================= 存储感知 ================= */
function v15RenderStorage() {
  var box = document.getElementById('v15StCats');
  if (!box) return;
  var keys = ['st_temp', 'st_recycle', 'st_cache', 'st_downloads'];
  var max = 3.8;
  box.innerHTML = keys.map(function (k, i) {
    var s = V15.st.sizes[i];
    var w = V15.st.scanned ? Math.min(100, s / max * 100) : 0;
    return '<div class="v15-cat"><b>' + _t(k) + '</b><em>' + (V15.st.scanned ? v15GB(s) : '—') + '</em>' +
      '<span class="v15-track"><i style="width:' + w.toFixed(1) + '%"></i></span></div>';
  }).join('');
  var sum = document.getElementById('v15StSum');
  if (sum) sum.textContent = V15.st.scanned ? _t('st_free') + ' ' + v15GB(V15.st.total) : '—';
  var clean = document.getElementById('v15StClean');
  if (clean) clean.disabled = !V15.st.scanned || V15.st.total <= 0.05;
}
function v15ScanStorage() {
  var btn = document.getElementById('v15StScan');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = _t('st_scanning');
  V15.st.scanned = false;
  V15.st.sizes = [2.4, 1.1, 3.6, 0.8];
  v15RenderStorage();
  var step = 0;
  var t = setInterval(function () {
    step++;
    var reveal = Math.min(4, step);
    var partial = V15.st.sizes.map(function (s, i) { return i < reveal ? s : 0; });
    var box = document.getElementById('v15StCats');
    if (!box) { clearInterval(t); return; }
    V15.st.scanned = reveal >= 4;
    if (!V15.st.scanned) {
      box.querySelectorAll('.v15-cat').forEach(function (row, i) {
        var v = row.querySelector('em');
        var bar = row.querySelector('.v15-track i');
        if (partial[i] > 0) {
          v.textContent = v15GB(partial[i]);
          bar.style.width = Math.min(100, partial[i] / 3.8 * 100).toFixed(1) + '%';
        }
      });
    } else {
      V15.st.total = V15.st.sizes.reduce(function (a, b) { return a + b; }, 0);
      v15RenderStorage();
      btn.disabled = false;
      btn.textContent = _t('st_scan');
      clearInterval(t);
    }
  }, 260);
}
function v15CleanStorage() {
  if (!V15.st.scanned || V15.st.cleaned) return;
  var freed = V15.st.total;
  V15.st.cleaned = true;
  V15.st.sizes = [0.02, 0, 0.01, 0];
  V15.st.total = 0.03;
  v15RenderStorage();
  document.querySelectorAll('#v15StCats .v15-track i').forEach(function (b) { b.style.width = '2%'; });
  toast(_t('st_done', { n: v15GB(freed) }));
  var btn = document.getElementById('v15StClean');
  if (btn) btn.disabled = true;
}

/* ================= 专注助手 ================= */
var v15Toast0 = toast;
toast = function (msg) {
  if (state.v15 && state.v15.focusUntil > Date.now()) return;
  return v15Toast0(msg);
};
function v15FocusLeft() {
  var ms = Math.max(0, state.v15.focusUntil - Date.now());
  var s = Math.ceil(ms / 1000);
  var m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}
function v15SyncFocus() {
  var chip = document.getElementById('v15Focus');
  var txt = document.getElementById('v15FocusTxt');
  var on = state.v15.focusUntil > Date.now();
  state.v15.focus = on;
  if (chip) chip.hidden = !on;
  if (on && txt) txt.textContent = _t('focus_chip', { t: v15FocusLeft() });
  var tile = document.querySelector('#quickPanel [data-qc="focus"]');
  if (tile) tile.classList.toggle('on', on);
  if (!on && V15.focusTick) { clearInterval(V15.focusTick); V15.focusTick = 0; }
}
function v15StartFocus() {
  state.v15.focusUntil = Date.now() + 25 * 60 * 1000;
  v15SyncFocus();
  v15Toast0(_t('focus_on', { t: v15FocusLeft() }));
  if (V15.focusTick) clearInterval(V15.focusTick);
  V15.focusTick = setInterval(function () {
    if (state.v15.focusUntil <= Date.now()) {
      state.v15.focusUntil = 0;
      v15SyncFocus();
      v15Toast0(_t('focus_off'));
      return;
    }
    v15SyncFocus();
  }, 1000);
}
function v15StopFocus() {
  state.v15.focusUntil = 0;
  v15SyncFocus();
  v15Toast0(_t('focus_off'));
}

/* ================= 动态主题 ================= */
function v15DynamicTheme() {
  var wall = Number(state.theme && state.theme.wall) || 1;
  var h = new Date().getHours();
  if (state.theme) {
    state.theme.accent = V15_PALETTE[wall] || '#0067c0';
    state.theme.mode = (h >= 19 || h < 7) ? 'dark' : 'light';
  }
  if (typeof applyTheme === 'function') applyTheme();
  if (typeof savePrefs === 'function') savePrefs();
  toast(_t('theme_dyn_on'));
}

/* ================= 任务管理器 ================= */
function v15SysProcs() {
  return [
    { id: 'sys_idle', name: 'System Idle Process', cpu: 91, mem: 8, sys: true },
    { id: 'sys_svchost', name: 'svchost.exe', cpu: 2.1, mem: 96, sys: true },
    { id: 'sys_dwm', name: 'dwm.exe', cpu: 1.4, mem: 148, sys: true },
    { id: 'sys_defender', name: 'MsMpEng.exe', cpu: 0.8, mem: 212, sys: true },
    { id: 'sys_runtime', name: 'RuntimeBroker.exe', cpu: 0.2, mem: 42, sys: true }
  ];
}
function v15ProcRows() {
  var rows = [];
  Object.keys(state.openWindows).forEach(function (id) {
    var win = state.openWindows[id];
    if (!win) return;
    var type = win.dataset.type || 'app';
    if (type === 'taskmgr') return;
    var title = (win.querySelector('.win-title') || {}).textContent || type;
    var p = V15.procs[id] || (V15.procs[id] = { cpu: 0.4 + Math.random() * 4, mem: 70 + Math.random() * 300 });
    rows.push({ id: id, name: title, cpu: p.cpu, mem: p.mem, app: true });
  });
  return rows;
}
function v15RenderTaskMgr(win) {
  var body = win.querySelector('.win-body');
  if (!body) return;
  body.innerHTML =
    '<div class="tm">' +
      '<div class="tm-tabs">' +
        '<button data-tm="proc" class="on">' + _t('tm_tab_proc') + '</button>' +
        '<button data-tm="perf">' + _t('tm_tab_perf') + '</button>' +
        '<button data-tm="start">' + _t('tm_tab_start') + '</button>' +
      '</div>' +
      '<div class="tm-body" id="v15TmBody"></div>' +
    '</div>';
  var tab = 'proc';
  var host = body.querySelector('#v15TmBody');

  function drawProc() {
    var rows = v15ProcRows();
    var html = '<div class="tm-sect">' + _t('tm_apps') + '</div>' +
      '<div class="tm-row head"><span class="n">' + _t('tm_name') + '</span><span class="s">' + _t('tm_status') + '</span><span class="v">' + _t('tm_cpu') + '</span><span class="v">' + _t('tm_mem') + '</span><span></span></div>';
    if (!rows.length) html += '<div class="tm-none">' + _t('tm_none') + '</div>';
    html += rows.map(function (r) {
      return '<div class="tm-row"><span class="n"><svg viewBox="0 0 24 24"><use href="#v14-taskview"/></svg><b>' + v15Esc(r.name) + '</b></span>' +
        '<span class="s">' + _t('tm_running') + '</span>' +
        '<span class="v">' + r.cpu.toFixed(1) + '%</span>' +
        '<span class="v">' + Math.round(r.mem) + ' MB</span>' +
        '<button class="tm-end" data-end="' + v15Esc(r.id) + '">' + _t('tm_end') + '</button></div>';
    }).join('');
    html += '<div class="tm-sect">' + _t('tm_sys') + '</div>' +
      v15SysProcs().map(function (r) {
        return '<div class="tm-row"><span class="n"><svg viewBox="0 0 24 24"><use href="#v14-settings"/></svg><b>' + v15Esc(r.name) + '</b></span>' +
          '<span class="s">' + _t('tm_running') + '</span>' +
          '<span class="v">' + r.cpu.toFixed(1) + '%</span>' +
          '<span class="v">' + r.mem + ' MB</span><span></span></div>';
      }).join('');
    host.innerHTML = html;
  }

  function spark(vals) {
    var w = 160, h = 34;
    if (vals.length < 2) return '';
    var pts = vals.map(function (v, i) {
      return (i / (vals.length - 1) * w).toFixed(1) + ',' + (h - 2 - (v / 100) * (h - 6)).toFixed(1);
    });
    var d = 'M' + pts.join('L');
    return '<svg class="tm-spark" viewBox="0 0 160 34" preserveAspectRatio="none">' +
      '<path class="area" d="' + d + 'L' + w + ',34L0,34Z"/><path class="line" d="' + d + '"/></svg>';
  }
  function drawPerf() {
    var cpu = Math.max(3, Math.min(96, 22 + Math.random() * 26));
    var mem = Math.max(28, Math.min(88, 52 + Math.random() * 12));
    var disk = 4 + Math.random() * 18;
    var net = Math.random() * 6;
    V15.cpuHist.push(cpu); if (V15.cpuHist.length > 30) V15.cpuHist.shift();
    V15.memHist.push(mem); if (V15.memHist.length > 30) V15.memHist.shift();
    host.innerHTML =
      '<div class="tm-perf">' +
        '<div class="tm-card"><h4>' + _t('tm_cpu') + '</h4><div class="big">' + cpu.toFixed(0) + '<em>%</em></div>' + spark(V15.cpuHist) + '</div>' +
        '<div class="tm-card"><h4>' + _t('tm_mem') + '</h4><div class="big">' + mem.toFixed(0) + '<em>%</em></div>' + spark(V15.memHist) + '</div>' +
        '<div class="tm-card"><h4>' + _t('tm_disk') + '</h4><div class="big">' + disk.toFixed(0) + '<em>%</em></div>' + spark(V15.cpuHist.map(function (v) { return Math.max(2, v * 0.35 + 6); })) + '</div>' +
        '<div class="tm-card"><h4>' + _t('tm_net') + '</h4><div class="big">' + net.toFixed(1) + '<em>Mbps</em></div>' + spark(V15.memHist.map(function (v) { return Math.max(2, v * 0.22); })) + '</div>' +
      '</div>';
  }
  function drawStart() {
    var items = [
      { k: 'winsec', n: 'Windows Security', imp: 'high' },
      { k: 'onedrive', n: 'OneDrive', imp: 'med' },
      { k: 'teams', n: 'Microsoft Teams', imp: 'med' },
      { k: 'steam', n: 'Steam', imp: 'low' }
    ];
    host.innerHTML = '<div class="tm-sect">' + _t('tm_startup') + '</div>' +
      '<div class="tm-row head"><span class="n">' + _t('tm_name') + '</span><span class="s">' + _t('tm_impact') + '</span><span></span><span></span><span></span></div>' +
      items.map(function (it) {
        var on = !!V15.startup[it.k];
        return '<div class="tm-row"><span class="n"><svg viewBox="0 0 24 24"><use href="#v14-power"/></svg><b>' + it.n + '</b></span>' +
          '<span class="s">' + _t('tm_impact_' + it.imp) + '</span><span></span>' +
          '<span class="s">' + (on ? _t('tm_enabled') : _t('tm_disabled')) + '</span>' +
          '<button class="tm-toggle' + (on ? ' on' : '') + '" data-start="' + it.k + '">' + _t('tm_tab_start') + '</button></div>';
      }).join('');
  }
  function draw() {
    if (tab === 'proc') drawProc();
    else if (tab === 'start') drawStart();
    else drawPerf();
  }
  draw();

  body.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tm]');
    if (t) {
      tab = t.dataset.tm;
      body.querySelectorAll('[data-tm]').forEach(function (b) { b.classList.toggle('on', b === t); });
      draw();
      return;
    }
    var end = e.target.closest('[data-end]');
    if (end) {
      var id = end.dataset.end;
      if (typeof AppWindows.close === 'function') AppWindows.close(id);
      drawProc();
      return;
    }
    var st = e.target.closest('[data-start]');
    if (st) {
      V15.startup[st.dataset.start] = !V15.startup[st.dataset.start];
      drawStart();
    }
  });

  var timer = setInterval(function () {
    if (!body.isConnected) { clearInterval(timer); return; }
    if (tab === 'proc') drawProc();
    else if (tab === 'perf') drawPerf();
  }, 1200);
}

/* ================= 设置搜索 ================= */
function v15InjectSettingsSearch(body) {
  if (!body) return;
  var nav = body.querySelector('.settings__nav');
  if (!nav || nav.querySelector('.v15-setsrch')) return;
  var wrap = document.createElement('div');
  wrap.className = 'v15-setsrch';
  wrap.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l4.5 4.5"/></svg>' +
    '<input type="text" placeholder="' + _t('set_search_ph') + '" aria-label="' + _t('set_search_ph') + '">';
  nav.insertBefore(wrap, nav.firstChild);
  var nores = document.createElement('div');
  nores.className = 'v15-nores';
  nores.textContent = _t('set_noresult');
  nores.hidden = true;
  nav.appendChild(nores);
  var input = wrap.querySelector('input');
  input.addEventListener('input', function () {
    var q = input.value.trim().toLowerCase();
    var shown = 0;
    nav.querySelectorAll('.s-item').forEach(function (it) {
      var hit = !q || it.textContent.toLowerCase().indexOf(q) >= 0;
      it.classList.toggle('v15-hide', !hit);
      if (hit) shown++;
    });
    nores.hidden = !q || shown > 0;
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      input.value = '';
      input.dispatchEvent(new Event('input'));
      input.blur();
    } else if (e.key === 'Enter') {
      var first = nav.querySelector('.s-item:not(.v15-hide)');
      if (first) first.click();
    }
  });
}
var v15RenderSettingsOld = AppWindows._renderSettings;
AppWindows._renderSettings = function (body, page) {
  var out = v15RenderSettingsOld.apply(this, arguments);
  try { v15InjectSettingsSearch(body); } catch (e) { /* ignore */ }
  return out;
};

/* ================= 窗口注册：任务管理器 ================= */
var v15RenderContentOld = AppWindows._renderContent;
AppWindows._renderContent = function (win, type, opts) {
  if (type === 'taskmgr') { v15RenderTaskMgr(win); return; }
  return v15RenderContentOld.apply(this, arguments);
};
var v15DefaultTitleOld = AppWindows._defaultTitle;
AppWindows._defaultTitle = function (type) {
  if (type === 'taskmgr') return _t('app_taskmgr');
  return v15DefaultTitleOld.call(this, type);
};
var v15DefaultIconOld = AppWindows._defaultIcon;
AppWindows._defaultIcon = function (type) {
  if (type === 'taskmgr') return '<svg viewBox="0 0 24 24"><use href="#v15-taskmgr"/></svg>';
  return v15DefaultIconOld.call(this, type);
};

/* ================= 安装报告 ================= */
function v15ExportReport() {
  var lines = ['# Windows 11 安装报告', '', '- 生成时间：' + new Date().toLocaleString()];
  var grid = document.querySelectorAll('#s-done .sum-grid > div');
  grid.forEach(function (d) {
    var t = d.innerText.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (t.length >= 2) lines.push('- ' + t[0] + '：' + t.slice(1).join(' '));
  });
  var dur = document.getElementById('sumDuration');
  if (dur && dur.textContent.trim()) lines.push('- 总耗时：' + dur.textContent.trim());
  lines.push('', '---', '由 Windows 11 安装模拟器 15.0 生成。');
  var txt = lines.join('\n');
  var blob = new Blob([txt], { type: 'text/markdown;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'install-report.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  if (typeof fsSave === 'function') { try { fsSave('install-report.md', txt); } catch (e) { /* ignore */ } }
  if (!(state.v15 && state.v15.focusUntil > Date.now())) v15Toast0(_t('report_done'));
}

/* ================= 通知清理 ================= */
function v15SyncNotifDot() {
  var dot = document.getElementById('notifDot');
  if (!dot) return;
  var cleared = false;
  try { cleared = sessionStorage.getItem('win11_v15_notif') === '1'; } catch (e) { /* ignore */ }
  dot.classList.toggle('on', !cleared && !state.v15.notifRead);
}
function v15SyncNcEmpty() {
  var body = document.querySelector('#notifCenter .nc-body');
  if (!body) return;
  var empty = body.querySelector('.nn-empty');
  if (!empty) return;
  var any = Array.prototype.some.call(body.querySelectorAll('.nc-notif'), function (n) { return !n.hidden; });
  empty.style.display = any ? 'none' : '';
  var clear = body.querySelector('.nc-clear');
  if (clear) clear.hidden = !any;
}
function v15ClearNotifs() {
  document.querySelectorAll('#notifCenter .nc-notif').forEach(function (n) { n.hidden = true; });
  try { sessionStorage.setItem('win11_v15_notif', '1'); } catch (e) { /* ignore */ }
  state.v15.notifRead = true;
  v15SyncNotifDot();
  v15SyncNcEmpty();
}

/* ================= 浮层与快捷键 ================= */
function v15CloseLayers() {
  ['v15Clip', 'v15Storage', 'v15Keys'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.hidden = true;
  });
}
function v15OpenLayer(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.hidden = false;
}
function v15Boot() {
  try {
    var saved = sessionStorage.getItem('win11_v15_clip');
    if (saved) V15.clip = JSON.parse(saved) || [];
    var savedPins = sessionStorage.getItem('win11_v15_pins');
    if (savedPins) V15.pins = JSON.parse(savedPins) || [];
  } catch (e) { /* ignore */ }

  /* 复制内容记录 */
  ['copy', 'cut'].forEach(function (evt) {
    document.addEventListener(evt, function () {
      setTimeout(function () { v15PushClip(v15SelectionText()); }, 0);
    }, true);
  });

  /* 浮层点击：关闭 / 复制 */
  document.addEventListener('click', function (e) {
    var x = e.target.closest('[data-v15-close]');
    if (x) { v15CloseLayers(); return; }
    var pin = e.target.closest('[data-clip-pin]');
    if (pin) { v15TogglePin(Number(pin.dataset.clipPin)); return; }
    var del = e.target.closest('[data-clip-del]');
    if (del) { v15DeleteClip(Number(del.dataset.clipDel)); return; }
    var item = e.target.closest('[data-clip]');
    if (item) { v15CopyClip(Number(item.dataset.clip)); return; }
    if (e.target.id === 'v15Clip' || e.target.id === 'v15Storage' || e.target.id === 'v15Keys') { v15CloseLayers(); }
  });

  document.getElementById('v15ClipClear').addEventListener('click', function () {
    V15.clip = [];
    V15.pins = [];
    v15SaveClip();
    v15RenderClip();
  });

  /* 存储感知 */
  document.getElementById('v15StScan').addEventListener('click', v15ScanStorage);
  document.getElementById('v15StClean').addEventListener('click', v15CleanStorage);
  v15RenderStorage();

  /* 专注胶囊 */
  document.getElementById('v15Focus').addEventListener('click', v15StopFocus);

  /* 快捷设置磁贴 */
  document.querySelectorAll('[data-v15]').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.dataset.v15;
      if (k === 'storage') { v15OpenLayer('v15Storage'); }
      else if (k === 'theme') { v15DynamicTheme(); }
    });
  });
  var focusTile = document.querySelector('#quickPanel [data-qc="focus"]');
  if (focusTile) {
    focusTile.addEventListener('click', function () {
      if (state.v15.focusUntil > Date.now()) v15StopFocus(); else v15StartFocus();
    });
  }

  /* 通知 */
  var clearBtn = document.getElementById('ncClear');
  if (clearBtn) clearBtn.addEventListener('click', v15ClearNotifs);
  v15SyncNotifDot();
  v15SyncNcEmpty();

  /* 剪贴板 / 任务管理器 / 关闭浮层 */
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
      e.preventDefault(); v15OpenClip(); return;
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'Escape') {
      e.preventDefault(); AppWindows.open('taskmgr'); return;
    }
    if (e.key === 'Escape') {
      var open = ['v15Clip', 'v15Storage', 'v15Keys'].some(function (id) {
        var el = document.getElementById(id); return el && !el.hidden;
      });
      if (open) v15CloseLayers();
    }
  }, true);

  /* 长按 Win：快捷键指南 */
  var winTimer = 0;
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Meta' || e.key === 'OS') && !winTimer) {
      winTimer = setTimeout(function () { winTimer = -1; v15OpenLayer('v15Keys'); }, 900);
    }
  }, true);
  document.addEventListener('keyup', function (e) {
    if (e.key === 'Meta' || e.key === 'OS') {
      if (winTimer > 0) clearTimeout(winTimer);
      winTimer = 0;
    }
  }, true);
  var badge = document.getElementById('versionBadge');
  if (badge) badge.addEventListener('click', function () { v15OpenLayer('v15Keys'); });

  /* 安装报告按钮 */
  document.addEventListener('click', function (e) {
    if (e.target.closest('#v15Report')) v15ExportReport();
  });

  /* 打开通知中心即视为已读 */
  var notifBtn = document.getElementById('notifBtn');
  if (notifBtn) notifBtn.addEventListener('click', function () {
    state.v15.notifRead = true;
    setTimeout(v15SyncNotifDot, 0);
  });

  window.__v15 = {
    taskmgr: function () { return AppWindows.open('taskmgr'); },
    clip: v15OpenClip,
    storage: function () { v15OpenLayer('v15Storage'); },
    keys: function () { v15OpenLayer('v15Keys'); },
    focus: v15StartFocus,
    theme: v15DynamicTheme,
    report: v15ExportReport,
    state: V15
  };
}
v15Boot();

/* ============================================================
   v16.0 引擎：邮件重写、日历、待办、个性化中心
   ============================================================ */
var V16_PRESETS = {
  p1: { wall: 2, accent: '#c2410c', mode: 'light' },
  p2: { wall: 3, accent: '#0067c0', mode: 'light' },
  p3: { wall: 4, accent: '#0f7b3f', mode: 'light' },
  p4: { wall: 6, accent: '#6d3fe0', mode: 'dark' }
};
var V16_ACCENTS = ['#0067c0', '#0f7b3f', '#c2410c', '#c0266b', '#6d3fe0', '#00707f', '#8a5a00', '#44546a'];
var V16_DEFAULT = { preset: '', accent: '#0067c0', wall: 1, mode: 'light', align: 'center', icon: 44, labels: true, transparent: true, compact: false };
var V16 = { prefs: null, mail: null, cal: null, todo: null };

function v16Esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function v16Pad(n) { return (n < 10 ? '0' : '') + n; }
function v16YMD(d) { return d.getFullYear() + '-' + v16Pad(d.getMonth() + 1) + '-' + v16Pad(d.getDate()); }
function v16NowHM() { var d = new Date(); return v16Pad(d.getHours()) + ':' + v16Pad(d.getMinutes()); }
function v16Locale() { return (window.__i18n && window.__i18n.current) || 'zh-CN'; }

/* ================= 个性化 ================= */
function v16ApplyPrefs(p, silent) {
  V16.prefs = p;
  if (state.theme) {
    state.theme.wall = p.wall;
    state.theme.accent = p.accent;
    state.theme.mode = p.mode;
  }
  if (typeof applyTheme === 'function') applyTheme();
  document.body.dataset.v16Align = p.align;
  document.body.classList.toggle('v16-compact', !!p.compact);
  document.body.classList.toggle('v16-opaque', !p.transparent);
  document.body.classList.toggle('v16-nolabel', !p.labels);
  document.documentElement.style.setProperty('--v16-icon', p.icon + 'px');
  try { localStorage.setItem('win11_v16_prefs', JSON.stringify(p)); } catch (e) { /* ignore */ }
  if (!silent) toast(_t('ps_applied'));
}
function v16LoadPrefs() {
  var p = Object.assign({}, V16_DEFAULT);
  try {
    var raw = localStorage.getItem('win11_v16_prefs');
    if (raw) p = Object.assign(p, JSON.parse(raw) || {});
  } catch (e) { /* ignore */ }
  V16.prefs = p;
  v16ApplyPrefs(p, true);
}
function v16RenderPersonalize(body) {
  var p = V16.prefs || Object.assign({}, V16_DEFAULT);
  var walls = [1, 2, 3, 4, 5, 6, 7];
  body.innerHTML =
    '<div class="p16">' +
      '<div class="p16-left"><div class="p16-prev" id="p16Prev"></div><div class="p16-prevcap" data-i18n="ps_preview">' + _t('ps_preview') + '</div></div>' +
      '<div class="p16-right" id="p16Ctrl"></div>' +
    '</div>';
  var ctrl = body.querySelector('#p16Ctrl');
  ctrl.innerHTML =
    '<div class="p16-sec"><b>' + _t('ps_preset') + '</b><div class="p16-presets" id="p16Presets">' +
      ['p1', 'p2', 'p3', 'p4'].map(function (k) {
        return '<button class="p16-preset" data-preset="' + k + '"><i class="p16-pv p16-pv--' + k + '"></i><span>' + _t('ps_' + k) + '</span></button>';
      }).join('') + '</div></div>' +
    '<div class="p16-sec"><b>' + _t('ps_accent') + '</b><div class="p16-row" id="p16Accents">' +
      V16_ACCENTS.map(function (c) {
        return '<button class="p16-dot" data-accent="' + c + '" style="background:' + c + '"></button>';
      }).join('') +
      '<label class="p16-custom"><input type="color" id="p16Color" value="' + p.accent + '"><span>' + _t('ps_custom') + '</span></label>' +
    '</div></div>' +
    '<div class="p16-sec"><b>' + _t('ps_wall') + '</b><div class="p16-walls" id="p16Walls">' +
      walls.map(function (w) {
        return '<button class="p16-wall" data-wall="' + w + '" data-w="' + w + '"></button>';
      }).join('') + '</div></div>' +
    '<div class="p16-sec"><b>' + _t('ps_align') + '</b><div class="p16-seg" id="p16Align">' +
      '<button data-align="center">' + _t('ps_center') + '</button><button data-align="left">' + _t('ps_left') + '</button></div></div>' +
    '<div class="p16-sec"><b>' + _t('ps_iconsize') + '</b><div class="p16-seg" id="p16Icon">' +
      '<button data-icon="34">' + _t('ps_small') + '</button><button data-icon="44">' + _t('ps_medium') + '</button><button data-icon="56">' + _t('ps_large') + '</button></div></div>' +
    '<div class="p16-sec"><b>' + _t('ps_labels') + '</b><div class="p16-seg" id="p16Labels">' +
      '<button data-labels="1">' + _t('ps_show') + '</button><button data-labels="0">' + _t('ps_hide') + '</button></div></div>' +
    '<div class="p16-sec"><b>' + _t('ps_transparency') + '</b><div class="p16-seg" id="p16Trans">' +
      '<button data-trans="1">' + _t('ps_on') + '</button><button data-trans="0">' + _t('ps_off') + '</button></div></div>' +
    '<div class="p16-sec"><b>' + _t('ps_density') + '</b><div class="p16-seg" id="p16Density">' +
      '<button data-compact="0">' + _t('ps_comfort') + '</button><button data-compact="1">' + _t('ps_compact') + '</button></div></div>' +
    '<div class="p16-foot"><button class="p16-reset" id="p16Reset">' + _t('ps_reset') + '</button></div>';

  function paintPreview() {
    var box = body.querySelector('#p16Prev');
    if (!box) return;
    box.setAttribute('data-w', p.wall);
    box.innerHTML =
      '<div class="p16-pv-icons"><span><i style="background:' + p.accent + '"></i>' + (p.labels ? '<em>PC</em>' : '') + '</span>' +
      '<span><i style="background:#c2410c"></i>' + (p.labels ? '<em>Files</em>' : '') + '</span>' +
      '<span><i style="background:#0f7b3f"></i>' + (p.labels ? '<em>Store</em>' : '') + '</span></div>' +
      '<div class="p16-pv-bar' + (p.align === 'left' ? ' left' : '') + '"><span></span><span></span><span></span><span></span></div>';
  }
  function sync() {
    ctrl.querySelectorAll('[data-preset]').forEach(function (b) { b.classList.toggle('on', b.dataset.preset === p.preset); });
    ctrl.querySelectorAll('[data-accent]').forEach(function (b) { b.classList.toggle('on', b.dataset.accent.toLowerCase() === p.accent.toLowerCase()); });
    ctrl.querySelectorAll('[data-wall]').forEach(function (b) { b.classList.toggle('on', Number(b.dataset.wall) === p.wall); });
    ctrl.querySelectorAll('[data-align]').forEach(function (b) { b.classList.toggle('on', b.dataset.align === p.align); });
    ctrl.querySelectorAll('[data-icon]').forEach(function (b) { b.classList.toggle('on', Number(b.dataset.icon) === p.icon); });
    ctrl.querySelectorAll('[data-labels]').forEach(function (b) { b.classList.toggle('on', String(p.labels ? 1 : 0) === b.dataset.labels); });
    ctrl.querySelectorAll('[data-trans]').forEach(function (b) { b.classList.toggle('on', String(p.transparent ? 1 : 0) === b.dataset.trans); });
    ctrl.querySelectorAll('[data-compact]').forEach(function (b) { b.classList.toggle('on', String(p.compact ? 1 : 0) === b.dataset.compact); });
    paintPreview();
  }
  function commit(patch, silent) {
    Object.assign(p, patch);
    v16ApplyPrefs(p, silent);
    sync();
  }

  ctrl.addEventListener('click', function (e) {
    var pr = e.target.closest('[data-preset]');
    if (pr) { var d = V16_PRESETS[pr.dataset.preset]; commit({ preset: pr.dataset.preset, wall: d.wall, accent: d.accent, mode: d.mode }); return; }
    var ac = e.target.closest('[data-accent]');
    if (ac) { commit({ preset: '', accent: ac.dataset.accent }); return; }
    var wl = e.target.closest('[data-wall]');
    if (wl) { commit({ preset: '', wall: Number(wl.dataset.wall) }); return; }
    var al = e.target.closest('[data-align]');
    if (al) { commit({ preset: '', align: al.dataset.align }); return; }
    var ic = e.target.closest('[data-icon]');
    if (ic) { commit({ preset: '', icon: Number(ic.dataset.icon) }); return; }
    var lb = e.target.closest('[data-labels]');
    if (lb) { commit({ preset: '', labels: lb.dataset.labels === '1' }); return; }
    var tr = e.target.closest('[data-trans]');
    if (tr) { commit({ preset: '', transparent: tr.dataset.trans === '1' }); return; }
    var cp = e.target.closest('[data-compact]');
    if (cp) { commit({ preset: '', compact: cp.dataset.compact === '1' }); return; }
    if (e.target.closest('#p16Reset')) { commit(Object.assign({}, V16_DEFAULT), true); toast(_t('ps_applied')); }
  });
  var color = ctrl.querySelector('#p16Color');
  if (color) color.addEventListener('input', function () { commit({ preset: '', accent: color.value }, true); });
  sync();
}

/* ================= 邮件 ================= */
function v16SeedMail() {
  var base = (state.v13 && state.v13.mails) || [];
  if (!base.length) return [];
  return base.map(function (m, i) {
    return {
      id: 'seed' + i, from: _t('mail_from_team'), to: _t('mail_you'),
      subject: _t('mail_subject_' + m.key), body: _t('mail_body_' + m.key),
      time: m.time || v13NowHM(), unread: i === 0, starred: false, folder: 'inbox'
    };
  });
}
function v16MailState() {
  if (!V16.mail) {
    V16.mail = { folder: 'inbox', items: v16SeedMail(), sel: null, q: '', seq: 1 };
  }
  return V16.mail;
}
function v16RenderMail(body) {
  var M = v16MailState();
  body.innerHTML =
    '<div class="m16">' +
      '<div class="m16-side">' +
        '<button class="m16-new" id="m16New"><svg viewBox="0 0 24 24"><use href="#v16-pen"/></svg><span>' + _t('mail_compose') + '</span></button>' +
        '<div id="m16Folds"></div>' +
        '<div class="m16-unread" id="m16Unread"></div>' +
      '</div>' +
      '<div class="m16-mid">' +
        '<div class="m16-search"><svg viewBox="0 0 24 24"><use href="#v16-search"/></svg><input id="m16Q" placeholder="' + _t('mail_search') + '"></div>' +
        '<div class="m16-list" id="m16List"></div>' +
      '</div>' +
      '<div class="m16-main" id="m16Main"></div>' +
    '</div>';
  var folds = body.querySelector('#m16Folds');
  var list = body.querySelector('#m16List');
  var main = body.querySelector('#m16Main');
  var qEl = body.querySelector('#m16Q');

  function unreadCount() {
    return M.items.filter(function (m) { return m.folder === 'inbox' && m.unread; }).length;
  }
  function folderItems(f) {
    var q = M.q.trim().toLowerCase();
    return M.items.filter(function (m) {
      if (f === 'starred' ? !m.starred : m.folder !== f) return false;
      if (!q) return true;
      return (m.subject + ' ' + m.from + ' ' + m.to + ' ' + m.body).toLowerCase().indexOf(q) >= 0;
    });
  }
  function renderFolds() {
    var defs = [
      { k: 'inbox', t: _t('mail_inbox'), ic: 'v16-inbox' },
      { k: 'sent', t: _t('mail_sent'), ic: 'v16-send' },
      { k: 'drafts', t: _t('mail_drafts'), ic: 'v16-draft' },
      { k: 'starred', t: _t('mail_starred'), ic: 'v16-star' }
    ];
    folds.innerHTML = defs.map(function (d) {
      var n = d.k === 'starred' ? M.items.filter(function (m) { return m.starred; }).length : M.items.filter(function (m) { return m.folder === d.k; }).length;
      return '<button class="m16-fold' + (M.folder === d.k ? ' on' : '') + '" data-fold="' + d.k + '">' +
        '<svg viewBox="0 0 24 24"><use href="#' + d.ic + '"/></svg><span>' + d.t + '</span>' +
        '<em>' + (d.k === 'inbox' && unreadCount() ? unreadCount() : n) + '</em></button>';
    }).join('');
    var u = unreadCount();
    body.querySelector('#m16Unread').textContent = u ? _t('mail_unread', { n: u }) : '';
  }
  function renderList() {
    var items = folderItems(M.folder);
    if (!items.length) { list.innerHTML = '<div class="m16-empty">' + _t('mail_empty') + '</div>'; return; }
    list.innerHTML = items.map(function (m) {
      return '<button class="m16-item' + (m.unread ? ' unread' : '') + (M.sel === m.id ? ' on' : '') + '" data-id="' + m.id + '">' +
        '<span class="m16-from">' + v16Esc(m.from) + '<i>' + v16Esc(m.time) + '</i></span>' +
        '<span class="m16-subj">' + v16Esc(m.subject) + '</span>' +
        '<span class="m16-prev">' + v16Esc(m.body).slice(0, 60) + '</span></button>';
    }).join('');
  }
  function openReader(m) {
    M.sel = m.id;
    if (m.unread) { m.unread = false; renderFolds(); }
    list.querySelectorAll('.m16-item').forEach(function (b) { b.classList.toggle('on', b.dataset.id === m.id); });
    main.innerHTML =
      '<div class="m16-read"><div class="m16-rhd">' +
        '<h3>' + v16Esc(m.subject) + '</h3>' +
        '<div class="m16-meta">' + v16Esc(m.from) + ' · ' + v16Esc(m.time) + (m.to ? ' · → ' + v16Esc(m.to) : '') + '</div>' +
      '</div><div class="m16-body">' + v16Esc(m.body) + '</div>' +
      '<div class="m16-acts">' +
        '<button data-act="star">' + _t(m.starred ? 'mail_unstar' : 'mail_star') + '</button>' +
        '<button data-act="reply">' + _t('mail_compose') + '</button>' +
        '<button data-act="del">' + _t('mail_delete') + '</button>' +
      '</div></div>';
    main.querySelector('[data-act="star"]').addEventListener('click', function () {
      m.starred = !m.starred; renderFolds(); renderList(); openReader(m);
    });
    main.querySelector('[data-act="del"]').addEventListener('click', function () {
      M.items = M.items.filter(function (x) { return x.id !== m.id; });
      M.sel = null; renderFolds(); renderList();
      main.innerHTML = '<div class="m16-empty">' + _t('mail_empty') + '</div>';
    });
    main.querySelector('[data-act="reply"]').addEventListener('click', function () {
      compose({ to: m.from, subject: _t('mail_reply_subject', { s: m.subject }) });
    });
  }
  function compose(pre) {
    pre = pre || {};
    var contacts = ['team@contoso.com', 'friend@outlook.com', 'support@windows.com'];
    main.innerHTML =
      '<div class="m16-form">' +
        '<div class="m16-fh"><b>' + _t('mail_compose') + '</b><button class="m16-x" id="m16Cancel">×</button></div>' +
        '<label>' + _t('mail_to') + '<input class="inp" id="m16To" value="' + v16Esc(pre.to || '') + '"></label>' +
        '<div class="m16-chips">' + _t('mail_contacts') + ':' + contacts.map(function (c) {
          return '<button type="button" data-contact="' + c + '">' + c.split('@')[0] + '</button>';
        }).join('') + '</div>' +
        '<label>' + _t('mail_subject') + '<input class="inp" id="m16Sub" value="' + v16Esc(pre.subject || '') + '"></label>' +
        '<label class="grow">' + _t('mail_body') + '<textarea class="inp" id="m16Body" rows="7">' + v16Esc(pre.body || '') + '</textarea></label>' +
        '<div class="m16-err" id="m16Err"></div>' +
        '<div class="m16-fa">' +
          '<button class="btn" id="m16Draft">' + _t('mail_draft') + '</button>' +
          '<button class="btn primary" id="m16Send">' + _t('mail_send') + '</button>' +
        '</div>' +
      '</div>';
    var to = main.querySelector('#m16To');
    var sub = main.querySelector('#m16Sub');
    var txt = main.querySelector('#m16Body');
    var err = main.querySelector('#m16Err');
    main.querySelectorAll('[data-contact]').forEach(function (b) {
      b.addEventListener('click', function () { to.value = b.dataset.contact; to.focus(); });
    });
    main.querySelector('#m16Cancel').addEventListener('click', function () {
      main.innerHTML = '<div class="m16-empty">' + _t('mail_empty') + '</div>';
    });
    main.querySelector('#m16Draft').addEventListener('click', function () {
      M.items.push({
        id: 'd' + (M.seq++), from: _t('mail_you'), to: to.value.trim(),
        subject: sub.value.trim() || '—', body: txt.value, time: v16NowHM(),
        unread: false, starred: false, folder: 'drafts'
      });
      M.folder = 'drafts';
      toast(_t('mail_draft_saved'));
      renderFolds(); renderList();
      main.innerHTML = '<div class="m16-empty">' + _t('mail_draft_saved') + '</div>';
    });
    main.querySelector('#m16Send').addEventListener('click', function () {
      var addr = to.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
        err.textContent = _t('mail_err_to');
        to.focus();
        return;
      }
      err.textContent = '';
      var btn = main.querySelector('#m16Send');
      btn.disabled = true;
      btn.textContent = _t('mail_sending');
      var subject = sub.value.trim() || '—';
      var payload = {
        id: 's' + (M.seq++), from: _t('mail_you'), to: addr, subject: subject,
        body: txt.value, time: v16NowHM(), unread: false, starred: false, folder: 'sent'
      };
      toast(_t('mail_sent_to', { to: addr }));
      v8Log('Mail sent: ' + subject);
      setTimeout(function () {
        M.items.push(payload);
        renderFolds();
        if (list.isConnected) { M.folder = 'sent'; renderFolds(); renderList(); }
        if (!main.isConnected) return;
        main.innerHTML = '<div class="m16-done"><b>' + _t('mail_sent_ok') + '</b><span>' + v16Esc(subject) + '</span><em>' + v16Esc(addr) + '</em></div>';
        /* 模拟对方自动回复 */
        setTimeout(function () {
          if (!list.isConnected) return;
          M.items.unshift({
            id: 'r' + (M.seq++), from: 'Contoso Support', to: _t('mail_you'),
            subject: _t('mail_reply_subject', { s: subject }), body: _t('mail_reply_body'),
            time: v16NowHM(), unread: true, starred: false, folder: 'inbox'
          });
          renderFolds(); renderList();
          if (M.folder === 'inbox') toast(_t('mail_unread', { n: 1 }));
        }, 2600);
      }, 900);
    });
  }

  folds.addEventListener('click', function (e) {
    var f = e.target.closest('[data-fold]');
    if (!f) return;
    M.folder = f.dataset.fold;
    M.sel = null;
    renderFolds(); renderList();
    main.innerHTML = '<div class="m16-empty">' + _t('mail_empty') + '</div>';
  });
  list.addEventListener('click', function (e) {
    var it = e.target.closest('[data-id]');
    if (!it) return;
    var m = M.items.filter(function (x) { return x.id === it.dataset.id; })[0];
    if (m) openReader(m);
  });
  qEl.addEventListener('input', function () { M.q = qEl.value; renderList(); });
  body.querySelector('#m16New').addEventListener('click', function () { compose({}); });

  renderFolds(); renderList();
  var first = M.items.filter(function (m) { return m.folder === 'inbox'; })[0];
  if (first) openReader(first);
  else main.innerHTML = '<div class="m16-empty">' + _t('mail_empty') + '</div>';
}

/* ================= 日历 ================= */
function v16CalState() {
  if (!V16.cal) {
    var t = new Date();
    V16.cal = { ym: new Date(t.getFullYear(), t.getMonth(), 1), sel: v16YMD(t), events: {}, seq: 1 };
  }
  return V16.cal;
}
function v16RenderCalendar(body) {
  var C = v16CalState();
  var loc = v16Locale();
  body.innerHTML = '<div class="c16"><div class="c16-left">' +
    '<div class="c16-hd"><b id="c16Title"></b><div class="c16-nav">' +
      '<button id="c16Prev">‹</button><button id="c16Today" class="mid">' + _t('cal_today') + '</button><button id="c16Next">›</button>' +
    '</div></div>' +
    '<div class="c16-week" id="c16Week"></div><div class="c16-grid" id="c16Grid"></div></div>' +
    '<div class="c16-side" id="c16Side"></div></div>';
  var title = body.querySelector('#c16Title');
  var week = body.querySelector('#c16Week');
  var grid = body.querySelector('#c16Grid');
  var side = body.querySelector('#c16Side');
  week.innerHTML = _t('cal_week').split(',').map(function (w) { return '<span>' + w + '</span>'; }).join('');

  function renderGrid() {
    title.textContent = C.ym.toLocaleDateString(loc, { year: 'numeric', month: 'long' });
    var y = C.ym.getFullYear(), m = C.ym.getMonth();
    var first = new Date(y, m, 1);
    var start = (first.getDay() + 6) % 7;
    var daysIn = new Date(y, m + 1, 0).getDate();
    var prevDays = new Date(y, m, 0).getDate();
    var today = v16YMD(new Date());
    var html = '';
    for (var i = 0; i < 42; i++) {
      var dayNum, cellDate, other = false;
      if (i < start) { dayNum = prevDays - start + i + 1; cellDate = v16YMD(new Date(y, m - 1, dayNum)); other = true; }
      else if (i >= start + daysIn) { dayNum = i - start - daysIn + 1; cellDate = v16YMD(new Date(y, m + 1, dayNum)); other = true; }
      else { dayNum = i - start + 1; cellDate = v16YMD(new Date(y, m, dayNum)); }
      var evs = C.events[cellDate] || [];
      var cls = 'c16-day' + (other ? ' other' : '') + (cellDate === today ? ' today' : '') + (cellDate === C.sel ? ' sel' : '');
      html += '<button class="' + cls + '" data-date="' + cellDate + '"><b>' + dayNum + '</b><span class="c16-dots">' +
        evs.slice(0, 3).map(function () { return '<i></i>'; }).join('') + '</span></button>';
    }
    grid.innerHTML = html;
  }
  function renderSide() {
    var d = new Date(C.sel + 'T00:00:00');
    var evs = C.events[C.sel] || [];
    side.innerHTML = '<div class="c16-shd"><b>' + d.toLocaleDateString(loc, { month: 'long', day: 'numeric', weekday: 'long' }) + '</b><span>' + _t('cal_events') + '</span></div>' +
      '<div class="c16-evs">' + (evs.length ? evs.map(function (e, i) {
        return '<div class="c16-ev"><i></i><span>' + v16Esc(e) + '</span><button data-del="' + i + '">×</button></div>';
      }).join('') : '<div class="c16-none">' + _t('cal_no_events') + '</div>') + '</div>' +
      '<div class="c16-add"><input id="c16Inp" placeholder="' + _t('cal_event_ph') + '"><button id="c16Add">' + _t('cal_add') + '</button></div>';
    var inp = side.querySelector('#c16Inp');
    function add() {
      var v = inp.value.trim();
      if (!v) return;
      (C.events[C.sel] = C.events[C.sel] || []).push(v);
      renderGrid(); renderSide();
    }
    side.querySelector('#c16Add').addEventListener('click', add);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
    side.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        C.events[C.sel].splice(Number(b.dataset.del), 1);
        renderGrid(); renderSide();
      });
    });
  }
  grid.addEventListener('click', function (e) {
    var b = e.target.closest('[data-date]');
    if (!b) return;
    C.sel = b.dataset.date;
    var d = new Date(C.sel + 'T00:00:00');
    C.ym = new Date(d.getFullYear(), d.getMonth(), 1);
    renderGrid(); renderSide();
  });
  body.querySelector('#c16Prev').addEventListener('click', function () {
    C.ym = new Date(C.ym.getFullYear(), C.ym.getMonth() - 1, 1); renderGrid();
  });
  body.querySelector('#c16Next').addEventListener('click', function () {
    C.ym = new Date(C.ym.getFullYear(), C.ym.getMonth() + 1, 1); renderGrid();
  });
  body.querySelector('#c16Today').addEventListener('click', function () {
    var t = new Date();
    C.ym = new Date(t.getFullYear(), t.getMonth(), 1);
    C.sel = v16YMD(t);
    renderGrid(); renderSide();
  });
  renderGrid(); renderSide();
}

/* ================= 待办 ================= */
function v16TodoState() {
  if (!V16.todo) {
    V16.todo = { items: [], filter: 'all', seq: 1 };
  }
  return V16.todo;
}
function v16RenderTodo(body) {
  var T = v16TodoState();
  body.innerHTML = '<div class="t16">' +
    '<div class="t16-hd"><h3>' + _t('app_todo') + '</h3><span id="t16Left"></span></div>' +
    '<div class="t16-add"><input id="t16Inp" placeholder="' + _t('todo_ph') + '"><button id="t16Add">' + _t('todo_add') + '</button></div>' +
    '<div class="t16-tabs" id="t16Tabs">' +
      '<button data-f="all">' + _t('todo_all') + '</button><button data-f="active">' + _t('todo_active') + '</button><button data-f="done">' + _t('todo_done') + '</button>' +
    '</div>' +
    '<div class="t16-list" id="t16List"></div>' +
    '<div class="t16-ft"><button id="t16Clear">' + _t('todo_clear') + '</button></div></div>';
  var list = body.querySelector('#t16List');
  var inp = body.querySelector('#t16Inp');
  function render() {
    body.querySelectorAll('[data-f]').forEach(function (b) { b.classList.toggle('on', b.dataset.f === T.filter); });
    var items = T.items.filter(function (x) {
      return T.filter === 'all' || (T.filter === 'active' ? !x.done : x.done);
    });
    list.innerHTML = items.length ? items.map(function (x) {
      return '<div class="t16-row' + (x.done ? ' done' : '') + '">' +
        '<button class="t16-check" data-tgl="' + x.id + '">' + (x.done ? '✓' : '') + '</button>' +
        '<span>' + v16Esc(x.text) + '</span>' +
        '<button class="t16-del" data-tdel="' + x.id + '">×</button></div>';
    }).join('') : '<div class="t16-empty">' + _t('todo_empty') + '</div>';
    var left = T.items.filter(function (x) { return !x.done; }).length;
    body.querySelector('#t16Left').textContent = _t('todo_left', { n: left });
  }
  function add() {
    var v = inp.value.trim();
    if (!v) return;
    T.items.unshift({ id: T.seq++, text: v, done: false });
    inp.value = '';
    render();
  }
  body.querySelector('#t16Add').addEventListener('click', add);
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
  body.querySelector('#t16Tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-f]'); if (!b) return;
    T.filter = b.dataset.f; render();
  });
  list.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tgl]');
    if (t) {
      var it = T.items.filter(function (x) { return x.id === Number(t.dataset.tgl); })[0];
      if (it) { it.done = !it.done; render(); }
      return;
    }
    var d = e.target.closest('[data-tdel]');
    if (d) { T.items = T.items.filter(function (x) { return x.id !== Number(d.dataset.tdel); }); render(); }
  });
  body.querySelector('#t16Clear').addEventListener('click', function () {
    T.items = T.items.filter(function (x) { return !x.done; }); render();
  });
  render();
}

/* ================= 注册 ================= */
var v16RenderContentOld = AppWindows._renderContent;
AppWindows._renderContent = function (win, type, opts) {
  var body = win.querySelector('.win-body');
  if (type === 'calendar') { v16RenderCalendar(body); return; }
  if (type === 'todo') { v16RenderTodo(body); return; }
  if (type === 'personalize') { v16RenderPersonalize(body); return; }
  return v16RenderContentOld.apply(this, arguments);
};
var v16DefaultTitleOld = AppWindows._defaultTitle;
AppWindows._defaultTitle = function (type) {
  if (type === 'calendar') return _t('app_calendar');
  if (type === 'todo') return _t('app_todo');
  if (type === 'personalize') return _t('app_personalize');
  return v16DefaultTitleOld.call(this, type);
};
var v16DefaultIconOld = AppWindows._defaultIcon;
AppWindows._defaultIcon = function (type) {
  if (type === 'calendar') return '<svg viewBox="0 0 24 24"><use href="#v16-calendar"/></svg>';
  if (type === 'todo') return '<svg viewBox="0 0 24 24"><use href="#v16-todo"/></svg>';
  if (type === 'personalize') return '<svg viewBox="0 0 24 24"><use href="#v16-palette"/></svg>';
  return v16DefaultIconOld.call(this, type);
};
v13RenderMail = function (body) { v16RenderMail(body); };

v16LoadPrefs();

window.__v16 = {
  state: V16,
  prefs: function () { return V16.prefs; },
  apply: function (patch) { v16ApplyPrefs(Object.assign({}, V16.prefs, patch), true); },
  open: function (type) { return AppWindows.open(type); },
  mail: function () { return v16MailState(); },
  calendar: function () { return v16CalState(); },
  todo: function () { return v16TodoState(); }
};

/* ============================================================
   v17.0 引擎：Copilot / 开始推荐 / 右键菜单 2.0 / 贴靠智能填充
              任务视图 2.0 / 托盘隐藏图标 / OEM 启动画面
   运行于主 IIFE 内（插入在 v16.js 之后、boot 之前）。
   ============================================================ */
var V17 = { menusBuilt: false, cpGreeted: false, ctxTarget: null };
state.v17 = state.v17 || { recentApps: [], recentFiles: [] };

function v17T(k, ctx) { return _t(k, ctx); }
function v17Esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function v17TimeAgo(ts) {
  var s = Math.floor((Date.now() - (ts || Date.now())) / 1000);
  if (s < 0) s = 0;
  if (s < 60) return v17T('rec_just_now');
  var m = Math.floor(s / 60);
  if (m < 60) return v17T('rec_min_ago', { n: m });
  return v17T('rec_hrs_ago', { n: Math.floor(m / 60) });
}

/* ---------- 最近文件/应用追踪 ---------- */
function v17SeedRecent() {
  var list = state.v17.recentFiles;
  if (!list.length) {
    list.push({ name: '欢迎使用 Windows 11.txt', time: Date.now() - 60000 });
    list.push({ name: '安装报告.md', time: Date.now() - 120000 });
  }
  Object.keys(state.tempFiles || {}).forEach(function (n) {
    if (n === 'settings.json') return;
    if (!list.some(function (x) { return x.name === n; })) list.push({ name: n, time: Date.now() - 180000 });
  });
}
function v17TrackFile(name) {
  if (!name || name === 'settings.json') return;
  var list = state.v17.recentFiles;
  list = list.filter(function (x) { return x.name !== name; });
  list.unshift({ name: name, time: Date.now() });
  state.v17.recentFiles = list.slice(0, 8);
}
function v17TrackApp(type) {
  if (!type || type === 'setup' || type === 'copilot') return;
  var list = state.v17.recentApps.filter(function (x) { return x !== type; });
  list.unshift(type);
  state.v17.recentApps = list.slice(0, 6);
}
var _v17fsSave = fsSave;
fsSave = function (name, content, cb) { v17TrackFile(name); return _v17fsSave.apply(this, arguments); };
var _v17AppOpen = AppWindows.open;
AppWindows.open = function (type, opts) {
  var r = _v17AppOpen.apply(this, arguments);
  if (type) v17TrackApp(type);
  return r;
};
var _v17OpenAppType = openAppType;
openAppType = function (type) {
  if (type === 'copilot') { v17OpenCopilot(); return null; }
  return _v17OpenAppType.apply(this, arguments);
};

/* ============================================================
   1. Copilot
   ============================================================ */
function v17ScrollChat() { var c = $('#cpChat'); if (c) c.scrollTop = c.scrollHeight; }
function v17Bubble(who, text) {
  var d = document.createElement('div');
  d.className = 'cp-msg ' + who;
  if (who === 'ai') {
    d.innerHTML = '<div class="who"><svg viewBox="0 0 32 32"><use href="#v17-copilot"/></svg>Copilot</div><div class="txt"></div>';
    d.querySelector('.txt').textContent = text;
  } else {
    d.textContent = text;
  }
  return d;
}
function v17Typewrite(el, full, done) {
  var i = 0;
  el.textContent = '';
  var timer = setInterval(function () {
    if (!document.body.contains(el)) { clearInterval(timer); if (done) done(); return; }
    i += 2;
    el.textContent = full.slice(0, i);
    v17ScrollChat();
    if (i >= full.length) { clearInterval(timer); if (done) done(); }
  }, 16);
}
function v17PushUser(text) {
  var c = $('#cpChat'); if (!c) return;
  c.appendChild(v17Bubble('user', text));
  v17ScrollChat();
}
function v17PushAi(text) {
  var c = $('#cpChat'); if (!c) return;
  var bubble = v17Bubble('ai', '');
  c.appendChild(bubble);
  v17ScrollChat();
  v17Typewrite(bubble.querySelector('.txt'), text);
}
function v17AppCatalog() {
  return $$('#startMenu .sm-app').map(function (a) {
    var labelEl = a.querySelector('[data-i18n]');
    var label = (labelEl ? labelEl.textContent : a.textContent).trim();
    return { type: a.dataset.open, label: label };
  }).filter(function (x) { return x.type && x.label; });
}
function v17CopilotReply(raw) {
  var t = (raw || '').toLowerCase();
  if (/你好|您好|hello|hi|嗨/.test(t) && !/天气|邮件|打开/.test(t)) return v17T('cp_hello');
  if (/帮助|help|能做什么|可以.*什么|会什么/.test(t)) return v17T('cp_help');
  if (/深色|dark|夜间|暗黑/.test(t)) {
    state.theme.mode = 'dark'; applyTheme(); savePrefs(); return v17T('cp_dark_on');
  }
  if (/浅色|light|白天|明亮/.test(t)) {
    state.theme.mode = 'light'; applyTheme(); savePrefs(); return v17T('cp_light_on');
  }
  if (/天气|weather|气温|多少度/.test(t)) return v17T('cp_weather_reply');
  if (/通知|notif|清除|clear|清理/.test(t)) {
    $$('#notifCenter .nc-notif').forEach(function (n) { n.remove(); });
    if (typeof v15SyncNcEmpty === 'function') v15SyncNcEmpty();
    return v17T('cp_notif_cleared');
  }
  if (/截图|screenshot|截屏/.test(t)) {
    var flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;z-index:2500;pointer-events:none;transition:opacity .15s';
    document.body.appendChild(flash);
    requestAnimationFrame(function () { flash.style.opacity = '.9'; setTimeout(function () { flash.style.opacity = '0'; setTimeout(function () { flash.remove(); }, 200); }, 90); });
    v17TrackFile('截图_' + new Date().getTime() + '.png');
    return v17T('cp_screenshot');
  }
  if (/邮件|mail|写信|邮/.test(t)) {
    AppWindows.open('mail');
    return v17T('cp_mail_done');
  }
  var cat = v17AppCatalog();
  var found = null;
  cat.forEach(function (a) { if (!found && raw.indexOf(a.label) >= 0) found = a; });
  if (found && (/打开|开启|启动|open|launch|帮我|我要|去|运行/.test(raw) || raw.trim() === found.label)) {
    openAppType(found.type);
    return v17T('cp_opened', { name: found.label });
  }
  return v17T('cp_help');
}
var v17CpBusy = false;
function v17Send(text) {
  text = (text || '').trim();
  if (!text || v17CpBusy) return;
  var input = $('#cpInput'); if (input) input.value = '';
  v17PushUser(text);
  v17CpBusy = true;
  var sendBtn = $('#cpSend'); if (sendBtn) sendBtn.disabled = true;
  var c = $('#cpChat');
  var think = document.createElement('div'); think.className = 'cp-msg ai';
  think.innerHTML = '<div class="who"><svg viewBox="0 0 32 32"><use href="#v17-copilot"/></svg>Copilot</div><div class="cp-thinking"><i></i><i></i><i></i></div>';
  if (c) c.appendChild(think);
  v17ScrollChat();
  setTimeout(function () {
    if (think.parentNode) think.remove();
    var reply = v17CopilotReply(text);
    v17PushAi(reply);
    v17CpBusy = false;
    if (sendBtn) sendBtn.disabled = false;
    var inp = $('#cpInput'); if (inp) { try { inp.focus(); } catch (e) {} }
  }, 650);
}
function v17OpenCopilot() {
  var p = $('#copilotPanel'); if (!p) return;
  p.hidden = false;
  later(function () { p.classList.add('open'); }, 10);
  if (!V17.cpGreeted) { V17.cpGreeted = true; v17PushAi(v17T('cp_hello')); }
  later(function () { var i = $('#cpInput'); if (i) { try { i.focus(); } catch (e) {} } }, 280);
}
function v17CloseCopilot() {
  var p = $('#copilotPanel'); if (!p) return;
  p.classList.remove('open');
  setTimeout(function () { if (!p.classList.contains('open')) p.hidden = true; }, 320);
}
function v17ToggleCopilot() {
  var p = $('#copilotPanel');
  if (p && p.classList.contains('open')) v17CloseCopilot(); else v17OpenCopilot();
}

/* ============================================================
   2. 开始菜单推荐（动态）
   ============================================================ */
function v17FileIcon(name) {
  var ext = (name.split('.').pop() || '').toLowerCase();
  if (/png|jpg|jpeg|gif|bmp|webp/.test(ext)) return '<svg viewBox="0 0 24 24"><use href="#v14-photos"/></svg>';
  if (/md|txt|log|json/.test(ext)) return '<svg viewBox="0 0 24 24"><use href="#v14-notepad"/></svg>';
  return '<svg viewBox="0 0 24 24"><use href="#v17-doc"/></svg>';
}
function v17RenderStartRecent() {
  v17SeedRecent();
  var added = $('#smRecentAdded');
  if (added) {
    added.innerHTML = '<div class="sm-rec-item" data-open="copilot"><span class="ic"><svg viewBox="0 0 32 32"><use href="#v17-copilot"/></svg></span>' +
      '<div class="meta"><b>Copilot</b><span>' + v17Esc(v17T('rec_added')) + '</span></div></div>';
  }
  var host = $('#smRecent'); if (!host) return;
  var files = state.v17.recentFiles.slice(0, 4);
  if (!files.length) { host.innerHTML = ''; return; }
  host.innerHTML = files.map(function (f) {
    return '<div class="sm-rec-item" data-file="' + v17Esc(f.name) + '"><span class="ic">' + v17FileIcon(f.name) + '</span>' +
      '<div class="meta"><b>' + v17Esc(f.name) + '</b><span>' + v17Esc(v17TimeAgo(f.time)) + '</span></div></div>';
  }).join('');
}

/* ============================================================
   3. 右键菜单 2.0（含子菜单）+ 图标右键菜单
   ============================================================ */
function v17CtxSub(labelKey, items) {
  var sub = items.map(function (it) {
    if (it[0] === '__sep__') return '<div class="ctx-sep"></div>';
    return '<button data-ctx="' + it[1] + '">' + v17T(it[0]) + '</button>';
  }).join('');
  return '<div class="ctx-item"><button type="button"><span>' + v17T(labelKey) + '</span>' +
    '<span class="arr"><svg viewBox="0 0 24 24"><use href="#v17-chevron-right"/></svg></span></button>' +
    '<div class="ctx-sub">' + sub + '</div></div>';
}
function v17BuildMenus() {
  var cm = $('#ctxMenu');
  if (cm) {
    cm.innerHTML =
      v17CtxSub('ctx_view', [['ctx_view_large', 'view-lg'], ['ctx_view_medium', 'view-md'], ['ctx_view_small', 'view-sm'], ['__sep__'], ['ctx_view_auto', 'view-auto'], ['ctx_view_align', 'view-align']]) +
      v17CtxSub('ctx_sort', [['ctx_sort_name', 'sort-name'], ['ctx_sort_size', 'sort-size'], ['ctx_sort_type', 'sort-type'], ['ctx_sort_date', 'sort-date']]) +
      v17CtxSub('ctx_new', [['ctx_new_folder', 'new-folder'], ['ctx_new_doc', 'new-doc'], ['ctx_new_shortcut', 'new-shortcut']]) +
      '<div class="ctx-sep"></div>' +
      '<button data-ctx="refresh">' + v17T('ctx_refresh') + '</button>' +
      '<div class="ctx-sep"></div>' +
      '<button data-ctx="personalize">' + v17T('ctx_personalize') + '</button>' +
      '<button data-ctx="display">' + v17T('ctx_display') + '</button>' +
      '<button data-ctx="terminal">' + v17T('ctx_terminal') + '</button>';
  }
  var im = $('#ctxIconMenu');
  if (im) {
    im.innerHTML =
      '<button data-ictx="open">' + v17T('ctx_open') + '</button>' +
      '<button data-ictx="pin">' + v17T('ctx_pin_start') + '</button>' +
      '<div class="ctx-sep"></div>' +
      '<button data-ictx="rename">' + v17T('ctx_rename') + '</button>' +
      '<button data-ictx="delete">' + v17T('ctx_delete') + '</button>' +
      '<div class="ctx-sep"></div>' +
      '<button data-ictx="props">' + v17T('ctx_props') + '</button>';
  }
  V17.menusBuilt = true;
}
function v17SortDesktopIcons(by) {
  var host = $('#deskIcons'); if (!host) return;
  var icons = Array.prototype.slice.call(host.querySelectorAll('.dicon'));
  icons.sort(function (a, b) {
    var na = (a.querySelector('span:last-child') || {}).textContent || '';
    var nb = (b.querySelector('span:last-child') || {}).textContent || '';
    if (by === 'size' || by === 'type' || by === 'date') return na.localeCompare(nb);
    return na.localeCompare(nb);
  });
  icons.forEach(function (ic) { host.appendChild(ic); });
}
function v17CreateDesktopDoc() {
  state.folderSeq = (state.folderSeq || 0) + 1;
  var name = v17T('ctx_new_doc') + (state.folderSeq > 1 ? ' (' + state.folderSeq + ')' : '') + '.txt';
  var el = document.createElement('div');
  el.className = 'dicon';
  el.innerHTML = '<span class="i14 i14--xl t-violet"><svg viewBox="0 0 24 24"><use href="#v14-notepad"/></svg></span><span></span>';
  el.querySelector('span:last-child').textContent = name;
  el.addEventListener('dblclick', function () {
    AppWindows.open('notepad', { multi: true, file: name, content: '' });
  });
  var icons = $('#deskIcons'); if (icons) icons.appendChild(el);
  v17TrackFile(name);
  toast(v17T('toast_folder_created', { name: name }));
}

/* ============================================================
   4. 贴靠智能填充
   ============================================================ */
var V17_SNAP_COMPLEMENT = { left: 'right', right: 'left', tl: 'right', bl: 'right', tr: 'left', br: 'left' };
var _v17Snap = AppWindows.snap;
AppWindows.snap = function (id, mode) {
  var r = _v17Snap.apply(this, arguments);
  v17MaybeShowSnapFill(id, mode);
  return r;
};
function v17MaybeShowSnapFill(id, mode) {
  var picker = $('#snapFill'), list = $('#snapFillList'), empty = $('#snapFillEmpty');
  if (!picker) return;
  var complement = V17_SNAP_COMPLEMENT[mode];
  var others = [];
  Object.keys(state.openWindows).forEach(function (wid) {
    if (wid === String(id)) return;
    var w = state.openWindows[wid];
    if (String(w.dataset.desk || 1) !== String(state.currentDesk)) return;
    others.push({ id: wid, win: w });
  });
  if (!complement || !others.length) {
    picker.classList.remove('open'); picker.hidden = true; return;
  }
  list.innerHTML = others.map(function (o) {
    var w = o.win;
    var title = (w.querySelector('.win-title') || {}).textContent || AppWindows._defaultTitle(w.dataset.type);
    return '<div class="sf-card" data-sfid="' + o.id + '"><span class="sf-ic">' + AppWindows._defaultIcon(w.dataset.type) + '</span><span class="sf-nm">' + v17Esc(title) + '</span></div>';
  }).join('');
  if (empty) empty.hidden = true;
  picker.hidden = false;
  picker.classList.add('open');
  V17._snapComplement = complement;
}
function v17CloseSnapFill() {
  var p = $('#snapFill'); if (p) { p.classList.remove('open'); setTimeout(function () { if (!p.classList.contains('open')) p.hidden = true; }, 200); }
}

/* ============================================================
   5. 任务视图 2.0（桌面壁纸缩略图 + 重命名 + 每桌面壁纸）
   ============================================================ */
function v17RenderTaskView() {
  var tvDesks = $('#tvDesks'), tvWins = $('#tvWins');
  if (!tvDesks || !tvWins) return;
  state.desktops.forEach(function (d) { if (d.wall == null) d.wall = state.theme.wall || 1; });
  tvDesks.innerHTML = state.desktops.map(function (d, i) {
    var nm = d.name || v17T('tv_desk', { n: i + 1 });
    return '<div class="tv-desk' + (d.id === state.currentDesk ? ' active' : '') + '" data-desk="' + d.id + '">' +
      '<div class="tv-thumb" data-wall="' + d.wall + '">' +
      '<button class="tv-wall-btn" data-wallbtn="' + d.id + '" title="' + v17T('tv_wall') + '"><svg viewBox="0 0 24 24"><use href="#v17-palette"/></svg></button>' +
      '</div>' +
      '<div class="tv-desk-name"><span data-deskname="' + d.id + '" title="' + v17T('tv_rename') + '">' + v17Esc(nm) + '</span>' +
      (state.desktops.length > 1 ? '<button class="tv-desk-close" data-closedesk="' + d.id + '" title="' + v17T('tv_close_desk') + '">×</button>' : '') +
      '</div></div>';
  }).join('');
  var html = '';
  Object.keys(state.openWindows).forEach(function (id) {
    var w = state.openWindows[id];
    if (String(w.dataset.desk || 1) !== String(state.currentDesk)) return;
    var title = (w.querySelector('.win-title') || {}).textContent || AppWindows._defaultTitle(w.dataset.type);
    html += '<div class="tv-win" data-win="' + id + '">' +
      '<button class="tw-close" data-winclose="' + id + '" title="' + v17T('win_close') + '">×</button>' +
      '<div class="tw-hd">' + AppWindows._defaultIcon(w.dataset.type) + '<span>' + v17Esc(title) + '</span></div>' +
      '<div class="tw-prev"></div></div>';
  });
  tvWins.innerHTML = html || '<div class="tv-empty">' + v17T('tv_empty') + '</div>';
}
renderTaskView = v17RenderTaskView;
var _v17SwitchDesk = switchDesktop;
switchDesktop = function (id) {
  _v17SwitchDesk(id);
  var match = state.desktops.filter(function (d) { return d.id === id; })[0];
  if (match && match.wall) { state.theme.wall = match.wall; applyTheme(); savePrefs(); }
};
var _v17CreateDesk = createDesktop;
createDesktop = function () {
  _v17CreateDesk();
  var last = state.desktops[state.desktops.length - 1];
  if (last) last.wall = state.theme.wall || 1;
  renderTaskView();
};
function v17CycleDeskWall(id) {
  var d = state.desktops.filter(function (x) { return x.id === id; })[0];
  if (!d) return;
  d.wall = ((d.wall || 1) % 7) + 1;
  if (id === state.currentDesk) { state.theme.wall = d.wall; applyTheme(); savePrefs(); }
  renderTaskView();
}
function v17RenameDesk(id, el) {
  if (!el) return;
  var input = document.createElement('input');
  input.value = el.textContent;
  input.className = '';
  el.replaceWith(input);
  try { input.focus(); input.select(); } catch (e) {}
  function commit() {
    var val = (input.value || '').trim();
    var d = state.desktops.filter(function (x) { return x.id === id; })[0];
    if (d) d.name = val;
    renderTaskView();
  }
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { renderTaskView(); }
  });
  input.addEventListener('blur', commit);
}

/* ============================================================
   6. 托盘隐藏图标
   ============================================================ */
function v17OpenTrayFlyout() {
  var f = $('#trayFlyout'), ch = $('#trayChevron');
  if (!f || !ch) return;
  f.hidden = false;
  later(function () { f.classList.add('open'); }, 10);
  var r = ch.getBoundingClientRect();
  f.style.right = Math.max(8, window.innerWidth - r.right - 4) + 'px';
}
function v17CloseTrayFlyout() {
  var f = $('#trayFlyout'); if (!f) return;
  f.classList.remove('open');
  setTimeout(function () { if (!f.classList.contains('open')) f.hidden = true; }, 200);
}

/* ============================================================
   7. OEM 启动画面
   ============================================================ */
var _v17RunPower = runPower;
runPower = function (kind) {
  if (kind === 'lock' || kind === 'sleep') { _v17RunPower(kind); return; }
  var bs = $('#bootScreen'), bt = $('#bootText');
  if (!bs) { _v17RunPower(kind); return; }
  bs.hidden = false; bs.classList.add('open');
  if (bt) bt.textContent = v17T(kind === 'off' ? 'boot_shutting' : 'boot_restarting');
  setTimeout(function () {
    bs.classList.remove('open');
    setTimeout(function () { if (!bs.classList.contains('open')) bs.hidden = true; }, 420);
    if (kind === 'restart') { AppWindows.closeAll(); openLockScreen(); }
    else { _v17RunPower(kind); }
  }, kind === 'off' ? 2000 : 2200);
};

/* ============================================================
   事件接线（在 v17.js 执行时绑定；DOM 已就绪）
   ============================================================ */
function v17Init() {
  v17SeedRecent();

  /* Copilot */
  var cpBtn = $('#copilotBtn');
  if (cpBtn) cpBtn.addEventListener('click', function (e) { e.stopPropagation(); v17ToggleCopilot(); });
  var cpClose = $('#cpClose');
  if (cpClose) cpClose.addEventListener('click', function (e) { e.stopPropagation(); v17CloseCopilot(); });
  var cpSend = $('#cpSend');
  if (cpSend) cpSend.addEventListener('click', function () { v17Send($('#cpInput').value); });
  var cpInput = $('#cpInput');
  if (cpInput) cpInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); v17Send(this.value); }
  });
  var cpSug = $('#cpSug');
  if (cpSug) cpSug.addEventListener('click', function (e) {
    var chip = e.target.closest('.cp-chip'); if (!chip) return;
    v17Send(chip.textContent);
  });

  /* 开始菜单推荐：打开时渲染 + 点击文件/应用 */
  var sb = $('#startBtn');
  if (sb) sb.addEventListener('click', function () { setTimeout(v17RenderStartRecent, 50); });
  var sm = $('#startMenu');
  if (sm) sm.addEventListener('click', function (e) {
    var f = e.target.closest('[data-file]');
    if (f) {
      e.stopPropagation();
      var name = f.dataset.file;
      AppWindows.open('notepad', { multi: true, file: name, content: (state.tempFiles && state.tempFiles[name]) || '' });
      closeStart();
    }
  });

  /* 右键菜单：首次右键时构建 + 语言切换重建 */
  document.addEventListener('contextmenu', function () { if (!V17.menusBuilt) v17BuildMenus(); }, true);
  document.addEventListener('langchange', function () { V17.menusBuilt = false; v17BuildMenus(); });

  /* 桌面空白右键菜单动作委托 */
  var cm = $('#ctxMenu');
  if (cm) cm.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ctx]'); if (!b) return;
    var act = b.dataset.ctx;
    if (act === 'view-lg') { document.body.classList.add('v17-dicon-lg'); document.body.classList.remove('v17-dicon-sm'); }
    else if (act === 'view-md') { document.body.classList.remove('v17-dicon-lg', 'v17-dicon-sm'); }
    else if (act === 'view-sm') { document.body.classList.add('v17-dicon-sm'); document.body.classList.remove('v17-dicon-lg'); }
    else if (act === 'view-auto' || act === 'view-align') { toast(v17T('toast_refreshed')); }
    else if (act === 'sort-name' || act === 'sort-size' || act === 'sort-type' || act === 'sort-date') { v17SortDesktopIcons(act.split('-')[1]); toast('✓'); }
    else if (act === 'new-folder') { createDesktopFolder(); }
    else if (act === 'new-doc') { v17CreateDesktopDoc(); }
    else if (act === 'new-shortcut') { toast(v17T('toast_folder_created', { name: 'Shortcut' })); }
    else if (act === 'refresh') {
      var wall = $('#wall'); if (wall) { wall.style.filter = 'brightness(1.15)'; setTimeout(function () { wall.style.filter = ''; }, 160); }
      toast(v17T('toast_refreshed'));
    }
    else if (act === 'personalize') { openSettingsPage('personal'); }
    else if (act === 'display') { openSettingsPage('system'); }
    else if (act === 'terminal') { AppWindows.open('cmd'); }
  });

  /* 桌面图标右键菜单 */
  var deskIcons = $('#deskIcons');
  if (deskIcons) deskIcons.addEventListener('contextmenu', function (e) {
    var ic = e.target.closest('.dicon'); if (!ic) return;
    e.preventDefault(); e.stopPropagation();
    if (!V17.menusBuilt) v17BuildMenus();
    V17.ctxTarget = ic;
    var m = $('#ctxIconMenu'); if (!m) return;
    m.hidden = false; m.classList.add('open');
    var w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(4, Math.min(e.clientX, window.innerWidth - w - 8)) + 'px';
    m.style.top = Math.max(4, Math.min(e.clientY, window.innerHeight - h - 58)) + 'px';
  });
  var im = $('#ctxIconMenu');
  if (im) im.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ictx]'); if (!b) return;
    var act = b.dataset.ictx, tgt = V17.ctxTarget;
    im.classList.remove('open'); im.hidden = true;
    if (!tgt) return;
    if (act === 'open') { tgt.dispatchEvent(new MouseEvent('dblclick')); }
    else if (act === 'pin') { toast(v17T('ctx_pin_start')); }
    else if (act === 'delete') { tgt.remove(); toast(v17T('ctx_delete')); }
    else if (act === 'props') {
      var nm = (tgt.querySelector('span:last-child') || {}).textContent || '';
      openModal({ title: v17T('ctx_props'), body: '<div style="font-size:12.5px;line-height:1.8"><b>' + v17Esc(nm) + '</b><br>' + v17T('ctx_props') + '<br><span style="color:#888">位置：桌面</span></div>', cancel: null, ok: v17T('modal_default_ok') });
    }
    else if (act === 'rename') {
      var span = tgt.querySelector('span:last-child');
      if (!span) return;
      var input = document.createElement('input');
      input.className = 'rename-input';
      input.value = span.textContent;
      span.replaceWith(input);
      try { input.focus(); input.select(); } catch (er) {}
      function commit() { var v = (input.value || '').trim(); if (v) { var s = document.createElement('span'); s.textContent = v; input.replaceWith(s); } else { renderTaskView(); } }
      input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); commit(); } else if (ev.key === 'Escape') { renderTaskView(); } });
      input.addEventListener('blur', commit);
    }
  });

  /* 贴靠填充面板 */
  var sfList = $('#snapFillList');
  if (sfList) sfList.addEventListener('click', function (e) {
    var card = e.target.closest('[data-sfid]'); if (!card) return;
    var id = card.dataset.sfid;
    if (V17._snapComplement && state.openWindows[id]) AppWindows.snap(id, V17._snapComplement);
    v17CloseSnapFill();
  });

  /* 任务视图：换壁纸 + 重命名（不触发桌面切换） */
  var tv = $('#taskView');
  if (tv) {
    tv.addEventListener('click', function (e) {
      var wb = e.target.closest('[data-wallbtn]');
      if (wb) { e.stopPropagation(); v17CycleDeskWall(Number(wb.dataset.wallbtn)); }
    });
    tv.addEventListener('dblclick', function (e) {
      var dn = e.target.closest('[data-deskname]');
      if (dn) { e.stopPropagation(); v17RenameDesk(Number(dn.dataset.deskname), dn); }
    });
  }

  /* 托盘隐藏图标 */
  var chev = $('#trayChevron');
  if (chev) chev.addEventListener('click', function (e) {
    e.stopPropagation();
    var f = $('#trayFlyout');
    if (f && f.classList.contains('open')) v17CloseTrayFlyout(); else v17OpenTrayFlyout();
  });
  var fly = $('#trayFlyout');
  if (fly) fly.addEventListener('click', function (e) { e.stopPropagation(); var b = e.target.closest('[data-tray]'); if (b) toast(b.getAttribute('title') || b.dataset.tray); });
  document.addEventListener('click', function (e) {
    if (fly && fly.classList.contains('open') && !e.target.closest('#trayFlyout') && !e.target.closest('#trayChevron')) v17CloseTrayFlyout();
    if (im && im.classList.contains('open') && !e.target.closest('#ctxIconMenu') && !e.target.closest('.dicon')) { im.classList.remove('open'); im.hidden = true; }
    var cp = $('#copilotPanel');
    if (cp && cp.classList.contains('open') && !e.target.closest('#copilotPanel') && !e.target.closest('#copilotBtn') &&
        !e.target.closest('.app-window') && !e.target.closest('.start-menu')) {
      // 仅点击桌面空白时关闭
      if (e.target.closest('#s-desktop') && !e.target.closest('.taskbar')) v17CloseCopilot();
    }
  });

  /* 贴靠填充：mousedown 关闭（先于 click，避免取消同一击的展示） */
  document.addEventListener('mousedown', function (e) {
    var sf = $('#snapFill');
    if (sf && sf.classList.contains('open') && !e.target.closest('#snapFill') && !e.target.closest('#snapPicker')) v17CloseSnapFill();
  });

  /* 键盘：Ctrl+C（非编辑态）唤出 Copilot；Esc 关闭浮层 */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'c' && e.ctrlKey && !e.shiftKey && !e.altKey) {
      var ae = document.activeElement, tag = (ae && ae.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (ae && ae.isContentEditable)) return;
      e.preventDefault(); v17ToggleCopilot(); return;
    }
    if (e.key === 'Escape') {
      var cp2 = $('#copilotPanel'); if (cp2 && cp2.classList.contains('open')) { v17CloseCopilot(); return; }
      v17CloseSnapFill(); v17CloseTrayFlyout();
      var im2 = $('#ctxIconMenu'); if (im2 && im2.classList.contains('open')) { im2.classList.remove('open'); im2.hidden = true; }
    }
  });

  /* 首屏渲染一次开始推荐（静默） */
  v17RenderStartRecent();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', v17Init);
} else {
  v17Init();
}

window.__v17 = {
  openCopilot: v17OpenCopilot,
  closeCopilot: v17CloseCopilot,
  renderRecent: v17RenderStartRecent,
  state: function () { return state.v17; }
};

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

/* ============================================================
   v19.0 引擎：语音输入 / 表情符号 / 颜色滤镜 / 电源和电池
              系统还原 / 游戏栏 / 手机连接
   运行于主 IIFE 内（插入在 v18.js 之后、boot 之前）。
   ============================================================ */
var V19 = {
  voiceOn: false, voiceTimer: 0, voiceIdx: 0,
  emojiOpen: false, emojiCat: 'recent',
  gbOpen: false, gbTimer: 0, gbRec: false, gbBars: [],
  lastEditable: null, fbarOpen: false
};
state.v19 = state.v19 || {};

function v19T(k, ctx) { return _t(k, ctx); }
function v19Esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function v19Save() { try { localStorage.setItem('win11_v19', JSON.stringify(state.v19)); } catch (e) {} }
function v19Load() {
  try {
    var r = localStorage.getItem('win11_v19');
    if (r) { var o = JSON.parse(r) || {}; Object.keys(o).forEach(function (k) { state.v19[k] = o[k]; }); }
  } catch (e) {}
  var s = state.v19;
  s.filter = s.filter || 'none';
  s.power = s.power || { level: 76, charging: false, mode: 'balanced', week: [42, 58, 36, 71, 54, 63, 48] };
  if (!s.power.week) s.power.week = [42, 58, 36, 71, 54, 63, 48];
  s.restore = s.restore || { points: [], lastRestored: 0 };
  if (!s.restore.points.length) {
    var now = Date.now();
    s.restore.points = [
      { id: 'rp' + now, ts: now - 86400000 * 3, kind: 'auto', label: '' },
      { id: 'rp' + (now - 1), ts: now - 86400000 * 1, kind: 'auto', label: '' }
    ];
  }
  s.phone = s.phone || { tab: 'msg', contact: 0, threads: { 0: [], 1: [] } };
  if (!s.phone.threads) s.phone.threads = { 0: [], 1: [] };
  s.emojiRecent = s.emojiRecent || [];
}

/* ============================================================
   包裹：新增应用类型 power / restore / phone
   ============================================================ */
var _v19RenderContent = AppWindows._renderContent;
AppWindows._renderContent = function (win, type) {
  if (type === 'power') { v19RenderPower(win.querySelector('.win-body')); return; }
  if (type === 'restore') { v19RenderRestore(win.querySelector('.win-body')); return; }
  if (type === 'phone') { v19RenderPhone(win.querySelector('.win-body')); return; }
  return _v19RenderContent.apply(this, arguments);
};
var _v19DefTitle = AppWindows._defaultTitle;
AppWindows._defaultTitle = function (type) {
  if (type === 'power') return v19T('app_power');
  if (type === 'restore') return v19T('app_restore');
  if (type === 'phone') return v19T('app_phone');
  return _v19DefTitle.apply(this, arguments);
};
var _v19DefIcon = AppWindows._defaultIcon;
AppWindows._defaultIcon = function (type) {
  if (type === 'power') return '<svg viewBox="0 0 24 24"><use href="#v19-battery"/></svg>';
  if (type === 'restore') return '<svg viewBox="0 0 24 24"><use href="#v19-restore"/></svg>';
  if (type === 'phone') return '<svg viewBox="0 0 24 24"><use href="#v19-phone"/></svg>';
  return _v19DefIcon.apply(this, arguments);
};

/* ============================================================
   屏幕切换同步
   ============================================================ */
var _v19Go = go;
go = function (id) { var r = _v19Go.apply(this, arguments); v19SyncDesk(); return r; };

function v19OnDesk() {
  var d = $('#s-desktop');
  return !!(d && d.classList.contains('active'));
}
function v19SyncDesk() {
  var on = v19OnDesk();
  var vo = $('#v19Voice'); if (vo) vo.hidden = !(on && V19.voiceOn);
  var em = $('#v19Emoji'); if (em) em.hidden = !(on && V19.emojiOpen);
  var fb = $('#v19FilterBar'); if (fb) fb.hidden = !(on && state.v19.filter !== 'none');
  var gb = $('#v19GameBar'); if (gb) gb.hidden = !(on && V19.gbOpen);
}

/* ============================================================
   通用：记录最近聚焦的可编辑元素 + 插入文本
   ============================================================ */
function v19TrackFocus() {
  document.addEventListener('focusin', function (e) {
    var el = e.target;
    if (!el || !el.tagName) return;
    var tag = el.tagName.toLowerCase();
    if (tag === 'textarea' || (tag === 'input' && /^(text|search|email|url|tel|)$/i.test(el.type || 'text')) || el.isContentEditable) {
      V19.lastEditable = el;
    }
  }, true);
}
function v19Target() {
  var el = V19.lastEditable;
  if (el && document.contains(el)) return el;
  var a = document.activeElement;
  if (a && a !== document.body && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT' || a.isContentEditable)) return a;
  return null;
}
function v19Insert(text) {
  var el = v19Target();
  if (!el) return false;
  if (el.isContentEditable) {
    el.focus();
    var sel = window.getSelection();
    if (sel && sel.rangeCount && el.contains(sel.anchorNode)) {
      var range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
    } else {
      el.appendChild(document.createTextNode(text));
    }
  } else {
    el.focus();
    var s = el.selectionStart == null ? el.value.length : el.selectionStart;
    var e2 = el.selectionEnd == null ? el.value.length : el.selectionEnd;
    var v = el.value || '';
    el.value = v.slice(0, s) + text + v.slice(e2);
    var pos = s + text.length;
    try { el.setSelectionRange(pos, pos); } catch (err) {}
  }
  try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (err2) {}
  return true;
}

/* ============================================================
   1. 语音输入
   ============================================================ */
function v19VoiceToggle(force) {
  var on = force === undefined ? !V19.voiceOn : !!force;
  V19.voiceOn = on;
  var panel = $('#v19Voice');
  if (panel) panel.classList.toggle('on', on);
  var text = $('#v19VoiceText');
  if (!on) {
    if (V19.voiceTimer) { clearInterval(V19.voiceTimer); V19.voiceTimer = 0; }
    if (text) text.textContent = v19T('voice_idle');
    toast(v19T('toast_voice_off'));
  } else {
    if (text) text.textContent = v19T('voice_listening');
    v19VoiceTick();
    V19.voiceTimer = setInterval(v19VoiceTick, 2800);
    toast(v19T('toast_voice_on'));
  }
  v19SyncDesk();
}
function v19VoiceTick() {
  var phrase = v19T('voice_p' + (V19.voiceIdx % 5 + 1));
  V19.voiceIdx++;
  var text = $('#v19VoiceText');
  if (text) text.textContent = phrase;
  v19Insert(phrase);
}
function v19BindVoice() {
  var mic = $('#v19VoiceMic');
  if (mic) mic.addEventListener('click', function () { v19VoiceToggle(); });
  var c = $('#v19VoiceClose');
  if (c) c.addEventListener('click', function () { v19VoiceToggle(false); });
  var t = $('#v19VoiceText');
  if (t) t.textContent = v19T('voice_idle');
}

/* ============================================================
   2. 表情符号面板
   ============================================================ */
var V19_EMOJI = {
  smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '😐'],
  gestures: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '🙏', '💪', '👏', '🙌', '🤲'],
  objects: ['💻', '⌨️', '🖱️', '📱', '⌚', '🎧', '📷', '📸', '🎮', '🕹️', '💡', '🔋', '📁', '📂', '🗂️', '📝', '✏️', '📌', '📎', '🔒', '🔑', '🧰', '🖥️', '💾'],
  symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '✅', '❌', '⚠️', '❗', '❓', '⭐', '🌟', '✨', '🔥', '💧', '⚡', '🎉', '🎯', '🔔', '💬', '📢']
};
var V19_EMOJI_CATS = [
  { id: 'recent', key: 'emoji_recent' },
  { id: 'smileys', key: 'emoji_smileys' },
  { id: 'gestures', key: 'emoji_gestures' },
  { id: 'objects', key: 'emoji_objects' },
  { id: 'symbols', key: 'emoji_symbols' }
];
function v19RenderEmoji() {
  var tabs = $('#v19EmojiTabs');
  if (tabs) {
    tabs.innerHTML = V19_EMOJI_CATS.map(function (c) {
      return '<button data-cat="' + c.id + '" class="' + (V19.emojiCat === c.id ? 'on' : '') + '">' + v19Esc(v19T(c.key)) + '</button>';
    }).join('');
  }
  var grid = $('#v19EmojiGrid');
  if (!grid) return;
  var list = V19.emojiCat === 'recent' ? state.v19.emojiRecent.slice(0, 48) : (V19_EMOJI[V19.emojiCat] || []);
  if (!list.length) {
    grid.innerHTML = '<div class="v19-emoji-empty">' + v19Esc(v19T('emoji_empty')) + '</div>';
    return;
  }
  grid.innerHTML = list.map(function (ch) {
    return '<button data-emoji="' + ch + '">' + ch + '</button>';
  }).join('');
}
function v19EmojiToggle(force) {
  var open = force === undefined ? !V19.emojiOpen : !!force;
  V19.emojiOpen = open;
  if (open) {
    var p = $('#v19Emoji');
    if (p) p.hidden = false;
    v19RenderEmoji();
  }
  v19SyncDesk();
}
function v19BindEmoji() {
  var tabs = $('#v19EmojiTabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]'); if (!b) return;
    V19.emojiCat = b.dataset.cat;
    v19RenderEmoji();
  });
  var grid = $('#v19EmojiGrid');
  if (grid) grid.addEventListener('click', function (e) {
    var b = e.target.closest('[data-emoji]'); if (!b) return;
    var ch = b.dataset.emoji;
    v19Insert(ch);
    var rec = state.v19.emojiRecent.filter(function (x) { return x !== ch; });
    rec.unshift(ch);
    state.v19.emojiRecent = rec.slice(0, 48);
    v19Save();
    toast(v19T('toast_copied') + ' ' + ch);
  });
  var c = $('#v19EmojiClose');
  if (c) c.addEventListener('click', function () { v19EmojiToggle(false); });
}

/* ============================================================
   3. 颜色滤镜
   ============================================================ */
var V19_FILTERS = [
  { id: 'none', key: 'filter_none', css: '' },
  { id: 'grayscale', key: 'filter_grayscale', css: 'grayscale(1)' },
  { id: 'invert', key: 'filter_invert', css: 'invert(1)' },
  { id: 'deuter', key: 'filter_deuter', css: 'hue-rotate(-18deg) saturate(1.45)' },
  { id: 'protan', key: 'filter_protan', css: 'hue-rotate(18deg) saturate(1.45)' },
  { id: 'tritan', key: 'filter_tritan', css: 'hue-rotate(170deg) saturate(1.25)' }
];
function v19FilterCss(id) {
  var f = V19_FILTERS.filter(function (x) { return x.id === id; })[0];
  return f ? f.css : '';
}
function v19ApplyFilter() {
  var desk = $('#s-desktop');
  if (!desk) return;
  var css = v19FilterCss(state.v19.filter);
  desk.style.filter = css || '';
  v19RenderFilterChips();
  v19SyncDesk();
}
function v19RenderFilterChips() {
  var host = $('#v19FilterChips');
  if (!host) return;
  host.innerHTML = V19_FILTERS.map(function (f) {
    return '<button data-filter="' + f.id + '" class="' + (state.v19.filter === f.id ? 'on' : '') + '">' + v19Esc(v19T(f.key)) + '</button>';
  }).join('');
}
function v19SetFilter(id) {
  state.v19.filter = id;
  v19Save();
  v19ApplyFilter();
  if (id !== 'none') toast(v19T('toast_filter_on'));
}
function v19BindFilter() {
  var host = $('#v19FilterChips');
  if (host) host.addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]'); if (!b) return;
    v19SetFilter(b.dataset.filter);
  });
  v19RenderFilterChips();
}

/* ============================================================
   4. 电源和电池
   ============================================================ */
function v19PowerEst() {
  var p = state.v19.power;
  var base = p.mode === 'perf' ? 6 : (p.mode === 'saver' ? 18 : 12);
  var h = Math.floor(p.level / 100 * base);
  var m = Math.round((p.level / 100 * base - h) * 60);
  return { h: h, m: m };
}
function v19RenderPower(body) {
  var p = state.v19.power;
  var est = v19PowerEst();
  var modes = [
    { id: 'perf', key: 'power_perf', tip: 'power_tip_perf' },
    { id: 'balanced', key: 'power_balanced', tip: 'power_tip_bal' },
    { id: 'saver', key: 'power_saver', tip: 'power_tip_saver' }
  ];
  var week = p.week || [];
  var maxV = Math.max.apply(null, week.concat([1]));
  body.innerHTML =
    '<div class="v19-power">' +
      '<div class="v19-pw-top">' +
        '<div class="v19-pw-batt" id="v19PwBatt" title="' + v19Esc(v19T(p.charging ? 'power_charging' : 'power_discharging')) + '">' +
          '<span class="v19-pw-fill" id="v19PwFill" style="width:' + Math.max(4, p.level) + '%"></span>' +
        '</div>' +
        '<div>' +
          '<div class="v19-pw-num" id="v19PwNum">' + p.level + '%</div>' +
          '<div class="v19-pw-state" id="v19PwState">' + v19Esc(v19T(p.charging ? 'power_charging' : 'power_discharging')) + '</div>' +
        '</div>' +
        '<div style="margin-left:auto;text-align:right">' +
          '<div class="v19-pw-sec">' + v19Esc(v19T('power_est')) + '</div>' +
          '<div class="v19-pw-state">' + v19Esc(v19T('power_est_val', { h: est.h, m: est.m })) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="v19-pw-sec">' + v19Esc(v19T('power_mode')) + '</div>' +
      '<div class="v19-pw-modes" id="v19PwModes">' +
        modes.map(function (mo) {
          return '<button class="v19-pw-mode' + (p.mode === mo.id ? ' on' : '') + '" data-mode="' + mo.id + '">' +
            '<b>' + v19Esc(v19T(mo.key)) + '</b><span>' + v19Esc(v19T(mo.tip)) + '</span></button>';
        }).join('') +
      '</div>' +
      '<div class="v19-pw-sec">' + v19Esc(v19T('power_usage')) + ' · ' + v19Esc(v19T('power_last7')) + '</div>' +
      '<div class="v19-pw-chart">' +
        week.map(function (v, i) {
          var h = Math.max(6, Math.round(v / maxV * 96));
          var d = new Date(); d.setDate(d.getDate() - (week.length - 1 - i));
          return '<div class="v19-pw-col"><div class="v19-pw-bar" style="height:' + h + 'px"></div>' +
            '<span>' + (d.getMonth() + 1) + '/' + d.getDate() + '</span></div>';
        }).join('') +
      '</div>' +
    '</div>';

  var batt = $('#v19PwBatt');
  if (batt) batt.addEventListener('click', function () {
    state.v19.power.charging = !state.v19.power.charging;
    v19Save();
    v19RenderPower(body);
  });
  var ms = $('#v19PwModes');
  if (ms) ms.addEventListener('click', function (e) {
    var b = e.target.closest('[data-mode]'); if (!b) return;
    state.v19.power.mode = b.dataset.mode;
    v19Save();
    v19RenderPower(body);
  });
}

/* ============================================================
   5. 系统还原
   ============================================================ */
function v19FmtDate(ts) {
  var d = new Date(ts);
  var z = function (n) { return ('0' + n).slice(-2); };
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
}
function v19RenderRestore(body) {
  var rs = state.v19.restore;
  var disk = Math.min(24, 3 + rs.points.length * 2);
  var points = rs.points.slice().sort(function (a, b) { return b.ts - a.ts; });
  body.innerHTML =
    '<div class="v19-rs">' +
      '<div class="v19-rs-sub">' + v19Esc(v19T('restore_sub')) + '</div>' +
      '<div class="v19-rs-bar">' +
        '<button class="v19-rs-btn" id="v19RsCreate">' + v19Esc(v19T('restore_create')) + '</button>' +
        '<button class="v19-rs-btn sec" id="v19RsGo" disabled>' + v19Esc(v19T('restore_restore')) + '</button>' +
        '<span class="v19-rs-disk">' + v19Esc(v19T('restore_disk', { p: disk })) + '</span>' +
      '</div>' +
      '<div class="v19-pw-sec">' + v19Esc(v19T('restore_list')) + ' · ' + points.length + '</div>' +
      '<div class="v19-rs-list" id="v19RsList">' +
        points.map(function (pt) {
          return '<button class="v19-rs-item" data-id="' + pt.id + '">' +
            '<span class="v19-rs-ic"><svg viewBox="0 0 24 24"><use href="#v19-restore"/></svg></span>' +
            '<span class="v19-rs-meta"><b>' + v19Esc(v19FmtDate(pt.ts)) + '</b>' +
            '<span>' + (pt.kind === 'manual' ? v19Esc(v19T('restore_type_manual')) : v19Esc(v19T('restore_type_auto'))) + '</span></span>' +
            '<span class="v19-rs-tag">' + (pt.kind === 'manual' ? v19Esc(v19T('restore_type_manual')) : v19Esc(v19T('restore_type_auto'))) + '</span>' +
          '</button>';
        }).join('') +
      '</div>' +
    '</div>';

  var sel = null;
  var list = $('#v19RsList');
  if (list) list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-id]'); if (!b) return;
    Array.prototype.forEach.call(list.querySelectorAll('.v19-rs-item'), function (x) { x.classList.remove('on'); });
    b.classList.add('on');
    sel = b.dataset.id;
    var goBtn = $('#v19RsGo'); if (goBtn) goBtn.disabled = false;
  });

  var create = $('#v19RsCreate');
  if (create) create.addEventListener('click', function () {
    v19RsProgress(body.querySelector('.v19-rs'), v19T('restore_creating'), 2200, function () {
      state.v19.restore.points.push({ id: 'rp' + Date.now(), ts: Date.now(), kind: 'manual', label: '' });
      v19Save();
      v19RenderRestore(body);
    });
  });
  var goBtn2 = $('#v19RsGo');
  if (goBtn2) goBtn2.addEventListener('click', function () {
    if (!sel) return;
    v19RsProgress(body.querySelector('.v19-rs'), v19T('restore_running'), 2800, function () {
      state.v19.restore.lastRestored = Date.now();
      v19Save();
      toast(v19T('restore_done'));
      v19RenderRestore(body);
    });
  });
}
function v19RsProgress(host, label, dur, done) {
  if (!host) return;
  var ov = document.createElement('div');
  ov.className = 'v19-rs-overlay';
  ov.innerHTML = '<b>' + v19Esc(label) + '</b><div class="v19-rs-prog"><i id="v19RsProg"></i></div><span class="v19-rs-pct" id="v19RsPct">0%</span>';
  host.appendChild(ov);
  var t0 = Date.now();
  var timer = setInterval(function () {
    var p = Math.min(100, Math.round((Date.now() - t0) / dur * 100));
    var bar = ov.querySelector('#v19RsProg'); if (bar) bar.style.width = p + '%';
    var pt = ov.querySelector('#v19RsPct'); if (pt) pt.textContent = p + '%';
    if (p >= 100) {
      clearInterval(timer);
      setTimeout(function () { if (ov.parentNode) ov.remove(); done(); }, 320);
    }
  }, 90);
}

/* ============================================================
   6. 游戏栏
   ============================================================ */
function v19GbToggle(force) {
  var open = force === undefined ? !V19.gbOpen : !!force;
  V19.gbOpen = open;
  if (open) {
    var bars = $('#v19GbBars');
    if (bars && !bars.children.length) {
      var html = '';
      for (var i = 0; i < 18; i++) { html += '<i style="height:6px"></i>'; }
      bars.innerHTML = html;
    }
    v19GbTick();
    V19.gbTimer = setInterval(v19GbTick, 900);
  } else if (V19.gbTimer) {
    clearInterval(V19.gbTimer); V19.gbTimer = 0;
  }
  v19SyncDesk();
}
function v19GbTick() {
  var fps = 55 + Math.round(Math.random() * 20);
  var f = $('#v19GbFps'); if (f) f.textContent = fps;
  var bars = $('#v19GbBars');
  if (bars) {
    var arr = Array.prototype.slice.call(bars.children);
    var h = Math.max(6, Math.round((fps - 40) / 40 * 38));
    for (var i = 0; i < arr.length - 1; i++) arr[i].style.height = arr[i + 1].style.height || '6px';
    if (arr.length) arr[arr.length - 1].style.height = h + 'px';
  }
  var vals = [
    { el: '#v19GbCpu', txt: '#v19GbCpuV', v: 18 + Math.round(Math.random() * 26) },
    { el: '#v19GbGpu', txt: '#v19GbGpuV', v: 34 + Math.round(Math.random() * 34) },
    { el: '#v19GbMem', txt: '#v19GbMemV', v: 42 + Math.round(Math.random() * 22) }
  ];
  vals.forEach(function (x) {
    var b = $(x.el); if (b) b.style.width = x.v + '%';
    var t = $(x.txt); if (t) t.textContent = x.v + '%';
  });
}
function v19BindGameBar() {
  var c = $('#v19GbClose');
  if (c) c.addEventListener('click', function () { v19GbToggle(false); });
  var shot = $('#v19GbShot');
  if (shot) shot.addEventListener('click', function () { toast(v19T('gb_shot')); });
  var rec = $('#v19GbRec');
  if (rec) rec.addEventListener('click', function () {
    V19.gbRec = !V19.gbRec;
    rec.classList.toggle('rec', V19.gbRec);
    rec.textContent = v19T(V19.gbRec ? 'gb_stop' : 'gb_record');
    toast(v19T(V19.gbRec ? 'toast_record_start' : 'toast_record_stop'));
  });
}

/* ============================================================
   7. 手机连接
   ============================================================ */
function v19PhoneContact(i) { return v19T(i === 0 ? 'phone_n1' : 'phone_n2'); }
function v19RenderPhone(body) {
  var ph = state.v19.phone;
  if (!ph.threads[ph.contact]) ph.threads[ph.contact] = [];
  var thread = ph.threads[ph.contact];
  body.innerHTML =
    '<div class="v19-ph">' +
      '<div class="v19-ph-side">' +
        '<div class="v19-ph-me"><b>' + v19Esc(v19T('app_phone')) + '</b>' +
          '<span>' + v19Esc(v19T('phone_status', { p: 86 })) + '</span></div>' +
        '<button class="v19-ph-contact' + (ph.contact === 0 ? ' on' : '') + '" data-contact="0">' +
          '<span class="v19-ph-av">' + v19Esc(v19PhoneContact(0).slice(0, 1)) + '</span>' +
          '<span>' + v19Esc(v19PhoneContact(0)) + '</span></button>' +
        '<button class="v19-ph-contact' + (ph.contact === 1 ? ' on' : '') + '" data-contact="1">' +
          '<span class="v19-ph-av" style="background:#0f6cbd">' + v19Esc(v19PhoneContact(1).slice(0, 1)) + '</span>' +
          '<span>' + v19Esc(v19PhoneContact(1)) + '</span></button>' +
      '</div>' +
      '<div class="v19-ph-main">' +
        '<div class="v19-ph-tabs" id="v19PhTabs">' +
          '<button data-tab="msg" class="' + (ph.tab === 'msg' ? 'on' : '') + '">' + v19Esc(v19T('phone_tab_msg')) + '</button>' +
          '<button data-tab="photos" class="' + (ph.tab === 'photos' ? 'on' : '') + '">' + v19Esc(v19T('phone_tab_photos')) + '</button>' +
          '<button data-tab="notif" class="' + (ph.tab === 'notif' ? 'on' : '') + '">' + v19Esc(v19T('phone_tab_notif')) + '</button>' +
        '</div>' +
        '<div class="v19-ph-body" id="v19PhBody"></div>' +
        (ph.tab === 'msg' ?
          '<div class="v19-ph-input"><input id="v19PhInput" placeholder="' + v19Esc(v19T('phone_send_ph')) + '">' +
          '<button id="v19PhSend">' + v19Esc(v19T('phone_send')) + '</button></div>' : '') +
      '</div>' +
    '</div>';

  v19RenderPhoneBody(body);

  var tabs = $('#v19PhTabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]'); if (!b) return;
    state.v19.phone.tab = b.dataset.tab;
    v19Save();
    v19RenderPhone(body);
  });
  var side = body.querySelector('.v19-ph-side');
  if (side) side.addEventListener('click', function (e) {
    var b = e.target.closest('[data-contact]'); if (!b) return;
    state.v19.phone.contact = +b.dataset.contact;
    v19Save();
    v19RenderPhone(body);
  });
  var send = $('#v19PhSend');
  var input = $('#v19PhInput');
  function doSend() {
    if (!input) return;
    var v = (input.value || '').trim();
    if (!v) return;
    var ph2 = state.v19.phone;
    if (!ph2.threads[ph2.contact]) ph2.threads[ph2.contact] = [];
    ph2.threads[ph2.contact].push({ me: true, text: v, ts: Date.now() });
    input.value = '';
    v19Save();
    v19RenderPhoneBody(body);
    var cidx = ph2.contact;
    setTimeout(function () {
      var ph3 = state.v19.phone;
      var reply = v19T('phone_reply' + ((ph3.threads[cidx].length % 3) + 1));
      ph3.threads[cidx].push({ me: false, text: reply, ts: Date.now() });
      v19Save();
      var w = body.closest('.app-window');
      if (w) v19RenderPhone(body);
    }, 1100);
  }
  if (send) send.addEventListener('click', doSend);
  if (input) input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doSend(); }
  });
  if (input) setTimeout(function () { try { input.focus(); } catch (e) {} }, 40);
}
function v19RenderPhoneBody(body) {
  var host = body.querySelector('#v19PhBody'); if (!host) return;
  var ph = state.v19.phone;
  if (ph.tab === 'msg') {
    var thread = ph.threads[ph.contact] || [];
    if (!thread.length) {
      thread = [{ me: false, text: v19T('phone_notif1_d'), ts: Date.now() }];
      ph.threads[ph.contact] = thread;
      v19Save();
    }
    host.style.display = 'flex';
    host.innerHTML = thread.map(function (m) {
      return '<div class="v19-bubble ' + (m.me ? 'me' : 'them') + '">' + v19Esc(m.text) + '</div>';
    }).join('');
    host.scrollTop = host.scrollHeight;
  } else if (ph.tab === 'photos') {
    host.style.display = 'grid';
    host.className = 'v19-ph-body v19-ph-photos';
    var grads = ['#7c5cff,#b9a6ff', '#0f6cbd,#4fb3ff', '#d13438,#ff8a80', '#107c10,#6ee7a8', '#c19c00,#ffe066', '#8764b8,#e0c8ff'];
    host.innerHTML = grads.map(function (g) {
      return '<div class="v19-ph-photo" style="background:linear-gradient(135deg,' + g + ')"></div>';
    }).join('');
  } else {
    host.style.display = 'flex';
    host.className = 'v19-ph-body';
    host.innerHTML = '<div class="v19-ph-notif">' +
      '<div class="v19-ph-ni"><b>' + v19Esc(v19T('phone_notif1_t')) + '</b><span>' + v19Esc(v19T('phone_notif1_d')) + '</span></div>' +
      '<div class="v19-ph-ni"><b>' + v19Esc(v19T('phone_notif2_t')) + '</b><span>' + v19Esc(v19T('phone_notif2_d')) + '</span></div>' +
      '</div>';
  }
}

/* ============================================================
   快捷设置分发 + 快捷键
   ============================================================ */
function v19BindQuickSettings() {
  var grid = document.querySelector('.qp-grid');
  if (grid) grid.addEventListener('click', function (e) {
    var tile = e.target.closest('[data-v19]'); if (!tile) return;
    var a = tile.dataset.v19;
    if (a === 'voice') v19VoiceToggle();
    else if (a === 'emoji') v19EmojiToggle();
    else if (a === 'filter') v19SetFilter(state.v19.filter === 'none' ? 'grayscale' : 'none');
    else if (a === 'gamebar') v19GbToggle();
    if (a === 'filter') tile.classList.toggle('on', state.v19.filter !== 'none');
  });
}
function v19BindKeys() {
  document.addEventListener('keydown', function (e) {
    if (!v19OnDesk()) return;
    var tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;
    if (e.metaKey && !e.ctrlKey && !e.altKey) {
      var k = (e.key || '').toLowerCase();
      if (k === 'h') { e.preventDefault(); v19VoiceToggle(); }
      else if (k === 'g') { e.preventDefault(); v19GbToggle(); }
      else if (k === '.') { e.preventDefault(); v19EmojiToggle(); }
    }
  });
}

/* ============================================================
   语言切换后刷新仍可见的动态面板
   ============================================================ */
function v19OnLangChange() {
  V19.voiceIdx = 0;
  v19RenderEmoji();
  v19RenderFilterChips();
  var vt = $('#v19VoiceText');
  if (vt && !V19.voiceOn) vt.textContent = v19T('voice_idle');
  ['power', 'restore', 'phone'].forEach(function (type) {
    var w = document.querySelector('.app-window[data-type="' + type + '"]');
    if (w) {
      var b = w.querySelector('.win-body');
      if (type === 'power') v19RenderPower(b);
      if (type === 'restore') v19RenderRestore(b);
      if (type === 'phone') v19RenderPhone(b);
    }
  });
  var rec = $('#v19GbRec');
  if (rec && V19.gbRec) rec.textContent = v19T('gb_stop');
}

/* ============================================================
   初始化
   ============================================================ */
function v19Init() {
  v19Load();
  v19TrackFocus();
  v19BindVoice();
  v19BindEmoji();
  v19BindFilter();
  v19BindGameBar();
  v19BindQuickSettings();
  v19BindKeys();
  v19ApplyFilter();
  v19SyncDesk();
  document.addEventListener('langchange', function () { setTimeout(v19OnLangChange, 40); });
}
v19Init();

window.__v19 = {
  voice: function (on) { v19VoiceToggle(on); },
  emoji: function (on) { v19EmojiToggle(on); },
  filter: v19SetFilter,
  gamebar: function (on) { v19GbToggle(on); },
  open: function (type) { window.__installer.openApp(type); },
  insert: v19Insert
};

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

  window.__installer = {
    go: go, state: state,
    openWindow: function (type, opts) { return AppWindows.open(type, opts); },
    openApp: openAppType, applyTheme: applyTheme, renderCalendar: renderCalendar,
    toggleFullscreen: toggleFullscreen, fsList: fsList, savePrefs: savePrefs,
    openTaskView: openTaskView, createDesktop: createDesktop, switchDesktop: switchDesktop,
    openSearch: openSearch, toggleWidgets: toggleWidgets,
    snap: function (id, mode) { return AppWindows.snap(id, mode); }
  };

  // 依赖：语言包必须先从 locales/*.json 加载完成（需要 http 环境，file:// 下 fetch 会被拦截）
  function bootApp() {
    loadPrefs();
    initDisk();
    renderDisk();
    $('#deviceInput').value = state.deviceName;
    applyTheme();
    _apply();
    updateVersionBadge();
    fsList(function () { /* v5.0：预取 Temp 目录文件列表 */ });
    var startId = (location.hash || '').replace('#', '');
    if (startId && document.getElementById('s-' + startId)) { go(startId); }
    else { go('boot'); }
  }

  if (window.__i18n && window.__i18n.ready) {
    window.__i18n.ready.then(bootApp);
  } else {
    bootApp();
  }
})();
