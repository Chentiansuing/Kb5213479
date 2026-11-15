"""把单文件成品拆成"带外部依赖"的多文件 Web 工程。

产出 outputs/web/：
  index.html                 仅结构 + <link>/<script src> 引用
  styles/app.css             基础样式
  styles/windows.css         窗口管理 + 语言切换样式
  locales/zh-CN.json         语言包（fetch 加载）
  locales/en-US.json
  locales/ja-JP.json
  scripts/i18n.js            异步语言包加载器（依赖 fetch → 必须 http）
  scripts/app.js             主逻辑（依赖 i18n.ready）
  serve.py                   本地静态服务器
  package.json               显式声明 serve 依赖
  启动（需本地服务器）.bat
"""
import ast, json, pathlib, re

ROOT = pathlib.Path(r"c:\Users\Administrator\Documents\Kb5213479\2026-11-15\windows-installer-sim")
PARTS = ROOT / "work" / "parts"
BUILD = ROOT / "work" / "build_final.py"
OUT = ROOT / "outputs" / "web"

# ---------- 1. 从 build_final.py 取语言字典与语言切换 CSS ----------
src = BUILD.read_text(encoding="utf-8")
tree = ast.parse(src)
LANG_JSON = None
LANG_CSS = None
for node in tree.body:
    if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
        name = node.targets[0].id
        if name == "LANG_JSON":
            LANG_JSON = ast.literal_eval(node.value)
        elif name == "lang_css":
            LANG_CSS = ast.literal_eval(node.value)
assert LANG_JSON and LANG_CSS, "未能从 build_final.py 提取 LANG_JSON / lang_css"

# ---------- 2. 切 CSS ----------
head = (PARTS / "01_head.html").read_text(encoding="utf-8")
css2 = (PARTS / "02_css2.html").read_text(encoding="utf-8")

base_css = head.split("<style>", 1)[1]
assert "</style>" not in base_css, "01_head.html 有多余的 </style>"
marker = "/* ============ 窗口管理 ============ */"
assert marker in css2, "找不到窗口管理 CSS 分界标记"
pre, win_css = css2.split(marker, 1)
win_css = marker + win_css
win_css = win_css.rsplit("</style>", 1)[0]
base_css += "\n" + pre

# ---------- 3. 拼 body ----------
body = ""
for name in ("03_setup.html", "04_flow.html", "05_oobe_desktop.html"):
    body += (PARTS / name).read_text(encoding="utf-8") + "\n"

# ---------- 4. 取主脚本 ----------
script = (PARTS / "06_script.html").read_text(encoding="utf-8")
script = script.strip()
# 06 分块末尾可能带着整页的收尾标签，先摘掉
script = script.replace("</body>", "").replace("</html>", "").strip()
assert script.startswith("<script>") and script.endswith("</script>"), "06_script.html 结构异常"
app_js = script[len("<script>"):-len("</script>")].strip()

# ---------- 5. 启动段改为等待语言包 ----------
old_boot = """  initDisk(); renderDisk(); $('#deviceInput').value = state.deviceName; _apply();
  updateVersionBadge('boot');

  var startId = (location.hash || '').replace('#', '');
  if (startId && document.getElementById('s-' + startId)) { go(startId); }
  else { go('boot'); }

  window.__installer = { go: go, state: state, openWindow: AppWindows.open };"""
new_boot = """  window.__installer = { go: go, state: state, openWindow: AppWindows.open };

  // 依赖：语言包必须先从 locales/*.json 加载完成（需要 http 环境，file:// 下 fetch 会被拦截）
  function bootApp() {
    initDisk();
    renderDisk();
    $('#deviceInput').value = state.deviceName;
    _apply();
    updateVersionBadge('boot');
    var startId = (location.hash || '').replace('#', '');
    if (startId && document.getElementById('s-' + startId)) { go(startId); }
    else { go('boot'); }
  }

  if (window.__i18n && window.__i18n.ready) {
    window.__i18n.ready.then(bootApp);
  } else {
    bootApp();
  }"""
assert old_boot in app_js, "主脚本启动段没匹配上，无法改为异步启动"
app_js = app_js.replace(old_boot, new_boot, 1)

# ---------- 6. 组装各文件 ----------
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "styles").mkdir(exist_ok=True)
(OUT / "scripts").mkdir(exist_ok=True)
(OUT / "locales").mkdir(exist_ok=True)

(OUT / "styles" / "app.css").write_text(
    "/* Windows 11 Setup Simulator 2.0 — 基础样式（外部依赖） */\n" + base_css, encoding="utf-8")

(OUT / "styles" / "windows.css").write_text(
    "/* Windows 11 Setup Simulator 2.0 — 窗口管理与语言切换（外部依赖） */\n" + win_css + "\n" + LANG_CSS,
    encoding="utf-8")

for code, d in LANG_JSON.items():
    (OUT / "locales" / f"{code}.json").write_text(
        json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")

I18N_JS = r"""/* 语言包加载器 —— 依赖外部 locales/*.json（fetch，必须 http/https 环境） */
(function () {
  'use strict';

  var SUPPORTED = ['zh-CN', 'en-US', 'ja-JP'];
  var FALLBACK = 'zh-CN';
  var dict = {};
  var failed = [];

  var current = FALLBACK;
  try {
    var saved = localStorage.getItem('windows11_setup_lang');
    if (saved && SUPPORTED.indexOf(saved) >= 0) current = saved;
  } catch (e) { /* localStorage 不可用则用默认 */ }

  function lookup(code, k) {
    var pack = dict[code];
    return pack && Object.prototype.hasOwnProperty.call(pack, k) ? pack[k] : null;
  }

  function t(k, ctx) {
    var v = lookup(current, k);
    if (v === null) v = lookup(FALLBACK, k);
    if (v === null) v = k;
    if (ctx) {
      Object.keys(ctx).forEach(function (m) {
        v = v.split('{' + m + '}').join(ctx[m]);
      });
    }
    return v;
  }

  function apply() {
    if (!dict[current]) return;
    var map = [
      ['[data-i18n]', 'textContent'],
      ['[data-i18n-html]', 'innerHTML'],
      ['[data-i18n-ph]', 'placeholder'],
      ['[data-i18n-title]', 'title']
    ];
    map.forEach(function (pair) {
      document.querySelectorAll(pair[0]).forEach(function (el) {
        var key = el.dataset.i18n || el.dataset.i18nHtml || el.dataset.i18nPh || el.dataset.i18nTitle;
        if (key) el[pair[1]] = t(key);
      });
    });
    document.querySelectorAll('.lang-switch button[data-lang]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.lang === current);
    });
    document.documentElement.lang = current;
    document.title = t('setup_title');
  }

  function switchTo(code) {
    if (SUPPORTED.indexOf(code) < 0 || !dict[code]) return false;
    current = code;
    try { localStorage.setItem('windows11_setup_lang', code); } catch (e) {}
    apply();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: code } }));
    return true;
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.lang-switch button[data-lang]');
    if (btn) switchTo(btn.dataset.lang);
  });

  // 占位接口：脚本先绑定事件，语言包到位后再真正刷新
  window.__i18n = {
    t: t,
    apply: function () {},
    switch: switchTo,
    langs: dict,
    supported: SUPPORTED,
    failed: failed,
    get current() { return current; },
    ready: null
  };

  var ready = Promise.all(SUPPORTED.map(function (code) {
    return fetch('locales/' + code + '.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) { dict[code] = json; })
      .catch(function (err) {
        failed.push(code);
        console.error('[i18n] 语言包加载失败：locales/' + code + '.json —', err.message);
      });
  })).then(function () {
    if (!dict[current]) current = FALLBACK;
    window.__i18n.apply = apply;
    window.__i18n.langs = dict;
    window.__i18n.ready = Promise.resolve(true);
    apply();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: current, initial: true } }));
    return true;
  });

  window.__i18n.ready = ready;
})();
"""
(OUT / "scripts" / "i18n.js").write_text(I18N_JS, encoding="utf-8")

(OUT / "scripts" / "app.js").write_text(app_js + "\n", encoding="utf-8")

SWITCH_HTML = """<div class="lang-switch" id="langSwitch">
  <button data-lang="zh-CN">简体中文</button><div class="sep"></div>
  <button data-lang="en-US">English</button><div class="sep"></div>
  <button data-lang="ja-JP">日本語</button>
</div>"""

index_html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Windows 11 安装程序</title>

<!-- 外部依赖：样式 -->
<link rel="stylesheet" href="styles/app.css">
<link rel="stylesheet" href="styles/windows.css">
</head>
<body>
{body}
{SWITCH_HTML}

<!-- 外部依赖：语言包加载器 + 主逻辑（语言包为 locales/*.json，需通过本地服务器访问） -->
<script src="scripts/i18n.js"></script>
<script src="scripts/app.js"></script>
</body>
</html>
"""
(OUT / "index.html").write_text(index_html, encoding="utf-8")

(OUT / "serve.py").write_text('''"""本地静态服务器：语言包通过 fetch 加载，必须走 http 协议。"""
import http.server
import os
import socketserver
import webbrowser

PORT = 8765
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".json": "application/json; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    url = f"http://127.0.0.1:{PORT}/index.html"
    print(f"Windows 11 Setup Simulator 2.0 已启动：{url}")
    print("按 Ctrl+C 停止服务")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    httpd.serve_forever()
''', encoding="utf-8")

(OUT / "package.json").write_text(json.dumps({
    "name": "windows11-setup-sim",
    "version": "2.0.0",
    "private": True,
    "description": "Windows 11 安装程序模拟器（多文件版，依赖本地静态服务器）",
    "scripts": {"start": "serve -l 8765 ."},
    "devDependencies": {"serve": "^14.2.1"},
}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

BAT = """@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动本地服务器（语言包需要 http 环境）...
start "" /min python serve.py
timeout /t 2 >nul
start "" msedge --app=http://127.0.0.1:8765/index.html
exit
"""
(OUT / "启动（需本地服务器）.bat").write_text(BAT, encoding="utf-8")

print("工程目录：", OUT)
for f in sorted(OUT.rglob("*")):
    if f.is_file():
        print(f"  {f.relative_to(OUT)}  {f.stat().st_size}B")
