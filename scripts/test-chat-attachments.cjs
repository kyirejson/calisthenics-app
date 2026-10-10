const { readFeature } = require('./lib/project-features.cjs');
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const fixtures = require('./chat-file-fixtures.cjs'), { strToU8, zipSync } = require('fflate');
const core = import('../src/integrations/chatAttachments.mjs');
test('chat text attachments preserve Chinese, Markdown and UTF-16 without adding instructions', async () => {
  const { extractText, attachmentMessage } = await core;
  assert.equal(extractText(strToU8('\uFEFF# 食物\n豆腐 & 鸡蛋'), 'md'), '# 食物\n豆腐 & 鸡蛋');
  assert.equal(extractText(Buffer.concat([Buffer.from([255, 254]), Buffer.from('中文正文', 'utf16le')]), 'txt'), '中文正文');
  assert.deepEqual(attachmentMessage({ role: 'user', content: '普通对话' }), { role: 'user', content: '普通对话' });
  const wire = attachmentMessage({ role: 'user', content: '帮我看看', attachments: [{ name: '资料.md', text: '# 原文' }], toolsUsed: ['not a wire property'] });
  assert.deepEqual(Object.keys(wire), ['role', 'content']);
  assert.equal(wire.content, '帮我看看\n\n【附件：资料.md】\n# 原文\n【附件结束】');
});
test('DOCX reads body text and escapes, ignores embedded pictures, preserves paragraph boundaries', async () => {
  const { extractText } = await core;
  assert.equal(extractText(fixtures.docx(), 'docx'), '附件测试：豆腐 & 鸡蛋\n第二段：保留原文。');
  assert.equal(extractText(fixtures.docx('文字 < 字符'), 'docx'), '文字 < 字符\n第二段：保留原文。');
  assert.throws(() => extractText(zipSync({ 'word/media/image.png': new Uint8Array([1]) }), 'docx'), /没有可读取的正文/);
  assert.throws(() => extractText(new Uint8Array([1, 2, 3]), 'docx'));
});
test('attachments fail explicitly on unsupported, empty, oversize or unreadable data, never truncate', async () => {
  const { attachmentKind, extractText, checkedText, MAX_TEXT_CHARS, MAX_FILE_BYTES, fileSize } = await core;
  assert.equal(attachmentKind('中文.DOCX'), 'docx');
  assert.throws(() => attachmentKind('照片.jpg'), /请选择/);
  assert.throws(() => extractText(new Uint8Array(), 'txt'), /未提取/);
  assert.throws(() => extractText(new Uint8Array(MAX_FILE_BYTES + 1), 'txt'), /32 MB/);
  assert.throws(() => checkedText('a'.repeat(MAX_TEXT_CHARS + 1)), /没有截断/);
  assert.throws(() => extractText(new Uint8Array([65, 0, 66]), 'txt'), /UTF-8/);
  assert.equal(fileSize(2048), '2 KB');
});
test('local PDF worker matches installed version and PDF text is actual selectable content', async () => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(fixtures.pdf()), standardFontDataUrl: path.join(__dirname, '../node_modules/pdfjs-dist/standard_fonts').replaceAll('\\', '/') + '/' });
  try {
    const pdf = await task.promise, page = await pdf.getPage(1), text = await page.getTextContent();
    assert.ok(text.items.some(item => item.str === 'Actual PDF attachment text'));
  } finally { await task.destroy(); }
  assert.equal(fs.readFileSync(path.join(__dirname, '../public/chat-pdf/pdf.worker.min.mjs')).equals(fs.readFileSync(path.join(__dirname, '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'))), true);
});
test('UI upload path leaves personal tools, model, storage and system prompt unchanged', () => {
  const ui = readFeature('chat');
  assert.match(ui, /messages: messages\.map\(attachmentMessage\)/);
  assert.match(ui, /setDraft\(''\);\s*setFiles\(\[\]\)/);
  assert.doesNotMatch(ui, /专属体能与营养私教|Flash 1M|正在思考并检索数据/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../src/integrations/chatAttachments.mjs'), 'utf8'), /localStorage|update_memory|writeMemory/);
});

test('mobile chat redesign keeps real controls, bounded multiline input and no format footer', () => {
  const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const composer = read('src/features/chat/ChatComposer.tsx');
  assert.match(composer, /submitBehavior="newline" blurOnSubmit=\{false\}/);
  assert.match(composer, /fontSize|s\.input/);
  assert.match(composer, /onContentSizeChange/);
  assert.match(composer, /node\.style\.height = '0px'/);
  assert.match(composer, /Math\.min\(132, height \* \.25\)/);
  assert.match(composer, /keyboardShouldPersistTaps="handled"/);
  assert.match(composer, /busy \? stop : send/);
  assert.doesNotMatch(composer, /onSubmitEditing|支持 PDF|DOCX|TXT|update_memory|personalChat/);
  const modal = read('src/integrations/DeepseekChat.tsx');
  assert.match(modal, /<ChatComposer/);
  assert.match(modal, /behavior=\{Platform\.OS === 'ios' \? 'padding' : Platform\.OS === 'android' \? 'height' : undefined\}/);
  assert.match(read('android/app/src/main/AndroidManifest.xml'), /windowSoftInputMode="adjustResize"/);
  assert.doesNotMatch(modal, /s\.formats|s\.format\}|TextInput/);
  assert.match(read('src/features/chat/styles.ts'), /fontSize: 16/);
});
