import { readMemory, writeMemory } from './storage';
let queue: Promise<unknown> = Promise.resolve();
/** Only missing files are initialized. An intentionally empty file stays empty. */
export function readOrInitializeMemory(initial: string | null): Promise<string | null> {
 const operation=queue.then(async()=>{
  const current=await readMemory();
  if(current!==null||initial===null)return current;
  await writeMemory(initial);
  return initial;
 });
 queue=operation.catch(()=>{});return operation;
}
export function editMemory(input: { expectedMarkdown: string; oldText: string; newText: string }, signal?: AbortSignal): Promise<{ ok: true; markdown: string }> {
 const operation = queue.then(async () => {
  if (signal?.aborted) throw Error('请求已取消。');
  if (!input || !['expectedMarkdown','oldText','newText'].every(key=>typeof input[key as keyof typeof input]==='string')) throw Error('记忆修改参数无效。');
  const current = await readMemory() ?? '';
  if (current !== input.expectedMarkdown) throw Error('记忆已更新，请重新读取后修改。');
  if (input.oldText && (current.indexOf(input.oldText)<0 || current.indexOf(input.oldText)!==current.lastIndexOf(input.oldText))) throw Error('待修改文本不存在或不唯一，请使用更完整的原文。');
  const markdown = input.oldText ? current.replace(input.oldText,()=>input.newText) : current + input.newText;
  if (signal?.aborted) throw Error('请求已取消。');
  await writeMemory(markdown);
  return { ok: true as const, markdown };
 });
 queue=operation.catch(()=>{});return operation;
}
