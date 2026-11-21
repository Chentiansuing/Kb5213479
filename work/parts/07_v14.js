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
