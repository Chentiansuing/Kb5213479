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
