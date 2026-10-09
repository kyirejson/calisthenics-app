const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, extensions: ['.ts'] });
const model = require('../src/running/model.ts');
const { locationStatus, mapPosition } = require('../src/running/locationStatus.ts');
const diagnostics = { permission: true, providerAvailable: true, enabled: true, listening: true, waitMs: 35000, satellites: null, usedSatellites: null, satelliteAgeMs: null, rejection: '', requestError: '' };
const snapshot = patch => ({ ...model.emptyRun(), location: { ...diagnostics }, ...patch });
test('permission, provider absence, switch off and request rejection are distinct observations', () => {
  assert.equal(locationStatus(snapshot({ location: { ...diagnostics, permission: false } })).settings, true);
  assert.match(locationStatus(snapshot({ location: { ...diagnostics, providerAvailable: false } })).title, /未提供/);
  assert.match(locationStatus(snapshot({ location: { ...diagnostics, systemEnabled: false } })).title, /定位已关闭/);
  assert.match(locationStatus(snapshot({ location: { ...diagnostics, requestError: '系统拒绝请求' } })).detail, /系统拒绝请求/);
});
test('authorized search without a fix never diagnoses permission denial or indoor use', () => {
  const status = locationStatus(snapshot(), true);
  assert.match(status.title, /尚未收到位置/); assert.match(status.detail, /可先开始计时/);
  assert.doesNotMatch(status.detail, /你在室内|没有授权/); assert.equal(status.settings, false);
  const zero = locationStatus(snapshot({ location: { ...diagnostics, satellites: 0, usedSatellites: 0, satelliteAgeMs: 1000 } }), true);
  assert.match(zero.detail, /开始计时/); assert.doesNotMatch(zero.detail, /颗卫星/);
  const old = locationStatus(snapshot({ location: { ...diagnostics, satellites: 0, usedSatellites: 0, satelliteAgeMs: 18000 } }), true);
  assert.doesNotMatch(old.detail, /报告 0 颗/);
});

test('network and cached positions are map-only, but fresh fused fixes can measure mileage', () => {
  const point = { latitude: 31, longitude: 121, accuracy: 5, ageMs: 1000, timestamp: Date.now(), elapsedMs: 0, segment: 0 };
  for (const patch of [{ provider: 'network' }, { provider: 'gps', cached: true }]) {
    const position = { ...point, ...patch }, value = snapshot({ mapPosition: position });
    assert.equal(mapPosition(value), position); assert.equal(locationStatus(value).good, false);
    assert.match(locationStatus(value).title, /地图/); assert.equal(model.usablePoint(position), false);
    assert.equal(model.analyseRun([position, { ...position, latitude: 31.001, elapsedMs: 20000, timestamp: point.timestamp + 20000 }]).distanceM, 0);
  }
  const fused = { ...point, provider: 'fused' };
  assert.equal(model.usablePoint(fused), true);
  assert.equal(locationStatus(snapshot({ preview: fused, mapPosition: fused })).good, true);
  assert.ok(model.analyseRun([fused, { ...fused, latitude: 31.0001, elapsedMs: 5000, timestamp: point.timestamp + 5000 }]).distanceM > 10);
  assert.equal(mapPosition(snapshot({ mapPosition: { ...point, provider: 'network', ageMs: 60001 } })), null);
  assert.equal(mapPosition(snapshot({ mapPosition: { ...point, cached: true, ageMs: 120001 } })), null);
  assert.equal(mapPosition(snapshot({ mapPosition: { ...point, ageMs: -1 } })), null);
  assert.equal(mapPosition(snapshot({ mapPosition: { ...point, latitude: NaN } })), null);
  assert.equal(locationStatus(snapshot({ preview: point, mapPosition: point })).good, true);
  assert.match(locationStatus(snapshot({ mapPosition: { ...point, provider: 'network' }, location: { ...diagnostics, providerAvailable: false, enabled: false, systemEnabled: true } })).title, /地图已定位/);
  assert.equal(locationStatus(snapshot({ mapPosition: { ...point, provider: 'network' }, location: { ...diagnostics, systemEnabled: false } })).settings, true);
  assert.match(locationStatus(snapshot({ location: { ...diagnostics, enabled: false, systemEnabled: true } })).title, /卫星定位未开启/);
  assert.equal(mapPosition(snapshot({ preview: point, mapPosition: null })), null);
});

test('native keeps auxiliary providers during recording and never gates beginning on a GPS fix', () => {
  const native = fs.readFileSync(require.resolve('../modules/uncover-running/android/src/main/java/uncover/running/GpsDiagnostics.kt'), 'utf8');
  assert.match(native, /mutableListOf\(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER\)/);
  assert.doesNotMatch(native, /if \(!recording\)/);
  assert.match(native, /Build.VERSION.SDK_INT >= 31.*LocationManager.FUSED_PROVIDER/);
  assert.match(native, /listeners.values.forEach/); assert.match(native, /RunStore.location\(value, recording, provider\)/);
  const store = fs.readFileSync(require.resolve('../modules/uncover-running/android/src/main/java/uncover/running/RunStore.kt'), 'utf8');
  const auxiliary = store.split('@Synchronized fun mapLocation')[1].split('private fun append')[0];
  assert.doesNotMatch(auxiliary, /append\(|journal|preview =/);
  assert.match(auxiliary, /120_000_000_000L/);
  const begin = store.split('@Synchronized fun begin')[1].split('@Synchronized fun location')[0];
  assert.doesNotMatch(begin, /check\(.*accuracy|preview \?:|check\(error.isEmpty/);
  assert.match(store, /if \(provider == "network"\) return/);
  const map = fs.readFileSync(require.resolve('../src/running/RunMap.tsx'), 'utf8');
  assert.doesNotMatch(map, /39\.91|116\.4/); assert.match(map, /尚无当前位置/);
});
test('weak, stale, rejected and successful positions have different messages', () => {
  const preview = { latitude: 1, longitude: 1, accuracy: 80, ageMs: 1000 };
  assert.match(locationStatus(snapshot({ preview })).detail, /已返回坐标.*80/);
  assert.match(locationStatus(snapshot({ preview: { ...preview, ageMs: 18000 } })).title, /过期/);
  assert.match(locationStatus(snapshot({ location: { ...diagnostics, rejection: 'invalid' } })).title, /无效/);
  assert.equal(locationStatus(snapshot({ preview: { ...preview, accuracy: 5 } })).good, true);
  assert.match(locationStatus(snapshot({ location: { ...diagnostics, listening: false } }), true).title, /已停止/);
});

// Execute the real host with an isolated hook runtime and synthetic Android transport.
function hostHarness() {
  let hook = 0, effects = [], state = { ...model.emptyRun(), location: { ...diagnostics, listening: false, waitMs: 0 } }, view;
  let previews = 0, stops = 0, starts = 0, permitted = true, failure = null;
  const slots = [], subscriptions = new Set();
  const react = {
    createContext: () => ({ Provider: 'provider' }), useContext: () => undefined,
    useState: initial => { const i = hook++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef: initial => { const i = hook++; return slots[i] ||= { current: initial }; },
    useCallback: (fn, deps) => { const i = hook++; if (!slots[i] || deps.some((d, j) => d !== slots[i].deps[j])) slots[i] = { fn, deps }; return slots[i].fn; }, useMemo: fn => { hook++; return fn(); },
    useEffect: (fn, deps) => { const i = hook++; if (!slots[i] || deps.some((d, j) => d !== slots[i][j])) { slots[i] = deps; effects.push(fn); } },
    createElement: (type, props, ...children) => { if (type === 'provider') view = props.value; return { type, props, children }; },
  };
  const transport = {
    snapshot: async () => ({ ...state }), insets: async () => JSON.stringify({ top: 0, bottom: 0 }),
    preview: async () => { previews++; if (failure) throw Error(failure); state.location = { ...diagnostics, listening: true, waitMs: 0 }; },
    stopPreview: async () => { stops++; state.location = { ...state.location, listening: false }; },
    start: async (_id, mode) => { starts++; state.phase = 'running'; state.mode = mode; },
  };
  const native = { Platform: { OS: 'android', Version: 32 }, View: 'view', AppState: { addEventListener: (_type, fn) => { subscriptions.add(fn); return { remove: () => subscriptions.delete(fn) }; } },
    PermissionsAndroid: { PERMISSIONS: { ACCESS_FINE_LOCATION: 'fine', ACCESS_COARSE_LOCATION: 'coarse' }, RESULTS: { GRANTED: 'granted' }, check: async () => permitted, requestMultiple: async () => ({ fine: 'denied' }) } };
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(require.resolve('../src/running/RunRecorderHost.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { exports, require: id => id === 'react' ? react : id === 'react-native' ? native : id.includes('AppStore') ? { useAppStore: select => select({ ready: true, saveSession: async () => {} }) } : id.includes('AppUpdates') ? { useUpdateBlock: () => {} } : id === './model' ? model : id === './locationStatus' ? { locationStatus } : { runningSupported: true, runningTransport: transport, runningInsets: async () => ({ top: 0, bottom: 0 }) }, setTimeout: () => 1, clearTimeout: () => {}, setInterval: () => 1, clearInterval: () => {}, Date, Error });
  const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
  const render = async () => { hook = 0; exports.RunRecorderHost({ children: null }); const pending = effects; effects = []; pending.forEach(fn => fn()); await flush(); hook = 0; exports.RunRecorderHost({ children: null }); };
  return { render, flush, get view() { return view; }, get previews() { return previews; }, get stops() { return stops; }, get starts() { return starts; },
    event: async value => { [...subscriptions].forEach(fn => fn(value)); await flush(); },
    fix: () => { state.preview = { latitude: 1, longitude: 1, accuracy: 5, timestamp: Date.now(), ageMs: 0, segment: 0, elapsedMs: 0 }; },
    auxiliary: () => { state.mapPosition = { latitude: 1, longitude: 1, accuracy: 5, timestamp: Date.now(), ageMs: 0, provider: 'network' }; },
    deny: () => { permitted = false; }, fail: message => { failure = message; }, recover: () => { failure = null; } };
}
test('real host resumes foreground preview but starts the stopwatch without a fix', async () => {
  const h = hostHarness(); await h.render(); await h.view.locate(); await h.render();
  assert.equal(h.previews, 1); assert.equal(h.starts, 0); assert.equal(h.view.error, '');
  await h.event('background'); const before = h.previews; await h.event('active'); assert.equal(h.previews, before + 1);
  await h.render(); h.view.stopPreview(); await h.event('background'); const hidden = h.previews; await h.event('active'); assert.equal(h.previews, hidden);
  await h.view.start(); await h.render(); assert.equal(h.starts, 1); assert.equal(h.view.snapshot.phase, 'running');
});
test('real host can start with network-only positioning without claiming distance was measured', async () => {
  const h = hostHarness(); await h.render(); h.auxiliary(); await h.view.locate(); await h.render();
  assert.match(h.view.location.title, /地图已定位/); await h.view.start(); await h.render(); assert.equal(h.starts, 1);
  assert.equal(model.runMeasurement(h.view.snapshot).source, 'unmeasured');
});
test('permission denial does not submit a request; failures stay explicit and successful fixes permit start', async () => {
  const denied = hostHarness(); await denied.render(); denied.deny(); await denied.view.locate(); await denied.render();
  assert.match(denied.view.error, /位置权限未开启/); assert.equal(denied.previews, 0);
  await denied.view.start(); await denied.render(); assert.equal(denied.starts, 1); assert.equal(denied.view.error, '');
  const h = hostHarness(); await h.render(); h.fail('系统定位请求失败（TestException）'); await h.view.locate(); await h.render(); assert.match(h.view.error, /TestException/);
  h.recover(); await h.view.locate(); h.fix(); await h.render(); await h.view.start(); await h.render(); assert.equal(h.starts, 1); assert.equal(h.view.error, '');
});
test('real host indoor start bypasses location requests entirely', async () => {
  const h = hostHarness(); await h.render(); h.deny(); await h.view.start('indoor'); await h.render();
  assert.equal(h.starts, 1); assert.equal(h.previews, 0); assert.equal(h.view.snapshot.mode, 'indoor'); assert.match(h.view.location.title, /无需 GPS/);
});
