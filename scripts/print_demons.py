# -*- coding: utf-8 -*-
import json

with open('scripts/demon_exercises.json', 'r', encoding='utf-8') as f:
    demons = json.load(f)

for idx, d in enumerate(demons):
    print(f"{idx+1:02d}. [{d['id']}] {d['name']} ({d['nameEn']}) | category={d['category']} | equip={d['equipment']}")
    print(f"    Purpose: {d['purpose']}")
    print(f"    Points: {d['keyPoints'][:2]}")
