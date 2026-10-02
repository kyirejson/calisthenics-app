import type { EquipmentGroup } from './equipment';
import type { GearKey } from './equipmentTaxonomy';
import type { EquipmentGuide } from './equipmentGuidance';
import type { RecommendationTier, RankingEvidence } from './equipmentRecommendations';

type EquipmentAddition = {
  id: string; group: EquipmentGroup; name: string; nameEn: string; targetMuscles: string;
  regions: string[]; gear: GearKey[]; tier: RecommendationTier; evidence: RankingEvidence;
  reason: string; sources: EquipmentGuide['sources']; guide: [string, string, string, string, string];
};
// Five clarified variations plus all 25 report candidates. No prescriptions or progression gates.
export const equipmentAdditions: EquipmentAddition[] = [
  {
    "id": "equipment_chest_19",
    "targetMuscles": "胸大肌（锁骨部侧重）；其他相关肌群协同，非单肌孤立",
    "group": "chest",
    "name": "上斜推胸机",
    "nameEn": "Incline Chest Press Machine",
    "regions": [
      "chest_upper"
    ],
    "gear": [
      "machine"
    ],
    "tier": "S",
    "evidence": "R",
    "reason": "上斜推的稳定器械候选；座高与轨迹需适配，不代表比其他上斜推更增肌。",
    "sources": [
      {
        "title": "相关训练研究",
        "url": "https://pubmed.ncbi.nlm.nih.gov/32922646/"
      },
      {
        "title": "操作或器材参考",
        "url": "https://www.lifefitness.com/en-us/brands/hammer-strength"
      }
    ],
    "guide": [
      "座高使握柄在上胸附近，背与脚稳定；按机型调起始档位。",
      "沿斜上轨迹推出，再慢回起点，肩部处于舒适范围。",
      "推出呼气；负重归位后再松手，不撞配重。",
      "身体前倾脱垫｜减重并保持背垫接触。",
      "肩被拉到过深｜调小起始行程。"
    ]
  },
  {
    "id": "equipment_chest_20",
    "targetMuscles": "胸大肌（胸肋部区域侧重）；其他相关肌群协同，非单肌孤立",
    "group": "chest",
    "name": "单臂哑铃卧推",
    "nameEn": "Single-arm Dumbbell Bench Press",
    "regions": [
      "chest_middle"
    ],
    "gear": [
      "dumbbell"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "提供单侧负荷选择；躯干抗旋转可能先限制，不承诺自动修复左右差异。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.nasm.org/resource-center/exercise-library"
      }
    ],
    "guide": [
      "平凳稳定、脚站宽到能稳住，单手轻哑铃安全入位，空手可扶凳。",
      "一侧哑铃从胸侧受控推起，再慢慢回落，躯干不跟着转。",
      "推起呼气；左右分别练，先稳妥卸掉负重再坐起。",
      "侧转或翻离凳｜减重、增加脚部支撑。",
      "空手拽凳仍失衡｜改双臂或器械版本。"
    ]
  },
  {
    "id": "equipment_shoulders_14",
    "targetMuscles": "三角肌中束；其他相关肌群协同，非单肌孤立",
    "group": "shoulders",
    "name": "器械侧平举",
    "nameEn": "Machine Lateral Raise",
    "regions": [
      "shoulders_side"
    ],
    "gear": [
      "machine"
    ],
    "tier": "S",
    "evidence": "P",
    "reason": "补充有支撑的中束候选；没有证据证明该机器必然胜过哑铃或绳索。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.lifefitness.com/en-us/catalog/strength-training/plate-loaded/plate-loaded-lateral-raise"
      }
    ],
    "guide": [
      "按机型调座高与手臂垫，肩靠近转轴区域，脚踩稳。",
      "沿机器弧线抬起上臂，再控制回落，肘腕自然。",
      "抬起呼气；归位后再松手，允许肩胛随抬臂运动。",
      "身体顶垫甩重量｜减重并贴稳靠垫。",
      "支点压肘或肩不适｜重调座位，不适换设备。"
    ]
  },
  {
    "id": "equipment_shoulders_15",
    "targetMuscles": "肩袖内外旋相关肌群；其他相关肌群协同，非单肌孤立",
    "group": "shoulders",
    "name": "肘靠体侧绳索外旋",
    "nameEn": "Cable External Rotation at Side",
    "regions": [
      "shoulders_rotator"
    ],
    "gear": [
      "cable"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "明确肩袖外旋入口；不是肩痛自助康复处方。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.acefitness.org/resources/everyone/exercise-library/352/rotator-cuff-external-rotation/"
      }
    ],
    "guide": [
      "滑轮约腰高，工作侧远离机器，肘屈约直角靠体侧，可夹小毛巾。",
      "上臂保持体侧，肩外旋使前臂向外展开，再控制回到腹前。",
      "自然呼吸；轻阻力、舒适幅度，左右分别练。",
      "肘离身变成后束飞鸟｜减重并保持肘位置。",
      "转腰拉柄｜稳定躯干，缩小外旋幅度。"
    ]
  },
  {
    "id": "equipment_shoulders_16",
    "targetMuscles": "肩袖内外旋相关肌群；其他相关肌群协同，非单肌孤立",
    "group": "shoulders",
    "name": "肘靠体侧绳索内旋",
    "nameEn": "Cable Internal Rotation at Side",
    "regions": [
      "shoulders_rotator"
    ],
    "gear": [
      "cable"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "补充肩袖内旋方向；需轻阻力与独立机位，不等同外旋。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.acefitness.org/resources/everyone/exercise-library/body-part/shoulders/rotator-cuff/"
      }
    ],
    "guide": [
      "滑轮约腰高，工作侧靠近机器，肘屈约直角靠体侧。",
      "肩内旋将前臂移向腹前，再控制向外回伸，上臂不移动。",
      "自然呼吸；左右分别练，舒适范围内完成。",
      "身体旋转代偿｜减重并固定躯干朝向。",
      "肘向前后移动｜保持体侧位置，降低阻力。"
    ]
  },
  {
    "id": "equipment_shoulders_17",
    "targetMuscles": "前锯肌及肩胛运动肌群；其他相关肌群协同，非单肌孤立",
    "group": "shoulders",
    "name": "肩胛俯卧撑",
    "nameEn": "Scapular Push-up Plus",
    "regions": [
      "shoulders_scapular"
    ],
    "gear": [
      "bodyweight"
    ],
    "tier": "B",
    "evidence": "P",
    "reason": "用于前锯肌与肩胛控制；增肌默认B，肩胛控制用途可选A。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.acefitness.org/resources/everyone/exercise-library/188/seated-chest-press/"
      }
    ],
    "guide": [
      "手撑地或高位稳固支撑，肘保持伸直，肋骨骨盆稳定。",
      "不屈肘，受控让胸略沉，再推地使肩胛前伸，躯干整体移动。",
      "推地呼气；先高位或跪姿，结束先卸力再松手。",
      "屈肘做普通俯卧撑｜保持肘伸直，减少幅度。",
      "塌腰圆腰凑弓背｜保持躯干稳定，以肩胛运动为主。"
    ]
  },
  {
    "id": "equipment_back_14",
    "targetMuscles": "上背肌群（斜方肌、菱形肌等）、背阔肌；其他相关肌群协同，非单肌孤立",
    "group": "back",
    "name": "上斜凳胸支撑哑铃划船",
    "nameEn": "Incline Chest-supported Dumbbell Row",
    "regions": [
      "back_upper",
      "back_lats"
    ],
    "gear": [
      "dumbbell"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "给哑铃与斜凳条件下提供有支撑水平拉，凳位与入位需合适。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.nasm.org/resource-center/exercise-library"
      }
    ],
    "guide": [
      "斜凳锁定，胸部贴垫，脚稳放地面，双臂持哑铃自然下垂。",
      "屈肘拉向躯干两侧，再慢慢回伸，肩胛允许协同运动。",
      "拉起呼气；先放稳哑铃再离凳，凳角按支撑与空间调整。",
      "抬胸离垫甩铃｜减重并保持胸接触。",
      "下巴压凳憋气｜调支撑高度，颈部自然。"
    ]
  },
  {
    "id": "equipment_back_15",
    "targetMuscles": "背阔肌、上背肌群（斜方肌、菱形肌等）；其他相关肌群协同，非单肌孤立",
    "group": "back",
    "name": "坐姿胸支撑器械划船（中立握）",
    "nameEn": "Neutral-grip Chest-supported Machine Row",
    "regions": [
      "back_lats",
      "back_upper"
    ],
    "gear": [
      "machine"
    ],
    "tier": "S",
    "evidence": "P",
    "reason": "与宽握外展肘路径区分；是同一水平拉动作族的中立握变式，不算新的运动模式。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.precor.com/en-US/strength/plate-loaded/discovery/all"
      }
    ],
    "guide": [
      "调胸垫、座位和脚踏，胸贴垫，选掌心相对的握柄。",
      "肘沿体侧受控向后拉，再慢慢回伸，不转躯干。",
      "拉回呼气；归位再松手，设备不合适则选其他支撑划船。",
      "胸离垫增加行程｜减重，保持支撑。",
      "握把迫使肩腕偏折｜调座位或换舒适握把。"
    ]
  },
  {
    "id": "equipment_back_16",
    "targetMuscles": "上斜方肌；其他相关肌群协同，非单肌孤立",
    "group": "back",
    "name": "哑铃耸肩",
    "nameEn": "Dumbbell Shrug",
    "regions": [
      "back_traps"
    ],
    "gear": [
      "dumbbell"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "补肩胛上提与上斜方肌入口；不承诺改变颈部形态。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.nasm.org/resource-center/exercise-library"
      }
    ],
    "guide": [
      "双脚稳站，哑铃持于两侧，手臂自然伸直，颈部中立。",
      "肩胛受控向上提，再慢慢回落，不绕肩画圈。",
      "抬起呼气；握力受限时减轻重量，稳放负重后结束。",
      "转肩画圈｜用受控上提与回落。",
      "蹬腿弹起｜减重，保持双脚稳定。"
    ]
  },
  {
    "id": "equipment_back_17",
    "targetMuscles": "背阔肌；其他相关肌群协同，非单肌孤立",
    "group": "back",
    "name": "辅助引体向上",
    "nameEn": "Assisted Pull-up",
    "regions": [
      "back_lats"
    ],
    "gear": [
      "machine",
      "accessory"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "为自重与加重引体提供退阶；机器配重越大辅助越多，弹力带辅助随位置变化。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.nasm.org/resource-center/exercise-library"
      }
    ],
    "guide": [
      "机器：先选辅助量，握稳后按机型踏上跪垫。弹力带：检查完整并固定于可靠单杠，谨慎踩入。",
      "受控拉起与下降，身体不摆；机器与弹力带不能用同一辅助数值换算。",
      "拉起呼气；机器按踏板退出；弹力带先站稳再卸带，防回弹。",
      "把机器配重当负重｜它通常提供辅助，按机型说明确认。",
      "弹力带滑脱或老化｜停止，换完好器材并检查固定。"
    ]
  },
  {
    "id": "equipment_legs_15",
    "targetMuscles": "股四头肌、臀大肌；其他相关肌群协同，非单肌孤立",
    "group": "legs",
    "name": "哈克深蹲机",
    "nameEn": "Hack Squat Machine",
    "regions": [
      "legs_quads",
      "legs_glutes"
    ],
    "gear": [
      "machine"
    ],
    "tier": "S",
    "evidence": "R",
    "reason": "与倒蹬机独立设置；有支撑的股四头候选，等级不证明比自由蹲更增肌。",
    "sources": [
      {
        "title": "相关训练研究",
        "url": "https://pubmed.ncbi.nlm.nih.gov/37535335/"
      }
    ],
    "guide": [
      "肩背贴稳滑架，脚踩全踏板，按机型设保护挡并练熟解挂回挂。",
      "解挂后屈髋屈膝降下滑架，再推起；身体随滑架移动。",
      "推起呼气；深度以脚与背不失稳为限，确认回挂再退出。",
      "脚跟离板或骨盆卷起｜减小深度、调整脚位。",
      "解挂后无可用保护｜先完善止挡，不带重临时调整。"
    ]
  },
  {
    "id": "equipment_legs_16",
    "targetMuscles": "股四头肌、臀大肌；其他相关肌群协同，非单肌孤立",
    "group": "legs",
    "name": "高脚杯深蹲",
    "nameEn": "Goblet Squat",
    "regions": [
      "legs_quads",
      "legs_glutes"
    ],
    "gear": [
      "dumbbell"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "补低门槛蹲模式；握持可先限制，不等同所有重蹲的替代。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.nasm.org/resource-center/exercise-library/goblet-squat"
      }
    ],
    "guide": [
      "双手稳握哑铃上端贴胸前，双脚站到能稳定下蹲的位置。",
      "髋膝协调下蹲至可控深度，再全脚掌发力站起。",
      "站起呼气；负重保持近身，先放稳哑铃再结束。",
      "哑铃离胸拉扯腰｜保持近身并减重。",
      "脚跟抬起失衡｜调站距或缩小深度。"
    ]
  },
  {
    "id": "equipment_legs_17",
    "targetMuscles": "股四头肌、臀大肌；其他相关肌群协同，非单肌孤立",
    "group": "legs",
    "name": "史密斯深蹲",
    "nameEn": "Smith Machine Squat",
    "regions": [
      "legs_quads",
      "legs_glutes"
    ],
    "gear": [
      "smith"
    ],
    "tier": "A",
    "evidence": "R",
    "reason": "补固定轨迹双侧蹲；轨道不保证人人适配或零风险。",
    "sources": [
      {
        "title": "相关训练研究",
        "url": "https://pubmed.ncbi.nlm.nih.gov/37535335/"
      }
    ],
    "guide": [
      "空杆试导轨方向、脚位与平衡，杠在肩背支撑区，保护挡先设好。",
      "解挂后髋膝协调下降，再受控站起，脚保持稳定接触。",
      "可控呼吸维持支撑；回挂确认锁定后退出。",
      "把脚位写成统一距离｜用空杆试个人与轨道适配。",
      "为下蹲深度卷骨盆失控｜减深度、减重。"
    ]
  },
  {
    "id": "equipment_legs_18",
    "targetMuscles": "股四头肌、臀大肌；其他相关肌群协同，非单肌孤立",
    "group": "legs",
    "name": "史密斯分腿蹲（后脚落地）",
    "nameEn": "Smith Split Squat",
    "regions": [
      "legs_quads",
      "legs_glutes"
    ],
    "gear": [
      "smith"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "后脚落地的分腿变式，不是保加利亚分腿蹲；先验证固定轨道适配。",
    "sources": [
      {
        "title": "相关训练研究",
        "url": "https://pubmed.ncbi.nlm.nih.gov/37535335/"
      }
    ],
    "guide": [
      "杠在肩背支撑区，前后站位以空杆试蹲；后脚留在地面，设止挡。",
      "屈双膝受控下降，再主要以前腿站回，脚不在负重时换位。",
      "站起呼气；回挂卸力后再换侧。",
      "后脚抬高却照用本指导｜本条后脚落地，高位版本另选。",
      "站位太窄左右摇晃｜先调整横向间距并减重。"
    ]
  },
  {
    "id": "equipment_legs_19",
    "targetMuscles": "股四头肌、臀大肌；其他相关肌群协同，非单肌孤立",
    "group": "legs",
    "name": "哑铃反向箭步蹲",
    "nameEn": "Dumbbell Reverse Lunge",
    "regions": [
      "legs_quads",
      "legs_glutes"
    ],
    "gear": [
      "dumbbell"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "补占地较少的单侧蹲替代；不承诺适合所有膝关节问题。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.nasm.org/resource-center/blog/squat-alternatives"
      }
    ],
    "guide": [
      "先自重站稳，后方空间清空，再双侧持哑铃。",
      "一脚后撤、受控下降，再以前腿发力回到站姿，左右分别完成。",
      "站起呼气；后撤距离按平衡调整，稳放哑铃后结束。",
      "后撤过窄失衡｜稍留横向间距，减轻负重。",
      "急蹬后腿冲回｜前腿控制，降低节奏。"
    ]
  },
  {
    "id": "equipment_legs_20",
    "targetMuscles": "臀中肌、臀小肌及其他髋外展肌；其他相关肌群协同，非单肌孤立",
    "group": "legs",
    "name": "坐姿器械髋外展",
    "nameEn": "Seated Hip Abduction Machine",
    "regions": [
      "legs_abductors"
    ],
    "gear": [
      "machine"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "补髋外展与臀中小肌相关覆盖，不承诺消除臀凹或孤立某束。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.lifefitness.com/en-us/catalog/strength-training/selectorized/insignia-series-sit-stand-hip-abductor"
      }
    ],
    "guide": [
      "确认坐姿机型，膝垫在外侧，座椅与起始开度舒适。",
      "坐稳将双腿受控向外打开，再慢慢合回。",
      "打开呼气；不猛撞终末档位，配重归位后退出。",
      "用躯干摆动甩腿｜减重并保持骨盆支撑。",
      "把外侧垫当内收机｜核对垫位和运动方向。"
    ]
  },
  {
    "id": "equipment_legs_21",
    "targetMuscles": "腘绳肌群、臀大肌；其他相关肌群协同，非单肌孤立",
    "group": "legs",
    "name": "单腿哑铃罗马尼亚硬拉",
    "nameEn": "Single-leg Dumbbell Romanian Deadlift",
    "regions": [
      "legs_hamstrings",
      "legs_glutes"
    ],
    "gear": [
      "dumbbell"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "补单侧髋铰链；可扶稳，不以平衡困难证明增肌更优。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.nasm.org/resource-center/exercise-library/dumbbell-romanian-deadlift"
      }
    ],
    "guide": [
      "支撑腿膝微屈，单手持轻铃，另一手可扶可靠支撑，髋保持正向。",
      "支撑侧髋后移，另一腿随躯干平衡后伸，再伸髋站回。",
      "站回呼气；幅度不追触地，卸铃再换侧。",
      "骨盆向外翻｜减深度、扶稳，保持髋朝下。",
      "锁膝弯腰｜保留柔和屈膝，以髋后移为主。"
    ]
  },
  {
    "id": "equipment_legs_22",
    "targetMuscles": "胫骨前肌及其他踝背屈肌；其他相关肌群协同，非单肌孤立",
    "group": "legs",
    "name": "器械踝背屈提脚",
    "nameEn": "Machine Tibia Dorsi-flexion",
    "regions": [
      "legs_tibialis"
    ],
    "gear": [
      "machine"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "补胫骨前肌与踝背屈；仅使用专用设备，不指导临时把重物绑脚。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.lifefitness.com/en-us/brands/hammer-strength"
      }
    ],
    "guide": [
      "按专用踝背屈机说明坐稳，足部垫和轴线适配；先无负重熟悉卡扣。",
      "脚跟保持支撑，通过踝背屈抬起前脚掌，再受控回落。",
      "自然呼吸；轻负荷、舒适幅度，归位卸力后退出。",
      "临时夹铃或绑重物｜不用未经验证的固定方式。",
      "扭脚代替提脚｜保持自然足位与受控背屈方向。"
    ]
  },
  {
    "id": "equipment_core_11",
    "targetMuscles": "腹直肌与髋屈肌协同",
    "group": "core",
    "name": "悬垂直腿举腿",
    "nameEn": "Hanging Straight-leg Raise",
    "regions": [
      "core_abs"
    ],
    "gear": [
      "bodyweight"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "从提膝拆出长杠杆变式；需要悬挂和骨盆控制，不等同只练下腹。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.nasm.org/resource-center/blog/training/progressive-core-training-programming-the-core-beyond-crunches"
      }
    ],
    "guide": [
      "可靠单杠环握，先能控制提膝；身体不摆，双腿伸直到能维持的程度。",
      "受控抬腿并卷起骨盆，再缓慢下放，不追最高点。",
      "抬起呼气；失控时退回提膝，稳定落脚后退出。",
      "摆腿带起身体｜减少杠杆或退回提膝。",
      "只屈髋不控骨盆｜降低速度，缩小幅度。"
    ]
  },
  {
    "id": "equipment_core_12",
    "targetMuscles": "腹直肌；其他相关肌群协同，非单肌孤立",
    "group": "core",
    "name": "反向卷腹",
    "nameEn": "Reverse Crunch",
    "regions": [
      "core_abs"
    ],
    "gear": [
      "bodyweight"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "补不依赖悬挂握力的骨盆卷起动作，不声称孤立下腹。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.nasm.org/resource-center/blog/training/progressive-core-training-programming-the-core-beyond-crunches"
      }
    ],
    "guide": [
      "仰卧垫上，膝弯曲，手扶可靠固定点或置于体侧，头肩稳定。",
      "腹部控制骨盆向胸廓卷起，再慢慢放回，不以踢腿制造惯性。",
      "卷起呼气；回落不失控反弓腰，结束稳妥落脚。",
      "腿踢得高但骨盆不卷｜缩小腿动作，关注卷骨盆。",
      "回落腰反弓｜缩小范围，保持控制。"
    ]
  },
  {
    "id": "equipment_core_13",
    "targetMuscles": "躯干稳定肌群协同；其他相关肌群协同，非单肌孤立",
    "group": "core",
    "name": "死虫式",
    "nameEn": "Dead Bug",
    "regions": [
      "core_stability"
    ],
    "gear": [
      "bodyweight"
    ],
    "tier": "B",
    "evidence": "P",
    "reason": "增肌默认B，低门槛抗伸展控制可选A；本条不含负重或弹力带变式。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.nasm.org/resource-center/exercise-library/dead-bug"
      }
    ],
    "guide": [
      "仰卧，手臂朝上，髋膝弯曲，肋骨骨盆保持可控位置。",
      "缓慢伸出对侧手脚，再回起点换侧；不为贴地而塌腰。",
      "伸出时呼气，保持连续呼吸；可先只动腿或缩短杠杆。",
      "下背随伸腿明显反弓｜减小伸出距离。",
      "同时快速摆四肢｜单侧慢动，先减少肢体数量。"
    ]
  },
  {
    "id": "equipment_core_14",
    "targetMuscles": "腹斜肌、躯干稳定肌群协同；其他相关肌群协同，非单肌孤立",
    "group": "core",
    "name": "单侧手提行走",
    "nameEn": "Suitcase Carry",
    "regions": [
      "core_obliques",
      "core_stability"
    ],
    "gear": [
      "dumbbell"
    ],
    "tier": "B",
    "evidence": "P",
    "reason": "增肌默认B，抗侧屈用途可选A；握力也可能先限制。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.acefitness.org/resources/everyone/exercise-library/358/suitcase-carry/"
      }
    ],
    "guide": [
      "一手持哑铃，通道清空，另一手自然，站直不侧倾。",
      "小步稳走，抵抗单侧负重让躯干倾斜，转向时减速。",
      "连续呼吸；左右分别练，先站稳再放下负重。",
      "身体向重量倾倒｜减重，保持躯干直立。",
      "走太快转弯甩铃｜放慢并清空通道。"
    ]
  },
  {
    "id": "equipment_arms_15",
    "targetMuscles": "肱三头肌（各头参与）；其他相关肌群协同，非单肌孤立",
    "group": "arms",
    "name": "仰卧哑铃臂屈伸",
    "nameEn": "Lying Dumbbell Triceps Extension",
    "regions": [
      "arms_triceps"
    ],
    "gear": [
      "dumbbell"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "从EZ杠版本拆出，左右路径与入位独立控制。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.nasm.org/resource-center/exercise-library"
      }
    ],
    "guide": [
      "仰卧平凳，头肩臀稳住，两只轻哑铃中立握安全移至上方。",
      "上臂相对稳定，屈肘使哑铃移向头两侧，再受控伸回。",
      "伸肘呼气；保持两铃远离脸，先稳妥交接负重再坐起。",
      "左右铃互撞｜减重，留出独立路径。",
      "肩来回摆动｜稳定上臂，减小幅度。"
    ]
  },
  {
    "id": "equipment_arms_16",
    "targetMuscles": "肱二头肌、肱肌及肱桡肌相关屈肘协同；其他相关肌群协同，非单肌孤立",
    "group": "arms",
    "name": "牧师凳哑铃弯举",
    "nameEn": "Dumbbell Preacher Curl",
    "regions": [
      "arms_biceps",
      "arms_brachialis"
    ],
    "gear": [
      "dumbbell"
    ],
    "tier": "S",
    "evidence": "R",
    "reason": "从EZ杠拆出单侧自由重量变式；研究未证明所有器材同等或孤立短头。",
    "sources": [
      {
        "title": "相关训练研究",
        "url": "https://pubmed.ncbi.nlm.nih.gov/39809454/"
      }
    ],
    "guide": [
      "调凳高，上臂贴垫，单手轻哑铃握稳，腕自然。",
      "受控屈肘举起，再慢慢伸回，肘不过度压直。",
      "弯起呼气；先稳放哑铃再换侧或离座。",
      "底部弹起｜减重并控制回程。",
      "上臂滑离垫｜重调座高，缩小范围。"
    ]
  },
  {
    "id": "equipment_arms_17",
    "targetMuscles": "肱肌及肱桡肌相关屈肘协同、前臂肌群与握持协同；其他相关肌群协同，非单肌孤立",
    "group": "arms",
    "name": "绳索锤式弯举",
    "nameEn": "Cable Rope Hammer Curl",
    "regions": [
      "arms_brachialis",
      "arms_forearms"
    ],
    "gear": [
      "cable"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "与哑铃锤式独立：低位滑轮和绳柄提供不同阻力方向。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.nasm.org/resource-center/exercise-library"
      }
    ],
    "guide": [
      "低位滑轮接绳柄，掌心相对，站稳，上臂在体侧。",
      "受控屈肘拉起绳柄，再慢慢伸回，中立握不折腕。",
      "弯起呼气；配重归位后放绳，不用躯干后仰顶重量。",
      "后仰拉绳｜减重并稳住站姿。",
      "上臂前后摆动｜保持相对位置，减小负荷。"
    ]
  },
  {
    "id": "equipment_arms_18",
    "targetMuscles": "肱二头肌；其他相关肌群协同，非单肌孤立",
    "group": "arms",
    "name": "身后绳索弯举",
    "nameEn": "Behind-body Cable Curl (Bayesian Curl)",
    "regions": [
      "arms_biceps"
    ],
    "gear": [
      "cable"
    ],
    "tier": "A",
    "evidence": "D",
    "reason": "补肩后伸屈肘选择；匹配阻力条件的研究未检出必然增肌优势。",
    "sources": [
      {
        "title": "相关训练研究",
        "url": "https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2026.1750722/full"
      }
    ],
    "guide": [
      "低位滑轮在身后，分腿稳站，工作侧上臂自然略在身后，不强拉肩。",
      "保持上臂相对位置，屈肘举柄，再受控伸回。",
      "弯起呼气；肩不适就调位置或换肩中立位弯举。",
      "强迫肩最大后伸｜减少后伸角度。",
      "躯干前后摆动｜减重、稳住脚位。"
    ]
  },
  {
    "id": "equipment_arms_19",
    "targetMuscles": "肱二头肌、肱肌及肱桡肌相关屈肘协同；其他相关肌群协同，非单肌孤立",
    "group": "arms",
    "name": "器械牧师弯举",
    "nameEn": "Machine Preacher Curl",
    "regions": [
      "arms_biceps",
      "arms_brachialis"
    ],
    "gear": [
      "machine"
    ],
    "tier": "S",
    "evidence": "R",
    "reason": "提供支撑型屈肘候选，机器适配是前提；牧师研究不是该机型认证。",
    "sources": [
      {
        "title": "相关训练研究",
        "url": "https://pubmed.ncbi.nlm.nih.gov/39809454/"
      },
      {
        "title": "操作或器材参考",
        "url": "https://www.lifefitness.com/en-us/brands/hammer-strength"
      }
    ],
    "guide": [
      "调座高与臂垫，上臂贴稳，肘与机器转轴适配。",
      "受控屈肘举柄，再慢慢伸回，底部不弹起。",
      "弯起呼气；配重归位后再松手离座。",
      "肘与轴线不合｜重新调座位和垫位。",
      "肩抬起脱离臂垫｜减重，保持支撑。"
    ]
  },
  {
    "id": "equipment_arms_20",
    "targetMuscles": "肱三头肌（各头参与）；其他相关肌群协同，非单肌孤立",
    "group": "arms",
    "name": "窄距杠铃卧推",
    "nameEn": "Close-grip Barbell Bench Press",
    "regions": [
      "arms_triceps"
    ],
    "gear": [
      "barbell"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "补三头偏重水平推；胸与前三角仍协同，窄握不等于双手贴合。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.nasm.org/resource-center/exercise-library/close-grip-bench-press"
      }
    ],
    "guide": [
      "平凳、保护杆或保护员就位，环握舒适偏窄握距，腕与前臂对齐。",
      "受控下放到胸部区域，再推回，不弹胸。",
      "可控呼吸维持支撑；先确认架位再回架。",
      "双手贴合折腕｜用舒适握距而非极窄。",
      "肘腕被强迫偏折｜调整握距、负荷与行程。"
    ]
  },
  {
    "id": "equipment_arms_21",
    "targetMuscles": "肱肌及肱桡肌相关屈肘协同、前臂肌群与握持协同；其他相关肌群协同，非单肌孤立",
    "group": "arms",
    "name": "EZ杠反握弯举",
    "nameEn": "Reverse EZ-bar Curl",
    "regions": [
      "arms_brachialis",
      "arms_forearms"
    ],
    "gear": [
      "barbell"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "补旋前握屈肘与肱桡肌相关训练；不承诺孤立前臂。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.nasm.org/resource-center/exercise-library"
      }
    ],
    "guide": [
      "掌心向下环握EZ杠舒适握段，站稳，上臂自然在体侧。",
      "保持反握与腕位，受控屈肘举起，再慢慢回落。",
      "弯起呼气；用能握稳的负荷，先放稳杠再结束。",
      "腕后折或握不稳｜减重、调整握段。",
      "甩髋挺腰｜减重并保持躯干稳定。"
    ]
  },
  {
    "id": "equipment_arms_22",
    "targetMuscles": "前臂腕伸肌群；其他相关肌群协同，非单肌孤立",
    "group": "arms",
    "name": "坐姿哑铃腕伸",
    "nameEn": "Seated Dumbbell Wrist Extension",
    "regions": [
      "arms_wrist_extensors"
    ],
    "gear": [
      "dumbbell"
    ],
    "tier": "A",
    "evidence": "P",
    "reason": "补腕伸方向，与掌心向上腕屈独立；不是肘痛自助康复处方。",
    "sources": [
      {
        "title": "操作或器材参考",
        "url": "https://www.nasm.org/resource-center/blog/training/9-of-the-best-arm-sculpting-exercises-to-tone-and-strengthen"
      }
    ],
    "guide": [
      "坐稳，前臂掌心向下贴大腿或凳，腕在支撑边缘，握轻哑铃。",
      "仅通过腕伸抬起手背，再慢慢回落，不抬整个前臂。",
      "自然呼吸，幅度舒适；全程握稳，结束先稳妥卸负重。",
      "前臂离开支撑｜减重，保持支撑。",
      "靠快速甩腕｜减轻重量，慢回落。"
    ]
  }
];
