/**
 * 《囚徒健身》现代运动科学周期化训练日程模板 (支持每周 1 - 6 次自由选择)
 */

const templates = {
  schedules: {
    week1: {
      id: 'week1',
      name: '每周一次 (单日全能特训)',
      description: '适合时间极度紧张、重度出差或作为其他主项的体能补充',
      sessionsPerWeek: 1,
      defaultDays: [6], // 周六
      workouts: ['fullComprehensive']
    },
    week2: {
      id: 'week2',
      name: '每周两次 (A/B全身轮替)',
      description: '适合完全零基础、重塑关节柔韧与稳妥入门践行者',
      sessionsPerWeek: 2,
      defaultDays: [1, 4], // 周一、周四
      workouts: ['fullA', 'fullB']
    },
    week3: {
      id: 'week3',
      name: '每周三次 (A-B-A / B-A-B 双周轮替)',
      description: '现代自重力量黄金频率，双周轮替杜绝推拉肌群失衡，兼顾高频刺激与充分超量恢复',
      sessionsPerWeek: 3,
      defaultDays: [1, 3, 5], // 周一、周三、周五
      workouts: ['fullA', 'fullB', 'fullA'],
      altWorkouts: ['fullB', 'fullA', 'fullB']
    },
    week4: {
      id: 'week4',
      name: '每周四次 (上下肢分化 Upper/Lower)',
      description: '推拉平衡与上下身彻底分离，72小时黄金超量恢复窗口，适合中高级训练者',
      sessionsPerWeek: 4,
      defaultDays: [1, 2, 4, 5], // 周一、二、四、五
      workouts: ['splitUpper', 'splitLower', 'splitUpper', 'splitLower']
    },
    week5: {
      id: 'week5',
      name: '每周五次 (现代 PPL + 上下肢进阶)',
      description: '高频推拉腿分化，彻底杜绝单一部位低效孤立，肌肉刺激频率与容量最大化',
      sessionsPerWeek: 5,
      defaultDays: [1, 2, 3, 4, 5], // 周一至周五
      workouts: ['pplPush', 'pplPull', 'pplLegs', 'splitUpper', 'splitLower']
    },
    week6: {
      id: 'week6',
      name: '每周六次 (高频推拉腿 PPL × 2 循环)',
      description: '高阶自重修炼者专用！每周双循环刺激全身主要动力链，深度打磨爆发力与神技',
      sessionsPerWeek: 6,
      defaultDays: [1, 2, 3, 4, 5, 6], // 周一至周六
      workouts: ['pplPush', 'pplPull', 'pplLegs', 'pplPush', 'pplPull', 'pplLegs']
    }
  },

  workouts: {
    // 1. 全身 A (推 + 蹲 + 桥 + 举腿)
    fullA: {
      id: 'fullA',
      name: '基础全身课 A',
      description: '水平推 + 双腿深蹲 + 脊柱大桥 + 腹壁举腿',
      estimatedMinutes: 30,
      slots: [
        { id: 'push_slot', category: 'push', priority: 1, prescription: { sets: 3, restSeconds: 60 } },
        { id: 'squat_slot', category: 'squat', priority: 1, prescription: { sets: 3, restSeconds: 60 } },
        { id: 'bridge_slot', category: 'bridge', priority: 2, prescription: { sets: 2, restSeconds: 60 } },
        { id: 'leg_slot', category: 'legRaise', priority: 3, prescription: { sets: 2, restSeconds: 45 } }
      ]
    },
    // 2. 全身 B (拉 + 倒立撑 + 蹲 + 辅助)
    fullB: {
      id: 'fullB',
      name: '基础全身课 B',
      description: '垂直拉 + 倒立推力 + 深蹲巩固 + 辅助悬垂',
      estimatedMinutes: 30,
      slots: [
        { id: 'pull_slot', category: 'pull', priority: 1, prescription: { sets: 3, restSeconds: 90 } },
        { id: 'hspu_slot', category: 'hspu', priority: 2, prescription: { sets: 2, restSeconds: 90 } },
        { id: 'squat_slot', category: 'squat', priority: 1, prescription: { sets: 3, restSeconds: 60 } },
        { id: 'aux_slot', category: 'auxiliary', priority: 3, prescription: { sets: 2, restSeconds: 45 } }
      ]
    },
    // 3. 全身单日全能课
    fullComprehensive: {
      id: 'fullComprehensive',
      name: '周末六艺精选课',
      description: '单日巡礼：俯卧撑 + 引体 + 深蹲 + 举腿 + 桥',
      estimatedMinutes: 45,
      slots: [
        { id: 'push_slot', category: 'push', priority: 1, prescription: { sets: 3, restSeconds: 60 } },
        { id: 'pull_slot', category: 'pull', priority: 1, prescription: { sets: 3, restSeconds: 90 } },
        { id: 'squat_slot', category: 'squat', priority: 1, prescription: { sets: 3, restSeconds: 60 } },
        { id: 'leg_slot', category: 'legRaise', priority: 2, prescription: { sets: 2, restSeconds: 45 } },
        { id: 'bridge_slot', category: 'bridge', priority: 2, prescription: { sets: 2, restSeconds: 60 } }
      ]
    },
    // 4. 四日分化：上肢推拉
    splitUpper: {
      id: 'splitUpper',
      name: '上肢力量分化',
      description: '水平推 + 垂直拉 + 垂直推 + 抓握辅助',
      estimatedMinutes: 35,
      slots: [
        { id: 'push_slot', category: 'push', priority: 1, prescription: { sets: 3, restSeconds: 60 } },
        { id: 'pull_slot', category: 'pull', priority: 1, prescription: { sets: 3, restSeconds: 90 } },
        { id: 'hspu_slot', category: 'hspu', priority: 2, prescription: { sets: 2, restSeconds: 90 } },
        { id: 'aux_slot', category: 'auxiliary', priority: 3, prescription: { sets: 2, restSeconds: 45 } }
      ]
    },
    // 5. 四日分化：下肢核心
    splitLower: {
      id: 'splitLower',
      name: '下肢与核心分化',
      description: '深蹲 + 举腿 + 桥 + 提踵',
      estimatedMinutes: 35,
      slots: [
        { id: 'squat_slot', category: 'squat', priority: 1, prescription: { sets: 3, restSeconds: 60 } },
        { id: 'leg_slot', category: 'legRaise', priority: 1, prescription: { sets: 3, restSeconds: 60 } },
        { id: 'bridge_slot', category: 'bridge', priority: 2, prescription: { sets: 2, restSeconds: 60 } },
        { id: 'calf_slot', category: 'auxiliary', priority: 3, prescription: { sets: 2, restSeconds: 45 } }
      ]
    },
    // 6. 现代 PPL 核心分化课
    pplPush: {
      id: 'pplPush',
      name: 'PPL：推力专项 (Push)',
      description: '水平俯卧撑 + 垂直倒立撑 + 核心抗伸展',
      estimatedMinutes: 30,
      slots: [
        { id: 'push_slot', category: 'push', priority: 1, prescription: { sets: 4, restSeconds: 60 } },
        { id: 'hspu_slot', category: 'hspu', priority: 1, prescription: { sets: 3, restSeconds: 90 } },
        { id: 'leg_slot', category: 'legRaise', priority: 2, prescription: { sets: 2, restSeconds: 45 } }
      ]
    },
    pplPull: {
      id: 'pplPull',
      name: 'PPL：拉力专项 (Pull)',
      description: '垂直引体 + 水平拉力 + 悬垂抓握',
      estimatedMinutes: 30,
      slots: [
        { id: 'pull_slot', category: 'pull', priority: 1, prescription: { sets: 4, restSeconds: 90 } },
        { id: 'aux_slot', category: 'auxiliary', priority: 2, prescription: { sets: 3, restSeconds: 45 } }
      ]
    },
    pplLegs: {
      id: 'pplLegs',
      name: 'PPL：下肢与后链 (Legs & Bridge)',
      description: '全幅度深蹲 + 脊柱大桥 + 腹壁举腿',
      estimatedMinutes: 30,
      slots: [
        { id: 'squat_slot', category: 'squat', priority: 1, prescription: { sets: 4, restSeconds: 60 } },
        { id: 'bridge_slot', category: 'bridge', priority: 1, prescription: { sets: 3, restSeconds: 60 } },
        { id: 'leg_slot', category: 'legRaise', priority: 2, prescription: { sets: 2, restSeconds: 45 } }
      ]
    },

    // 7. 工作日每日打卡兼容课
    dailyPush: { id: 'dailyPush', name: '俯卧撑专注课', description: '俯卧撑 + 核心控制', estimatedMinutes: 20, slots: [{ id: 'push_slot', category: 'push', priority: 1, prescription: { sets: 4, restSeconds: 60 } }, { id: 'leg_slot', category: 'legRaise', priority: 2, prescription: { sets: 2, restSeconds: 45 } }] },
    dailyPull: { id: 'dailyPull', name: '引体向上专注课', description: '引体向上 + 握力抓握', estimatedMinutes: 20, slots: [{ id: 'pull_slot', category: 'pull', priority: 1, prescription: { sets: 4, restSeconds: 90 } }, { id: 'aux_slot', category: 'auxiliary', priority: 2, prescription: { sets: 2, restSeconds: 45 } }] },
    dailySquat: { id: 'dailySquat', name: '深蹲专注课', description: '全幅度深蹲 + 小腿提踵', estimatedMinutes: 20, slots: [{ id: 'squat_slot', category: 'squat', priority: 1, prescription: { sets: 4, restSeconds: 60 } }, { id: 'calf_slot', category: 'auxiliary', priority: 2, prescription: { sets: 2, restSeconds: 45 } }] },
    dailyCore: { id: 'dailyCore', name: '躯干举腿专注课', description: '举腿 + 悬垂抗摆动', estimatedMinutes: 20, slots: [{ id: 'leg_slot', category: 'legRaise', priority: 1, prescription: { sets: 4, restSeconds: 60 } }, { id: 'aux_slot', category: 'auxiliary', priority: 2, prescription: { sets: 2, restSeconds: 45 } }] },
    dailyBridge: { id: 'dailyBridge', name: '脊柱桥梁专注课', description: '后侧链大桥 + 倒立顶立', estimatedMinutes: 20, slots: [{ id: 'bridge_slot', category: 'bridge', priority: 1, prescription: { sets: 4, restSeconds: 60 } }, { id: 'hspu_slot', category: 'hspu', priority: 2, prescription: { sets: 2, restSeconds: 60 } }] },
    
    // 8. 六艺专项分化课
    six_push: { id: 'six_push', name: '六艺之一：俯卧撑日', description: '俯卧撑深度专项修行', estimatedMinutes: 25, slots: [{ id: 'push_slot', category: 'push', priority: 1, prescription: { sets: 4, restSeconds: 60 } }] },
    six_pull: { id: 'six_pull', name: '六艺之二：引体向上日', description: '垂直拉力专项修行', estimatedMinutes: 25, slots: [{ id: 'pull_slot', category: 'pull', priority: 1, prescription: { sets: 4, restSeconds: 90 } }] },
    six_squat: { id: 'six_squat', name: '六艺之三：深蹲日', description: '下肢深蹲专项修行', estimatedMinutes: 25, slots: [{ id: 'squat_slot', category: 'squat', priority: 1, prescription: { sets: 4, restSeconds: 60 } }] },
    six_legRaise: { id: 'six_legRaise', name: '六艺之四：举腿日', description: '中段腹壁专项修行', estimatedMinutes: 25, slots: [{ id: 'leg_slot', category: 'legRaise', priority: 1, prescription: { sets: 4, restSeconds: 60 } }] },
    six_bridge: { id: 'six_bridge', name: '六艺之五：桥日', description: '脊柱龙骨专项修行', estimatedMinutes: 25, slots: [{ id: 'bridge_slot', category: 'bridge', priority: 1, prescription: { sets: 4, restSeconds: 60 } }] },
    six_hspu: { id: 'six_hspu', name: '六艺之六：倒立撑日', description: '倒立推力专项修行', estimatedMinutes: 25, slots: [{ id: 'hspu_slot', category: 'hspu', priority: 1, prescription: { sets: 4, restSeconds: 90 } }] }
  },

  getShortWorkout(workoutId, availableMinutes) {
    const workout = this.workouts[workoutId] || this.workouts['fullA'];
    const keptSlots = (workout.slots || []).filter(s => s.priority === 1).map(s => s.id);
    return {
      workoutId,
      keptSlots,
      estimatedMinutes: Math.min(availableMinutes || 15, 15)
    };
  }
};

module.exports = templates;
