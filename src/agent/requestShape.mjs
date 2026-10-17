// Diagnostic fingerprints, not security hashes, token counts, or proof of a provider cache hit.
export function shapeDigest(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0') + '-' + text.length;
}
export function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, stableJson(value[key])]));
  return value;
}
export function createRequestShapeTracker() {
  const previous = new Map();
  return (messages, tools, metadata = {}) => {
    const scope = [metadata.sessionId || 'ephemeral', metadata.lane || metadata.stage || 'agent', metadata.modelId || 'unknown'].join('/');
    const toolDigest = shapeDigest(tools || []), systemDigest = shapeDigest(messages.filter(message => message.role === 'system').slice(0, 1));
    const hashes = messages.map(message => shapeDigest(message)), old = previous.get(scope);
    let shared = 0; if (old) while (shared < hashes.length && shared < old.hashes.length && hashes[shared] === old.hashes[shared]) shared++;
    const sameEnvelope = old && old.toolDigest === toolDigest && old.epoch === metadata.prefixEpoch;
    const relation = !old ? 'first' : !sameEnvelope ? 'envelope_changed' : shared === old.hashes.length ? hashes.length === old.hashes.length ? 'identical' : 'append_only' : 'history_changed';
    previous.set(scope, { hashes, toolDigest, epoch: metadata.prefixEpoch });
    // One entry per active lane/model; no request bodies, parameters, keys, or screen pixels retained.
    if (previous.size > 32) previous.delete(previous.keys().next().value);
    return { systemDigest, toolsDigest: toolDigest, prefixRelation: relation, sharedMessages: sameEnvelope ? shared : 0,
      previousMessages: old?.hashes.length ?? 0, messageCount: hashes.length,
      ...(relation === 'history_changed' ? { rewriteReason: 'message_changed', firstChangedMessage: shared } : relation === 'envelope_changed' ? { rewriteReason: 'request_envelope_changed' } : {}) };
  };
}
