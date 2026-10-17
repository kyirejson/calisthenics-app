const number = value => Number.isFinite(value) && value >= 0 ? value : 0;
const contextKeys = ['taskId', 'requestId', 'executionId', 'sessionId', 'source', 'stage', 'callId', 'category', 'status', 'modelId', 'provider', 'lane', 'protocolVersion', 'prefixEpoch', 'systemDigest', 'toolsDigest', 'prefixRelation', 'rewriteReason'];
function contextFields(value = {}) {
  return Object.fromEntries(contextKeys.filter(key => typeof value[key] === 'string').map(key => [key, value[key]]));
}
export function usageSample(usage, context = {}) {
  const present = Boolean(usage && typeof usage === 'object');
  const valid = value => Number.isSafeInteger(value) && value >= 0;
  const hit = valid(usage?.prompt_cache_hit_tokens) ? usage.prompt_cache_hit_tokens : usage?.prompt_tokens_details?.cached_tokens;
  const miss = valid(usage?.prompt_cache_miss_tokens) ? usage.prompt_cache_miss_tokens
    : valid(usage?.prompt_tokens) && valid(hit) && hit <= usage.prompt_tokens ? usage.prompt_tokens - hit : undefined;
  const cacheReported = present && valid(hit) && valid(miss) && (!valid(usage.prompt_tokens) || hit + miss === usage.prompt_tokens);
  return { ...contextFields(context), kind: 'model', startedAt: number(context.startedAt), elapsedMs: number(context.elapsedMs),
    ...Object.fromEntries(['journalThroughSeq', 'sharedMessages', 'previousMessages', 'messageCount', 'firstChangedMessage'].filter(key => valid(context[key])).map(key => [key, context[key]])),
    inputChars: number(context.inputChars), completed: context.completed === true,
    firstDeltaMs: Number.isFinite(context.firstDeltaMs) ? number(context.firstDeltaMs) : null,
    ...Object.fromEntries(['firstTokenMs', 'firstVisibleMs', 'firstToolMs'].map(key => [key, Number.isFinite(context[key]) ? number(context[key]) : null])),
    measured: present, promptTokens: number(usage?.prompt_tokens), completionTokens: number(usage?.completion_tokens),
    cacheHitTokens: cacheReported ? hit : 0, cacheMissTokens: cacheReported ? miss : 0,
    cacheReported };
}
function cacheRate(rows) {
  const reported = rows.filter(row => row.cacheReported), hits = reported.reduce((sum, row) => sum + number(row.cacheHitTokens), 0),
    misses = reported.reduce((sum, row) => sum + number(row.cacheMissTokens), 0);
  return hits + misses > 0 ? hits / (hits + misses) : null;
}
export function rankUsage(rows) {
  const groups = new Map();
  for (const row of rows) {
    const name = row.category || 'conversation';
    const group = groups.get(name) || { name, requests: 0, measured: 0, promptTokens: 0, completionTokens: 0, cacheHitTokens: 0, cacheMissTokens: 0, elapsedMs: 0, inputChars: 0, cacheSamples: 0, prefixAppends: 0, prefixChanges: 0 };
    group.requests++; group.measured += row.measured ? 1 : 0; group.promptTokens += number(row.promptTokens);
    group.completionTokens += number(row.completionTokens); group.cacheHitTokens += number(row.cacheHitTokens);
    group.cacheMissTokens += number(row.cacheMissTokens); group.elapsedMs += number(row.elapsedMs); group.inputChars += number(row.inputChars);
    group.cacheSamples += row.cacheReported ? 1 : 0;
    group.prefixAppends += row.prefixRelation === 'append_only' ? 1 : 0;
    group.prefixChanges += ['history_changed', 'envelope_changed'].includes(row.prefixRelation) ? 1 : 0; groups.set(name, group);
  }
  return [...groups.values()].map(group => ({ ...group, totalTokens: group.promptTokens + group.completionTokens,
    cacheHitRate: cacheRate(rows.filter(row => (row.category || 'conversation') === group.name)),
  })).sort((a, b) => b.totalTokens - a.totalTokens || b.inputChars - a.inputChars);
}
// Only numeric timings and protocol identifiers are retained, never arguments, text, screen pixels or error prose.
export function toolSample(name, result, context, elapsedMs) {
  const data = result && typeof result === 'object' ? result : {};
  const trace = Array.isArray(data.trace) ? data.trace : [];
  const native = data.timings || (trace.length ? {} : data.screen?.timings || {});
  const timing = key => number(native[key]) + trace.reduce((sum, step) => sum + number(step.timings?.[key]), 0);
  return { ...contextFields(context), kind: 'tool', category: name, at: Date.now(), elapsedMs: number(elapsedMs),
    ok: data.ok === true, cancelled: context.status === 'cancelled',
    code: typeof data.code === 'string' ? data.code : null, replayed: data.replayed === true || data.action?.replayed === true,
    nativeMs: Number.isFinite(data.elapsedMs) ? number(data.elapsedMs) : null,
    actionMs: timing('actionMs'), observeMs: timing('observeMs'), ocrMs: timing('ocrMs'),
    pageWaitMs: trace.reduce((sum, step) => sum + number(step.waitMs), 0),
    workflowHit: typeof data.cache?.hit === 'boolean' ? data.cache.hit : null,
    workflowExecuted: typeof data.cache?.executed === 'boolean' ? data.cache.executed : null,
    outcome: ['completed', 'blocked'].includes(data.taskOutcome) ? data.taskOutcome : null };
}
export function taskEvent(kind, context, outcome) {
  return { ...contextFields(context), kind, at: Date.now(), ...(outcome ? { outcome } : {}) };
}
export function usageReport(samples, events) {
  const ids = new Set([...samples, ...events].map(row => row.taskId).filter(Boolean));
  const tasks = [...ids].map(taskId => {
    const models = samples.filter(row => row.taskId === taskId), local = events.filter(row => row.taskId === taskId);
    const starts = local.filter(row => row.kind === 'task_start'), ends = local.filter(row => row.kind === 'task_end');
    const tools = local.filter(row => row.kind === 'tool'), last = local.filter(row => ['task_start', 'task_end'].includes(row.kind)).at(-1);
    const times = [...models.map(row => row.startedAt || row.at), ...local.map(row => row.at)].filter(value => value > 0);
    const firstAt = times.length ? Math.min(...times) : null, lastAt = times.length ? Math.max(...times) : null;
    const modelMs = models.reduce((sum, row) => sum + number(row.elapsedMs), 0), toolMs = tools.reduce((sum, row) => sum + number(row.elapsedMs), 0);
    return { taskId, source: models[0]?.source || local[0]?.source || 'unknown', at: firstAt,
      requests: models.length, measuredRequests: models.filter(row => row.measured).length,
      promptTokens: models.reduce((sum, row) => sum + number(row.promptTokens), 0),
      completionTokens: models.reduce((sum, row) => sum + number(row.completionTokens), 0),
      totalTokens: models.reduce((sum, row) => sum + number(row.promptTokens) + number(row.completionTokens), 0),
      cacheHitRate: cacheRate(models), cacheSamples: models.filter(row => row.cacheReported).length,
      assessmentRequests: models.filter(row => row.stage === 'voice_turn_assessment').length,
      modelMs, toolMs, observedSpanMs: firstAt !== null && lastAt !== null ? lastAt - firstAt : null,
      // Summed request durations can overlap (cancelled probes). They are not wall-clock task duration.
      outcome: last?.kind === 'task_end' ? last.outcome : starts.length ? 'not_finished_in_retained_window' : 'assessment_only',
      retainedAttemptStarts: starts.length, retainedAttemptEnds: ends.length,
      tools: [...new Set(tools.map(row => row.category))], toolFailures: tools.filter(row => !row.ok).length,
      workflowHits: tools.filter(row => row.workflowHit === true).length, workflowMisses: tools.filter(row => row.workflowHit === false).length,
      workflowExecutions: tools.filter(row => row.workflowExecuted === true).length,
      knownUncachedInputTokens: models.filter(row => row.cacheReported).reduce((sum, row) => sum + row.cacheMissTokens, 0),
      unknownCacheRequests: models.filter(row => !row.cacheReported).length,
      pageWaitMs: tools.reduce((sum, row) => sum + number(row.pageWaitMs), 0),
      actionMs: tools.reduce((sum, row) => sum + number(row.actionMs), 0), observeMs: tools.reduce((sum, row) => sum + number(row.observeMs), 0),
      ocrMs: tools.reduce((sum, row) => sum + number(row.ocrMs), 0) };
  });
  const categories = new Map();
  for (const row of events.filter(row => row.kind === 'tool')) {
    const value = categories.get(row.category) || { name: row.category, calls: 0, failures: 0, elapsedMs: 0, ocrMs: 0, pageWaitMs: 0, workflowHits: 0, workflowMisses: 0 };
    value.calls++; value.failures += row.ok ? 0 : 1; value.elapsedMs += number(row.elapsedMs); value.ocrMs += number(row.ocrMs); value.pageWaitMs += number(row.pageWaitMs);
    value.workflowHits += row.workflowHit === true ? 1 : 0; value.workflowMisses += row.workflowHit === false ? 1 : 0; categories.set(row.category, value);
  }
  return { ranking: rankUsage(samples), taskRanking: tasks.sort((a, b) => b.totalTokens - a.totalTokens || b.modelMs - a.modelMs),
    requestDiagnostics: [...samples].reverse(),
    toolRanking: [...categories.values()].sort((a, b) => b.elapsedMs - a.elapsedMs),
    coverage: { modelRequests: samples.length, measuredRequests: samples.filter(row => row.measured).length,
      cacheReportedRequests: samples.filter(row => row.cacheReported).length, taskEvents: events.length,
      unattributedModelRequests: samples.filter(row => !row.taskId).length,
      retainedWindowOnly: true, completeLifetimeHistory: false } };
}
export function pageUsageReport(report, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw Error('用量查询参数应为对象。');
  const view = options.view || 'summary', offset = options.offset ?? 0, limit = options.limit ?? 10;
  if (!['summary', 'tasks', 'tools', 'categories', 'requests'].includes(view) || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1)
    throw Error('请选择有效视图，分页起点为非负整数，每页条数为正整数。');
  const page = rows => ({ rows: rows.slice(offset, offset + limit), total: rows.length, nextOffset: offset + limit < rows.length ? offset + limit : null });
  if (view !== 'summary') return { coverage: report.coverage, view, ...page(report[{ tasks: 'taskRanking', tools: 'toolRanking', categories: 'ranking', requests: 'requestDiagnostics' }[view]]) };
  const categories = page(report.ranking), tasks = page(report.taskRanking), tools = page(report.toolRanking);
  return { coverage: report.coverage, view, ranking: categories.rows, taskRanking: tasks.rows, toolRanking: tools.rows,
    pages: { categories: { total: categories.total, nextOffset: categories.nextOffset }, tasks: { total: tasks.total, nextOffset: tasks.nextOffset }, tools: { total: tools.total, nextOffset: tools.nextOffset } } };
}
