/**
 * 《囚徒健身3: 超级爆发力》六功完整动作库 (共60式)
 * 1. 爆发跳跃 (1-10式)
 * 2. 爆发俯卧撑 (1-10式)
 * 3. 功夫打挺 (1-10式)
 * 4. 前空翻与前手翻 (1-10式)
 * 5. 后空翻与后手翻 (1-10式)
 * 6. 暴力上杠与双立臂 (1-10式)
 * 官方标准译名、训练要领与技术处方严格遵循原著
 */

const exercisesCC3 = [
  {
    "id": "pJump_01",
    "name": "直蹦",
    "nameEn": "Straight Hop",
    "category": "power_jump",
    "categoryLabel": "爆发跳跃",
    "seriesId": "power_jump",
    "step": 1,
    "source": "第三册第四章第一式",
    "riskLevel": "low",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "简单的直蹦应当是所有爆发跳跃练习的第一步，对初学者而言尤其如此。直蹦让人学会起跳与落地动作，同时强化踝关节和膝关节，为更有难度的跳跃练习做准备。因为膝关节的活动...",
    "keyPoints": [
      "站立，双脚分开，与肩同宽。身体保持紧张，准备做动作。",
      "稍稍下蹲。（膝关节只需轻微弯曲，幅度不到深蹲时的1/4。）",
      "不要停顿，用小腿以及其他身体部位能用上的所有爆发力起跳。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "这是一种最易学的基础跳跃动作，要想动作更简单，减小跳跃强度就足够了。让身体放松而不是紧张（像弹簧一样缩起来）同样能降低难度。"
      }
    ],
    "standards": {
      "beginner": "1组 × 6次 (动作受控·安全完成)",
      "intermediate": "2组 × 8次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 10次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        4,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pJump_02",
    "name": "深蹲跳",
    "nameEn": "Squat Jump",
    "category": "power_jump",
    "categoryLabel": "爆发跳跃",
    "seriesId": "power_jump",
    "step": 2,
    "source": "第三册第四章第二式",
    "riskLevel": "low",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "深蹲跳是所有跳跃技巧的基石。让一位新手跳的话，这就是他本能会做的动作。由于膝关节的弯曲幅度变大，跳跃高度也变大了，因此在起跳时膝关节得到了更多的锻炼，而在落地时...",
    "keyPoints": [
      "站立，双脚分开，间距稍大于肩宽。身体保持紧张，准备做动作。",
      "下蹲到深蹲的幅度。对大多数人来说，为了跳得最高，膝关节弯曲的幅度不到深蹲时的1/2，大约1/3就足够了。更强大的训练者可以尝试更大幅度的下蹲——下蹲到大腿与地面平行。",
      "用下半身以及其他身体部位能用上的所有爆发力起跳。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "减小膝关节弯曲幅度会使这个动作更简易。你可以将下蹲幅度为1/4的深蹲跳作为直蹦和深蹲跳之间小小的过渡。"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次 (动作受控·安全完成)",
      "intermediate": "2组 × 7次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 9次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        4,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pJump_03",
    "name": "直跳",
    "nameEn": "Vertical Leap",
    "category": "power_jump",
    "categoryLabel": "爆发跳跃",
    "seriesId": "power_jump",
    "step": 3,
    "source": "第三册第四章第三式",
    "riskLevel": "low",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "直蹦教人释放双脚与双踝与生俱来的自然弹跳力，这种弹跳力是所有哺乳动物能够跳跃的基础；深蹲跳将这种弹跳力与髋部、腿部和膝关节的爆发力结合起来；直跳则在深蹲跳的基础...",
    "keyPoints": [
      "站立，双脚分开，间距稍大于肩宽。身体保持紧张，准备做动作。双臂放在体侧。",
      "下蹲到深蹲的幅度。对大多数人来说，为了跳得最高，膝关节弯曲的幅度不到深蹲时的1/2，大约1/3就足够了。更强大的训练者的下蹲幅度可以更大。",
      "用下半身以及其他身体部位能用上的所有爆发力起跳。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "刚开始练习时，不要一下子就做出很大幅度的手臂摇摆动作。之后逐渐增大手臂的动作幅度，直到将手臂完全伸展到头部上方。"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次 (动作受控·安全完成)",
      "intermediate": "2组 × 7次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 9次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        7
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pJump_04",
    "name": "助跑跳",
    "nameEn": "Block Jump",
    "category": "power_jump",
    "categoryLabel": "爆发跳跃",
    "seriesId": "power_jump",
    "step": 4,
    "source": "第三册第四章第四式",
    "riskLevel": "low",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "通过基础的直跳（第三式）获得足够的能力后，是时候学习并掌握助跑和立停这两个技巧了。立停涉及将水平惯性（通过跑几步产生）转变为垂直惯性（通过向上跳跃产生）。通过双...",
    "keyPoints": [
      "进行短距离的助跑——步数少比多好。",
      "向上摆动双臂，迈一大步，然后将双腿停顿并拢。",
      "你可以稍稍弯曲膝关节以下蹲，之后立即全身发力，双脚向下“击打”地面，同时向下甩动手臂。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "你可以慢慢地学习这个动作。一开始只走两步，并且在速度很慢的状态下掌握双脚并拢的姿势转变。将立停前的最后一步理解为向前跳的一小步或许对你更有帮助。"
      }
    ],
    "standards": {
      "beginner": "1组 × 4次 (动作受控·安全完成)",
      "intermediate": "2组 × 6次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 8次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        7
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pJump_05",
    "name": "踢臀跳",
    "nameEn": "Butt-Kick Spring",
    "category": "power_jump",
    "categoryLabel": "爆发跳跃",
    "seriesId": "power_jump",
    "step": 5,
    "source": "第三册第四章第五式",
    "riskLevel": "low",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "虽然你的目标是用足跟踢自己的臀部，但踢臀跳是这条技艺链中第一项要求在空中抬起双膝的练习。看下面的图你就会发现，在空中时双膝稍微向前拉。这能够锻炼髋部，允许你进行...",
    "keyPoints": [
      "站立，双脚分开，与肩同宽。身体保持紧张，准备做动作。双臂放在体侧。",
      "下蹲到深蹲的程度，就如同做深蹲跳（第二式）一样。",
      "用下半身以及其他身体部位能用上的所有爆发力起跳。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "有些训练者就是无法找准踢自己臀部所需的速度，至少在刚开始时是这样的。他们要么跳得不够高，要么无法用足够大的力量收缩腘绳肌。开始时练习单侧踢臀跳会有所帮"
      }
    ],
    "standards": {
      "beginner": "1组 × 4次 (动作受控·安全完成)",
      "intermediate": "2组 × 6次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 8次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        7
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pJump_06",
    "name": "拍膝团身跳",
    "nameEn": "Slap Tuck Jump",
    "category": "power_jump",
    "categoryLabel": "爆发跳跃",
    "seriesId": "power_jump",
    "step": 6,
    "source": "第三册第四章第六式",
    "riskLevel": "medium",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "学习真正的跳跃团身技巧（将大腿拉向胸部超出了普通人的运动能力范围）前，拍膝团身跳是极重要的一式。逐渐进步是学习任何困难的自重练习动作的最佳方式。在上一式（踢臀跳...",
    "keyPoints": [
      "站立，双脚分开，与肩同宽。身体保持紧张，准备做动作。你可以将双手放在胸前（不要紧贴胸部）并且手掌向下，也可以将双臂放在体侧。",
      "下蹲到深蹲的程度，就如同做深蹲跳（第二式）一样。",
      "用下半身以及其他身体部位能用上的所有爆发力起跳。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "要简化这个动作很容易——若不能将双膝抬到与髋部处于同一水平面，就适当地放低双手，在稍低的位置拍双膝。"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (动作受控·安全完成)",
      "intermediate": "2组 × 5次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 7次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        2,
        6
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pJump_07",
    "name": "团身跳",
    "nameEn": "Tuck Jump",
    "category": "power_jump",
    "categoryLabel": "爆发跳跃",
    "seriesId": "power_jump",
    "step": 7,
    "source": "第三册第四章第七式",
    "riskLevel": "medium",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "团身跳能让下半身获得一些实实在在的爆发力。为了达到这个动作所要求的高度，小腿、踝关节、臀部、大腿乃至下背部都需要有极快的速度，而髋部与腹部必须拥有极好的爆发性，...",
    "keyPoints": [
      "站立，双脚分开，与肩同宽。身体保持紧张，准备做动作。",
      "下蹲到深蹲的程度，就如同做深蹲跳（第二式）一样。",
      "用下半身以及其他身体部位能用上的所有爆发力起跳。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "姿势标准是做好团身跳的关键。若不能将双膝抬到紧贴胸部的程度，那也至少要抬到与髋部处于同一水平面的程度。通过练习，你的双膝抬起的程度会自然而然地提升。"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (动作受控·安全完成)",
      "intermediate": "2组 × 5次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 7次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        2,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pJump_08",
    "name": "抱腿团身跳",
    "nameEn": "Catch Tuck Jump",
    "category": "power_jump",
    "categoryLabel": "爆发跳跃",
    "seriesId": "power_jump",
    "step": 8,
    "source": "第三册第四章第八式",
    "riskLevel": "medium",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "在团身跳（第七式）中，你需要腿部与髋部的爆发力来将双膝高高地向上抬。然而，为了做出这条技艺链中的最终式（自杀跳），你的躯干还需要有一些向前的爆发力以将双腿真正地...",
    "keyPoints": [
      "站立，双脚分开，与肩同宽。身体保持紧张，准备做动作。",
      "下蹲到深蹲的程度，就如同做深蹲跳（第二式）一样。",
      "用下半身以及其他身体部位能用上的所有爆发力起跳。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "一开始不要把小腿拉得太紧——只尽量把团身做到最好，并且试着让双臂在小腿前相互触碰。经过一段时间的练习，用双臂环绕双腿，并最终紧紧地将双腿向内拉。"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (动作受控·安全完成)",
      "intermediate": "2组 × 4次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 6次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        2,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pJump_09",
    "name": "穿针跳",
    "nameEn": "Threading The Needle",
    "category": "power_jump",
    "categoryLabel": "爆发跳跃",
    "seriesId": "power_jump",
    "step": 9,
    "source": "第三册第四章第九式",
    "riskLevel": "medium",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "“穿针”这一术语来自霹雳舞，你甚至可能从老旧的街舞影像资料中发现这类动作。它的得名原因显而易见——你的脚穿过“洞”，正如同线头穿过针眼一般。在为自杀跳做技巧上的...",
    "keyPoints": [
      "一手握住对侧脚的脚趾，站立的那条腿以及躯干尽可能地保持笔直。",
      "站立的腿稍稍下蹲，然后爆发性地向上跳，在保持身体笔直的情况下尽可能地抬高这条腿的膝盖，使其贴近胸部。",
      "跳起的腿运动到最高点时，用手带着握住的那只脚绕过跳起的那只脚，这样它就到了你身后。许多人错误地试着单腿跳进手和被抓住的脚形成的“洞”里，这不对——你应当抬高跳起的腿，并将“洞”拉到身后。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "开始尝试这一式时，你应当松松地握住自己的脚，以防出现不得不快速放开的情况。起初，你握住的应该是脚趾顶端，因为这样可以制造更大的“洞”。但是，若真的有必"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (动作受控·安全完成)",
      "intermediate": "2组 × 4次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 6次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        1,
        5
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pJump_10",
    "name": "自杀跳",
    "nameEn": "Suicide Jump",
    "category": "power_jump",
    "categoryLabel": "爆发跳跃",
    "seriesId": "power_jump",
    "step": 10,
    "source": "第三册第四章最终式",
    "riskLevel": "high",
    "equipment": [
      "地面",
      "短棍/扫帚柄"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "任何人都可以通过简单的跳跃练习（比如第一式到第三式）最大限度地打造跳跃爆发力。而这条技艺链的目标是让你在此之余收获更多。从第五式（踢臀跳）开始，你将获得力量、爆...",
    "keyPoints": [
      "站立，双脚分开，与肩同宽。身体保持紧张，准备做动作。双手以较大的间距握住一根棍子（扫帚柄也不错）并放在髋部前方。（一开始，若担心摔倒，你可以不用棍子，而是轻轻握住绳索或带子。）",
      "身体站直。（初学者可能认为弯腰或下蹲，从而将棍子放得低一些会有所帮助。不是那样的！）",
      "稍稍下蹲。你的膝关节只需要轻微弯曲——幅度不到深蹲时的1/4。"
    ],
    "commonIssues": [
      {
        "problem": "动作节奏走形或落地生硬",
        "fix": "降低动作速度，先行在软垫或受控环境下练习，注意关节吸震"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (动作受控·安全完成)",
      "intermediate": "2组 × 3次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 5次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        1,
        5
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPush_01",
    "name": "上斜俯卧弹",
    "nameEn": "Incline Pop-up",
    "category": "power_push",
    "categoryLabel": "爆发俯卧撑",
    "seriesId": "power_push",
    "step": 1,
    "source": "第三册第五章第一式",
    "riskLevel": "low",
    "equipment": [
      "桌面/窗台"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "上斜俯卧弹能够温和地锻炼肩关节、肘关节和腕关节，为更困难的练习做好准备。",
    "keyPoints": [
      "找到牢固而安全的支撑物，大概与胸口等高即可。",
      "将双手放在支撑物上，手间距约为肩宽。",
      "按你觉得合适的宽度分开双腿以保持平衡。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "刚开始练习爆发俯卧撑的新手可以用更简单的方法起步——推离垂直的墙。然而，在开始尝试爆发力训练前，你应当已经通过一些自重训练锻炼了关节，因此这种降级式练"
      }
    ],
    "standards": {
      "beginner": "1组 × 6次 (动作受控·安全完成)",
      "intermediate": "2组 × 8次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 10次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        4,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPush_02",
    "name": "跪姿俯卧弹",
    "nameEn": "Kneeling Pop-up",
    "category": "power_push",
    "categoryLabel": "爆发俯卧撑",
    "seriesId": "power_push",
    "step": 2,
    "source": "第三册第五章第二式",
    "riskLevel": "low",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "这个动作需要爆发力水平有巨大的飞跃。信不信由你，许多强壮的家伙第一次尝试跪姿俯卧弹时都碰了一鼻子灰。原因不在于他们缺乏力量，而在于速度不够快，无法将力量转变为爆...",
    "keyPoints": [
      "跪在地上，大腿与躯干保持笔直。双臂伸向身前并锁紧。",
      "躯干前倾，直到开始下降。大腿、髋部与躯干仍然成一条直线。",
      "双掌置于地面，手间距与肩同宽或稍大于肩宽。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "若你就是做不了跪姿俯卧弹，那么弯曲髋部或许能帮助你做到。但是，这其实是一种作弊方法。更好的方法是将双手放在一个支撑物上，让自己的身体倾斜。一些人发现，"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次 (动作受控·安全完成)",
      "intermediate": "2组 × 7次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 9次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        4,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPush_03",
    "name": "俯卧弹",
    "nameEn": "Pop-up",
    "category": "power_push",
    "categoryLabel": "爆发俯卧撑",
    "seriesId": "power_push",
    "step": 3,
    "source": "第三册第五章第三式",
    "riskLevel": "low",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "对那些希望更好地做拍掌俯卧撑（第四式，接下来就是了）的兄弟姐妹来说，俯卧弹是一项近乎神奇的预备练习。许多人为了上半身的爆发力而练习拍掌俯卧撑，结果极为悲惨，常常...",
    "keyPoints": [
      "下蹲，双掌置于地面，双腿向后伸出。",
      "手掌应当位于双肩下方，其间距与肩同宽或稍大于肩宽。",
      "双脚的间距应视你的舒适程度而定，初学者可以大一些，高手可以小一些。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "俯卧弹是几乎所有爆发俯卧撑的基础，通过它，从常规（缓慢的）俯卧撑过渡到爆发俯卧撑非常简单——只需在你能做到常规俯卧撑的时候，开始试着加快手臂推动的速度"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次 (动作受控·安全完成)",
      "intermediate": "2组 × 7次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 9次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        7
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPush_04",
    "name": "拍掌俯卧撑",
    "nameEn": "Clap Push-up",
    "category": "power_push",
    "categoryLabel": "爆发俯卧撑",
    "seriesId": "power_push",
    "step": 4,
    "source": "第三册第五章第四式",
    "riskLevel": "medium",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "拍掌俯卧撑或许被视为打造爆发性推力的经典上半身练习，并且实至名归。拳击手、武术家和橄榄球运动员素来知道，这项练习能够打造高等级的躯干爆发力以及快速的双手，同时强...",
    "keyPoints": [
      "下蹲，双掌置于地面，双腿向后伸出。",
      "手掌应当位于双肩下方，其间距与肩同宽或稍大于肩宽。",
      "双脚的间距应视你的舒适程度而定，初学者可以大一些，高手可以小一些。·腿部、髋部与躯干成一条直线并保持水平。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "起初，双手靠拢一些可以缩小它们在空中运动的距离。"
      }
    ],
    "standards": {
      "beginner": "1组 × 4次 (动作受控·安全完成)",
      "intermediate": "2组 × 6次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 8次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        7
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPush_05",
    "name": "拍胸俯卧撑",
    "nameEn": "Chest-Strike Push-up",
    "category": "power_push",
    "categoryLabel": "爆发俯卧撑",
    "seriesId": "power_push",
    "step": 5,
    "source": "第三册第五章第五式",
    "riskLevel": "medium",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "在爆发俯卧撑的滞空过程中，手运动的程度能够极好地反映你所获得的滞空时间。同样，你获得的滞空时间与上半身的爆发性推力成正比。因此，与单纯的拍掌俯卧撑相比，拍胸俯卧...",
    "keyPoints": [
      "下蹲，双掌置于地面，双腿向后伸出。",
      "手掌应当位于双肩下方，其间距与肩同宽或稍大于肩宽。",
      "双脚的间距应视你的舒适程度而定，初学者可以大一些，高手可以小一些。·腿部、髋部与躯干成一条直线并保持水平。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "起初，在“抓住”地面前，双手仅仅朝着胸部抬起。随着时间的推移，双手将能拍打胸部。"
      }
    ],
    "standards": {
      "beginner": "1组 × 4次 (动作受控·安全完成)",
      "intermediate": "2组 × 6次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 8次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        7
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPush_06",
    "name": "拍髋俯卧撑",
    "nameEn": "Hip-Strike Push-up",
    "category": "power_push",
    "categoryLabel": "爆发俯卧撑",
    "seriesId": "power_push",
    "step": 6,
    "source": "第三册第五章第六式",
    "riskLevel": "medium",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "即使是能够非常轻松地做拍掌俯卧撑的强有力的训练者，他们在爆发俯卧撑中尝试在背后拍掌时也会碰壁。拍髋俯卧撑是连接身前拍掌俯卧撑与身后拍掌俯卧撑（如囚徒俯卧撑）的桥...",
    "keyPoints": [
      "下蹲，双掌置于地面，双腿向后伸出。",
      "手掌应当位于双肩下方，其间距与肩同宽或稍大于肩宽。",
      "双脚的间距应视你的舒适程度而定，初学者可以大一些，高手可以小一些。·腿部、髋部与躯干成一条直线并保持水平。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "若还不能拍髋，可考虑拍打胸部与髋部之间的部位，比如腹部。"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (动作受控·安全完成)",
      "intermediate": "2组 × 5次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 7次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        2,
        6
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPush_07",
    "name": "囚徒俯卧撑",
    "nameEn": "The Convict Push-up",
    "category": "power_push",
    "categoryLabel": "爆发俯卧撑",
    "seriesId": "power_push",
    "step": 7,
    "source": "第三册第五章第七式",
    "riskLevel": "high",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "在许多监狱中，囚徒俯卧撑被认为是极为重要的爆发性练习。我从不曾在外界听过这个术语，在狱中我们管它叫“囚徒俯卧撑”是因为，在身后拍掌时双手（短暂地）处于标准的背后...",
    "keyPoints": [
      "下蹲，双掌置于地面，双腿向后伸出。",
      "手掌应当位于双肩下方，其间距与肩同宽或稍大于肩宽。",
      "双脚的间距应视你的舒适程度而定，初学者可以大一些，高手可以小一些。·腿部、髋部与躯干成一条直线并保持水平。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "第一次尝试的时候，可不要摔得一嘴泥，兄弟。为了熟悉这个独特的背后拍掌技巧，我建议你先像练习第二式那样，以跪姿练这个动作。"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (动作受控·安全完成)",
      "intermediate": "2组 × 5次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 7次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        2,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPush_08",
    "name": "半飞人俯卧撑",
    "nameEn": "Up-Box Jump",
    "category": "power_push",
    "categoryLabel": "爆发俯卧撑",
    "seriesId": "power_push",
    "step": 8,
    "source": "第三册第五章第八式",
    "riskLevel": "high",
    "equipment": [
      "地面",
      "矮箱"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "半飞人俯卧撑之所以得名，是因为若做得正确，训练者的上半身就处在飞人俯卧撑的姿势中。能够让上肢做出飞人俯卧撑的姿势后，下一步就是获得让下肢做到的能力，即升级到第九...",
    "keyPoints": [
      "下蹲，双掌置于地面，双腿向后伸出。",
      "手掌应当位于双肩下方，其间距与肩同宽或稍大于肩宽。",
      "双脚的间距应视你的舒适程度而定，初学者可以大一些，高手可以小一些。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "最初尝试这项技艺时，我建议只将一只手伸向前方，两侧独立完成。两侧都能轻易做到后，尝试完整版的半飞人俯卧撑。你同样可以尝试以跪姿开始练习。"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (动作受控·安全完成)",
      "intermediate": "2组 × 4次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 6次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        2,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPush_09",
    "name": "全身俯卧弹",
    "nameEn": "The Aztec Push-up",
    "category": "power_push",
    "categoryLabel": "爆发俯卧撑",
    "seriesId": "power_push",
    "step": 9,
    "source": "第三册第五章第九式",
    "riskLevel": "high",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "在第三式中，你学会了在俯卧撑动作中让自己的上肢离地。现在，是时候来点儿更难的东西了——将四肢弹离地面。与本练习相比，之前的一些练习（如囚徒俯卧撑）其实能迫使上半...",
    "keyPoints": [
      "下蹲，双掌置于地面，双腿向后伸出。",
      "手掌应当位于双肩下方，其间距与肩同宽或稍大于肩宽。",
      "双脚的间距应视你的舒适程度而定，初学者可以大一些，高手可以小一些。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "起初，只将上肢和一条腿弹离地面——两条腿交替弹起。"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (动作受控·安全完成)",
      "intermediate": "2组 × 4次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 6次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        1,
        5
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPush_10",
    "name": "飞人俯卧撑",
    "nameEn": "The Superman",
    "category": "power_push",
    "categoryLabel": "爆发俯卧撑",
    "seriesId": "power_push",
    "step": 10,
    "source": "第三册第五章最终式",
    "riskLevel": "high",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "当然，这个动作看起来酷得要命。而且，健身房中的训练者中几乎没有人能正确地模仿（至少在不让自己患疝气的前提下）。然而，飞人俯卧撑远远不止是一个看上去变态的动作。所...",
    "keyPoints": [
      "下蹲，双掌置于地面，双腿向后伸出。",
      "手掌应当位于双肩下方，其间距与肩同宽或稍大于肩宽。",
      "双脚的间距应视你的舒适程度而定，初学者可以大一些，高手可以小一些。"
    ],
    "commonIssues": [
      {
        "problem": "动作节奏走形或落地生硬",
        "fix": "降低动作速度，先行在软垫或受控环境下练习，注意关节吸震"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (动作受控·安全完成)",
      "intermediate": "2组 × 3次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 5次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        1,
        5
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pKip_01",
    "name": "卷体起坐",
    "nameEn": "Rolling Sit-up",
    "category": "kip_up",
    "categoryLabel": "功夫打挺",
    "seriesId": "kip_up",
    "step": 1,
    "source": "第三册第六章第一式",
    "riskLevel": "low",
    "equipment": [
      "软垫/地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "卷体起坐是一项神奇的调整练习，能够增强中段、髋部以及背部，为打挺做准备。它同样包含了经典打挺（第七式）中许多必不可少的动作和姿势，比如卷起到双肩着地、下肢先向后...",
    "keyPoints": [
      "坐在地上，双膝弯曲，足跟着地。你可以将双掌放在地面或小腿上。",
      "翻滚到背朝下的姿势，将双腿带到身体上方。双膝保持弯曲。",
      "卷起时，双手掌心朝下分别放在耳侧的地面上，指尖朝向自己的髋部（与桥的手部姿势相同）。用双掌承受一部分体重。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "假使对目前的你来说让双腿贴近自己的脸太困难，一开始你可以只把双腿摆动到头部上方。"
      }
    ],
    "standards": {
      "beginner": "1组 × 6次 (动作受控·安全完成)",
      "intermediate": "2组 × 8次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 10次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        4,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pKip_02",
    "name": "卷体蹲起",
    "nameEn": "Rolling Squat",
    "category": "kip_up",
    "categoryLabel": "功夫打挺",
    "seriesId": "kip_up",
    "step": 2,
    "source": "第三册第六章第二式",
    "riskLevel": "low",
    "equipment": [
      "软垫/地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "卷体蹲起紧跟在卷体起坐之后。它们的前半部分是相同的，但做卷体蹲起时最后你要站立——这要求你产生更大的向前的惯性。（正是这种产生向前惯性的能力真正决定了你能否做出...",
    "keyPoints": [
      "坐在地上，双膝弯曲，足跟着地。你可以将双掌放在地面或小腿上。",
      "翻滚到背朝下的姿势，将双腿带到身体上方。双膝保持弯曲。",
      "卷起时，双手掌心朝下分别放在耳侧的地面上，指尖朝向自己的髋部（与桥的手部姿势相同）。用双掌承受一部分体重。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "一些初学者难以产生足够大的惯性，因而无法进入深蹲姿势。若你也是这样，就在臀部接触地面时将双手置于地面，并用手指协助推起身体。"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次 (动作受控·安全完成)",
      "intermediate": "2组 × 7次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 9次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        4,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pKip_03",
    "name": "肩上弹",
    "nameEn": "Shoulder Pop",
    "category": "kip_up",
    "categoryLabel": "功夫打挺",
    "seriesId": "kip_up",
    "step": 3,
    "source": "第三册第六章第三式",
    "riskLevel": "low",
    "equipment": [
      "软垫/地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "第一式和第二式能够教你用自己的双腿和腰部产生一些基本的惯性。本式开始强化并调节腕部与肩部，使之承担起爆发性地向上推起身体的重任，而这种能力正是经典打挺（第七式）...",
    "keyPoints": [
      "坐在地上，双膝弯曲，足跟着地。",
      "翻滚到背朝下的姿势，将双腿带到身体上方。双膝保持弯曲。",
      "卷起时，双手掌心朝下分别放在耳侧的地面上，指尖朝向自己的髋部（与桥的手部姿势相同）。用双掌承受一部分体重。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "若无法将肩部推离地面，就专注于将双腿抬高并且用力地笔直向上踢。随着时间的推移，你将逐渐将肩部推离地面。"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次 (动作受控·安全完成)",
      "intermediate": "2组 × 7次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 9次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        7
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pKip_04",
    "name": "桥打挺",
    "nameEn": "Bridge Kip",
    "category": "kip_up",
    "categoryLabel": "功夫打挺",
    "seriesId": "kip_up",
    "step": 4,
    "source": "第三册第六章第四式",
    "riskLevel": "low",
    "equipment": [
      "软垫/地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "本式的目标在于让你学会如何产生足够大的下半身爆发力，以便头部、肩部和上背部离开地面。目前，我们还不需要让这几个部位继续向上运动——这是后面几式要做的。",
    "keyPoints": [
      "坐在地上，双膝弯曲，足跟着地。",
      "向后翻滚并摆动双腿，同时双手掌心朝下分别放在耳侧的地面上，指尖朝向自己的髋部（与桥的手部姿势相同）。",
      "翻滚到上背部以及肩部与地面接触的姿势，双膝弯曲以接近头部，使身体紧紧蜷起来（这样能让你更好地弹起来）。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "若无法产生足够大的惯性，不能将上背部和头部带离地面，那么最初你可以只练习沿着弧形轨迹上下踢腿，并在肩部和头部与地面接触的状态下用双脚击打地面。通过练习"
      }
    ],
    "standards": {
      "beginner": "1组 × 4次 (动作受控·安全完成)",
      "intermediate": "2组 × 6次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 8次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        7
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pKip_05",
    "name": "坐打挺",
    "nameEn": "Sitting Kip-up",
    "category": "kip_up",
    "categoryLabel": "功夫打挺",
    "seriesId": "kip_up",
    "step": 5,
    "source": "第三册第六章第五式",
    "riskLevel": "medium",
    "equipment": [
      "软垫/地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "一旦能够产生足够大的爆发力，使自己的头部与背部离开地面（第四式），下一步就是使双手离地，并且更向前地弹起自己的躯干。假使你通过这项练习掌握了以臀部落地（躯干挺直...",
    "keyPoints": [
      "坐在地上，双膝弯曲，足跟着地。",
      "向后翻滚并摆动双腿，同时双手掌心朝下分别放在耳侧的地面上，指尖朝向自己的髋部（与桥的手部姿势相同）。",
      "翻滚到上背部以及肩部与地面接触的姿势，双膝弯曲以接近头部，使身体紧紧蜷起来（这样能让你更好地弹起来）。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "刚开始时，你可以简化一下：只需沿着弧形轨迹踢腿并以臀部落地，同时将头部与背部稍稍抬离地面。渐渐地，你能够学着以竖直的坐姿来结束动作。"
      }
    ],
    "standards": {
      "beginner": "1组 × 4次 (动作受控·安全完成)",
      "intermediate": "2组 × 6次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 8次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        7
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pKip_06",
    "name": "半打挺",
    "nameEn": "Half-Kip",
    "category": "kip_up",
    "categoryLabel": "功夫打挺",
    "seriesId": "kip_up",
    "step": 6,
    "source": "第三册第六章第六式",
    "riskLevel": "medium",
    "equipment": [
      "软垫/地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "在第四式中你学会了腿的弧线运动，在第五式中你学会了将躯干向前翻起。现在，你的任务是将这些动作连在一起并且更具爆发性地做出来，直到能够让自己的重心充分向前，从而让...",
    "keyPoints": [
      "坐在地上，双膝弯曲，足跟着地。",
      "向后翻滚并摆动双腿，同时双手掌心朝下分别放在耳侧的地面上，指尖朝向自己的髋部（与桥的手部姿势相同）。",
      "翻滚到上背部以及肩部与地面接触的姿势，双膝弯曲以接近头部，使身体紧紧蜷起来（这样能让你更好地弹起来）。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "第一次尝试打挺的人通常会偶然地“发现”这个动作。你试着做打挺，但是无法让自己的重心充分向前并以稳定的蹲姿结束动作，然后你就向后倒了。要帮助自己保持平衡"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (动作受控·安全完成)",
      "intermediate": "2组 × 5次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 7次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        2,
        6
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pKip_07",
    "name": "经典打挺",
    "nameEn": "Classic Kip-up",
    "category": "kip_up",
    "categoryLabel": "功夫打挺",
    "seriesId": "kip_up",
    "step": 7,
    "source": "第三册第六章第七式",
    "riskLevel": "medium",
    "equipment": [
      "软垫/地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "这就是经典打挺，深受武术家、街舞舞者以及专业摔跤者的喜爱。没有具有爆发性的腰部（髋部和下背部）、超快速的双腿以及豹子般矫健的全身，你是不可能做出这个大名鼎鼎的动...",
    "keyPoints": [
      "坐在地上，双膝弯曲，足跟着地。",
      "向后翻滚并摆动双腿，同时双手掌心朝下分别放在耳侧的地面上，指尖朝向自己的髋部（与桥的手部姿势相同）。",
      "翻滚到上背部以及肩部与地面接触的姿势，双膝弯曲以接近头部，使身体紧紧蜷起来（这样能让你更好地弹起来）。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "有一种方法可以让你更快地将双脚移动到身下：以较大的足间距落地。这样能够帮助一些人做出他们的第一个经典打挺。"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (动作受控·安全完成)",
      "intermediate": "2组 × 5次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 7次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        2,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pKip_08",
    "name": "直腿打挺",
    "nameEn": "Straight-Leg Kip-up",
    "category": "kip_up",
    "categoryLabel": "功夫打挺",
    "seriesId": "kip_up",
    "step": 8,
    "source": "第三册第六章第八式",
    "riskLevel": "medium",
    "equipment": [
      "软垫/地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "假使你认为经典打挺（第七式）是打挺技艺链中的最终式，那你就错了。在开始打挺时就将双腿伸直，其难度要高得多。在经典打挺中，你能够依靠大腿与臀部的肌肉伸展双腿以产生...",
    "keyPoints": [
      "坐在地上，双膝弯曲，足跟着地。",
      "向后翻滚，双腿向上摆动并且保持笔直，同时双手掌心朝下分别放在耳侧的地面上，指尖朝向自己的髋部。",
      "翻滚到上背部以及肩部与地面接触的姿势，双腿摆过头顶并且仍然保持笔直。双膝应当接近自己的头部。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "如果做不到直腿打挺，在经典打挺的基础上逐渐减小膝关节弯曲的幅度即可。膝关节弯曲幅度越大，打挺就越容易。"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (动作受控·安全完成)",
      "intermediate": "2组 × 4次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 6次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        2,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pKip_09",
    "name": "武术打挺",
    "nameEn": "The Wushu",
    "category": "kip_up",
    "categoryLabel": "功夫打挺",
    "seriesId": "kip_up",
    "step": 9,
    "source": "第三册第六章第九式",
    "riskLevel": "high",
    "equipment": [
      "软垫/地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "你可能会很自然地认为，从经典打挺（第七式）升级到鲤鱼打挺（最终式）的最好方式是开始仅使用一只手臂，之后不使用手臂。实际上，这不大可能有效。你的身体非常聪明，所以...",
    "keyPoints": [
      "坐在地上，双膝弯曲，足跟着地。",
      "向后翻滚，向上摆起双腿，同时双臂向外伸出放在地面上，与身体成直角。",
      "翻滚到上背部以及肩部与地面接触的姿势，双膝弯曲以接近头部，使身体紧紧蜷起来（这样能让你更好地弹起来）。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "不同的手臂姿势能让这项练习容易一些。最初，你可以使用桥中的手臂姿势，不过不是用手掌，而是用拳头或者手背来推。然后逐渐伸直双臂，直到最难的程度，即将双手"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (动作受控·安全完成)",
      "intermediate": "2组 × 4次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 6次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        1,
        5
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pKip_10",
    "name": "鲤鱼打挺",
    "nameEn": "No-Hands Kip-up",
    "category": "kip_up",
    "categoryLabel": "功夫打挺",
    "seriesId": "kip_up",
    "step": 10,
    "source": "第三册第六章最终式",
    "riskLevel": "high",
    "equipment": [
      "地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "这是人类有史以来最让人惊叹（或最具爆发性）的从地面站起来的方式！看高手展示这个不可思议的动作时，新手通常会认为那人肯定拥有钢铁般的脖颈，方能完成这项任务。的确，...",
    "keyPoints": [
      "坐在地上，双膝弯曲，足跟着地。",
      "向后翻滚，向上摆起双腿，并将双臂置于体侧（在本动作中，它们从头到尾都不能接触地面）。",
      "翻滚到上背部以及肩部与地面接触的姿势，双膝弯曲以接近头部，使身体紧紧蜷起来（这样能让你更好地弹起来）。"
    ],
    "commonIssues": [
      {
        "problem": "动作节奏走形或落地生硬",
        "fix": "降低动作速度，先行在软垫或受控环境下练习，注意关节吸震"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (动作受控·安全完成)",
      "intermediate": "2组 × 3次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 5次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        1,
        5
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pFFlip_01",
    "name": "肩滚",
    "nameEn": "Shoulder Roll",
    "category": "front_flip",
    "categoryLabel": "前空翻",
    "seriesId": "front_flip",
    "step": 1,
    "source": "第三册第七章第一式",
    "riskLevel": "low",
    "equipment": [
      "软垫/草地"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "对身体和其中的关节来说，肩滚是最简易的翻滚方式了。它是摔跌或受身（常见于日本武术，如柔术和合气道）中的一种动作。因为起引导作用的上臂将身体的重量直接导向上背部，...",
    "keyPoints": [
      "开始下蹲。（将较强一侧的脚稍稍往前放或许能让你感觉舒服一些。）",
      "下降身体时将手掌根部外侧置于地面——同样使用较强一侧的手。若觉得有帮助，你也可以将另一侧的手也放在地上。",
      "继续缓慢地向着前下方下降身体，直到失去平衡。绷紧手臂以承受大部分体重。双腿摆动的同时，将双手朝头部上方抬起。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "若不习惯，翻滚会让你觉得恶心欲吐。刚开始小心地将头部下降以贴近地面，这样能让翻滚变得容易一些。"
      }
    ],
    "standards": {
      "beginner": "1组 × 6次 (动作受控·安全完成)",
      "intermediate": "2组 × 8次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 10次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        4,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pFFlip_02",
    "name": "手滚",
    "nameEn": "Hand Roll",
    "category": "front_flip",
    "categoryLabel": "前空翻",
    "seriesId": "front_flip",
    "step": 2,
    "source": "第三册第七章第二式",
    "riskLevel": "low",
    "equipment": [
      "软垫/草地"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "在手滚中，你需要让手臂承受正在翻转的身体的重量。而这种形式的翻滚虽然只是以一种轻柔的方式进行的，但也开始需要将双手作为杠杆来控制身体了。更高阶的翻滚练习将逐渐让...",
    "keyPoints": [
      "双脚对称站立，开始下蹲。",
      "下降身体时将双掌放在前方的地面上。",
      "通过下蹲把躯干向下方带，继续缓慢地朝着前下方下降。伸直双腿，直到失去平衡，身体向前倾。绷紧双臂以承受大部分体重。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "在新手看来，翻滚或许显得可怕。让头部有控制地下降、绷紧卷曲的躯干（让腹部绷紧）以及使用柔软的表面（草地、地毯等），这些都是能让翻滚显得较为容易的小窍门"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次 (动作受控·安全完成)",
      "intermediate": "2组 × 7次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 9次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        4,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pFFlip_03",
    "name": "跳跃滚",
    "nameEn": "Dive Roll",
    "category": "front_flip",
    "categoryLabel": "前空翻",
    "seriesId": "front_flip",
    "step": 3,
    "source": "第三册第七章第三式",
    "riskLevel": "medium",
    "equipment": [
      "软垫/草地"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "这种翻滚练习可能看起来不太像倒立，然而对不经常翻筋斗的人来说，这能有效地教他们的大脑习惯身体翻转的动作，进而能够尝试更困难的技艺。现代体操运动员常常通过向上跳并...",
    "keyPoints": [
      "双脚对称站立，向前弯腰，双掌朝地面伸出。",
      "身体下降时双脚跳起，让身体向前落，同时让双掌接触地面。",
      "双脚刚刚离地时，双掌着地，此时双臂基本保持笔直。你基本上是依靠双掌来阻止自己摔落到地面的。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "将双掌紧紧按在地面上再开始跳跃，这样能够降低对上半身爆发力的要求。"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次 (动作受控·安全完成)",
      "intermediate": "2组 × 7次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 9次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        7
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pFFlip_04",
    "name": "倒立滚",
    "nameEn": "Handstand Roll",
    "category": "front_flip",
    "categoryLabel": "前空翻",
    "seriesId": "front_flip",
    "step": 4,
    "source": "第三册第七章第四式",
    "riskLevel": "medium",
    "equipment": [
      "软垫/草地"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "在前翻技艺链中，这是最后一个翻滚动作。为了将双腿踢到躯干上方，你需要一些爆发力。你也开始发展扎实的手臂力量，而这正是前手翻所需的。",
    "keyPoints": [
      "跨步站立，较强的那条腿在前。将双掌放在地面上，然后抬起后面那条腿。",
      "用在地面的那只脚发力，将自己向上推，另一只脚向后上方摆动。在运动过程中，让躯干变得竖直。",
      "利用推动和摆动产生的惯性将双脚带到躯干上方。双脚甩上去后，伸直双腿，直到全身笔直地处于倒立姿势。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "为了使这个动作变得容易一些，双臂由始至终保持弯曲，这样就不需要进入倒立姿势了。"
      }
    ],
    "standards": {
      "beginner": "1组 × 4次 (动作受控·安全完成)",
      "intermediate": "2组 × 6次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 8次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        7
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pFFlip_05",
    "name": "背落前手翻",
    "nameEn": "Rebound Handspring",
    "category": "front_flip",
    "categoryLabel": "前空翻",
    "seriesId": "front_flip",
    "step": 5,
    "source": "第三册第七章第五式",
    "riskLevel": "medium",
    "equipment": [
      "厚垫/跳箱"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "现在，你与前手翻只隔一层窗户纸了。而若希望掌握前空翻，前手翻是需要学习的至关重要的动作。本练习看起来如同不完全的前手翻，让人学会倒立后身体翻转的第一个阶段的动作...",
    "keyPoints": [
      "往前跨一步以获得惯性，双手上举，用较强的那只脚蹬地。",
      "让躯干下落，同时让双掌落向地面。在双掌与地面接触时，用力起跳，并摆动较高的那条腿。",
      "双脚刚刚离地的时候，双臂基本保持笔直。你基本上是依靠双掌来阻止自己摔落到地面的。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "开始练习这个动作时，训练者可能会先以臀部或背部落地，而不能先用双脚落地以起缓冲作用。如果你是这样的，仍然能练习这个动作直到获得进步，但是你绝对需要在地"
      }
    ],
    "standards": {
      "beginner": "1组 × 4次 (动作受控·安全完成)",
      "intermediate": "2组 × 6次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 8次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        7
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pFFlip_06",
    "name": "前手翻",
    "nameEn": "Front Handspring",
    "category": "front_flip",
    "categoryLabel": "前空翻",
    "seriesId": "front_flip",
    "step": 6,
    "source": "第三册第七章第六式",
    "riskLevel": "medium",
    "equipment": [
      "软垫/草地"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "许多体操专家将前手翻视作前空翻发展过程中的关键阶段——它的确是，不过它本身也是一项非凡的爆发性练习。能够做到前手翻的人都拥有水平极高的基础技巧，比如助跑、立停、...",
    "keyPoints": [
      "助跑以获得惯性。",
      "较强的那只脚蹬地，立停。（这比用双脚立停容易一些，因为如同前两式一样，你能够同时将后面的那条腿向上摆起。）",
      "较强的那只脚用力蹬地以离开地面，让躯干下落，同时双掌落向地面。另一条腿应当在身后向上摆动以协助翻转。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "以较低的蹲姿落地会简易一些，因为这样需要的翻转幅度比较小。最初，你可能还会向后坐在地上。"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (动作受控·安全完成)",
      "intermediate": "2组 × 5次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 7次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        2,
        6
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pFFlip_07",
    "name": "鱼跃前手翻",
    "nameEn": "Flyspring",
    "category": "front_flip",
    "categoryLabel": "前空翻",
    "seriesId": "front_flip",
    "step": 7,
    "source": "第三册第七章第七式",
    "riskLevel": "high",
    "equipment": [
      "软垫/草地"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "掌握了有助跑的前手翻（第六式）后，下一步就是尝试鱼跃前手翻了。在前手翻中，你需要用较强的腿来蹬地，有时也以双脚分开（或不对称）的姿势落地。而在鱼跃前手翻中，你需...",
    "keyPoints": [
      "助跑以获得惯性。",
      "立停，同时向下甩双臂。",
      "双脚用力蹬地以离开地面，让躯干下落，同时让双掌落向地面。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "假如从前手翻升级到鱼跃前手翻对你来说太难了，那就先试试背落式鱼跃前手翻吧。在地上放一些垫子，双脚并拢做鱼跃前手翻，但是以背部落地的姿势结束动作。"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (动作受控·安全完成)",
      "intermediate": "2组 × 5次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 7次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        2,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pFFlip_08",
    "name": "背落前空翻",
    "nameEn": "Rebound Front Flip",
    "category": "front_flip",
    "categoryLabel": "前空翻",
    "seriesId": "front_flip",
    "step": 8,
    "source": "第三册第七章第八式",
    "riskLevel": "high",
    "equipment": [
      "厚垫/跳箱"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "对大多数人来说，不论怎样严谨和恰当地升级，在学习前空翻的过程中都会有以臀部落地的时候，而且这种情况会持续很长时间。翻转进入站立或半站立姿势需要足够大的爆发力，而...",
    "keyPoints": [
      "助跑以获得惯性。",
      "立停，同时向下甩双臂。",
      "用力起跳，同时继续向下甩双手，髋部弯曲，将卷曲的上半身向下拉。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "我一向提倡使用最少的器械进行训练，然而这项练习明显是个例外。开始练习的时候，你应当始终使用大量垫子来保护自己的脊柱。将一块厚床垫拖到地上是一个很棒的选"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (动作受控·安全完成)",
      "intermediate": "2组 × 4次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 6次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        2,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pFFlip_09",
    "name": "助跑前空翻",
    "nameEn": "Front Flip",
    "category": "front_flip",
    "categoryLabel": "前空翻",
    "seriesId": "front_flip",
    "step": 9,
    "source": "第三册第七章第九式",
    "riskLevel": "high",
    "equipment": [
      "沙坑/草地/海绵池"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "本技艺链的最终式，也就是助跑前空翻最难的变式——前空翻——是从站立姿势开始做的。而作为预备练习，助跑前空翻明显容易一些，因为哪怕只有几步的助跑也能增加翻转所需的...",
    "keyPoints": [
      "助跑以获得惯性。",
      "立停，同时向下甩双臂。",
      "用力起跳，同时继续向下甩双臂，髋部弯曲，将卷曲的上半身向下拉。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "如同练习背落前空翻那样，我建议你为了克服恐惧而使用垫子——先是床垫，之后是橡胶垫、枕头以及其他比较薄的垫子。这么做部分是出于安全的考虑，但更多的是从心"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (动作受控·安全完成)",
      "intermediate": "2组 × 4次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 6次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        1,
        5
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pFFlip_10",
    "name": "站立前空翻",
    "nameEn": "Standing Front Flip",
    "category": "front_flip",
    "categoryLabel": "前空翻",
    "seriesId": "front_flip",
    "step": 10,
    "source": "第三册第七章最终式",
    "riskLevel": "high",
    "equipment": [
      "软垫/地面"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "没错，站立前空翻就是出类拔萃的爆发性动作。对任何渴求实用速度、敏捷性与爆发力的人来说，它就是“超级练习”。在站立前空翻中，你的实用速度和敏捷性等都受到了考验，因...",
    "keyPoints": [
      "站立，足间距稍小于肩宽，双臂抬起，高过头顶。",
      "开始时，踮起脚以产生一些额外的“弹力”。",
      "弯曲膝部和髋部，使身体下降；双腿向上爆发性地抬起，同时让躯干和手臂往下落。"
    ],
    "commonIssues": [
      {
        "problem": "动作节奏走形或落地生硬",
        "fix": "降低动作速度，先行在软垫或受控环境下练习，注意关节吸震"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (动作受控·安全完成)",
      "intermediate": "2组 × 3次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 5次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        1,
        5
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pBFlip_01",
    "name": "后向肩滚",
    "nameEn": "Backward Shoulder Roll",
    "category": "back_flip",
    "categoryLabel": "后空翻",
    "seriesId": "back_flip",
    "step": 1,
    "source": "第三册第八章第一式",
    "riskLevel": "low",
    "equipment": [
      "软垫/草地"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "这种后向翻滚最适合初学者，因为它的冲击力极小，能够保护头部与颈部。这与日本一些武术中的后向翻滚（后受身）相似。正确练习的话，它应当看起来与向前的肩滚相似，只不过...",
    "keyPoints": [
      "站立，一只脚靠前，蹲下。",
      "脊柱向后弓起，轻轻以臀部着地。如果觉得合适，你可以将靠后的腿滑到身后。",
      "用较强的腿发力推以增大向后的惯性，帮助身体向后翻滚。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "基础而简易的翻滚有许多种，后向肩滚只是其中比较常见的一种。你可以根据个人需求做出降级式调整，其关键在于保持头部内收，并且为了保护关节，翻滚时与地面接触"
      }
    ],
    "standards": {
      "beginner": "1组 × 6次 (动作受控·安全完成)",
      "intermediate": "2组 × 8次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 10次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        4,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pBFlip_02",
    "name": "后向手滚",
    "nameEn": "Backward Hand Roll",
    "category": "back_flip",
    "categoryLabel": "后空翻",
    "seriesId": "back_flip",
    "step": 2,
    "source": "第三册第八章第二式",
    "riskLevel": "low",
    "equipment": [
      "软垫/草地"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "与前向翻滚类似，后向翻滚存在的首要目的是使人的神经系统习惯快速的360°翻转。同样，如同前向翻滚那样，掌握了最基础和最轻柔的翻滚动作后，下一步就是用上肢控制翻滚...",
    "keyPoints": [
      "双脚对称站立，下蹲。",
      "脊柱向后弓起，轻轻以臀部着地。",
      "向后翻滚，将双腿带过头部上方。同时手掌经过头部两侧直到接触地面，手臂发力推。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "初学者可以让手臂较少发力，将它们绷紧但是充分弯曲，仅仅用来控制动作并保护颈部，身体完全依赖惯性翻转。"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次 (动作受控·安全完成)",
      "intermediate": "2组 × 7次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 9次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        4,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pBFlip_03",
    "name": "桥踢翻",
    "nameEn": "Bridge Kickover",
    "category": "back_flip",
    "categoryLabel": "后空翻",
    "seriesId": "back_flip",
    "step": 3,
    "source": "第三册第八章第三式",
    "riskLevel": "medium",
    "equipment": [
      "软垫/草地"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "大多数人的身体没有做好用手支撑着向后翻转的准备——他们的肩部、肘部和腕部不能承受突然出现的压力，而且大脑与其中的前庭系统对360°的翻转非常陌生。而这项简单的练...",
    "keyPoints": [
      "仰卧，脚趾靠近牢固的垂直支撑物，比如墙壁、柱子或杆子等。双膝充分弯曲。",
      "双掌置于耳侧，指尖指向脚趾，手肘朝向上方。",
      "用手臂和腿部的力量将自己推起来，呈标准的桥姿势。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "脚踩着一个物体的顶部（比如床面，而非墙面）发力蹬能够将本动作变得容易一些。物体越高越好。而把脚放在台阶上是另一种选择，你可以试着逐渐使用更低一级的台阶"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次 (动作受控·安全完成)",
      "intermediate": "2组 × 7次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 9次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        7
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pBFlip_04",
    "name": "猴子侧翻转",
    "nameEn": "Macaco Lateral",
    "category": "back_flip",
    "categoryLabel": "后空翻",
    "seriesId": "back_flip",
    "step": 4,
    "source": "第三册第八章第四式",
    "riskLevel": "medium",
    "equipment": [
      "软垫/草地"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "猴子翻转类的动作经常出现在卡泼卫勒舞中，它们是升级到后手翻的极好练习。这个动作需要强大的双肩，因此在能够进行稳定的倒立前，不要贸然尝试。",
    "keyPoints": [
      "双脚适当靠近，下蹲并且身体向后倾。将一只手掌置于身后的地面上以提供支撑，拇指朝外并且肘窝朝外，手臂锁死。",
      "髋部发力向上推，空闲的手臂向上摆，越过自己的头部。",
      "双腿蹬离地面以保持惯性。（摆到头部上方的手臂与主要发力的那条腿应当是同侧的。）"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "脚甩动的高度与旋转的幅度是影响本动作难度的关键因素。最初，双脚不用摆得太高，这样可以降低难度。随着进步，你的双脚最后应与头部等高。"
      }
    ],
    "standards": {
      "beginner": "1组 × 4次 (动作受控·安全完成)",
      "intermediate": "2组 × 6次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 8次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        7
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pBFlip_05",
    "name": "猴子后翻转",
    "nameEn": "Macaco Retrógrado",
    "category": "back_flip",
    "categoryLabel": "后空翻",
    "seriesId": "back_flip",
    "step": 5,
    "source": "第三册第八章第五式",
    "riskLevel": "medium",
    "equipment": [
      "软垫/草地"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "本动作是猴子侧翻转（第四式）的升级版本。在此，你不再将双腿摆过体侧，而是直直地向上摆过头部。能够轻松做出侧向摆动的动作前，不要尝试这个动作。至此你将发现，自己离...",
    "keyPoints": [
      "双脚适当靠近，下蹲并且身体向后倾。将一只手掌置于身后的地面上以提供支撑，拇指朝外并且肘窝朝外，手臂锁死。",
      "髋部发力向上推，空闲的手臂向上摆，越过自己的头部。",
      "双腿蹬离地面以保持惯性。（摆到头部上方的手臂与主要发力的那条腿应当是同侧的。）"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "本练习是猴子侧翻转的升级版本，因此开始时偏向先起支撑作用的手臂翻转能够让它变得容易一些。"
      }
    ],
    "standards": {
      "beginner": "1组 × 4次 (动作受控·安全完成)",
      "intermediate": "2组 × 6次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 8次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        7
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pBFlip_06",
    "name": "猴子翻转",
    "nameEn": "Macaco",
    "category": "back_flip",
    "categoryLabel": "后空翻",
    "seriesId": "back_flip",
    "step": 6,
    "source": "第三册第八章第六式",
    "riskLevel": "medium",
    "equipment": [
      "软垫/草地"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "猴子翻转看起来与前两式极为相似。事实上，它只是比前两式稍难的版本——难度略微提高正是你在升级式体操中所需的。区别在于，猴子侧翻转（第四式）和猴子后翻转（第五式）...",
    "keyPoints": [
      "站立，双脚适当靠近，以此为起始姿势。",
      "下蹲，同时一只手向地面下降，但是在它与地面接触前，身体开始向上爆发性弹起。在用来支撑的手掌快接触地面时，双脚应该离开了地面。",
      "向上爆发性弹起的同时，髋部发力，另一只手臂从上方摆过头部，贴近耳朵，并扭转一下准备落地。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "以半蹲姿势开始这个动作，让用来支撑的手放在地面上距离身体不远（比如2厘米）的地方，并且随着练习次数增加，逐渐增大距离。你需要达到这样的程度：身体的后落"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (动作受控·安全完成)",
      "intermediate": "2组 × 5次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 7次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        2,
        6
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pBFlip_07",
    "name": "后手翻",
    "nameEn": "Back Handspring",
    "category": "back_flip",
    "categoryLabel": "后空翻",
    "seriesId": "back_flip",
    "step": 7,
    "source": "第三册第八章第七式",
    "riskLevel": "high",
    "equipment": [
      "软垫/草地"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "真正阻碍你做标准后手翻的因素是恐惧，即你的身体对爆发性地向后翻过头部的恐惧。任何掌握了猴子翻转的人都通过完成侧向翻转消除了这种恐惧，因此觉得后手翻并不那么具有挑...",
    "keyPoints": [
      "站立，双脚分开，与肩同宽，双手伸到头部前或稍高的位置。",
      "弯曲双膝和髋部，下蹲，同时双臂向下摆到身体后方。在下蹲过程中，眼睛直视前方。",
      "身体向后上方爆发性弹起（大约与地面成45°角），同时手臂摆到身体上方。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "能够正确做猴子翻转的话，你就能做后手翻了。让人止步不前的是最后的一点儿顾虑。为了获得心理上的帮助，你可以在柔软的地面，比如草地或者铺了枕头或垫子的地面"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (动作受控·安全完成)",
      "intermediate": "2组 × 5次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 7次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        2,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pBFlip_08",
    "name": "单臂后手翻",
    "nameEn": "One-Arm Back Handspring",
    "category": "back_flip",
    "categoryLabel": "后空翻",
    "seriesId": "back_flip",
    "step": 8,
    "source": "第三册第八章第八式",
    "riskLevel": "high",
    "equipment": [
      "软垫/草地"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "要学会后空翻，你并不一定非要学会单臂后手翻——事实上，一些能做后空翻的人做不了这个动作！然而，它是一项极好的练习，因为在翻转过程中，它强迫你更少地依赖手臂，而更...",
    "keyPoints": [
      "站立，双脚分开，与肩同宽，高举双手。",
      "弯曲双膝和髋部，下蹲，同时双臂向下摆到身体后方。在下蹲过程中，眼睛直视前方。向下并稍微向后蹲，就像即将坐在椅子上一样。",
      "身体向后上方爆发性弹起（大约与地面成45°角），同时手臂摆到身体上方。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "要想逐渐学会这个动作，你可以稍微改变双手的动作，比如双手靠拢或姿势不对称，直到你信心增长，能够完成单臂后手翻。"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (动作受控·安全完成)",
      "intermediate": "2组 × 4次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 6次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        2,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pBFlip_09",
    "name": "四点后空翻",
    "nameEn": "Monkey Flip",
    "category": "back_flip",
    "categoryLabel": "后空翻",
    "seriesId": "back_flip",
    "step": 9,
    "source": "第三册第八章第九式",
    "riskLevel": "high",
    "equipment": [
      "软垫/草地"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "单臂后手翻应当已经教会你依赖腿部的爆发力，而不像在双臂后手翻中那样依赖双臂。它应该也让你能够跳得比较高了。在本阶段，你将利用滞空时间更早地（相较于后手翻）甩动自...",
    "keyPoints": [
      "站立，双脚分开，与肩同宽，高举双手。",
      "弯曲双膝和髋部，下蹲，同时双臂向下摆到身体后方。在下蹲过程中，眼睛直视前方。",
      "身体向后上方爆发性弹起（大约与地面成45°角），同时手臂摆到身体上方。你的目标是跳得比做常规的后手翻时高。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "这是一项过渡练习。刚开始，你的双手会先于双脚落地——没关系。只要不断尝试跳得更高并且更快地向下甩双脚，你就能逐渐做到四肢一起落地了。"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (动作受控·安全完成)",
      "intermediate": "2组 × 4次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 6次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        1,
        5
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pBFlip_10",
    "name": "站立后空翻",
    "nameEn": "Standing Back Flip",
    "category": "back_flip",
    "categoryLabel": "后空翻",
    "seriesId": "back_flip",
    "step": 10,
    "source": "第三册第八章最终式",
    "riskLevel": "high",
    "equipment": [
      "软垫/沙坑/草地"
    ],
    "equipmentTags": [
      "floor"
    ],
    "isHold": false,
    "purpose": "只要在前九式中投入了时间和努力，每个人就都能做到这一式。你若做到了，那么恭喜，你已成为1963年后所有希望成为忍者和街舞小子的人羡慕的对象！你掌握了站立后空翻：...",
    "keyPoints": [
      "站立，双脚分开，与肩同宽，高举双手。",
      "弯曲双膝和髋部，下蹲，同时双臂向下摆到身体后方。在下蹲过程中，眼睛直视前方。",
      "用力向上跳，同时将双手摆向上方。跳跃时，你可以看向上方。很多人在这个动作上失败的原因就是他们在开始时向后跳。不要这么做，要笔直地向上跳！"
    ],
    "commonIssues": [
      {
        "problem": "动作节奏走形或落地生硬",
        "fix": "降低动作速度，先行在软垫或受控环境下练习，注意关节吸震"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (动作受控·安全完成)",
      "intermediate": "2组 × 3次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 5次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        1,
        5
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPull_01",
    "name": "摆动晃身",
    "nameEn": "The Kip",
    "category": "power_pull",
    "categoryLabel": "暴力上杠",
    "seriesId": "power_pull",
    "step": 1,
    "source": "第三册第九章第一式",
    "riskLevel": "low",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "isHold": false,
    "purpose": "摆动晃身看起来或许像简单的摆动，然而它确实是解锁双立臂的钥匙——事实上，它几乎是所有爆发性单杠动作的基石。同样，它也是奇妙的热身练习，能够锻炼肩部、脊柱和髋部的...",
    "keyPoints": [
      "悬吊在较高的单杠上，握距与肩同宽。肩关节紧紧地向下拉，全身绷紧。",
      "髋部和胸部猛地向前挺，双臂向后摆，把双脚带到身后。你的身体应当呈弧形并且绷紧，双膝可以略微弯曲。",
      "不要保持这种向前凸的姿势。通过收缩腹肌，让自己的身体向后反弹。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "任何爆发性的悬吊练习——即便是这第一式——对未经锻炼的身体来说都可能是困难的。在尝试这个系列的动作前，我建议你练习俯卧撑，直到达到轻松自如的程度。即便"
      }
    ],
    "standards": {
      "beginner": "1组 × 6次 (动作受控·安全完成)",
      "intermediate": "2组 × 8次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 10次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        4,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPull_02",
    "name": "跳跃引体向上",
    "nameEn": "Jump Pull-up",
    "category": "power_pull",
    "categoryLabel": "暴力上杠",
    "seriesId": "power_pull",
    "step": 2,
    "source": "第三册第九章第二式",
    "riskLevel": "low",
    "equipment": [
      "单杠",
      "箱子"
    ],
    "equipmentTags": [
      "bar"
    ],
    "isHold": false,
    "purpose": "你是否缓慢、认真且有控制地做过常规俯卧撑？如果做过，那恭喜你，孩子，那是打造肌肉和力量的最佳方式！然而，为了获得爆发性的拉力（双立臂所必需的拉力），你的神经系统...",
    "keyPoints": [
      "以与肩同宽的握距抓住上方的单杠。",
      "你应当半蹲着，而不是完全悬吊起来。因此，你可以使用较低的单杠，或者站在一个稳固的支撑物上。",
      "握住单杠，向后上方跳起，模拟摆动晃身（第一式）中的后摆阶段。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "更多地用双腿发力能降低练习难度，用更低的单杠或更高的支撑物也能降低难度。另外，只将注意力集中在跳得更高上也能达到这个效果。"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次 (动作受控·安全完成)",
      "intermediate": "2组 × 7次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 9次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        4,
        8
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPull_03",
    "name": "晃身引体向上",
    "nameEn": "Kipping Pull-up",
    "category": "power_pull",
    "categoryLabel": "暴力上杠",
    "seriesId": "power_pull",
    "step": 3,
    "source": "第三册第九章第三式",
    "riskLevel": "low",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "isHold": false,
    "purpose": "花费足够多的时间，真正掌握了摆动晃身和跳跃引体向上（第二式）后，下一步就是在晃身引体向上中将这些动作结合起来。晃身引体向上是所有杠上爆发性练习的基石——耐心地掌...",
    "keyPoints": [
      "握住上方的单杠并悬吊起来。",
      "握距应当接近肩宽，双肩绷紧（这么做有助于保护肩关节）。",
      "向上拉起身体前，用摆动晃身（第一式）产生一些惯性。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "倘若仅做一次摆动晃身就开始做后续动作对你来说有些困难，那就多做几次，以便尽你所能地产生更大的惯性和向后摆得更高。"
      }
    ],
    "standards": {
      "beginner": "1组 × 5次 (动作受控·安全完成)",
      "intermediate": "2组 × 7次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 9次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        7
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPull_04",
    "name": "引体向上跳",
    "nameEn": "Pull-up Pop",
    "category": "power_pull",
    "categoryLabel": "暴力上杠",
    "seriesId": "power_pull",
    "step": 4,
    "source": "第三册第九章第四式",
    "riskLevel": "medium",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "isHold": false,
    "purpose": "掌握了晃身引体向上后，你即将开始打造高等级的爆发力。然而，在能够升级到倍受羡慕的拍掌引体向上前，练习这个预备动作是个好主意。引体向上跳之于拍掌引体向上，正如俯卧...",
    "keyPoints": [
      "握住上方的单杠并悬吊起来。",
      "握距应当接近肩宽，双肩绷紧（这么做有助于保护肩关节）。",
      "向上拉起身体前，用摆动晃身（第一式）产生一些惯性。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "一开始，你只需要专注于加快速度。最初，在动作的最高点交替地让一只手离开单杠，这能够帮助你找到做这项练习的感觉。"
      }
    ],
    "standards": {
      "beginner": "1组 × 4次 (动作受控·安全完成)",
      "intermediate": "2组 × 6次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 8次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        7
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPull_05",
    "name": "拍掌引体向上",
    "nameEn": "Clap Pull-up",
    "category": "power_pull",
    "categoryLabel": "暴力上杠",
    "seriesId": "power_pull",
    "step": 5,
    "source": "第三册第九章第五式",
    "riskLevel": "medium",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "isHold": false,
    "purpose": "或许在一些人看来，竖直向上的惯性更能让你上升得足够高，以便完成拍掌引体向上。事实并非如此。练习拍掌引体向上最有效的方式是沿弧线向上摆动，而这正是你在晃身引体向上...",
    "keyPoints": [
      "握住上方的单杠并悬吊起来。",
      "握距应当接近肩宽，双肩绷紧（这么做有助于保护肩关节）。",
      "向上拉起身体前，用摆动晃身（第一式）产生一些惯性。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "简化的版本是，在动作最高点松开一只手并拍打对侧的前臂。"
      }
    ],
    "standards": {
      "beginner": "1组 × 4次 (动作受控·安全完成)",
      "intermediate": "2组 × 6次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 8次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        3,
        7
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPull_06",
    "name": "引胸向上",
    "nameEn": "Chest Pull-up",
    "category": "power_pull",
    "categoryLabel": "暴力上杠",
    "seriesId": "power_pull",
    "step": 6,
    "source": "第三册第九章第六式",
    "riskLevel": "medium",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "isHold": false,
    "purpose": "练到上一式时，你已经能在晃身的后摆阶段或多或少地向上带起自己的躯干了。现在，动作模式发生了变化。在后摆的最高点，你需要改变方向，向后拉双肘，直到它们到达身后。因...",
    "keyPoints": [
      "握住上方的水平单杠并悬吊起来。",
      "握距应当接近肩宽，双肩绷紧（这么做有助于保护肩关节）。",
      "向上拉起身体前，用摆动晃身（第一式）产生一些惯性。到了这个阶段，你的摆动晃身应当更有爆发力，后摆的高度应该比前几式中的高。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "若胸骨触碰单杠太困难，刚开始时，用胸的上半部分轻触单杠。然而，你必须谨慎地进行尝试——如果过于高估自己的能力，你可能会一头撞到单杠上。"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (动作受控·安全完成)",
      "intermediate": "2组 × 5次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 7次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        2,
        6
      ],
      "restSeconds": 90,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPull_07",
    "name": "引髋向上",
    "nameEn": "Hip Pull-up",
    "category": "power_pull",
    "categoryLabel": "暴力上杠",
    "seriesId": "power_pull",
    "step": 7,
    "source": "第三册第九章第七式",
    "riskLevel": "high",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "isHold": false,
    "purpose": "引胸向上和引髋向上之间存在极重要的区别：在引胸向上的动作最高点，你用双臂把自己拉向单杠；而在引髋向上中，你的手臂弯曲幅度极小——动作最高点的大部分力由髋部的冲刺...",
    "keyPoints": [
      "握住上方的单杠并悬吊起来。",
      "握距应当接近肩宽，双肩绷紧（这么做有助于保护肩关节）。",
      "向上拉起身体前，用摆动晃身（第一式）产生一些惯性。到了这个阶段，你的摆动晃身应当更有爆发力，后摆的高度应该比前几式中的高。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "如同前一式，与单杠接触的身体部位是降级的关键所在。若无法将下腹部拉到靠近单杠，就试试将上腹部拉到靠近单杠。"
      }
    ],
    "standards": {
      "beginner": "1组 × 3次 (动作受控·安全完成)",
      "intermediate": "2组 × 5次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 7次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 3,
      "repRange": [
        2,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPull_08",
    "name": "跳跃上翻",
    "nameEn": "Jump Muscle-up",
    "category": "power_pull",
    "categoryLabel": "暴力上杠",
    "seriesId": "power_pull",
    "step": 8,
    "source": "第三册第九章第八式",
    "riskLevel": "high",
    "equipment": [
      "单杠",
      "矮箱"
    ],
    "equipmentTags": [
      "bar"
    ],
    "isHold": false,
    "purpose": "能够完成引髋向上（第七式）的话，你就拥有了足以完成双立臂中拉的动作所需的爆发力。之后，你需要学习的是将躯干翻过单杠的正确技巧。跳跃上翻因此而生——能够真正做到单...",
    "keyPoints": [
      "握住上方的单杠，握距应当接近肩宽，双肩应当紧紧向下拉。",
      "采用虚握的抓握方式，也就是把拇指放在单杠上。",
      "你可以使用较低的单杠，或者将一只脚（或双脚）放在较高和稳固的箱子或其他支撑物上。这能让你的双腿推动以协助动作。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "支撑物越高以及（或者）单杠越低，双腿提供的助力就越多。"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (动作受控·安全完成)",
      "intermediate": "2组 × 4次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 6次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        2,
        6
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPull_09",
    "name": "单杠上翻",
    "nameEn": "Bar Muscle-up",
    "category": "power_pull",
    "categoryLabel": "暴力上杠",
    "seriesId": "power_pull",
    "step": 9,
    "source": "第三册第九章第九式",
    "riskLevel": "high",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "isHold": false,
    "purpose": "上翻不仅是一个控制并利用核能级别的爆发力的惊人动作，也是极其实用的动作——让你学会向前上方拉动自己的身体。不论面对的是树木、篱笆还是墙壁，有了这项技巧，你或许都...",
    "keyPoints": [
      "握住上方的单杠，握距应当接近肩宽，双肩应当紧紧向下拉。",
      "采用虚握的抓握方式，也就是把拇指放在单杠上。",
      "在向上拉起身体前，用摆动晃身（第一式）产生一些惯性。到了这个阶段，你的摆动晃身应当更有爆发力，后摆的高度应该比前几式中的高。"
    ],
    "commonIssues": [
      {
        "problem": "动作过难或身体失控/落地冲击过大",
        "fix": "最初，假如你无法将躯干向前探出得足够远，或许就无法在杠上停留。这时，只要把动作做完就可以了——很快你就能在杠上停留了。"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (动作受控·安全完成)",
      "intermediate": "2组 × 4次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 6次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        1,
        5
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  },
  {
    "id": "pPull_10",
    "name": "双立臂",
    "nameEn": "The Muscle-up",
    "category": "power_pull",
    "categoryLabel": "暴力上杠",
    "seriesId": "power_pull",
    "step": 10,
    "source": "第三册第九章最终式",
    "riskLevel": "high",
    "equipment": [
      "单杠"
    ],
    "equipmentTags": [
      "bar"
    ],
    "isHold": false,
    "purpose": "如果问哪个受欢迎的力量型动作能够展现全面的能力，那答案很可能是强大的双立臂。与大多数力量型动作不同，双立臂以强有力的拉和推为特征，还需要实用速度、爆发力、平衡能...",
    "keyPoints": [
      "握住上方的单杠，握距应当接近肩宽，双肩应当紧紧向下拉。",
      "采用虚握的抓握方式，也就是把拇指放在单杠上。",
      "在向上拉起身体前，用摆动晃身（第一式）产生一些惯性。到了这个阶段，你的摆动晃身应当更有爆发力，后摆的高度应该比前几式中的高。"
    ],
    "commonIssues": [
      {
        "problem": "动作节奏走形或落地生硬",
        "fix": "降低动作速度，先行在软垫或受控环境下练习，注意关节吸震"
      }
    ],
    "standards": {
      "beginner": "1组 × 2次 (动作受控·安全完成)",
      "intermediate": "2组 × 3次 (速度流畅·着地轻盈)",
      "upgrade": "3组 × 5次 (极速爆发·随心所欲)"
    },
    "defaultPrescription": {
      "sets": 4,
      "repRange": [
        1,
        5
      ],
      "restSeconds": 120,
      "tempoDescription": "瞬间极速爆发 · 柔顺受控缓冲",
      "rirTarget": 3
    }
  }
];

module.exports = exercisesCC3;
