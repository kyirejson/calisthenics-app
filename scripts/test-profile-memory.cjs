const {test}=require('node:test'), assert=require('node:assert/strict'), ts=require('typescript');
require('./lib/register-typescript.cjs')({ compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}, extensions: ['.ts'] });
const {profileMarkdown,emptyPersonalDetails}=require('../src/memory/profileMemory.ts');
const {normalizeProfile}=require('../src/store/profile.ts');
test('personal profile roundtrip retains the six free-text memory fields',()=>{
 const details={diningScene:'食堂',mealPreference:'两餐',digestion:'牛奶不耐受',allergies:'花生、鸡蛋',work:'夜班',fitnessGoal:'增肌'};
 const profile=normalizeProfile({name:'测试',sex:'male',age:30,height:175,weight:75,goal:'equipment',personalDetails:details});
 assert.deepEqual(normalizeProfile(JSON.parse(JSON.stringify(profile))).personalDetails,details);
 for(const text of Object.values(details))assert.ok(profileMarkdown(profile).includes(text));
});
test('missing body information stays unknown rather than fabricated onboarding defaults',()=>{
 const profile=normalizeProfile({goal:'equipment',personalDetails:emptyPersonalDetails});
 const md=profileMarkdown(profile);assert.ok(md.includes('性别：未填写'));assert.ok(md.includes('年龄：未填写'));assert.ok(md.includes('当前体重：未填写'));assert.ok(!md.includes('175 cm'));
});
test('current weight ignores future measurements and uses the latest real record',()=>{
 const profile=normalizeProfile({goal:'equipment',weight:75,weightHistory:[{date:'2026-01-01',kg:74},{date:'2026-02-01',kg:73},{date:'2099-01-01',kg:90}]});
 assert.ok(profileMarkdown(profile).includes('73 kg（2026-02-01）'));
});
