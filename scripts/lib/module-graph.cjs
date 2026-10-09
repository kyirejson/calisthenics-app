const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function runtimeSpecifiers(source, filename, { eagerOnly = false } = {}) {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const specifiers = [];
  const visit = node => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const typeOnly = clause?.isTypeOnly || (clause && !clause.name && bindings && ts.isNamedImports(bindings)
        && bindings.elements.length > 0 && bindings.elements.every(element => element.isTypeOnly));
      if (!typeOnly && ts.isStringLiteral(node.moduleSpecifier)) specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const typeOnly = node.isTypeOnly || (node.exportClause && ts.isNamedExports(node.exportClause)
        && node.exportClause.elements.length > 0 && node.exportClause.elements.every(element => element.isTypeOnly));
      if (!typeOnly && ts.isStringLiteral(node.moduleSpecifier)) specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && ((!eagerOnly && node.expression.kind === ts.SyntaxKind.ImportKeyword)
      || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      if (node.arguments[0] && ts.isStringLiteral(node.arguments[0])) specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return [...new Set(specifiers)];
}

function applicationGraph(root, platform = 'web', options = {}) {
  const graph = new Map();
  const extensions = ['.ts', '.tsx', '.js', '.mjs', '.cjs'];
  const suffixes = [platform, ...(platform === 'web' ? [] : ['native']), ''];
  const resolve = (from, specifier) => {
    if (!specifier.startsWith('.')) return null;
    const base = path.resolve(path.dirname(from), specifier);
    const candidates = /\.(tsx?|mjs|cjs|js)$/.test(base) ? [base]
      : [base, ...suffixes.flatMap(suffix => extensions.map(extension => base + (suffix ? '.' + suffix : '') + extension)),
        ...suffixes.flatMap(suffix => extensions.map(extension => path.join(base, 'index' + (suffix ? '.' + suffix : '') + extension)))];
    return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
      && /\.(tsx?|mjs|cjs|js)$/.test(candidate)) ?? null;
  };
  const visit = file => {
    if (graph.has(file)) return;
    const edges = runtimeSpecifiers(fs.readFileSync(file, 'utf8'), file, options).map(specifier => resolve(file, specifier)).filter(Boolean);
    graph.set(file, edges);
    edges.forEach(visit);
  };
  ['App.tsx', 'index.ts'].forEach(entry => visit(path.join(root, entry)));
  return graph;
}

function runtimeCycles(graph) {
  const done = new Set(), active = new Set(), stack = [], cycles = [];
  const visit = file => {
    if (active.has(file)) { cycles.push([...stack.slice(stack.indexOf(file)), file]); return; }
    if (done.has(file)) return;
    active.add(file); stack.push(file);
    for (const next of graph.get(file) ?? []) visit(next);
    stack.pop(); active.delete(file); done.add(file);
  };
  graph.forEach((_, file) => visit(file));
  return cycles;
}

module.exports = { runtimeSpecifiers, applicationGraph, runtimeCycles };
