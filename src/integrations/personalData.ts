import type { Profile, TrainingSession, DailyWorkoutEdits, Settings } from '../types';
import type { NutritionJournal } from '../nutrition/types';
import { localWeightDate } from '../domain/weight/weightTrend';
import { getNutritionTrainingContext, meaningfulTrainingSessions } from '../nutrition/training';
import { readMemory } from '../memory/storage';
import { editMemory } from '../memory/operations';
import { getPlanDay } from '../domain/training/trainingPlans';
import { getWorkoutExercises } from '../domain/training/catalog';
import { dailyWorkoutKey, trainingDateKey } from '../domain/training/sessionRecords';
import { knowledgeTools, executeKnowledgeTool } from '../knowledge/modelTools.mjs';
import { loadKnowledgeLibraries } from '../knowledge/storage';
import { isValidDateKey } from '../nutrition/validation';
import type { StoreActions } from '../store/contracts';
import { musicTools } from '../music/modelTools.mjs';
import { phoneTools } from '../device/modelTools.mjs';
import { reminderTools } from '../reminders/modelTools.mjs';
import { workflowTools } from '../device/workflowTools.mjs';
import { executeWebTool, webTools } from './webTools.mjs';
export type PersonalData = { profile: Profile | null; sessions: TrainingSession[]; dailyEdits: DailyWorkoutEdits; nutritionJournal: NutritionJournal; settings?: Settings };
export async function executePersonalTool(name: string, input: unknown, data: PersonalData, signal?: AbortSignal,
 writes?: { requestId: string; executionId?: string; apply: StoreActions['applyMealOperations']; updateSettings?: StoreActions['updateSettings'];
   onInterruptedToolResult?: (call: { name: string; args: Record<string, unknown>; result: unknown }) => void }) {
 if (signal?.aborted) throw Error('请求已取消。');
 if (workflowTools.some(tool => tool.function.name === name)) {
   const { executeWorkflowTool } = await import('../device/workflowRuntime');
   return executeWorkflowTool(name, input, writes?.requestId ?? '', writes?.executionId ?? writes?.requestId ?? '', signal, writes?.onInterruptedToolResult);
 }
 if (reminderTools.some(tool => tool.function.name === name)) {
   const { executeReminderTool } = await import('../reminders/agentRuntime');
   const { reminderTransport } = await import('../reminders/transport');
   return executeReminderTool(name, input, reminderTransport, writes?.requestId ?? '', signal);
 }
 if (webTools.some(tool => tool.function.name === name)) {
   const { requestPublicWeb } = await import('./webTransport');
   return executeWebTool(name, input, requestPublicWeb, signal);
 }
 if(knowledgeTools.some(tool=>tool.function.name===name))return executeKnowledgeTool(name,input,loadKnowledgeLibraries,signal);
 if (phoneTools.some(tool => tool.function.name === name)) {
   const { createPhoneRuntime } = await import('../device/agentRuntime');
   const { phoneTransport } = await import('../device/transport');
   return createPhoneRuntime(phoneTransport, { requestId: writes?.requestId ?? '', executionId: writes?.executionId ?? writes?.requestId ?? '', onInterruptedResult: writes?.onInterruptedToolResult })(name, input, signal);
 }
 if (musicTools.some(tool => tool.function.name === name)) {
   const { createMusicRuntime } = await import('../music/agentRuntime');
   const { musicTransport } = await import('../music/transport');
   return createMusicRuntime(musicTransport, {
     requestId: writes?.requestId ?? '', executionId: writes?.executionId, readSettings: () => data.settings ?? { vibration: true, restSeconds: 120 },
     updateSettings: async patch => { if (!writes?.updateSettings) throw Error('音乐预设保存接口未连接。'); await writes.updateSettings(patch); },
     onInterruptedResult: writes?.onInterruptedToolResult,
   })(name, input, signal);
 }
 const date=localWeightDate(new Date());
 switch(name){
  case 'read_agent_usage': return { ok: true, scope: 'last_500_model_requests_and_2000_task_events', ...await (await import('../agent/usageRuntime')).readAgentUsage(input ?? {}), note: '只保存计数、协议编号和耗时，无消息、参数、屏幕正文或录音。taskRanking 关联同一任务的语音判停、模型请求和工具执行。分页可继续读取。只覆盖保留窗口，不是全生命周期；请求耗时可重叠，不能相加冒充总等待时间。cacheHitRate=null 表示服务未报告缓存计数。outcome 是本轮模型结论/取消状态，不代替真实任务验收。' };
  case 'read_memory': {const markdown=await readMemory();return {ok:true,markdown:markdown??'',exists:markdown!==null};}
  case 'update_memory': return editMemory(input as Parameters<typeof editMemory>[0],signal);
  case 'read_today_training': {
   const now=new Date(), resolved=data.profile?getPlanDay(data.profile,now):null;
   const workoutId=resolved?.day.workoutId||'custom_daily';
   const addedExerciseIds=data.dailyEdits[dailyWorkoutKey(trainingDateKey(now),workoutId)]?.exerciseIds??[];
   const plannedExercises=data.profile&&resolved&&(resolved.day.workoutId||addedExerciseIds.length)
    ?getWorkoutExercises(workoutId,data.profile,resolved.cycle.setMultiplier,resolved.cycle.dupDay,resolved.cycle.week,{sessions:data.sessions,date:now,addedExerciseIds}):[];
   return {ok:true,date,plan:resolved?.day??null,plannedExercises,summary:data.profile?getNutritionTrainingContext(data.profile,data.sessions,data.dailyEdits,date):null,actualSessions:meaningfulTrainingSessions(data.sessions,date),note:'计划不代表已完成；实际记录只包含有完成数据的训练。'};
  }
  case 'read_recent_weight': return {ok:true,profileWeight:data.profile?.weight||null,measurements:[...(data.profile?.weightHistory??[])].filter(row=>row.date<=date).sort((a,b)=>a.date.localeCompare(b.date)),note:'档案体重不一定是今天的测量。'};
  case 'read_today_meals': {
   const chosen = input && typeof input === 'object' && 'date' in input ? input.date : date;
   if (!isValidDateKey(chosen)) throw Error('饮食日期格式应为 YYYY-MM-DD。');
   return {ok:true,date:chosen,entries:data.nutritionJournal.entries.filter(row=>row.date===chosen),dayState:data.nutritionJournal.days[chosen]??null,note:'未记录不代表没有吃。agentFood.values 中 null 是未知；nutrients 仅为已知部分合计。'};
  }
  case 'write_meal_records': {
   if (!writes) throw Error('饮食保存接口尚未连接。');
   return writes.apply(input,writes.requestId,signal);
  }
  default: throw Error('未知工具：'+name);
 }
}
