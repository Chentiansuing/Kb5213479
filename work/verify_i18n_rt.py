"""关键运行时页面验证 v3：简化 inject 避免定时器冲突。"""
import subprocess, pathlib, shutil

ROOT = pathlib.Path(r"c:\Users\Administrator\Documents\Kb5213479\2026-11-15\windows-installer-sim")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
HTML = ROOT / "outputs" / "Windows11SetupSim.html"
SHOTS = ROOT / "work" / "shots"
SHOTS.mkdir(parents=True, exist_ok=True)

STAGES = ["disk", "restart", "install", "final", "desktop"]

for code in ["zh-CN", "en-US", "ja-JP"]:
    profile = ROOT / "work" / "tmp" / f"edge_rt_{code}"
    if profile.exists():
        shutil.rmtree(profile, ignore_errors=True)

    for stage in STAGES:
        html = HTML.read_text(encoding="utf-8")
        # 直接同步调用 __i18n.switch 和 __installer.go —— inject 在 </body> 前，
        # 此时 lang_js 和 06_script 都已执行完毕，全局对象都存在。
        # 关键：go() 内部有 clearTimers() 会清掉 boot hook 的 pending 定时器
        inject = f"""
<script>
(function(){{
  if (window.__i18n && window.__i18n.switch) window.__i18n.switch('{code}');
  if (window.__installer) window.__installer.go('{stage}');
}})();
</script>
"""
        html = html.replace("</body>", inject + "\n</body>", 1)
        tmp = ROOT / "work" / f"test_{code}_{stage}.html"
        tmp.write_text(html, encoding="utf-8")
        url = "file:///" + str(tmp).replace("\\", "/")
        shot = SHOTS / f"i18n-rt-{code}-{stage}.png"
        args = [EDGE, "--headless=new", "--disable-gpu", "--no-first-run",
                f"--user-data-dir={profile}", "--window-size=1280,820",
                "--virtual-time-budget=3000", f"--screenshot={shot}", url]
        r = subprocess.run(args, capture_output=True)
        if r.returncode != 0:
            print(f"FAIL {code} {stage}:", r.stderr[:300])
        else:
            print(f"{code} {stage} → {shot.stat().st_size}B OK")
        tmp.unlink(missing_ok=True)
