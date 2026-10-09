# -*- coding: utf-8 -*-
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
base = r'D:\001号仓库\001号\囚徒健身全集'

# We want to match all images with their caption or nearby text
# Let's inspect markdown files and find pattern like ![[imageXXXXX.jpeg]] followed or preceded by text
results = []

for root, dirs, files in os.walk(base):
    if 'attachments' in root or '.git' in root:
        continue
    for f in sorted(files):
        if f.endswith('.md'):
            fp = os.path.join(root, f)
            with open(fp, 'r', encoding='utf-8', errors='ignore') as mdf:
                content = mdf.read()
            lines = content.split('\n')
            for idx, line in enumerate(lines):
                # find image reference
                imgs = re.findall(r'!\[.*?\]\((attachments/.*?)\)', line) + re.findall(r'!\[\[(.*?)\]\]', line)
                if imgs:
                    # get context lines (before and after)
                    before = [lines[j].strip() for j in range(max(0, idx - 4), idx) if lines[j].strip()]
                    after = [lines[j].strip() for j in range(idx + 1, min(len(lines), idx + 5)) if lines[j].strip()]
                    for img in imgs:
                        img_name = os.path.basename(img)
                        context = " ".join(before + after)
                        results.append((img_name, f, context[:120]))

print(f"Total mapped image references in books: {len(results)}")
# Search for our 33 demon keywords
keywords = {
    'push_demon_01': ['击掌', '拍手', 'clapping'],
    'push_demon_02': ['蜥蜴', '对角两点', 'lizard'],
    'push_demon_03': ['负重', '哑铃', '杠铃片', '背部'],
    'push_demon_04': ['超人', 'superman'],
    'push_demon_05': ['屈臂撑', '双杠', '单臂双杠', 'dip'],
    'push_demon_06': ['行走', '前后行走', 'walking'],
    'squat_demon_01': ['跳箱', '单腿跳箱', 'box jump'],
    'squat_demon_02': ['阿瑟拉缇', '负重单腿', '负重深蹲', 'weighted pistol'],
    'squat_demon_03': ['虾式', 'shrimp'],
    'squat_demon_04': ['立定跳远', '跳远', 'broad jump'],
    'squat_demon_05': ['柔式', '西西弗斯', 'sissy'],
    'squat_demon_06': ['团身', 'tuck jump'],
    'pull_demon_01': ['哨兵', 'muscle-up', '双力臂'],
    'pull_demon_02': ['水平悬垂', '后水平', 'back lever', 'front lever'],
    'pull_demon_03': ['铁十字', 'iron cross', '吊环十字'],
    'pull_demon_04': ['马耳他', 'maltese'],
    'pull_demon_05': ['攀绳', '爬绳', 'rope climb'],
    'pull_demon_06': ['翻身', '单杠翻身', 'pullover'],
    'legRaise_demon_01': ['V字举腿', 'v-raise', '李小龙'],
    'legRaise_demon_02': ['直角撑', 'l-sit', '地面直角'],
    'legRaise_demon_03': ['玛娜', 'manna', '反折'],
    'legRaise_demon_04': ['罗马椅', 'roman chair'],
    'legRaise_demon_05': ['50次', '耐力'],
    'bridge_demon_01': ['高位桥', '台阶', '下落'],
    'bridge_demon_02': ['倒立', '转换', '翻筋斗'],
    'bridge_demon_03': ['蝎子', 'scorpion'],
    'bridge_demon_04': ['蜥蜴桥', 'lizard bridge'],
    'bridge_demon_05': ['负重桥', '圣昆汀', '同伴'],
    'hspu_demon_01': ['阿瑟拉缇', '自由倒立撑', '单臂自由', 'freestanding one-arm'],
    'hspu_demon_02': ['虎立', '克莱恩', 'tiger bend'],
    'hspu_demon_03': ['台阶倒立', '走下台阶', '楼梯'],
    'hspu_demon_04': ['双杠倒立', 'parallettes'],
    'hspu_demon_05': ['不平衡', '高低']
}

for k, kw_list in keywords.items():
    matched = []
    for img_name, book_f, ctx in results:
        for kw in kw_list:
            if kw.lower() in ctx.lower():
                matched.append((img_name, kw, ctx[:60]))
                break
    if matched:
        print(f"\n[{k}] matches ({len(matched)}):")
        for m in matched[:3]:
            print(f"  {m[0]} (kw: {m[1]}): {m[2]}")
    else:
        print(f"\n[{k}] NO MATCH in book text")
