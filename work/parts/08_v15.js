/* ============================================================
   v15.0 引擎：任务管理器、剪贴板历史、存储感知、专注助手、
   设置搜索、快捷键指南、动态主题、安装报告与通知清理
   约定：所有浮层复用 v14 的玻璃与弹簧动效；定时器在窗口关闭后自停。
   ============================================================ */
var V15_ANIM = 'windows11_sim_anim';
var V15_PALETTE = { 1: '#0067c0', 2: '#c2410c', 3: '#5b5bd6', 4: '#0f7b3f', 5: '#c0266b', 6: '#00707f', 7: '#6d3fe0' };
var V15 = {
  clip: [],
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
  box.innerHTML = V15.clip.map(function (t, i) {
    return '<button class="v15-clip-item" data-clip="' + i + '">' + v15Esc(t) + '</button>';
  }).join('');
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
  function draw() { if (tab === 'proc') drawProc(); else drawPerf(); }
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
    }
  });

  var timer = setInterval(function () {
    if (!body.isConnected) { clearInterval(timer); return; }
    if (tab === 'proc') drawProc(); else drawPerf();
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
  var input = wrap.querySelector('input');
  input.addEventListener('input', function () {
    var q = input.value.trim().toLowerCase();
    nav.querySelectorAll('.s-item').forEach(function (it) {
      var hit = !q || it.textContent.toLowerCase().indexOf(q) >= 0;
      it.classList.toggle('v15-hide', !hit);
    });
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
function v15ClearNotifs() {
  document.querySelectorAll('#notifCenter .nc-notif').forEach(function (n) { n.hidden = true; });
  try { sessionStorage.setItem('win11_v15_notif', '1'); } catch (e) { /* ignore */ }
  state.v15.notifRead = true;
  v15SyncNotifDot();
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
    var item = e.target.closest('[data-clip]');
    if (item) { v15CopyClip(Number(item.dataset.clip)); return; }
    if (e.target.id === 'v15Clip' || e.target.id === 'v15Storage' || e.target.id === 'v15Keys') { v15CloseLayers(); }
  });

  document.getElementById('v15ClipClear').addEventListener('click', function () {
    V15.clip = [];
    try { sessionStorage.removeItem('win11_v15_clip'); } catch (e) { /* ignore */ }
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
