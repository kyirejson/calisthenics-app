import http from 'node:http';

// Local browser development only: reuse the deployed API without copying its secret.
const upstream = 'https://uncover-nutrition-api.onrender.com';
const origins = new Set(['http://127.0.0.1:8081', 'http://localhost:8081']);
const posts = new Set(['/v1/nutrition/advice', '/v1/nutrition/analyze-photo', '/v1/nutrition/read-label', '/v1/nutrition/lookup-barcode']);
const maxBody = 4 * 1024 * 1024;
let active = 0;
const server = http.createServer(async (req, res) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 110000);
  res.once('close', () => { if (!res.writableEnded) controller.abort(); });
  let acquired = false;
  const reply = (status, value) => {
    if (res.destroyed) return;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  };
  try {
    const host = new URL('http://' + (req.headers.host || '')).hostname;
    if (!['127.0.0.1', 'localhost'].includes(host)) return reply(403, { error: { message: '仅允许本机调试。' } });
    const origin = req.headers.origin;
    res.setHeader('Vary', 'Origin');
    if (origin) {
      if (!origins.has(origin)) return reply(403, { error: { message: '页面来源未获准。' } });
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    const path = req.url;
    if (path !== '/health' && !posts.has(path)) return reply(404, { error: { message: '接口不存在。' } });
    if (req.method === 'OPTIONS') {
      const method = req.headers['access-control-request-method'];
      const headers = req.headers['access-control-request-headers'];
      if (method && method !== (path === '/health' ? 'GET' : 'POST')
        || headers && headers.split(',').some(header => header.trim().toLowerCase() !== 'content-type')) {
        return reply(403, { error: { message: '跨域方法或请求头未获准。' } });
      }
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
      res.end(); return;
    }
    if (req.method !== (path === '/health' ? 'GET' : 'POST')) return reply(405, { error: { message: '请求方法不支持。' } });
    if (active >= 2) return reply(429, { error: { message: '已有请求正在处理，请稍后重试。' } });
    active++; acquired = true;
    let body;
    if (req.method === 'POST') {
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '') || req.headers['content-encoding']) {
        return reply(415, { error: { message: '请使用 UTF-8 JSON 请求。' } });
      }
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > maxBody) return reply(413, { error: { message: '图片过大，请压缩后重试。' } });
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }
    const response = await fetch(upstream + path, {
      method: req.method, headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body, signal: controller.signal, redirect: 'error',
    });
    if (!/application\/json/i.test(response.headers.get('content-type') || '')) {
      await response.body?.cancel();
      return reply(503, { error: { message: '营养服务正在启动或暂不可用，请稍后重试。' } });
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 128 * 1024) { controller.abort(); throw new Error('Response too large'); }
      chunks.push(chunk);
    }
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (response.headers.has('retry-after')) res.setHeader('Retry-After', response.headers.get('retry-after'));
    reply(response.status, value);
  } catch {
    reply(503, { error: { message: '公网营养服务未连接，请检查网络并稍后重试。' } });
  } finally {
    clearTimeout(timer);
    if (acquired) active--;
  }
});
server.requestTimeout = 120000;
server.headersTimeout = 15000;
server.on('error', error => { console.error('本地调试网关启动失败：' + error.code); process.exitCode = 1; });
server.listen(8787, '127.0.0.1', () => console.log('本地营养调试网关：http://127.0.0.1:8787 → ' + upstream));
