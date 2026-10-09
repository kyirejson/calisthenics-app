const test=require('node:test'),assert=require('node:assert/strict');
const fixtures=[{version:1,id:'training',name:'训练资料',documents:[{path:'第一册/俯卧撑.md',title:'俯卧撑',markdown:'# 俯卧撑\n原文'.repeat(10000)}]},{version:1,id:'nutrition',name:'营养知识',documents:[{path:'基础/蛋白质.md',title:'蛋白质',markdown:'# 蛋白质\n用户的营养资料'}]}];
test('model can enumerate libraries, browse folders, search and read complete original text',async()=>{
 const {executeKnowledgeTool,knowledgeTools}=await import('../src/knowledge/modelTools.mjs'),load=async()=>fixtures;
 assert.equal(knowledgeTools.length,4);assert.ok(knowledgeTools.every(t=>!/write|delete|update/.test(t.function.name)));
 const listed=await executeKnowledgeTool('list_knowledge_libraries',{},load);assert.equal(listed.libraries.length,2);assert.equal(listed.access,'read_only');assert.ok(!JSON.stringify(listed).includes('用户的营养资料'));
 const root=await executeKnowledgeTool('browse_knowledge_folder',{libraryId:'training'},load);assert.equal(root.entries[0].type,'folder');
 const directory=await executeKnowledgeTool('browse_knowledge_folder',{libraryId:'training',folder:'第一册'},load);assert.equal(directory.entries[0].path,'第一册/俯卧撑.md');
 const search=await executeKnowledgeTool('search_knowledge',{query:'营养资料'},load);assert.equal(search.results[0].libraryId,'nutrition');
 const scoped=await executeKnowledgeTool('search_knowledge',{query:'营养资料',libraryId:'training'},load);assert.equal(scoped.total,0);
 const note=await executeKnowledgeTool('read_knowledge_note',{libraryId:'training',path:'第一册/俯卧撑.md'},load);assert.equal(note.markdown,fixtures[0].documents[0].markdown);assert.equal(note.complete,true);
});
test('search exposes pagination and rejects nonexistent IDs instead of inventing sources',async()=>{
 const {executeKnowledgeTool}=await import('../src/knowledge/modelTools.mjs');
 const load=async()=>[{id:'many',name:'资料',version:1,documents:Array.from({length:25},(_,i)=>({path:i+'.md',title:'共同标题',markdown:'正文'}))}];
 const first=await executeKnowledgeTool('search_knowledge',{query:'共同'},load);assert.equal(first.total,25);assert.equal(first.results.length,20);assert.equal(first.nextOffset,20);
 const second=await executeKnowledgeTool('search_knowledge',{query:'共同',offset:first.nextOffset},load);assert.equal(second.results.length,5);assert.equal(second.nextOffset,null);
 await assert.rejects(executeKnowledgeTool('read_knowledge_note',{libraryId:'fake',path:'x.md'},load));await assert.rejects(executeKnowledgeTool('read_knowledge_note',{libraryId:'many',path:'../x.md'},load));
 await assert.rejects(executeKnowledgeTool('delete_knowledge',{},load));
 const controller=new AbortController();controller.abort();await assert.rejects(executeKnowledgeTool('list_knowledge_libraries',{},load,controller.signal));
});
