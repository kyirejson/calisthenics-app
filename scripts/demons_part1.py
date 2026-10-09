# -*- coding: utf-8 -*-
"""
Demon Exercises Graphics Part 1: Push (1-6), Squat (1-6), Pull (1-6)
Total: 18 exercises.
"""
from demons_common import (
    render_base_card, save_and_downscale, draw_floor, draw_bar, draw_rings,
    draw_limb, draw_joint, draw_head, draw_capsule, draw_annotation_box,
    draw_weight_plate, draw_kettlebell, FONTS,
    PRIMARY_CYAN, CORE_WHITE, EMERALD, AMBER, PURPLE, RED, BAR_COLOR, BAR_HIGHLIGHT
)

# ==================== PUSH DEMONS (1 - 6) ====================

def gen_push_demon_01():
    # 单臂击掌俯卧撑 (One-Arm Clapping Push-up)
    im, draw = render_base_card("push_demon_01")
    draw_floor(draw, y=1420)

    # Torso in mid-air explosive ascent (angled up ~20°)
    shoulder = (900, 980)
    hip = (1450, 1120)
    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    # Head
    head = (760, 920)
    draw_head(draw, head, 52)
    draw_limb(draw, (810, 940), shoulder, width=36)

    # Legs: wide stance on toes
    knee1 = (1750, 1260)
    ankle1 = (2020, 1400)
    draw_limb(draw, hip, knee1, width=44)
    draw_joint(draw, knee1, 20)
    draw_limb(draw, knee1, ankle1, width=38)
    draw_joint(draw, ankle1, 16)
    draw_capsule(draw, ankle1, (2070, 1420), 24, PRIMARY_CYAN)

    # Arms clapping in mid air in front of chest
    clap_pt = (920, 1180)
    # Right arm (explosive pushing arm)
    elbow_r = (800, 1100)
    draw_limb(draw, shoulder, elbow_r, width=42)
    draw_joint(draw, elbow_r, 20)
    draw_limb(draw, elbow_r, clap_pt, width=36)

    # Left arm (snapped from back to clap)
    elbow_l = (1040, 1100)
    draw_limb(draw, shoulder, elbow_l, width=38)
    draw_joint(draw, elbow_l, 18)
    draw_limb(draw, elbow_l, clap_pt, width=34)

    # Clapping burst fx
    draw.ellipse([(clap_pt[0] - 30, clap_pt[1] - 30), (clap_pt[0] + 30, clap_pt[1] + 30)], outline=AMBER, width=4)
    draw.ellipse([(clap_pt[0] - 15, clap_pt[1] - 15), (clap_pt[0] + 15, clap_pt[1] + 15)], fill=CORE_WHITE)

    # Ascending explosive arrow
    draw.line([(900, 1340), (900, 1080)], fill=EMERALD, width=5)
    draw.polygon([(885, 1100), (915, 1100), (900, 1050)], fill=EMERALD)

    draw_annotation_box(draw, (900, 980), "单臂暴推腾空", direction='top-left', color=EMERALD)
    draw_annotation_box(draw, clap_pt, "胸前凌空闪电击掌", direction='bottom', color=AMBER)
    draw_annotation_box(draw, (1750, 1260), "双足三角稳固底座", direction='top-right', color=PRIMARY_CYAN)

    save_and_downscale(im, "push_demon_01.jpeg")

def gen_push_demon_02():
    # 蜥蜴俯卧撑 (Lizard Push-up / Diagonal Two-Point)
    im, draw = render_base_card("push_demon_02")
    draw_floor(draw, y=1380)

    # Torso low, parallel to ground
    shoulder = (860, 1180)
    hip = (1380, 1180)
    draw_limb(draw, shoulder, hip, width=52)
    draw_joint(draw, hip, 24)

    # Head
    head = (720, 1180)
    draw_head(draw, head, 50)
    draw_limb(draw, (770, 1180), shoulder, width=36)

    # Supporting arm (Left): hand on floor, elbow bent ~90°
    hand_sup = (860, 1380)
    elbow_sup = (820, 1280)
    draw_capsule(draw, (hand_sup[0] - 30, hand_sup[1]), (hand_sup[0] + 30, hand_sup[1]), 24, BAR_HIGHLIGHT)
    draw_limb(draw, shoulder, elbow_sup, width=42)
    draw_joint(draw, elbow_sup, 20)
    draw_limb(draw, elbow_sup, hand_sup, width=38)
    draw_joint(draw, hand_sup, 16)

    # Airborne forward arm (Right): fully extended forward in mid-air
    hand_air = (420, 1180)
    draw_limb(draw, shoulder, hand_air, width=38, color=AMBER)
    draw_joint(draw, hand_air, 18)

    # Supporting leg (Right): toe on floor
    knee_sup = (1680, 1270)
    ankle_sup = (1960, 1360)
    draw_limb(draw, hip, knee_sup, width=44)
    draw_joint(draw, knee_sup, 20)
    draw_limb(draw, knee_sup, ankle_sup, width=38)
    draw_joint(draw, ankle_sup, 16)
    draw_capsule(draw, ankle_sup, (2020, 1380), 24, PRIMARY_CYAN)

    # Airborne rear leg (Left): locked straight up in air
    knee_air = (1750, 1020)
    ankle_air = (2100, 880)
    toe_air = (2200, 840)
    draw_limb(draw, hip, knee_air, width=44, color=AMBER)
    draw_joint(draw, knee_air, 20)
    draw_limb(draw, knee_air, ankle_air, width=38, color=AMBER)
    draw_joint(draw, ankle_air, 16)
    draw_capsule(draw, ankle_air, toe_air, 24, AMBER)

    draw_annotation_box(draw, hand_air, "前臂完全水平前刺悬空", direction='top-left', color=AMBER)
    draw_annotation_box(draw, (820, 1280), "单肘 90° 液压承载", direction='left', color=PRIMARY_CYAN)
    draw_annotation_box(draw, ankle_air, "后腿向后上方极度挑起", direction='top-right', color=AMBER)

    save_and_downscale(im, "push_demon_02.jpeg")

def gen_push_demon_03():
    # 老派负重单臂俯卧撑 (Weighted One-Arm Push-up)
    im, draw = render_base_card("push_demon_03")
    draw_floor(draw, y=1380)

    # Torso angled down
    shoulder = (900, 1140)
    hip = (1450, 1180)
    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    # Head
    head = (760, 1100)
    draw_head(draw, head, 50)
    draw_limb(draw, (810, 1120), shoulder, width=36)

    # Supporting arm on floor (flexed ~45°)
    hand = (900, 1380)
    elbow = (840, 1260)
    draw_capsule(draw, (hand[0] - 35, hand[1]), (hand[0] + 35, hand[1]), 26, BAR_HIGHLIGHT)
    draw_limb(draw, shoulder, elbow, width=44)
    draw_joint(draw, elbow, 22)
    draw_limb(draw, elbow, hand, width=40)
    draw_joint(draw, hand, 18)

    # Arm folded behind back holding dumbbell/handle
    elbow_back = (1250, 1000)
    hand_back = (1180, 1050)
    draw_limb(draw, shoulder, elbow_back, width=36)
    draw_joint(draw, elbow_back, 18)
    draw_limb(draw, elbow_back, hand_back, width=32)

    # Weight plate on back
    draw_weight_plate(draw, center=(1180, 1040), r=110, label="25 KG")

    # Legs straight back
    knee = (1750, 1270)
    ankle = (2050, 1360)
    draw_limb(draw, hip, knee, width=44)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, ankle, width=38)
    draw_joint(draw, ankle, 16)
    draw_capsule(draw, ankle, (2110, 1380), 24, PRIMARY_CYAN)

    draw_annotation_box(draw, (1180, 920), "背负 25KG 铸铁负重", direction='top', color=AMBER)
    draw_annotation_box(draw, elbow, "单臂纯力量推升", direction='left', color=PRIMARY_CYAN)
    draw_annotation_box(draw, (1750, 1270), "核心锁死抗剧烈翻转", direction='bottom-right', color=EMERALD)

    save_and_downscale(im, "push_demon_03.jpeg")

def gen_push_demon_04():
    # 超人俯卧撑 (Superman Push-up)
    im, draw = render_base_card("push_demon_04")
    draw_floor(draw, y=1380)

    # Arms placed FAR in front past head
    hand = (500, 1380)
    shoulder = (980, 1260)
    draw_capsule(draw, (hand[0] - 30, hand[1]), (hand[0] + 30, hand[1]), 24, BAR_HIGHLIGHT)
    draw_limb(draw, shoulder, hand, width=42)  # fully extended forward
    draw_joint(draw, shoulder, 24)
    draw_joint(draw, hand, 18)

    # Head tucked between arms
    head = (860, 1200)
    draw_head(draw, head, 48)

    # Torso completely straight and rigid
    hip = (1500, 1260)
    draw_limb(draw, shoulder, hip, width=52)
    draw_joint(draw, hip, 24)

    # Legs fully locked straight, feet together
    knee = (1850, 1310)
    ankle = (2120, 1360)
    draw_limb(draw, hip, knee, width=44)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, ankle, width=38)
    draw_joint(draw, ankle, 16)
    draw_capsule(draw, ankle, (2180, 1380), 24, PRIMARY_CYAN)

    # Lever dimension lines
    draw.line([(500, 1140), (980, 1140)], fill=AMBER, width=3)
    draw.line([(500, 1120), (500, 1160)], fill=AMBER, width=3)
    draw.line([(980, 1120), (980, 1160)], fill=AMBER, width=3)

    draw_annotation_box(draw, (740, 1140), "极限超头长力臂 (Long Lever)", direction='top', color=AMBER)
    draw_annotation_box(draw, (1240, 1260), "骨盆后倾 · 核心如钢板", direction='top', color=EMERALD)
    draw_annotation_box(draw, (1850, 1310), "膝踝锁死 · 双足扣地", direction='bottom-right', color=PRIMARY_CYAN)

    save_and_downscale(im, "push_demon_04.jpeg")

def gen_push_demon_05():
    # 单臂双杠屈臂撑 (One-Arm Dips)
    im, draw = render_base_card("push_demon_05")

    # Parallel bar
    bar_y = 960
    draw.line([(700, bar_y), (1700, bar_y)], fill=BAR_COLOR, width=28)
    draw.line([(700, bar_y - 6), (1700, bar_y - 6)], fill=BAR_HIGHLIGHT, width=8)
    # Vertical post
    draw.line([(1600, bar_y), (1600, 1500)], fill=BAR_COLOR, width=24)

    # Single supporting hand on bar
    hand = (1100, bar_y)
    draw_capsule(draw, (hand[0] - 30, hand[1]), (hand[0] + 30, hand[1]), 28, BAR_HIGHLIGHT)

    # Arm bent to ~90° dip depth
    elbow = (1020, 1120)
    shoulder = (1120, 880)
    draw_limb(draw, shoulder, elbow, width=44)
    draw_joint(draw, elbow, 22)
    draw_limb(draw, elbow, hand, width=40)
    draw_joint(draw, hand, 18)
    draw_joint(draw, shoulder, 24)

    # Head
    head = (1040, 780)
    draw_head(draw, head, 52)
    draw_limb(draw, (1080, 820), shoulder, width=36)

    # Torso leaning slightly forward
    hip = (1220, 1220)
    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    # Other arm behind back
    elbow_l = (1260, 1020)
    hand_l = (1220, 1100)
    draw_limb(draw, shoulder, elbow_l, width=36)
    draw_joint(draw, elbow_l, 18)
    draw_limb(draw, elbow_l, hand_l, width=32)

    # Suspended legs hanging down
    knee = (1260, 1450)
    ankle = (1300, 1650)
    draw_limb(draw, hip, knee, width=44)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, ankle, width=38)
    draw_joint(draw, ankle, 16)
    draw_capsule(draw, ankle, (1320, 1700), 24, PRIMARY_CYAN)

    draw_annotation_box(draw, hand, "单手死锁单侧横杠", direction='top-right', color=AMBER)
    draw_annotation_box(draw, elbow, "90° 极限全深下潜", direction='left', color=EMERALD)
    draw_annotation_box(draw, (1260, 1450), "双腿离地悬空锁死", direction='right', color=PRIMARY_CYAN)

    save_and_downscale(im, "push_demon_05.jpeg")

def gen_push_demon_06():
    # 行走俯卧撑 (Walking Push-up)
    im, draw = render_base_card("push_demon_06")
    draw_floor(draw, y=1380)

    # Asymmetric staggered push-up: Front hand vs Back hand
    hand_fwd = (650, 1380)   # forward 15cm
    hand_back = (1050, 1380) # back under chest

    draw_capsule(draw, (hand_fwd[0] - 30, hand_fwd[1]), (hand_fwd[0] + 30, hand_fwd[1]), 24, BAR_HIGHLIGHT)
    draw_capsule(draw, (hand_back[0] - 30, hand_back[1]), (hand_back[0] + 30, hand_back[1]), 24, BAR_HIGHLIGHT)

    shoulder = (850, 1180)
    # Front arm reaching forward
    elbow_fwd = (750, 1280)
    draw_limb(draw, shoulder, elbow_fwd, width=40)
    draw_joint(draw, elbow_fwd, 20)
    draw_limb(draw, elbow_fwd, hand_fwd, width=36)
    draw_joint(draw, hand_fwd, 16)

    # Back arm under rib
    elbow_back = (950, 1260)
    draw_limb(draw, shoulder, elbow_back, width=42)
    draw_joint(draw, elbow_back, 20)
    draw_limb(draw, elbow_back, hand_back, width=38)
    draw_joint(draw, hand_back, 16)

    # Head
    head = (720, 1140)
    draw_head(draw, head, 50)
    draw_limb(draw, (770, 1160), shoulder, width=36)

    # Torso
    hip = (1400, 1220)
    draw_limb(draw, shoulder, hip, width=52)
    draw_joint(draw, hip, 24)

    # Legs trailing
    knee = (1750, 1290)
    ankle = (2050, 1360)
    draw_limb(draw, hip, knee, width=44)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, ankle, width=38)
    draw_joint(draw, ankle, 16)
    draw_capsule(draw, ankle, (2110, 1380), 24, PRIMARY_CYAN)

    # Forward stride arrows on floor
    draw.line([(1050, 1420), (650, 1420)], fill=AMBER, width=4)
    draw.polygon([(650, 1410), (650, 1430), (620, 1420)], fill=AMBER)

    draw_annotation_box(draw, hand_fwd, "前手迈出 15cm 错位下潜", direction='top-left', color=AMBER)
    draw_annotation_box(draw, (850, 1180), "非对称重心负荷转移", direction='top', color=PRIMARY_CYAN)
    draw_annotation_box(draw, (1400, 1220), "核心履带式平稳跟进", direction='top-right', color=EMERALD)

    save_and_downscale(im, "push_demon_06.jpeg")

# ==================== SQUAT DEMONS (1 - 6) ====================

def gen_squat_demon_01():
    # 单腿跳箱深蹲 (One-Leg Box Jump Squat)
    im, draw = render_base_card("squat_demon_01")
    draw_floor(draw, y=1420, x1=240, x2=1500)

    # Plyometric Box on right side
    box_x1, box_y1, box_x2, box_y2 = 1450, 1020, 2150, 1420
    draw.rounded_rectangle([(box_x1, box_y1), (box_x2, box_y2)], radius=12, fill=(30, 41, 59), outline=BAR_HIGHLIGHT, width=4)
    draw.line([(box_x1, box_y1 + 10), (box_x2, box_y1 + 10)], fill=PRIMARY_CYAN, width=4)
    draw.text((1720, 1200), "PLYO BOX 45CM", font=FONTS["spec"], fill=BAR_HIGHLIGHT)

    # Person landing/absorbing on single leg on box surface
    foot = (1750, 1020)
    knee = (1680, 880)
    hip = (1800, 800)
    shoulder = (1750, 560)
    head = (1740, 440)

    # Foot base
    draw_capsule(draw, (foot[0] - 35, foot[1]), (foot[0] + 35, foot[1]), 26, BAR_HIGHLIGHT)
    # Absorbing leg (deep flex ~90°)
    draw_limb(draw, hip, knee, width=48)
    draw_joint(draw, knee, 22)
    draw_limb(draw, knee, foot, width=42)
    draw_joint(draw, foot, 18)

    # Free leg extended forward in air
    knee_free = (1560, 860)
    ankle_free = (1380, 860)
    draw_limb(draw, hip, knee_free, width=44, color=AMBER)
    draw_joint(draw, knee_free, 20)
    draw_limb(draw, knee_free, ankle_free, width=38, color=AMBER)
    draw_joint(draw, ankle_free, 16)
    draw_capsule(draw, ankle_free, (1320, 860), 24, AMBER)

    # Torso & Head
    draw_limb(draw, hip, shoulder, width=52)
    draw_joint(draw, hip, 24)
    draw_joint(draw, shoulder, 22)
    draw_head(draw, head, 50)
    draw_limb(draw, (1740, 500), shoulder, width=36)

    # Arms forward for balance
    hand_f = (1500, 620)
    draw_limb(draw, shoulder, hand_f, width=38)
    draw_joint(draw, hand_f, 16)

    # Arc trajectory from ground to box
    # draw curve points
    arc_pts = [(700, 1380), (1050, 850), (1450, 800), (1750, 1020)]
    for i in range(len(arc_pts) - 1):
        draw.line([arc_pts[i], arc_pts[i+1]], fill=EMERALD, width=4)

    draw_annotation_box(draw, (700, 1300), "单腿深蹲底端暴跳", direction='top-left', color=EMERALD)
    draw_annotation_box(draw, foot, "单腿落箱柔顺吸震", direction='bottom', color=AMBER)
    draw_annotation_box(draw, ankle_free, "悬空腿零触箱锁直", direction='top-left', color=AMBER)

    save_and_downscale(im, "squat_demon_01.jpeg")

def gen_squat_demon_02():
    # 老派负重单腿蹲 (Weighted Pistol Squat)
    im, draw = render_base_card("squat_demon_02")
    draw_floor(draw, y=1420)

    # Supporting leg: full deep pistol compression
    foot = (1300, 1420)
    knee = (1120, 1260) # pressed forward
    hip = (1380, 1260)  # sitting on heel
    draw_capsule(draw, (foot[0] - 40, foot[1]), (foot[0] + 40, foot[1]), 28, BAR_HIGHLIGHT)
    draw_limb(draw, hip, knee, width=48)
    draw_joint(draw, knee, 24)
    draw_limb(draw, knee, foot, width=44)
    draw_joint(draw, foot, 20)

    # Free leg: straight out horizontally
    knee_f = (950, 1260)
    ankle_f = (650, 1260)
    toe_f = (550, 1260)
    draw_limb(draw, hip, knee_f, width=44)
    draw_joint(draw, knee_f, 20)
    draw_limb(draw, knee_f, ankle_f, width=38)
    draw_joint(draw, ankle_f, 16)
    draw_capsule(draw, ankle_f, toe_f, 24, PRIMARY_CYAN)

    # Torso upright
    shoulder = (1340, 850)
    draw_limb(draw, hip, shoulder, width=54)
    draw_joint(draw, hip, 24)
    draw_joint(draw, shoulder, 24)

    # Head
    head = (1340, 720)
    draw_head(draw, head, 52)
    draw_limb(draw, (1340, 780), shoulder, width=36)

    # Arms hugging heavy kettlebell at chest
    elbow = (1180, 940)
    draw_limb(draw, shoulder, elbow, width=40)
    draw_joint(draw, elbow, 20)
    draw_limb(draw, elbow, (1240, 920), width=36)

    # Heavy Kettlebell held at chest
    draw_kettlebell(draw, center=(1220, 920), r=85, label="32 KG")

    draw_annotation_box(draw, (1220, 800), "胸前死抱 32KG 铸铁壶铃", direction='top-left', color=AMBER)
    draw_annotation_box(draw, knee, "大腿深压小腿 · 极限屈曲", direction='left', color=PRIMARY_CYAN)
    draw_annotation_box(draw, ankle_f, "伸展腿水平 0° 绝对锁死", direction='top-left', color=EMERALD)

    save_and_downscale(im, "squat_demon_02.jpeg")

def gen_squat_demon_03():
    # 虾式深蹲 (Shrimp Squat / Airborne Squat)
    im, draw = render_base_card("squat_demon_03")
    draw_floor(draw, y=1420)

    # Front standing leg: bent in deep squat
    foot_f = (1080, 1420)
    knee_f = (950, 1250)
    hip = (1150, 1080)
    draw_capsule(draw, (foot_f[0] - 40, foot_f[1]), (foot_f[0] + 40, foot_f[1]), 28, BAR_HIGHLIGHT)
    draw_limb(draw, hip, knee_f, width=48)
    draw_joint(draw, knee_f, 22)
    draw_limb(draw, knee_f, foot_f, width=42)
    draw_joint(draw, foot_f, 18)

    # Rear leg: knee touch floor lightly! Foot folded up against glutes!
    knee_rear = (1420, 1400) # light touch floor
    ankle_rear = (1400, 1140) # pulled right up to hip
    draw_limb(draw, hip, knee_rear, width=46, color=AMBER)
    draw_joint(draw, knee_rear, 20)
    draw_limb(draw, knee_rear, ankle_rear, width=40, color=AMBER)
    draw_joint(draw, ankle_rear, 18)

    # Torso
    shoulder = (1080, 780)
    draw_limb(draw, hip, shoulder, width=52)
    draw_joint(draw, hip, 24)
    draw_joint(draw, shoulder, 24)

    # Head
    head = (1060, 660)
    draw_head(draw, head, 50)
    draw_limb(draw, (1070, 720), shoulder, width=36)

    # Left hand reaching back holding rear ankle
    elbow_l = (1260, 920)
    draw_limb(draw, shoulder, elbow_l, width=38)
    draw_joint(draw, elbow_l, 18)
    draw_limb(draw, elbow_l, ankle_rear, width=34)

    # Right hand forward for balance
    hand_r = (800, 840)
    draw_limb(draw, shoulder, hand_r, width=38)
    draw_joint(draw, hand_r, 16)

    draw_annotation_box(draw, ankle_rear, "手从身后死扣脚踝贴臀", direction='top-right', color=AMBER)
    draw_annotation_box(draw, knee_rear, "后膝轻如羽毛点地即起", direction='bottom-right', color=EMERALD)
    draw_annotation_box(draw, (950, 1250), "前腿单侧活塞式推升", direction='left', color=PRIMARY_CYAN)

    save_and_downscale(im, "squat_demon_03.jpeg")

def gen_squat_demon_04():
    # 单腿立定跳远 (Single-Leg Broad Jump)
    im, draw = render_base_card("squat_demon_04")
    draw_floor(draw, y=1420)

    # Takeoff line mark on floor
    draw.line([(550, 1370), (550, 1470)], fill=RED, width=6)
    draw.text((450, 1440), "TAKEOFF", font=FONTS["spec"], fill=RED)

    # Person in mid-flight broad leap
    hip = (1250, 1000)
    shoulder = (1080, 780)
    head = (1020, 680)

    # Explosive driving leg (extended back)
    knee_drive = (1580, 1150)
    ankle_drive = (1880, 1280)
    draw_limb(draw, hip, knee_drive, width=46, color=EMERALD)
    draw_joint(draw, knee_drive, 22)
    draw_limb(draw, knee_drive, ankle_drive, width=40, color=EMERALD)
    draw_joint(draw, ankle_drive, 18)
    draw_capsule(draw, ankle_drive, (1960, 1320), 24, EMERALD)

    # Leading leg (tucked forward preparing to land)
    knee_lead = (1120, 1080)
    ankle_lead = (1000, 1240)
    draw_limb(draw, hip, knee_lead, width=44)
    draw_joint(draw, knee_lead, 20)
    draw_limb(draw, knee_lead, ankle_lead, width=38)
    draw_joint(draw, ankle_lead, 16)
    draw_capsule(draw, ankle_lead, (940, 1280), 24, PRIMARY_CYAN)

    # Torso & Head forward lean ~45°
    draw_limb(draw, hip, shoulder, width=54)
    draw_joint(draw, hip, 24)
    draw_joint(draw, shoulder, 24)
    draw_head(draw, head, 50)
    draw_limb(draw, (1050, 730), shoulder, width=36)

    # Arms swinging explosively forward
    hand_arm = (720, 680)
    draw_limb(draw, shoulder, hand_arm, width=40)
    draw_joint(draw, hand_arm, 18)

    # Flight velocity vector arrow
    draw.line([(1250, 900), (850, 650)], fill=AMBER, width=5)
    draw.polygon([(870, 640), (840, 645), (860, 675)], fill=AMBER)

    draw_annotation_box(draw, ankle_drive, "单腿蹬地爆发倾注推力", direction='top-right', color=EMERALD)
    draw_annotation_box(draw, (850, 650), "身体如炮弹向前抛射", direction='top-left', color=AMBER)
    draw_annotation_box(draw, ankle_lead, "单腿着地制动 · 钉死不倒", direction='bottom-left', color=PRIMARY_CYAN)

    save_and_downscale(im, "squat_demon_04.jpeg")

def gen_squat_demon_05():
    # 西西弗斯柔式深蹲 (Sissy Squat)
    im, draw = render_base_card("squat_demon_05")
    draw_floor(draw, y=1420)

    # Vertical bar on left for light touch balance
    draw.line([(700, 500), (700, 1420)], fill=BAR_COLOR, width=22)
    draw.line([(695, 500), (695, 1420)], fill=BAR_HIGHLIGHT, width=6)

    # Feet: tiptoes maximally elevated on floor
    toe = (1150, 1420)
    heel = (1150, 1300) # raised 120px!
    draw_capsule(draw, toe, heel, 28, BAR_HIGHLIGHT)
    ankle = heel

    # Knees pushed EXTREMELY forward down
    knee = (900, 1180)
    draw_limb(draw, ankle, knee, width=44)
    draw_joint(draw, knee, 24)

    # Hip: fully locked and extended, hips pushed forward!
    hip = (1280, 1100)
    draw_limb(draw, knee, hip, width=50, color=AMBER)
    draw_joint(draw, hip, 24)

    # Torso: leaning backward in exact straight line with thighs! 45° slope!
    shoulder = (1680, 850)
    draw_limb(draw, hip, shoulder, width=54, color=AMBER)
    draw_joint(draw, shoulder, 24)

    # Head aligned with torso backward
    head = (1800, 770)
    draw_head(draw, head, 52)
    draw_limb(draw, (1740, 810), shoulder, width=36)

    # Left hand reaching out to touch bar for light balance
    draw_limb(draw, shoulder, (700, 850), width=36)
    draw_joint(draw, (700, 850), 16)

    # Right hand on hip/chest
    draw_limb(draw, shoulder, (1450, 950), width=36)
    draw_joint(draw, (1450, 950), 16)

    # 180° hip alignment line
    draw.line([(900, 1180), (1680, 850)], fill=EMERALD, width=3)

    draw_annotation_box(draw, toe, "脚尖极限踮起 · 足跟高悬", direction='bottom', color=PRIMARY_CYAN)
    draw_annotation_box(draw, knee, "双膝极限前推 · 股四头肌承压", direction='left', color=RED)
    draw_annotation_box(draw, hip, "髋部 180° 顶直 · 躯干后仰 45°", direction='top-right', color=AMBER)

    save_and_downscale(im, "squat_demon_05.jpeg")

def gen_squat_demon_06():
    # 团身跳 (Tuck Jump)
    im, draw = render_base_card("squat_demon_06")
    draw_floor(draw, y=1480)

    # Apex of vertical jump high in the air
    hip = (1200, 920)
    shoulder = (1220, 720)
    head = (1230, 600)

    # Torso slightly curled
    draw_limb(draw, hip, shoulder, width=54)
    draw_joint(draw, hip, 24)
    draw_joint(draw, shoulder, 24)
    draw_head(draw, head, 50)
    draw_limb(draw, (1225, 660), shoulder, width=36)

    # Knees tucked TIGHTLY against chest!
    knee = (980, 740)
    ankle = (1120, 980) # feet under hips
    draw_limb(draw, hip, knee, width=48, color=AMBER)
    draw_joint(draw, knee, 22)
    draw_limb(draw, knee, ankle, width=40, color=AMBER)
    draw_joint(draw, ankle, 18)
    draw_capsule(draw, ankle, (1160, 1020), 24, PRIMARY_CYAN)

    # Arms clapping/wrapping around tucked knees
    elbow = (1080, 780)
    draw_limb(draw, shoulder, elbow, width=38)
    draw_joint(draw, elbow, 18)
    draw_limb(draw, elbow, (980, 740), width=34)

    # Vertical speed lines from floor
    for lx in [1000, 1100, 1200, 1300, 1400]:
        draw.line([(lx, 1440), (lx, 1200)], fill=(71, 85, 105), width=3)

    draw_annotation_box(draw, (1230, 600), "垂直爆升至空中最高点", direction='top', color=EMERALD)
    draw_annotation_box(draw, knee, "双膝极限上提撞胸", direction='left', color=AMBER)
    draw_annotation_box(draw, (1200, 1300), "触地牵张反射零停顿连跳", direction='bottom', color=PRIMARY_CYAN)

    save_and_downscale(im, "squat_demon_06.jpeg")

# ==================== PULL DEMONS (1 - 6) ====================

def gen_pull_demon_01():
    # 哨兵引体向上 / 慢速双力臂上翻 (Sentry Pull-up / Muscle-Up)
    im, draw = render_base_card("pull_demon_01")

    # High pull-up bar at waist height
    bar_y = 920
    draw_bar(draw, y=bar_y, x1=400, x2=2000)

    # Hands pressing DOWN on bar
    hand = (1120, bar_y)
    draw_capsule(draw, (hand[0] - 35, hand[1]), (hand[0] + 35, hand[1]), 28, BAR_HIGHLIGHT)

    # Arms straight locked down supporting body ABOVE bar!
    shoulder = (1120, 640)
    draw_limb(draw, shoulder, hand, width=44)
    draw_joint(draw, shoulder, 24)
    draw_joint(draw, hand, 20)

    # Head high above bar
    head = (1120, 500)
    draw_head(draw, head, 54)
    draw_limb(draw, (1120, 560), shoulder, width=38)

    # Torso: bar is across hip/pelvis!
    hip = (1140, 940)
    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    # Legs straight down hanging below bar
    knee = (1160, 1280)
    ankle = (1180, 1580)
    draw_limb(draw, hip, knee, width=46)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, ankle, width=38)
    draw_joint(draw, ankle, 16)
    draw_capsule(draw, ankle, (1200, 1640), 24, PRIMARY_CYAN)

    # Transition curved arrows around bar
    draw.arc([(900, 800), (1050, 1000)], start=180, end=360, fill=AMBER, width=4)

    draw_annotation_box(draw, hand, "手腕前翻 · 杠上直臂顶推", direction='left', color=AMBER)
    draw_annotation_box(draw, (1140, 940), "横杠锁死于骨盆中轴", direction='right', color=EMERALD)
    draw_annotation_box(draw, (1180, 1580), "双腿笔直悬垂 · 零借力上翻", direction='bottom-right', color=PRIMARY_CYAN)

    save_and_downscale(im, "pull_demon_01.jpeg")

def gen_pull_demon_02():
    # 单杠仰卧直臂悬垂 / 后水平 (Back Lever Hold)
    im, draw = render_base_card("pull_demon_02")

    # High pull-up bar
    bar_y = 650
    draw_bar(draw, y=bar_y, x1=400, x2=2000)

    # Hand gripping bar
    hand = (950, bar_y)
    draw_capsule(draw, (hand[0] - 30, hand[1]), (hand[0] + 30, hand[1]), 28, BAR_HIGHLIGHT)

    # Straight vertical arm down to shoulder
    shoulder = (950, 1050)
    draw_limb(draw, hand, shoulder, width=42)
    draw_joint(draw, hand, 18)
    draw_joint(draw, shoulder, 24)

    # Head (facing down or neutral)
    head = (780, 1050)
    draw_head(draw, head, 52)
    draw_limb(draw, (840, 1050), shoulder, width=36)

    # Torso (horizontal line at y=1050)
    hip = (1420, 1050)
    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    # Legs fully locked horizontal
    knee = (1780, 1050)
    ankle = (2120, 1050)
    toe = (2220, 1050)
    draw_limb(draw, hip, knee, width=46)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, ankle, width=38)
    draw_joint(draw, ankle, 16)
    draw_capsule(draw, ankle, toe, 24, PRIMARY_CYAN)

    # Horizontal guide axis
    draw.line([(600, 1050), (2250, 1050)], fill=EMERALD, width=3)

    draw_annotation_box(draw, hand, "双手反握/正握直臂垂吊", direction='top-left', color=PRIMARY_CYAN)
    draw_annotation_box(draw, (950, 850), "双肘 180° 绝对锁死", direction='right', color=AMBER)
    draw_annotation_box(draw, (1780, 1050), "肩髋膝踝呈水平一线", direction='top', color=EMERALD)

    save_and_downscale(im, "pull_demon_02.jpeg")

def gen_pull_demon_03():
    # 吊环铁十字 (Ring Iron Cross)
    im, draw = render_base_card("pull_demon_03")

    # Rings hanging on both sides
    ring_l = (800, 880)
    ring_r = (1600, 880)
    draw_rings(draw, ring_left=ring_l, ring_right=ring_r)

    # Center body vertical plumb line
    cx = 1200
    shoulder = (cx, 880)
    head = (cx, 740)
    hip = (cx, 1180)
    knee = (cx, 1450)
    ankle = (cx, 1680)

    # Arms spread 90° WIDE horizontally to rings!
    draw_limb(draw, shoulder, ring_l, width=44)
    draw_joint(draw, ring_l, 20)
    draw_limb(draw, shoulder, ring_r, width=44)
    draw_joint(draw, ring_r, 20)

    # Head
    draw_head(draw, head, 54)
    draw_limb(draw, (cx, 800), shoulder, width=38)

    # Torso (vertical)
    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, shoulder, 26)
    draw_joint(draw, hip, 24)

    # Legs (straight down like a steel needle)
    draw_limb(draw, hip, knee, width=46)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, ankle, width=38)
    draw_joint(draw, ankle, 16)
    draw_capsule(draw, ankle, (cx, 1740), 24, PRIMARY_CYAN)

    # 90° angle indicators
    draw.line([(ring_l[0], 880), (ring_r[0], 880)], fill=AMBER, width=3)

    draw_annotation_box(draw, ring_l, "双臂 90° 水平平展展翼", direction='top-left', color=AMBER)
    draw_annotation_box(draw, shoulder, "胸大肌与背阔肌极限内合", direction='top', color=EMERALD)
    draw_annotation_box(draw, (cx, 1450), "躯干与下肢保持绝对铅垂线", direction='right', color=PRIMARY_CYAN)

    save_and_downscale(im, "pull_demon_03.jpeg")

def gen_pull_demon_04():
    # 吊环马耳他十字 (Ring Maltese Cross)
    im, draw = render_base_card("pull_demon_04")

    # Rings hanging on both sides
    ring_l = (850, 1020)
    ring_r = (1550, 1020)
    draw_rings(draw, ring_left=ring_l, ring_right=ring_r)

    # Body horizontal prone in mid air!
    shoulder = (980, 1020)
    hip = (1480, 1020)
    head = (820, 1020)

    # Arms spread slightly backward/sideways to rings
    draw_limb(draw, shoulder, ring_l, width=44)
    draw_joint(draw, ring_l, 20)
    draw_limb(draw, shoulder, ring_r, width=44)
    draw_joint(draw, ring_r, 20)

    # Head
    draw_head(draw, head, 50)
    draw_limb(draw, (880, 1020), shoulder, width=36)

    # Horizontal Torso
    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, shoulder, 24)
    draw_joint(draw, hip, 24)

    # Legs straight horizontal
    knee = (1820, 1020)
    ankle = (2120, 1020)
    toe = (2220, 1020)
    draw_limb(draw, hip, knee, width=46)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, ankle, width=38)
    draw_joint(draw, ankle, 16)
    draw_capsule(draw, ankle, toe, 24, PRIMARY_CYAN)

    # Horizontal guide axis
    draw.line([(700, 1020), (2250, 1020)], fill=EMERALD, width=3)

    draw_annotation_box(draw, ring_l, "吊环水平向外侧后展", direction='top-left', color=AMBER)
    draw_annotation_box(draw, shoulder, "前三角肌超长力臂承重", direction='bottom', color=RED)
    draw_annotation_box(draw, (1820, 1020), "俯卧身躯与地面严格平行", direction='top', color=EMERALD)

    save_and_downscale(im, "pull_demon_04.jpeg")

def gen_pull_demon_05():
    # 无腿单臂攀绳 (Legless Rope Climb)
    im, draw = render_base_card("pull_demon_05")

    # Thick climbing rope down center
    rope_x = 1150
    draw.line([(rope_x, 210), (rope_x, 1700)], fill=(160, 120, 80), width=32)
    # Rope twists
    for ry in range(240, 1700, 40):
        draw.line([(rope_x - 14, ry), (rope_x + 14, ry + 16)], fill=(200, 160, 110), width=6)

    # Right hand high gripping rope
    hand_high = (rope_x, 620)
    draw_capsule(draw, (hand_high[0] - 25, hand_high[1]), (hand_high[0] + 25, hand_high[1]), 28, BAR_HIGHLIGHT)

    # Left hand reaching higher!
    hand_reach = (rope_x, 480)
    draw_joint(draw, hand_reach, 20)

    # Shoulder
    shoulder = (1050, 780)
    head = (950, 720)
    hip = (1020, 1080)

    # High bent pulling arm (Right)
    elbow_r = (1120, 700)
    draw_limb(draw, shoulder, elbow_r, width=42)
    draw_joint(draw, elbow_r, 20)
    draw_limb(draw, elbow_r, hand_high, width=38)

    # Reaching arm (Left)
    draw_limb(draw, shoulder, hand_reach, width=40, color=AMBER)

    # Head looking up
    draw_head(draw, head, 52)
    draw_limb(draw, (990, 750), shoulder, width=36)

    # Torso
    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    # LEGS IN STRICT L-SIT (perpendicular to rope, zero touching!)
    knee = (1350, 1080)
    ankle = (1680, 1080)
    toe = (1780, 1080)
    draw_limb(draw, hip, knee, width=46, color=PRIMARY_CYAN)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, ankle, width=38, color=PRIMARY_CYAN)
    draw_joint(draw, ankle, 16)
    draw_capsule(draw, ankle, toe, 24, PRIMARY_CYAN)

    draw_annotation_box(draw, hand_high, "单手锁死全幅度引体", direction='right', color=AMBER)
    draw_annotation_box(draw, hand_reach, "另一手上探交替攀登", direction='top-left', color=EMERALD)
    draw_annotation_box(draw, (1450, 1080), "双腿严格 L-Sit · 严禁夹绳", direction='bottom', color=RED)

    save_and_downscale(im, "pull_demon_05.jpeg")

def gen_pull_demon_06():
    # 连续单杠翻身 50 次 (Continuous Bar Roll / Pullover)
    im, draw = render_base_card("pull_demon_06")

    # High pull-up bar
    bar_y = 900
    draw_bar(draw, y=bar_y, x1=400, x2=2000)

    # Hand gripping bar
    hand = (1150, bar_y)
    draw_capsule(draw, (hand[0] - 30, hand[1]), (hand[0] + 30, hand[1]), 28, BAR_HIGHLIGHT)

    # Body rotating over bar: Pelvis tight against bar!
    hip = (1180, 880)
    shoulder = (1100, 720)
    head = (1020, 640)

    # Arms bent holding bar tight to hips
    draw_limb(draw, shoulder, hand, width=42)
    draw_joint(draw, shoulder, 24)
    draw_joint(draw, hand, 20)

    # Head
    draw_head(draw, head, 50)
    draw_limb(draw, (1060, 680), shoulder, width=36)

    # Torso
    draw_limb(draw, shoulder, hip, width=54)
    draw_joint(draw, hip, 24)

    # Legs rolling over top of bar!
    knee = (1420, 740)
    ankle = (1680, 650)
    toe = (1760, 610)
    draw_limb(draw, hip, knee, width=46, color=AMBER)
    draw_joint(draw, knee, 20)
    draw_limb(draw, knee, ankle, width=38, color=AMBER)
    draw_joint(draw, ankle, 16)
    draw_capsule(draw, ankle, toe, 24, AMBER)

    # 360° rotation circular arrows around bar
    draw.arc([(950, 700), (1350, 1100)], start=30, end=300, fill=EMERALD, width=5)

    draw_annotation_box(draw, hip, "髋骨紧贴横杆 · 杠上回环", direction='bottom-left', color=AMBER)
    draw_annotation_box(draw, ankle, "引体卷腹甩腿过杠", direction='top-right', color=EMERALD)
    draw_annotation_box(draw, (1280, 1050), "360° 连续翻滚 50 次神级耐力", direction='bottom-right', color=PRIMARY_CYAN)

    save_and_downscale(im, "pull_demon_06.jpeg")

def generate_part1():
    print("Generating Part 1 (18 exercises)...")
    gen_push_demon_01()
    gen_push_demon_02()
    gen_push_demon_03()
    gen_push_demon_04()
    gen_push_demon_05()
    gen_push_demon_06()

    gen_squat_demon_01()
    gen_squat_demon_02()
    gen_squat_demon_03()
    gen_squat_demon_04()
    gen_squat_demon_05()
    gen_squat_demon_06()

    gen_pull_demon_01()
    gen_pull_demon_02()
    gen_pull_demon_03()
    gen_pull_demon_04()
    gen_pull_demon_05()
    gen_pull_demon_06()
    print("Part 1 generation complete!")

if __name__ == "__main__":
    generate_part1()
