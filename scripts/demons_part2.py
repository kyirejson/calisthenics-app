# -*- coding: utf-8 -*-
"""
Demon Exercises Graphics Part 2: LegRaise (1-5), Bridge (1-5), HSPU (1-5)
Total: 15 exercises.
"""
from demons_common import (
    render_base_card, save_and_downscale, draw_floor, draw_bar,
    draw_limb, draw_joint, draw_head, draw_capsule, draw_annotation_box,
    draw_weight_plate, FONTS,
    PRIMARY_CYAN, CORE_WHITE, EMERALD, AMBER, PURPLE, RED, BAR_COLOR, BAR_HIGHLIGHT
)

# ==================== LEGRAISE DEMONS (1 - 5) ====================

def gen_legRaise_demon_01():
    # 悬垂 V 字举腿 (Hanging V-Raise)
    im, draw = render_base_card("legRaise_demon_01")
    bar_y = 650
    draw_bar(draw, y=bar_y, x1=400, x2=2000)

    # Hands gripping bar
    hand = (950, bar_y)
    draw_capsule(draw, (hand[0] - 30, hand[1]), (hand[0] + 30, hand[1]), 28, BAR_HIGHLIGHT)

    # Arms vertical down to shoulder
    shoulder = (950, 950)
    draw_limb(draw, hand, shoulder, width=42)
    draw_joint(draw, hand, 18)
    draw_joint(draw, shoulder, 24)

    # Head
    head = (860, 930)
    draw_head(draw, head, 50)
    draw_limb(draw, (900, 940), shoulder, width=36)

    # Torso hanging, pelvis curled up
    hip = (1000, 1250)
    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    # Legs fully locked straight into acute V, TOES TOUCHING BAR between hands!
    knee = (1020, 950)
    ankle = (1050, 650) # touching bar!
    toe = (1060, 620)
    draw_limb(draw, hip, knee, width=46, color=AMBER)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, ankle, width=38, color=AMBER)
    draw_joint(draw, ankle, 16)
    draw_capsule(draw, ankle, toe, 24, AMBER)

    # V shape lines
    draw.line([(1000, 1250), (950, 650)], fill=EMERALD, width=2)
    draw.line([(1000, 1250), (1050, 650)], fill=EMERALD, width=2)

    draw_annotation_box(draw, ankle, "脚尖脚踝稳稳触杠", direction='top-right', color=AMBER)
    draw_annotation_box(draw, knee, "双膝 180° 绝对锁死", direction='right', color=EMERALD)
    draw_annotation_box(draw, hip, "下腹核心极度紧缩成 V", direction='bottom-left', color=PRIMARY_CYAN)

    save_and_downscale(im, "legRaise_demon_01.jpeg")

def gen_legRaise_demon_02():
    # 地面直角撑 (Floor L-Sit)
    im, draw = render_base_card("legRaise_demon_02")
    draw_floor(draw, y=1380)

    # Hands pressing flat on floor
    hand = (1150, 1380)
    draw_capsule(draw, (hand[0] - 35, hand[1]), (hand[0] + 35, hand[1]), 26, BAR_HIGHLIGHT)

    # Straight vertical arms pushing floor (depression of scapula)
    shoulder = (1150, 960)
    draw_limb(draw, hand, shoulder, width=44)
    draw_joint(draw, hand, 18)
    draw_joint(draw, shoulder, 24)

    # Head
    head = (1100, 840)
    draw_head(draw, head, 52)
    draw_limb(draw, (1120, 900), shoulder, width=36)

    # Torso (pelvis elevated 120px above floor!)
    hip = (1150, 1260)
    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    # Legs fully locked horizontal at 90°
    knee = (1500, 1260)
    ankle = (1850, 1260)
    toe = (1950, 1260)
    draw_limb(draw, hip, knee, width=46)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, ankle, width=38)
    draw_joint(draw, ankle, 16)
    draw_capsule(draw, ankle, toe, 24, PRIMARY_CYAN)

    # Floor clearance gap indicator
    draw.line([(1150, 1260), (1150, 1380)], fill=EMERALD, width=4)
    draw.line([(1850, 1260), (1850, 1380)], fill=EMERALD, width=4)

    draw_annotation_box(draw, hand, "双手平撑硬质平地", direction='bottom-left', color=PRIMARY_CYAN)
    draw_annotation_box(draw, hip, "肩胛极限下压 · 骨盆悬空 10cm", direction='left', color=EMERALD)
    draw_annotation_box(draw, knee, "双腿水平 90° 锁直悬空", direction='top', color=AMBER)

    save_and_downscale(im, "legRaise_demon_02.jpeg")

def gen_legRaise_demon_03():
    # 俄式反折高位撑 (Manna)
    im, draw = render_base_card("legRaise_demon_03")
    draw_floor(draw, y=1380)

    # Hands planted on floor behind hips
    hand = (880, 1380)
    draw_capsule(draw, (hand[0] - 35, hand[1]), (hand[0] + 35, hand[1]), 26, BAR_HIGHLIGHT)

    # Arms straight locked behind back
    shoulder = (1040, 1060)
    draw_limb(draw, hand, shoulder, width=44)
    draw_joint(draw, hand, 18)
    draw_joint(draw, shoulder, 24)

    # Pelvis pushed forward and UP ABOVE shoulder height!
    hip = (1160, 920)
    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    # Head
    head = (950, 950)
    draw_head(draw, head, 50)

    # Legs fully locked, folded backwards over head!
    knee = (940, 780)
    ankle = (720, 680)
    toe = (650, 640)
    draw_limb(draw, hip, knee, width=46, color=AMBER)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, ankle, width=38, color=AMBER)
    draw_joint(draw, ankle, 16)
    draw_capsule(draw, ankle, toe, 24, AMBER)

    # Shoulder vs Pelvis horizontal comparison
    draw.line([(800, 1060), (1400, 1060)], fill=(71, 85, 105), width=2)
    draw.line([(800, 920), (1400, 920)], fill=EMERALD, width=2)

    draw_annotation_box(draw, hip, "骨盆前推高过肩线高度", direction='top-right', color=EMERALD)
    draw_annotation_box(draw, hand, "直臂后伸死扛全身重心", direction='left', color=PRIMARY_CYAN)
    draw_annotation_box(draw, ankle, "双腿反折过头如反曲神弓", direction='top-left', color=AMBER)

    save_and_downscale(im, "legRaise_demon_03.jpeg")

def gen_legRaise_demon_04():
    # 极端罗马椅悬空折叠 (Extreme Roman Chair Fold)
    im, draw = render_base_card("legRaise_demon_04")
    draw_floor(draw, y=1480)

    # Roman Chair structure
    # Ankle roller
    roller_x, roller_y = 1750, 1100
    draw.ellipse([(roller_x - 30, roller_y - 30), (roller_x + 30, roller_y + 30)], fill=(71, 85, 105), outline=BAR_HIGHLIGHT, width=4)
    # Thigh pad
    pad_x1, pad_y1, pad_x2, pad_y2 = 1350, 1160, 1600, 1240
    draw.rounded_rectangle([(pad_x1, pad_y1), (pad_x2, pad_y2)], radius=12, fill=(30, 41, 59), outline=BAR_HIGHLIGHT, width=4)
    # Chair frame stand
    draw.line([(1480, 1240), (1480, 1480)], fill=BAR_COLOR, width=24)
    draw.line([(1750, 1130), (1750, 1480)], fill=BAR_COLOR, width=20)

    # Lower body clamped on chair
    ankle = (roller_x, roller_y)
    knee = (1520, 1180)
    hip = (1350, 1180) # on edge of pad
    draw_limb(draw, ankle, knee, width=42)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, hip, width=46)
    draw_joint(draw, hip, 24)

    # Torso hanging backward into negative angle below horizontal!
    shoulder = (920, 1380)
    draw_limb(draw, hip, shoulder, width=54, color=AMBER)
    draw_joint(draw, shoulder, 24)

    # Head aligned
    head = (800, 1420)
    draw_head(draw, head, 50)
    draw_limb(draw, (860, 1400), shoulder, width=36)

    # Hands at temples
    elbow = (900, 1260)
    draw_limb(draw, shoulder, elbow, width=38)
    draw_joint(draw, elbow, 18)
    draw_limb(draw, elbow, (820, 1360), width=34)

    # Horizontal plane reference line
    draw.line([(600, 1180), (1800, 1180)], fill=(71, 85, 105), width=2)

    draw_annotation_box(draw, (920, 1380), "后仰下沉深超水平面", direction='bottom-left', color=AMBER)
    draw_annotation_box(draw, hip, "腹直肌极限离心全延展", direction='top-left', color=EMERALD)
    draw_annotation_box(draw, (roller_x, roller_y), "踝部死锁固定转轴", direction='top-right', color=PRIMARY_CYAN)

    save_and_downscale(im, "legRaise_demon_04.jpeg")

def gen_legRaise_demon_05():
    # 悬垂直举腿 50 次耐力挑战 (50-Rep Strict Hanging Leg Raise)
    im, draw = render_base_card("legRaise_demon_05")
    bar_y = 650
    draw_bar(draw, y=bar_y, x1=400, x2=2000)

    # Hands gripping bar
    hand = (950, bar_y)
    draw_capsule(draw, (hand[0] - 30, hand[1]), (hand[0] + 30, hand[1]), 28, BAR_HIGHLIGHT)

    # Vertical body down to hip
    shoulder = (950, 920)
    hip = (950, 1220)
    draw_limb(draw, hand, shoulder, width=42)
    draw_joint(draw, hand, 18)
    draw_joint(draw, shoulder, 24)

    head = (860, 900)
    draw_head(draw, head, 52)
    draw_limb(draw, (900, 910), shoulder, width=36)

    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    # Legs strictly horizontal at 90°
    knee = (1280, 1220)
    ankle = (1620, 1220)
    toe = (1720, 1220)
    draw_limb(draw, hip, knee, width=46)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, ankle, width=38)
    draw_joint(draw, ankle, 16)
    draw_capsule(draw, ankle, toe, 24, PRIMARY_CYAN)

    # 50 REPS Badge
    badge_x1, badge_y1, badge_x2, badge_y2 = 1350, 800, 1850, 940
    draw.rounded_rectangle([(badge_x1, badge_y1), (badge_x2, badge_y2)], radius=16, fill=(30, 41, 59), outline=EMERALD, width=3)
    draw.text((badge_x1 + 45, badge_y1 + 40), "50 REPS · 严格零摆荡", font=FONTS["title"], fill=EMERALD)

    # 90° guide line
    draw.line([(950, 1220), (1750, 1220)], fill=AMBER, width=3)

    draw_annotation_box(draw, hand, "抓握如钳 · 零前后秋千摆动", direction='top-left', color=PRIMARY_CYAN)
    draw_annotation_box(draw, knee, "双膝锁死 · 水平 90° 极致反复", direction='top', color=AMBER)
    draw_annotation_box(draw, (badge_x1 + 250, badge_y2), "前臂与腹直肌神级耐力", direction='bottom', color=EMERALD)

    save_and_downscale(im, "legRaise_demon_05.jpeg")

# ==================== BRIDGE DEMONS (1 - 5) ====================

def gen_bridge_demon_01():
    # 高位台阶跌落反推铁板桥 (Stand-to-Stand Bridge Drop)
    im, draw = render_base_card("bridge_demon_01")

    # Step on the left: Height difference 250px!
    step_y = 1180
    floor_y = 1420
    draw.rounded_rectangle([(240, step_y), (850, 1500)], radius=8, fill=(30, 41, 59), outline=BAR_HIGHLIGHT, width=4)
    draw.line([(240, step_y), (850, step_y)], fill=PRIMARY_CYAN, width=6)
    draw.line([(850, floor_y), (2160, floor_y)], fill=BAR_COLOR, width=16)
    draw.text((360, 1260), "HIGH STEP 25CM", font=FONTS["spec"], fill=BAR_HIGHLIGHT)

    # Feet on top of high step
    foot = (750, step_y)
    draw_capsule(draw, (foot[0] - 30, foot[1]), (foot[0] + 30, foot[1]), 26, BAR_HIGHLIGHT)
    knee = (850, 1050)
    hip = (1050, 920) # high arched pelvis

    draw_limb(draw, foot, knee, width=46)
    draw_joint(draw, knee, 22)
    draw_limb(draw, knee, hip, width=50)
    draw_joint(draw, hip, 24)

    # Hands planted on LOW FLOOR (huge drop-down depth!)
    hand = (1550, floor_y)
    draw_capsule(draw, (hand[0] - 35, hand[1]), (hand[0] + 35, hand[1]), 26, BAR_HIGHLIGHT)
    elbow = (1500, 1240)
    shoulder = (1380, 1050)

    draw_limb(draw, hand, elbow, width=40)
    draw_joint(draw, elbow, 20)
    draw_limb(draw, elbow, shoulder, width=44)
    draw_joint(draw, shoulder, 24)

    # Deep arched spine
    draw_limb(draw, shoulder, hip, width=54, color=AMBER)

    # Head looking back at hands
    head = (1380, 1160)
    draw_head(draw, head, 50)

    draw_annotation_box(draw, foot, "双脚立于高台阶边缘", direction='top-left', color=PRIMARY_CYAN)
    draw_annotation_box(draw, hip, "脊柱超深落差大拱形", direction='top', color=AMBER)
    draw_annotation_box(draw, hand, "双手落于低平地面成桥", direction='bottom-right', color=EMERALD)

    save_and_downscale(im, "bridge_demon_01.jpeg")

def gen_bridge_demon_02():
    # 倒立与铁桥动力转换 (Handstand Bridge Transitions)
    im, draw = render_base_card("bridge_demon_02")
    draw_floor(draw, y=1420)

    # Bridge stance with dynamic flow arrows to handstand
    hand = (950, 1420)
    foot = (1550, 1420)
    draw_capsule(draw, (hand[0] - 35, hand[1]), (hand[0] + 35, hand[1]), 26, BAR_HIGHLIGHT)
    draw_capsule(draw, (foot[0] - 35, foot[1]), (foot[0] + 35, foot[1]), 26, BAR_HIGHLIGHT)

    # Arched bridge
    shoulder = (1080, 1150)
    elbow = (1020, 1280)
    draw_limb(draw, hand, elbow, width=42)
    draw_joint(draw, elbow, 20)
    draw_limb(draw, elbow, shoulder, width=44)
    draw_joint(draw, shoulder, 24)

    hip = (1250, 960) # peak of arch
    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    knee = (1450, 1150)
    draw_limb(draw, hip, knee, width=48)
    draw_joint(draw, knee, 22)
    draw_limb(draw, knee, foot, width=44)

    head = (1120, 1240)
    draw_head(draw, head, 50)

    # Dynamic transition circular flow arc
    draw.arc([(1000, 600), (1600, 1200)], start=180, end=360, fill=EMERALD, width=5)
    # Handstand ghost trajectory
    draw.line([(1250, 960), (1250, 550)], fill=AMBER, width=4)
    draw.polygon([(1235, 570), (1265, 570), (1250, 520)], fill=AMBER)

    draw_annotation_box(draw, (1250, 520), "蹬地反弹回直立手倒立", direction='top', color=AMBER)
    draw_annotation_box(draw, hip, "腰背弹簧蓄力动力转换", direction='top-left', color=EMERALD)
    draw_annotation_box(draw, hand, "双手如基座死咬地面", direction='bottom-left', color=PRIMARY_CYAN)

    save_and_downscale(im, "bridge_demon_02.jpeg")

def gen_bridge_demon_03():
    # 瑜伽蝎子式桥 (Scorpion Bridge)
    im, draw = render_base_card("bridge_demon_03")
    draw_floor(draw, y=1420)

    # Forearms flat on floor (Forearm stand / elbow bridge)
    elbow = (1050, 1420)
    hand = (900, 1420)
    draw_capsule(draw, elbow, hand, 30, BAR_HIGHLIGHT)

    # Shoulder pushing forward past elbows
    shoulder = (1120, 1220)
    draw_limb(draw, elbow, shoulder, width=44)
    draw_joint(draw, elbow, 22)
    draw_joint(draw, shoulder, 24)

    # Head looking back/down
    head = (1000, 1260)
    draw_head(draw, head, 50)

    # Deep C-curve spine arch
    hip = (1280, 1020)
    draw_limb(draw, shoulder, hip, width=54, color=AMBER)
    draw_joint(draw, hip, 24)

    # Knees bent, feet curling forward to TOUCH THE TOP OF HEAD!
    knee = (1150, 960)
    ankle = (1020, 1180) # touching crown of head!
    draw_limb(draw, hip, knee, width=48, color=AMBER)
    draw_joint(draw, knee, 22)
    draw_limb(draw, knee, ankle, width=40, color=AMBER)
    draw_joint(draw, ankle, 18)
    draw_capsule(draw, ankle, (990, 1220), 24, AMBER)

    draw_annotation_box(draw, elbow, "双前臂全贴地肘倒立", direction='bottom-left', color=PRIMARY_CYAN)
    draw_annotation_box(draw, hip, "胸椎深弯 C 字大折叠", direction='top-right', color=EMERALD)
    draw_annotation_box(draw, ankle, "双足底紧扣头顶之巅", direction='top-left', color=AMBER)

    save_and_downscale(im, "bridge_demon_03.jpeg")

def gen_bridge_demon_04():
    # 蜥蜴铁桥 (Lizard Bridge)
    im, draw = render_base_card("bridge_demon_04")
    draw_floor(draw, y=1420)

    # Only TWO POINTS of contact: Left hand + Right foot!
    hand_sup = (900, 1420)
    foot_sup = (1500, 1420)
    draw_capsule(draw, (hand_sup[0] - 35, hand_sup[1]), (hand_sup[0] + 35, hand_sup[1]), 26, BAR_HIGHLIGHT)
    draw_capsule(draw, (foot_sup[0] - 35, foot_sup[1]), (foot_sup[0] + 35, foot_sup[1]), 26, BAR_HIGHLIGHT)

    # Shoulder and hip of arched bridge
    shoulder = (1020, 1180)
    hip = (1220, 1050)
    draw_limb(draw, hand_sup, shoulder, width=44)
    draw_joint(draw, hand_sup, 18)
    draw_joint(draw, shoulder, 24)

    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    draw_limb(draw, hip, (1380, 1220), width=48)
    draw_joint(draw, (1380, 1220), 22)
    draw_limb(draw, (1380, 1220), foot_sup, width=44)

    head = (1080, 1240)
    draw_head(draw, head, 50)

    # AIRBORNE OPPOSITE HAND: extended forward horizontally into air!
    hand_air = (620, 1100)
    draw_limb(draw, shoulder, hand_air, width=40, color=AMBER)
    draw_joint(draw, hand_air, 18)

    # AIRBORNE OPPOSITE LEG: extended backward horizontally into air!
    ankle_air = (1850, 1100)
    draw_limb(draw, hip, (1550, 1080), width=44, color=AMBER)
    draw_joint(draw, (1550, 1080), 20)
    draw_limb(draw, (1550, 1080), ankle_air, width=38, color=AMBER)
    draw_joint(draw, ankle_air, 16)
    draw_capsule(draw, ankle_air, (1930, 1100), 24, AMBER)

    draw_annotation_box(draw, hand_air, "一臂向前水平平伸悬空", direction='top-left', color=AMBER)
    draw_annotation_box(draw, ankle_air, "对角腿向后水平平伸悬空", direction='top-right', color=AMBER)
    draw_annotation_box(draw, hip, "对角两点撑桥 · 核心抗侧翻", direction='top', color=EMERALD)

    save_and_downscale(im, "bridge_demon_04.jpeg")

def gen_bridge_demon_05():
    # 老派负重铁板桥 (Weighted Stand-to-Stand Bridge)
    im, draw = render_base_card("bridge_demon_05")
    draw_floor(draw, y=1420)

    # Four point solid bridge base
    hand = (900, 1420)
    foot = (1500, 1420)
    draw_capsule(draw, (hand[0] - 35, hand[1]), (hand[0] + 35, hand[1]), 26, BAR_HIGHLIGHT)
    draw_capsule(draw, (foot[0] - 35, foot[1]), (foot[0] + 35, foot[1]), 26, BAR_HIGHLIGHT)

    shoulder = (1020, 1200)
    hip = (1200, 1050) # high arched pelvis

    draw_limb(draw, hand, shoulder, width=44)
    draw_joint(draw, hand, 18)
    draw_joint(draw, shoulder, 24)

    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    knee = (1380, 1220)
    draw_limb(draw, hip, knee, width=48)
    draw_joint(draw, knee, 22)
    draw_limb(draw, knee, foot, width=44)

    head = (1080, 1260)
    draw_head(draw, head, 50)

    # HEAVY WEIGHT PLATE on pelvis arch
    draw_weight_plate(draw, center=(1200, 950), r=115, label="50 KG")

    draw_annotation_box(draw, (1200, 800), "腹部负重 50KG 铸铁负荷", direction='top', color=AMBER)
    draw_annotation_box(draw, hip, "脊柱起重机般深拱顶起", direction='bottom-right', color=EMERALD)
    draw_annotation_box(draw, hand, "四柱协同承载数千牛顿力矩", direction='left', color=PRIMARY_CYAN)

    save_and_downscale(im, "bridge_demon_05.jpeg")

# ==================== HSPU DEMONS (1 - 5) ====================

def gen_hspu_demon_01():
    # 自由平衡单臂倒立撑 (Freestanding One-Arm HSPU)
    im, draw = render_base_card("hspu_demon_01")
    draw_floor(draw, y=1450)

    # Single supporting hand on floor (zero walls!)
    hand = (1200, 1450)
    draw_capsule(draw, (hand[0] - 35, hand[1]), (hand[0] + 35, hand[1]), 28, BAR_HIGHLIGHT)

    # Arm bent ~45° dip depth
    elbow = (1180, 1300)
    shoulder = (1200, 1140)
    draw_limb(draw, hand, elbow, width=44)
    draw_joint(draw, hand, 18)
    draw_joint(draw, elbow, 22)
    draw_limb(draw, elbow, shoulder, width=46)
    draw_joint(draw, shoulder, 26)

    # Head focused on single hand
    head = (1120, 1240)
    draw_head(draw, head, 50)

    # Other arm out in air for tight balance
    hand_free = (1420, 1180)
    draw_limb(draw, shoulder, hand_free, width=38)
    draw_joint(draw, hand_free, 16)

    # Torso inverted with slight curve for balance
    hip = (1180, 840)
    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    # Legs straddled in V shape for tight balance bar
    knee_l = (1040, 620)
    ankle_l = (950, 440)
    draw_limb(draw, hip, knee_l, width=44)
    draw_joint(draw, knee_l, 20)
    draw_limb(draw, knee_l, ankle_l, width=38)
    draw_joint(draw, ankle_l, 16)
    draw_capsule(draw, ankle_l, (920, 390), 24, PRIMARY_CYAN)

    knee_r = (1300, 620)
    ankle_r = (1380, 440)
    draw_limb(draw, hip, knee_r, width=44)
    draw_joint(draw, knee_r, 20)
    draw_limb(draw, knee_r, ankle_r, width=38)
    draw_joint(draw, ankle_r, 16)
    draw_capsule(draw, ankle_r, (1410, 390), 24, PRIMARY_CYAN)

    draw_annotation_box(draw, hand, "单手鹰爪死扣地面 · 零墙壁依托", direction='bottom-left', color=RED)
    draw_annotation_box(draw, elbow, "单侧三角肌推升自重", direction='left', color=PRIMARY_CYAN)
    draw_annotation_box(draw, (1165, 440), "双腿 V 形张开充当平衡杆", direction='top', color=EMERALD)

    save_and_downscale(im, "hspu_demon_01.jpeg")

def gen_hspu_demon_02():
    # 虎立倒立臂屈伸 (Tiger Bend Push-up)
    im, draw = render_base_card("hspu_demon_02")
    draw_floor(draw, y=1450)

    # Forearms flat on floor (Tiger Bend lowest position)
    elbow = (1220, 1450)
    hand = (1060, 1450)
    draw_capsule(draw, elbow, hand, 30, BAR_HIGHLIGHT)

    # Upper arms vertical up from elbows
    shoulder = (1220, 1200)
    draw_limb(draw, elbow, shoulder, width=44, color=AMBER)
    draw_joint(draw, elbow, 22)
    draw_joint(draw, shoulder, 24)

    # Head tucked between arms
    head = (1120, 1340)
    draw_head(draw, head, 50)

    # Inverted vertical torso & legs
    hip = (1220, 880)
    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    knee = (1220, 620)
    ankle = (1220, 420)
    draw_limb(draw, hip, knee, width=46)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, ankle, width=38)
    draw_joint(draw, ankle, 16)
    draw_capsule(draw, ankle, (1220, 360), 24, PRIMARY_CYAN)

    # Explosive triceps transition arrow from elbow to hand
    draw.line([(1220, 1350), (1060, 1350)], fill=EMERALD, width=4)
    draw.polygon([(1080, 1340), (1080, 1360), (1050, 1350)], fill=EMERALD)

    draw_annotation_box(draw, (1140, 1450), "双前臂全贴地猫爪卧倒", direction='bottom', color=PRIMARY_CYAN)
    draw_annotation_box(draw, (1220, 1200), "肱三头肌钛合金向心爆发", direction='right', color=AMBER)
    draw_annotation_box(draw, (1220, 620), "由手肘瞬间反弹回手掌倒立", direction='top-right', color=EMERALD)

    save_and_downscale(im, "hspu_demon_02.jpeg")

def gen_hspu_demon_03():
    # 双手倒立行走上下台阶 (Stair Handstand Walk)
    im, draw = render_base_card("hspu_demon_03")

    # 3-step stairs
    # Step 1: x 400-900, y=1450
    # Step 2: x 900-1400, y=1300
    # Step 3: x 1400-2000, y=1150
    draw.line([(400, 1450), (900, 1450)], fill=BAR_COLOR, width=16)
    draw.line([(900, 1450), (900, 1300)], fill=BAR_COLOR, width=16)
    draw.line([(900, 1300), (1400, 1300)], fill=BAR_COLOR, width=16)
    draw.line([(1400, 1300), (1400, 1150)], fill=BAR_COLOR, width=16)
    draw.line([(1400, 1150), (2000, 1150)], fill=BAR_COLOR, width=16)

    # Highlight step edges
    draw.line([(900, 1300), (1400, 1300)], fill=PRIMARY_CYAN, width=4)
    draw.line([(1400, 1150), (2000, 1150)], fill=PRIMARY_CYAN, width=4)

    # Hand 1 on Step 2 (supporting)
    hand1 = (1150, 1300)
    draw_capsule(draw, (hand1[0] - 30, hand1[1]), (hand1[0] + 30, hand1[1]), 26, BAR_HIGHLIGHT)

    # Hand 2 reaching up to Step 3!
    hand2 = (1550, 1150)
    draw_capsule(draw, (hand2[0] - 30, hand2[1]), (hand2[0] + 30, hand2[1]), 26, BAR_HIGHLIGHT)

    shoulder = (1350, 950)
    draw_limb(draw, hand1, shoulder, width=42)
    draw_joint(draw, hand1, 18)
    draw_limb(draw, hand2, shoulder, width=42, color=AMBER)
    draw_joint(draw, hand2, 18)
    draw_joint(draw, shoulder, 24)

    head = (1300, 1020)
    draw_head(draw, head, 50)

    # Inverted body angled forward as ascending stairs
    hip = (1400, 680)
    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    knee = (1450, 480)
    ankle = (1480, 320)
    draw_limb(draw, hip, knee, width=46)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, ankle, width=38)
    draw_joint(draw, ankle, 16)
    draw_capsule(draw, ankle, (1500, 270), 24, PRIMARY_CYAN)

    draw_annotation_box(draw, hand2, "单手向上探迈踏上台阶", direction='top-right', color=AMBER)
    draw_annotation_box(draw, shoulder, "肩带动态吸收落差冲击", direction='top-left', color=PRIMARY_CYAN)
    draw_annotation_box(draw, (1480, 320), "倒立中轴随阶梯稳健攀升", direction='left', color=EMERALD)

    save_and_downscale(im, "hspu_demon_03.jpeg")

def gen_hspu_demon_04():
    # 双杠超深自由倒立撑 (Parallettes Deep Freestanding HSPU)
    im, draw = render_base_card("hspu_demon_04")

    # Parallettes bars (height y=1100)
    bar_y = 1100
    draw.line([(800, bar_y), (1600, bar_y)], fill=BAR_COLOR, width=28)
    draw.line([(800, bar_y - 6), (1600, bar_y - 6)], fill=BAR_HIGHLIGHT, width=8)
    draw.line([(950, bar_y), (950, 1500)], fill=BAR_COLOR, width=24)
    draw.line([(1450, bar_y), (1450, 1500)], fill=BAR_COLOR, width=24)

    # Hands gripping bars
    hand1 = (1050, bar_y)
    hand2 = (1350, bar_y)
    draw_capsule(draw, (hand1[0] - 25, hand1[1]), (hand1[0] + 25, hand1[1]), 28, BAR_HIGHLIGHT)
    draw_capsule(draw, (hand2[0] - 25, hand2[1]), (hand2[0] + 25, hand2[1]), 28, BAR_HIGHLIGHT)

    # ELBOWS BENT DEEPLY UPWARD! Shoulders and head dropped FAR BELOW bar line!
    elbow1 = (920, 960)
    elbow2 = (1480, 960)
    shoulder = (1200, 1180) # deep below bar!
    head = (1200, 1280)     # head dropped deep below bar line!

    draw_limb(draw, hand1, elbow1, width=42)
    draw_joint(draw, elbow1, 22)
    draw_limb(draw, elbow1, shoulder, width=42)

    draw_limb(draw, hand2, elbow2, width=42)
    draw_joint(draw, elbow2, 22)
    draw_limb(draw, elbow2, shoulder, width=42)
    draw_joint(draw, shoulder, 26)

    # Head deep down
    draw_head(draw, head, 50)

    # Inverted vertical body
    hip = (1200, 850)
    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    knee = (1200, 600)
    ankle = (1200, 380)
    draw_limb(draw, hip, knee, width=46)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, ankle, width=38)
    draw_joint(draw, ankle, 16)
    draw_capsule(draw, ankle, (1200, 320), 24, PRIMARY_CYAN)

    # Depth reference line
    draw.line([(750, bar_y), (1650, bar_y)], fill=(71, 85, 105), width=2)
    draw.line([(1200, bar_y), (1200, 1280)], fill=AMBER, width=4)

    draw_annotation_box(draw, head, "头部深深穿透双杠平面", direction='bottom', color=AMBER)
    draw_annotation_box(draw, (920, 960), "超深全幅度垂直推力极限", direction='top-left', color=EMERALD)
    draw_annotation_box(draw, (1200, 380), "双杠自由平衡 · 零触墙依赖", direction='top-right', color=PRIMARY_CYAN)

    save_and_downscale(im, "hspu_demon_04.jpeg")

def gen_hspu_demon_05():
    # 不平衡高低物体单臂倒立 (Uneven Object One-Arm Handstand)
    im, draw = render_base_card("hspu_demon_05")
    floor_y = 1450
    draw_floor(draw, y=floor_y)

    # Uneven object on left (block/box height 200px)
    box_x1, box_y1, box_x2, box_y2 = 800, 1250, 1200, floor_y
    draw.rounded_rectangle([(box_x1, box_y1), (box_x2, box_y2)], radius=10, fill=(30, 41, 59), outline=BAR_HIGHLIGHT, width=4)
    draw.line([(box_x1, box_y1 + 8), (box_x2, box_y1 + 8)], fill=PRIMARY_CYAN, width=4)
    draw.text((880, 1360), "STEP BLOCK", font=FONTS["spec"], fill=BAR_HIGHLIGHT)

    # Single supporting hand planted on edge of the high block!
    hand = (1120, 1250)
    draw_capsule(draw, (hand[0] - 30, hand[1]), (hand[0] + 30, hand[1]), 26, BAR_HIGHLIGHT)

    shoulder = (1180, 980)
    draw_limb(draw, hand, shoulder, width=44)
    draw_joint(draw, hand, 18)
    draw_joint(draw, shoulder, 24)

    head = (1120, 1080)
    draw_head(draw, head, 50)

    # Other arm floating in air
    hand_free = (1380, 1050)
    draw_limb(draw, shoulder, hand_free, width=38)
    draw_joint(draw, hand_free, 16)

    # Inverted vertical body
    hip = (1200, 720)
    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    knee = (1220, 480)
    ankle = (1240, 280)
    draw_limb(draw, hip, knee, width=46)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, ankle, width=38)
    draw_joint(draw, ankle, 16)
    draw_capsule(draw, ankle, (1250, 220), 24, PRIMARY_CYAN)

    draw_annotation_box(draw, hand, "高低落差边缘单手死扣", direction='left', color=RED)
    draw_annotation_box(draw, shoulder, "极度失衡支点维持倒立", direction='top-left', color=AMBER)
    draw_annotation_box(draw, (1240, 280), "神经系统毫秒级微调平衡", direction='right', color=EMERALD)

    save_and_downscale(im, "hspu_demon_05.jpeg")

def generate_part2():
    print("Generating Part 2 (15 exercises)...")
    gen_legRaise_demon_01()
    gen_legRaise_demon_02()
    gen_legRaise_demon_03()
    gen_legRaise_demon_04()
    gen_legRaise_demon_05()

    gen_bridge_demon_01()
    gen_bridge_demon_02()
    gen_bridge_demon_03()
    gen_bridge_demon_04()
    gen_bridge_demon_05()

    gen_hspu_demon_01()
    gen_hspu_demon_02()
    gen_hspu_demon_03()
    gen_hspu_demon_04()
    gen_hspu_demon_05()
    print("Part 2 generation complete!")

if __name__ == "__main__":
    generate_part2()
