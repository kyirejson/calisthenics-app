// Lossless with respect to operation references and capability facts. No screen text is truncated.
export function compactObservation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const result = { ...value };
  if (Array.isArray(value.nodes)) result.nodes = value.nodes.map(node => {
    const row = { ...node };
    if (row.label === row.text || row.label === row.description) delete row.label;
    if (row.description === row.text || row.description === '') delete row.description;
    for (const key of ['resourceId', 'text', 'className']) if (row[key] === '') delete row[key];
    for (const key of ['clickable', 'editable', 'scrollable', 'selected', 'focused', 'focusable', 'showingHint']) if (row[key] === false) delete row[key];
    if (Array.isArray(row.actions)) row.actions = row.actions.map(action => action.label ? action : { id: action.id });
    return row;
  });
  for (const key of ['screen', 'visualText']) if (value[key]) result[key] = compactObservation(value[key]);
  return result;
}
