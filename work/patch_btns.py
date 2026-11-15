"""补标按钮：遍历所有 <button> 标签，给里面的中文文本加 data-i18n。"""
import pathlib, re

SRC = pathlib.Path(r"c:\Users\Administrator\Documents\Kb5213479\2026-11-15\windows-installer-sim\outputs\Windows11SetupSim.html")
DST = SRC.read_text(encoding="utf-8")

BTN_TEXTS = {
    '下一步': 'btn_next',
    '上一步': 'btn_back',
    '是': 'oobe_yes',
    '接受': 'btn_accept',
    '跳过': 'oobe_skip',
    '立即重启': 'rst_now',
}

# 逐段找 <button...> 内容 </button>，处理文本
out = []
i = 0
n = len(DST)
changed = 0
while i < n:
    bt = DST.find('<button', i)
    if bt < 0:
        out.append(DST[i:])
        break
    # 先把 bt 之前的内容放进去
    out.append(DST[i:bt])
    # 找到这个 button 的结束标签
    close = DST.find('>', bt)
    close_btn = DST.find('</button>', close)
    if close_btn < 0:
        out.append(DST[bt:])
        break
    open_tag = DST[bt:close]   # 不含 '>'
    content = DST[close+1:close_btn].strip()
    tail = DST[close_btn:]

    if 'data-i18n' not in open_tag:
        for cn, key in BTN_TEXTS.items():
            if content == cn:
                open_tag_new = open_tag + f' data-i18n="{key}"'
                out.append(open_tag_new + '>' + content + tail)
                changed += 1
                break
        else:
            out.append(DST[bt:close_btn+9])
    else:
        out.append(DST[bt:close_btn+9])
    i = close_btn + 9

DST = ''.join(out)
SRC.write_text(DST, encoding="utf-8")
print("按钮补标：", changed, "处")

# 检查剩余遗漏
import re
for cn in BTN_TEXTS:
    count = 0
    for m in re.finditer(r'<button\b[^>]*>\s*' + re.escape(cn) + r'\s*</button>', DST):
        if 'data-i18n' not in m.group(0).split('>')[0]:
            count += 1
            print("LEFTOVER:", cn, m.group(0)[:80])
    if count == 0:
        print(f"  {cn}: OK")
print("DONE", len(DST))
