"""本地静态服务器：语言包通过 fetch 加载，必须走 http 协议。"""
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
    print(f"Windows 11 Setup Simulator 4.0.0 已启动：{url}")
    print("按 Ctrl+C 停止服务")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    httpd.serve_forever()
