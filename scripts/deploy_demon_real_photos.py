# -*- coding: utf-8 -*-
import os
import sys
from PIL import Image, ImageOps, ImageEnhance

sys.stdout.reconfigure(encoding='utf-8')

app_dir = r'd:\001号仓库\calisthenics-app'
attachments_dir = r'd:\001号仓库\001号\囚徒健身全集\attachments'
raw_sources_dir = os.path.join(app_dir, 'assets', 'raw-sources')
target_dir = os.path.join(app_dir, 'assets', 'demon-images')
os.makedirs(target_dir, exist_ok=True)

demon_source_map = {
    # --- Push Demons (俯卧撑魔鬼拓展 6 式) ---
    'push_demon_01': os.path.join(attachments_dir, 'image01132.jpeg'),  # Al Kavadlo 单臂爆发拍胸/击掌俯卧撑
    'push_demon_02': os.path.join(attachments_dir, 'image01601.jpeg'),  # Al Kavadlo 鳄爬/蜥蜴俯卧撑
    'push_demon_03': os.path.join(attachments_dir, 'image00573.jpeg'),  # 尤金·山道 老派负重/力量单臂俯卧撑
    'push_demon_04': os.path.join(attachments_dir, 'image01124.jpeg'),  # 丹尼·卡瓦德罗 腾空超人飞人俯卧撑
    'push_demon_05': os.path.join(attachments_dir, 'image01501.jpeg'),  # 真实运动员 单臂双杠屈臂撑
    'push_demon_06': os.path.join(attachments_dir, 'image01135.jpeg'),  # 真实运动员 时钟行走俯卧撑

    # --- Squat Demons (深蹲魔鬼拓展 6 式) ---
    'squat_demon_01': os.path.join(attachments_dir, 'image01061.jpeg'), # 爆发性跳箱/高箱深蹲
    'squat_demon_02': os.path.join(attachments_dir, 'image00599.jpeg'), # 伯特·阿瑟拉缇 负重90kg单腿手枪蹲
    'squat_demon_03': os.path.join(attachments_dir, 'image01670.jpeg'), # 阿尔·卡瓦德罗 虾式深蹲
    'squat_demon_04': os.path.join(attachments_dir, 'image01075.jpeg'), # 爆发跳远/单腿立定跳远
    'squat_demon_05': os.path.join(attachments_dir, 'image01672.jpeg'), # 健美大师 西斯/西西弗斯柔式深蹲
    'squat_demon_06': os.path.join(attachments_dir, 'image01760.jpeg'), # 丹尼·卡瓦德罗 空中抱膝团身跳

    # --- Pull Demons (引体向上魔鬼拓展 6 式) ---
    'pull_demon_01': os.path.join(attachments_dir, 'image01523.jpeg'),  # 弓手双立臂/哨兵上杠
    'pull_demon_02': os.path.join(attachments_dir, 'image01696.jpeg'),  # 阿尔·卡瓦德罗 单杠水平悬吊/后水平
    'pull_demon_03': os.path.join(raw_sources_dir, 'test_iron_cross.jpg'),       # 吊环铁十字 (高难度真人体操运动员实拍)
    'pull_demon_04': os.path.join(raw_sources_dir, 'test_maltese.jpg'),          # 吊环马耳他十字 (世锦赛选手实拍)
    'pull_demon_05': os.path.join(attachments_dir, 'image01759.jpeg'),  # 老派大力士 无腿L撑攀绳
    'pull_demon_06': os.path.join(attachments_dir, 'image01761.jpeg'),  # 连续单杠翻身回环

    # --- Leg Raise Demons (举腿魔鬼拓展 5 式) ---
    'legRaise_demon_01': os.path.join(attachments_dir, 'image00656.jpeg'), # 单杠悬垂V字举腿/脚触杠
    'legRaise_demon_02': os.path.join(attachments_dir, 'image00909.jpeg'), # 丹尼·卡瓦德罗 地面L-Sit直角撑
    'legRaise_demon_03': os.path.join(raw_sources_dir, 'test_manna.jpg'),           # 俄式反折高位撑 Manna (世锦赛选手实拍)
    'legRaise_demon_04': os.path.join(attachments_dir, 'image00844.jpeg'), # 丹尼·卡瓦德罗 水平悬空支撑/龙旗
    'legRaise_demon_05': os.path.join(attachments_dir, 'image00655.jpeg'), # 悬垂直腿上举50次挑战示范

    # --- Bridge Demons (桥魔鬼拓展 5 式) ---
    'bridge_demon_01': os.path.join(attachments_dir, 'image00684.jpeg'), # 运动员台阶下落反推铁板桥
    'bridge_demon_02': os.path.join(attachments_dir, 'image00685.jpeg'), # 倒立与铁桥动力转换/后手翻
    'bridge_demon_03': os.path.join(raw_sources_dir, 'scorpion1.jpg'),             # 瑜伽蝎子式倒立桥 (真人实拍)
    'bridge_demon_04': os.path.join(attachments_dir, 'image01327.jpeg'), # 阿尔·卡瓦德罗 蜥蜴铁桥
    'bridge_demon_05': os.path.join(attachments_dir, 'image00922.jpeg'), # 阿尔·卡瓦德罗 极限弧度老派铁板桥

    # --- HSPU Demons (倒立撑魔鬼拓展 5 式) ---
    'hspu_demon_01': os.path.join(attachments_dir, 'image00715.jpeg'),   # 伯特·阿瑟拉缇 自由单臂倒立撑
    'hspu_demon_02': os.path.join(attachments_dir, 'image00714.jpeg'),   # 席格·克莱恩 虎立倒立臂屈伸
    'hspu_demon_03': os.path.join(attachments_dir, 'image00547.jpeg'),   # 真实运动员 倒立行走
    'hspu_demon_04': os.path.join(attachments_dir, 'image00538.jpeg'),   # 道格·赫本 双杠超深自由倒立撑
    'hspu_demon_05': os.path.join(attachments_dir, 'image00703.jpeg'),   # 不平衡高低物体单臂倒立
}

def process_and_save_real_photo(src_path, dst_path, target_width=800, target_height=600):
    if not os.path.exists(src_path):
        raise FileNotFoundError(f"Source file not found: {src_path}")
    
    with Image.open(src_path) as img:
        img = img.convert('RGB')
        
        # Calculate aspect ratio
        target_ratio = target_width / target_height  # 4:3
        src_w, src_h = img.size
        src_ratio = src_w / src_h
        
        if abs(src_ratio - target_ratio) < 0.05:
            # Already close to 4:3, just resize
            final_img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
        elif src_ratio > target_ratio:
            # Source is wider, crop sides
            new_w = int(src_h * target_ratio)
            left = (src_w - new_w) // 2
            cropped = img.crop((left, 0, left + new_w, src_h))
            final_img = cropped.resize((target_width, target_height), Image.Resampling.LANCZOS)
        else:
            # Source is taller (e.g. portrait standing photo)
            # If cropping top/bottom by too much would cut head or feet, let's use letterbox with clean dark background
            # or smart crop centered
            if src_h / src_w > 1.4:
                # Tall image: scale to fit height within target_height, center on dark background
                scaled_h = target_height
                scaled_w = int(src_w * (target_height / src_h))
                resized = img.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
                
                # Create dark background
                final_img = Image.new('RGB', (target_width, target_height), (18, 20, 26))
                paste_x = (target_width - scaled_w) // 2
                final_img.paste(resized, (paste_x, 0))
            else:
                new_h = int(src_w / target_ratio)
                top = (src_h - new_h) // 2
                cropped = img.crop((0, top, src_w, top + new_h))
                final_img = cropped.resize((target_width, target_height), Image.Resampling.LANCZOS)
        
        # Slight enhancement for crisp display
        enhancer = ImageEnhance.Sharpness(final_img)
        final_img = enhancer.enhance(1.15)
        
        final_img.save(dst_path, format='JPEG', quality=92, optimize=True)

success_count = 0
for demon_id, src_path in sorted(demon_source_map.items()):
    out_file = os.path.join(target_dir, f"{demon_id}.jpeg")
    try:
        process_and_save_real_photo(src_path, out_file)
        size_kb = os.path.getsize(out_file) / 1024
        print(f"[OK] {demon_id} -> {os.path.basename(src_path)} ({size_kb:.1f} KB)")
        success_count += 1
    except Exception as e:
        print(f"[FAIL] {demon_id} from {src_path}: {e}")

print(f"\nCompleted: {success_count}/{len(demon_source_map)} real human photos deployed!")
