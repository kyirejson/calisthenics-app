# -*- coding: utf-8 -*-
import os
import json
from PIL import Image

with open('src/data/private/imageMap.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

img_names = []
for line in lines:
    if 'require' in line:
        name = line.split(':')[0].strip().replace('"', '')
        img_names.append(name)

print('Total images in imageMap.ts:', len(img_names))

suspicious = []
for name in img_names:
    p = os.path.join('assets/original-images', name)
    if os.path.exists(p):
        with Image.open(p) as img:
            w, h = img.size
            ratio = w / float(h)
            # Banners are typically wide (ratio > 2.0) or tables (ratio around 0.73 with h > 800)
            if ratio > 2.0 or (h > 800 and w < 650) or w < 300 or h < 200:
                suspicious.append((name, w, h, ratio))

print('Suspicious images in original-images count:', len(suspicious))
for name, w, h, r in suspicious:
    print(f"  {name}: {w}x{h}, ratio={r:.2f}")

# Now check which exercises use these suspicious images
with open('scripts/all_exercise_images.json', 'r', encoding='utf-8') as f:
    exercises = json.load(f)

print('\n=== Exercises using these suspicious images ===')
suspicious_names = {s[0] for s in suspicious}
for ex in exercises:
    f = ex.get('imgFile', '')
    base = os.path.basename(f)
    if base in suspicious_names:
        print(f"  {ex['id']:<18} | {ex['name']:<12} | {base}")
