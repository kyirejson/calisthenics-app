const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:id=>{if(id in mocks)return mocks[id];throw Error(id);}});return module.exports;}
test('memory exact edits, stale versions, cancellation and failed writes',async()=>{
 let value='香菜\n工作',fail=false;
 const {editMemory}=load('src/memory/operations.ts',{'./storage':{readMemory:async()=>value,writeMemory:async v=>{if(fail)throw Error('disk');value=v;}}});
 await editMemory({expectedMarkdown:value,oldText:'香菜',newText:'猪肉'});assert.equal(value,'猪肉\n工作');
 const original=value;const results=await Promise.allSettled([editMemory({expectedMarkdown:original,oldText:'',newText:'1'}),editMemory({expectedMarkdown:original,oldText:'',newText:'2'})]);assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');
 await assert.rejects(editMemory({expectedMarkdown:value,oldText:'不存在',newText:''}));
 const controller=new AbortController();controller.abort();await assert.rejects(editMemory({expectedMarkdown:value,oldText:'',newText:'X'},controller.signal));
 fail=true;await assert.rejects(editMemory({expectedMarkdown:value,oldText:'',newText:'X'}));fail=false;
 await editMemory({expectedMarkdown:value,oldText:'',newText:'$&'});assert.equal(value,'猪肉\n工作1$&');
});
test('profile edits preserve model notes and multiline fields',()=>{
 const {profileMarkdown,mergeProfileMemory}=load('src/memory/profileMemory.ts',{'../domain/weight/weightTrend':{localWeightDate:()=> '2026-10-06'}});
 const profile={sex:'male',age:30,height:175,weight:75,personalDetails:{work:'办公室\n久坐'}};
 const current=profileMarkdown(profile)+'\n称呼：司令';
 assert.equal(mergeProfileMemory(current,profile,profile),current);
 const result=mergeProfileMemory(current,{...profile,personalDetails:{work:'户外\n轮班'}},profile);
 assert.ok(result.includes('- 工作：户外\n  轮班'));assert.ok(result.includes('称呼：司令'));assert.ok(!result.includes('久坐'));
});
test('missing memory initializes once without overwriting empty or existing files',async()=>{
 let value=null,writes=0;
 const {readOrInitializeMemory}=load('src/memory/operations.ts',{'./storage':{readMemory:async()=>value,writeMemory:async v=>{value=v;writes++;}}});
 assert.equal(await readOrInitializeMemory(null),null);assert.equal(writes,0);
 await Promise.all([readOrInitializeMemory('档案'),readOrInitializeMemory('另一个档案')]);assert.equal(value,'档案');assert.equal(writes,1);
 value='用户记忆';assert.equal(await readOrInitializeMemory('档案'),'用户记忆');
 value='';assert.equal(await readOrInitializeMemory('档案'),'');assert.equal(writes,1);
});
test('tool loop supplies actual results and errors to model before final answer',async()=>{
 const {personalChat}=await import('../src/integrations/personalTools.mjs');let round=0;
 const output=await personalChat({memory:'称呼：司令',date:'2026-10-06',messages:[{role:'user',content:'看看今天'}],execute:async(name)=>{if(name==='bad')throw Error('失败');return {ok:true,entries:[]};},client:{generate:async(messages,options)=>{
  assert.equal(options.tools.length,9);
  if(round++===0)return {role:'assistant',content:null,tool_calls:[{id:'a',type:'function',function:{name:'read_today_meals',arguments:'{}'}},{id:'b',type:'function',function:{name:'bad',arguments:'{}'}}]};
  assert.equal(JSON.parse(messages.at(-2).content).ok,true);assert.equal(JSON.parse(messages.at(-1).content).ok,false);return {content:'没有饮食记录。'};
 }}});assert.equal(output,'没有饮食记录。');
});
