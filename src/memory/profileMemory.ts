import type { Profile } from '../types';
import { localWeightDate } from '../domain/weight/weightTrend';
export type PersonalDetails = { diningScene: string; mealPreference: string; digestion: string; allergies: string; work: string; fitnessGoal: string };
export const emptyPersonalDetails: PersonalDetails = { diningScene: '', mealPreference: '', digestion: '', allergies: '', work: '', fitnessGoal: '' };
export function profileMarkdown(profile: Profile): string {
  const details = { ...emptyPersonalDetails, ...profile.personalDetails };
  const latest = [...(profile.weightHistory ?? [])].filter(item=>item.date<=localWeightDate(new Date())).sort((a,b) => b.date.localeCompare(a.date))[0];
  const text = (value: string) => value.trim().replace(/\r?\n/g, '\n  ') || '未填写';
  return `# 个人记忆\n\n## 身体与健身\n- 性别：${profile.sex === 'male' ? '男性' : profile.sex === 'female' ? '女性' : '未填写'}\n- 年龄：${profile.age || '未填写'}\n- 身高：${profile.height ? profile.height + ' cm' : '未填写'}\n- 当前体重：${latest ? latest.kg + ' kg（' + latest.date + '）' : profile.weight ? profile.weight + ' kg' : '未填写'}\n- 健身目标：${text(details.fitnessGoal)}\n\n## 就餐习惯\n- 核心就餐场景：${text(details.diningScene)}\n- 就餐餐次偏好：${text(details.mealPreference)}\n\n## 身体与饮食\n- 肠胃耐受：${text(details.digestion)}\n- 过敏：${text(details.allergies)}\n\n## 工作\n- 工作：${text(details.work)}\n\n来源：App 个人档案，由用户填写。\n`;
}
/** Update only fields the user changed; retain model-added notes and unrelated facts. */
export function mergeProfileMemory(current: string | null, next: Profile, previous: Profile | null): string {
 const generated=profileMarkdown(next);
 if(current===null||!current.trim())return generated;
 const blocks=(text:string)=>text.match(/^- [^\n]+(?:\n  [^\n]*)*/gm)??[];
 const before=blocks(previous?profileMarkdown(previous):'');
 let result=current;
 for(const line of blocks(generated)){
  const key=line.slice(0,line.indexOf('：')+1);
  if(before.find(row=>row.startsWith(key))===line)continue;
  const start=result.startsWith(key)?0:result.indexOf('\n'+key)+1;
  if(start===0&&!result.startsWith(key)){result+='\n'+line;continue;}
  let end=result.indexOf('\n',start);if(end<0)end=result.length;
  while(result.slice(end+1).startsWith('  ')){const following=result.indexOf('\n',end+1);end=following<0?result.length:following;}
  result=result.slice(0,start)+line+result.slice(end);
 }
 return result;
}
