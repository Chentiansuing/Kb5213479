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
    notes: '', folderSeq: 0, photoIndex: 1, storeInstalled: {},
    openWindows: {}, // id -> win element
    winZCounter: 1000
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
    badge.textContent = 'v4.0';
  }

  /* ============================================================
   * v4.0：主题、偏好与桌面个性化
   * ============================================================ */
  var PREFS_KEY = 'windows11_sim_prefs';

  function loadPrefs() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return;
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
    } catch (e) { /* 忽略损坏的本地偏好 */ }
  }
  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        theme: state.theme, volume: state.volume, brightness: state.brightness,
        quick: { wifi: state.quickTiles.wifi, bt: state.quickTiles.bt,
                 airplane: state.quickTiles.airplane, night: state.quickTiles.night },
        notes: state.notes
      }));
    } catch (e) { /* 隐私模式忽略 */ }
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
      b.classList.toggle('on', !!state.quickTiles[b.dataset.qc]);
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
        store: _t('app_store')
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
        e.stopPropagation(); self.toggleMax(id);
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
      } else {
        win.dataset._w = win.style.width; win.dataset._h = win.style.height;
        win.dataset._l = win.style.left; win.dataset._t = win.style.top;
        var layer = win.parentElement;
        win.style.width = (layer.clientWidth - 20) + 'px';
        win.style.height = (layer.clientHeight - 20) + 'px';
        win.style.left = '10px'; win.style.top = '10px';
        win.dataset.maxed = '1';
      }
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
      var types = {};
      Object.values(state.openWindows).forEach(function (w) {
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
      // v3.0：任务栏显示已打开窗口
      var host = $('#tbWins');
      if (!host) return;
      host.innerHTML = '';
      Object.keys(state.openWindows).forEach(function (id) {
        var w = state.openWindows[id];
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
      else if (type === 'settings') this._renderSettings(body);
      else if (type === 'setup') this._renderSetupUpgrade(body, win);
      else if (type === 'calc') this._renderCalc(body);
      else if (type === 'notepad') this._renderNotepad(body);
      else if (type === 'photos') this._renderPhotos(body);
      else if (type === 'store') this._renderStore(body);
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
      ];

      var driveIcon = '<svg viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" rx="4" fill="#0067c0"/><text x="16" y="21" text-anchor="middle" fill="#fff" font-size="12" font-weight="600">C:</text></svg>';
      var driveIconD = '<svg viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" rx="4" fill="#4c9a2a"/><text x="16" y="21" text-anchor="middle" fill="#fff" font-size="12" font-weight="600">D:</text></svg>';
      var folderIcon = '<svg viewBox="0 0 32 32"><path d="M3 9a2 2 0 0 1 2-2h7l2 3h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" fill="#f5c04a" stroke="#c99a2e" stroke-width="1"/></svg>';
      var pcIcon = AppWindows._defaultIcon('explorer');
      var rcIcon = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 8h14l-1.2 11.4a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" stroke="#4a5a6b" stroke-width="1.5"/></svg>';
      var setupIcon = '<svg viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" rx="6" fill="#0067c0"/><g fill="#fff"><rect x="11" y="11" width="4.5" height="4.5"/><rect x="16.5" y="11" width="4.5" height="4.5"/><rect x="11" y="16.5" width="4.5" height="4.5"/><rect x="16.5" y="16.5" width="4.5" height="4.5"/></g></svg>';
      var docIcon = '<svg viewBox="0 0 32 32"><path d="M7 4h13l5 5v19H7V4Z" fill="#2b579a"/><path d="M7 4h13v5h5" stroke="#1e3f6b" stroke-width="1" fill="none"/></svg>';
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
          { name: _t('exp_pics'), type: 'folder', target: 'pics', icon: folderIcon }
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
        quick: []
      };
      var titles = {
        quick: _t('exp_quick'), pc: _t('icon_pc'), desktop: _t('exp_desktop'),
        docs: _t('exp_docs'), dl: _t('exp_dl'), pics: _t('exp_pics'), music: _t('exp_music'),
        c: _t('exp_local_disk') + ' (C:)', d: _t('exp_data_disk') + ' (D:)',
        'c-win': 'Windows', 'c-users': 'Users', 'c-pf': 'Program Files',
        'c-sys': 'System32', 'c-user': state.userName || 'Administrator',
        'd-new': _t('folder_new'), 'd-backup': 'backup'
      };
      var parents = {
        c: 'pc', d: 'pc', 'c-win': 'c', 'c-users': 'c', 'c-pf': 'c', 'c-sys': 'c-win',
        'c-user': 'c-users', 'd-new': 'd', 'd-backup': 'd'
      };

      var current = contentMap[opts.path] ? opts.path : 'pc';
      var stack = [current];

      function pathOf(id) {
        var segs = [];
        var cur = id;
        while (cur) { segs.unshift({ id: cur, label: titles[cur] || cur }); cur = parents[cur]; }
        return segs;
      }

      function renderList() {
        var items = contentMap[current] || [];
        var container = body.querySelector('.explorer__files');
        container.innerHTML = items.map(function (it) {
          return '<div class="explorer__file" data-name="' + it.name + '"' +
            ' data-target="' + (it.target || '') + '" data-app="' + (it.app || '') + '">' +
            '<div class="fi-icon">' + it.icon + '</div>' +
            '<div class="fi-name">' + it.name + '</div></div>';
        }).join('');
        var pathEl = body.querySelector('.explorer__path');
        pathEl.innerHTML = pathOf(current).map(function (s) {
          return '<span class="seg" data-path="' + s.id + '">' + s.label + '</span>';
        }).join('<span class="sep">›</span>');
        var empty = body.querySelector('.explorer__empty');
        container.style.display = items.length ? '' : 'none';
        empty.style.display = items.length ? 'none' : '';
        var back = body.querySelector('#expBack');
        if (back) back.disabled = stack.length < 2;
        body.querySelectorAll('.nav-item').forEach(function (x) {
          x.classList.toggle('active', x.dataset.id === current);
        });
      }

      function navigate(id) {
        if (!id || !contentMap[id]) return;
        current = id;
        if (stack[stack.length - 1] !== id) stack.push(id);
        renderList();
      }

      body.className = 'explorer';
      body.innerHTML =
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
          '<div class="explorer__path"></div>' +
          '<div class="explorer__content">' +
            '<div class="explorer__files"></div>' +
            '<div class="explorer__empty">' + _t('exp_empty') + '</div>' +
          '</div>' +
        '</div>';

      body.querySelectorAll('.nav-item').forEach(function (ni) {
        ni.addEventListener('click', function () { stack = [ni.dataset.id]; navigate(ni.dataset.id); stack = [ni.dataset.id]; });
      });
      var backBtn = body.querySelector('#expBack');
      if (backBtn) backBtn.addEventListener('click', function () {
        if (stack.length < 2) return;
        stack.pop();
        current = stack[stack.length - 1];
        renderList();
      });
      body.querySelector('.explorer__path').addEventListener('click', function (e) {
        var seg = e.target.closest('.seg'); if (!seg) return;
        var idx = -1;
        for (var i = 0; i < stack.length; i++) if (stack[i] === seg.dataset.path) idx = i;
        if (idx >= 0) { stack = stack.slice(0, idx + 1); current = stack[stack.length - 1]; renderList(); }
        else navigate(seg.dataset.path);
      });
      body.querySelector('.explorer__files').addEventListener('dblclick', function (e) {
        var f = e.target.closest('.explorer__file'); if (!f) return;
        if (f.dataset.target) navigate(f.dataset.target);
        else if (f.dataset.app) AppWindows.open(f.dataset.app, { multi: f.dataset.app !== 'setup' });
        else toast(_t('toast_demo_unavailable', { name: f.dataset.name || _t('exp_file') }));
      });

      renderList();
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
      body.innerHTML =
        '<div class="edge__bar">' +
          '<button class="eb-nav" title="后退"><svg viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>' +
          '<button class="eb-nav" title="前进"><svg viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>' +
          '<button class="eb-nav" title="刷新"><svg viewBox="0 0 16 16" fill="none"><path d="M3 8a5 5 0 1 1 1.5 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M3 4v4h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>' +
          '<div class="eb-url"><svg viewBox="0 0 16 16"><rect x="7" y="3" width="2" height="4"/><rect x="11" y="7" width="2" height="6"/><rect x="3" y="7" width="2" height="6"/><path d="M7 7h2l2 6H5l2-6Z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg> about:blank</div>' +
        '</div>' +
        '<div class="edge__content">' +
          '<div class="edge__newtab">' +
            '<div class="eb-logo">Microsoft Edge</div>' +
            '<div class="eb-search">' +
              '<svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.6" stroke="currentColor" stroke-width="1.4"/><path d="M10.6 10.6L14 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
              '<input placeholder="搜索 Microsoft 或输入网址">' +
            '</div>' +
            '<div style="margin-top:50px;color:#8b98aa;font-size:12px;">浏览器模拟器 · 演示模式</div>' +
          '</div>' +
        '</div>';
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
      page = page || 'system';
      body.className = 'settings';
      body.dataset.settingsPage = page;

      var nav = [
        ['system', _t('set_system'), '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="3" fill="currentColor"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2M4.2 4.2l1.4 1.4M10.4 10.4l1.4 1.4M4.2 11.8l1.4-1.4M10.4 5.6l1.4-1.4" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>'],
        ['bt', _t('set_bt'), '<svg viewBox="0 0 16 16"><path d="M3 5h10v6H3zM6 2.5l1 1.5H9l1-1.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M7 11.5h2v2H7z" fill="currentColor"/></svg>'],
        ['net', _t('set_net'), '<svg viewBox="0 0 16 16" fill="none"><path d="M2 6.5C3.7 5 5.7 4.2 8 4.2s4.3.8 6 2.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M4 9c1.1-.9 2.5-1.4 4-1.4S10.9 8.1 12 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="11.7" r="1" fill="currentColor"/></svg>'],
        ['personal', _t('set_personal'), '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'],
        ['apps', _t('set_apps'), '<svg viewBox="0 0 16 16"><rect x="2.5" y="3" width="11" height="10" rx="1.2" stroke="currentColor" stroke-width="1.4" fill="none"/><rect x="4.5" y="5.5" width="4" height="2.5" rx=".4" fill="currentColor"/><rect x="4.5" y="9" width="7" height="1.5" rx=".3" fill="currentColor"/><rect x="4.5" y="11" width="5" height="1" rx=".2" fill="currentColor"/></svg>'],
        ['account', _t('set_account'), '<svg viewBox="0 0 16 16"><circle cx="8" cy="6" r="3.5" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M2.5 14c1-2.5 3.5-4 5.5-4s4.5 1.5 5.5 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>'],
        ['time', _t('set_time'), '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M8 4v4l3 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'],
        ['privacy', _t('set_privacy'), '<svg viewBox="0 0 16 16"><path d="M8 2l5 2v4c0 3-2.5 5-5 6-2.5-1-5-3-5-6V4l5-2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/></svg>']
      ];

      function row(title, desc, extra, pageId) {
        return '<div class="settings__row' + (pageId ? ' clickable" data-page="' + pageId : '') + '">' +
          '<div class="sr-left"><div><div class="sr-title">' + title + '</div>' +
          (desc ? '<div class="sr-desc">' + desc + '</div>' : '') + '</div></div>' +
          (extra || (pageId ? '<span>›</span>' : '')) + '</div>';
      }

      var main = '';
      if (page === 'personal') {
        var accents = ['#0067c0', '#8b5cf6', '#e3008c', '#0f7b3f', '#c2410c'];
        var walls = [[1, 'set_wallpaper_1'], [2, 'set_wallpaper_2'], [3, 'set_wallpaper_3']];
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
          '<div class="settings__row clickable" data-page="time"><div class="sr-left"><div><div class="sr-title">' + _t('set_lang') + '</div><div class="sr-desc">' + _t('set_time_desc') + '</div></div></div><span>›</span></div>';
      } else if (page === 'time') {
        var langBtns = $$('.lang-switch button[data-lang]');
        main =
          '<h2>' + _t('set_time') + '</h2><p class="s-sub">' + _t('set_time_desc') + '</p>' +
          '<div class="set-block"><b>' + _t('set_lang') + '</b><i>' + _t('set_lang_desc') + '</i>' +
            '<div class="set-langs">' + langBtns.map(function (b) {
              return '<button class="set-lang' + (b.classList.contains('on') ? ' on' : '') + '" data-setlang="' + b.dataset.lang + '">' + b.textContent + '</button>';
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
      } else if (page === 'about') {
        var langBtn = document.querySelector('.lang-switch button.on');
        var lang = langBtn ? langBtn.textContent : '简体中文';
        main =
          '<h2>' + _t('about_title') + '</h2>' +
          '<div class="about-hero">' +
            '<div class="about-logo"><svg viewBox="0 0 64 64"><g fill="#fff"><rect x="2" y="2" width="27" height="27"/><rect x="35" y="2" width="27" height="27"/><rect x="2" y="35" width="27" height="27"/><rect x="35" y="35" width="27" height="27"/></g></svg></div>' +
            '<div><div class="about-name">Windows 11</div><div class="about-ver">' + _t('about_version') + ' 4.0.0 · ' + _t('about_edition') + ': ' + (state.edition || 'Pro') + '</div></div>' +
          '</div>' +
          '<div class="about-rows">' +
            '<div class="about-row"><b>' + _t('about_device') + '</b><span>' + state.deviceName + '</span></div>' +
            '<div class="about-row"><b>' + _t('about_user') + '</b><span>' + (state.userName || 'Administrator') + '</span></div>' +
            '<div class="about-row"><b>' + _t('about_language') + '</b><span>' + lang + '</span></div>' +
            '<div class="about-row"><b>' + _t('about_build') + '</b><span>22631.4.0 · ' + _t('about_sim') + '</span></div>' +
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
          row(_t('set_notifications'), _t('set_notif_desc'), '') +
          row(_t('set_power'), _t('set_power_desc'), '') +
          row(_t('set_storage'), _t('set_storage_desc'), '') +
          row(_t('about_title'), _t('about_desc'), '', 'about');
      }

      body.innerHTML =
        '<div class="settings__nav">' +
          nav.map(function (it) {
            return '<div class="s-item' + (page === it[0] || (page === 'about' && it[0] === 'system') ? ' active' : '') + '" data-nav="' + it[0] + '">' + it[2] + it[1] + '</div>';
          }).join('') +
        '</div>' +
        '<div class="settings__main">' + main + '</div>';

      body.onclick = function (e) {
        var navEl = e.target.closest('.s-item');
        if (navEl) { self._renderSettings(body, navEl.dataset.nav); return; }
        var pg = e.target.closest('[data-page]');
        if (pg) { self._renderSettings(body, pg.dataset.page); return; }

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
          return;
        }
        var openApp = e.target.closest('[data-open-app]');
        if (openApp) { AppWindows.open(openApp.dataset.openApp, { multi: true }); return; }

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
    _renderNotepad: function (body) {
      body.className = 'np';
      body.innerHTML =
        '<div class="np__bar">' +
          '<button class="np__btn" id="npNew" data-i18n="np_new">新建</button>' +
          '<button class="np__btn" id="npSave" data-i18n="np_save">保存</button>' +
          '<span class="np__name" data-i18n="np_file">无标题.txt</span>' +
        '</div>' +
        '<textarea class="np__area" id="npArea" data-i18n-ph="np_placeholder" placeholder="在此输入内容…" spellcheck="false"></textarea>' +
        '<div class="np__status">' +
          '<span id="npChars"></span><span id="npLines"></span>' +
        '</div>';

      var area = body.querySelector('#npArea');
      var chars = body.querySelector('#npChars');
      var lines = body.querySelector('#npLines');
      area.value = state.notes || '';

      function stat() {
        var v = area.value;
        chars.textContent = v.length + ' ' + _t('np_chars');
        lines.textContent = (v ? v.split('\n').length : 0) + ' ' + _t('np_lines');
      }
      area.addEventListener('input', function () { state.notes = area.value; stat(); });
      body.querySelector('#npSave').addEventListener('click', function () {
        state.notes = area.value; savePrefs(); toast(_t('np_saved'));
      });
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
   * 安装 / 重启
   * ============================================================ */
  var INST_STAGES_KEYS = ['inst_stage_1', 'inst_stage_2', 'inst_stage_3', 'inst_stage_4', 'inst_stage_5'];
  var INST_STAGES_PCT = [0, 26, 46, 70, 92];

  function startInstall() {
    var p = null;
    for (var i = 0; i < state.disk.length; i++) if (state.disk[i].id === state.selected) p = state.disk[i];
    var instTargetName = p ? (diskName(p) + '（' + fmtSize(p.total) + '）') : _t('inst_target_primary');
    $('#instTarget').textContent = instTargetName;
    _apply();
    $('#instTarget').textContent = instTargetName;

    var dur = 44000;
    var bar = $('#instBar'), pct = $('#instPct'), stage = $('#instStage');
    state.installStart = performance.now();
    bar.style.width = '0%'; pct.textContent = '0';
    stage.textContent = _t('inst_stage_1');

    function frame(now) {
      var t = Math.min(1, (now - state.installStart) / dur);
      var v = Math.round((1 - Math.pow(1 - t, 1.9)) * 100);
      bar.style.width = v + '%'; pct.textContent = String(v);
      var idx = 0;
      for (var j = INST_STAGES_PCT.length - 1; j >= 0; j--) { if (v >= INST_STAGES_PCT[j]) { idx = j; break; } }
      var stageText = _t(INST_STAGES_KEYS[idx]);
      if (stage.textContent !== stageText) stage.textContent = stageText;
      if (t < 1) { state._raf = requestAnimationFrame(frame); }
      else { state._raf = 0; later(function () { go('restart'); }, 1800); }
    }
    state._raf = requestAnimationFrame(frame);
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
      $('#clockTime').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
      $('#clockDate').textContent = d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate());
    }
    upd(); state._clockTimer = setInterval(upd, 1000);
  }
  function enterDesktop() {
    var name = state.userName || 'Administrator';
    $('#smUser').textContent = name;
    $('#smAvatar').textContent = name.charAt(0).toUpperCase();
    startClock();
    _apply();
    applyTheme();
    buildAllApps();
    renderCalendar(calYear, calMonth);
    syncQuickPanel();
    var wt = $('#welcomeToast');
    if (wt) wt.classList.add('show');
    later(function () { if (wt) wt.classList.remove('show'); }, 9000);
    updateVersionBadge();
  }

  function resetExperience() {
    AppWindows.closeAll();
    initDisk(); renderDisk();
    state.edition = ''; state.selected = null; state.userName = 'Administrator'; state.deviceName = 'DESKTOP-7F3K9Q'; state.account = 'personal';
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
    $('#deviceInput').value = state.deviceName;
    $('#localUser').value = ''; $('#localPass').value = ''; $('#localPass2').value = '';
    $('#localErr').style.display = 'none'; $('#msEmail').value = '';
    $('#wifiStatus').textContent = ''; $('#netNext').disabled = true;
    $$('#wifiList .wifi').forEach(function (w) { w.classList.remove('on'); });
    go('boot');
  }

  /* ============================================================
   * hooks
   * ============================================================ */
  var hooks = {
    boot: function () { _apply(); updateVersionBadge('boot'); later(function () { go('lang'); }, 2600); },
    disk: function () { _apply(); renderDisk(); },
    install: function () { _apply(); startInstall(); },
    restart: function () { _apply(); startRestart(); },
    prepare1: function () { _apply(); later(function () { go('region'); }, 4600); },
    region: function () { _apply(); },
    keyboard: function () { _apply(); },
    keyboard2: function () { _apply(); },
    network: function () { _apply(); },
    limited: function () { _apply(); },
    device: function () { _apply(); $('#deviceInput').value = state.deviceName; },
    acc: function () { _apply(); },
    acctype: function () { _apply(); },
    msaccount: function () { _apply(); },
    local: function () { _apply(); },
    privacy: function () { _apply(); },
    custom: function () { _apply(); },
    final: function () {
      _apply();
      $('#finalName').textContent = state.userName || 'Administrator';
      later(function () { go('desktop'); }, 5600);
    },
    desktop: function () { _apply(); enterDesktop(); }
  };

  document.addEventListener('langchange', function () {
    var active = $('.screen.active');
    var id = active ? active.id.replace(/^s-/, '') : '';
    if (id === 'disk') renderDisk();
    else if (id === 'install') {
      var pct = parseInt(($('#instPct') || {}).textContent || '0', 10);
      var idx = 0;
      for (var i = INST_STAGES_PCT.length - 1; i >= 0; i--) { if (pct >= INST_STAGES_PCT[i]) { idx = i; break; } }
      $('#instStage').textContent = _t(INST_STAGES_KEYS[idx]);
      var selected = state.disk.filter(function (x) { return x.id === state.selected; })[0];
      if (selected) $('#instTarget').textContent = diskName(selected) + '（' + fmtSize(selected.total) + '）';
    }
    else if (id === 'final') $('#finalName').textContent = state.userName || 'Administrator';
    else if (id === 'desktop') {
      var n = state.userName || 'Administrator'; $('#smUser').textContent = n; $('#smAvatar').textContent = n.charAt(0).toUpperCase();
      buildAllApps();
      renderCalendar(calYear, calMonth);
      syncQuickPanel();
      filterStartApps();
    }
    AppWindows.retitleAll();
    Object.keys(state.openWindows).forEach(function (wid) {
      var w = state.openWindows[wid];
      if (w.dataset.type === 'settings') {
        var b = w.querySelector('.settings, .win-body');
        if (b) AppWindows._renderSettings(b, b.dataset.settingsPage || 'system');
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
  $('#keyNext').addEventListener('click', function () { go('edition'); });
  $('#btnNoKey').addEventListener('click', function () { keyInput.value = ''; $('#keyNext').disabled = true; go('edition'); });

  /* 版本 */
  $('#editionList').addEventListener('click', function (e) {
    var opt = e.target.closest('.opt'); if (!opt) return;
    $$('#editionList .opt').forEach(function (o) { o.classList.remove('sel'); });
    opt.classList.add('sel'); state.edition = opt.dataset.edition; $('#editionNext').disabled = false;
  });
  $('#editionNext').addEventListener('click', function () { go('license'); });

  /* 许可 */
  $('#licenseCheck').addEventListener('change', function () { $('#licenseNext').disabled = !this.checked; });
  $('#licenseNext').addEventListener('click', function () { go('type'); });

  /* 安装类型 */
  $('#typeList').addEventListener('click', function (e) {
    var opt = e.target.closest('.opt'); if (!opt) return;
    if (opt.dataset.type === 'upgrade') { toast(_t('toast_upgrade_from_media')); return; }
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
  $('#btnDriver').addEventListener('click', function () { toast(_t('toast_no_driver')); });
  $('#diskNext').addEventListener('click', function () { go('install'); });

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
    $$('#wifiList .wifi').forEach(function (x) { x.classList.remove('on'); });
    w.classList.add('on'); $('#wifiStatus').textContent = _t('toast_wifi_connecting', { ssid: w.dataset.ssid });
    $('#netNext').disabled = true;
    later(function () {
      $('#wifiStatus').textContent = _t('toast_wifi_connected', { ssid: w.dataset.ssid });
      $('#netNext').disabled = false;
    }, 1500);
  });

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
    var sw = e.target.closest('.switch'); if (!sw) return; sw.classList.toggle('on');
  });

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
    var demoLabels = { player: 'app_player', camera: 'app_camera', mail: 'app_mail', weather: 'app_weather' };
    if (demoLabels[type]) { toast(_t('toast_demo_unavailable', { name: _t(demoLabels[type]) })); return; }
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
      var tile = a.querySelector('.tile');
      var labelEl = a.querySelector('[data-i18n]');
      var name = labelEl ? labelEl.textContent.trim() : a.textContent.trim();
      return {
        name: name, open: a.dataset.open,
        color: tile ? tile.style.background : '',
        short: tile ? tile.textContent.trim() : ''
      };
    }).filter(function (x) { return x.open && x.name; });
    list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    var html = '', letter = '';
    list.forEach(function (x) {
      var l = x.name.charAt(0).toUpperCase();
      if (l !== letter) { letter = l; html += '<div class="sm-letter">' + l + '</div>'; }
      html += '<div class="sm-allapp" data-open="' + x.open + '">' +
        '<span class="tile" style="background:' + x.color + '">' + x.short + '</span>' + x.name + '</div>';
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
  $$('.tb-btn:not(.running):not(#startBtn):not(#searchBtn)').forEach(function (btn) {
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
  $('#searchBtn').addEventListener('click', function (e) { e.stopPropagation(); openStartSearch(); });
  $('#startSearch').addEventListener('input', filterStartApps);
  $('#startSearch').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var first = $$('#startMenu .sm-app, #startMenu .sm-allapp').filter(function (app) { return !app.hidden; })[0];
    if (first) { e.preventDefault(); e.stopPropagation(); first.click(); }
  });
  $('#startMenu').addEventListener('click', function (e) { e.stopPropagation(); });
  $('#s-desktop').addEventListener('click', function (e) {
    if (!e.target.closest('.taskbar') && !e.target.closest('.dicon') && !e.target.closest('.app-window') && !e.target.closest('.start-menu')) {
      closeStart(); closeNotif(); closeQuick();
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
    var ps = $('#powerScreen'), txt = $('#psText'), hint = $('#psHint');
    if (!ps) return;
    ps.classList.add('open'); ps.classList.remove('asleep');
    txt.textContent = _t(kind === 'off' ? 'pw_shutting' : kind === 'restart' ? 'pw_restarting' : 'pw_sleeping');
    hint.textContent = _t(kind === 'off' ? 'pw_off_hint' : 'pw_wake');
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
    var b = w.querySelector('.win-body');
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

  /* 演示导航 */
  var demoPanel = $('#demoPanel');
  function toggleDemo() { demoPanel.classList.toggle('open'); }
  $('#demoDot').addEventListener('click', function (e) { e.stopPropagation(); toggleDemo(); });
  demoPanel.addEventListener('click', function (e) {
    e.stopPropagation();
    var j = e.target.closest('[data-jump]');
    if (j) { go(j.dataset.jump); demoPanel.classList.remove('open'); }
  });
  $('#demoReset').addEventListener('click', function () { resetExperience(); });
  document.addEventListener('click', function () { if (demoPanel.classList.contains('open')) demoPanel.classList.remove('open'); });

  /* 全局键盘 */
  document.addEventListener('keydown', function (e) {
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
      var qp = $('#quickPanel'), cm = $('#ctxMenu'), pm = $('#powerMenu');
      if ($('#startMenu').classList.contains('open') || $('#notifCenter').classList.contains('open') ||
          demoPanel.classList.contains('open') ||
          (qp && qp.classList.contains('open')) || (cm && cm.classList.contains('open')) || (pm && pm.classList.contains('open'))) {
        closeStart(); closeNotif(); demoPanel.classList.remove('open');
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
    if (!inInput && !e.ctrlKey && !e.altKey && !e.metaKey && (e.key === 'd' || e.key === 'D')) { toggleDemo(); }
  });

  /* ============================================================
   * 启动
   * ============================================================ */
  window.__installer = {
    go: go, state: state,
    openWindow: function (type, opts) { return AppWindows.open(type, opts); },
    openApp: openAppType, applyTheme: applyTheme, renderCalendar: renderCalendar
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
