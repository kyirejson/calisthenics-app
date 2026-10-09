import json, os
from PIL import Image

with open('scripts/audit_results.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

assets_dir = 'assets/original-images'
skills_dir = 'assets/skills-images'

print('=== CHECKING 154 LOCAL ORIGINAL ACTIONS ===')
orig_actions = [a for a in data['allAudited'] if a['imgType'] == 'original']
print(f'Total original actions: {len(orig_actions)}')

missing_files = []
small_files = []
dimensions = {}
image_usage = {}

for a in orig_actions:
    img_name = a.get('primaryImageName')
    if not img_name:
        print(f"Action {a['id']} ({a['name']}) has no primaryImageName!")
        continue
    img_path = os.path.join(assets_dir, img_name)
    if not os.path.exists(img_path):
        missing_files.append((a['id'], a['name'], img_name))
    else:
        size = os.path.getsize(img_path)
        if size < 1000:
            small_files.append((a['id'], a['name'], img_name, size))
        try:
            with Image.open(img_path) as img:
                w, h = img.size
                dimensions[img_name] = (w, h)
        except Exception as e:
            print(f"Corrupt image: {img_path} - {e}")
        
        image_usage.setdefault(img_name, []).append((a['id'], a['name']))

print(f'Missing files: {len(missing_files)}')
if missing_files:
    for m in missing_files:
        print(f"  Missing: {m}")

print(f'Suspiciously small files (<1KB): {len(small_files)}')
print(f'Unique images used: {len(image_usage)}')

# Check multiple actions sharing the same image
shared = {k: v for k, v in image_usage.items() if len(v) > 1}
print(f'\n--- Images shared by multiple actions: {len(shared)} ---')
for k, v in shared.items():
    print(f"  {k} ({dimensions.get(k)}) used by {len(v)} actions: {[x[1] for x in v]}")

print('\n=== CHECKING 28 SKILLS IMAGES ===')
skill_actions = [a for a in data['allAudited'] if a['imgType'] == 'skill']
for a in skill_actions:
    s_path = os.path.join(skills_dir, f"{a['id']}.jpeg")
    if not os.path.exists(s_path):
        print(f"Missing skill file: {s_path}")
    else:
        with Image.open(s_path) as img:
            w, h = img.size
            if w < 400 or h < 300:
                print(f"Low resolution skill: {a['id']} ({w}x{h})")

print('Done inspecting images.')
