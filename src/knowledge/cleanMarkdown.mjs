/** Text-only import. Keep note links and prose, remove image markup and empty image rows. */
export function cleanMarkdown(markdown) {
 const stripped=markdown
  .replace(/!?\[\[([^\]]+)\]\]/g,(match,target)=>/\.(?:jpe?g|png|gif|webp|svg|bmp|avif)(?:[#|].*)?$/i.test(target)?'':match)
  .replace(/!\[[^\]\n]*\]\((?:[^()\n]|\((?:[^()\n]|\([^()\n]*\))*\))*\)/g,'')
  .replace(/\[[^\]\n]*\]\\?\(([^\n]*?\.(?:jpe?g|png|gif|webp|svg|bmp|avif)(?:[?#][^\n)]*)?)\)/gi,'')
  .replace(/<img\b[^>]*>/gi,'')
  .replace(/^[\t ]*\|(?:[\t ]*\|)+[\t ]*\r?$/gm,'')
  .replace(/(?:\r?\n){3,}/g,'\n\n');
 const lines=[];
 for(const line of stripped.split(/\r?\n/)){
  if(/^\s*\|[\s|:-]+\|\s*$/.test(line)&&!lines.at(-1)?.trim().startsWith('|'))continue;
  lines.push(line);
 }
 return lines.join('\n').replace(/\n{3,}/g,'\n\n');
}
