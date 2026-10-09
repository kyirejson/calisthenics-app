# -*- coding: utf-8 -*-
import json
import os
from PIL import Image

with open('scripts/all_exercise_images.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print('=== 1. CHECKING DUPLICATE LOCAL IMAGES ===')
img_map = {}
for item in data:
    f = item['imgFile']
    if f and not str(f).startswith('http'):
        img_map.setdefault(f, []).append(f"{item['id']} ({item['name']})")

duplicates = {k: v for k, v in img_map.items() if len(v) > 1}
print(f"Total duplicate image keys: {len(duplicates)}")
for k, v in duplicates.items():
    print(f"  Image: {k} -> used by {len(v)} exercises: {v}")

print('\n=== 2. CHECKING IMAGE DIMENSIONS & SUSPICIOUS SIZES ===')
suspicious_images = []
for item in data:
    f = item['imgFile']
    if not f or str(f).startswith('http'):
        continue
    full_path = os.path.join('assets', f)
    if not os.path.exists(full_path):
        print(f"MISSING: {full_path} for {item['id']} ({item['name']})")
        continue
    try:
        with Image.open(full_path) as img:
            w, h = img.size
            ratio = w / float(h)
            if ratio > 2.5 or ratio < 0.4 or w < 300 or h < 300:
                suspicious_images.append((item['id'], item['name'], f, w, h, ratio))
    except Exception as e:
        print(f"ERROR reading {full_path}: {e}")

print(f"Suspicious images count: {len(suspicious_images)}")
for sid, sname, sf, sw, sh, sratio in suspicious_images:
    print(f"  {sid:<15} | {sname:<12} | {sf} ({sw}x{sh}, ratio={sratio:.2f})")

print('\n=== 3. CHECKING THE 34 REMOTE/MISSING EXERCISES ===')
remote_items = [item for item in data if item['source'] == 'remote']
print(f"Total remote/missing: {len(remote_items)}")
for item in remote_items:
    print(f"  {item['id']:<22} | {item['name']:<18} | cat={item['category']:<12} | step={item['step']}")

print('\n=== 4. CHECKING ORIGINAL ACTION IMAGES BY ROUTE ===')
# Let's inspect the original book illustration mappings for the 60 core CC1 exercises
# (push_01-10, pull_01-10, squat_01-10, legRaise_01-10, bridge_01-10, hspu_01-10)
cc1_core = [item for item in data if not item['isDemon'] and item['category'] in ['push', 'pull', 'squat', 'legRaise', 'bridge', 'hspu']]
print(f"Total CC1 core exercises: {len(cc1_core)}")
for item in cc1_core:
    print(f"  {item['id']:<12} | {item['name']:<10} | step={item['step']:<2} | {item['imgFile']}")
