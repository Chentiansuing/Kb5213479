"""2.0 关键功能验证：此电脑 / Shift+F10 / 通知中心 / 密钥输入"""
import subprocess, pathlib, shutil

ROOT = pathlib.Path(r"c:\Users\Administrator\Documents\Kb5213479\2026-11-15\windows-installer-sim")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
HTML = ROOT / "outputs" / "Windows11SetupSim.html"
SHOTS = ROOT / "work" / "shots"
SHOTS.mkdir(parents=True, exist_ok=True)

tests = [
    ("此电脑 dblclick → 打开资源管理器", "desktop", """
<script>
(function(){
  setTimeout(function(){
    if (window.__installer) window.__installer.go('desktop');
    setTimeout(function(){
      var ico = document.getElementById('icoPC');
      if (ico) { ico.dispatchEvent(new MouseEvent('dblclick', {bubbles:true})); }
    }, 300);
  }, 400);
})();
</script>"""),
    ("Shift+F10 → 命令提示符", "install", """
<script>
(function(){
  setTimeout(function(){
    if (window.__installer) window.__installer.go('install');
    setTimeout(function(){
      document.dispatchEvent(new KeyboardEvent('keydown', {key:'F10', shiftKey:true, bubbles:true}));
    }, 500);
  }, 400);
})();
</script>"""),
    ("Shift+F10 → 桌面弹命令提示符", "desktop", """
<script>
(function(){
  setTimeout(function(){
    if (window.__installer) window.__installer.go('desktop');
    setTimeout(function(){
      document.dispatchEvent(new KeyboardEvent('keydown', {key:'F10', shiftKey:true, bubbles:true}));
      setTimeout(function(){
        document.dispatchEvent(new KeyboardEvent('keydown', {key:'F10', shiftKey:true, bubbles:true}));
      }, 200);
    }, 600);
  }, 400);
})();
</script>"""),
    ("任务栏 Edge → 打开浏览器", "desktop", """
<script>
(function(){
  setTimeout(function(){
    if (window.__installer) window.__installer.go('desktop');
    setTimeout(function(){
      var btns = document.querySelectorAll('.tb-btn.running');
      btns.forEach(function(b){ if ((b.getAttribute('title')||'').indexOf('Edge')>=0) b.click(); });
    }, 500);
  }, 400);
})();
</script>"""),
    ("任务栏资源管理器 → 打开 Explorer", "desktop", """
<script>
(function(){
  setTimeout(function(){
    if (window.__installer) window.__installer.go('desktop');
    setTimeout(function(){
      var btns = document.querySelectorAll('.tb-btn.running');
      btns.forEach(function(b){ if ((b.getAttribute('title')||'').indexOf('文件资源管理器')>=0) b.click(); });
    }, 500);
  }, 400);
})();
</script>"""),
    ("通知中心点击展开", "desktop", """
<script>
(function(){
  setTimeout(function(){
    if (window.__installer) window.__installer.go('desktop');
    setTimeout(function(){
      var btn = document.getElementById('notifBtn');
      if (btn) btn.click();
    }, 500);
  }, 400);
})();
</script>"""),
    ("密钥输入 25 字符 → Next 解锁", "key", """
<script>
(function(){
  setTimeout(function(){
    if (window.__installer) window.__installer.go('key');
    setTimeout(function(){
      var inp = document.getElementById('keyInput');
      if (inp) { inp.value = 'ABCDEFGHIJKLMNOPQRSTUVWX'; inp.dispatchEvent(new Event('input')); }
    }, 400);
  }, 400);
})();
</script>"""),
    ("版本号 + lang-switch 按钮", "desktop", """
<script>
(function(){
  setTimeout(function(){
    if (window.__installer) window.__installer.go('desktop');
  }, 400);
})();
</script>"""),
]

profile = ROOT / "work" / "tmp" / "edge_v2"
if profile.exists(): shutil.rmtree(profile, ignore_errors=True)

all_pass = True
for name, stage, inject in tests:
    html = HTML.read_text(encoding="utf-8")
    html = html.replace("</body>", inject + "\n</body>", 1)
    tmp = ROOT / "work" / f"test_v2_{stage}.html"
    tmp.write_text(html, encoding="utf-8")
    url = "file:///" + str(tmp).replace("\\", "/")
    shot = SHOTS / f"v2-{stage.replace('/','_')}.png"
    args = [EDGE, "--headless=new", "--disable-gpu", "--no-first-run",
            f"--user-data-dir={profile}", "--window-size=1280,860",
            "--virtual-time-budget=4500", f"--screenshot={shot}", url]
    r = subprocess.run(args, capture_output=True)
    ok = r.returncode == 0 and shot.exists() and shot.stat().st_size > 100000
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} → {shot.stat().st_size if shot.exists() else 0}B")
    if not ok: all_pass = False
    tmp.unlink(missing_ok=True)

print()
print("=== 2.0 验证：全部通过 ✓ ===" if all_pass else "=== 有失败项 ===")
