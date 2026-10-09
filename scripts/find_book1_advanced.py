# -*- coding: utf-8 -*-
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
base = r'D:\001号仓库\001号\囚徒健身全集'

for item in os.listdir(base):
    if item.startswith('01_'):
        dir_p1 = os.path.join(base, item)
        break

print(f"Found dir_p1: {dir_p1}")

for f in sorted(os.listdir(dir_p1)):
    if f.endswith('.md'):
        fp = os.path.join(dir_p1, f)
        with open(fp, 'r', encoding='utf-8', errors='ignore') as mdf:
            text = mdf.read()
        for section in re.split(r'###?#? ', text):
            title = section.split('\n')[0]
            if any(k in title for k in ['更上一层楼', '变式', '拓展', '终极', '超越', '其他']):
                print(f"=== [{f}] Section: {title} ===")
                imgs = re.findall(r'!\[.*?\]\((attachments/.*?)\)', section)
                imgs += re.findall(r'!\[\[(.*?)\]\]', section)
                print(f"  Images ({len(imgs)}): {imgs[:8]}")
                lines = [l.strip() for l in section.split('\n')[1:8] if l.strip()]
                for l in lines[:3]:
                    print(f"    {l[:80]}")
