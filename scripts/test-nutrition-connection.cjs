const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const file = path.resolve(__dirname, '../src/nutrition/agentClient.ts');
function client(fetchImpl, url) {
  const result = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: result, require: id => id === 'react-native' ? { Platform: { OS: 'web' } } : createRequire(file)(id),
    process: { env: url ? { EXPO_PUBLIC_NUTRITION_API_URL: url } : {} }, window: { location: { hostname: '127.0.0.1' } },
    __DEV__: true, fetch: fetchImpl, URL, AbortController, TypeError, setTimeout, clearTimeout,
  });
  return result;
}
test('connection failure identifies the actual local backend instead of claiming a general network failure', async () => {
  let requested;
  const c = client(async url => { requested = url; throw new TypeError('Failed to fetch'); });
  await assert.rejects(c.getNutritionServiceStatus(), /本机营养服务（8787）.*启动后端/);
  assert.equal(requested, 'http://127.0.0.1:8787/health');
});
test('public service failure does not incorrectly tell mobile users to start a local backend', async () => {
  const c = client(async () => { throw new TypeError('Failed to fetch'); }, 'https://nutrition.example');
  await assert.rejects(c.getNutritionServiceStatus(), /公网营养服务/);
});
test('custom local port is reported accurately rather than hard-coded as 8787', async () => {
  const c = client(async () => { throw new TypeError('Failed to fetch'); }, 'http://localhost:9090');
  await assert.rejects(c.getNutritionServiceStatus(), /本机营养服务（9090）/);
});
test('HTML startup and invalid JSON have actionable errors rather than exposing parser internals', async () => {
  await assert.rejects(client(async () => new Response('<html>starting</html>', { status: 503, headers: { 'content-type': 'text/html' } })).getNutritionServiceStatus(), /可能正在启动/);
  await assert.rejects(client(async () => new Response('{bad', { headers: { 'content-type': 'application/json' } })).getNutritionServiceStatus(), /返回内容异常/);
});
test('provider credential errors remain separate from connectivity, and saved data is not represented as lost', async () => {
  const c = client(async () => new Response(JSON.stringify({ error: { code: 'PROVIDER_AUTH_FAILED', message: 'AI 服务密钥无效或已失效，请更新服务端配置。' } }), { status: 502, headers: { 'content-type': 'application/json' } }));
  await assert.rejects(c.askNutritionAgent('你好', {}), /密钥无效或已失效/);
});
test('health check reports unconfigured credentials without making an advice request', async () => {
  const paths = [], c = client(async url => { paths.push(url); return new Response(JSON.stringify({ configured: false, provider: 'deepseek', model: 'offline', readiness: 'unconfigured' }), { headers: { 'content-type': 'application/json' } }); });
  assert.equal((await c.getNutritionServiceStatus()).readiness, 'unconfigured');
  assert.deepEqual(paths, ['http://127.0.0.1:8787/health']);
});
