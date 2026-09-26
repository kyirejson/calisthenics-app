/** Automatic courses: weight-loss full-body work and the six classic prisoner arts. */
module.exports = {
  workouts: {
    fullA: {
      id: 'fullA', name: '全身保肌 A', description: '下肢与推力优先，兼顾拉力和后链', estimatedMinutes: 45,
      slots: [
        { id: 'squat_slot', category: 'squat', priority: 1 },
        { id: 'push_slot', category: 'push', priority: 1 },
        { id: 'pull_slot', category: 'pull', priority: 2 },
        { id: 'bridge_slot', category: 'bridge', priority: 2 },
        { id: 'leg_slot', category: 'legRaise', priority: 2 },
        { id: 'aux_slot', category: 'auxiliary', priority: 3 },
      ],
    },
    fullB: {
      id: 'fullB', name: '全身保肌 B', description: '拉力与后链优先，兼顾下肢和推力', estimatedMinutes: 45,
      slots: [
        { id: 'pull_slot', category: 'pull', priority: 1 },
        { id: 'bridge_slot', category: 'bridge', priority: 1 },
        { id: 'squat_slot', category: 'squat', priority: 2 },
        { id: 'push_slot', category: 'push', priority: 2 },
        { id: 'leg_slot', category: 'legRaise', priority: 2 },
        { id: 'aux_slot', category: 'auxiliary', priority: 3 },
      ],
    },
    fullComprehensive: {
      id: 'fullComprehensive', name: '全身保肌 C', description: '全身动作模式巩固', estimatedMinutes: 60,
      slots: [
        { id: 'squat_slot', category: 'squat', priority: 1 },
        { id: 'push_slot', category: 'push', priority: 1 },
        { id: 'pull_slot', category: 'pull', priority: 1 },
        { id: 'leg_slot', category: 'legRaise', priority: 2 },
        { id: 'bridge_slot', category: 'bridge', priority: 2 },
        { id: 'aux_slot', category: 'auxiliary', priority: 3 },
      ],
    },
    prisonerA: {
      id: 'prisonerA', name: '六艺 A · 推力与前链', description: '两练/三练时练俯卧撑与举腿；六练时练推力、腹部与小腿提踵', estimatedMinutes: 25,
      slots: [
        { id: 'push', category: 'push', priority: 1 },
        { id: 'legRaise', category: 'legRaise', priority: 1 },
        { id: 'calf', category: 'calf', priority: 2 },
      ],
    },
    prisonerB: {
      id: 'prisonerB', name: '六艺 B · 拉力与下肢', description: '两练/三练时练引体与深蹲；六练时练拉力、深蹲与悬挂抓握', estimatedMinutes: 25,
      slots: [
        { id: 'pull', category: 'pull', priority: 1 },
        { id: 'squat', category: 'squat', priority: 1 },
        { id: 'hang_grip', category: 'hang_grip', priority: 2 },
      ],
    },
    prisonerC: {
      id: 'prisonerC', name: '六艺 C · 垂直推与后链', description: '三练时练倒立撑与桥；六练时练倒立撑、桥与颈部力量', estimatedMinutes: 25,
      slots: [
        { id: 'hspu', category: 'hspu', priority: 1 },
        { id: 'bridge', category: 'bridge', priority: 1 },
        { id: 'neck', category: 'neck', priority: 2 },
      ],
    },
    prisonerD: {
      id: 'prisonerD', name: '六艺 D · 闭关拉力与下肢', description: '闭关修炼轮次二：引体、深蹲与悬挂抓握', estimatedMinutes: 35,
      slots: [
        { id: 'pull', category: 'pull', priority: 1 },
        { id: 'squat', category: 'squat', priority: 1 },
        { id: 'hang_grip', category: 'hang_grip', priority: 2 },
      ],
    },
    prisonerE: {
      id: 'prisonerE', name: '六艺 E · 闭关推力与前链', description: '闭关修炼轮次二：俯卧撑、举腿与小腿提踵', estimatedMinutes: 35,
      slots: [
        { id: 'push', category: 'push', priority: 1 },
        { id: 'legRaise', category: 'legRaise', priority: 1 },
        { id: 'calf', category: 'calf', priority: 2 },
      ],
    },
    prisonerF: {
      id: 'prisonerF', name: '六艺 F · 闭关垂直推与后链', description: '闭关修炼轮次二：倒立撑、桥与颈部力量', estimatedMinutes: 35,
      slots: [
        { id: 'hspu', category: 'hspu', priority: 1 },
        { id: 'bridge', category: 'bridge', priority: 1 },
        { id: 'neck', category: 'neck', priority: 2 },
      ],
    },
    // Application recovery courses inspired by CC2, not the CC1 weekly tables.
    prisoner_recovery_phase1: {
      id: 'prisoner_recovery_phase1',
      name: '初试身手 · 主动恢复与关节养护',
      description: '短桥、屈膝辅助支撑与舒适扭转；初阶、轻量、可跳过',
      estimatedMinutes: 10,
      slots: [
        { id: 'short_bridge', category: 'recovery_shortBridge', priority: 1 },
        { id: 'bent_hold', category: 'recovery_bentHold', priority: 1 },
        { id: 'easy_twist', category: 'recovery_easyTwist', priority: 1 },
      ],
    },
    prisoner_recovery_trifecta: {
      id: 'prisoner_recovery_trifecta',
      name: '关节三诀 · 深度张力平衡与脊柱减压',
      description: '原著标准死悬垂与关节三诀保持，消除推拉训练后的剪切应力，保持关节健康',
      estimatedMinutes: 12,
      slots: [
        { id: 'hang_slot', category: 'dead_hang', priority: 1 },
        { id: 'trifecta_bridge_slot', category: 'trifecta_bridge', priority: 1 },
        { id: 'trifecta_lHold_slot', category: 'trifecta_lHold', priority: 1 },
        { id: 'trifecta_twist_slot', category: 'trifecta_twist', priority: 1 },
      ],
    },
    prisoner_recovery_elite: {
      id: 'prisoner_recovery_elite',
      name: '闭关极效 · 深度物理牵引与系统排空',
      description: '大容量六艺轰炸后的深层神经与关节减压：双组死悬垂牵引与三诀深层张力平衡',
      estimatedMinutes: 15,
      slots: [
        { id: 'hang_slot', category: 'dead_hang', priority: 1 },
        { id: 'trifecta_bridge_slot', category: 'trifecta_bridge', priority: 1 },
        { id: 'trifecta_lHold_slot', category: 'trifecta_lHold', priority: 1 },
        { id: 'trifecta_twist_slot', category: 'trifecta_twist', priority: 1 },
      ],
    },
  },
};
