/* ============================================================
   v20.1 引擎：密码 / PIN 登录凭据生效
   - 保存 OOBE 中设置的本地账户密码与 Windows Hello PIN
   - 锁屏按当前模式校验，错误提示并可重试
   - 设置 > 账户 中管理登录选项
   运行于主 IIFE 内（插入在 v20.js 之后、boot 之前）。
   ============================================================ */
var V201 = { pass: '', pin: '', mode: 'pass' };
var V201_KEY = 'win11_v201_cred';

function v201T(k, ctx) { return _t(k, ctx); }
function v201SaveCred() {
  try { localStorage.setItem(V201_KEY, JSON.stringify({ pass: V201.pass, pin: V201.pin })); } catch (e) {}
}
function v201LoadCred() {
  try {
    var raw = localStorage.getItem(V201_KEY);
    if (raw) {
      var o = JSON.parse(raw) || {};
      V201.pass = typeof o.pass === 'string' ? o.pass : '';
      V201.pin = typeof o.pin === 'string' ? o.pin : '';
    }
  } catch (e) { /* 损坏的本地数据忽略 */ }
}
function v201SetPass(v) {
  V201.pass = String(v == null ? '' : v);
  v201SaveCred();
  v201SyncLockUi();
}
function v201SetPin(v) {
  V201.pin = String(v == null ? '' : v);
  v201SaveCred();
  v201SyncLockUi();
}

/* ---- 锁屏 UI ---- */
function v201SyncLockUi() {
  var inp = $('#lockPass');
  var isPin = V201.mode === 'pin';
  if (inp) {
    inp.setAttribute('data-i18n-ph', isPin ? 'lock_pin_ph' : 'lock_pass_ph');
    inp.placeholder = v201T(isPin ? 'lock_pin_ph' : 'lock_pass_ph');
    inp.setAttribute('inputmode', isPin ? 'numeric' : 'text');
    inp.maxLength = isPin ? 20 : 64;
  }
  $$('#lockOpts [data-lockmode]').forEach(function (b) {
    b.classList.toggle('on', b.dataset.lockmode === V201.mode);
  });
  var none = !V201.pass && !V201.pin;
  var noEl = $('#lockNoCred');
  if (noEl) {
    noEl.textContent = none ? v201T('lock_no_cred') : '';
    noEl.hidden = !none;
  }
}
function v201ClearErr() {
  var el = $('#lockErr');
  if (el) { el.classList.remove('show'); el.textContent = ''; }
  var inp = $('#lockPass');
  if (inp) inp.classList.remove('wrong');
}
function v201ShowErr(msg) {
  var el = $('#lockErr');
  if (el) { el.textContent = msg; el.classList.add('show'); }
  var inp = $('#lockPass');
  if (inp) {
    inp.classList.remove('wrong');
    void inp.offsetWidth; /* 重新触发动画 */
    inp.classList.add('wrong');
    try { inp.focus(); inp.select(); } catch (e) {}
  }
}
function v201PrepareLock() {
  V201.mode = V201.pin ? 'pin' : 'pass';
  var inp = $('#lockPass');
  if (inp) inp.value = '';
  var opts = $('#lockOpts');
  if (opts) opts.classList.remove('open');
  v201ClearErr();
  v201SyncLockUi();
  later(function () {
    var p = $('#lockPass');
    if (p) { try { p.focus(); } catch (e) {} }
  }, 120);
}
function v201Submit() {
  var lk = $('#lockScreen');
  if (!lk) return;
  var inp = $('#lockPass');
  var val = inp ? inp.value : '';
  var isPin = V201.mode === 'pin';
  var expect = isPin ? V201.pin : V201.pass;
  if (expect) {
    if (val !== expect) {
      v201ShowErr(v201T(isPin ? 'lock_err_pin' : 'lock_err_pass'));
      return;
    }
  } else if (V201.pass || V201.pin) {
    /* 当前方式未设置，但另一种已设置：提示切换 */
    v201ShowErr(v201T(isPin ? 'lock_err_nopin' : 'lock_err_nopass'));
    return;
  }
  /* 校验通过，或两种凭据都未设置 */
  v201ClearErr();
  if (inp) inp.value = '';
  lk.classList.remove('open', 'stage-signin');
  toast(_t('lock_signin'));
}

function v201BindLock() {
  var box = $('#lockSignin');
  if (box) {
    /* 捕获阶段先于原有处理器，避免任何输入直接解锁 */
    box.addEventListener('click', function (e) {
      if (e.target.closest('#lockGo')) {
        e.preventDefault(); e.stopPropagation();
        v201Submit();
        return;
      }
      if (e.target.closest('#lockOptBtn')) {
        e.preventDefault(); e.stopPropagation();
        var opts = $('#lockOpts');
        if (opts) opts.classList.toggle('open');
        return;
      }
      var md = e.target.closest('[data-lockmode]');
      if (md) {
        e.preventDefault(); e.stopPropagation();
        V201.mode = md.dataset.lockmode;
        var list = $('#lockOpts');
        if (list) list.classList.remove('open');
        var inp = $('#lockPass');
        if (inp) inp.value = '';
        v201ClearErr();
        v201SyncLockUi();
        if (inp) { try { inp.focus(); } catch (err) {} }
      }
    }, true);
    box.addEventListener('keydown', function (e) {
      if (e.target && e.target.id === 'lockPass' && e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation();
        v201Submit();
      }
    }, true);
  }
  var lk = $('#lockScreen');
  if (lk) lk.addEventListener('click', function (e) {
    if (e.target.closest('#lockSignin')) return;
    if (lk.classList.contains('stage-signin')) return;
    later(v201PrepareLock, 0);
  }, true);
}

/* ---- OOBE 凭据采集（只追加监听，不改原有校验） ---- */
function v201BindOobe() {
  var localNext = $('#localNext');
  if (localNext) localNext.addEventListener('click', function () {
    var u = $('#localUser'), p1 = $('#localPass'), p2 = $('#localPass2');
    if (!u || !p1 || !p2) return;
    if (!u.value.trim() || p1.value !== p2.value) return;
    v201SetPass(p1.value);
  });
  var helloNext = $('#helloNext');
  if (helloNext) helloNext.addEventListener('click', function () {
    var p1 = $('#helloPin'), p2 = $('#helloPin2');
    if (!p1 || !p2) return;
    var v1 = p1.value.trim(), v2 = p2.value.trim();
    if (v1.length >= 4 && v1 === v2) v201SetPin(v1);
  });
  var skip = $('#helloSkip');
  if (skip) skip.addEventListener('click', function () {
    /* 选择跳过即表示本机不设置 PIN */
    V201.pin = '';
    v201SaveCred();
    v201SyncLockUi();
  });
}

/* ---- 设置 > 账户 > 登录选项 ---- */
function v201SettingsHtml() {
  var hasP = !!V201.pass, hasN = !!V201.pin;
  function stateTag(on) {
    return '<em class="' + (on ? 'on' : '') + '">' + v201T(on ? 'set_cred_set' : 'set_cred_unset') + '</em>';
  }
  return '<div class="v201-sec">' +
    '<div class="v201-hd">' + v201T('set_signin_title') + '</div>' +
    '<div class="v201-sub">' + v201T('set_signin_desc') + '</div>' +
    '<div class="v201-row"><b>' + v201T('set_signin_pass') + '</b>' + stateTag(hasP) + '</div>' +
    '<div class="v201-grid">' +
      '<input class="inp" id="v201Pass" type="password" autocomplete="new-password" placeholder="' + v201T('set_signin_pass') + '">' +
      '<input class="inp" id="v201Pass2" type="password" autocomplete="new-password" placeholder="' + v201T('set_signin_pass') + '">' +
      '<button class="btn primary" data-v201="savepass">' + v201T('set_cred_save_pass') + '</button>' +
    '</div>' +
    '<div class="v201-row"><b>' + v201T('set_signin_pin') + '</b>' + stateTag(hasN) + '</div>' +
    '<div class="v201-grid">' +
      '<input class="inp" id="v201Pin" type="text" inputmode="numeric" maxlength="20" autocomplete="off" placeholder="' + v201T('set_cred_pin_rule') + '">' +
      '<input class="inp" id="v201Pin2" type="text" inputmode="numeric" maxlength="20" autocomplete="off" placeholder="' + v201T('set_cred_pin_rule') + '">' +
      '<button class="btn primary" data-v201="savepin">' + v201T('set_cred_save_pin') + '</button>' +
    '</div>' +
    '<div class="v201-actions"><button class="btn" data-v201="clear">' + v201T('set_cred_clear') + '</button></div>' +
  '</div>';
}
function v201InjectSettings(body) {
  var main = body && body.querySelector('.settings__main');
  if (!main || main.querySelector('.v201-sec')) return;
  var host = document.createElement('div');
  host.className = 'v201-host';
  host.innerHTML = v201SettingsHtml();
  main.appendChild(host);
  host.addEventListener('click', function (e) {
    var b = e.target.closest('[data-v201]');
    if (!b) return;
    e.stopPropagation();
    var act = b.dataset.v201;
    if (act === 'clear') {
      V201.pass = '';
      V201.pin = '';
      v201SaveCred();
      v201SyncLockUi();
      toast(v201T('set_cred_cleared'));
      AppWindows._renderSettings(body, 'account');
      return;
    }
    if (act === 'savepass') {
      var p1 = $('#v201Pass'), p2 = $('#v201Pass2');
      var a = p1 ? p1.value : '', c = p2 ? p2.value : '';
      if (!a) { toast(v201T('set_cred_empty')); return; }
      if (a !== c) { toast(v201T('set_cred_mismatch')); return; }
      v201SetPass(a);
      toast(v201T('set_cred_pass_saved'));
      AppWindows._renderSettings(body, 'account');
      return;
    }
    if (act === 'savepin') {
      var n1 = $('#v201Pin'), n2 = $('#v201Pin2');
      var x = n1 ? n1.value.trim() : '', y = n2 ? n2.value.trim() : '';
      if (!/^\d{4,20}$/.test(x)) { toast(v201T('set_cred_pin_rule')); return; }
      if (x !== y) { toast(v201T('set_cred_mismatch')); return; }
      v201SetPin(x);
      toast(v201T('set_cred_pin_saved'));
      AppWindows._renderSettings(body, 'account');
    }
  });
}
var _v201RenderSettings = AppWindows._renderSettings;
AppWindows._renderSettings = function (body, page) {
  var r = _v201RenderSettings.apply(this, arguments);
  if ((page || (body && body.dataset.settingsPage)) === 'account') v201InjectSettings(body);
  return r;
};

function v201Init() {
  v201LoadCred();
  v201BindLock();
  v201BindOobe();
  v201SyncLockUi();
  document.addEventListener('langchange', function () { v201SyncLockUi(); });
}
v201Init();

window.__v201 = {
  get pass() { return V201.pass; },
  get pin() { return V201.pin; },
  setPass: v201SetPass,
  setPin: v201SetPin,
  openLock: function () { openLockScreen(); },
  state: V201
};
