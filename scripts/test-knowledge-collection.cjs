const test=require('node:test'),assert=require('node:assert/strict');
const domain=()=>import('../src/knowledge/collection.mjs');
test('public builds include both approved text libraries without publishing private source folders',()=>{
 const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
 const publicSeed=JSON.parse(fs.readFileSync(path.join(root,'src/knowledge/referenceBundle.ts'),'utf8').split('export default ')[1].trim().replace(/;$/,''));
 assert.deepEqual(publicSeed.map(l=>l.id).sort(),['nutrition','prisoner']);
 assert.ok(publicSeed.every(l=>l.documents.length>0&&l.documents.every(note=>typeof note.markdown==='string'&&note.markdown.length>0)));
 const exclusions=fs.readFileSync(path.join(root,'.easignore'),'utf8');
 assert.ok(exclusions.includes('/src/knowledge/private/'));assert.ok(exclusions.includes('/knowledge/libraries/'));
 assert.ok(fs.readFileSync(path.join(root,'scripts/prepare-public-resources.cjs'),'utf8').includes("../referenceBundle"));
});
function adapter(){const map=new Map();let resets=0,fail=false;return {map,get resets(){return resets;},set fail(v){fail=v;},async resetLegacy(){resets++;},async readAll(){return structuredClone([...map.values()]);},async writeVault(v){if(fail)throw Error('disk');map.set(v.id,structuredClone(v));}};}
test('multiple libraries isolate identical note names and persist independent folders',async()=>{
 const {createKnowledgeStore,folderEntries}=await domain(),memory=adapter(),store=createKnowledgeStore(memory,[]);
 const training=await store.create('训练'),nutrition=await store.create('营养');
 await store.importNotes(training.id,[{path:'基础/介绍.md',markdown:'# 介绍\n俯卧撑'}]);
 await store.importNotes(nutrition.id,[{path:'基础/介绍.md',markdown:'# 介绍\n蛋白质\n![[image.jpeg]]'}]);
 const libraries=await store.list();assert.equal(libraries.length,2);assert.ok(libraries[0].documents[0].markdown.includes('俯卧撑'));assert.ok(libraries[1].documents[0].markdown.includes('蛋白质'));assert.ok(!libraries[1].documents[0].markdown.includes('.jpeg'));
 assert.deepEqual(folderEntries(libraries[0]),[{type:'folder',path:'基础',title:'基础',count:1}]);assert.equal(folderEntries(libraries[0],'基础')[0].type,'note');assert.equal(memory.resets,1);
});
test('duplicates and malformed import batches cannot partially overwrite existing notes',async()=>{
 const {createKnowledgeStore}=await domain(),memory=adapter(),store=createKnowledgeStore(memory,[]),library=await store.create('营养');
 await store.importNotes(library.id,[{path:'a.md',markdown:'原文'}]);
 await assert.rejects(store.importNotes(library.id,[{path:'b.md',markdown:'新增'},{path:'a.md',markdown:'覆盖'}]));
 await assert.rejects(store.importNotes(library.id,[{path:'../../escape.md',markdown:'x'}]));
 await assert.rejects(store.importNotes(library.id,[{path:'image.jpeg',markdown:'x'}]));
 await assert.rejects(store.create('营养'));assert.equal((await store.list())[0].documents.length,1);
 memory.fail=true;await assert.rejects(store.importNotes(library.id,[{path:'c.md',markdown:'新增'}]));memory.fail=false;
 await store.importNotes(library.id,[{path:'c.md',markdown:'新增'}]);assert.equal((await store.list())[0].documents.length,2);
});
test('a newly bundled note colliding with a personal addition keeps local content',async()=>{
 const {createKnowledgeStore}=await domain(),memory=adapter();
 const seed={id:'training',name:'训练',version:1,documents:[]};
 let store=createKnowledgeStore(memory,[seed]);await store.list();await store.importNotes(seed.id,[{path:'a.md',markdown:'用户正文'}]);
 store=createKnowledgeStore(memory,[{...seed,documents:[{path:'a.md',markdown:'不同种子'}]}]);assert.equal((await store.list())[0].documents[0].markdown,'用户正文');
});
