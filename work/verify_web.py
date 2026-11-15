"""v5.0 多文件工程验证：资源可达、5 语言渲染、版本号、锁屏/全屏/电源与语言按钮。"""
import pathlib, shutil, subprocess, sys, urllib.request

ROOT = pathlib.Path(r"c:\Users\Administrator\Documents\Kb5213479\2026-11-15\windows-installer-sim")
WEB = ROOT / "outputs" / "web"
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
SHOTS = ROOT / "work" / "shots"
SHOTS.mkdir(parents=True, exist_ok=True)
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
BASE = f"http://127.0.0.1:{PORT}/index.html"

# 每种语言：期望的 <html lang> + 界面特征文案
CASES = {
    "zh-CN": ("安装程序", "下一步"),
    "zh-TW": ("安裝程式", "下一步"),
    "en-US": ("Windows 11 Setup", "Next"),
    "ja-JP": ("セットアップ", "次へ"),
    "ko-KR": ("설치 프로그램", "다음"),
}

RESOURCES = [
    "index.html", "styles/app.css", "styles/windows.css",
    "scripts/i18n.js", "scripts/app.js", "locales/index.json",
    "locales/zh-CN.json", "locales/zh-TW.json", "locales/en-US.json",
    "locales/ja-JP.json", "locales/ko-KR.json", "serve.py",
]

fail = []

print("== 1. 静态资源可达性 ==")
for rel in RESOURCES:
    url = f"http://127.0.0.1:{PORT}/{rel}"
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            body = r.read()
        print(f"  [200] {rel}  {len(body)}B")
    except Exception as e:
        print(f"  [FAIL] {rel} — {e}")
        fail.append(rel)

print("\n== 2. 语言渲染（Edge headless --dump-dom） ==")
profile = ROOT / "work" / "tmp" / "edge_web_v50"
if profile.exists():
    shutil.rmtree(profile, ignore_errors=True)

for code, (sig1, sig2) in CASES.items():
    url = f"{BASE}?lang={code}"
    shot = SHOTS / f"v50-{code}.png"
    args = [EDGE, "--headless=new", "--disable-gpu", "--no-first-run",
            f"--user-data-dir={profile}", "--window-size=1280,860",
            "--virtual-time-budget=6000", f"--screenshot={shot}", "--dump-dom", url]
    r = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace")
    dom = r.stdout or ""
    checks = {
        "lang 属性": f'lang="{code}"' in dom,
        f"文案 {sig1}": sig1 in dom,
        f"文案 {sig2}": sig2 in dom,
        "版本号 v5.0": "v5.0" in dom,
        "快速设置面板": 'id="quickPanel"' in dom,
        "全屏按钮": 'id="qsFull"' in dom,
        "锁屏层": 'id="lockScreen"' in dom,
        "锁屏菜单项": 'data-power="lock"' in dom,
        "日历": 'id="calGrid"' in dom,
        "右键菜单": 'id="ctxMenu"' in dom,
        "可用应用入口": 'data-open="calc"' in dom,
        "5 个语言按钮": all(f'data-lang="{c}"' in dom for c in CASES),
    }
    ok = all(checks.values()) and shot.exists() and shot.stat().st_size > 80000
    print(f"  [{'PASS' if ok else 'FAIL'}] {code}  截图 {shot.stat().st_size if shot.exists() else 0}B  " +
          " ".join(f"{k}={'✓' if v else '✗'}" for k, v in checks.items()))
    if not ok:
        fail.append(code)

print()
if fail:
    print("=== 失败：", fail, "===")
    sys.exit(1)
print("=== v5.0 验证：全部通过 ===")
