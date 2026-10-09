import { useRef, useState } from 'react';
import { Modal, Platform, KeyboardAvoidingView, ScrollView, Text, TextInput, View, Pressable, StyleSheet, Share } from 'react-native';
import { useAppStore } from '../store/AppStore';
import { normalizeProfile } from '../store/profile';
import { emptyPersonalDetails, mergeProfileMemory } from '../memory/profileMemory';
import { readMemory } from '../memory/storage';
import { editMemory } from '../memory/operations';
import { trainingGoals } from '../data/trainingGoals';
import { recordWeight, localWeightDate } from '../domain/weight/weightTrend';
import type { Goal, Profile } from '../types';
import { appPalette as p } from '../theme';
export function PersonalProfileForm({ onClose }: { onClose: () => void }) {
 const { profile, saveProfile, patchProfile } = useAppStore(state => ({ profile: state.profile, saveProfile: state.saveProfile, patchProfile: state.patchProfile }));
 const [name,setName]=useState(profile?.name??'');
 const [sex,setSex]=useState(profile?.sex??'unspecified');
 const [age,setAge]=useState(profile?.age?String(profile.age):'');
 const [height,setHeight]=useState(profile?.height?String(profile.height):'');
 const [weight,setWeight]=useState(()=>{const latest=[...(profile?.weightHistory??[])].filter(item=>item.date<=localWeightDate(new Date())).sort((a,b)=>b.date.localeCompare(a.date))[0];return latest?String(latest.kg):profile?.weight?String(profile.weight):'';});
 const [goal,setGoal]=useState<Goal|undefined>(profile?.goal);
 const [details,setDetails]=useState({...emptyPersonalDetails,...profile?.personalDetails});
 const initial=useRef({name,sex,age,height,weight,details});
 const saving=useRef(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const field=(label:string,value:string,onChangeText:(value:string)=>void,numeric=false)=><View key={label}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} editable={!busy} keyboardType={numeric?'decimal-pad':'default'} multiline={!numeric} placeholder="选填" placeholderTextColor={p.muted} style={s.input}/></View>;
 const save=async()=>{
  if(saving.current)return;setError('');
  for(const [label,value,min,max] of [['年龄',age,1,100],['身高',height,50,250],['体重',weight,10,500]] as const)if(value.trim()&&(!Number.isFinite(Number(value))||Number(value)<min||Number(value)>max||(label==='年龄'&&!Number.isInteger(Number(value))))){setError('请核对'+label+'。');return;}
  if(!goal){setError('请选择训练专题。');return;}
  saving.current=true;setBusy(true);
  try {
   const patch:Partial<Profile>={};
   if(name!==initial.current.name)patch.name=name.trim()||'训练者';
   if(sex!==initial.current.sex)patch.sex=sex;
   if(age!==initial.current.age)patch.age=Number(age);
   if(height!==initial.current.height)patch.height=Number(height);
   if(weight!==initial.current.weight)patch.weight=Number(weight);
   const detailChanges=Object.fromEntries(Object.entries(details).filter(([key,value])=>value!==initial.current.details[key as keyof typeof details]));
   const next=normalizeProfile({...profile,name:name.trim()||'训练者',sex,age:Number(age),height:Number(height),weight:Number(weight),...(weight.trim()&&(!profile||patch.weight!==undefined)?{weightHistory:recordWeight(profile?.weightHistory,Number(weight))}:{}),goal,personalDetails:details});
   const previous=await readMemory();
   const markdown=mergeProfileMemory(previous,next,profile);
   await editMemory({expectedMarkdown:previous??'',oldText:previous??'',newText:markdown});
   try {
    if(profile)await patchProfile(current=>({...patch,...(patch.weight!==undefined&&weight.trim()?{weightHistory:recordWeight(current.weightHistory,Number(weight))}:{}),...(Object.keys(detailChanges).length?{personalDetails:{...emptyPersonalDetails,...current.personalDetails,...detailChanges}}:{})}));
    else await saveProfile(next);
   } catch(reason){await editMemory({expectedMarkdown:markdown,oldText:markdown,newText:previous??''});throw reason;}
   onClose();
  }catch(reason){setError(reason instanceof Error?reason.message:'保存失败，请重试。');}finally{saving.current=false;setBusy(false);}
 };
 return <Modal visible transparent animationType="slide" onRequestClose={()=>{if(!busy)onClose();}}><KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS==='ios'?'padding':'height'}><View style={s.panel}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
  <Text style={s.title}>个人档案</Text><Text style={s.label}>按实际情况填写，未知信息可以留空。</Text>
  {field('称呼',name,setName)}<Text style={s.label}>性别</Text><View style={s.row}>{(['male','female','unspecified'] as const).map(value=><Pressable key={value} disabled={busy} accessibilityRole="radio" accessibilityState={{checked:sex===value}} onPress={()=>setSex(value)} style={[s.chip,sex===value&&s.selected]}><Text style={s.label}>{value==='male'?'男性':value==='female'?'女性':'未填写'}</Text></Pressable>)}</View>
  {field('年龄',age,setAge,true)}{field('身高 cm',height,setHeight,true)}{field('当前体重 kg',weight,setWeight,true)}{field('健身目标',details.fitnessGoal,v=>setDetails(d=>({...d,fitnessGoal:v})))}
  <Text style={s.label}>训练专题</Text>{profile?<Text style={s.label}>{trainingGoals.find(item=>item.key===goal)?.label}（更换请使用训练专题切换入口）</Text>:<View style={s.row}>{trainingGoals.map(item=><Pressable key={item.key} disabled={busy} accessibilityRole="radio" accessibilityState={{checked:goal===item.key}} onPress={()=>setGoal(item.key)} style={[s.chip,goal===item.key&&s.selected]}><Text style={s.label}>{item.label}</Text></Pressable>)}</View>}
  {([['diningScene','核心就餐场景'],['mealPreference','就餐餐次偏好'],['digestion','肠胃耐受'],['allergies','过敏'],['work','工作']] as const).map(([key,label])=>field(label,details[key],v=>setDetails(d=>({...d,[key]:v}))))}
  {error?<Text accessibilityRole="alert" style={{color:p.danger}}>{error}</Text>:null}
  {profile?<Pressable accessibilityRole="button" disabled={busy} onPress={()=>{void readMemory().then(async text=>{if(!text)throw new Error('尚未保存记忆文件');if(Platform.OS==='web'){const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='MEMORY.md';link.click();URL.revokeObjectURL(url);}else await Share.share({title:'MEMORY.md',message:text});}).catch(reason=>setError(reason instanceof Error?reason.message:'导出失败'));}} style={s.chip}><Text style={s.label}>导出 MEMORY.md</Text></Pressable>:null}
  <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void save()} style={[s.chip,s.selected]}><Text style={s.title}>{busy?'保存中…':'保存个人档案'}</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={s.chip}><Text style={s.label}>取消</Text></Pressable>
 </ScrollView></View></KeyboardAvoidingView></Modal>;
}
const s=StyleSheet.create({backdrop:{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:16},panel:{maxHeight:'90%',width:'100%',maxWidth:600,alignSelf:'center',backgroundColor:p.background,borderRadius:20},content:{padding:20,gap:12},title:{color:p.text,fontSize:20,fontWeight:'800'},label:{color:p.text,fontSize:14,lineHeight:22},input:{color:p.text,borderColor:p.border,borderWidth:1,borderRadius:12,padding:12,minHeight:48},row:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{padding:12,borderRadius:12,borderWidth:1,borderColor:p.border,alignItems:'center'},selected:{backgroundColor:p.olive,borderColor:p.lime}});
