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
