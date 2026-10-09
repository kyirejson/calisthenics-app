const assert = require('node:assert/strict'), ts = require('typescript');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const { emptyNutritionJournal } = require('../src/nutrition/engine.ts');
const { food } = require('./fixtures/user-food.cjs');
const { waitForNutritionPage } = require('./nutrition-smoke-utils.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try { for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900}}), page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({journal,food})=>{if(localStorage.getItem('nutrition-qa'))return;localStorage.setItem('nutrition-qa','1');localStorage.setItem('user_profile',JSON.stringify({name:'QA',age:30,sex:'male',height:175,weight:75,goal:'equipment',frequency:6,equipmentSplit:'ppl',experience:'advanced',levels:{},planStartedAt:new Date().toISOString(),planId:'equipment_training_v2'}));localStorage.setItem('nutrition_journal_v1',JSON.stringify({...journal,customFoods:[food]}));},{journal:emptyNutritionJournal(),food});
  await page.goto('http://127.0.0.1:8081/');
  const enter=async()=>{await page.getByRole('tab',{name:'切换到饮食',exact:true}).click();await waitForNutritionPage(page);};
  await enter();
  for (const name of ['拍照记餐','管理当日饮食记录','添加饮食记录']) assert.equal(await page.getByRole('button',{name,exact:true}).count(),0);
  await page.getByText('暂无饮食记录',{exact:true}).waitFor();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('nutrition_journal_v1')));
  await page.reload();await enter();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('nutrition_journal_v1')).entries),stored.entries);assert.deepEqual(errors,[]);console.log('PASS read-only nutrition',width);await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
