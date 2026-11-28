/* ============================================================
   v21.0 引擎：邮件真实化（SMTP 发送 / 账户配置 / IMAP 收件）
   依赖本地 serve.py 提供的 /api/mail/* 接口；运行于主 IIFE 内。
   ============================================================ */
var V21 = { cfg: null };
var V21_MAIL_KEY = 'win11_v21_mailcfg';
var V21_PROVIDERS = {
  qq: { smtp: 'smtp.qq.com', port: 465, security: 'ssl', imap: 'imap.qq.com', imapPort: 993 },
  '163': { smtp: 'smtp.163.com', port: 465, security: 'ssl', imap: 'imap.163.com', imapPort: 993 },
  gmail: { smtp: 'smtp.gmail.com', port: 587, security: 'starttls', imap: 'imap.gmail.com', imapPort: 993 },
  outlook: { smtp: 'smtp.office365.com', port: 587, security: 'starttls', imap: 'outlook.office365.com', imapPort: 993 },
  custom: { smtp: '', port: 465, security: 'ssl', imap: '', imapPort: 993 }
};

function v21T(k, ctx) { return _t(k, ctx); }
function v21Esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function v21Cfg() {
  if (!V21.cfg) {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(V21_MAIL_KEY) || '{}') || {}; } catch (e) { saved = {}; }
    V21.cfg = Object.assign({
      provider: 'custom', host: '', port: 465, security: 'ssl',
      user: '', password: '', from: '', imapHost: '', imapPort: 993, imapSecurity: 'ssl'
    }, saved);
  }
  return V21.cfg;
}
function v21SaveCfg() {
  try { localStorage.setItem(V21_MAIL_KEY, JSON.stringify(v21Cfg())); } catch (e) {}
}
function v21Ready() {
  var c = v21Cfg();
  return !!(c.host && c.user && c.password);
}
function v21Api(path, payload) {
  return fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    cache: 'no-store', body: JSON.stringify(payload)
  }).then(function (r) {
    return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; });
  });
}

/* ---- 侧栏：账户状态 + 设置 / 同步入口 ---- */
function v21UpdateAcct(body) {
  var el = body.querySelector('#v21Macct');
  if (!el) return;
  var c = v21Cfg();
  el.textContent = v21Ready() ? v21T('mail_configured_as', { a: c.from || c.user }) : v21T('mail_not_configured');
  el.classList.toggle('on', v21Ready());
}
function v21EnhanceMail(body) {
  var side = body.querySelector('.m16-side');
  if (side && !side.querySelector('.v21-mside')) {
    var box = document.createElement('div');
    box.className = 'v21-mside';
    box.innerHTML =
      '<div class="v21-macct" id="v21Macct"></div>' +
      '<button type="button" class="v21-mbtn" data-v21="settings">' + v21T('mail_smtp_settings') + '</button>' +
      '<button type="button" class="v21-mbtn" data-v21="sync">' + v21T('mail_sync') + '</button>';
    side.appendChild(box);
  }
  v21UpdateAcct(body);
}
function v21ComposeHint(body) {
  var form = body.querySelector('.m16-form');
  if (!form || form.querySelector('.v21-from')) return;
  var hd = form.querySelector('.m16-fh');
  var div = document.createElement('div');
  div.className = 'v21-from';
  div.innerHTML = '<span>' + (v21Ready()
    ? v21Esc(v21T('mail_configured_as', { a: v21Cfg().from || v21Cfg().user }))
    : v21Esc(v21T('mail_not_configured'))) + '</span>' +
    '<button type="button" data-v21="settings">' + v21T('mail_smtp_settings') + '</button>';
  if (hd && hd.nextSibling) form.insertBefore(div, hd.nextSibling);
  else form.appendChild(div);
}

/* ---- SMTP / IMAP 配置面板 ---- */
function v21ReadCfgForm(main) {
  var c = v21Cfg();
  c.provider = main.querySelector('#v21Prov').value;
  c.host = main.querySelector('#v21Host').value.trim();
  c.port = Number(main.querySelector('#v21Port').value) || 465;
  c.security = main.querySelector('#v21Sec').value;
  c.user = main.querySelector('#v21User').value.trim();
  c.password = main.querySelector('#v21Pwd').value;
  c.from = main.querySelector('#v21From').value.trim();
  c.imapHost = main.querySelector('#v21Imap').value.trim();
  c.imapPort = Number(main.querySelector('#v21ImapPort').value) || 993;
  c.imapSecurity = main.querySelector('#v21ImapSec').value;
  return c;
}
function v21MailSettings(body, notice) {
  var main = body.querySelector('#m16Main');
  if (!main) return;
  var c = v21Cfg();
  var provOpts = Object.keys(V21_PROVIDERS).map(function (k) {
    var label = k === 'custom' ? v21T('mail_provider_custom') : (k === 'qq' ? 'QQ 邮箱' : (k === '163' ? '163 邮箱' : (k === 'gmail' ? 'Gmail' : 'Outlook')));
    return '<option value="' + k + '"' + (c.provider === k ? ' selected' : '') + '>' + label + '</option>';
  }).join('');
  var secOpts = [['ssl', 'mail_sec_ssl'], ['starttls', 'mail_sec_starttls'], ['none', 'mail_sec_none']].map(function (p) {
    return '<option value="' + p[0] + '"' + (c.security === p[0] ? ' selected' : '') + '>' + v21T(p[1]) + '</option>';
  }).join('');
  main.innerHTML =
    '<div class="v21-mcfg">' +
      '<div class="m16-fh"><b>' + v21T('mail_smtp_settings') + '</b><button class="m16-x" data-v21="closecfg">×</button></div>' +
      (notice ? '<div class="v21-notice">' + v21Esc(notice) + '</div>' : '') +
      '<label>' + v21T('mail_provider') + '<select class="inp" id="v21Prov">' + provOpts + '</select></label>' +
      '<div class="v21-grid2">' +
        '<label>' + v21T('mail_smtp_host') + '<input class="inp" id="v21Host" value="' + v21Esc(c.host) + '" placeholder="smtp.example.com"></label>' +
        '<label>' + v21T('mail_smtp_port') + '<input class="inp" id="v21Port" type="number" value="' + c.port + '"></label>' +
      '</div>' +
      '<label>' + v21T('mail_security') + '<select class="inp" id="v21Sec">' + secOpts + '</select></label>' +
      '<label>' + v21T('mail_username') + '<input class="inp" id="v21User" value="' + v21Esc(c.user) + '" placeholder="you@example.com" autocomplete="off"></label>' +
      '<label>' + v21T('mail_password') + '<input class="inp" id="v21Pwd" type="password" value="' + v21Esc(c.password) + '" autocomplete="new-password"></label>' +
      '<label>' + v21T('mail_from_addr') + '<input class="inp" id="v21From" value="' + v21Esc(c.from) + '" placeholder="' + v21Esc(c.user || 'you@example.com') + '"></label>' +
      '<div class="v21-grid2">' +
        '<label>' + v21T('mail_imap_host') + '<input class="inp" id="v21Imap" value="' + v21Esc(c.imapHost) + '" placeholder="imap.example.com"></label>' +
        '<label>' + v21T('mail_imap_port') + '<input class="inp" id="v21ImapPort" type="number" value="' + c.imapPort + '"></label>' +
      '</div>' +
      '<label>' + v21T('mail_security') + '（IMAP）<select class="inp" id="v21ImapSec">' +
        [['ssl', 'mail_sec_ssl'], ['none', 'mail_sec_none']].map(function (p) {
          return '<option value="' + p[0] + '"' + (c.imapSecurity === p[0] ? ' selected' : '') + '>' + v21T(p[1]) + '</option>';
        }).join('') + '</select></label>' +
      '<div class="v21-hint">' + v21T('mail_cfg_hint') + '</div>' +
      '<div class="v21-cfgres" id="v21CfgRes"></div>' +
      '<div class="m16-fa">' +
        '<button class="btn" data-v21="testcfg">' + v21T('mail_test') + '</button>' +
        '<button class="btn primary" data-v21="savecfg">' + v21T('mail_save_cfg') + '</button>' +
      '</div>' +
    '</div>';
  main.querySelector('#v21Prov').addEventListener('change', function () {
    var p = V21_PROVIDERS[this.value];
    if (!p || this.value === 'custom') return;
    main.querySelector('#v21Host').value = p.smtp;
    main.querySelector('#v21Port').value = p.port;
    main.querySelector('#v21Sec').value = p.security;
    main.querySelector('#v21Imap').value = p.imap;
    main.querySelector('#v21ImapPort').value = p.imapPort;
    main.querySelector('#v21ImapSec').value = 'ssl';
  });
}

/* ---- IMAP 收件箱同步 ---- */
function v21SyncInbox(body) {
  if (!v21Ready()) { v21MailSettings(body, v21T('mail_need_cfg')); return; }
  var c = v21Cfg();
  var acct = body.querySelector('#v21Macct');
  if (acct) acct.textContent = v21T('mail_syncing');
  v21Api('/api/mail/inbox', {
    imapHost: c.imapHost || c.host, imapPort: c.imapPort, imapSecurity: c.imapSecurity,
    user: c.user, password: c.password, count: 10
  }).then(function (j) {
    v21UpdateAcct(body);
    if (!j || !j.ok) {
      toast(v21T('mail_sync_fail') + '：' + ((j && j.error) || 'unknown'));
      return;
    }
    var M = v16MailState();
    var added = 0;
    (j.messages || []).forEach(function (m) {
      var id = 'imap-' + m.id;
      if (M.items.some(function (x) { return x.id === id; })) return;
      M.items.unshift({
        id: id, from: m.from || 'unknown', to: c.user,
        subject: m.subject || '—', body: m.body || '',
        time: m.date || v16NowHM(), unread: true, starred: false,
        folder: 'inbox', real: true
      });
      added++;
    });
    M.folder = 'inbox';
    toast(v21T('mail_sync_done', { n: added }));
    v16RenderMail(body);
  }).catch(function (e) {
    v21UpdateAcct(body);
    toast(v21T('mail_sync_fail') + '：' + (e && e.message ? e.message : 'network'));
  });
}

/* ---- 真实发送：拦截原模拟发送 ---- */
function v21RealSend(body) {
  var main = body.querySelector('#m16Main');
  if (!main) return;
  var to = main.querySelector('#m16To');
  var sub = main.querySelector('#m16Sub');
  var txt = main.querySelector('#m16Body');
  var err = main.querySelector('#m16Err');
  var btn = main.querySelector('#m16Send');
  if (!to || !sub || !txt || !btn) return;
  var addr = to.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
    if (err) err.textContent = _t('mail_err_to');
    to.focus();
    return;
  }
  if (!v21Ready()) { v21MailSettings(body, v21T('mail_need_cfg')); return; }
  var c = v21Cfg();
  var subject = sub.value.trim() || '—';
  var content = txt.value;
  if (err) err.textContent = '';
  btn.disabled = true;
  btn.textContent = _t('mail_sending');
  function fail(msg) {
    if (!main.isConnected) return;
    if (err) err.textContent = msg;
    btn.disabled = false;
    btn.textContent = _t('mail_send');
  }
  v21Api('/api/mail/send', {
    host: c.host, port: c.port, security: c.security,
    user: c.user, password: c.password, from: c.from || c.user,
    to: addr, subject: subject, body: content
  }).then(function (j) {
    if (!j || !j.ok) { fail(v21T('mail_send_fail') + '：' + ((j && j.error) || 'unknown')); return; }
    var M = v16MailState();
    M.items.push({
      id: 's' + (M.seq++), from: c.from || c.user, to: addr, subject: subject,
      body: content, time: v16NowHM(), unread: false, starred: false,
      folder: 'sent', real: true
    });
    M.folder = 'sent';
    toast(v21T('mail_sent_real', { to: addr }));
    v8Log('Mail sent via SMTP: ' + subject);
    v16RenderMail(body);
    var mn = body.querySelector('#m16Main');
    if (mn) {
      mn.innerHTML = '<div class="m16-done"><b>' + v21T('mail_sent_real_ok') +
        ' <em class="v21-real">' + v21T('mail_real_badge') + '</em></b><span>' +
        v21Esc(subject) + '</span><em>' + v21Esc(addr) + '</em></div>';
    }
  }).catch(function (e) {
    fail(v21T('mail_send_fail') + '：' + (e && e.message ? e.message : 'network'));
  });
}

/* ---- 包装 v16 邮件渲染 ---- */
var _v21RenderMail = v16RenderMail;
v16RenderMail = function (body) {
  _v21RenderMail(body);
  v21EnhanceMail(body);
  if (body.dataset.v21Bound) return;
  body.dataset.v21Bound = '1';
  /* 捕获阶段拦截“发送”，改为真实 SMTP 投递 */
  body.addEventListener('click', function (e) {
    if (e.target.closest('#m16Send')) {
      e.preventDefault();
      e.stopPropagation();
      v21RealSend(body);
    }
  }, true);
  body.addEventListener('click', function (e) {
    var b = e.target.closest('[data-v21]');
    if (b) {
      e.preventDefault();
      var act = b.dataset.v21;
      if (act === 'settings') v21MailSettings(body);
      else if (act === 'sync') v21SyncInbox(body);
      else if (act === 'closecfg') {
        var mn = body.querySelector('#m16Main');
        if (mn) mn.innerHTML = '<div class="m16-empty">' + _t('mail_empty') + '</div>';
      } else if (act === 'savecfg') {
        v21ReadCfgForm(body.querySelector('#m16Main'));
        v21SaveCfg();
        v21UpdateAcct(body);
        toast(v21T('mail_cfg_saved'));
      } else if (act === 'testcfg') {
        var cfg = v21ReadCfgForm(body.querySelector('#m16Main'));
        var res = body.querySelector('#v21CfgRes');
        if (res) { res.textContent = v21T('mail_testing'); res.className = 'v21-cfgres'; }
        v21Api('/api/mail/test', {
          host: cfg.host, port: cfg.port, security: cfg.security,
          user: cfg.user, password: cfg.password
        }).then(function (j) {
          if (!res) return;
          res.textContent = j && j.ok ? v21T('mail_test_ok') : ((j && j.error) || 'unknown');
          res.className = 'v21-cfgres ' + (j && j.ok ? 'ok' : 'bad');
        }).catch(function (err2) {
          if (res) { res.textContent = String(err2 && err2.message || err2); res.className = 'v21-cfgres bad'; }
        });
      }
      return;
    }
    if (e.target.closest('#m16New') || e.target.closest('[data-act="reply"]')) {
      later(function () { v21ComposeHint(body); }, 0);
    }
  });
};

window.__v21 = {
  cfg: v21Cfg,
  saveCfg: v21SaveCfg,
  ready: v21Ready,
  api: v21Api,
  state: V21
};
