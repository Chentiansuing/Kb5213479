r"""Windows 11 Setup Simulator 21.0.0 — 本地服务器。

除了静态文件，还提供三个只在本机运行的 Temp 文件接口：
  POST /api/save   {"name": "notes.txt", "content": "..."}  → %TEMP%\windows11-sim\notes.txt
  GET  /api/list                                        → 列出该目录
  GET  /api/load?name=notes.txt                         → 读取文件内容
语言包与脚本通过 fetch 加载，必须走 http://127.0.0.1 。
"""
import http.server
import imaplib
import json
import os
import re
import smtplib
import socketserver
import ssl
import tempfile
import urllib.parse
import webbrowser
import email.message
import email.parser
import email.header
import email.utils
import email.policy

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

# ---------- v21.0：真实邮件（SMTP 发送 / IMAP 收件），仅监听本机 ----------
MAIL_TIMEOUT = 20
MAIL_MAX_BODY = 256 * 1024


def _mstr(data, key, default=""):
    v = data.get(key, default)
    return v if isinstance(v, str) else default


def _mport(data, key, default):
    try:
        p = int(data.get(key) or default)
    except (TypeError, ValueError):
        p = default
    return max(1, min(65535, p))


def _smtp_open(data):
    """按配置建立 SMTP 连接并完成登录，失败时抛出异常由上层转成错误文案。"""
    host = _mstr(data, "host").strip()
    if not host:
        raise ValueError("缺少 SMTP 服务器地址")
    security = _mstr(data, "security", "ssl")
    port = _mport(data, "port", 465 if security == "ssl" else 587)
    if security == "ssl":
        client = smtplib.SMTP_SSL(host, port, timeout=MAIL_TIMEOUT,
                                  context=ssl.create_default_context())
    else:
        client = smtplib.SMTP(host, port, timeout=MAIL_TIMEOUT)
        client.ehlo()
        if security == "starttls":
            client.starttls(context=ssl.create_default_context())
            client.ehlo()
    user = _mstr(data, "user").strip()
    if user:
        client.login(user, _mstr(data, "password"))
    return client


def _mail_error(exc):
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        return "SMTP 认证失败：请检查邮箱账号与授权码"
    if isinstance(exc, imaplib.IMAP4.error):
        return "IMAP 登录或读取失败：" + str(exc)[:200]
    return str(exc)[:300]


def mail_send(data):
    to = [a.strip() for a in re.split(r"[,;]", _mstr(data, "to")) if a.strip()]
    if not to or any("@" not in a for a in to):
        return {"ok": False, "error": "收件人地址无效"}
    cc = [a.strip() for a in re.split(r"[,;]", _mstr(data, "cc")) if a.strip()]
    sender = _mstr(data, "from").strip() or _mstr(data, "user").strip()
    if not sender or "@" not in sender:
        return {"ok": False, "error": "缺少有效的发件人地址"}
    subject = _mstr(data, "subject")[:200]
    body = _mstr(data, "body")
    if len(body.encode("utf-8")) > MAIL_MAX_BODY:
        return {"ok": False, "error": "正文超过 256KB 限制"}
    msg = email.message.EmailMessage()
    msg["From"] = sender
    msg["To"] = ", ".join(to)
    if cc:
        msg["Cc"] = ", ".join(cc)
    msg["Subject"] = subject or "(无主题)"
    msg["Date"] = email.utils.formatdate(localtime=True)
    msg["Message-ID"] = email.utils.make_msgid()
    msg.set_content(body, subtype="plain", charset="utf-8")
    try:
        client = _smtp_open(data)
    except (smtplib.SMTPException, OSError, ValueError) as exc:
        return {"ok": False, "error": _mail_error(exc)}
    try:
        client.send_message(msg, from_addr=sender, to_addrs=to + cc)
    except (smtplib.SMTPException, OSError) as exc:
        return {"ok": False, "error": _mail_error(exc)}
    finally:
        try:
            client.quit()
        except Exception:
            pass
    return {"ok": True, "to": to}


def mail_test(data):
    try:
        client = _smtp_open(data)
    except (smtplib.SMTPException, OSError, ValueError) as exc:
        return {"ok": False, "error": _mail_error(exc)}
    try:
        client.quit()
    except Exception:
        pass
    return {"ok": True}


def _decode_hdr(raw):
    if not raw:
        return ""
    try:
        return str(email.header.make_header(email.header.decode_header(raw)))
    except Exception:
        return raw


def mail_inbox(data):
    host = _mstr(data, "imapHost").strip() or _mstr(data, "host").strip()
    user = _mstr(data, "user").strip()
    password = _mstr(data, "password")
    if not host or not user:
        return {"ok": False, "error": "缺少 IMAP 服务器或账号"}
    port = _mport(data, "imapPort", 993)
    try:
        count = max(1, min(30, int(data.get("count") or 10)))
    except (TypeError, ValueError):
        count = 10
    security = _mstr(data, "imapSecurity", "ssl")
    try:
        if security == "none":
            box = imaplib.IMAP4(host, port, timeout=MAIL_TIMEOUT)
        else:
            box = imaplib.IMAP4_SSL(host, port, timeout=MAIL_TIMEOUT)
    except OSError as exc:
        return {"ok": False, "error": _mail_error(exc)}
    try:
        box.login(user, password)
        box.select("INBOX", readonly=True)
        typ, listing = box.search(None, "ALL")
        ids = listing[0].split() if typ == "OK" and listing else []
        messages = []
        for mid in reversed(ids[-count:]):
            typ, payload = box.fetch(mid, "(RFC822)")
            if typ != "OK":
                continue
            raw = b"".join(p[1] for p in payload if isinstance(p, tuple))
            parsed = email.parser.BytesParser(policy=email.policy.default).parsebytes(raw)
            text = ""
            try:
                if parsed.is_multipart():
                    for part in parsed.walk():
                        if part.get_content_type() == "text/plain" and not part.get_filename():
                            text = part.get_content()
                            break
                else:
                    text = parsed.get_content()
            except Exception:
                text = ""
            messages.append({
                "id": mid.decode("ascii", "replace"),
                "subject": _decode_hdr(parsed.get("Subject")) or "(无主题)",
                "from": _decode_hdr(parsed.get("From")),
                "date": _decode_hdr(parsed.get("Date")),
                "body": (text or "")[:4000],
            })
        return {"ok": True, "messages": messages}
    except (imaplib.IMAP4.error, OSError) as exc:
        return {"ok": False, "error": _mail_error(exc)}
    finally:
        try:
            box.logout()
        except Exception:
            pass


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
        if url.path in ("/api/mail/send", "/api/mail/test", "/api/mail/inbox"):
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_CONTENT:
                self._json({"ok": False, "error": "too large"}, 413)
                return
            try:
                data = json.loads(self.rfile.read(length) or b"{}")
            except Exception:
                self._json({"ok": False, "error": "bad json"}, 400)
                return
            if not isinstance(data, dict):
                self._json({"ok": False, "error": "bad json"}, 400)
                return
            if url.path == "/api/mail/send":
                self._json(mail_send(data))
            elif url.path == "/api/mail/test":
                self._json(mail_test(data))
            else:
                self._json(mail_inbox(data))
            return
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
    print(f"Windows 11 Setup Simulator 21.0.0 已启动：{url}")
    print(f"Temp 目录：{STORE}")
    print("按 Ctrl+C 停止服务")
    if os.environ.get("W11SIM_NO_BROWSER") != "1":
        try:
            webbrowser.open(url)
        except Exception:
            pass
    httpd.serve_forever()
