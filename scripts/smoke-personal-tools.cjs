const assert=require('node:assert/strict');const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();let round=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>{localStorage.setItem('profile-invitation-seen','1');if(!localStorage.getItem('personal-memory/MEMORY.md'))localStorage.setItem('personal-memory/MEMORY.md','# 个人记忆\n工作：夜班\n');});
  const call=(id,name,args)=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
  await context.route('https://api.deepseek.com/**',async route=>{
   const body=route.request().postDataJSON();let message,finish_reason='stop';
   if(body.response_format)message={role:'assistant',content:'{"ok":true}'};
   else if(round++===0){finish_reason='tool_calls';message={role:'assistant',content:null,tool_calls:['read_memory','read_today_training','read_recent_weight','read_today_meals'].map((name,i)=>call('read'+i,name,{}))};}
   else if(round===2){const results=body.messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content));assert.equal(results.length,4);assert.equal(results[0].markdown,'# 个人记忆\n工作：夜班\n');assert.equal(results[1].plan,null);assert.equal(results[2].profileWeight,null);assert.deepEqual(results[3].entries,[]);finish_reason='tool_calls';message={role:'assistant',content:null,tool_calls:[call('edit','update_memory',{expectedMarkdown:results[0].markdown,oldText:'',newText:'称呼：司令\n'})]};}
   else if(round===3){assert.equal(JSON.parse(body.messages.at(-1).content).ok,true);message={role:'assistant',content:'已记住，司令。'};}
   else {assert.ok(body.messages[0].content.includes('称呼：法卿'));message={role:'assistant',content:'你好，法卿。'};}
   return route.fulfill({json:{choices:[{finish_reason,message}]}});
  });
  await page.goto('http://127.0.0.1:8081/');await page.getByRole('button',{name:'打开 MAX 聊天',exact:true}).click();await page.getByRole('button',{name:'打开服务设置',exact:true}).click();await page.getByLabel('个人 DeepSeek 密钥',{exact:true}).fill('sk-isolated-memory');await page.getByRole('button',{name:'保存并连接',exact:true}).click();await page.getByText('已连接',{exact:true}).waitFor();await page.getByRole('button',{name:'关闭服务设置',exact:true}).click();
  await page.getByLabel('聊天输入',{exact:true}).fill('记住叫我司令，看看今天');await page.getByRole('button',{name:'发送聊天消息',exact:true}).click();await page.getByText('已记住，司令。',{exact:true}).waitFor();
  assert.ok((await page.evaluate(()=>localStorage.getItem('personal-memory/MEMORY.md'))).includes('称呼：司令'));
  await page.getByRole('button',{name:'查看个人记忆',exact:true}).click();const editor=page.getByLabel('个人记忆 Markdown',{exact:true});await page.waitForFunction(()=>document.querySelector('[aria-label="个人记忆 Markdown"]')?.value.includes('称呼：司令'));await editor.click();await editor.fill('# 个人记忆\n工作：夜班\n称呼：法卿\n');await page.getByRole('button',{name:'保存记忆',exact:true}).click();await editor.waitFor({state:'hidden'});
  await page.getByLabel('聊天输入',{exact:true}).fill('我叫什么');await page.getByRole('button',{name:'发送聊天消息',exact:true}).click();await page.getByText('你好，法卿。',{exact:true}).waitFor();assert.deepEqual(errors,[]);console.log('PASS personal tools and manual memory',width);await context.close();
 }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
