# -*- coding: utf-8 -*-
"""
Common drawing utilities and setup for Demon Exercises graphics.
"""
import os
import json
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(BASE_DIR, "assets", "demon-images")
os.makedirs(OUTPUT_DIR, exist_ok=True)

W, H = 2400, 1800
FINAL_W, FINAL_H = 1200, 900

FONT_PATH = "C:/Windows/Fonts/msyh.ttc"
if not os.path.exists(FONT_PATH):
    FONT_PATH = "C:/Windows/Fonts/simhei.ttf"

FONTS = {
    "title": ImageFont.truetype(FONT_PATH, 72),
    "en": ImageFont.truetype(FONT_PATH, 40),
    "cat_badge": ImageFont.truetype(FONT_PATH, 36),
    "step_badge": ImageFont.truetype(FONT_PATH, 38),
    "cue": ImageFont.truetype(FONT_PATH, 36),
    "anno": ImageFont.truetype(FONT_PATH, 34),
    "watermark": ImageFont.truetype(FONT_PATH, 30),
    "spec": ImageFont.truetype(FONT_PATH, 28),
}

BG_COLOR = (11, 15, 23)
GRID_COLOR = (21, 29, 45)
CARD_BG = (17, 24, 39)
CARD_BORDER = (38, 51, 77)
PRIMARY_CYAN = (56, 189, 248)
CORE_WHITE = (240, 249, 255)
EMERALD = (16, 185, 129)
AMBER = (245, 158, 11)
PURPLE = (168, 85, 247)
RED = (239, 68, 68)
BAR_COLOR = (71, 85, 105)
BAR_HIGHLIGHT = (148, 163, 184)
TEXT_MUTED = (148, 163, 184)
TEXT_WHITE = (255, 255, 255)

DEMON_DATA_FILE = os.path.join(BASE_DIR, "scripts", "demon_exercises.json")
with open(DEMON_DATA_FILE, "r", encoding="utf-8") as f:
    DEMON_DATA_LIST = json.load(f)
DEMON_DATA = {item["id"]: item for item in DEMON_DATA_LIST}

CATEGORY_MAP = {
    "push": "俯卧撑 · 魔鬼拓展",
    "squat": "深蹲 · 魔鬼拓展",
    "pull": "引体向上 · 魔鬼拓展",
    "legRaise": "举腿 · 魔鬼拓展",
    "bridge": "铁桥 · 魔鬼拓展",
    "hspu": "倒立撑 · 魔鬼拓展"
}

def draw_capsule(draw, p1, p2, width, color):
    x1, y1 = p1
    x2, y2 = p2
    draw.line([(x1, y1), (x2, y2)], fill=color, width=width)
    r = width // 2
    draw.ellipse([(x1 - r, y1 - r), (x1 + r, y1 + r)], fill=color)
    draw.ellipse([(x2 - r, y2 - r), (x2 + r, y2 + r)], fill=color)

def draw_limb(draw, p1, p2, width=44, color=PRIMARY_CYAN, core_color=CORE_WHITE):
    draw_capsule(draw, p1, p2, width, color)
    draw_capsule(draw, p1, p2, max(6, width - 16), core_color)

def draw_joint(draw, pt, r=22):
    x, y = pt
    draw.ellipse([(x - r, y - r), (x + r, y + r)], fill=PRIMARY_CYAN)
    draw.ellipse([(x - r + 5, y - r + 5), (x + r - 5, y + r - 5)], fill=CORE_WHITE)

def draw_head(draw, pt, r=54):
    x, y = pt
    draw.ellipse([(x - r, y - r), (x + r, y + r)], fill=PRIMARY_CYAN)
    draw.ellipse([(x - r + 8, y - r + 8), (x + r - 8, y + r - 8)], fill=CORE_WHITE)

def draw_annotation_box(draw, pt, text, direction='top', color=AMBER):
    x, y = pt
    offset_y = -90 if direction == 'top' else 90
    offset_x = 0
    if direction == 'right':
        offset_x, offset_y = 140, 0
    elif direction == 'left':
        offset_x, offset_y = -140, 0
    elif direction == 'top-right':
        offset_x, offset_y = 120, -80
    elif direction == 'top-left':
        offset_x, offset_y = -120, -80
    elif direction == 'bottom-right':
        offset_x, offset_y = 120, 80
    elif direction == 'bottom-left':
        offset_x, offset_y = -120, 80

    end_x, end_y = x + offset_x, y + offset_y
    draw.line([(x, y), (end_x, end_y)], fill=color, width=3)
    draw.ellipse([(x - 6, y - 6), (x + 6, y + 6)], fill=color)

    bbox = FONTS["anno"].getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]

    bx1 = end_x - tw // 2 - 18
    by1 = end_y - th // 2 - 12
    bx2 = bx1 + tw + 36
    by2 = by1 + th + 24

    draw.rounded_rectangle([(bx1, by1), (bx2, by2)], radius=10, fill=(15, 23, 42), outline=color, width=2)
    draw.text((bx1 + 18, by1 + 8), text, font=FONTS["anno"], fill=color)

def draw_floor(draw, y=1400, x1=240, x2=2160):
    draw.line([(x1, y), (x2, y)], fill=BAR_COLOR, width=16)
    draw.line([(x1, y - 5), (x2, y - 5)], fill=BAR_HIGHLIGHT, width=4)

def draw_bar(draw, y=650, x1=350, x2=2050):
    draw.line([(x1, y), (x2, y)], fill=BAR_COLOR, width=28)
    draw.line([(x1, y - 6), (x2, y - 6)], fill=BAR_HIGHLIGHT, width=8)

def draw_rings(draw, ring_left=(900, 950), ring_right=(1500, 950)):
    draw.line([(ring_left[0], 210), (ring_left[0], ring_left[1] - 40)], fill=(51, 65, 85), width=10)
    draw.line([(ring_right[0], 210), (ring_right[0], ring_right[1] - 40)], fill=(51, 65, 85), width=10)
    draw.ellipse([(ring_left[0] - 45, ring_left[1] - 45), (ring_left[0] + 45, ring_left[1] + 45)], outline=PRIMARY_CYAN, width=14)
    draw.ellipse([(ring_left[0] - 38, ring_left[1] - 38), (ring_left[0] + 38, ring_left[1] + 38)], outline=CORE_WHITE, width=4)
    draw.ellipse([(ring_right[0] - 45, ring_right[1] - 45), (ring_right[0] + 45, ring_right[1] + 45)], outline=PRIMARY_CYAN, width=14)
    draw.ellipse([(ring_right[0] - 38, ring_right[1] - 38), (ring_right[0] + 38, ring_right[1] + 38)], outline=CORE_WHITE, width=4)

def draw_weight_plate(draw, center, r=100, label="25 KG"):
    cx, cy = center
    draw.ellipse([(cx - r, cy - r), (cx + r, cy + r)], fill=(30, 41, 59), outline=AMBER, width=8)
    draw.ellipse([(cx - r + 16, cy - r + 16), (cx + r - 16, cy + r - 16)], outline=(71, 85, 105), width=4)
    draw.ellipse([(cx - 24, cy - 24), (cx + 24, cy + 24)], fill=(15, 23, 42), outline=AMBER, width=4)
    bbox = FONTS["spec"].getbbox(label)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((cx - tw // 2, cy - th // 2 - 2), label, font=FONTS["spec"], fill=AMBER)

def draw_kettlebell(draw, center, r=80, label="32 KG"):
    cx, cy = center
    draw.arc([(cx - 50, cy - r - 60), (cx + 50, cy - r + 30)], start=180, end=360, fill=AMBER, width=16)
    draw.ellipse([(cx - r, cy - r), (cx + r, cy + r)], fill=(30, 41, 59), outline=AMBER, width=8)
    bbox = FONTS["spec"].getbbox(label)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((cx - tw // 2, cy - th // 2 - 2), label, font=FONTS["spec"], fill=AMBER)

def render_base_card(ex_id):
    info = DEMON_DATA[ex_id]
    im = Image.new('RGB', (W, H), BG_COLOR)
    draw = ImageDraw.Draw(im)

    for x in range(0, W, 80):
        draw.line([(x, 0), (x, H)], fill=GRID_COLOR, width=2)
    for y in range(0, H, 80):
        draw.line([(0, y), (W, y)], fill=GRID_COLOR, width=2)

    # Header Card
    draw.rounded_rectangle([(80, 50), (W - 80, 210)], radius=24, fill=CARD_BG, outline=CARD_BORDER, width=3)

    cat_label = CATEGORY_MAP.get(info.get("category", ""), "魔鬼拓展")
    cat_bbox = FONTS["cat_badge"].getbbox(cat_label)
    cat_w = cat_bbox[2] - cat_bbox[0] + 40
    draw.rounded_rectangle([(120, 85), (120 + cat_w, 165)], radius=16, fill=(24, 34, 53), outline=PRIMARY_CYAN, width=2)
    draw.text((140, 105), cat_label, font=FONTS["cat_badge"], fill=PRIMARY_CYAN)

    draw.text((150 + cat_w, 90), info["name"], font=FONTS["title"], fill=TEXT_WHITE)
    draw.text((150 + cat_w, 160), info.get("nameEn", ""), font=FONTS["en"], fill=TEXT_MUTED)

    step_str = f"DEMON {info.get('step', 1):02d} / {info.get('totalSteps', 6):02d}"
    draw.rounded_rectangle([(W - 420, 85), (W - 120, 165)], radius=16, fill=PURPLE, outline=(192, 132, 252), width=2)
    draw.text((W - 390, 105), step_str, font=FONTS["step_badge"], fill=TEXT_WHITE)

    # Footer Card
    draw.rounded_rectangle([(80, H - 190), (W - 80, H - 70)], radius=20, fill=CARD_BG, outline=CARD_BORDER, width=3)
    cues = info.get("keyPoints", [])[:3]
    cur_x = 120
    for cue in cues:
        cue_txt = cue if len(cue) <= 16 else cue[:15] + "…"
        cue_bbox = FONTS["cue"].getbbox(cue_txt)
        cue_w = cue_bbox[2] - cue_bbox[0] + 44
        draw.rounded_rectangle([(cur_x, H - 165), (cur_x + cue_w, H - 95)], radius=14, fill=(30, 41, 59), outline=PRIMARY_CYAN, width=2)
        draw.text((cur_x + 22, H - 148), cue_txt, font=FONTS["cue"], fill=TEXT_WHITE)
        cur_x += cue_w + 24

    draw.text((W - 510, H - 55), "PRISONER WORKOUT · DEMON 2026", font=FONTS["watermark"], fill=(51, 65, 85))
    return im, draw

def save_and_downscale(im, out_filename):
    out_path = os.path.join(OUTPUT_DIR, out_filename)
    downscaled = im.resize((FINAL_W, FINAL_H), Image.Resampling.LANCZOS)
    downscaled.save(out_path, 'JPEG', quality=92)
    print(f"Generated {out_filename}")
