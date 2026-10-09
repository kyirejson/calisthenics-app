import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { indexVault } from '../src/knowledge/vault.mjs';
import { cleanMarkdown } from '../src/knowledge/cleanMarkdown.mjs';
import { validateLibraryId } from '../src/knowledge/collection.mjs';
import { writeKnowledgeBundles } from './lib/knowledge/bundle-writer.mjs';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const collectionRoot=path.join(project,'knowledge','libraries');
const args=process.argv.slice(2);
if(args.length!==0&&args.length!==3)throw Error('用法：knowledge:import -- 源目录 资料库ID 资料库名称');
const specs=args.length?[{source:args[0],id:args[1],name:args[2],exclude:[]}]:JSON.parse(fs.readFileSync(path.join(project,'knowledge','sources.local.json'),'utf8'));
if(!Array.isArray(specs)||!specs.length)throw Error('请配置至少一个资料库');
for(const spec of specs){
 validateLibraryId(spec.id);
 if(typeof spec.name!=='string'||!spec.name.trim())throw Error('资料库名称不能为空');
 const source=path.resolve(spec.source),destination=path.join(collectionRoot,spec.id);
 if(!fs.statSync(source).isDirectory()||source===destination||source.startsWith(collectionRoot+path.sep))throw Error('源目录无效');
 const files=[];
 function walk(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  const absolute=path.join(folder,entry.name),relative=path.relative(source,absolute).replace(/\\/g,'/');
  if(entry.name==='.obsidian'||(spec.exclude??[]).some(prefix=>relative===prefix||relative.startsWith(prefix+'/')))continue;
  if(entry.isSymbolicLink())throw Error('不导入符号链接');
  if(entry.isDirectory())walk(absolute);else if(entry.name.endsWith('.md'))files.push(absolute);
 }}
 walk(source);
 const documents=files.map(absolute=>{
  const original=fs.readFileSync(absolute),relative=path.relative(source,absolute).replace(/\\/g,'/'),markdown=cleanMarkdown(original.toString('utf8'));
  return {path:relative,title:/^#\s+(.+)$/m.exec(markdown)?.[1].trim()??path.basename(relative,'.md'),kind:'reference',sha256:createHash('sha256').update(markdown).digest('hex'),sourceSha256:createHash('sha256').update(original).digest('hex'),markdown};
 });
 if(!documents.length)throw Error('源目录没有 Markdown，未写入：'+spec.name);
 const library={version:1,id:spec.id,name:spec.name,documents};
 for(const note of documents){const target=path.join(destination,note.path);fs.mkdirSync(path.dirname(target),{recursive:true});if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==note.markdown)fs.writeFileSync(target,note.markdown);}
 const indexed=indexVault(library),unresolvedLinks=indexed.flatMap(note=>note.links.filter(link=>!link.resolved).map(link=>({from:note.path,target:link.target})));
 fs.writeFileSync(path.join(destination,'library.json'),JSON.stringify({...library,documents:documents.map(({markdown,...note})=>note),unresolvedLinks},null,2));
 console.log(JSON.stringify({id:spec.id,name:spec.name,documents:documents.length,bytes:documents.reduce((n,d)=>n+Buffer.byteLength(d.markdown),0),unresolvedLinks:unresolvedLinks.length}));
}
const libraries=fs.readdirSync(collectionRoot,{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>{
 const folder=path.join(collectionRoot,entry.name),metadata=JSON.parse(fs.readFileSync(path.join(folder,'library.json'),'utf8'));
 return {version:1,id:metadata.id,name:metadata.name,documents:metadata.documents.map(note=>({...note,markdown:fs.readFileSync(path.join(folder,note.path),'utf8')}))};
});
console.log(JSON.stringify(writeKnowledgeBundles(project,libraries)));
