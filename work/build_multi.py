"""把工程拆成"带外部依赖"的多文件 Web 工程（v9.0，单文件版已放弃）。

产出 outputs/web/：
  index.html                 仅结构 + <link>/<script src> 引用
  styles/app.css             基础样式
  styles/windows.css         窗口管理 + 语言切换样式
  locales/index.json         语言清单（驱动顶部语言按钮）
  locales/zh-CN.json         语言包（fetch 加载，5 种语言）
  locales/zh-TW.json
  locales/en-US.json
  locales/ja-JP.json
  locales/ko-KR.json
  scripts/i18n.js            清单 + 语言包异步加载器（依赖 fetch → 必须 http）
  scripts/app.js             主逻辑（依赖 i18n.ready）
  serve.py                   本地服务器 + /api/save /api/list /api/load（写入系统 Temp）
  package.json               显式声明 serve 依赖
  启动（需本地服务器）.bat
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(r"c:\Users\Administrator\Documents\Kb5213479\2026-11-15\windows-installer-sim")
PARTS = ROOT / "work" / "parts"
OUT = ROOT / "outputs" / "web"
VERSION = "11.0.0"

sys.path.insert(0, str(ROOT / "work"))
from locales_data import LANG_JSON, LANG_CSS, LANG_LABELS, LANG_ORDER  # noqa: E402
from extra_v3 import EXTRA_V3  # noqa: E402
from extra_v4 import EXTRA_V4  # noqa: E402
from extra_v5 import EXTRA_V5  # noqa: E402
from extra_v6 import EXTRA_V6  # noqa: E402
from extra_v7 import EXTRA_V7  # noqa: E402
from extra_v8 import EXTRA_V8  # noqa: E402
from extra_v81 import EXTRA_V81  # noqa: E402
from extra_v9 import EXTRA_V9  # noqa: E402
from extra_v10 import EXTRA_V10  # noqa: E402
from extra_v11 import EXTRA_V11  # noqa: E402

for _code in LANG_ORDER:
    LANG_JSON[_code].update(EXTRA_V3[_code])
    LANG_JSON[_code].update(EXTRA_V4[_code])
    LANG_JSON[_code].update(EXTRA_V5[_code])
    LANG_JSON[_code].update(EXTRA_V6[_code])
    LANG_JSON[_code].update(EXTRA_V7[_code])
    LANG_JSON[_code].update(EXTRA_V8[_code])
    LANG_JSON[_code].update(EXTRA_V81[_code])
    LANG_JSON[_code].update(EXTRA_V9[_code])
    LANG_JSON[_code].update(EXTRA_V10[_code])
    LANG_JSON[_code].update(EXTRA_V11[_code])
assert all(len(v) == len(LANG_JSON[LANG_ORDER[0]]) for v in LANG_JSON.values()), "语言包键数不一致"

# ---------- 1. 切 CSS ----------
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

# ---------- 2. 拼 body ----------
body = ""
for name in ("03_setup.html", "04_flow.html", "05_oobe_desktop.html"):
    body += (PARTS / name).read_text(encoding="utf-8") + "\n"

# ---------- 2.1 给静态文案补 data-i18n ----------
TAG_RE = re.compile(r'<(/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"\']|"[^"]*"|\'[^\']*\')*)>')
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input",
             "link", "meta", "param", "source", "track", "wbr", "path", "circle",
             "rect", "line", "polyline", "polygon", "stop", "use"}
SAFE_TAGS = {"h1", "h2", "h3", "h4", "p", "span", "div", "label", "button",
             "b", "strong", "td", "th", "li", "a", "small", "em", "option"}


def _norm(s):
    """忽略中英文引号差异后再比对（中文文案里『』与“”混用）。"""
    for ch in "『』“”\"'「」":
        s = s.replace(ch, "")
    return s.strip()


def patch_i18n(html, zh):
    """把纯文本元素按简体中文原文补上 data-i18n，使静态界面也能切语言。"""
    text2key = {}
    for k, v in zh.items():
        if not v or len(v.strip()) < 2 or '{' in v or '<' in v or '&' in v:
            continue
        text2key.setdefault(_norm(v), k)

    inserts = []
    stack = []
    for m in TAG_RE.finditer(html):
        closing, tag, attrs = m.group(1), m.group(2).lower(), m.group(3)
        if closing:
            while stack:
                t, cstart, ostart, oend = stack.pop()
                if t != tag:
                    continue
                content = html[cstart:m.start()]
                if '<' not in content and tag in SAFE_TAGS:
                    key = text2key.get(_norm(content))
                    if key and 'data-i18n' not in html[ostart:oend]:
                        inserts.append((oend - 1, f' data-i18n="{key}"'))
                break
        elif tag not in VOID_TAGS and not attrs.rstrip().endswith('/'):
            stack.append((tag, m.end(), m.start(), m.end()))

    for pos, attr in reversed(inserts):
        html = html[:pos] + attr + html[pos:]
    return html, len(inserts)


body, patched = patch_i18n(body, LANG_JSON["zh-CN"])
print(f"静态文案补标: {patched} 处")


def patch_br_labels(html, zh):
    """处理「文字<br>文字」这类两行标签（如桌面「重新安装 Windows」）。"""
    text2key = {}
    for k, v in zh.items():
        v = v.strip()
        if len(v) < 2 or '{' in v or '<' in v or '&' in v:
            continue
        text2key.setdefault(_norm(v), k)

    br_re = re.compile(r'<([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>([^<>]*)<br\s*/?>([^<>]*)</\1>')
    count = 0

    def repl(m):
        nonlocal count
        tag, attrs, a, b = m.group(1), m.group(2), m.group(3), m.group(4)
        if "data-i18n" in attrs:
            return m.group(0)
        key = text2key.get(_norm(a + b)) or text2key.get(_norm(a + " " + b))
        if not key:
            return m.group(0)
        count += 1
        text = (a.strip() + " " + b.strip()) if text2key.get(_norm(a + " " + b)) else (a + b).strip()
        return f'<{tag}{attrs} data-i18n="{key}">{text}</{tag}>'

    return br_re.sub(repl, html), count


body, br_fixed = patch_br_labels(body, LANG_JSON["zh-CN"])
print(f"换行标签补标: {br_fixed} 处")


def wrap_inline_labels(html, zh):
    """图文混排的元素（图标 + 文本）用 <span data-i18n> 包住尾部文本。"""
    vals = {}
    for k, v in zh.items():
        v = v.strip()
        if len(v) < 2 or '{' in v or '<' in v or '&' in v:
            continue
        vals.setdefault(_norm(v), (v, k))
    count = 0
    for v, k in vals.values():
        pat = re.compile(r'(</span>|</svg>)(\s*)' + re.escape(v) + r'(?=[<\s]|$)')
        html, n = pat.subn(
            lambda m: f'{m.group(1)}{m.group(2)}<span data-i18n="{k}">{v}</span>', html)
        count += n
    return html, count


body, wrapped = wrap_inline_labels(body, LANG_JSON["zh-CN"])
print(f"图文混排补标: {wrapped} 处")

# ---------- 3. 取主脚本 ----------
script = (PARTS / "06_script.html").read_text(encoding="utf-8").strip()
script = script.replace("</body>", "").replace("</html>", "").strip()
assert script.startswith("<script>") and script.endswith("</script>"), "06_script.html 结构异常"
app_js = script[len("<script>"):-len("</script>")].strip()

# ---------- 4. 启动段改为等待语言包 ----------
old_boot = """  loadPrefs();
  initDisk(); renderDisk(); $('#deviceInput').value = state.deviceName;
  applyTheme(); _apply();
  updateVersionBadge();
  fsList(function () { /* v5.0：预取 Temp 目录文件列表 */ });

  var startId = (location.hash || '').replace('#', '');
  if (startId && document.getElementById('s-' + startId)) { go(startId); }
  else { go('boot'); }

  window.__installer = {
    go: go, state: state,
    openWindow: function (type, opts) { return AppWindows.open(type, opts); },
    openApp: openAppType, applyTheme: applyTheme, renderCalendar: renderCalendar,
    toggleFullscreen: toggleFullscreen, fsList: fsList, savePrefs: savePrefs,
    openTaskView: openTaskView, createDesktop: createDesktop, switchDesktop: switchDesktop,
    openSearch: openSearch, toggleWidgets: toggleWidgets,
    snap: function (id, mode) { return AppWindows.snap(id, mode); }
  };"""
new_boot = """  window.__installer = {
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
  }"""
assert old_boot in app_js, "主脚本启动段没匹配上，无法改为异步启动"
app_js = app_js.replace(old_boot, new_boot, 1)

# ---------- 5. 组装各文件 ----------
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "styles").mkdir(exist_ok=True)
(OUT / "scripts").mkdir(exist_ok=True)
(OUT / "locales").mkdir(exist_ok=True)

(OUT / "styles" / "app.css").write_text(
    f"/* Windows 11 Setup Simulator {VERSION} — 基础样式（外部依赖） */\n" + base_css, encoding="utf-8")

(OUT / "styles" / "windows.css").write_text(
    f"/* Windows 11 Setup Simulator {VERSION} — 窗口管理与语言切换（外部依赖） */\n" + win_css + "\n" + LANG_CSS,
    encoding="utf-8")

# 语言清单 + 各语言包
manifest = [{"code": code, "label": LANG_LABELS[code]} for code in LANG_ORDER]
(OUT / "locales" / "index.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
for code in LANG_ORDER:
    (OUT / "locales" / f"{code}.json").write_text(
        json.dumps(LANG_JSON[code], ensure_ascii=False, indent=2), encoding="utf-8")

I18N_JS = r"""/* 语言包加载器 v4.0 —— 依赖外部 locales/index.json + locales/<code>.json
 * 必须通过 http/https 访问（file:// 下 fetch 会被浏览器拦截）。
 */
(function () {
  'use strict';

  var MANIFEST = 'locales/index.json';
  var FALLBACK = 'zh-CN';
  var dict = {};
  var failed = [];
  var langs = [];          // [{code,label}]
  var current = FALLBACK;

  try {
    var saved = localStorage.getItem('windows11_setup_lang');
    if (saved) current = saved;
  } catch (e) { /* localStorage 不可用则用默认 */ }

  // 支持 ?lang=ko-KR 直接以指定语言打开（便于分享与截图验证）
  try {
    var q = new URLSearchParams(location.search).get('lang');
    if (q) current = q;
  } catch (e) { /* 老浏览器忽略 */ }

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
    if (!dict[code]) return false;
    current = code;
    try { localStorage.setItem('windows11_setup_lang', code); } catch (e) {}
    apply();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: code } }));
    return true;
  }

  // 顶部语言按钮完全由清单驱动
  function renderButtons() {
    var host = document.getElementById('langSwitch');
    if (!host) return;
    host.innerHTML = '';
    langs.forEach(function (item, i) {
      if (i) {
        var sep = document.createElement('div');
        sep.className = 'sep';
        host.appendChild(sep);
      }
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.lang = item.code;
      b.textContent = item.label;
      host.appendChild(b);
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.lang-switch button[data-lang]');
    if (btn) switchTo(btn.dataset.lang);
  });

  window.__i18n = {
    t: t,
    apply: function () {},
    switch: switchTo,
    langs: dict,
    supported: [],
    failed: failed,
    get current() { return current; },
    ready: null
  };

  var ready = fetch(MANIFEST, { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (list) {
      if (!Array.isArray(list) || !list.length) throw new Error('清单为空');
      langs = list;
    })
    .catch(function (err) {
      failed.push('index.json');
      console.error('[i18n] 语言清单加载失败：' + MANIFEST + ' —', err.message);
      langs = [{ code: 'zh-CN', label: '简体中文' }];
    })
    .then(function () {
      var codes = langs.map(function (x) { return x.code; });
      if (codes.indexOf(current) < 0) current = codes.indexOf(FALLBACK) >= 0 ? FALLBACK : codes[0];
      window.__i18n.supported = codes;
      renderButtons();
      return Promise.all(langs.map(function (item) {
        return fetch('locales/' + item.code + '.json', { cache: 'no-cache' })
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
          })
          .then(function (json) { dict[item.code] = json; })
          .catch(function (err) {
            failed.push(item.code);
            console.error('[i18n] 语言包加载失败：locales/' + item.code + '.json —', err.message);
          });
      }));
    })
    .then(function () {
      if (!dict[current]) {
        var ok = window.__i18n.supported.filter(function (c) { return dict[c]; });
        current = ok.indexOf(FALLBACK) >= 0 ? FALLBACK : (ok[0] || FALLBACK);
      }
      window.__i18n.apply = apply;
      window.__i18n.langs = dict;
      apply();
      document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: current, initial: true } }));
      return true;
    });

  window.__i18n.ready = ready;
})();
"""
(OUT / "scripts" / "i18n.js").write_text(I18N_JS, encoding="utf-8")
(OUT / "scripts" / "app.js").write_text(app_js + "\n", encoding="utf-8")

SWITCH_HTML = '<div class="lang-switch" id="langSwitch"></div>'

index_html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Windows 11 安装程序</title>

<!-- 外部依赖：样式（带版本号，避免更新后仍命中旧缓存） -->
<link rel="stylesheet" href="styles/app.css?v={VERSION}">
<link rel="stylesheet" href="styles/windows.css?v={VERSION}">
</head>
<body>
{body}
<!-- 语言按钮由 locales/index.json 清单渲染 -->
{SWITCH_HTML}

<!-- 外部依赖：语言包加载器 + 主逻辑（语言包为 locales/*.json，需通过本地服务器访问） -->
<script src="scripts/i18n.js?v={VERSION}"></script>
<script src="scripts/app.js?v={VERSION}"></script>
</body>
</html>
"""
(OUT / "index.html").write_text(index_html, encoding="utf-8")

SERVE_PY = r'''r"""Windows 11 Setup Simulator __VERSION__ — 本地服务器。

除了静态文件，还提供三个只在本机运行的 Temp 文件接口：
  POST /api/save   {"name": "notes.txt", "content": "..."}  → %TEMP%\windows11-sim\notes.txt
  GET  /api/list                                        → 列出该目录
  GET  /api/load?name=notes.txt                         → 读取文件内容
语言包与脚本通过 fetch 加载，必须走 http://127.0.0.1 。
"""
import http.server
import json
import os
import re
import socketserver
import tempfile
import urllib.parse
import webbrowser

PORT = 8765
WEBROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(WEBROOT)
STORE = os.path.join(tempfile.gettempdir(), "windows11-sim")
os.makedirs(STORE, exist_ok=True)


def safe_name(name):
    name = str(name or "file.txt").replace("\\", "/").split("/")[-1]
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name).strip(". ")
    if not name:
        return "file.txt"
    ext = os.path.splitext(name)[1].lower()
    if ext not in {".txt", ".md", ".log", ".json"}:
        name = (os.path.splitext(name)[0] or "file") + ".txt"
    return name


MAX_CONTENT = 512 * 1024


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

    def _json(self, obj, code=200):
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        if url.path == "/api/list":
            files = []
            for name in sorted(os.listdir(STORE)):
                path = os.path.join(STORE, name)
                if os.path.isfile(path):
                    files.append({"name": name, "size": os.path.getsize(path)})
            self._json({"dir": STORE, "files": files})
            return
        if url.path == "/api/load":
            query = urllib.parse.parse_qs(url.query)
            name = safe_name((query.get("name") or [""])[0])
            path = os.path.join(STORE, name)
            if not os.path.isfile(path):
                self._json({"ok": False, "error": "not found", "name": name}, 404)
                return
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                content = fh.read()
            self._json({"ok": True, "name": name, "content": content, "dir": STORE})
            return
        return super().do_GET()

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        if url.path != "/api/save":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length") or 0)
        try:
            data = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            self._json({"ok": False, "error": "bad json"}, 400)
            return
        name = safe_name(data.get("name"))
        content = data.get("content")
        if not isinstance(content, str):
            content = json.dumps(content, ensure_ascii=False, indent=2)
        if len(content.encode("utf-8")) > MAX_CONTENT:
            self._json({"ok": False, "error": "too large"}, 413)
            return
        path = os.path.join(STORE, name)
        try:
            with open(path, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(content)
        except OSError as exc:
            self._json({"ok": False, "error": str(exc)}, 500)
            return
        size = len(content.encode("utf-8"))
        print(f"[temp] {path}  {size} bytes")
        self._json({"ok": True, "name": name, "path": path, "dir": STORE, "bytes": size})


with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    url = f"http://127.0.0.1:{PORT}/index.html"
    print(f"Windows 11 Setup Simulator __VERSION__ 已启动：{url}")
    print(f"Temp 目录：{STORE}")
    print("按 Ctrl+C 停止服务")
    if os.environ.get("W11SIM_NO_BROWSER") != "1":
        try:
            webbrowser.open(url)
        except Exception:
            pass
    httpd.serve_forever()
'''
(OUT / "serve.py").write_text(SERVE_PY.replace("__VERSION__", VERSION), encoding="utf-8")

(OUT / "package.json").write_text(json.dumps({
    "name": "windows11-setup-sim",
    "version": VERSION,
    "private": True,
    "description": "Windows 11 安装程序模拟器（多文件版，依赖本地静态服务器）",
    "scripts": {"start": "serve -l 8765 ."},
    "devDependencies": {"serve": "^14.2.1"},
}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

BAT = """@echo off
chcp 65001 >nul
cd /d "%~dp0"
set W11SIM_NO_BROWSER=1
echo 正在启动本地服务器（样式、语言包与 Temp 文件接口需要 http 环境）...
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
