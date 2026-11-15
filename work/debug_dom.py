"""Debug v2: dump DOM to stdout and capture."""
import subprocess, pathlib, shutil, re

ROOT = pathlib.Path(r"c:\Users\Administrator\Documents\Kb5213479\2026-11-15\windows-installer-sim")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
HTML = ROOT / "outputs" / "Windows11SetupSim.html"
PROFILE = ROOT / "work" / "tmp" / "edge_dbg"
if PROFILE.exists(): shutil.rmtree(PROFILE, ignore_errors=True)

html = HTML.read_text(encoding="utf-8")
inject = """
<script>
(function(){
  if (window.__i18n && window.__i18n.switch) window.__i18n.switch('en-US');
  if (window.__installer) {
    try { window.__installer.go('disk'); } catch(e) { console.log('ERROR', e); }
  }
})();
</script>
"""
html = html.replace("</body>", inject + "\n</body>", 1)
tmp = ROOT / "work" / "test_dbg.html"
tmp.write_text(html, encoding="utf-8")
url = "file:///" + str(tmp).replace("\\", "/")

args = [EDGE, "--headless=new", "--disable-gpu", "--no-first-run",
        f"--user-data-dir={PROFILE}", "--window-size=1280,820",
        "--virtual-time-budget=3000", "--dump-dom", url]
r = subprocess.run(args, capture_output=True, text=True)
print("RC:", r.returncode)
# dump-dom outputs to stdout —— 可能非常大
out = r.stdout
print("stdout len:", len(out))
# 找 active screen
actives = re.findall(r'<section[^>]*class="[^"]*screen[^"]*\s+active[^"]*"[^>]*id="s-(\w+)"', out)
if not actives:
    # 另一种模式
    actives = re.findall(r'id="s-(\w+)"[^>]*class="[^"]*active', out)
print("active screens:", actives)
# 找 diskRows 是否有内容
if 'diskRows' in out:
    idx = out.find('diskRows')
    print("diskRows context:", repr(out[idx:idx+400]))
else:
    print("diskRows NOT in DOM")
# 确认 inject 脚本存在
if '__installer.go' in out:
    print("inject script present in DOM")
else:
    print("inject script NOT in DOM —— build_final.py 可能把 script 替换掉了？")
# 确认 lang-switch
print("lang-switch present:", 'lang-switch' in out)
