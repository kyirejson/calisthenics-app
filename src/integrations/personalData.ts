import type { Profile, TrainingSession, DailyWorkoutEdits } from '../types';
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
export type PersonalData = { profile: Profile | null; sessions: TrainingSession[]; dailyEdits: DailyWorkoutEdits; nutritionJournal: NutritionJournal };
export async function executePersonalTool(name: string, input: unknown, data: PersonalData, signal?: AbortSignal) {
 if (signal?.aborted) throw Error('请求已取消。');
 if(knowledgeTools.some(tool=>tool.function.name===name))return executeKnowledgeTool(name,input,loadKnowledgeLibraries,signal);
 const date=localWeightDate(new Date());
 switch(name){
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
  case 'read_today_meals': return {ok:true,date,entries:data.nutritionJournal.entries.filter(row=>row.date===date),dayState:data.nutritionJournal.days[date]??null,note:'未记录不代表没有吃。'};
  default: throw Error('未知工具：'+name);
 }
}
