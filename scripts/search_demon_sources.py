# -*- coding: utf-8 -*-
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
base = r'D:\001号仓库\001号\囚徒健身全集'

demon_keywords = [
    '击掌', '蜥蜴', '超人', '阿瑟拉缇', '跳箱', '柔式', '团身', 
    '哨兵', '马耳他', '铁十字', '攀绳', '玛娜', '罗马椅', '蝎子', '虎立', '负重'
]

for root, dirs, files in os.walk(base):
    if 'attachments' in root:
        continue
    for f in sorted(files):
        if f.endswith('.md'):
            fp = os.path.join(root, f)
            with open(fp, 'r', encoding='utf-8', errors='ignore') as mdf:
                content = mdf.read()
            for kw in demon_keywords:
                if kw in content:
                    # check if there are image references nearby!
                    # image markdown: ![[image...]] or ![](attachments/image...)
                    for line in content.split('\n'):
                        if kw in line:
                            # print line snippet
                            print(f"[{os.path.basename(root)}/{f}] ({kw}): {line[:100].strip()}")
