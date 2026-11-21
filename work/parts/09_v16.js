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
