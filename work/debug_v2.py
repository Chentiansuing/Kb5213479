"""Debug why some desktop scenarios fail."""
import subprocess, pathlib, shutil, re

ROOT = pathlib.Path(r"c:\Users\Administrator\Documents\Kb5213479\2026-11-15\windows-installer-sim")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
HTML = ROOT / "outputs" / "Windows11SetupSim.html"
PROFILE = ROOT / "work" / "tmp" / "edge_dbg_v2"
if PROFILE.exists(): shutil.rmtree(PROFILE, ignore_errors=True)

html = HTML.read_text(encoding="utf-8")
inject = """
<script>
(function(){
  setTimeout(function(){
    if (window.__installer) window.__installer.go('desktop');
    setTimeout(function(){
      console.log('=== DEBUG ===');
      console.log('icoPC found:', !!document.getElementById('icoPC'));
      console.log('tb-btn.running count:', document.querySelectorAll('.tb-btn.running').length);
      document.querySelectorAll('.tb-btn.running').forEach(function(b){ console.log('tb-btn:', b.getAttribute('title')); });
      console.log('notifBtn found:', !!document.getElementById('notifBtn'));
      console.log('notifCenter found:', !!document.getElementById('notifCenter'));
      console.log('lang-switch found:', !!document.querySelector('.lang-switch'));
      console.log('versionBadge found:', !!document.getElementById('versionBadge'));
      // Shift+F10
      document.dispatchEvent(new KeyboardEvent('keydown', {key:'F10', shiftKey:true, bubbles:true}));
      console.log('after Shift+F10, openWindows:', Object.keys(window.__appWindows ? window.__appWindows._focusedId : 'none'));
      console.log('openWindows count:', Object.keys(window.__appWindows._focusedId ? {a:1} : {}).length);
      // dblclick PC
      var ico = document.getElementById('icoPC');
      if (ico) {
        console.log('dispatching dblclick on icoPC');
        ico.dispatchEvent(new MouseEvent('dblclick', {bubbles:true}));
      }
      setTimeout(function(){
        var layer = document.getElementById('winLayer');
        console.log('winLayer children:', layer ? layer.children.length : 'no layer');
        if (layer) {
          Array.from(layer.children).forEach(function(c){ console.log('  win:', c.className, 'id:', c.dataset.id); });
        }
      }, 300);
    }, 600);
  }, 500);
})();
</script>
"""
html = html.replace("</body>", inject + "\n</body>", 1)
tmp = ROOT / "work" / "dbg_v2.html"
tmp.write_text(html, encoding="utf-8")
url = "file:///" + str(tmp).replace("\\", "/")

args = [EDGE, "--headless=new", "--disable-gpu", "--no-first-run",
        f"--user-data-dir={PROFILE}", "--window-size=1280,860",
        "--virtual-time-budget=2500", "--dump-dom", url]
r = subprocess.run(args, capture_output=True, text=True)
out = r.stdout
print("RC:", r.returncode, "stdout len:", len(out))

# 找 winLayer
idx = out.find('winLayer')
if idx >= 0:
    print("winLayer context:", repr(out[idx:idx+500]))
else:
    print("winLayer NOT FOUND in DOM!")

# 找 tb-btn
idx2 = out.find('tb-btn running')
if idx2 < 0: idx2 = out.find('tb-btn.running')
if idx2 >= 0:
    print("tb-btn context:", repr(out[idx2:idx2+400]))
else:
    print("tb-btn running NOT FOUND")

# 找 notifBtn
idx3 = out.find('notifBtn')
if idx3 >= 0:
    print("notifBtn context:", repr(out[idx3:idx3+300]))
else:
    print("notifBtn NOT FOUND")

# 找 app-window
idx4 = out.find('app-window')
if idx4 >= 0:
    print("app-window FOUND in DOM!")
else:
    print("app-window NOT FOUND (no windows opened in DOM)")

tmp.unlink(missing_ok=True)
