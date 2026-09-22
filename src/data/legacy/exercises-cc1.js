/**
 * 第一册《失传的技艺》经典六艺动作数据
 * 包含：六艺经典60主式 + 3项经典辅助 + 33项全量超越第十式魔鬼级变式 (共 96 式)
 */

const exercisesCC1 = [
  {
    "id": "push_01",
    "name": "墙壁俯卧撑",
    "nameEn": "Wall Push-ups",
    "category": "push",
    "categoryLabel": "俯卧撑",
    "step": 1,
    "source": "第一册第五章第一式",
    "riskLevel": "low",
    "equipment": [
      "墙面"
    ],
    "equipmentTags": [
      "wall"
    ],
    "purpose": "建立基础推力控制，重塑肩肘与腕部关节，完全零基础起点",
    "keyPoints": [
      "双脚并拢，面墙一臂距离站立",
      "双手掌心贴墙，与肩同宽、平齐",
      "缓慢屈肘下压至前额轻触墙面",
      "匀速推回至手臂微屈，全程核心收紧"
    ],
    "commonIssues": [
      {
        "problem": "手腕压迫感",
        "fix": "手掌可略微向外偏转10度"
      },
      {
        "problem": "塌腰借力",
        "fix": "收缩臀部和腹部，保持躯干笔直"
      }
    ],
    "standards": {
      "beginner": "1组 × 10次",
      "intermediate": "2组 × 25次",
      "upgrade": "3组 × 50次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        15,
        30
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "push_02",
    "name": "上斜俯卧撑",
    "nameEn": "Incline Push-ups",
    "category": "push",
    "categoryLabel": "俯卧撑",
    "step": 2,
    "source": "第一册第五章第二式",
    "riskLevel": "low",
    "equipment": [
      "稳固支撑面(桌/椅)"
    ],
    "equipmentTags": [
      "support",
      "chair"
    ],
    "purpose": "增大躯干倾斜角度，逐步增加上肢与肩带负荷",
    "keyPoints": [
      "双手撑在稳固台面边缘，间距与肩同宽",
      "双脚后撤并拢，身体呈直线",
      "缓慢下降至胸口轻触台沿边缘",
      "推起时呼气，肘关节保持微屈避免死锁"
    ],
    "commonIssues": [
      {
        "problem": "支撑物晃动",
        "fix": "选择承重可靠、不滑动的桌椅台面"
      },
      {
        "problem": "撅屁股",
        "fix": "骨盆微后倾，夹紧臀大肌"
      }
    ],
    "standards": {
      "beginner": "1组 × 10次",
      "intermediate": "2组 × 20次",
      "upgrade": "3组 × 40次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        10,
        25
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "push_03",
    "name": "膝盖俯卧撑",
    "nameEn": "Kneeling Push-ups",
    "category": "push",
    "categoryLabel": "俯卧撑",
    "step": 3,
    "source": "第一册第五章第三式",
    "riskLevel": "low",
    "equipment": [
      "地面(垫子)"
    ],
    "equipmentTags": [
      "floor",
      "mat"
    ],
    "purpose": "躯干进入水平位，提升胸肌与肱三头肌中等负荷做功能力",
    "keyPoints": [
      "双膝着地支撑，小腿微交叉离地",
      "大腿与躯干保持同一平面",
      "平稳下降至胸口距地面约一拳",
      "推起至初始位置，保持下颌微收"
    ],
    "commonIssues": [
      {
        "problem": "膝盖摩擦疼痛",
        "fix": "膝下方垫毛巾或瑜伽垫"
      },
      {
        "problem": "颈部过度前伸",
        "fix": "眼睛看向地面，颈椎保持中立"
      }
    ],
    "standards": {
      "beginner": "1组 × 10次",
      "intermediate": "2组 × 15次",
      "upgrade": "3组 × 30次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        10,
        20
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "push_04",
    "name": "半俯卧撑",
    "nameEn": "Half Push-ups",
    "category": "push",
    "categoryLabel": "俯卧撑",
    "step": 4,
    "source": "第一册第五章第四式",
    "riskLevel": "medium",
    "equipment": [
      "地面",
      "篮球/砖块"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "建立标准平板支撑长杠杆躯干能力，专注于上部行程发力",
    "keyPoints": [
      "以标准俯卧撑姿态支撑，骨盆与躯干锁定",
      "可在胸下放一篮球或抱枕限制深度",
      "缓慢下降至轻触球体（大臂约与地面平行）",
      "发力推起，训练全程保持肩胛稳定"
    ],
    "commonIssues": [
      {
        "problem": "借惯性反弹",
        "fix": "触球瞬间停顿0.5秒，完全自主控制"
      }
    ],
    "standards": {
      "beginner": "1组 × 8次",
      "intermediate": "2组 × 12次",
      "upgrade": "2组 × 25次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        8,
        15
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "push_05",
    "name": "标准俯卧撑",
    "nameEn": "Full Push-ups",
    "category": "push",
    "categoryLabel": "俯卧撑",
    "step": 5,
    "source": "第一册第五章第五式",
    "riskLevel": "medium",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "自重健身核心基石动作，全面强化胸、肩、肱三头肌与腹背核心",
    "keyPoints": [
      "双手撑地，双脚并拢，身体成笔直长杠杆",
      "吸气缓慢下降至胸口距地面约一拳厚度",
      "手肘自然向后约45度夹角下沉",
      "发力推回原位，顶峰处保持胸肌张力"
    ],
    "commonIssues": [
      {
        "problem": "肘关节外展过度(90度)",
        "fix": "手肘贴向身体两侧后方呈箭头形"
      },
      {
        "problem": "核心松懈塌腰",
        "fix": "收腹提臀，脊柱拉长"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次",
      "intermediate": "2组 × 10次",
      "upgrade": "2组 × 20次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        6,
        15
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "push_06",
    "name": "窄距俯卧撑",
    "nameEn": "Close Push-ups",
    "category": "push",
    "categoryLabel": "俯卧撑",
    "step": 6,
    "source": "第一册第五章第六式",
    "riskLevel": "medium",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "将负荷高度集中至肱三头肌与胸大肌内侧，为单臂推力打下肘臂基础",
    "keyPoints": [
      "双手食指与拇指靠近（相距约两寸）",
      "身体保持一条刚性直线",
      "缓慢下压，手臂紧贴身体两侧下降至胸口触手背",
      "推起时强调三头肌完全发力收缩"
    ],
    "commonIssues": [
      {
        "problem": "手腕内侧压迫过甚",
        "fix": "双手间距可先留一掌宽，逐渐过渡"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次",
      "intermediate": "2组 × 10次",
      "upgrade": "2组 × 20次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        5,
        12
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "push_07",
    "name": "偏重俯卧撑",
    "nameEn": "Uneven Push-ups",
    "category": "push",
    "categoryLabel": "俯卧撑",
    "step": 7,
    "source": "第一册第五章第七式",
    "riskLevel": "medium",
    "equipment": [
      "地面",
      "篮球/砖块"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "开始单侧不对称训练，将约70%的自重负荷施加在主发力手臂上",
    "keyPoints": [
      "一掌撑地作为主发力侧，另一手撑在篮球或砖块上辅助",
      "双脚与肩同宽或略宽以保持平衡",
      "下压至胸部靠近地面手背，主手承担主要推力",
      "推至顶峰，左右交替均等组数"
    ],
    "commonIssues": [
      {
        "problem": "躯干严重侧翻",
        "fix": "加强核心抗旋转控制，保持肩线与地面平行"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次 (每侧)",
      "intermediate": "2组 × 10次",
      "upgrade": "2组 × 20次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        5,
        10
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "push_08",
    "name": "单臂半俯卧撑",
    "nameEn": "1/2 One-Arm Push-ups",
    "category": "push",
    "categoryLabel": "俯卧撑",
    "step": 8,
    "source": "第一册第五章第八式",
    "riskLevel": "high",
    "equipment": [
      "地面",
      "篮球/支撑物"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "真正进入单手支撑推力阶段，掌握单手承重的躯干稳定性",
    "keyPoints": [
      "单手撑地，另一只手背在腰后",
      "双脚间距大约两倍肩宽以形成三脚架稳定底座",
      "胸下放置篮球限制下降幅度（完成前半段行程）",
      "平稳推起，控制身体不要翻转"
    ],
    "commonIssues": [
      {
        "problem": "骨盆倾斜翻转",
        "fix": "双脚适当拉开距离，强化侧向支撑"
      }
    ],
    "standards": {
      "beginner": "1组 × 4次 (每侧)",
      "intermediate": "2组 × 8次",
      "upgrade": "2组 × 20次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        4,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "push_09",
    "name": "杠杆俯卧撑",
    "nameEn": "Lever Push-ups",
    "category": "push",
    "categoryLabel": "俯卧撑",
    "step": 9,
    "source": "第一册第五章第九式",
    "riskLevel": "high",
    "equipment": [
      "地面",
      "篮球/光滑地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "辅手完全向侧面伸直（形成外力杠杆），主手几乎承担全部自重下压推力",
    "keyPoints": [
      "主手在胸前撑地，副手向侧方完全伸直按在篮球或毛巾上",
      "缓慢下降至胸口几乎贴地",
      "主臂承受极致负荷后推起，副臂仅起极微弱平衡作用"
    ],
    "commonIssues": [
      {
        "problem": "副手臂弯曲借力",
        "fix": "确保副手臂全程保持笔直伸展"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (每侧)",
      "intermediate": "2组 × 6次",
      "upgrade": "2组 × 20次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        3,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "push_10",
    "name": "单臂俯卧撑",
    "nameEn": "One-Arm Push-ups",
    "category": "push",
    "categoryLabel": "俯卧撑",
    "step": 10,
    "isFinal": true,
    "source": "第一册第五章第十式 (终极式)",
    "riskLevel": "high",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "俯卧撑终极式！自重上肢推力皇冠，极致的力量、核心抗旋转与绝对控制",
    "keyPoints": [
      "单手掌心撑在胸下方，另一只手背在身后",
      "双脚分开保持身体水平平衡",
      "平稳下降直到下巴离地面一拳",
      "爆炸力结合绝对控制平稳推起至手臂伸直"
    ],
    "commonIssues": [
      {
        "problem": "借扭胯惯性推起",
        "fix": "动作放慢，全程保证肌肉张力持续存在"
      }
    ],
    "standards": {
      "beginner": "1组 × 1次 (每侧)",
      "intermediate": "2组 × 5次",
      "upgrade": "1组 × 100次 (大师级)"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        2,
        5
      ],
      "restSeconds": 120,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "push_demon_01",
    "name": "单臂击掌俯卧撑",
    "nameEn": "One-Arm Clapping Push-ups",
    "category": "push",
    "categoryLabel": "俯卧撑",
    "step": 11,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 1 式",
    "source": "第一册第五章变式",
    "riskLevel": "high",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "俯卧撑弹震式与纯力量的终极结合，单臂推起身体腾空并在半空中击掌",
    "keyPoints": [
      "单手支撑，双脚分开稳固三角底座",
      "身体笔直下潜至胸部离地面一拳",
      "倾注全身爆发力单臂将躯干暴发推离地面，在腾空瞬间另一只手快速击掌并回防接住身体",
      "极度考验神经反射与推力峰值做功"
    ],
    "commonIssues": [
      {
        "problem": "落地冲击过大",
        "fix": "单臂接住地面时肘关节必须微屈顺势缓冲，严禁直臂硬碰"
      }
    ],
    "standards": {
      "beginner": "1组 × 1次 (每侧)",
      "intermediate": "2组 × 3次",
      "upgrade": "2组 × 6次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        1,
        3
      ],
      "restSeconds": 150,
      "tempoDescription": "蓄力下潜·极限爆发击掌",
      "rirTarget": 2
    }
  },
  {
    "id": "push_demon_02",
    "name": "蜥蜴俯卧撑",
    "nameEn": "Lizard Push-ups",
    "category": "push",
    "categoryLabel": "俯卧撑",
    "step": 12,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 2 式",
    "source": "第一册第五章变式",
    "riskLevel": "high",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "对角单手单脚悬空俯卧撑，摧毁性的核心抗旋转与单侧推力掌控",
    "keyPoints": [
      "一臂向前完全平伸悬空，对侧单腿向后上方抬起悬空",
      "仅靠单手单脚对角线支撑身体",
      "缓慢屈肘下降至胸口几乎贴地，暂停一秒再纯力量推回",
      "两侧对称练习"
    ],
    "commonIssues": [
      {
        "problem": "骨盆剧烈倾斜翻转",
        "fix": "核心如钢板紧绷，下背部与臀肌持续施加稳定力矩"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (每侧)",
      "intermediate": "2组 × 5次",
      "upgrade": "2组 × 10次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        2,
        5
      ],
      "restSeconds": 120,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "push_demon_03",
    "name": "老派负重单臂俯卧撑",
    "nameEn": "Weighted One-Arm Push-ups",
    "category": "push",
    "categoryLabel": "俯卧撑",
    "step": 13,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 3 式",
    "source": "第一册第五章更上一层楼",
    "riskLevel": "high",
    "equipment": [
      "负重哑铃/铁块"
    ],
    "equipmentTags": [
      "support"
    ],
    "purpose": "背手手持沉重哑铃或重物做标准单臂俯卧撑，真正铁人级别的终极推力",
    "keyPoints": [
      "背在身后的手紧握哑铃或重物置于背部中轴",
      "支撑手稳固支撑，双脚分开略宽于髋部",
      "匀速缓慢下潜，杜绝任何身体扭曲代偿",
      "液压机般平稳推回顶点"
    ],
    "commonIssues": [
      {
        "problem": "重物滑落或偏沉",
        "fix": "选用稳固哑铃贴紧后背中线，先从轻负重起步"
      }
    ],
    "standards": {
      "beginner": "1组 × 1次 (每侧)",
      "intermediate": "2组 × 3次",
      "upgrade": "2组 × 5次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        1,
        3
      ],
      "restSeconds": 150,
      "tempoDescription": "3秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "push_demon_04",
    "name": "超人俯卧撑",
    "nameEn": "Superman Push-ups",
    "category": "push",
    "categoryLabel": "俯卧撑",
    "step": 14,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 4 式",
    "source": "第一册第五章变式",
    "riskLevel": "high",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "双手平放于头顶前方极远地板，超长力臂极大压迫胸小肌、上胸部与背阔肌",
    "keyPoints": [
      "双手向前大幅度伸出超出头部数尺，手臂接近完全平伸",
      "脚尖着地，身体紧绷如长矛",
      "小幅度缓慢屈臂下沉胸腔，再以极长力矩纯胸背肌力强力推起",
      "核心与腰背全程锁紧"
    ],
    "commonIssues": [
      {
        "problem": "腰椎下塌塌陷",
        "fix": "腹肌紧缩保持骨盆后倾，力臂过长时先缩短伸展距离"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次",
      "intermediate": "2组 × 6次",
      "upgrade": "2组 × 15次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "push_demon_05",
    "name": "单臂双杠屈臂撑",
    "nameEn": "One-Arm Dips",
    "category": "push",
    "categoryLabel": "俯卧撑",
    "step": 15,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 5 式",
    "source": "第一册第五章变式与更上一层楼",
    "riskLevel": "high",
    "equipment": [
      "稳固双杠/单杠"
    ],
    "equipmentTags": [
      "bar",
      "support"
    ],
    "purpose": "单臂支撑全身垂直下压屈伸，考验极强的肘关节韧带与肱三头肌单侧爆发力",
    "keyPoints": [
      "单手紧握单杠或稳固双杠一侧，身体悬空垂直微倾",
      "非发力手臂紧贴躯干平衡",
      "控制下降至上臂与地面接近平行",
      "纯单臂向后下压将身体推回原位"
    ],
    "commonIssues": [
      {
        "problem": "肩关节不稳摇晃",
        "fix": "全程沉肩锁紧肩胛下压肌群，避免在最低点失控自由落体"
      }
    ],
    "standards": {
      "beginner": "1组 × 1次 (每侧)",
      "intermediate": "2组 × 3次",
      "upgrade": "2组 × 6次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        1,
        3
      ],
      "restSeconds": 150,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "push_demon_06",
    "name": "行走俯卧撑",
    "nameEn": "Walking Push-ups",
    "category": "push",
    "categoryLabel": "俯卧撑",
    "step": 16,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 6 式",
    "source": "第四册额外章节二·十二金刚",
    "riskLevel": "high",
    "equipment": [
      "平整开阔地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "双手交替前后行走做推力，迫使胸肌与三角肌从多变未知角度承受压力",
    "keyPoints": [
      "标准俯卧撑姿势下潜一次推起",
      "单臂承重，另一只手向前移动6英寸下潜一次",
      "两手交替前进推起，核心与全身肌肉高度协同",
      "重复直至极度力竭"
    ],
    "commonIssues": [
      {
        "problem": "步伐凌乱节奏丧失",
        "fix": "保持匀速呼吸，每一步推起到最高点后再移动手掌"
      }
    ],
    "standards": {
      "beginner": "1组 × 10步",
      "intermediate": "2组 × 20步",
      "upgrade": "2组 × 40步"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        15,
        30
      ],
      "restSeconds": 120,
      "tempoDescription": "匀速行进·力竭为止",
      "rirTarget": 1
    }
  },
  {
    "id": "squat_01",
    "name": "肩倒立深蹲",
    "nameEn": "Shoulderstand Squats",
    "category": "squat",
    "categoryLabel": "深蹲",
    "step": 1,
    "source": "第一册第六章第一式",
    "riskLevel": "low",
    "equipment": [
      "地面(垫子)"
    ],
    "equipmentTags": [
      "floor",
      "mat"
    ],
    "purpose": "消除重力压迫，通过倒立屈膝修复膝关节与下肢韧带，改善血液回流",
    "keyPoints": [
      "平躺屈膝，双手托腰将下半身顶起成肩倒立",
      "双腿朝天伸展，缓慢屈膝下落至大腿轻触胸腹部",
      "发力将双腿重新完全伸直朝天"
    ],
    "commonIssues": [
      {
        "problem": "颈部压迫",
        "fix": "重量落在肩膀后侧与上背部，不要压在颈椎"
      }
    ],
    "standards": {
      "beginner": "1组 × 10次",
      "intermediate": "2组 × 25次",
      "upgrade": "3组 × 50次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        15,
        30
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "squat_02",
    "name": "折刀深蹲",
    "nameEn": "Jackknife Squats",
    "category": "squat",
    "categoryLabel": "深蹲",
    "step": 2,
    "source": "第一册第六章第二式",
    "riskLevel": "low",
    "equipment": [
      "稳固支撑物(床/桌)"
    ],
    "equipmentTags": [
      "support",
      "chair"
    ],
    "purpose": "结合手臂辅助减压，建立完整深蹲幅度与踝关节、髋部柔韧性",
    "keyPoints": [
      "站在支撑物前，双手按在台面边缘分担一部分体重",
      "双脚与肩同宽，缓慢下蹲至臀大肌触及小腿后侧",
      "借助腿部主要力量与手臂轻微拉力推起"
    ],
    "commonIssues": [
      {
        "problem": "脚后跟离地",
        "fix": "保持重心落在脚跟，双脚掌紧贴地面"
      }
    ],
    "standards": {
      "beginner": "1组 × 10次",
      "intermediate": "2组 × 20次",
      "upgrade": "3组 × 40次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        10,
        20
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "squat_03",
    "name": "支撑深蹲",
    "nameEn": "Supported Squats",
    "category": "squat",
    "categoryLabel": "深蹲",
    "step": 3,
    "source": "第一册第六章第三式",
    "riskLevel": "low",
    "equipment": [
      "稳固立柱/门框/椅背"
    ],
    "equipmentTags": [
      "chair",
      "doorframe"
    ],
    "purpose": "仅用两指或单手轻搭辅助物防后摔，下肢承受近全额负荷并完成全幅度下蹲",
    "keyPoints": [
      "双脚与肩同宽，脚尖微向外展",
      "双手轻扶立柱或椅背，缓慢下蹲至大腿后侧触小腿",
      "依靠双腿力量蹬地站起，手臂仅做平衡辅助"
    ],
    "commonIssues": [
      {
        "problem": "手臂拉力过大",
        "fix": "仅在站起最困难时轻微借力，强迫双腿承重"
      }
    ],
    "standards": {
      "beginner": "1组 × 10次",
      "intermediate": "2组 × 15次",
      "upgrade": "3组 × 30次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        10,
        15
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "squat_04",
    "name": "半深蹲",
    "nameEn": "Half Squats",
    "category": "squat",
    "categoryLabel": "深蹲",
    "step": 4,
    "source": "第一册第六章第四式",
    "riskLevel": "low",
    "equipment": [
      "无器械"
    ],
    "equipmentTags": [
      "none",
      "floor"
    ],
    "purpose": "脱离一切外部支撑，独立建立站姿平衡与大腿前侧力量",
    "keyPoints": [
      "双脚与肩同宽，双手可环抱胸前或前平举",
      "下蹲至大腿与地面平行（膝关节呈90度）",
      "平稳发力蹬起至身体直立，膝盖不反锁"
    ],
    "commonIssues": [
      {
        "problem": "膝盖内扣",
        "fix": "膝盖方向始终对准脚尖第二脚趾"
      }
    ],
    "standards": {
      "beginner": "1组 × 8次",
      "intermediate": "2组 × 35次",
      "upgrade": "2组 × 50次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        12,
        25
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "squat_05",
    "name": "标准深蹲",
    "nameEn": "Full Squats",
    "category": "squat",
    "categoryLabel": "深蹲",
    "step": 5,
    "source": "第一册第六章第五式",
    "riskLevel": "low",
    "equipment": [
      "无器械"
    ],
    "equipmentTags": [
      "none",
      "floor"
    ],
    "purpose": "自重下肢经典标准，全幅度蹲起强化臀部、股四头肌与骨盆稳定",
    "keyPoints": [
      "双脚与肩同宽或略宽，脊柱保持自然挺直",
      "缓慢下蹲直至大腿后侧完全接触小腿，保持全幅度",
      "脚跟牢牢抓地，臀部与股四头肌协同发力蹬起"
    ],
    "commonIssues": [
      {
        "problem": "骨盆眨眼弯腰",
        "fix": "挺胸保持胸椎伸展，视线平视前方"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次",
      "intermediate": "2组 × 10次",
      "upgrade": "2组 × 30次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        10,
        20
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "squat_06",
    "name": "窄距深蹲",
    "nameEn": "Close Squats",
    "category": "squat",
    "categoryLabel": "深蹲",
    "step": 6,
    "source": "第一册第六章第六式",
    "riskLevel": "medium",
    "equipment": [
      "无器械"
    ],
    "equipmentTags": [
      "none",
      "floor"
    ],
    "purpose": "双脚并拢，负荷完全转移到股四头肌并对膝关节韧带和踝屈柔韧提出高要求",
    "keyPoints": [
      "双脚脚跟并拢，脚尖可微向外张",
      "下蹲时膝盖并拢并前移，蹲至最深处",
      "平稳推起，极大考验踝关节折叠度与股外侧肌"
    ],
    "commonIssues": [
      {
        "problem": "后摔倒地",
        "fix": "前平举手臂保持重心，必要时在脚跟微垫薄片过渡"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次",
      "intermediate": "2组 × 10次",
      "upgrade": "2组 × 20次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        8,
        15
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "squat_07",
    "name": "偏重深蹲",
    "nameEn": "Uneven Squats",
    "category": "squat",
    "categoryLabel": "深蹲",
    "step": 7,
    "source": "第一册第六章第七式",
    "riskLevel": "medium",
    "equipment": [
      "篮球/垫块"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "将一只脚垫高或踩在篮球上，主工作腿承担大部分自重负荷",
    "keyPoints": [
      "一脚平放地面为主腿，另一脚踩在球上辅助平衡",
      "主腿全幅度下蹲至大腿贴小腿",
      "主腿发力站起，逐步适应单侧承重"
    ],
    "commonIssues": [
      {
        "problem": "副腿过度蹬地",
        "fix": "副腿仅脚尖轻触球体，强调主腿自主发力"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次 (每侧)",
      "intermediate": "2组 × 10次",
      "upgrade": "2组 × 20次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        6,
        12
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "squat_08",
    "name": "单腿半深蹲",
    "nameEn": "1/2 One-Leg Squats",
    "category": "squat",
    "categoryLabel": "深蹲",
    "step": 8,
    "source": "第一册第六章第八式",
    "riskLevel": "medium",
    "equipment": [
      "椅子/高凳"
    ],
    "equipmentTags": [
      "chair"
    ],
    "purpose": "单腿完全离地向前伸展，训练单腿上段行程的绝对爆发力量与核心平稳",
    "keyPoints": [
      "单腿站立，非工作腿向前伸直悬空",
      "缓慢下蹲直到臀部轻触后方椅子（大腿约与地面平行）",
      "工作腿脚后跟用力蹬地站起，全程非工作腿不落地"
    ],
    "commonIssues": [
      {
        "problem": "落座砸击",
        "fix": "接触椅子时如羽毛轻触，严禁完全坐下卸力"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次 (每侧)",
      "intermediate": "2组 × 10次",
      "upgrade": "2组 × 20次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        5,
        10
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "squat_09",
    "name": "单腿辅助深蹲",
    "nameEn": "Assisted One-Leg Squats",
    "category": "squat",
    "categoryLabel": "深蹲",
    "step": 9,
    "source": "第一册第六章第九式",
    "riskLevel": "high",
    "equipment": [
      "篮球/立柱/篮球"
    ],
    "equipmentTags": [
      "floor",
      "support"
    ],
    "purpose": "打通单腿全幅度下蹲最低点（深坑区）的关节锁死与起力瓶颈",
    "keyPoints": [
      "单腿站立前伸非工作腿，单手扶桌沿或立柱",
      "平稳下蹲至单腿最深处（大腿后侧贴小腿）",
      "依靠腿部极限力量推起，手臂仅做最微小辅助助力"
    ],
    "commonIssues": [
      {
        "problem": "身体剧烈侧扭",
        "fix": "保持胸腔朝正前方，重心牢牢落在支撑腿脚跟"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (每侧)",
      "intermediate": "2组 × 6次",
      "upgrade": "2组 × 20次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        3,
        6
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "squat_10",
    "name": "单腿深蹲",
    "nameEn": "One-Leg Squats (Pistol)",
    "category": "squat",
    "categoryLabel": "深蹲",
    "step": 10,
    "isFinal": true,
    "source": "第一册第六章第十式 (终极式)",
    "riskLevel": "high",
    "equipment": [
      "无器械"
    ],
    "equipmentTags": [
      "none",
      "floor"
    ],
    "purpose": "深蹲终极式！神级下肢力量与惊人平衡，彻底甩掉杠铃摧毁膝盖的风险",
    "keyPoints": [
      "单脚站立，另一腿笔直向前平举悬空",
      "缓慢深蹲直至臀部贴小腿后侧，停顿片刻展示从容控制",
      "单腿全力蹬起至完全直立，动作如液压机般平顺稳定"
    ],
    "commonIssues": [
      {
        "problem": "身体摇摆晃动",
        "fix": "双臂前伸保持动态平衡，脚趾用力抓地"
      }
    ],
    "standards": {
      "beginner": "1组 × 1次 (每侧)",
      "intermediate": "2组 × 5次",
      "upgrade": "2组 × 50次 (大师级)"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        2,
        5
      ],
      "restSeconds": 120,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "squat_demon_01",
    "name": "单腿跳箱深蹲",
    "nameEn": "One-Leg Box Jump Squat",
    "category": "squat",
    "categoryLabel": "深蹲",
    "step": 11,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 1 式",
    "source": "第一册第六章更上一层楼",
    "riskLevel": "high",
    "equipment": [
      "稳固跳箱/高台"
    ],
    "equipmentTags": [
      "support"
    ],
    "purpose": "下肢活塞爆发力与动态平衡的巅峰，深蹲到底后单腿全力跃上高箱",
    "keyPoints": [
      "单腿全幅下蹲至臀部贴紧小腿后侧",
      "在最底端消除反弹，完全依靠单侧股四头肌与臀肌纯发力向上爆发起跳",
      "跃上跳箱后仍以单腿稳稳缓冲落地，另一腿全程悬空不沾地"
    ],
    "commonIssues": [
      {
        "problem": "落地重心不稳",
        "fix": "跳箱高度由低起步，着地膝关节顺向深度屈曲缓冲"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (每侧)",
      "intermediate": "2组 × 4次",
      "upgrade": "2组 × 8次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        2,
        4
      ],
      "restSeconds": 120,
      "tempoDescription": "慢下潜·瞬间起跳·轻盈落地",
      "rirTarget": 2
    }
  },
  {
    "id": "squat_demon_02",
    "name": "老派负重单腿蹲",
    "nameEn": "Weighted Pistol Squats",
    "category": "squat",
    "categoryLabel": "深蹲",
    "step": 12,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 2 式",
    "source": "第一册第六章更上一层楼 (老派大力士阿瑟拉缇式)",
    "riskLevel": "high",
    "equipment": [
      "负重哑铃/壶铃"
    ],
    "equipmentTags": [
      "support"
    ],
    "purpose": "在单腿全幅深蹲基础上施加大负荷，打造超越常人极限的钢铁活塞双腿",
    "keyPoints": [
      "双手在胸前紧抱沉重哑铃或重物（20~50kg）",
      "单腿直立，非发力腿前伸锁死",
      "平稳匀速下潜至大腿完全折叠，背部挺拔中立",
      "液压机般推回完全站立，膝盖不内扣"
    ],
    "commonIssues": [
      {
        "problem": "腰背弯曲代偿",
        "fix": "负重紧贴胸口中轴线，核心保持极致腹压"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (每侧)",
      "intermediate": "2组 × 6次",
      "upgrade": "2组 × 12次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "3秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "squat_demon_03",
    "name": "虾式深蹲",
    "nameEn": "Shrimp Squats",
    "category": "squat",
    "categoryLabel": "深蹲",
    "step": 13,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 3 式",
    "source": "第四册额外章节二·十二金刚",
    "riskLevel": "high",
    "equipment": [
      "平整地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "单腿直立，手抓后足贴紧臀部，全幅度下蹲至后膝轻点地面，严禁后腿借力",
    "keyPoints": [
      "单腿直立，同侧或对侧手抓紧屈曲小腿脚踝，足跟贴臀",
      "前大腿平稳屈膝下潜，上身尽量不过分前倾",
      "后膝极轻微触碰地面即止，杜绝碰撞借力",
      "前腿臀腿肌群发力液压机般推回完全站立"
    ],
    "commonIssues": [
      {
        "problem": "后脚松脱借力",
        "fix": "手掌死死抓握脚背贴紧臀部，迫使前腿独立做功"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (每侧)",
      "intermediate": "2组 × 6次",
      "upgrade": "2组 × 15次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "squat_demon_04",
    "name": "单腿立定跳远",
    "nameEn": "One-Leg Broad Jump",
    "category": "squat",
    "categoryLabel": "深蹲",
    "step": 14,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 4 式",
    "source": "第一册第六章变式",
    "riskLevel": "high",
    "equipment": [
      "宽敞地面/草地"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "无助跑单腿全幅下蹲爆发跃向远处，起跳腿落地保持绝对平衡不倾倒",
    "keyPoints": [
      "单腿站立，平稳下蹲蓄力",
      "手臂与髋部爆发协同向前上方极力跃出",
      "落地时依然同一条腿触地，膝关节弹性屈曲缓冲",
      "身体绝对锁住平衡，手脚均不落地借力"
    ],
    "commonIssues": [
      {
        "problem": "落地前倾扑倒",
        "fix": "跳跃距离循序渐进，重点在于单腿落地急停吸震"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (每侧)",
      "intermediate": "2组 × 5次",
      "upgrade": "3组 × 8次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        5
      ],
      "restSeconds": 120,
      "tempoDescription": "蓄力下潜·极限飞跃·稳锁落地",
      "rirTarget": 2
    }
  },
  {
    "id": "squat_demon_05",
    "name": "西西弗斯柔式深蹲",
    "nameEn": "Sissy Squat",
    "category": "squat",
    "categoryLabel": "深蹲",
    "step": 15,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 5 式",
    "source": "第一册第六章变式",
    "riskLevel": "high",
    "equipment": [
      "稳固扶手/立柱"
    ],
    "equipmentTags": [
      "support"
    ],
    "purpose": "踮起脚尖、膝关节极限前推、大腿与躯干保持一条直线极度后仰，股四头肌火烧般孤立刺激",
    "keyPoints": [
      "双脚并拢踮起脚尖，膝关节大幅前移下压",
      "髋部完全伸展锁死，躯干向后仰成斜线",
      "下蹲至膝盖弯曲接近90度，最低点暂停一秒",
      "仅靠股四头肌将身体拉回站立"
    ],
    "commonIssues": [
      {
        "problem": "下背部反弓折腰",
        "fix": "腹肌紧锁，髋部保持完全展开，避免腰椎代偿"
      }
    ],
    "standards": {
      "beginner": "1组 × 10次",
      "intermediate": "2组 × 20次",
      "upgrade": "2组 × 40次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        10,
        20
      ],
      "restSeconds": 90,
      "tempoDescription": "3秒慢下·1秒停·2秒拉回",
      "rirTarget": 2
    }
  },
  {
    "id": "squat_demon_06",
    "name": "团身跳",
    "nameEn": "Tuck Jump",
    "category": "squat",
    "categoryLabel": "深蹲",
    "step": 16,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 6 式",
    "source": "第四册额外章节二·十二金刚",
    "riskLevel": "high",
    "equipment": [
      "平整地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "爆发跳起空中双膝高抬贴紧胸口，落地无缝衔接下一次起跳，释放下肢最高神经爆发力",
    "keyPoints": [
      "对称站姿下蹲起跳，在空中瞬间将双膝向胸部极限提起",
      "落地瞬间弹性屈膝缓冲并立即借惯性二次爆发腾空",
      "连续无停顿完成动作，心率与神经系统推至巅峰"
    ],
    "commonIssues": [
      {
        "problem": "落地脚跟硬砸",
        "fix": "前脚掌先行着地顺势过渡，利用跟腱弹性回弹"
      }
    ],
    "standards": {
      "beginner": "1组 × 10次",
      "intermediate": "2组 × 20次",
      "upgrade": "3组 × 30次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        15,
        25
      ],
      "restSeconds": 90,
      "tempoDescription": "疾速弹跳·膝贴胸口",
      "rirTarget": 2
    }
  },
  {
    "id": "pull_01",
    "name": "垂直引体",
    "nameEn": "Vertical Pulls",
    "category": "pull",
    "categoryLabel": "引体向上",
    "step": 1,
    "source": "第一册第七章第一式",
    "riskLevel": "low",
    "equipment": [
      "稳固门框/立柱"
    ],
    "equipmentTags": [
      "doorframe",
      "pole",
      "wall"
    ],
    "purpose": "重塑上肢与肩胛背部拉力链，唤醒长期伏案退化的背阔肌与斜方肌",
    "keyPoints": [
      "面对门框或垂直立柱近距离站立，双手抓住边缘",
      "双脚贴近底座，身体向后微倾伸展手臂",
      "背部发力夹紧肩胛骨，将胸口拉向门框",
      "平稳送回原位，感受背部肌肉收缩与伸展"
    ],
    "commonIssues": [
      {
        "problem": "只用手臂弯曲",
        "fix": "先主动沉肩、肩胛骨后缩，再屈肘拉动"
      }
    ],
    "standards": {
      "beginner": "1组 × 10次",
      "intermediate": "2组 × 20次",
      "upgrade": "3组 × 40次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        15,
        30
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒拉·1秒停·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "pull_02",
    "name": "水平引体向上",
    "nameEn": "Horizontal Pulls (Incline Pulls)",
    "category": "pull",
    "categoryLabel": "引体向上",
    "step": 2,
    "source": "第一册第七章第二式",
    "riskLevel": "low",
    "equipment": [
      "稳固低杠/结实餐桌下沿"
    ],
    "equipmentTags": [
      "lowbar",
      "support",
      "bar"
    ],
    "purpose": "水平仰卧拉力，极佳激活中背部与肱二头肌，承受约50-60%自重",
    "keyPoints": [
      "仰卧于齐腰高度的低杠或桌下，双手抓握边缘",
      "脚跟撑地，身体从头到脚保持紧绷直线",
      "发力将胸骨拉升碰触杠铃或桌边",
      "缓慢下放至手臂微屈，胸腔全程保持挺拔"
    ],
    "commonIssues": [
      {
        "problem": "塌腰坠髋",
        "fix": "收紧核心与臀部，躯干像刚性木板一样同步起落"
      }
    ],
    "standards": {
      "beginner": "1组 × 10次",
      "intermediate": "2组 × 15次",
      "upgrade": "3组 × 30次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        8,
        15
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒拉·1秒停·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "pull_03",
    "name": "折刀引体向上",
    "nameEn": "Jackknife Pulls",
    "category": "pull",
    "categoryLabel": "引体向上",
    "step": 3,
    "source": "第一册第七章第三式",
    "riskLevel": "low",
    "equipment": [
      "单杠",
      "高凳/椅子"
    ],
    "equipmentTags": [
      "bar",
      "chair"
    ],
    "purpose": "脚部垫高辅助卸载部分下肢重量，体验完全垂直悬挂下拉伸展全行程",
    "keyPoints": [
      "双手抓单杠悬挂，双腿前伸将脚跟搁置在椅子上（身体呈折刀角）",
      "背部发力将下巴拉过单杠",
      "平稳下降至双臂几乎完全伸展，双腿仅提供轻量辅助"
    ],
    "commonIssues": [
      {
        "problem": "下半身蹬椅子借力过猛",
        "fix": "腿部仅做支撑接触，专注于背肌收缩"
      }
    ],
    "standards": {
      "beginner": "1组 × 8次",
      "intermediate": "2组 × 12次",
      "upgrade": "3组 × 20次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        8,
        12
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒拉·1秒停·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "pull_04",
    "name": "半引体向上",
    "nameEn": "Half Pullups",
    "category": "pull",
    "categoryLabel": "引体向上",
    "step": 4,
    "source": "第一册第七章第四式",
    "riskLevel": "medium",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "purpose": "双脚完全离地悬空，掌握大臂呈90度至顶点下巴过杠的上半程力量",
    "keyPoints": [
      "双手正握单杠悬垂，身体保持轻微后倾",
      "从手臂屈曲90度位置开始（可借助跳跃或垫脚就位）",
      "全力发力将下巴拉升过杠",
      "缓慢控制下放到90度处再次拉起"
    ],
    "commonIssues": [
      {
        "problem": "耸肩代偿",
        "fix": "肩胛骨深下沉，远离双耳"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次",
      "intermediate": "2组 × 8次",
      "upgrade": "2组 × 15次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        5,
        10
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒拉·1秒停·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "pull_05",
    "name": "标准引体向上",
    "nameEn": "Full Pullups",
    "category": "pull",
    "categoryLabel": "引体向上",
    "step": 5,
    "source": "第一册第七章第五式",
    "riskLevel": "medium",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "purpose": "自重上肢拉力测试皇冠基准！打造雄壮背阔肌、强韧肌腱与铁铸般的抓握力",
    "keyPoints": [
      "双手正握或反握单杠，身体完全悬空静止，拒绝摆荡蹬腿",
      "背阔肌驱动，肩胛下压，手肘向地面拉扯带动躯干上升",
      "下巴完全超过单杠顶端，停顿0.5秒",
      "极缓速度下放至手臂悬垂微屈，全程自主受控"
    ],
    "commonIssues": [
      {
        "problem": "靠摆腿踢浪惯性借力 (Kipping)",
        "fix": "双腿交叉微屈，严格保持死悬垂纯肌力拉起"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次",
      "intermediate": "2组 × 8次",
      "upgrade": "2组 × 10次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        4,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒拉·1秒停·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "pull_06",
    "name": "窄距引体向上",
    "nameEn": "Close Pullups",
    "category": "pull",
    "categoryLabel": "引体向上",
    "step": 6,
    "source": "第一册第七章第六式",
    "riskLevel": "medium",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "purpose": "双手食指间距约10厘米，极大提升肱二头肌与前臂屈肌单侧抗张力",
    "keyPoints": [
      "双手握距靠近（掌心朝向自己或相对）",
      "自完全悬垂起，依靠手臂与背部将下巴拉过单杠",
      "下放时注重二头肌离心收缩控制"
    ],
    "commonIssues": [
      {
        "problem": "肘关节内侧压力大",
        "fix": "可选用对握或略微放宽握距至一拳半"
      }
    ],
    "standards": {
      "beginner": "1组 × 4次",
      "intermediate": "2组 × 7次",
      "upgrade": "2组 × 10次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        4,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒拉·1秒停·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "pull_07",
    "name": "偏重引体向上",
    "nameEn": "Uneven Pullups",
    "category": "pull",
    "categoryLabel": "引体向上",
    "step": 7,
    "source": "第一册第七章第七式",
    "riskLevel": "high",
    "equipment": [
      "单杠",
      "毛巾"
    ],
    "equipmentTags": [
      "bar"
    ],
    "purpose": "单手握杠，另一手抓挂在杠上的毛巾，迫使主手承受约75%以上的自重负荷",
    "keyPoints": [
      "主手抓单杠，副手在下方15-20厘米处抓握悬挂毛巾",
      "主侧背肌爆发拉升，将下巴拉平主手",
      "控制下落，主侧手臂保持主导，左右平衡训练"
    ],
    "commonIssues": [
      {
        "problem": "下身打转",
        "fix": "核心腹肌完全锁死，防止躯干螺旋扭转"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (每侧)",
      "intermediate": "2组 × 5次",
      "upgrade": "2组 × 9次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        3,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "2秒拉·1秒停·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "pull_08",
    "name": "单臂半引体向上",
    "nameEn": "1/2 One-Arm Pullups",
    "category": "pull",
    "categoryLabel": "引体向上",
    "step": 8,
    "source": "第一册第七章第八式",
    "riskLevel": "high",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "purpose": "单臂完全承重进行上段行程突破，掌握单手悬垂抗旋转与锁喉发力",
    "keyPoints": [
      "单手抓杠，副手握住单臂手腕",
      "从手臂约90度屈曲高度启动，单臂背阔肌极限发力拉升下巴过杠",
      "下放至90度处保持张力，严禁直接坠落死悬垂以免伤肩"
    ],
    "commonIssues": [
      {
        "problem": "肩峰撞击钝痛",
        "fix": "肩袖肌群提前收紧预激活，不可盲目松弛"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (每侧)",
      "intermediate": "2组 × 4次",
      "upgrade": "2组 × 8次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        2,
        4
      ],
      "restSeconds": 120,
      "tempoDescription": "2秒拉·1秒停·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "pull_09",
    "name": "单臂辅助引体向上",
    "nameEn": "Assisted One-Arm Pullups",
    "category": "pull",
    "categoryLabel": "引体向上",
    "step": 9,
    "source": "第一册第七章第九式",
    "riskLevel": "high",
    "equipment": [
      "单杠",
      "毛巾"
    ],
    "equipmentTags": [
      "bar"
    ],
    "purpose": "单手抓杠，副手仅搭毛巾最低点（极低抓握支持），接近100%全自重单臂拉起",
    "keyPoints": [
      "主手握杠，副手仅用手指捏住毛巾下垂端提供微小防转平衡",
      "全行程自完全悬垂起步拉升下巴过杠",
      "顶峰停顿并平稳控制下放"
    ],
    "commonIssues": [
      {
        "problem": "副手过度握紧毛巾",
        "fix": "副手只用两根手指轻捏毛巾，逐步过渡到完全脱手"
      }
    ],
    "standards": {
      "beginner": "1组 × 1次 (每侧)",
      "intermediate": "2组 × 3次",
      "upgrade": "2组 × 7次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        1,
        3
      ],
      "restSeconds": 120,
      "tempoDescription": "2秒拉·1秒停·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "pull_10",
    "name": "单臂引体向上",
    "nameEn": "One-Arm Pullups",
    "category": "pull",
    "categoryLabel": "引体向上",
    "step": 10,
    "isFinal": true,
    "source": "第一册第七章第十式 (终极式)",
    "riskLevel": "high",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "purpose": "引体向上终极神技！举世罕见的绝对单臂拉力，身体控制力与意志力的极致象征",
    "keyPoints": [
      "单手紧扣单杠，另一只手背在身后或自然悬空",
      "单侧背阔肌与肱二头肌倾注全力，将自重平滑拉起直到下巴清脆越过杠顶",
      "动作停顿后匀速放回，完美展现无懈可击的力量美学"
    ],
    "commonIssues": [
      {
        "problem": "大幅度摆荡踢腿借力",
        "fix": "真正的囚徒健身单臂引体必须纯粹无摆荡完成"
      }
    ],
    "standards": {
      "beginner": "1组 × 1次 (每侧)",
      "intermediate": "2组 × 2次",
      "upgrade": "2组 × 6次 (大师级)"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        1,
        2
      ],
      "restSeconds": 150,
      "tempoDescription": "2秒拉·1秒停·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "pull_demon_01",
    "name": "哨兵引体向上",
    "nameEn": "Sentry Pull-ups (Muscle-Up)",
    "category": "pull",
    "categoryLabel": "引体向上",
    "step": 11,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 1 式",
    "source": "第一册第七章变式",
    "riskLevel": "high",
    "equipment": [
      "稳固单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "purpose": "上肢拉力与推力合二为一，爆发拉起胸骨过杠，手腕翻转推至完全直臂撑杠",
    "keyPoints": [
      "正握悬挂单杠，全身紧绷形成微反弓",
      "爆发式沉肩屈背将身体向斜上方暴拉，胸口超越杠面高度",
      "手腕手肘疾速前翻转为支撑位",
      "顺势如屈臂撑般将身体完全推起锁死于单杠上方"
    ],
    "commonIssues": [
      {
        "problem": "一只手先上一只手后上(鸡翅上杠)",
        "fix": "两侧背阔肌对称爆发发力，前期可垫小幅度摆动起跳练习"
      }
    ],
    "standards": {
      "beginner": "1组 × 1次",
      "intermediate": "2组 × 3次",
      "upgrade": "2组 × 8次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        1,
        3
      ],
      "restSeconds": 150,
      "tempoDescription": "极限爆发拉·快速翻腕·推起锁死",
      "rirTarget": 2
    }
  },
  {
    "id": "pull_demon_02",
    "name": "仰卧直臂悬垂",
    "nameEn": "Front Lever",
    "category": "pull",
    "categoryLabel": "引体向上",
    "step": 12,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 2 式",
    "source": "第一册第七章更上一层楼",
    "riskLevel": "high",
    "equipment": [
      "稳固单杠/吊环"
    ],
    "equipmentTags": [
      "bar",
      "rings"
    ],
    "purpose": "体操大师级神技，双臂伸直向下压杠，全身呈绝对刚性水平木板静力悬浮",
    "keyPoints": [
      "双手抓杠，双臂完全伸直锁定",
      "背阔肌与胸肌协同向下施加巨大的静力压杠力矩",
      "核心、臀部、大腿后侧全面收紧锁死成一条水平直线",
      "躯干从肩到踝关节与地面绝对平行"
    ],
    "commonIssues": [
      {
        "problem": "屈肘弯臂或屈髋塌臀",
        "fix": "由团身直臂悬垂逐步进阶至分腿、单腿，再完全伸展直腿"
      }
    ],
    "standards": {
      "beginner": "维持 3 秒",
      "intermediate": "维持 8 秒",
      "upgrade": "维持 15 秒"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        3,
        8
      ],
      "restSeconds": 120,
      "tempoDescription": "下压平浮·绝对静力锁死",
      "rirTarget": 2
    }
  },
  {
    "id": "pull_demon_03",
    "name": "吊环铁十字",
    "nameEn": "Iron Cross",
    "category": "pull",
    "categoryLabel": "引体向上",
    "step": 13,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 3 式",
    "source": "第一册第七章更上一层楼",
    "riskLevel": "high",
    "equipment": [
      "体操吊环"
    ],
    "equipmentTags": [
      "rings"
    ],
    "purpose": "体操世界级终极神技，双臂水平展开90度将自重牢牢悬吊支撑于吊环之间",
    "keyPoints": [
      "双手握吊环上拉支撑，双臂慢慢向身体两侧完全水平展开",
      "身体保持如钢铁长矛般垂直笔直，双肩沉锁",
      "在双臂与躯干成直角的水平位静力支撑，胸背与肩胛肌群承受极大拉力",
      "控制呼吸，平稳维持"
    ],
    "commonIssues": [
      {
        "problem": "肘关节过度超伸疼痛",
        "fix": "前置肘部韧带强化必须经过数年悬挂与拉力筑基，严禁盲目尝试"
      }
    ],
    "standards": {
      "beginner": "维持 2 秒",
      "intermediate": "维持 5 秒",
      "upgrade": "维持 10 秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        2,
        5
      ],
      "restSeconds": 150,
      "tempoDescription": "侧展平悬·静力悬停",
      "rirTarget": 2
    }
  },
  {
    "id": "pull_demon_04",
    "name": "吊环马耳他十字",
    "nameEn": "Maltese Cross",
    "category": "pull",
    "categoryLabel": "引体向上",
    "step": 14,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 4 式",
    "source": "第一册第七章更上一层楼",
    "riskLevel": "high",
    "equipment": [
      "体操吊环"
    ],
    "equipmentTags": [
      "rings"
    ],
    "purpose": "身体呈水平俯卧姿势，双臂水平向外展开支撑，力矩与肌力要求甚至超越铁十字",
    "keyPoints": [
      "从吊环俯卧悬垂位展开双臂，躯干与地面完全平行",
      "双臂展开于身体两侧略偏后，胸大肌与背阔肌处于极限拉伸位支撑",
      "极其严苛的肩关节稳定性与核心刚性",
      "数秒静力维持"
    ],
    "commonIssues": [
      {
        "problem": "躯干下坠下塌",
        "fix": "核心与臀大肌极限收缩，先以脚着地辅助减轻部分负重"
      }
    ],
    "standards": {
      "beginner": "维持 1 秒",
      "intermediate": "维持 3 秒",
      "upgrade": "维持 8 秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        1,
        3
      ],
      "restSeconds": 180,
      "tempoDescription": "水平俯撑·神技定格",
      "rirTarget": 2
    }
  },
  {
    "id": "pull_demon_05",
    "name": "无腿单臂攀绳",
    "nameEn": "Legless Rope Climb",
    "category": "pull",
    "categoryLabel": "引体向上",
    "step": 15,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 5 式",
    "source": "第四册额外章节二·十二金刚 (班克式)",
    "riskLevel": "high",
    "equipment": [
      "稳固攀爬粗绳"
    ],
    "equipmentTags": [
      "rope",
      "support"
    ],
    "purpose": "双腿完全伸直悬空，不借助任何足部缠绳，仅依靠单臂交替强力拉升攀登6米粗绳",
    "keyPoints": [
      "双腿呈L形前伸悬空锁定，严禁足部碰触绳索借力",
      "一只手臂拉至胸前锁定，另一只手臂全力向上抓握更高处",
      "匀速交替攀爬至顶部，再有控制地下潜回到起点",
      "练就撕裂钢链般的绝对握力与肱二头肌"
    ],
    "commonIssues": [
      {
        "problem": "下滑滑落烧伤手掌",
        "fix": "下降同样依靠手臂交替屈伸，严禁握绳快速滑降"
      }
    ],
    "standards": {
      "beginner": "攀爬 3 米 (无腿)",
      "intermediate": "攀爬 6 米 (单程)",
      "upgrade": "攀爬 6 米 (往返2次)"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        1,
        2
      ],
      "restSeconds": 150,
      "tempoDescription": "臂力攀升·匀速下送",
      "rirTarget": 1
    }
  },
  {
    "id": "pull_demon_06",
    "name": "连续单杠翻身",
    "nameEn": "Bar Pullover (50 Reps)",
    "category": "pull",
    "categoryLabel": "引体向上",
    "step": 16,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 6 式",
    "source": "第四册额外章节二·十二金刚",
    "riskLevel": "high",
    "equipment": [
      "高单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "purpose": "悬吊上拉同时双腿绕过横杠完成360度大回环，下潜送回原位连续进行高次数拉力与心肺极限轰炸",
    "keyPoints": [
      "悬吊起拉的同时屈髋抬腿，双腿越过单杠上方带动躯干完全转动",
      "在单杠上方短暂停留后顺畅送回悬垂起始位",
      "一气呵成不间断回环翻转，极其考验抓握力、背部耐力与肺活量"
    ],
    "commonIssues": [
      {
        "problem": "头晕恶心体能透支",
        "fix": "呼吸与旋转保持匀速韵律，前期每组5-10次递增"
      }
    ],
    "standards": {
      "beginner": "连续 5 次",
      "intermediate": "连续 15 次",
      "upgrade": "连续 50 次 (大师级)"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        10,
        25
      ],
      "restSeconds": 120,
      "tempoDescription": "流畅翻转·连续回环",
      "rirTarget": 1
    }
  },
  {
    "id": "legRaise_01",
    "name": "坐姿屈膝",
    "nameEn": "Knee Tucks",
    "category": "legRaise",
    "categoryLabel": "举腿",
    "step": 1,
    "source": "第一册第八章第一式",
    "riskLevel": "low",
    "equipment": [
      "椅子/床沿"
    ],
    "equipmentTags": [
      "chair"
    ],
    "purpose": "强化深层腹直肌下段与髂腰肌，安全激活核心收缩而不压迫下背部",
    "keyPoints": [
      "坐在椅子边缘，双手抓住座椅两侧后方，躯干微后倾",
      "双腿离地向前伸展，然后收缩腹肌将膝盖平稳拉向胸部",
      "顶峰挤压腹部1秒，然后缓缓伸展双腿，双脚全程不触地"
    ],
    "commonIssues": [
      {
        "problem": "借上半身前后猛晃",
        "fix": "躯干保持稳定夹角，纯靠腹肌驱动大腿"
      }
    ],
    "standards": {
      "beginner": "1组 × 10次",
      "intermediate": "2组 × 25次",
      "upgrade": "3组 × 40次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        15,
        25
      ],
      "restSeconds": 45,
      "tempoDescription": "2秒收·1秒停·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "legRaise_02",
    "name": "平卧抬膝",
    "nameEn": "Flat Knee Raises",
    "category": "legRaise",
    "categoryLabel": "举腿",
    "step": 2,
    "source": "第一册第八章第二式",
    "riskLevel": "low",
    "equipment": [
      "地面(垫子)"
    ],
    "equipmentTags": [
      "floor",
      "mat"
    ],
    "purpose": "平卧位抵抗重力，增加腹直肌抗骨盆前倾的离心控制能力",
    "keyPoints": [
      "仰卧于地面，双手放于身体两侧，下背部紧贴地面不留缝隙",
      "屈膝将大腿收向胸口，膝关节呈90度角",
      "缓慢放回脚后跟轻点地面即再次抬起"
    ],
    "commonIssues": [
      {
        "problem": "腰椎悬空酸胀",
        "fix": "腹部始终保持紧缩用力，将腰部死死压在地面上"
      }
    ],
    "standards": {
      "beginner": "1组 × 10次",
      "intermediate": "2组 × 20次",
      "upgrade": "3组 × 35次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        12,
        20
      ],
      "restSeconds": 45,
      "tempoDescription": "2秒收·1秒停·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "legRaise_03",
    "name": "平卧屈举腿",
    "nameEn": "Flat Bent Leg Raises",
    "category": "legRaise",
    "categoryLabel": "举腿",
    "step": 3,
    "source": "第一册第八章第三式",
    "riskLevel": "low",
    "equipment": [
      "地面(垫子)"
    ],
    "equipmentTags": [
      "floor",
      "mat"
    ],
    "purpose": "拉长下肢力臂（膝关节钝角约135度），阶梯式增加腹肌与屈髋肌群负荷",
    "keyPoints": [
      "仰卧平躺，双腿伸展保持微屈（约135度），脚踝锁定",
      "依靠腹部深层发力将双腿平稳拉起至与躯干垂直",
      "缓慢下落至脚跟离地两寸，立即开始下一次"
    ],
    "commonIssues": [
      {
        "problem": "小腿完全弯曲变成抬膝",
        "fix": "保持腿部固定微屈角度不变，以髋为轴转动"
      }
    ],
    "standards": {
      "beginner": "1组 × 10次",
      "intermediate": "2组 × 15次",
      "upgrade": "3组 × 30次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        10,
        15
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒收·1秒停·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "legRaise_04",
    "name": "平卧蛙举腿",
    "nameEn": "Flat Frog Raises",
    "category": "legRaise",
    "categoryLabel": "举腿",
    "step": 4,
    "source": "第一册第八章第四式",
    "riskLevel": "low",
    "equipment": [
      "地面(垫子)"
    ],
    "equipmentTags": [
      "floor",
      "mat"
    ],
    "purpose": "屈腿上举、直腿下放的离心强化练习，为标准平卧直举腿铺垫坚强过渡",
    "keyPoints": [
      "仰卧平躺，屈膝抬至胸前",
      "在顶峰将双腿完全伸直，然后保持直腿以极慢速度下放至离地一寸",
      "再屈膝收回，循环往复，利用强力离心训练腹肌"
    ],
    "commonIssues": [
      {
        "problem": "直腿下放时腰部弹起",
        "fix": "下放若控制不住，可放慢速度或微屈膝下落"
      }
    ],
    "standards": {
      "beginner": "1组 × 8次",
      "intermediate": "2组 × 15次",
      "upgrade": "3组 × 25次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        8,
        15
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒收·1秒停·3秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "legRaise_05",
    "name": "平卧直举腿",
    "nameEn": "Flat Straight Leg Raises",
    "category": "legRaise",
    "categoryLabel": "举腿",
    "step": 5,
    "source": "第一册第八章第五式",
    "riskLevel": "medium",
    "equipment": [
      "地面(垫子)"
    ],
    "equipmentTags": [
      "floor",
      "mat"
    ],
    "purpose": "平卧举腿最高标准！完整长力臂杠杆，打造钢铁般致密的腹壁与核心铠甲",
    "keyPoints": [
      "双腿完全并拢伸直，双手置于身体两侧平贴地面",
      "腹肌发力驱动双腿平滑抬起至完全垂直于地面（90度）",
      "以2-3秒速度缓慢下放至脚跟悬空离地一寸，骨盆保持绝对中立"
    ],
    "commonIssues": [
      {
        "problem": "借惯性甩腿",
        "fix": "动作全程严禁任何晃动借力，匀速起落"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次",
      "intermediate": "2组 × 10次",
      "upgrade": "2组 × 20次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        8,
        15
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒收·1秒停·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "legRaise_06",
    "name": "悬垂屈膝",
    "nameEn": "Hanging Knee Raises",
    "category": "legRaise",
    "categoryLabel": "举腿",
    "step": 6,
    "source": "第一册第八章第六式",
    "riskLevel": "medium",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "purpose": "从地面转战空中悬垂！彻底释放腰椎压力，同时大幅考验肩带悬挂与握力",
    "keyPoints": [
      "正握单杠完全悬垂，身体保持静态无摆动",
      "骨盆后倾，收缩腹肌将膝盖平稳拉起至与胸平齐（大腿高于水平线）",
      "顶峰静止一瞬，平缓放回，不借助晃动"
    ],
    "commonIssues": [
      {
        "problem": "身体前后大幅荡秋千",
        "fix": "下放时脚尖不过分后踢，背阔肌收紧稳固躯干"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次",
      "intermediate": "2组 × 10次",
      "upgrade": "2组 × 15次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        6,
        12
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒收·1秒停·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "legRaise_07",
    "name": "悬垂屈举腿",
    "nameEn": "Hanging Bent Leg Raises",
    "category": "legRaise",
    "categoryLabel": "举腿",
    "step": 7,
    "source": "第一册第八章第七式",
    "riskLevel": "medium",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "purpose": "悬垂长力臂进阶，膝盖保持135度钝角，负荷呈几何级数增长",
    "keyPoints": [
      "双手稳固悬挂，腿部保持固定微屈角度",
      "腹部强力收拢，将大腿拉过水平位置",
      "缓速下放，全程保持骨盆抗旋转稳定"
    ],
    "commonIssues": [
      {
        "problem": "抓握力先于腹肌力竭",
        "fix": "平时加强死悬垂抓握耐力练习"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次",
      "intermediate": "2组 × 10次",
      "upgrade": "2组 × 15次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        5,
        10
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒收·1秒停·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "legRaise_08",
    "name": "悬垂蛙举腿",
    "nameEn": "Hanging Frog Raises",
    "category": "legRaise",
    "categoryLabel": "举腿",
    "step": 8,
    "source": "第一册第八章第八式",
    "riskLevel": "high",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "purpose": "悬垂屈腿拉起、完全直腿下放！为最终直腿悬垂举腿打通神经肌肉连接",
    "keyPoints": [
      "悬垂屈膝抬起至胸口，顶峰时完全伸展双腿呈水平线",
      "保持笔直双腿，极其缓慢地降落回底端",
      "体验长杠杆下强烈的离心撕裂感"
    ],
    "commonIssues": [
      {
        "problem": "伸腿时身体后仰摔摆",
        "fix": "肩袖锁死，头部保持在双臂之间"
      }
    ],
    "standards": {
      "beginner": "1组 × 4次",
      "intermediate": "2组 × 8次",
      "upgrade": "2组 × 15次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        4,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒收·1秒停·3秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "legRaise_09",
    "name": "悬垂半举腿",
    "nameEn": "Partial Straight Leg Raises",
    "category": "legRaise",
    "categoryLabel": "举腿",
    "step": 9,
    "source": "第一册第八章第九式",
    "riskLevel": "high",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "purpose": "完全笔直双腿悬垂起步，拉升至与地面平行（90度），进入神级核心领域",
    "keyPoints": [
      "双腿笔直并拢，脚尖下压绷直",
      "无任何摆动，仅靠腹肌收缩带动双腿抬至水平位置（呈L型）",
      "在水平位暂停1秒，随后平缓下放至起始姿势"
    ],
    "commonIssues": [
      {
        "problem": "膝盖不自觉弯曲",
        "fix": "保持股四头肌紧缩以锁定膝盖伸直"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次",
      "intermediate": "2组 × 6次",
      "upgrade": "2组 × 15次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        3,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒收·1秒停·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "legRaise_10",
    "name": "悬垂直举腿",
    "nameEn": "Hanging Straight Leg Raises",
    "category": "legRaise",
    "categoryLabel": "举腿",
    "step": 10,
    "isFinal": true,
    "source": "第一册第八章第十式 (终极式)",
    "riskLevel": "high",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "purpose": "举腿终极式！腹肌圣杯动作，将笔直双腿从空中直接抬起触碰单杠，无可匹敌的绝对核心",
    "keyPoints": [
      "双手正握完全静止悬挂",
      "双腿笔直合拢，腹直肌如液压缆绳强力卷起骨盆，将脚尖精准送达单杠碰触",
      "缓慢、无声、平滑地将双腿完全放回，全程肌肉张力紧绷"
    ],
    "commonIssues": [
      {
        "problem": "甩臀部惯性借力",
        "fix": "真正的大师举腿是完全静止发力，上体不晃"
      }
    ],
    "standards": {
      "beginner": "1组 × 1次",
      "intermediate": "2组 × 4次",
      "upgrade": "2组 × 30次 (大师级)"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        2,
        5
      ],
      "restSeconds": 120,
      "tempoDescription": "2秒收·1秒停·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "legRaise_demon_01",
    "name": "悬垂 V 字举腿",
    "nameEn": "Hanging V-Raise",
    "category": "legRaise",
    "categoryLabel": "举腿",
    "step": 11,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 1 式",
    "source": "第一册第八章更上一层楼",
    "riskLevel": "high",
    "equipment": [
      "稳固单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "purpose": "超越垂直90度的终极中段强化，双腿夹角缩小贴近胸膛，李小龙至尊核心绝技",
    "keyPoints": [
      "双手抓杠悬垂，身体稳定无晃动",
      "双腿完全伸直并拢，屈髋抬升超过水平90度",
      "腹肌极度压缩，将双腿直直送向胸部使身体形成尖锐V字",
      "在顶点停顿片刻，完全依靠肌力平稳下放"
    ],
    "commonIssues": [
      {
        "problem": "依靠摆动甩腿上冲",
        "fix": "消除一切惯性，动作慢速匀速，柔韧性受限先做坐姿过渡"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次",
      "intermediate": "2组 × 6次",
      "upgrade": "2组 × 15次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒起·1秒顶峰压缩·2秒放",
      "rirTarget": 2
    }
  },
  {
    "id": "legRaise_demon_02",
    "name": "地面直角撑",
    "nameEn": "L-Sit",
    "category": "legRaise",
    "categoryLabel": "举腿",
    "step": 12,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 2 式",
    "source": "第一册第八章变式",
    "riskLevel": "high",
    "equipment": [
      "平整地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "双手撑地将全身推离地面，双腿水平伸直锁定成直角，强悍的背阔肌下压与腹直肌静力支撑",
    "keyPoints": [
      "坐在平地上，双腿并拢伸直锁死",
      "双手平放在臀部两侧地面，下压沉肩将臀部与双腿完全推离地面",
      "身体与双腿维持严格的90度直角，双脚悬空不触地",
      "保持平稳深长呼吸"
    ],
    "commonIssues": [
      {
        "problem": "脚跟蹭地无法悬空",
        "fix": "加强背阔肌主动下压沉肩发力，前期可手垫书本或木砖抬高"
      }
    ],
    "standards": {
      "beginner": "维持 5 秒",
      "intermediate": "维持 15 秒",
      "upgrade": "维持 30 秒"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        5,
        15
      ],
      "restSeconds": 90,
      "tempoDescription": "下压悬浮·静力保持",
      "rirTarget": 2
    }
  },
  {
    "id": "legRaise_demon_03",
    "name": "俄式反折高位撑",
    "nameEn": "Manna Support",
    "category": "legRaise",
    "categoryLabel": "举腿",
    "step": 13,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 3 式",
    "source": "第一册第八章更上一层楼",
    "riskLevel": "high",
    "equipment": [
      "平整地面/平行木砖"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "直角撑的终极形态，双手撑地重心大幅后倾，双腿抬升超过垂直线向头部反折，身体中段力量与柔韧性的神级殿堂",
    "keyPoints": [
      "双手撑地推起直角撑，骨盆主动向前上方推举",
      "双臂后伸肩部极限前倾支撑，双腿越过90度继续向上反折",
      "双腿完全绷直锁死贴近面部，骨盆高过两肩高度",
      "全身体操神级静态保持"
    ],
    "commonIssues": [
      {
        "problem": "肩后伸柔韧不足",
        "fix": "循序渐进先练熟高位V角撑（V-Sit），避免肩胛与手腕强扭"
      }
    ],
    "standards": {
      "beginner": "维持 1 秒",
      "intermediate": "维持 3 秒",
      "upgrade": "维持 8 秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        1,
        3
      ],
      "restSeconds": 150,
      "tempoDescription": "反折上送·静力定格",
      "rirTarget": 2
    }
  },
  {
    "id": "legRaise_demon_04",
    "name": "极端罗马椅悬空折叠",
    "nameEn": "Extreme Roman Chair Sit-ups",
    "category": "legRaise",
    "categoryLabel": "举腿",
    "step": 14,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 4 式",
    "source": "第一册第八章变式",
    "riskLevel": "high",
    "equipment": [
      "稳固罗马椅/高台固定架"
    ],
    "equipmentTags": [
      "support"
    ],
    "purpose": "双脚固定，大腿躯干在无任何支撑下完全向后悬空大角度下沉，强力反向卷起，打造黄金时代老派硬汉腰腹",
    "keyPoints": [
      "下半身固定于高台，骨盆以上完全悬空后仰超过水平面",
      "双手置于太阳穴或胸前，以髋部为轴匀速下潜至深部拉伸",
      "腹部核心肌群强力收缩带动上半身平稳推起，杜绝颈部拉扯",
      "全程消除惯性"
    ],
    "commonIssues": [
      {
        "problem": "双手死勒颈部",
        "fix": "双手轻触太阳穴，严禁扳拉后脑；腰椎保持微屈"
      }
    ],
    "standards": {
      "beginner": "1组 × 10次",
      "intermediate": "2组 × 20次",
      "upgrade": "2组 × 50次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        15,
        30
      ],
      "restSeconds": 90,
      "tempoDescription": "慢速下倾·核心卷回",
      "rirTarget": 2
    }
  },
  {
    "id": "legRaise_demon_05",
    "name": "悬垂直举腿50次耐力挑战",
    "nameEn": "50-Rep Hanging Leg Raise Challenge",
    "category": "legRaise",
    "categoryLabel": "举腿",
    "step": 15,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 5 式",
    "source": "第一册第八章更上一层楼",
    "riskLevel": "high",
    "equipment": [
      "稳固单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "purpose": "一口气完成50次姿势标准的悬垂直举腿，腹外斜肌与腹直肌如同刚铸钢板的神级耐力",
    "keyPoints": [
      "悬垂于单杠，躯干保持稳定无任何前后摆动借力",
      "双腿完全伸直锁死，匀速抬升至脚尖碰触横杠",
      "缓慢原路下放至垂直位并保持张力，立即进行下一次",
      "不可思议的魔鬼六块极限耐力"
    ],
    "commonIssues": [
      {
        "problem": "后半程摆荡代偿",
        "fix": "腹肌持续保持张力，若摆动可让背阔肌后拉止摆"
      }
    ],
    "standards": {
      "beginner": "1组 × 20次",
      "intermediate": "1组 × 35次",
      "upgrade": "1组 × 50次 (英雄级)"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        20,
        50
      ],
      "restSeconds": 150,
      "tempoDescription": "精准韵律·无休连续",
      "rirTarget": 1
    }
  },
  {
    "id": "bridge_01",
    "name": "短桥",
    "nameEn": "Short Bridges (Glute Bridges)",
    "category": "bridge",
    "categoryLabel": "桥",
    "step": 1,
    "source": "第一册第九章第一式",
    "riskLevel": "low",
    "equipment": [
      "地面(垫子)"
    ],
    "equipmentTags": [
      "floor",
      "mat"
    ],
    "purpose": "唤醒下背部深层竖脊肌、臀大肌与腘绳肌，温和重塑久坐僵硬的脊柱后侧链",
    "keyPoints": [
      "仰卧屈膝，双脚与肩同宽平踩于地面，双手放于身侧",
      "脚后跟用力蹬地，收缩臀肌将髋部顶起至大腿与躯干呈直线",
      "顶峰收紧臀部保持1秒，然后缓缓降落至骨盆轻触地面"
    ],
    "commonIssues": [
      {
        "problem": "过度挺肚子导致腰椎代偿",
        "fix": "保持肋骨下沉，以臀肌收缩为主要驱动"
      }
    ],
    "standards": {
      "beginner": "1组 × 10次",
      "intermediate": "2组 × 25次",
      "upgrade": "3组 × 50次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        15,
        30
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒起·1秒停·2秒落",
      "rirTarget": 2
    }
  },
  {
    "id": "bridge_02",
    "name": "直桥",
    "nameEn": "Straight Bridges",
    "category": "bridge",
    "categoryLabel": "桥",
    "step": 2,
    "source": "第一册第九章第二式",
    "riskLevel": "low",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "长力臂后侧链训练，同时打开胸肩前侧，强化三头肌支撑与上背伸展",
    "keyPoints": [
      "坐于地面，双腿向前伸直，双手撑在臀部后方地面",
      "后背与臀腿协同发力，将骨盆顶起直至身体从脚踝到头部呈一条笔直倾斜线",
      "顶峰保持下颌微收平视天花板，缓慢还原"
    ],
    "commonIssues": [
      {
        "problem": "手腕压迫酸痛",
        "fix": "手指可略微向外或后方展开以减轻腕屈角度"
      }
    ],
    "standards": {
      "beginner": "1组 × 10次",
      "intermediate": "2组 × 20次",
      "upgrade": "3组 × 40次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        10,
        20
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒起·1秒停·2秒落",
      "rirTarget": 2
    }
  },
  {
    "id": "bridge_03",
    "name": "高低桥",
    "nameEn": "Angled Bridges",
    "category": "bridge",
    "categoryLabel": "桥",
    "step": 3,
    "source": "第一册第九章第三式",
    "riskLevel": "low",
    "equipment": [
      "稳固椅子/高台"
    ],
    "equipmentTags": [
      "chair",
      "support"
    ],
    "purpose": "借助高台抬高手臂支撑点，初步体验背部反弓后弯姿态并减轻脊柱扭力",
    "keyPoints": [
      "平躺在地面，双手反撑在后方床沿或稳固椅子边缘",
      "双腿屈膝，后侧链发力将躯干向上推起成弓形",
      "缓慢放落，逐渐唤醒肩部与胸椎伸展度"
    ],
    "commonIssues": [
      {
        "problem": "椅子滑动",
        "fix": "确保支撑物靠墙放置，绝对不可滑动"
      }
    ],
    "standards": {
      "beginner": "1组 × 8次",
      "intermediate": "2组 × 15次",
      "upgrade": "3组 × 30次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        8,
        15
      ],
      "restSeconds": 60,
      "tempoDescription": "2秒起·1秒停·2秒落",
      "rirTarget": 2
    }
  },
  {
    "id": "bridge_04",
    "name": "顶桥",
    "nameEn": "Head Bridges",
    "category": "bridge",
    "categoryLabel": "桥",
    "step": 4,
    "source": "第一册第九章第四式",
    "riskLevel": "medium",
    "equipment": [
      "地面(垫子)"
    ],
    "equipmentTags": [
      "floor",
      "mat"
    ],
    "purpose": "仰卧双手撑在头部两侧，借助头顶轻点地面完成过渡期全桥推举",
    "keyPoints": [
      "仰卧屈膝，双手反扣在双耳侧地面",
      "四肢协同蹬起，将头顶轻置于地面形成拱形支撑点",
      "缓慢落回背部接触地面，颈部仅做平衡辅助，不承受猛烈冲击"
    ],
    "commonIssues": [
      {
        "problem": "颈部承担过多重量",
        "fix": "绝大部分力量来自双腿与手臂推举，头顶只是轻点"
      }
    ],
    "standards": {
      "beginner": "1组 × 8次",
      "intermediate": "2组 × 12次",
      "upgrade": "2组 × 25次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        6,
        12
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒起·1秒停·2秒落",
      "rirTarget": 2
    }
  },
  {
    "id": "bridge_05",
    "name": "半桥",
    "nameEn": "Half Bridges",
    "category": "bridge",
    "categoryLabel": "桥",
    "step": 5,
    "source": "第一册第九章第五式",
    "riskLevel": "medium",
    "equipment": [
      "篮球/抱枕"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "利用球体垫在腰下限制反弓深度，练习完全脱离头顶支撑的双手悬空推桥",
    "keyPoints": [
      "背下垫球，双手在耳侧撑地",
      "腰臀与手臂同步推起，使后背脱离球体呈标准拱桥状",
      "缓慢落回球面上，练习推起锁定的发力轨迹"
    ],
    "commonIssues": [
      {
        "problem": "手臂无法推直",
        "fix": "每日加强胸肌与背阔肌被动拉伸，提高胸椎活动度"
      }
    ],
    "standards": {
      "beginner": "1组 × 6次",
      "intermediate": "2组 × 10次",
      "upgrade": "2组 × 20次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        5,
        10
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒起·1秒停·2秒落",
      "rirTarget": 2
    }
  },
  {
    "id": "bridge_06",
    "name": "标准桥",
    "nameEn": "Full Bridges",
    "category": "bridge",
    "categoryLabel": "桥",
    "step": 6,
    "source": "第一册第九章第六式",
    "riskLevel": "medium",
    "equipment": [
      "地面(垫子)"
    ],
    "equipmentTags": [
      "floor",
      "mat"
    ],
    "purpose": "脊柱青春泉源！打通全身深层后背经膜，强化竖脊肌并极大伸展腹胸前链",
    "keyPoints": [
      "仰卧双手反扣耳旁，双脚与肩同宽踩地",
      "臀部与手脚四点同时发力，将躯干完全顶起形成完美的优美拱门",
      "双臂与双腿尽量伸直，头部自然悬垂放松",
      "缓慢屈肘屈膝下落回到地面"
    ],
    "commonIssues": [
      {
        "problem": "呼吸屏气",
        "fix": "在桥顶平稳深长呼吸，绝不憋气"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次",
      "intermediate": "2组 × 8次",
      "upgrade": "2组 × 15次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        5,
        10
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒起·1秒停·2秒落",
      "rirTarget": 2
    }
  },
  {
    "id": "bridge_07",
    "name": "下行桥",
    "nameEn": "Wall Walking Bridges (Downwards)",
    "category": "bridge",
    "categoryLabel": "桥",
    "step": 7,
    "source": "第一册第九章第七式",
    "riskLevel": "high",
    "equipment": [
      "一面稳固墙面"
    ],
    "equipmentTags": [
      "wall"
    ],
    "purpose": "从站姿开始，双手沿墙面步步向后向下倒爬进入全桥，掌握站姿后弯控制",
    "keyPoints": [
      "背对墙壁约一臂距离站立，双脚与肩同宽",
      "向后仰头双手撑住墙面，手步一步步沿墙壁向下倒走直到地面成桥",
      "平缓侧身或就地坐下休息"
    ],
    "commonIssues": [
      {
        "problem": "站立距离太远",
        "fix": "先从靠近墙面15厘米开始，逐步扩大间距"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次",
      "intermediate": "2组 × 6次",
      "upgrade": "2组 × 10次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        3,
        6
      ],
      "restSeconds": 90,
      "tempoDescription": "3秒慢下·自主受控",
      "rirTarget": 2
    }
  },
  {
    "id": "bridge_08",
    "name": "上行桥",
    "nameEn": "Wall Walking Bridges (Upwards)",
    "category": "bridge",
    "categoryLabel": "桥",
    "step": 8,
    "source": "第一册第九章第八式",
    "riskLevel": "high",
    "equipment": [
      "一面稳固墙面"
    ],
    "equipmentTags": [
      "wall"
    ],
    "purpose": "从地面成桥状态，双手沿墙面步步向上倒爬并推起恢复站立，训练下背前推拉力",
    "keyPoints": [
      "在墙根处起桥，双手推至墙面",
      "一步步沿墙面向上反爬，腿部强力蹬地",
      "最终依靠骨盆前送与腹肌收缩推回完全直立站姿"
    ],
    "commonIssues": [
      {
        "problem": "无法完成最后一蹬",
        "fix": "下腹肌在站起最后一步强力向前卷曲推送"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次",
      "intermediate": "2组 × 4次",
      "upgrade": "2组 × 8次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        2,
        5
      ],
      "restSeconds": 90,
      "tempoDescription": "自主稳步上升",
      "rirTarget": 2
    }
  },
  {
    "id": "bridge_09",
    "name": "合桥",
    "nameEn": "Closing Bridges",
    "category": "bridge",
    "categoryLabel": "桥",
    "step": 9,
    "source": "第一册第九章第九式",
    "riskLevel": "high",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "脱离墙壁保护，自站姿直接向后弯折双手触地成桥，然后再顺势躺下",
    "keyPoints": [
      "站姿双脚开立，双臂高举过头",
      "从容后仰，眼睛寻找地面落点，双手柔和轻触地面成桥",
      "平稳落回，体验完全自主后弯神经支配"
    ],
    "commonIssues": [
      {
        "problem": "恐惧砸地",
        "fix": "先在软草地或厚海绵垫上练习"
      }
    ],
    "standards": {
      "beginner": "1组 × 1次",
      "intermediate": "2组 × 3次",
      "upgrade": "2组 × 6次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        1,
        3
      ],
      "restSeconds": 120,
      "tempoDescription": "平稳后弯",
      "rirTarget": 2
    }
  },
  {
    "id": "bridge_10",
    "name": "铁板桥",
    "nameEn": "Stand-to-Stand Bridges",
    "category": "bridge",
    "categoryLabel": "桥",
    "step": 10,
    "isFinal": true,
    "source": "第一册第九章第十式 (终极式)",
    "riskLevel": "high",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "桥之终极神技！站立后仰下落成桥，再依靠极致腰臀力量直接拉起恢复站立，永不衰老的钢铁龙骨",
    "keyPoints": [
      "站立姿态优雅向后弯腰下探成桥",
      "桥底稍作停顿，双腿与竖脊肌强力爆发收紧，将整个躯干顺滑拉起回到原站姿",
      "宛如一根坚韧无比的弹簧钢板，无任何勉强借力"
    ],
    "commonIssues": [
      {
        "problem": "膝盖过度承受折力",
        "fix": "依靠大腿股四头肌全幅度收缩拉升，力量均匀分散"
      }
    ],
    "standards": {
      "beginner": "1组 × 1次",
      "intermediate": "2组 × 3次",
      "upgrade": "2组 × 30次 (大师级)"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        1,
        3
      ],
      "restSeconds": 120,
      "tempoDescription": "自主闭环站立",
      "rirTarget": 2
    }
  },
  {
    "id": "bridge_demon_01",
    "name": "高位台阶跌落反推铁板桥",
    "nameEn": "High-Platform Drop Bridge",
    "category": "bridge",
    "categoryLabel": "桥",
    "step": 11,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 1 式",
    "source": "第一册第九章更上一层楼",
    "riskLevel": "high",
    "equipment": [
      "高台/稳固台阶"
    ],
    "equipmentTags": [
      "support"
    ],
    "purpose": "超越平地的超大幅度铁板桥，站在高台上向后弯腰触地成桥，再依靠极致爆发力推回站立",
    "keyPoints": [
      "站在台阶或稳固平台上，双脚与肩同宽",
      "脊柱向后弯曲成弓，双手向下极度伸展直至落于低处的地面成桥",
      "利用躯干全后链与手掌爆发推力，一口气将身体推回台阶站立姿势",
      "考验全身柔韧性与后链极值做功"
    ],
    "commonIssues": [
      {
        "problem": "手腕冲击过大",
        "fix": "落手时手腕微曲缓冲，前期先使用低落差平台练习"
      }
    ],
    "standards": {
      "beginner": "1组 × 1次",
      "intermediate": "2组 × 3次",
      "upgrade": "2组 × 6次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        1,
        3
      ],
      "restSeconds": 150,
      "tempoDescription": "后仰探底·强力反弹推回",
      "rirTarget": 2
    }
  },
  {
    "id": "bridge_demon_02",
    "name": "倒立与铁桥动力转换",
    "nameEn": "Handstand Bridge Transitions",
    "category": "bridge",
    "categoryLabel": "桥",
    "step": 12,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 2 式",
    "source": "第一册第九章更上一层楼",
    "riskLevel": "high",
    "equipment": [
      "平整开阔软垫地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "自重两大神级体系融合，倒立姿态缓慢下降双腿成铁板桥，再靠双腿蹬地与核心反弹推回倒立",
    "keyPoints": [
      "自由倒立姿态锁定身体",
      "缓慢弯曲脊柱与髋部，控制双脚轻盈落向地面成标准桥式",
      "在桥式最深处聚力，双腿爆发后蹬带动骨盆，双手推撑将身体翻回垂直倒立",
      "行云流水无缝转换"
    ],
    "commonIssues": [
      {
        "problem": "落脚砸地失控",
        "fix": "下落时肩部主动向前对抗维持平衡，地面铺设减震软垫"
      }
    ],
    "standards": {
      "beginner": "1组 × 1次 (往返)",
      "intermediate": "2组 × 3次",
      "upgrade": "2组 × 6次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        1,
        3
      ],
      "restSeconds": 150,
      "tempoDescription": "慢下潜入桥·爆发蹬回倒立",
      "rirTarget": 2
    }
  },
  {
    "id": "bridge_demon_03",
    "name": "瑜伽蝎子式桥",
    "nameEn": "Scorpion Bridge",
    "category": "bridge",
    "categoryLabel": "桥",
    "step": 13,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 3 式",
    "source": "第一册第九章更上一层楼",
    "riskLevel": "high",
    "equipment": [
      "软垫地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "人类脊柱向后弯曲的极致柔韧性与深层后链肌群掌控，在桥式最低点实现双脚底紧贴头顶",
    "keyPoints": [
      "推起高幅度标准铁板桥，胸椎与肩关节充分打开",
      "双手与双脚逐步缩短间距，头部后仰寻找双脚脚底",
      "双腿弯曲使足底平稳贴在头顶中央，后侧肌肉链处于极致等长收缩状态",
      "平缓呼吸，安全退回"
    ],
    "commonIssues": [
      {
        "problem": "腰椎局部挤压剧痛",
        "fix": "必须将弯曲弧度均匀分布于胸椎与髋部，严禁用折叠下背部代偿"
      }
    ],
    "standards": {
      "beginner": "维持 3 秒",
      "intermediate": "维持 8 秒",
      "upgrade": "维持 15 秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        8
      ],
      "restSeconds": 120,
      "tempoDescription": "极度后曲·脚底触顶",
      "rirTarget": 2
    }
  },
  {
    "id": "bridge_demon_04",
    "name": "蜥蜴铁桥",
    "nameEn": "Lizard Bridge",
    "category": "bridge",
    "categoryLabel": "桥",
    "step": 14,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 4 式",
    "source": "第一册第九章变式",
    "riskLevel": "high",
    "equipment": [
      "平整地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "在拱起的高位铁板桥上，对角单臂与单腿同时离地水平伸展，极致考验对角线抗扭力矩",
    "keyPoints": [
      "推起标准深拱铁板桥，四角支撑平稳",
      "将重心转移至左手和右脚，右手与左腿同时离开地面水平平伸",
      "腰背深层肌群极度收缩维持脊柱不侧倾坍塌",
      "维持数秒后换对侧对称练习"
    ],
    "commonIssues": [
      {
        "problem": "离地瞬间坍塌倾倒",
        "fix": "先练习单手离地或单脚离地，具备稳定基础后再尝试对角同时离地"
      }
    ],
    "standards": {
      "beginner": "维持 3 秒 (每侧)",
      "intermediate": "维持 6 秒",
      "upgrade": "维持 12 秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "对角腾空·铁桥锁死",
      "rirTarget": 2
    }
  },
  {
    "id": "bridge_demon_05",
    "name": "老派负重铁板桥",
    "nameEn": "Weighted Bridge",
    "category": "bridge",
    "categoryLabel": "桥",
    "step": 15,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 5 式",
    "source": "第一册第九章更上一层楼",
    "riskLevel": "high",
    "equipment": [
      "杠铃片/负重伙伴"
    ],
    "equipmentTags": [
      "support"
    ],
    "purpose": "圣昆汀牢房大力士传奇绝技，腹部承受大负荷或同伴体重下做深桥拱起",
    "keyPoints": [
      "平躺于地面，腹部安置重物或训练同伴",
      "手脚同时爆发发力，将骨盆与脊柱液压机般推向最高点",
      "深层竖脊肌与后链肌腱承受极大压力，在最高点锁定片刻",
      "极其严格的下背部前置力量储备"
    ],
    "commonIssues": [
      {
        "problem": "椎间盘受压不适",
        "fix": "严禁突加大重量，负重必须由轻量杠铃片开始逐渐适应"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (负重20kg)",
      "intermediate": "2组 × 5次 (负重50kg)",
      "upgrade": "2组 × 8次 (负重90kg)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        2,
        5
      ],
      "restSeconds": 150,
      "tempoDescription": "重压推起·钢弓顶峰",
      "rirTarget": 2
    }
  },
  {
    "id": "hspu_01",
    "name": "靠墙顶立",
    "nameEn": "Headstand",
    "category": "hspu",
    "categoryLabel": "倒立撑",
    "step": 1,
    "source": "第一册第十章第一式",
    "riskLevel": "low",
    "equipment": [
      "一面稳固墙面",
      "垫子/软枕"
    ],
    "equipmentTags": [
      "wall",
      "mat"
    ],
    "purpose": "适应倒立血液倒流与前庭平衡，建立头颈三角基础静态耐受力",
    "keyPoints": [
      "在墙根前放置软垫，双手与头顶形成等边三角形底座",
      "轻巧蹬地将双脚靠上墙面，身体倒立伸展",
      "保持平稳深呼吸，练习静态维持2分钟"
    ],
    "commonIssues": [
      {
        "problem": "头顶刺痛",
        "fix": "务必放置软垫或毛巾，双臂分担约三分之一支撑力"
      }
    ],
    "standards": {
      "beginner": "维持 30秒",
      "intermediate": "维持 1分钟",
      "upgrade": "维持 2分钟"
    },
    "isHold": true,
    "defaultPrescription": {
      "sets": 2,
      "holdRange": [
        30,
        60
      ],
      "restSeconds": 60,
      "tempoDescription": "平稳静止呼吸",
      "rirTarget": 2
    }
  },
  {
    "id": "hspu_02",
    "name": "乌鸦式",
    "nameEn": "Crow Stands",
    "category": "hspu",
    "categoryLabel": "倒立撑",
    "step": 2,
    "source": "第一册第十章第二式",
    "riskLevel": "low",
    "equipment": [
      "地面(垫子)"
    ],
    "equipmentTags": [
      "floor",
      "mat"
    ],
    "purpose": "脱离墙壁的自重双臂悬空静态平衡，极大锤炼手腕力量与前锯肌稳定",
    "keyPoints": [
      "蹲姿双手撑地，双手比肩略宽",
      "将双膝内侧搭在大臂手肘外侧上方",
      "身体缓慢前倾使双脚自然离地，仅用双手维持全身平衡"
    ],
    "commonIssues": [
      {
        "problem": "面部前栽",
        "fix": "前方放置抱枕防摔，手指指腹用力抓抠地面做微调平衡"
      }
    ],
    "standards": {
      "beginner": "维持 10秒",
      "intermediate": "维持 30秒",
      "upgrade": "维持 1分钟"
    },
    "isHold": true,
    "defaultPrescription": {
      "sets": 2,
      "holdRange": [
        15,
        30
      ],
      "restSeconds": 60,
      "tempoDescription": "指尖微调抓地平衡",
      "rirTarget": 2
    }
  },
  {
    "id": "hspu_03",
    "name": "靠墙倒立",
    "nameEn": "Wall Handstands",
    "category": "hspu",
    "categoryLabel": "倒立撑",
    "step": 3,
    "source": "第一册第十章第三式",
    "riskLevel": "medium",
    "equipment": [
      "一面稳固墙面"
    ],
    "equipmentTags": [
      "wall"
    ],
    "purpose": "双臂完全伸直承受全部自重，建立肩胛上提锁紧与肩袖群超级静态耐力",
    "keyPoints": [
      "双手撑地距墙约15-20厘米",
      "单腿轻摆上墙，双脚脚跟轻搭墙面，双臂完全推起伸直",
      "核心收紧避免过度香蕉腰，静态维持2分钟目标"
    ],
    "commonIssues": [
      {
        "problem": "耸肩塌陷",
        "fix": "肩膀用力推向天花板，主动推实地面"
      }
    ],
    "standards": {
      "beginner": "维持 30秒",
      "intermediate": "维持 1分钟",
      "upgrade": "维持 2分钟"
    },
    "isHold": true,
    "defaultPrescription": {
      "sets": 2,
      "holdRange": [
        30,
        60
      ],
      "restSeconds": 90,
      "tempoDescription": "全身笔直紧绷静态维持",
      "rirTarget": 2
    }
  },
  {
    "id": "hspu_04",
    "name": "半倒立撑",
    "nameEn": "Half Handstand Pushups",
    "category": "hspu",
    "categoryLabel": "倒立撑",
    "step": 4,
    "source": "第一册第十章第四式",
    "riskLevel": "medium",
    "equipment": [
      "一面稳固墙面",
      "抱枕/软垫"
    ],
    "equipmentTags": [
      "wall"
    ],
    "purpose": "进入垂直动态推力阶段，掌握自重倒立上半程推举轨迹",
    "keyPoints": [
      "靠墙倒立姿态就位，头下垫一个厚枕头",
      "缓慢屈肘下放直到头顶轻触枕头（完成上半程下压）",
      "三角肌与三头肌协同强力推起至双臂完全伸直"
    ],
    "commonIssues": [
      {
        "problem": "手肘剧烈外展",
        "fix": "肘部内收约45度，朝向前方斜后侧"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次",
      "intermediate": "2组 × 10次",
      "upgrade": "2组 × 20次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        5,
        10
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "hspu_05",
    "name": "标准倒立撑",
    "nameEn": "Handstand Pushups",
    "category": "hspu",
    "categoryLabel": "倒立撑",
    "step": 5,
    "source": "第一册第十章第五式",
    "riskLevel": "medium",
    "equipment": [
      "一面稳固墙面"
    ],
    "equipmentTags": [
      "wall"
    ],
    "purpose": "自重垂直肩推基石！雕刻如保龄球般的饱满三角肌，铸就无比坚韧的上肢支撑力",
    "keyPoints": [
      "靠墙倒立，身体笔直呈直线",
      "缓慢下落直到头顶轻触地面",
      "爆发式将全自重垂直推起，直至双臂完全伸直锁定"
    ],
    "commonIssues": [
      {
        "problem": "头部猛砸地板",
        "fix": "下落必须以2秒慢速受控进行，触地如鹅毛"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次",
      "intermediate": "2组 × 10次",
      "upgrade": "2组 × 15次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        4,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "hspu_06",
    "name": "窄距倒立撑",
    "nameEn": "Close Handstand Pushups",
    "category": "hspu",
    "categoryLabel": "倒立撑",
    "step": 6,
    "source": "第一册第十章第六式",
    "riskLevel": "high",
    "equipment": [
      "一面稳固墙面"
    ],
    "equipmentTags": [
      "wall"
    ],
    "purpose": "双手食指间距靠近，将超负荷转移至肱三头肌外侧头与前三角肌",
    "keyPoints": [
      "双手靠近贴地，脚跟靠墙",
      "屈肘垂直下压头顶触地，手臂全程紧贴躯干两侧",
      "强力推回直立锁定"
    ],
    "commonIssues": [
      {
        "problem": "肘腕扭伤风险",
        "fix": "循序渐进收拢双手，出现刺痛立即退阶"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次",
      "intermediate": "2组 × 9次",
      "upgrade": "2组 × 12次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        3,
        6
      ],
      "restSeconds": 90,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "hspu_07",
    "name": "偏重倒立撑",
    "nameEn": "Uneven Handstand Pushups",
    "category": "hspu",
    "categoryLabel": "倒立撑",
    "step": 7,
    "source": "第一册第十章第七式",
    "riskLevel": "high",
    "equipment": [
      "一面稳固墙面",
      "篮球/砖块"
    ],
    "equipmentTags": [
      "wall"
    ],
    "purpose": "一侧手垫高，开启单侧偏重超极限肩推负荷，主肩承担约75%以上的自重",
    "keyPoints": [
      "主手平贴地面，副手撑在篮球或厚木块上",
      "沿垂直轴缓慢下沉直到头顶触地",
      "依靠主手强力推起"
    ],
    "commonIssues": [
      {
        "problem": "平衡丢失侧翻",
        "fix": "双脚在墙面微张开，稳定后背轴心"
      }
    ],
    "standards": {
      "beginner": "1组 × 4次 (每侧)",
      "intermediate": "2组 × 8次",
      "upgrade": "2组 × 10次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        3,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "hspu_08",
    "name": "单臂半倒立撑",
    "nameEn": "1/2 One-Arm Handstand Pushups",
    "category": "hspu",
    "categoryLabel": "倒立撑",
    "step": 8,
    "source": "第一册第十章第八式",
    "riskLevel": "high",
    "equipment": [
      "一面稳固墙面",
      "高位抱枕"
    ],
    "equipmentTags": [
      "wall"
    ],
    "purpose": "单手支撑承重，掌握单臂在垂直维度的惊人抗屈曲控制力",
    "keyPoints": [
      "单手撑地，副手轻放于身后或体侧，头下垫高抱枕限制深度",
      "单臂平缓屈肘下降至轻触抱枕",
      "全力蹬地推回顶峰锁定"
    ],
    "commonIssues": [
      {
        "problem": "单臂支撑不稳",
        "fix": "先确保单臂靠墙倒立能轻松静止60秒以上"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (每侧)",
      "intermediate": "2组 × 6次",
      "upgrade": "2组 × 8次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        2,
        4
      ],
      "restSeconds": 120,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "hspu_09",
    "name": "杠杆倒立撑",
    "nameEn": "Lever Handstand Pushups",
    "category": "hspu",
    "categoryLabel": "倒立撑",
    "step": 9,
    "source": "第一册第十章第九式",
    "riskLevel": "high",
    "equipment": [
      "一面稳固墙面"
    ],
    "equipmentTags": [
      "wall"
    ],
    "purpose": "副臂向侧面笔直伸展搭在墙上辅助，主臂独立完成90%以上的全行程倒立推起",
    "keyPoints": [
      "主臂垂直撑地，副臂笔直向外侧平伸按压墙面借一点点平衡",
      "主臂下压至头顶完全贴地",
      "爆发单手推起"
    ],
    "commonIssues": [
      {
        "problem": "副臂弯曲",
        "fix": "副臂必须严格笔直，仅作横向支撑"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (每侧)",
      "intermediate": "2组 × 4次",
      "upgrade": "2组 × 6次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        2,
        4
      ],
      "restSeconds": 150,
      "tempoDescription": "2秒下·1秒停·2秒上",
      "rirTarget": 2
    }
  },
  {
    "id": "hspu_10",
    "name": "单臂倒立撑",
    "nameEn": "One-Arm Handstand Pushups",
    "category": "hspu",
    "categoryLabel": "倒立撑",
    "step": 10,
    "isFinal": true,
    "source": "第一册第十章第十式 (终极式)",
    "riskLevel": "high",
    "equipment": [
      "一面稳固墙面/无器械"
    ],
    "equipmentTags": [
      "wall"
    ],
    "purpose": "徒手力量的人类巅峰！单臂完全独立在倒立状态下推起全身质量，超神级的肉体控制",
    "keyPoints": [
      "单手掌心牢牢撑地，身体靠墙或自由倒立平衡",
      "缓慢下落至面部贴近地面",
      "无可比拟的超凡力量将全自重笔直推起至手臂完全锁定"
    ],
    "commonIssues": [
      {
        "problem": "超高风险动作",
        "fix": "严禁越级尝试，必须完全达到前9式升级标准后再战"
      }
    ],
    "standards": {
      "beginner": "1组 × 1次 (每侧)",
      "intermediate": "2组 × 2次",
      "upgrade": "1组 × 5次 (神话级)"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        1,
        2
      ],
      "restSeconds": 180,
      "tempoDescription": "完全自主控制",
      "rirTarget": 2
    }
  },
  {
    "id": "hspu_demon_01",
    "name": "自由平衡单臂倒立撑",
    "nameEn": "One-Arm Freestanding HSPU",
    "category": "hspu",
    "categoryLabel": "倒立撑",
    "step": 11,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 1 式",
    "source": "第一册第十章更上一层楼 (伯特·阿瑟拉缇式)",
    "riskLevel": "high",
    "equipment": [
      "平整开阔地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "自重力量的物理极限，脱离任何墙面支撑，完全依靠单手保持动态平衡并完成垂直推起",
    "keyPoints": [
      "单手手掌支撑地面，五指成鹰爪紧抓地面微调重心",
      "全身绷成倒立长矛，非支撑手悬空于体侧调节力矩",
      "缓慢控制身体下降数英寸，再以三角肌与肱三头肌神力推回直臂",
      "人类自重推力的终极丰碑"
    ],
    "commonIssues": [
      {
        "problem": "身体失衡歪斜跌落",
        "fix": "必须先完全掌握自由双手倒立撑与靠墙单臂倒立撑"
      }
    ],
    "standards": {
      "beginner": "1组 × 1次 (每侧)",
      "intermediate": "2组 × 2次",
      "upgrade": "2组 × 5次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        1,
        2
      ],
      "restSeconds": 180,
      "tempoDescription": "极度专注·单手下沉推起",
      "rirTarget": 2
    }
  },
  {
    "id": "hspu_demon_02",
    "name": "虎立倒立臂屈伸",
    "nameEn": "Tiger Bend",
    "category": "hspu",
    "categoryLabel": "倒立撑",
    "step": 12,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 2 式",
    "source": "第一册第十章变式 (席格·克莱恩式)",
    "riskLevel": "high",
    "equipment": [
      "平整地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "purpose": "老派大力士神级绝技，自由倒立中前臂完全贴地成虎立，再依靠肱三头肌与爆发蹬力瞬间推回标准手掌倒立",
    "keyPoints": [
      "自由倒立姿态控制身体下降",
      "肘关节大幅屈曲，前臂与手肘顺滑完全平贴于地面（形成大型猫科动物前爪般的虎立姿态）",
      "在最低点锁定片刻，纯上肢带肌与肱三头肌爆发做功（结合微小蹬力）瞬间将身体强推回手掌直臂倒立",
      "练就钛合金般坚硬的肘部肌腱"
    ],
    "commonIssues": [
      {
        "problem": "手肘下沉时失控砸地",
        "fix": "下降动作全程离心减速控制，肘下可垫毛巾"
      }
    ],
    "standards": {
      "beginner": "1组 × 1次",
      "intermediate": "2组 × 3次",
      "upgrade": "2组 × 6次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        1,
        3
      ],
      "restSeconds": 150,
      "tempoDescription": "前臂落垫·爆发推回手掌",
      "rirTarget": 2
    }
  },
  {
    "id": "hspu_demon_03",
    "name": "双手倒立行走上下台阶",
    "nameEn": "Stair Handstand Walking",
    "category": "hspu",
    "categoryLabel": "倒立撑",
    "step": 13,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 3 式",
    "source": "第一册第十章变式",
    "riskLevel": "high",
    "equipment": [
      "稳固楼梯台阶"
    ],
    "equipmentTags": [
      "support"
    ],
    "purpose": "自由倒立状态下用双手在楼梯台阶上逐级向上攀爬与向下倒退，动态肩部推力与神经平衡之王",
    "keyPoints": [
      "自由倒立起立锁死身体，手掌指根持续微调重心",
      "单手离地向前上方台阶稳固落掌，随后另一手跟上",
      "逐步克服高度落差带来的重心理论偏移，下台阶时手臂主动屈伸缓冲",
      "极其严苛的肩部做功与防摔保护"
    ],
    "commonIssues": [
      {
        "problem": "台阶踩空或跌落",
        "fix": "先从1-2级矮台阶开始练习，身旁配备防摔防护垫"
      }
    ],
    "standards": {
      "beginner": "单手攀爬 3 级台阶",
      "intermediate": "攀爬 6 级台阶",
      "upgrade": "攀爬 12 级台阶往返"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        4,
        8
      ],
      "restSeconds": 120,
      "tempoDescription": "逐级挪手·步步为营",
      "rirTarget": 2
    }
  },
  {
    "id": "hspu_demon_04",
    "name": "双杠超深自由倒立撑",
    "nameEn": "Parallettes Deep Freestanding HSPU",
    "category": "hspu",
    "categoryLabel": "倒立撑",
    "step": 14,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 4 式",
    "source": "第一册第十章更上一层楼",
    "riskLevel": "high",
    "equipment": [
      "平行双杠/倒立木架"
    ],
    "equipmentTags": [
      "bar",
      "support"
    ],
    "purpose": "在双杠上进行自由倒立，身体下降使得头部完全沉入双杠水平面下方，实现超全行程极限垂直推肩",
    "keyPoints": [
      "握住双杠平稳倒立起立，双脚并拢身体刚直",
      "缓慢屈肘下潜，头部穿过双杠平面直至肩膀接触双杠高度",
      "消除反弹，纯三角肌前束与肱三头肌爆发推起回顶点",
      "无任何墙面依靠"
    ],
    "commonIssues": [
      {
        "problem": "手腕受压过度",
        "fix": "正握木质双杠把手保持中立位，避免过度背屈"
      }
    ],
    "standards": {
      "beginner": "1组 × 1次",
      "intermediate": "2组 × 4次",
      "upgrade": "2组 × 8次"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        2,
        5
      ],
      "restSeconds": 150,
      "tempoDescription": "超深下潜·垂直贯通推回",
      "rirTarget": 2
    }
  },
  {
    "id": "hspu_demon_05",
    "name": "不平衡高低物体单臂倒立",
    "nameEn": "Uneven Object One-Arm Handstand",
    "category": "hspu",
    "categoryLabel": "倒立撑",
    "step": 15,
    "isDemon": true,
    "demonLabel": "魔鬼级",
    "stepBadgeText": "魔鬼第 5 式",
    "source": "第一册第十章更上一层楼",
    "riskLevel": "high",
    "equipment": [
      "高低台阶/稳固椅面"
    ],
    "equipmentTags": [
      "support"
    ],
    "purpose": "单手支撑于不平衡高低物体（如单手撑在椅子边缘或一级台阶边缘）保持自由单臂倒立",
    "keyPoints": [
      "单手掌心贴紧不平衡物体边缘，手指施加极端下压对冲力矩",
      "身体侧斜寻找唯一微妙的零重力重心垂线",
      "非支撑手悬空平衡，心流高度专注",
      "老派体操艺术之巅"
    ],
    "commonIssues": [
      {
        "problem": "支撑物翻倒摇晃",
        "fix": "必须确保物体绝对稳固不晃荡，先从微小高度落差练习"
      }
    ],
    "standards": {
      "beginner": "维持 2 秒 (每侧)",
      "intermediate": "维持 5 秒",
      "upgrade": "维持 10 秒"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        2,
        5
      ],
      "restSeconds": 180,
      "tempoDescription": "非对称支撑·绝对定力",
      "rirTarget": 2
    }
  },
  {
    "id": "aux_hang",
    "name": "双手悬垂",
    "nameEn": "Dead Hang",
    "category": "auxiliary",
    "categoryLabel": "辅助",
    "step": 1,
    "source": "第二册第三章",
    "riskLevel": "low",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "purpose": "拉伸肩背韧带，打造如铁钳般的抓握耐力，强化手掌屈肌腱",
    "keyPoints": [
      "双手正握单杠完全离地悬空，全身放松下垂",
      "保持深长呼吸，指尖紧扣单杠直至无法维持"
    ],
    "commonIssues": [
      {
        "problem": "指皮磨痛",
        "fix": "手掌正确搭杠，避免过多皮褶挤压"
      }
    ],
    "standards": {
      "beginner": "维持 15秒",
      "intermediate": "维持 30秒",
      "upgrade": "维持 1分钟"
    },
    "isHold": true,
    "defaultPrescription": {
      "sets": 2,
      "holdRange": [
        20,
        60
      ],
      "restSeconds": 60,
      "tempoDescription": "静态维持",
      "rirTarget": 2
    }
  },
  {
    "id": "aux_towelHang",
    "name": "毛巾悬垂",
    "nameEn": "Towel Hang",
    "category": "auxiliary",
    "categoryLabel": "辅助",
    "step": 2,
    "source": "第二册第四章",
    "riskLevel": "medium",
    "equipment": [
      "单杠",
      "毛巾"
    ],
    "equipmentTags": [
      "bar"
    ],
    "purpose": "握力终极进阶！紧握两根垂直垂下的毛巾悬空，成倍增强指力和前臂粗壮度",
    "keyPoints": [
      "两块厚毛巾搭在单杠上，双手各紧握一侧毛巾下垂端",
      "双脚离地悬垂，强力握捏毛巾保持不滑落"
    ],
    "commonIssues": [
      {
        "problem": "毛巾滑脱",
        "fix": "选用粗糙摩擦力大的棉质厚毛巾"
      }
    ],
    "standards": {
      "beginner": "维持 10秒",
      "intermediate": "维持 20秒",
      "upgrade": "维持 45秒"
    },
    "isHold": true,
    "defaultPrescription": {
      "sets": 2,
      "holdRange": [
        15,
        45
      ],
      "restSeconds": 90,
      "tempoDescription": "静态抓捏",
      "rirTarget": 2
    }
  },
  {
    "id": "aux_calfRaise",
    "name": "单腿提踵",
    "nameEn": "Single Leg Calf Raise",
    "category": "auxiliary",
    "categoryLabel": "辅助",
    "step": 1,
    "source": "第二册第十一章",
    "riskLevel": "low",
    "equipment": [
      "台阶/踏板"
    ],
    "equipmentTags": [
      "step",
      "chair"
    ],
    "purpose": "强化跟腱弹性与小腿腓肠肌、比目鱼肌，提升下肢奔跑弹跳与踝关节抗扭能力",
    "keyPoints": [
      "单脚前掌站在台阶边缘，脚后跟尽量向下沉以完全拉伸跟腱",
      "前脚掌全力爆发蹬起直至最高点，顶峰收缩1秒",
      "缓慢受控下放至最大拉伸点，左右交替"
    ],
    "commonIssues": [
      {
        "problem": "幅度过小",
        "fix": "必须充分利用台阶高低差，完成极致拉伸与顶峰收缩"
      }
    ],
    "standards": {
      "beginner": "1组 × 10次",
      "intermediate": "2组 × 25次",
      "upgrade": "2组 × 50次"
    },
    "defaultPrescription": {
      "sets": 2,
      "repRange": [
        15,
        30
      ],
      "restSeconds": 45,
      "tempoDescription": "2秒上·1秒停·2秒下",
      "rirTarget": 2
    }
  }
];

module.exports = exercisesCC1;
