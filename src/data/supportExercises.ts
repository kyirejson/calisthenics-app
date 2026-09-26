import type { Exercise } from '../types';

// Separate IDs keep app adaptations from masquerading as original-book exercises.
export const supportExercises: Exercise[] = [
  {
    id: 'aux_singleLegCalf', name: '单腿提踵', category: 'auxiliary', categoryLabel: '小腿辅助', riskLevel: 'low',
    source: '《囚徒健身 2》第十一章 · 单腿地面提踵（直腿）；训练量为应用编排，演示图为生成素材',
    purpose: '在平地练习单侧小腿力量与控制，不使用台阶增加下落幅度。',
    keyPoints: ['站在平整地面，手轻扶墙或稳固支撑物；抬起另一只脚，支撑腿自然伸直，不反顶膝盖。', '用前脚掌平稳推地，2 秒抬跟、顶端停 1 秒、2 秒落回地面；脚踝不向内外翻，不弹跳。', '一组左右各 10 次，合计 20 次；两侧都练完再打钩，记录栏填写左右实际完成的合计次数。换边时先站稳，必要时额外休息。', '先做 2 组，组间休息 60 秒，可按需要延长。此为应用起始训练量，不是原书每侧 4×30 的初级标准。', '不能稳定完成时减次数、增加手部支撑；出现足踝或跟腱疼痛时停止，不勉强凑数。'],
    commonIssues: [{ problem: '借膝盖屈伸或身体弹跳抬跟', fix: '躯干保持稳定，缩小幅度，慢起慢落。' }, { problem: '只练一侧就按目标次数打钩', fix: '先完成左右两侧，再填写实际合计次数；未完成的次数不记录。' }],
    standards: { beginner: '应用训练量：2组 × 20次（左右各10次）' },
    defaultPrescription: { sets: 2, repRange: [20, 20], restSeconds: 60, tempoDescription: '2秒起·1秒停·2秒下', rirTarget: 3 },
  },
  {
    id: 'recovery_shortBridge', name: '短桥保持', category: 'auxiliary', categoryLabel: '基础恢复',
    source: '《囚徒健身 2》第十五章 · 短桥式；恢复剂量为应用编排', isHold: true, riskLevel: 'low',
    purpose: '轻松练习后链支撑，不做完整桥式，不追求极限后弯。',
    keyPoints: ['仰卧屈膝，双脚平放，与髋同宽。', '肩背和双脚支撑，轻抬髋部，头颈不承重。', '自然呼吸；腰部挤压或疼痛时放低髋部并停止。'],
    standards: { beginner: '轻松保持 10 秒', intermediate: '分次累计 20 秒' },
    defaultPrescription: { sets: 2, restSeconds: 45, tempoDescription: '轻松保持，自然呼吸', rirTarget: 4 },
  },
  {
    id: 'recovery_bentHold', name: '屈膝支撑保持', category: 'auxiliary', categoryLabel: '基础恢复', isHold: true, riskLevel: 'low',
    source: '《囚徒健身 2》第十六章屈膝直角式思路；可保留脚部辅助',
    purpose: '从屈膝支撑开始，不要求完整直腿 L 型支撑。',
    keyPoints: ['使用不会翻倒的稳固扶手或支架，双手下压，肩膀远离耳朵。', '膝盖弯曲；脚尖先辅助支撑，能轻松控制再短暂离地。', '保持顺畅呼吸，手腕不适就停止；不要以憋气完成时长。'],
    standards: { beginner: '轻松保持 5 秒', intermediate: '分次累计 20 秒' },
    defaultPrescription: { sets: 4, restSeconds: 30, tempoDescription: '轻松支撑，脚可辅助', rirTarget: 4 },
  },
  {
    id: 'recovery_easyTwist', name: '舒适坐姿扭转', category: 'auxiliary', categoryLabel: '基础恢复', isHold: true, riskLevel: 'low',
    source: '《囚徒健身 2》第十七章 · 简易扭转思路；应用恢复版本',
    purpose: '在舒适范围内活动躯干，不用手臂强扳。',
    keyPoints: ['坐稳，背部自然立起，不必盘腿或锁住双手。', '轻转胸口，头部随动，不强拧颈部。', '左右交替，每侧 10 秒；记录一组表示两侧均完成。'],
    standards: { beginner: '每侧 10 秒', intermediate: '每侧分次累计 20 秒' },
    defaultPrescription: { sets: 2, restSeconds: 30, tempoDescription: '左右各做，舒适呼吸', rirTarget: 4 },
  },
  {
    id: 'neck_handResistance', name: '手阻抬头练习', category: 'auxiliary', categoryLabel: '颈部准备', riskLevel: 'moderate',
    source: '《囚徒健身 2》第十章 · 颈部训练小贴士；配图为 AI 写实人物示范（非原书照片），起步剂量为应用编排',
    purpose: '用双手提供轻阻力，不用头部撑地；颈部准备不能代替倒立撑的推举能力训练。',
    keyPoints: ['坐稳或站稳，头颈自然中立。双手交握轻放脑后，先在无阻力下确认活动舒适。', '双手仅给轻微阻力，缓慢小幅点头并回到中立位；两侧偏头同样轻柔，不扭转、不拉扯头部。', '一组共 10 次：点头回正 4 次、左偏回正 3 次、右偏回正 3 次；只在无痛范围内活动，正常呼吸。', '应用先安排 1 组，不追求力竭；原书热身建议为一组 20–30 次，不是新手必须达到的次数。', '已有颈部伤病先咨询专业人士；出现疼痛、头晕、麻木或放射症状立即停止。'],
    commonIssues: [{ problem: '双手用力扳头或用头顶承重', fix: '手只提供轻阻力，全程不接触地面；不适就停止。' }],
    standards: { beginner: '1组，共10次轻阻力活动；这是应用起步量，不是解锁测试' },
    defaultPrescription: { sets: 1, repRange: [10, 10], restSeconds: 120, tempoDescription: '2秒去·2秒回', rirTarget: 4 },
  },
  {
    id: 'aux_calfBeginner', name: '双腿屈膝平地提踵', category: 'auxiliary', categoryLabel: '小腿辅助', riskLevel: 'low',
    source: '《囚徒健身 2》第十一章 · 第一阶段',
    purpose: '小腿训练从双腿平地起步，不直接安排单腿台阶终极式。',
    keyPoints: ['双脚站稳，扶稳固物体保持平衡，双膝略弯。', '脚跟缓慢抬起，控制下降至地面。', '保持脚踝对齐，不弹震，不把重量压向脚外侧。'],
    standards: { beginner: '2组 × 20次', upgrade: '4组 × 100次' },
    defaultPrescription: { sets: 2, repRange: [20, 30], restSeconds: 60, tempoDescription: '2秒起·1秒停·2秒下', rirTarget: 3 },
  },
  {
    id: 'aux_neckNeutral', name: '颈部轻等长抗阻', category: 'auxiliary', categoryLabel: '颈部辅助', isHold: true, riskLevel: 'moderate',
    source: '应用替代练习 · 不是原书反颈桥',
    purpose: '不以头部撑地；颈部有伤病或不适时跳过并咨询专业人士。',
    keyPoints: ['坐稳，头颈中立，手掌轻放额头，轻轻互相对抗而不移动头部。', '以相同轻力度练后方、左侧、右侧，每向 5 秒；一组为四向均完成。', '正常呼吸，不用最大力；疼痛、眩晕或麻木时立即停止。'],
    standards: { beginner: '每向 5 秒' },
    defaultPrescription: { sets: 1, restSeconds: 60, tempoDescription: '四向轻抗阻，头不移动', rirTarget: 4 },
  },
];
