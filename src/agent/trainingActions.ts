import type { DailyWorkoutEdits, Profile, TrainingSession } from '../types';
import type { AssistantIntent } from '../nutrition/assistantState';
import { getPlanDay } from '../data/trainingPlans';
import { canAddExercise, exercises, getWorkoutExercises } from '../data/catalog';
import { equipmentReplacementIds } from '../data/equipmentTraining';
import { getEquipmentMovement } from '../data/equipment';
import { dailyWorkoutKey, trainingDateKey } from '../data/sessionRecords';
import { overlayDate, trainingScope, type TrainingOverlay } from './trainingOverlay';
export type TrainingIntent = { type: 'training_adjustment'; operation: 'replace' | 'sets' | 'reschedule' | 'postpone' | 'deload' | 'reset'; date: string; exercise: string | null; replacement: string | null; sets: number | null; toDate: string | null };
export type TrainingDraft = { intent: TrainingIntent; scope: string; overlay: TrainingOverlay; date: string; summary: string; notices: string[] };
export function resolveTrainingDate(text: string, now: Date): Date {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) { const date = new Date(text + 'T12:00:00'); if (overlayDate(date) !== text) throw Error('日期无效。'); return date; }
  if (['今天', '明天', '后天'].includes(text)) day.setDate(day.getDate() + ['今天', '明天', '后天'].indexOf(text));
  else {
    const match = text.match(/^(这|下)?周([一二三四五六日天])$/u); if (!match) throw Error('请说今天、明天、周几或完整日期。');
    const index = '一二三四五六日天'.indexOf(match[2]), offset = (day.getDay() + 6) % 7;
    day.setDate(day.getDate() - offset + Math.min(index, 6) + (match[1] === '下' ? 7 : 0));
  }
  return day;
}
export function prepareTrainingAdjustment(profile: Profile, sessions: TrainingSession[], edits: DailyWorkoutEdits, intent: Extract<AssistantIntent, { type: 'training_adjustment' }>, now = new Date()): TrainingDraft {
  const date = resolveTrainingDate(intent.date, now), key = overlayDate(date), today = overlayDate(now);
  if (key < today || date.getTime() - now.getTime() > 28 * 86400000) throw Error('只能调整今天至未来四周的计划，不改历史记录。');
  const scope = trainingScope(profile), overlay: TrainingOverlay = JSON.parse(JSON.stringify(profile.agentTrainingOverlay || { version: 1, scope, days: {}, courses: {} }));
  const plan = getPlanDay(profile, date), workoutId = plan.day.workoutId;
  const locked = (at: string) => sessions.some(s => (s.trainingDate ? s.trainingDate.split('-').map((part, i) => i ? part.padStart(2, '0') : part).join('-') : overlayDate(new Date(s.startedAt))) === at && (s.kind === 'running' || s.exercises.some(e => e.sets.some(set => set.completed))));
  if (locked(key)) throw Error('该日已有实际训练记录；不改写已训练处方，请调整未训练日期。');
  const notices = ['只影响所选日期；原始模板与实际训练记录保留，可撤销。'];
  let summary = '';
  if (intent.operation === 'reset') {
    const day = overlay.days[key];
    if (day) {
      const dates = day.groupId ? Object.keys(overlay.days).filter(at => overlay.days[at].groupId === day.groupId) : day.pairedDate ? [key, day.pairedDate] : [];
      if (!dates.length) throw Error('旧调期缺少归属记录，不能单边恢复。');
      if (dates.some(at => at < today || locked(at))) throw Error('调期关联日期已有历史或实际训练，不能单边撤销。');
      for (const at of dates) { for (const k of Object.keys(overlay.courses)) if (k.startsWith(at + ':')) delete overlay.courses[k]; delete overlay.days[at]; }
      notices.push('同时恢复本次调期的所有关联日期及课程调整，避免重复课程。');
    }
    for (const k of Object.keys(overlay.courses)) if (k.startsWith(key + ':')) delete overlay.courses[k];
    summary = key + ' 恢复原训练处方';
  } else if (intent.operation === 'postpone') {
    if (!workoutId || !intent.toDate) throw Error('起始日没有训练，或缺少目标日期。');
    const to = resolveTrainingDate(intent.toDate, now), target = overlayDate(to);
    if (target <= key || to.getTime() - now.getTime() > 28 * 86400000) throw Error('推迟必须选择起始日之后、未来四周内的日期。');
    // Rotate ownership to the first free day, never pull tomorrow’s lesson into today.
    const destinations = [key];
    const cursor = new Date(to);
    for (;;) {
      const at = overlayDate(cursor);
      if (cursor.getTime() - now.getTime() > 28 * 86400000) throw Error('四周内没有可顺延的休息日，请选择其他日期。');
      if (locked(at) || overlay.days[at]) throw Error('顺延链路存在已训练或已调期日期，请先撤销旧调整或选择其他日期。');
      destinations.push(at);
      if (!getPlanDay(profile, cursor).day.workoutId) break;
      cursor.setDate(cursor.getDate() + 1);
    }
    if (overlay.days[key]) throw Error('起始日已调期，请先撤销原调整。');
    const origins = [destinations[destinations.length - 1], ...destinations.slice(0, -1)];
    const courses: TrainingOverlay['courses'] = {};
    for (let i = 0; i < destinations.length; i++) {
      const from = origins[i], at = destinations[i], day = getPlanDay(profile, new Date(from + 'T12:00:00')).day;
      overlay.days[at] = { workoutId: day.workoutId || null, title: day.workoutId ? day.title : '休息 · 训练已顺延', type: day.type, sourceDate: from, groupId: key };
      if (day.workoutId && overlay.courses[from + ':' + day.workoutId]) courses[at + ':' + day.workoutId] = overlay.courses[from + ':' + day.workoutId];
      notices.push(at + '：' + overlay.days[at].title);
    }
    for (const at of destinations) for (const k of Object.keys(overlay.courses)) if (k.startsWith(at + ':')) delete overlay.courses[k];
    Object.assign(overlay.courses, courses);
    summary = key + ' 休息；本课推迟至 ' + target;
    notices[0] = '目标日原有课程依次顺延至首个休息日；不交换、不删除课程。跨周会改变各周分布，追加动作随课程移动。';
  } else if (intent.operation === 'reschedule') {
    if (!workoutId || !intent.toDate) throw Error('起始日没有训练，或缺少目标日期。');
    const to = resolveTrainingDate(intent.toDate, now), target = overlayDate(to), targetDay = getPlanDay(profile, to).day;
    if (target <= today && target !== today || target === key || to.getTime() - now.getTime() > 28 * 86400000 || locked(target)) throw Error('目标日期不可用；请选未来未训练日期。');
    const existingPair = overlay.days[key]?.pairedDate, otherPair = overlay.days[target]?.pairedDate;
    if (overlay.days[key]?.groupId || overlay.days[target]?.groupId) throw Error('所选日期属于顺延链路，请先撤销原调整。');
    if (existingPair && existingPair !== target || otherPair && otherPair !== key) throw Error('所选日期已与其他日期配对调期；请先撤销原调整。');
    const undoPair = existingPair === target && otherPair === key;
    if (undoPair) { delete overlay.days[target]; delete overlay.days[key]; }
    else {
      overlay.days[target] = { workoutId, title: plan.day.title, type: plan.day.type, pairedDate: key };
      overlay.days[key] = { workoutId: targetDay.workoutId || null, title: targetDay.title, type: targetDay.type, pairedDate: target };
    }
    // Follow an already customized course to its new day.
    const sourceKey = key + ':' + workoutId, targetKey = target + ':' + targetDay.workoutId;
    const sourceCourse = overlay.courses[sourceKey], targetCourse = targetDay.workoutId ? overlay.courses[targetKey] : undefined;
    delete overlay.courses[sourceKey]; if (targetDay.workoutId) delete overlay.courses[targetKey];
    if (sourceCourse) overlay.courses[target + ':' + workoutId] = sourceCourse;
    if (targetCourse && targetDay.workoutId) overlay.courses[key + ':' + targetDay.workoutId] = targetCourse;
    summary = key + ' 与 ' + target + ' 交换训练安排'; notices.push('交换而非复制课程；追加动作随日期交换，跨周调期会改变各周分布。');
  } else {
    if (!workoutId) throw Error('所选日期没有动作课程，请先选择训练日。');
    const items = getWorkoutExercises(workoutId, profile, plan.cycle.setMultiplier, plan.cycle.dupDay, plan.cycle.week, { sessions, date, addedExerciseIds: edits[dailyWorkoutKey(trainingDateKey(date), workoutId)]?.exerciseIds });
    const courseKey = key + ':' + workoutId, course = overlay.courses[courseKey] || { replacements: {}, sets: {} };
    if (intent.operation === 'deload') { course.scale = .5; summary = key + ' 本课工作组减半（向最近整数取整，至少一组）'; notices.push('这是明确请求的减载课，不再声称本周达到原增肌剂量。'); }
    else {
      const matches = items.filter(e => e.name === intent.exercise || e.id === intent.exercise);
      if (matches.length !== 1) throw Error('未唯一匹配本课动作，请使用动作卡片上的完整名称。');
      const source = matches[0];
      const original = Object.entries(course.replacements).find(([, to]) => to === source.id)?.[0] || source.id;
      if (intent.operation === 'sets') { if (!Number.isInteger(intent.sets) || !intent.sets || intent.sets < 1 || intent.sets > 30) throw Error('工作组数应是 1–30 的整数。'); course.sets[original] = intent.sets; delete course.scale; summary = source.name + ' 改为 ' + intent.sets + ' 组'; }
      else {
        const candidates = profile.goal === 'equipment' ? equipmentReplacementIds(source.id, profile).map(id => getEquipmentMovement(id)!) : exercises.filter(e => e.category === source.category && canAddExercise(e, profile, sessions, date));
        const target = candidates.find(e => e && (e.name === intent.replacement || e.id === intent.replacement));
        if (!target || items.some(e => e.id === target.id)) throw Error('替换动作不唯一、已在本课，或不能保留目标／缺少器材。请从本课等效动作中选择。');
        course.replacements[original] = target.id;
        summary = source.name + ' → ' + target.name;
      }
    }
    overlay.courses[courseKey] = course;
  }
  if (Object.keys(overlay.days).length > 90 || Object.keys(overlay.courses).length > 180) throw Error('训练调整已达到保留上限，请先撤销旧调整。');
  return { intent, scope, overlay, date: key, summary, notices };
}
