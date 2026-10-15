const test = require('node:test'), assert = require('node:assert/strict');
const load = () => import('../src/integrations/webTools.mjs');
test('public web tools do not access credentials, local addresses or arbitrary service ports', async () => {
  const { publicWebUrl } = await load();
  for (const url of ['file:///etc/passwd', 'http://127.0.0.1:8081/', 'http://2130706433/', 'http://0x7f000001/', 'http://[::1]/', 'https://u:pass@example.com', 'http://example.com:8081/', 'http://printer.local/', 'http://169.254.169.254/', 'http://192.168.1.2/']) assert.throws(() => publicWebUrl(url), undefined, url);
  assert.equal(publicWebUrl('https://example.com/path#section'), 'https://example.com/path');
});
test('search returns actual URLs and snippets, not simulated model knowledge', async () => {
  const { executeWebTool } = await load(); let requested;
  const result = await executeWebTool('search_web', { query: '语音判停 原理' }, async url => { requested = url; return { url, text: '<rss><channel><item><title>A &amp; B</title><link>https://example.com/a</link><description>真实摘要</description></item><item><title>private</title><link>http://127.0.0.1</link></item></channel></rss>' }; });
  assert.ok(requested.includes(encodeURIComponent('语音判停 原理'))); assert.equal(result.results.length, 1); assert.equal(result.results[0].title, 'A & B'); assert.equal(result.results[0].url, 'https://example.com/a');
});
test('long pages are readable in complete pages with honest nextOffset', async () => {
  const { executeWebTool } = await load(); const source = '长文内容'.repeat(10000);
  const request = async url => ({ url, contentType: 'text/html', text: `<html><title>来源</title><script>不要执行</script><main><p>${source}</p></main></html>` });
  let offset = 0, text = '';
  do { const result = await executeWebTool('read_web_page', { url: 'https://example.com/', offset }, request); assert.equal(result.title, '来源'); text += result.text; offset = result.nextOffset; } while (offset !== null);
  assert.equal(text, source); assert.ok(!text.includes('不要执行'));
});
test('search failure and cancellation are errors, never fabricated results', async () => {
  const { executeWebTool } = await load();
  await assert.rejects(executeWebTool('search_web', { query: 'test' }, async () => ({ text: '<html>challenge</html>' })), /没有返回/);
  const controller = new AbortController(); controller.abort(); let called = false;
  await assert.rejects(executeWebTool('read_web_page', { url: 'https://example.com' }, async () => { called = true; }, controller.signal), /取消/); assert.equal(called, false);
});
