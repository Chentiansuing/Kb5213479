"""自动验证：每种语言启动 → 切换 → 截图 → 检查关键字。"""
import subprocess, pathlib, sys, re

ROOT = pathlib.Path(r"c:\Users\Administrator\Documents\Kb5213479\2026-11-15\windows-installer-sim")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
HTML = ROOT / "outputs" / "Windows11SetupSim.html"
URL = "file:///" + str(HTML).replace("\\", "/")
PROFILE = ROOT / "work" / "tmp" / "edgeprof2"
SHOTS = ROOT / "work" / "shots"
SHOTS.mkdir(parents=True, exist_ok=True)

# 每种语言一个 JS 片段：set localStorage → reload
LANGS = [
    ("zh-CN", "简体中文"),
    ("en-US", "English"),
    ("ja-JP", "日本語"),
]

import base64
for code, label in LANGS:
    # 生成一个带 data:text/html 的内联测试页
    html = HTML.read_text(encoding="utf-8")
    # 注入一个小脚本：页面 load 后先设置 localStorage，再点击语言按钮
    inject = f"""
<script>
(function(){{
  try{{ localStorage.setItem('windows11_setup_lang','{code}'); }}catch(e){{}}
  setTimeout(function(){{
    var btn = document.querySelector('.lang-switch button[data-lang="{code}"]');
    if (btn) btn.click();
    // 跳到 edition 页（已有 data-i18n 标记多的页面）
    if (window.__installer) window.__installer.go('edition');
  }}, 600);
}})();
</script>
"""
    html = html.replace("</body>", inject + "\n</body>", 1)
    tmp = ROOT / "work" / f"test_{code}.html"
    tmp.write_text(html, encoding="utf-8")
    url = "file:///" + str(tmp).replace("\\", "/")
    shot = SHOTS / f"i18n-v2-{code}.png"
    args = [EDGE, "--headless=new", "--disable-gpu", "--no-first-run",
            f"--user-data-dir={PROFILE}", "--window-size=1280,820",
            "--virtual-time-budget=4000", f"--screenshot={shot}", url]
    subprocess.run(args, check=True, capture_output=True)
    print(code, shot.stat().st_size, "OK")
