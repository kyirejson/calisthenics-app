# -*- coding: utf-8 -*-
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
base = r'D:\001号仓库\001号\囚徒健身全集'

# Extract all images from all chapters with their exact descriptions
img_to_text = {}

for root, dirs, files in os.walk(base):
    if 'attachments' in root or '.git' in root:
        continue
    for f in sorted(files):
        if f.endswith('.md'):
            fp = os.path.join(root, f)
            with open(fp, 'r', encoding='utf-8', errors='ignore') as mdf:
                content = mdf.read()
            lines = content.split('\n')
            for i, line in enumerate(lines):
                found = re.findall(r'!\[.*?\]\((attachments/.*?)\)', line) + re.findall(r'!\[\[(.*?)\]\]', line)
                if found:
                    surrounding = " ".join([lines[k].strip() for k in range(max(0, i-3), min(len(lines), i+4)) if lines[k].strip()])
                    for item in found:
                        name = os.path.basename(item)
                        img_to_text.setdefault(name, []).append((f, surrounding[:140]))

print(f"Total unique referenced images in all 4 books: {len(img_to_text)}")

# Let's search for specific action keywords
target_terms = [
    '击掌', '超人', '双杠', '行走', '跳箱', '单腿', '手枪', '立定跳远', 
    '柔式', '西西弗斯', '铁十字', '马耳他', '直角', 'L-sit', '玛娜', 
    '罗马椅', '台阶', '蝎子', '自由倒立', '单臂倒立', '高低', '负重'
]

for term in target_terms:
    matches = []
    for img_name, occurrences in img_to_text.items():
        for fn, text in occurrences:
            if term.lower() in text.lower():
                matches.append((img_name, fn, text[:80]))
                break
    print(f"\nKeyword '{term}': {len(matches)} images")
    for m in matches[:4]:
        print(f"  {m[0]} in [{m[1]}]: {m[2]}")
