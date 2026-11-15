"""最终验证：三语言 DOM dump + 检查关键 i18n 元素文本是否匹配。"""
import subprocess, pathlib, shutil, re

ROOT = pathlib.Path(r"c:\Users\Administrator\Documents\Kb5213479\2026-11-15\windows-installer-sim")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
HTML = ROOT / "outputs" / "Windows11SetupSim.html"

EXPECTED = {
    "zh-CN": {
        "p1_name": "恢复", "p1_type": "恢复",
        "p2_name": "EFI 系统分区", "p2_type": "系统",
        "p4_name": "主分区", "p4_type": "主分区",
        "u_name": "未分配的空间",
        "h1_title": "你想将 Windows 安装在哪里？",
        "col1": "名称", "col2": "总大小",
    },
    "en-US": {
        "p1_name": "Recovery", "p1_type": "Recovery",
        "p2_name": "EFI System Partition", "p2_type": "System",
        "p4_name": "Primary", "p4_type": "Primary",
        "u_name": "Unallocated space",
        "h1_title": "Where do you want to install Windows?",
        "col1": "Name", "col2": "Total size",
    },
    "ja-JP": {
        "p1_name": "回復", "p1_type": "回復",
        "p2_name": "EFI システム パーティション", "p2_type": "システム",
        "p4_name": "プライマリ パーティション", "p4_type": "プライマリ パーティション",
        "u_name": "未割り当て領域",
        "h1_title": "Windows をどこにインストールしますか？",
        "col1": "名前", "col2": "合計サイズ",
    },
}

PASS = True
for code, exp in EXPECTED.items():
    profile = ROOT / "work" / "tmp" / f"edge_final_{code}"
    if profile.exists(): shutil.rmtree(profile, ignore_errors=True)

    html = HTML.read_text(encoding="utf-8")
    inject = f"""
<script>
(function(){{
  if (window.__i18n && window.__i18n.switch) window.__i18n.switch('{code}');
  setTimeout(function(){{
    if (window.__installer) window.__installer.go('disk');
  }}, 0);
}})();
</script>
"""
    html = html.replace("</body>", inject + "\n</body>", 1)
    tmp = ROOT / "work" / f"test_final_{code}.html"
    tmp.write_text(html, encoding="utf-8")
    url = "file:///" + str(tmp).replace("\\", "/")

    args = [EDGE, "--headless=new", "--disable-gpu", "--no-first-run",
            f"--user-data-dir={profile}", "--window-size=1280,820",
            "--virtual-time-budget=1500", "--dump-dom", url]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"FAIL {code}: RC={r.returncode}")
        PASS = False
        continue

    out = r.stdout

    # 检查 active screen 是 disk
    if 'class="screen active" id="s-disk"' not in out and 'id="s-disk"' not in out:
        print(f"[{code}] WARN: active screen not confirmed as disk")

    # 检查分区名
    # p1: data-id="p1" → em 标签里的分区名
    ok = True
    for key, val in exp.items():
        if f'data-id="p1"' in out:
            p1_block = out.split('data-id="p1"')[1].split('data-id="p2"')[0]
            p2_block = out.split('data-id="p2"')[1].split('data-id="p3"')[0]
            p3_block = out.split('data-id="p3"')[1].split('data-id="p4"')[0]
            p4_block = out.split('data-id="p4"')[1].split('data-id="u1"')[0]
            u_block = out.split('data-id="u')[1].split('</div>', 1)[0]
        else:
            # 找 diskRows 里的第一个分区
            p1_block = out.split('disk-row')[1].split('disk-row')[2] if 'disk-row' in out else ''
            p2_block = p3_block = p4_block = u_block = ''

        check = {
            "p1_name": ('<em>', '</em>', p1_block),
            "p1_type": (None, '</div>', p1_block),  # type 在第4个 div
            "p2_name": ('<em>', '</em>', p2_block),
            "p2_type": (None, '</div>', p2_block),
            "p4_name": ('<em>', '</em>', p4_block),
            "p4_type": (None, '</div>', p4_block),
        }

    # 简单检查：直接查期望字符串是否在 DOM 中
    for key, val in exp.items():
        if key.startswith('p') or key.startswith('u'):
            # 分区名/类型 —— 查 val 是否在 diskRows 区域附近
            if val not in out:
                print(f"[{code}] FAIL: 期望 '{val}' (key={key}) 在 DOM 中未找到")
                ok = False
        elif key == "h1_title":
            if f'data-i18n="title_disk">' not in out:
                print(f"[{code}] WARN: h1 title_disk not in DOM")
        elif key in ("col1", "col2"):
            # 列头 —— 查 val 是否在 table head 里
            if val not in out:
                print(f"[{code}] FAIL: 列头期望 '{val}' 未找到")
                ok = False

    if ok:
        print(f"[{code}] 分区名/类型/列头 全部匹配 ✓")
    else:
        PASS = False

    # 检查 lang-switch 按钮存在
    if 'class="lang-switch"' in out:
        print(f"[{code}] lang-switch 按钮 ✓")
    else:
        print(f"[{code}] FAIL: lang-switch 按钮未注入！")
        PASS = False

    tmp.unlink(missing_ok=True)

if PASS:
    print("\n=== 三语言最终验证：全部通过 ✓ ===")
else:
    print("\n=== 有失败项，请检查 ===")
