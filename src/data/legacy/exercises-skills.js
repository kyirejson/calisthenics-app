const exercisesSkills = [
  // --- Front Lever (前水平) ---
  {
    "id": "fl_01",
    "name": "收腿前水平",
    "nameEn": "Tuck Front Lever",
    "category": "front_lever",
    "categoryLabel": "前水平",
    "step": 1,
    "source": "现代街头健身进阶体系",
    "riskLevel": "low",
    "equipment": ["单杠"],
    "equipmentTags": ["pull-up bar"],
    "isHold": true,
    "purpose": "建立背阔肌和核心的等长收缩力量，初步适应前水平的发力模式。",
    "keyPoints": [
      "双手正握单杠，肩胛骨下沉并后缩（Retraction & Depression）。",
      "双膝弯曲贴近胸部，背部保持圆润（后倾骨盆）。",
      "手臂保持完全伸直，手肘死锁，利用背阔肌发力将身体平行于地面。",
      "头部保持自然中立，眼睛看向脚尖或正上方，不要过度仰头。"
    ],
    "commonIssues": [
      {
        "problem": "手臂弯曲代偿",
        "fix": "降低难度，专注于直臂发力，可以先练习前水平摆动。"
      },
      {
        "problem": "臀部下掉",
        "fix": "加强核心力量，确保骨盆后倾，背部主动发力向下压杠。"
      }
    ],
    "standards": {
      "beginner": "保持5秒",
      "intermediate": "3组 × 10秒",
      "upgrade": "3组 × 15秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [5, 15],
      "restSeconds": 120,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 2
    }
  },
  {
    "id": "fl_02",
    "name": "高级收腿前水平",
    "nameEn": "Advanced Tuck Front Lever",
    "category": "front_lever",
    "categoryLabel": "前水平",
    "step": 2,
    "source": "现代街头健身进阶体系",
    "riskLevel": "medium",
    "equipment": ["单杠"],
    "equipmentTags": ["pull-up bar"],
    "isHold": true,
    "purpose": "通过展开髋部增加力臂，进一步强化背阔肌和大圆肌的直臂下压力量。",
    "keyPoints": [
      "保持收腿前水平的肩胛骨位置（下沉后缩）。",
      "大腿与躯干呈90度角，背部必须保持平直，骨盆维持后倾。",
      "手臂绝对伸直，想象双手要把单杠向臀部方向拉断。",
      "核心紧绷，避免腰椎过度伸展（塌腰）。"
    ],
    "commonIssues": [
      {
        "problem": "腰部塌陷",
        "fix": "退阶回到收腿前水平，强化骨盆后倾意识和腹横肌力量。"
      }
    ],
    "standards": {
      "beginner": "保持5秒",
      "intermediate": "3组 × 10秒",
      "upgrade": "3组 × 15秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [5, 15],
      "restSeconds": 120,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 2
    }
  },
  {
    "id": "fl_03",
    "name": "单腿前水平",
    "nameEn": "One Leg Front Lever",
    "category": "front_lever",
    "categoryLabel": "前水平",
    "step": 3,
    "source": "现代街头健身进阶体系",
    "riskLevel": "medium",
    "equipment": ["单杠"],
    "equipmentTags": ["pull-up bar"],
    "isHold": true,
    "purpose": "利用单腿伸直极大地增加核心与背阔肌的负荷，作为双腿完全伸直前的过渡。",
    "keyPoints": [
      "一条腿完全伸直，脚背绷直；另一条腿弯曲收在胸前。",
      "伸直腿与躯干保持在同一水平线上，骨盆后倾锁死核心。",
      "肩胛骨持续下沉，发力压杠，保持身体不旋转、不晃动。",
      "两侧腿在每组练习中需要交替，确保两侧力量均衡。"
    ],
    "commonIssues": [
      {
        "problem": "身体向一侧倾斜（旋转）",
        "fix": "专注双臂均匀发力，收腿侧的骨盆不要过度上翻。"
      },
      {
        "problem": "伸直腿下掉",
        "fix": "臀大肌和腘绳肌发力，将伸直的腿锁定在水平高度。"
      }
    ],
    "standards": {
      "beginner": "每侧保持5秒",
      "intermediate": "每侧3组 × 8秒",
      "upgrade": "每侧3组 × 12秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [5, 12],
      "restSeconds": 150,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 2
    }
  },
  {
    "id": "fl_04",
    "name": "分腿前水平",
    "nameEn": "Straddle Front Lever",
    "category": "front_lever",
    "categoryLabel": "前水平",
    "step": 4,
    "source": "现代街头健身进阶体系",
    "riskLevel": "high",
    "equipment": ["单杠"],
    "equipmentTags": ["pull-up bar"],
    "isHold": true,
    "purpose": "在极大力臂下保持身体水平，考验极致的背阔肌直臂力量和臀部后倾控制力。",
    "keyPoints": [
      "双腿尽可能向两侧大张，双腿张开角度越大，难度相对越低。",
      "骨盆强烈后倾，臀部收紧，整个背部到脚尖呈一直线。",
      "手臂保持死锁，肩胛骨保持下沉（略微后缩，但允许部分前移以维持发力）。",
      "股四头肌收紧，脚背绷直以减轻末端重量感。"
    ],
    "commonIssues": [
      {
        "problem": "骨盆前倾（塌腰）",
        "fix": "强化龙旗或单腿前水平，提升骨盆后倾的静力维持能力。"
      }
    ],
    "standards": {
      "beginner": "保持3秒",
      "intermediate": "3组 × 8秒",
      "upgrade": "3组 × 12秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [3, 12],
      "restSeconds": 150,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 2
    }
  },
  {
    "id": "fl_05",
    "name": "完全前水平",
    "nameEn": "Full Front Lever",
    "category": "front_lever",
    "categoryLabel": "前水平",
    "step": 5,
    "source": "现代街头健身进阶体系",
    "riskLevel": "high",
    "equipment": ["单杠"],
    "equipmentTags": ["pull-up bar"],
    "isHold": true,
    "purpose": "全面展现上肢拉力链和前侧核心链的极限等长收缩能力，是街头健身标志性技能。",
    "keyPoints": [
      "双腿完全并拢伸直，从肩部到脚踝形成一条完美的水平直线。",
      "骨盆后倾锁定，臀大肌夹紧，核心呈现极致的“空心（Hollow）”状态。",
      "双手死死压住单杠，背阔肌和胸大肌共同参与下压（直臂）。",
      "肩胛下沉并尽可能后缩，避免含胸过度。"
    ],
    "commonIssues": [
      {
        "problem": "无法并拢双腿或腿部下垂",
        "fix": "继续强化分腿前水平和前水平离心下放控制。"
      }
    ],
    "standards": {
      "beginner": "保持3秒",
      "intermediate": "3组 × 5秒",
      "upgrade": "3组 × 10秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [3, 10],
      "restSeconds": 180,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 3
    }
  },

  // --- Planche (俯撑) ---
  {
    "id": "pl_01",
    "name": "俯撑前倾",
    "nameEn": "Planche Lean",
    "category": "planche",
    "categoryLabel": "俯撑",
    "step": 1,
    "source": "现代街头健身进阶体系",
    "riskLevel": "low",
    "equipment": ["地面或双杠"],
    "equipmentTags": ["floor", "parallettes"],
    "isHold": true,
    "purpose": "强化三角肌前束的力量，建立肩胛骨前伸（Protraction）和下沉的习惯。",
    "keyPoints": [
      "双手撑地或撑双杠，手臂完全伸直，肘眼朝前（肘部超伸锁定）。",
      "肩胛骨极力前伸（含胸拔背），同时保持肩胛骨下沉（远离耳朵）。",
      "身体保持一条直线，骨盆后倾，臀部收紧。",
      "重心逐渐向前移动，肩膀超过手掌，感受三角肌前束受力。"
    ],
    "commonIssues": [
      {
        "problem": "肩胛骨回缩（塌背）",
        "fix": "不要前倾太深，退回起始位置重新发力推地，保持背部拱起。"
      },
      {
        "problem": "屈肘代偿",
        "fix": "必须直臂，宁可前倾角度小，也不要弯曲手肘。"
      }
    ],
    "standards": {
      "beginner": "保持10秒",
      "intermediate": "3组 × 20秒",
      "upgrade": "3组 × 30秒（肩部超过手掌一个手掌距离）"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [10, 30],
      "restSeconds": 90,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 1
    }
  },
  {
    "id": "pl_02",
    "name": "收腿俯撑",
    "nameEn": "Tuck Planche",
    "category": "planche",
    "categoryLabel": "俯撑",
    "step": 2,
    "source": "现代街头健身进阶体系",
    "riskLevel": "medium",
    "equipment": ["地面或双杠"],
    "equipmentTags": ["floor", "parallettes"],
    "isHold": true,
    "purpose": "初步将身体腾空，考验直臂支撑力量及肩胛核心的整体协调性。",
    "keyPoints": [
      "保持直臂推地，肩胛骨前伸下沉，背部像猫一样拱起。",
      "双膝收拢贴近胸部，骨盆后倾，背部成圆弧形。",
      "身体重心前移至肩膀，臀部抬起到与肩膀平齐的高度。",
      "脚尖离开地面，完全依靠上肢力量维持身体腾空。"
    ],
    "commonIssues": [
      {
        "problem": "臀部太高或太低",
        "fix": "核心收紧，调整重心前移的幅度，使背部处于水平线。"
      }
    ],
    "standards": {
      "beginner": "保持5秒",
      "intermediate": "3组 × 10秒",
      "upgrade": "3组 × 15秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [5, 15],
      "restSeconds": 120,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 2
    }
  },
  {
    "id": "pl_03",
    "name": "高级收腿俯撑",
    "nameEn": "Advanced Tuck Planche",
    "category": "planche",
    "categoryLabel": "俯撑",
    "step": 3,
    "source": "现代街头健身进阶体系",
    "riskLevel": "medium",
    "equipment": ["地面或双杠"],
    "equipmentTags": ["floor", "parallettes"],
    "isHold": true,
    "purpose": "打开髋角，增加力臂，显著提高对三角肌前束和腰背部的力量要求。",
    "keyPoints": [
      "大腿向后展开，与躯干形成90度直角。",
      "背部从极度圆润变为相对平直，但肩胛骨仍需强烈前伸。",
      "重心进一步前移，保持直臂锁定，肩部承受更大负荷。",
      "骨盆保持后倾，避免腰椎反张，脚背绷直。"
    ],
    "commonIssues": [
      {
        "problem": "背部塌陷",
        "fix": "强化肩胛前伸力量，如果无法维持背部平直，退阶回普通收腿。"
      }
    ],
    "standards": {
      "beginner": "保持5秒",
      "intermediate": "3组 × 10秒",
      "upgrade": "3组 × 15秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [5, 15],
      "restSeconds": 120,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 2
    }
  },
  {
    "id": "pl_04",
    "name": "分腿俯撑",
    "nameEn": "Straddle Planche",
    "category": "planche",
    "categoryLabel": "俯撑",
    "step": 4,
    "source": "现代街头健身进阶体系",
    "riskLevel": "high",
    "equipment": ["地面或双杠"],
    "equipmentTags": ["floor", "parallettes"],
    "isHold": true,
    "purpose": "在双腿张开的状态下实现全身水平腾空，是对推力系统极限的巨大考验。",
    "keyPoints": [
      "双腿尽可能宽地向两侧大张，身体形成水平直线。",
      "极致重心前移，肩膀远超手腕，肘关节必须死锁。",
      "肩胛骨前伸下沉，骨盆后倾，腰腹臀完全锁死。",
      "脚背绷紧指向后方，靠腿部力量对抗重力，防止腿下垂。"
    ],
    "commonIssues": [
      {
        "problem": "手肘弯曲",
        "fix": "绝对禁止屈肘，这会极大增加二头肌肌腱撕裂风险。必须直臂！"
      },
      {
        "problem": "塌腰翘臀",
        "fix": "加强下背部力量，强调骨盆后倾意识。"
      }
    ],
    "standards": {
      "beginner": "保持3秒",
      "intermediate": "3组 × 8秒",
      "upgrade": "3组 × 12秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [3, 12],
      "restSeconds": 150,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 3
    }
  },
  {
    "id": "pl_05",
    "name": "完全俯撑",
    "nameEn": "Full Planche",
    "category": "planche",
    "categoryLabel": "俯撑",
    "step": 5,
    "source": "现代街头健身进阶体系",
    "riskLevel": "high",
    "equipment": ["地面或双杠"],
    "equipmentTags": ["floor", "parallettes"],
    "isHold": true,
    "purpose": "街头健身推力类的终极挑战，展现极致的肩部力量和全身静力控制。",
    "keyPoints": [
      "双腿完全并拢伸直，身体悬空平行于地面。",
      "极度前倾，肩胛骨强力前伸下沉，手掌死死抓住地面或器械。",
      "全身从头到脚背收紧如钢板，骨盆后倾贯穿始终。",
      "保持平稳呼吸，抵抗极大的关节负荷。"
    ],
    "commonIssues": [
      {
        "problem": "力臂不足导致掉腿",
        "fix": "需要继续增强三角肌前束力量以支持更大幅度的前倾。"
      }
    ],
    "standards": {
      "beginner": "保持2秒",
      "intermediate": "3组 × 5秒",
      "upgrade": "3组 × 8秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [2, 8],
      "restSeconds": 180,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 3
    }
  },

  // --- Back Lever (后水平) ---
  {
    "id": "bl_01",
    "name": "德式悬挂",
    "nameEn": "German Hang",
    "category": "back_lever",
    "categoryLabel": "后水平",
    "step": 1,
    "source": "现代街头健身进阶体系",
    "riskLevel": "medium",
    "equipment": ["单杠或吊环"],
    "equipmentTags": ["pull-up bar", "rings"],
    "isHold": true,
    "purpose": "建立肩关节后伸的柔韧性与结缔组织耐受力，为后水平打下基础。",
    "keyPoints": [
      "双手正握单杠（或抓吊环），身体向后翻转让手臂处于背后。",
      "身体完全放松下沉，感受胸大肌和肩关节前侧的拉伸。",
      "手臂保持完全伸直，切勿弯曲手肘。",
      "不要屏气，深呼吸帮助肌肉放松。"
    ],
    "commonIssues": [
      {
        "problem": "肩部疼痛",
        "fix": "如果是关节刺痛请立即停止；如果是拉伸感则正常，控制下放幅度。"
      }
    ],
    "standards": {
      "beginner": "保持10秒",
      "intermediate": "3组 × 20秒",
      "upgrade": "3组 × 30秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [10, 30],
      "restSeconds": 120,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 2
    }
  },
  {
    "id": "bl_02",
    "name": "收腿后水平",
    "nameEn": "Tuck Back Lever",
    "category": "back_lever",
    "categoryLabel": "后水平",
    "step": 2,
    "source": "现代街头健身进阶体系",
    "riskLevel": "medium",
    "equipment": ["单杠或吊环"],
    "equipmentTags": ["pull-up bar", "rings"],
    "isHold": true,
    "purpose": "开始在倒挂状态下建立背部和肩部的等长收缩发力模式。",
    "keyPoints": [
      "从德式悬挂发力，将身体拉平至背部平行于地面。",
      "双膝收拢贴紧胸部，背部成圆弧形。",
      "肩胛骨前伸（含胸），手臂完全伸直向下压杠。",
      "视线看向地面，保持头部中立位置。"
    ],
    "commonIssues": [
      {
        "problem": "屈肘",
        "fix": "手臂必须锁死，二头肌承受离心力，不要屈肘代偿，否则易受伤。"
      }
    ],
    "standards": {
      "beginner": "保持5秒",
      "intermediate": "3组 × 15秒",
      "upgrade": "3组 × 20秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [5, 20],
      "restSeconds": 120,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 2
    }
  },
  {
    "id": "bl_03",
    "name": "分腿后水平",
    "nameEn": "Straddle Back Lever",
    "category": "back_lever",
    "categoryLabel": "后水平",
    "step": 3,
    "source": "现代街头健身进阶体系",
    "riskLevel": "high",
    "equipment": ["单杠或吊环"],
    "equipmentTags": ["pull-up bar", "rings"],
    "isHold": true,
    "purpose": "大幅度展开髋部，极大地增加对肱二头肌腱和胸肌的拉力负荷。",
    "keyPoints": [
      "双腿向两侧大张，身体形成一条平行的直线（面朝下）。",
      "骨盆后倾，夹紧臀部，避免塌腰。",
      "双手死锁直臂向下发力，肩胛骨前伸发力。",
      "核心绷紧，确保背部至脚尖在同一平面。"
    ],
    "commonIssues": [
      {
        "problem": "严重塌腰",
        "fix": "臀部未收紧或腰背力量不足，退阶至高级收腿后水平。"
      },
      {
        "problem": "二头肌处拉扯痛",
        "fix": "高风险动作，训练前必须充分热身二头肌肌腱。"
      }
    ],
    "standards": {
      "beginner": "保持5秒",
      "intermediate": "3组 × 10秒",
      "upgrade": "3组 × 15秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [5, 15],
      "restSeconds": 150,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 2
    }
  },
  {
    "id": "bl_04",
    "name": "完全后水平",
    "nameEn": "Full Back Lever",
    "category": "back_lever",
    "categoryLabel": "后水平",
    "step": 4,
    "source": "现代街头健身进阶体系",
    "riskLevel": "high",
    "equipment": ["单杠或吊环"],
    "equipmentTags": ["pull-up bar", "rings"],
    "isHold": true,
    "purpose": "完全展示身体后侧动力链与前侧静力支撑的结合，完成标准后水平。",
    "keyPoints": [
      "双腿完全并拢伸直，身体面朝下平行于地面。",
      "骨盆必须后倾，全身呈现一条平直刚硬的直线。",
      "直臂死锁，感受胸肌、二头肌、三角肌前束的强烈收缩。",
      "肩胛保持前伸，视线自然朝向地面。"
    ],
    "commonIssues": [
      {
        "problem": "臀部撅起或下掉",
        "fix": "核心发力维持骨盆后倾，臀大肌必须时刻保持夹紧状态。"
      }
    ],
    "standards": {
      "beginner": "保持3秒",
      "intermediate": "3组 × 8秒",
      "upgrade": "3组 × 12秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [3, 12],
      "restSeconds": 180,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 3
    }
  },

  // --- Muscle Up (双力臂) ---
  {
    "id": "mu_01",
    "name": "高位引体",
    "nameEn": "High Pull-up",
    "category": "muscle_up",
    "categoryLabel": "双力臂",
    "step": 1,
    "source": "现代街头健身进阶体系",
    "riskLevel": "low",
    "equipment": ["单杠"],
    "equipmentTags": ["pull-up bar"],
    "isHold": false,
    "purpose": "增强爆发拉力，将身体拉至足够高的高度以满足双力臂转换需求。",
    "keyPoints": [
      "悬垂开始，使用假握（False Grip）或强力正握，核心收紧。",
      "爆发性发力向上拉，不仅是垂直拉，还要带有背阔肌下压的弧线轨迹。",
      "将单杠拉至胸口下沿甚至腹部上方。",
      "下放时控制速度，保持肌肉张力。"
    ],
    "commonIssues": [
      {
        "problem": "拉不高",
        "fix": "强化引体向上的绝对力量，尝试使用阻力带辅助进行高位爆发拉。"
      }
    ],
    "standards": {
      "beginner": "拉至锁骨 3次",
      "intermediate": "拉至胸下沿 3组 × 5次",
      "upgrade": "拉至上腹部 3组 × 5次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [3, 8],
      "restSeconds": 90,
      "tempoDescription": "爆发上·1秒停·2秒下",
      "rirTarget": 2
    }
  },
  {
    "id": "mu_02",
    "name": "直杠臂屈伸",
    "nameEn": "Straight Bar Dip",
    "category": "muscle_up",
    "categoryLabel": "双力臂",
    "step": 2,
    "source": "现代街头健身进阶体系",
    "riskLevel": "low",
    "equipment": ["单杠"],
    "equipmentTags": ["pull-up bar"],
    "isHold": false,
    "purpose": "强化完成双力臂翻腕后的撑起能力，增强胸肌下束和三头肌。",
    "keyPoints": [
      "在单杠上方呈直臂支撑状态，身体微前倾。",
      "屈肘下放，直到胸部下沿触碰单杠。",
      "前臂尽可能保持垂直，手肘贴近身体，不要外展过大。",
      "爆发发力撑起至手臂完全伸直锁定。"
    ],
    "commonIssues": [
      {
        "problem": "手腕疼痛",
        "fix": "调整手腕角度，让掌根承重，确保腕关节中立偏屈曲。"
      }
    ],
    "standards": {
      "beginner": "3组 × 5次",
      "intermediate": "3组 × 10次",
      "upgrade": "3组 × 15次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [8, 15],
      "restSeconds": 90,
      "tempoDescription": "2秒下·1秒停·1秒上",
      "rirTarget": 1
    }
  },
  {
    "id": "mu_03",
    "name": "负功双力臂",
    "nameEn": "Negative Muscle-up",
    "category": "muscle_up",
    "categoryLabel": "双力臂",
    "step": 3,
    "source": "现代街头健身进阶体系",
    "riskLevel": "medium",
    "equipment": ["单杠"],
    "equipmentTags": ["pull-up bar"],
    "isHold": false,
    "purpose": "通过离心控制，让身体神经系统适应双力臂过渡阶段（Transition）的动作轨迹。",
    "keyPoints": [
      "借力跳上单杠形成支撑姿势，慢慢做直杠臂屈伸下放。",
      "下放至胸口触杠时，极慢地让手腕翻转向下，手肘向后上方引导。",
      "控制身体在过渡点的下落速度，对抗重力。",
      "平稳过渡到引体向下悬垂阶段，全过程禁止自由落体。"
    ],
    "commonIssues": [
      {
        "problem": "过渡点直接掉落",
        "fix": "过渡阶段力量太弱，可在低杠上用脚辅助进行慢速离心。"
      }
    ],
    "standards": {
      "beginner": "1次控制",
      "intermediate": "3组 × 3次（5秒离心）",
      "upgrade": "3组 × 5次（8秒离心）"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [3, 5],
      "restSeconds": 120,
      "tempoDescription": "跳上·极慢控制下落",
      "rirTarget": 2
    }
  },
  {
    "id": "mu_04",
    "name": "借力双力臂",
    "nameEn": "Kipping Muscle-up",
    "category": "muscle_up",
    "categoryLabel": "双力臂",
    "step": 4,
    "source": "现代街头健身进阶体系",
    "riskLevel": "medium",
    "equipment": ["单杠"],
    "equipmentTags": ["pull-up bar"],
    "isHold": false,
    "purpose": "利用身体摆动的惯性突破过渡点，完成第一次完整的双力臂。",
    "keyPoints": [
      "起跳抓杠，身体向前摆动形成C型（Arch）。",
      "向后摆动时，瞬间爆发收腹收腿，同时双臂向下强力压杠。",
      "在失重瞬间迅速将头部和肩部探过单杠，完成翻腕。",
      "身体到达杠上后，顺势完成一个臂屈伸撑起。"
    ],
    "commonIssues": [
      {
        "problem": "单侧翻腕（高低手）",
        "fix": "非常容易导致肩袖撕裂！停止单侧翻，回去练高位引体和双侧翻发力。"
      }
    ],
    "standards": {
      "beginner": "完成1次",
      "intermediate": "3组 × 3次",
      "upgrade": "3组 × 6次连续完成"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [1, 6],
      "restSeconds": 120,
      "tempoDescription": "借力爆发·控制下落",
      "rirTarget": 2
    }
  },
  {
    "id": "mu_05",
    "name": "严格双力臂",
    "nameEn": "Strict Muscle-up",
    "category": "muscle_up",
    "categoryLabel": "双力臂",
    "step": 5,
    "source": "现代街头健身进阶体系",
    "riskLevel": "high",
    "equipment": ["单杠"],
    "equipmentTags": ["pull-up bar"],
    "isHold": false,
    "purpose": "纯粹爆发力与技巧的结合，消除摆动借力，展现上肢极强的综合拉力与推力。",
    "keyPoints": [
      "使用假握，身体垂直悬垂，无任何前后摆动。",
      "核心发力呈空心姿势，背阔肌起动爆发出巨大拉力。",
      "拉直腹部高度的同时，手腕顺势快速翻转，手肘抬高向后。",
      "无缝衔接直杠撑起，整个过程一气呵成、行云流水。"
    ],
    "commonIssues": [
      {
        "problem": "假握掉杠或手腕痛",
        "fix": "假握需要专门的适应训练，可悬垂静力保持来强化假腕力。"
      }
    ],
    "standards": {
      "beginner": "完成1次",
      "intermediate": "3组 × 3次",
      "upgrade": "3组 × 5次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [1, 5],
      "restSeconds": 180,
      "tempoDescription": "爆发直上·1秒停·2秒下",
      "rirTarget": 3
    }
  },

  // --- L-Sit (L支撑) ---
  {
    "id": "ls_01",
    "name": "收腿L支撑",
    "nameEn": "Tuck L-Sit",
    "category": "l_sit",
    "categoryLabel": "L支撑",
    "step": 1,
    "source": "现代街头健身进阶体系",
    "riskLevel": "low",
    "equipment": ["双杠或地面"],
    "equipmentTags": ["parallettes", "floor"],
    "isHold": true,
    "purpose": "建立直臂肩部下沉的基础力量，同时初步唤醒核心抗伸展能力。",
    "keyPoints": [
      "双手撑在地面或双杠上，手臂伸直，肩胛骨强力下沉（Depression）。",
      "双膝弯曲收向胸部，脚尖离地。",
      "背部挺直或略微拱起，核心收紧，大腿根部发力维持膝盖高度。",
      "保持平稳呼吸，避免耸肩。"
    ],
    "commonIssues": [
      {
        "problem": "耸肩无力",
        "fix": "肩胛骨下沉力量不足，先练习直臂肩胛支撑（Scapular Dips）。"
      }
    ],
    "standards": {
      "beginner": "保持10秒",
      "intermediate": "3组 × 20秒",
      "upgrade": "3组 × 30秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [10, 30],
      "restSeconds": 90,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 1
    }
  },
  {
    "id": "ls_02",
    "name": "单腿L支撑",
    "nameEn": "One Leg L-Sit",
    "category": "l_sit",
    "categoryLabel": "L支撑",
    "step": 2,
    "source": "现代街头健身进阶体系",
    "riskLevel": "low",
    "equipment": ["双杠或地面"],
    "equipmentTags": ["parallettes", "floor"],
    "isHold": true,
    "purpose": "增加髋屈肌负荷，作为完全伸直双腿的过渡。",
    "keyPoints": [
      "在收腿L支撑的基础上，将一条腿完全向前伸直，脚背绷直。",
      "另一条腿保持弯曲收拢状态。",
      "伸直的腿需与地面平行，大腿前侧（股四头肌）强力收紧。",
      "肩部保持下沉锁定，不可因为腿部前伸而导致身体后倾过多。"
    ],
    "commonIssues": [
      {
        "problem": "伸直的腿低于水平线",
        "fix": "髂腰肌力量不足，可通过仰卧抬腿或悬垂抬腿进行强化。"
      }
    ],
    "standards": {
      "beginner": "每侧5秒",
      "intermediate": "每侧3组 × 10秒",
      "upgrade": "每侧3组 × 15秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [5, 15],
      "restSeconds": 90,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 1
    }
  },
  {
    "id": "ls_03",
    "name": "完全L支撑",
    "nameEn": "Full L-Sit",
    "category": "l_sit",
    "categoryLabel": "L支撑",
    "step": 3,
    "source": "现代街头健身进阶体系",
    "riskLevel": "medium",
    "equipment": ["双杠或地面"],
    "equipmentTags": ["parallettes", "floor"],
    "isHold": true,
    "purpose": "街头健身基础核心动作，对核心屈肌、髋屈肌和大腿前侧提出较高要求。",
    "keyPoints": [
      "双腿完全并拢并向前伸直，身体呈完美的“L”型。",
      "双腿保持水平或略高于水平面，脚背绷直。",
      "直臂撑起，肩胛骨强力下沉锁死，视线正视前方。",
      "躯干直立，避免身体过度向后倾斜代偿。"
    ],
    "commonIssues": [
      {
        "problem": "大腿抽筋",
        "fix": "股四头肌处于极短位置收缩，训练前多做大腿前侧的动态拉伸。"
      },
      {
        "problem": "无法在地面撑起",
        "fix": "地面需要更强的肩胛下沉和前推力，先在双杠上熟练掌握。"
      }
    ],
    "standards": {
      "beginner": "保持5秒",
      "intermediate": "3组 × 15秒",
      "upgrade": "3组 × 20秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [5, 20],
      "restSeconds": 120,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 2
    }
  },
  {
    "id": "ls_04",
    "name": "分腿V支撑",
    "nameEn": "Straddle V-Sit",
    "category": "l_sit",
    "categoryLabel": "L支撑",
    "step": 4,
    "source": "现代街头健身进阶体系",
    "riskLevel": "medium",
    "equipment": ["双杠或地面"],
    "equipmentTags": ["parallettes", "floor"],
    "isHold": true,
    "purpose": "大幅提升髋部灵活性和髋屈肌在极端角度的发力能力，重心后移。",
    "keyPoints": [
      "双腿向两侧大张并尽可能向上抬高，脚尖超过头部高度。",
      "身体躯干略微后倾，双手顺势向前推地/推杠以维持平衡。",
      "背部适度圆润，核心极致压缩。",
      "大腿前侧与下腹部感受强烈的收缩感。"
    ],
    "commonIssues": [
      {
        "problem": "腿抬不高",
        "fix": "大腿后侧（腘绳肌）柔韧性不足限制了髋屈角，需加强坐姿体前屈等拉伸。"
      }
    ],
    "standards": {
      "beginner": "保持5秒",
      "intermediate": "3组 × 10秒",
      "upgrade": "3组 × 15秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [5, 15],
      "restSeconds": 120,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 2
    }
  },
  {
    "id": "ls_05",
    "name": "完全V支撑",
    "nameEn": "Full V-Sit",
    "category": "l_sit",
    "categoryLabel": "L支撑",
    "step": 5,
    "source": "现代街头健身进阶体系",
    "riskLevel": "high",
    "equipment": ["双杠或地面"],
    "equipmentTags": ["parallettes", "floor"],
    "isHold": true,
    "purpose": "不仅需要极强的核心与髋部力量，还需要极佳的柔韧性（腘绳肌），身体折叠成“V”字。",
    "keyPoints": [
      "双腿并拢伸直，强力向上抬起，尽可能贴近胸部甚至脸部。",
      "臀部前推，双手重心相对靠后，依靠极强的肩部下沉维持身体浮空。",
      "骨盆呈现极度后倾，脊柱处于安全弯曲状态（核心抱紧）。",
      "双臂完全伸直锁定，肩胛骨承受巨大支撑负荷。"
    ],
    "commonIssues": [
      {
        "problem": "重心向后摔倒",
        "fix": "手掌的发力方向不对，手指需要抓紧地面或双杠，控制身体前后重心的微调。"
      }
    ],
    "standards": {
      "beginner": "保持3秒",
      "intermediate": "3组 × 8秒",
      "upgrade": "3组 × 12秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [3, 12],
      "restSeconds": 150,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 3
    }
  },

  // --- Human Flag (人体旗帜) ---
  {
    "id": "hf_01",
    "name": "垂直旗帜",
    "nameEn": "Vertical Flag",
    "category": "human_flag",
    "categoryLabel": "人体旗帜",
    "step": 1,
    "source": "现代街头健身进阶体系",
    "riskLevel": "low",
    "equipment": ["竖杆"],
    "equipmentTags": ["vertical pole"],
    "isHold": true,
    "purpose": "熟悉旗帜握法（上方拉，下方推）和侧腹肌发力感知。",
    "keyPoints": [
      "面对竖杆站立，上方手正握拉杆，下方手反握（或虎口朝下）推杆。",
      "双腿蹬地起跳，将身体倒置，臀部朝上，身体靠在杆子上。",
      "双臂完全伸直，上方肩胛骨下沉，下方肩胛骨上提推死。",
      "核心收紧，感受背阔肌、三角肌侧束以及腹外斜肌的协同发力。"
    ],
    "commonIssues": [
      {
        "problem": "下方手臂弯曲",
        "fix": "下方手臂必须完全伸直死锁，依靠骨骼支撑重量，不能用肌肉死顶。"
      }
    ],
    "standards": {
      "beginner": "保持5秒",
      "intermediate": "3组 × 15秒",
      "upgrade": "3组 × 20秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [5, 20],
      "restSeconds": 90,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 1
    }
  },
  {
    "id": "hf_02",
    "name": "收腿人体旗帜",
    "nameEn": "Tuck Human Flag",
    "category": "human_flag",
    "categoryLabel": "人体旗帜",
    "step": 2,
    "source": "现代街头健身进阶体系",
    "riskLevel": "medium",
    "equipment": ["竖杆"],
    "equipmentTags": ["vertical pole"],
    "isHold": true,
    "purpose": "建立侧向悬空的推拉对抗平衡，大幅增加侧腰和上肢负荷。",
    "keyPoints": [
      "从垂直旗帜下放，或者直接从地面起跳进入水平状态。",
      "双膝弯曲收拢，躯干侧向平行于地面，胸腔打开面朝侧方。",
      "上方手用力拉（背阔肌发力），下方手用力推（三角肌发力）。",
      "侧腹（腹内外斜肌）和腰方肌强力收缩，维持身体不掉落。"
    ],
    "commonIssues": [
      {
        "problem": "身体向前后翻转不稳",
        "fix": "推拉两侧的力量不平衡，注意胸腔保持侧开，视线看向正前方。"
      }
    ],
    "standards": {
      "beginner": "保持5秒",
      "intermediate": "3组 × 10秒",
      "upgrade": "3组 × 15秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [5, 15],
      "restSeconds": 120,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 2
    }
  },
  {
    "id": "hf_03",
    "name": "分腿人体旗帜",
    "nameEn": "Straddle Human Flag",
    "category": "human_flag",
    "categoryLabel": "人体旗帜",
    "step": 3,
    "source": "现代街头健身进阶体系",
    "riskLevel": "high",
    "equipment": ["竖杆"],
    "equipmentTags": ["vertical pole"],
    "isHold": true,
    "purpose": "打开髋部，力臂增加，侧链核心肌肉承受巨大挑战。",
    "keyPoints": [
      "双腿呈大字型分叉，上方腿向上，下方腿向下前展，维持骨盆侧向水平。",
      "身体躯干严格平行于地面，绝不塌腰下掉。",
      "下方推力手臂关节死锁，承受身体大部分重量；上方拉力手像挂钩一样钩住杆。",
      "背阔肌、腰方肌、臀中肌形成侧向动力链的强力收缩。"
    ],
    "commonIssues": [
      {
        "problem": "侧腰塌陷",
        "fix": "核心侧链力量不足，可通过侧平板支撑加负重或旗帜离心训练强化。"
      }
    ],
    "standards": {
      "beginner": "保持3秒",
      "intermediate": "3组 × 8秒",
      "upgrade": "3组 × 12秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [3, 12],
      "restSeconds": 150,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 3
    }
  },
  {
    "id": "hf_04",
    "name": "完全人体旗帜",
    "nameEn": "Full Human Flag",
    "category": "human_flag",
    "categoryLabel": "人体旗帜",
    "step": 4,
    "source": "现代街头健身进阶体系",
    "riskLevel": "high",
    "equipment": ["竖杆"],
    "equipmentTags": ["vertical pole"],
    "isHold": true,
    "purpose": "街健五大神技之一，对抗地心引力的侧向极简展现。",
    "keyPoints": [
      "双腿完全并拢伸直，身体从头到脚形成一条平行于地面的直线。",
      "上下手臂推拉极致对抗，肩胛骨牢牢锁定。",
      "身体不可过度倾斜，胸脯正对前方，完美侧面悬空。",
      "全身肌肉包括小腿和脚尖都要紧绷，形成刚体状态。"
    ],
    "commonIssues": [
      {
        "problem": "下方肩膀痛",
        "fix": "这是因为推力不足导致肩袖承受不正常压力，需加强倒立撑或停止训练休息。"
      }
    ],
    "standards": {
      "beginner": "保持3秒",
      "intermediate": "3组 × 5秒",
      "upgrade": "3组 × 10秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "holdRange": [3, 10],
      "restSeconds": 180,
      "tempoDescription": "保持·控制呼吸",
      "rirTarget": 3
    }
  }
];

module.exports = exercisesSkills;
