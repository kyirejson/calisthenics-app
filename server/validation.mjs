import { validateHarness } from './harness-v2.mjs';

export class ServiceError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const MAX_BODY_BYTES = 4 * 1024 * 1024;
const BAD = () => new ServiceError(400, 'INVALID_REQUEST', '请求内容不完整或格式不正确，请检查后重试。');
export const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
export function record(value, keys) {
  if (!isRecord(value) || Object.keys(value).some(key => !keys.includes(key))) throw BAD();
  return value;
}
export function text(value, max, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) throw BAD();
  return value.trim();
}
export function number(value, max = 100000, min = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw BAD();
  return value;
}
function choice(value, values) {
  if (!values.includes(value)) throw BAD();
  return value;
}
function choices(value, values, max = 12) {
  if (!Array.isArray(value) || value.length > max) throw BAD();
  return [...new Set(value.map(item => choice(item, values)))];
}
function strings(value, max = 10, length = 200) {
  if (!Array.isArray(value) || value.length > max) throw BAD();
  return value.map(item => text(item, length));
}
const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat', 'fiber'];
export function nutrients(value, calorieMax = 10000, macroMax = 2000, requireAll = true) {
  record(value, NUTRIENTS);
  const out = {};
  for (const key of NUTRIENTS) {
    if (requireAll || value[key] !== undefined) out[key] = number(value[key], key === 'calories' ? calorieMax : macroMax);
  }
  return out;
}

function imageFormat(bytes) {
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    && bytes.readUInt32BE(8) === 13 && bytes.toString('ascii', 12, 16) === 'IHDR'
    && bytes.subarray(-12).equals(Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]))) {
    return { mime: 'image/png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length >= 14 && ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6)) && bytes.at(-1) === 0x3b) {
    return { mime: 'image/gif', width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  if (bytes.length >= 30 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
    && bytes.readUInt32LE(4) === bytes.length - 8) {
    const chunk = bytes.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && bytes.readUInt32LE(16) === 10) {
      return { mime: 'image/webp', width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
    }
    if (chunk === 'VP8 ' && bytes.subarray(23, 26).equals(Buffer.from([157, 1, 42]))) {
      return { mime: 'image/webp', width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === 'VP8L' && bytes[20] === 0x2f) {
      const bits = bytes.readUInt32LE(21);
      return { mime: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
  }
  if (bytes.length > 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9) {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) {
        return { mime: 'image/jpeg', height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
      }
      offset += length;
    }
  }
  return null;
}

export function validatePhotoRequest(value) {
  record(value, ['imageDataUrl', 'note']);
  if (typeof value.imageDataUrl !== 'string' || value.imageDataUrl.length > MAX_BODY_BYTES) throw BAD();
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value.imageDataUrl);
  if (!match || match[2].length % 4 !== 0) throw new ServiceError(400, 'INVALID_IMAGE', '请选择有效的 JPEG、PNG、WebP 或 GIF 图片。');
  const bytes = Buffer.from(match[2], 'base64');
  const detected = imageFormat(bytes);
  if (bytes.toString('base64') !== match[2] || !detected || detected.mime !== match[1]
    || detected.width < 1 || detected.height < 1 || detected.width > 8192 || detected.height > 8192
    || detected.width * detected.height > 24000000) {
    throw new ServiceError(400, 'INVALID_IMAGE', '图片内容、格式或尺寸不符合要求，请重新选择或压缩图片。');
  }
  return { imageDataUrl: value.imageDataUrl, note: value.note === undefined ? '' : text(value.note, 500, true) };
}

export function validateIngredientResult(value) {
  try {
    record(value, ['kind', 'dishName', 'ingredients', 'needsOilReview', 'warnings']);
    choice(value.kind, ['ingredients']);
    const dishName = text(value.dishName, 80);
    if (typeof value.needsOilReview !== 'boolean' || !Array.isArray(value.ingredients) || value.ingredients.length > 12) throw BAD();
    const warnings = strings(value.warnings);
    if (!value.ingredients.length) throw new ServiceError(422, 'NO_FOOD_DETECTED', '没有识别到食材，请拍摄清晰餐食照片，或改用手动记餐。');
    const ingredients = value.ingredients.map(item => {
      record(item, ['name', 'state', 'role', 'estimatedGrams', 'count']);
      const state = choice(item.state, ['raw', 'cooked', 'unknown']);
      const role = choice(item.role, ['food', 'oil']);
      const estimatedGrams = item.estimatedGrams === null ? null : number(item.estimatedGrams, 2000, 0.01);
      const count = item.count === null ? null : number(item.count, 30, 1);
      if (count !== null && !Number.isInteger(count) || role === 'oil' && (estimatedGrams !== null || count !== null)) throw BAD();
      return { name: text(item.name, 80), state, role, estimatedGrams, count };
    });
    const keys = ingredients.map(item => item.name.replace(/\s+/g, '').toLowerCase() + ':' + item.state + ':' + item.role);
    if (new Set(keys).size !== keys.length) throw BAD();
    return { kind: 'ingredients', dishName, ingredients, needsOilReview: value.needsOilReview,
      warnings: [...new Set(['份量是估计；用油和隐藏配料需要确认，不能用于判断过敏安全。', ...warnings])].slice(0, 10) };
  } catch (error) {
    if (error instanceof ServiceError && error.status === 422) throw error;
    throw new ServiceError(502, 'INVALID_AI_RESPONSE', '识别结果不完整，未保存任何记录。请重试或手动记餐。');
  }
}

const STATUSES = ['ready', 'needs_setup', 'blocked', 'unsupported'];
const OBJECTIVES = ['fat_loss', 'muscle_gain', 'maintain', 'performance'];
const PATTERNS = ['balanced', 'vegetarian', 'low_carb', 'keto'];
const RISKS = ['pregnancy', 'medical_condition', 'glucose_medication', 'sglt2', 'eating_disorder', 'underweight', 'under18'];
const ALLERGENS = ['milk', 'egg', 'soy', 'wheat', 'peanut', 'tree_nut', 'fish', 'shellfish'];
const SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'];
function dateKey(value) {
  const key = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(Date.parse(key + 'T12:00:00Z'))
    || new Date(key + 'T12:00:00Z').toISOString().slice(0, 10) !== key) throw BAD();
  return key;
}
function boolean(value) { if (typeof value !== 'boolean') throw BAD(); return value; }
function integer(value, max) { const n = number(value, max); if (!Number.isInteger(n)) throw BAD(); return n; }
export function validateAdviceRequest(value) {
  record(value, ['question', 'context', 'history', 'assistantMode', 'memory', 'harness', 'webSearch']);
  const question = text(value.question, 1000);
  const input = record(value.context, ['safetyStatus', 'objective', 'pattern', 'riskFlags', 'age', 'targets', 'preferences', 'consumed', 'menu', 'logging', 'training', 'weekly', 'weightTrend', 'toolsAllowed']);
  const context = {};
  if (input.safetyStatus !== undefined) context.safetyStatus = choice(input.safetyStatus, STATUSES);
  if (input.objective !== undefined) context.objective = choice(input.objective, OBJECTIVES);
  if (input.pattern !== undefined) context.pattern = choice(input.pattern, PATTERNS);
  if (input.riskFlags !== undefined) context.riskFlags = choices(input.riskFlags, RISKS);
  if (input.age !== undefined) {
    context.age = number(input.age, 100, 1);
    if (!Number.isInteger(context.age)) throw BAD();
  }
  if (input.targets !== undefined && input.targets !== null) {
    record(input.targets, ['calories', 'protein', 'carbs', 'fat', 'fiber', 'bmr', 'tdee', 'status', 'message']);
    context.targets = {};
    for (const key of ['calories', 'protein', 'carbs', 'fat', 'fiber', 'bmr', 'tdee']) {
      if (input.targets[key] !== undefined) context.targets[key] = number(input.targets[key], ['calories', 'bmr', 'tdee'].includes(key) ? 10000 : 2000);
    }
    if (input.targets.status !== undefined) context.targets.status = choice(input.targets.status, STATUSES);
    if (input.targets.message !== undefined) text(input.targets.message, 500); // Validate but do not forward UI copy.
  }
  if (input.preferences !== undefined && input.preferences !== null) {
    const prefs = record(input.preferences, ['version', 'objective', 'pattern', 'activity', 'allergens', 'riskFlags', 'screeningCompletedAt', 'maxCookingMinutes', 'budget']);
    const out = {};
    if (prefs.version !== undefined) choice(prefs.version, [1]);
    if (prefs.objective !== undefined) out.objective = choice(prefs.objective, OBJECTIVES);
    if (prefs.pattern !== undefined) out.pattern = choice(prefs.pattern, PATTERNS);
    if (prefs.activity !== undefined) out.activity = choice(prefs.activity, ['sedentary', 'light', 'active']);
    if (prefs.allergens !== undefined) out.allergens = choices(prefs.allergens, ALLERGENS);
    if (prefs.riskFlags !== undefined) out.riskFlags = choices(prefs.riskFlags, RISKS);
    if (prefs.screeningCompletedAt !== undefined) {
      if (prefs.screeningCompletedAt !== null && (typeof prefs.screeningCompletedAt !== 'string' || prefs.screeningCompletedAt.length > 30 || !Number.isFinite(Date.parse(prefs.screeningCompletedAt)))) throw BAD();
      out.screeningCompleted = !!prefs.screeningCompletedAt;
    }
    if (prefs.maxCookingMinutes !== undefined) out.maxCookingMinutes = choice(prefs.maxCookingMinutes, [15, 30, 45]);
    if (prefs.budget !== undefined) out.budget = choice(prefs.budget, ['economy', 'standard']);
    context.preferences = out;
  }
  if (input.consumed !== undefined) context.consumed = nutrients(input.consumed, 30000, 5000);
  if (input.menu !== undefined) {
    if (!Array.isArray(input.menu) || input.menu.length > 4) throw BAD();
    context.menu = input.menu.map(meal => {
      record(meal, ['slot', 'name', 'nutrients', 'editable']);
      return { slot: choice(meal.slot, SLOTS), name: text(meal.name, 100), nutrients: nutrients(meal.nutrients, 10000, 2000), ...(meal.editable === undefined ? {} : { editable: boolean(meal.editable) }) };
    });
  }
  if (input.logging !== undefined) {
    const logging = record(input.logging, ['date', 'confirmedSlots', 'skippedSlots', 'recordedSlots', 'complete', 'recordCount', 'containsPhoto']);
    context.logging = { date: dateKey(logging.date), confirmedSlots: choices(logging.confirmedSlots, SLOTS, 4), complete: boolean(logging.complete), recordCount: integer(logging.recordCount, 500), containsPhoto: boolean(logging.containsPhoto) };
    if (logging.skippedSlots !== undefined) context.logging.skippedSlots = choices(logging.skippedSlots, SLOTS, 4);
    if (logging.recordedSlots !== undefined) context.logging.recordedSlots = choices(logging.recordedSlots, SLOTS, 4);
    if (context.logging.skippedSlots?.some(slot => !context.logging.confirmedSlots.includes(slot) || context.logging.recordedSlots?.includes(slot))) throw BAD();
    if (context.logging.complete && context.logging.confirmedSlots.length !== 4) throw BAD();
  }
  if (input.training !== undefined) {
    const training = record(input.training, ['type', 'title', 'plannedMinutes', 'completedMinutes', 'completedSets', 'sessionCount', 'status', 'time']);
    context.training = { type: choice(training.type, ['strength', 'cardio', 'recovery']), title: text(training.title, 200),
      plannedMinutes: integer(training.plannedMinutes, 1440), completedMinutes: integer(training.completedMinutes, 1440), completedSets: integer(training.completedSets, 2000), sessionCount: integer(training.sessionCount, 100),
      status: choice(training.status, ['planned', 'partial', 'complete', 'rest']), time: choice(training.time, ['unspecified', 'morning', 'midday', 'evening']) };
  }
  if (input.weekly !== undefined) {
    const weekly = record(input.weekly, ['completeDays', 'comparableDays', 'trainingDays', 'photoDays', 'status', 'average']);
    context.weekly = { completeDays: integer(weekly.completeDays, 7), comparableDays: integer(weekly.comparableDays, 7), trainingDays: integer(weekly.trainingDays, 7), photoDays: integer(weekly.photoDays, 7),
      status: choice(weekly.status, ['insufficient', 'ready', 'goal_changed', 'paused']), average: weekly.average === null ? null : nutrients(weekly.average, 30000, 5000) };
    if (context.weekly.comparableDays > context.weekly.completeDays) throw BAD();
  }
  if (input.weightTrend !== undefined) {
    const trend = record(input.weightTrend, ['end', 'recentCount', 'previousCount', 'recentMean', 'previousMean', 'comparison']);
    const recentCount = integer(trend.recentCount, 7), previousCount = integer(trend.previousCount, 7);
    const recentMean = trend.recentMean === null ? null : number(trend.recentMean, 300, 30);
    const previousMean = trend.previousMean === null ? null : number(trend.previousMean, 300, 30);
    if ((recentCount === 0) !== (recentMean === null) || (previousCount === 0) !== (previousMean === null)) throw BAD();
    const comparison = recentCount < 5 || previousCount < 5 ? 'insufficient'
      : Math.abs(recentMean - previousMean) <= .200001 ? 'stable' : 'changed';
    if (trend.comparison !== comparison) throw BAD();
    context.weightTrend = { end: dateKey(trend.end), recentCount, previousCount, recentMean, previousMean, comparison };
  }
  if (input.toolsAllowed !== undefined) context.toolsAllowed = boolean(input.toolsAllowed);
  const history = [];
  if (value.history !== undefined) {
    if (!Array.isArray(value.history) || value.history.length > 12 || value.history.length % 2) throw BAD();
    for (const [index, turn] of value.history.entries()) {
      record(turn, ['role', 'content']);
      if (turn.role !== (index % 2 ? 'assistant' : 'user')) throw BAD();
      history.push({ role: turn.role, content: text(turn.content, turn.role === 'user' ? 1000 : 1800) });
    }
  }
  if (JSON.stringify(context).length > 8000 || JSON.stringify(history).length > 9000) throw BAD();
  const assistantMode = value.assistantMode === undefined ? false : boolean(value.assistantMode);
  const memory = [];
  if (value.memory !== undefined) {
    if (!Array.isArray(value.memory) || value.memory.length > 40) throw BAD();
    for (const fact of value.memory) {
      record(fact, ['kind', 'text']);
      memory.push({ kind: choice(fact.kind, ['like', 'avoid', 'need', 'allergy']), text: text(fact.text, 80) });
    }
  }
  let harness;
  if (value.harness !== undefined) { try { if (!assistantMode) throw BAD(); harness = validateHarness(value.harness, { record, text, number }); } catch { throw BAD(); } }
  return { question, context, history, ...(assistantMode ? { assistantMode } : {}), ...(memory.length ? { memory } : {}), ...(harness ? { harness } : {}), ...(value.webSearch === undefined ? {} : { webSearch: boolean(value.webSearch) }) };
}
