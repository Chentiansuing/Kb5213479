r"""Windows 11 Setup Simulator 10.0.0 — 本地服务器。

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
    print(f"Windows 11 Setup Simulator 10.0.0 已启动：{url}")
    print(f"Temp 目录：{STORE}")
    print("按 Ctrl+C 停止服务")
    if os.environ.get("W11SIM_NO_BROWSER") != "1":
        try:
            webbrowser.open(url)
        except Exception:
            pass
    httpd.serve_forever()
