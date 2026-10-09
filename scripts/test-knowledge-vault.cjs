const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const domain=()=>import('../src/knowledge/vault.mjs');
const fixture={version:1,id:'test',name:'test',documents:[
 {path:'目录.md',title:'目录',markdown:'# 导航\n[[训练/动作|动作]]\n'},
 {path:'训练/动作.md',title:'俯卧撑',markdown:'# 俯卧撑\n肩部和胸部\n[[../目录.md]]\n![[attachments/image.jpeg]]\n'},
 {path:'训练/其他.md',title:'其他',markdown:'腿部练习'}
]};
test('vault resolves aliases, relative paths, headings and rejects external paths',async()=>{
 const {resolveLink,normalizedPath}=await domain();
 assert.equal(resolveLink(fixture,'目录.md','训练/动作#俯卧撑|动作').path,'训练/动作.md');
 assert.equal(resolveLink(fixture,'训练/动作.md','../目录.md').path,'目录.md');
 assert.equal(resolveLink(fixture,'目录.md','%E8%AE%AD%E7%BB%83/%E5%8A%A8%E4%BD%9C.md').path,'训练/动作.md');
 assert.equal(resolveLink(fixture,'目录.md','../../目录.md'),null);
 assert.equal(resolveLink(fixture,'目录.md','https://example.com'),null);
 assert.throws(()=>normalizedPath('C:/test'));assert.throws(()=>normalizedPath('../test'));
});
test('vault indexes headings, backlinks and text search without fabricating matches',async()=>{
 const {indexVault,searchNotes,noteLinks}=await domain(),indexed=indexVault(fixture);
 assert.equal(indexed[1].backlinks[0].path,'目录.md');assert.equal(indexed[0].backlinks[0].path,'训练/动作.md');
 assert.deepEqual(indexed[1].headings,['俯卧撑']);assert.equal(searchNotes(indexed,'肩部')[0].document.path,'训练/动作.md');assert.equal(searchNotes(indexed,'胸部 腿部').length,0);
 assert.equal(noteLinks('[动作](训练/动作(一).md)\n')[0].target,'训练/动作(一).md');assert.equal(noteLinks('![[image.jpeg]]')[0].embed,true);
});
test('local imported Markdown matches cleaned source and contains no pictures or references',async()=>{
 const {cleanMarkdown}=await import('../src/knowledge/cleanMarkdown.mjs');
 const root=path.resolve(__dirname,'../knowledge/libraries/prisoner');if(!fs.existsSync(root)){return;}
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'library.json')));
 assert.equal(manifest.documents.length,69);assert.ok(manifest.documents.every(note=>!note.path.startsWith('产品设计/')));
 for(const note of manifest.documents){const copied=fs.readFileSync(path.join(root,note.path));assert.equal(crypto.createHash('sha256').update(copied).digest('hex'),note.sha256);assert.ok(!/!\[|<img\b/i.test(copied.toString()));const original=path.resolve(__dirname,'../../001号/囚徒健身全集',note.path);if(fs.existsSync(original)){const content=fs.readFileSync(original);assert.equal(crypto.createHash('sha256').update(content).digest('hex'),note.sourceSha256);assert.equal(copied.toString(),cleanMarkdown(content.toString()));}}
 const walk=folder=>fs.readdirSync(folder,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(folder,entry.name)):[entry.name]);assert.equal(walk(root).filter(name=>/\.(jpeg|jpg|png|html)$/i.test(name)).length,0);
});
test('text cleanup preserves prose and note links and is idempotent',async()=>{
 const {cleanMarkdown}=await import('../src/knowledge/cleanMarkdown.mjs');
 const result=cleanMarkdown('正文\n\n![[image.jpeg|300]]\n\n| ![[a.jpeg]] | ![[b.jpeg]] |\n\n![插图](attachments/image(1).jpeg)\n<img src="image.jpeg">\n[图片](image.jpeg)\n[[训练/动作#标题|动作]]\n[章节](note.md)');
 assert.ok(result.includes('正文'));assert.ok(result.includes('[[训练/动作#标题|动作]]'));assert.ok(result.includes('[章节](note.md)'));assert.ok(!result.includes('.jpeg'));assert.equal(cleanMarkdown(result),result);
});
