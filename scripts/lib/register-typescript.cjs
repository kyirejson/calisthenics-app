const fs = require('node:fs');
const ts = require('typescript');

// Tests exercise the same TypeScript source as the app, without loading Metro.
// Callers keep their original target/JSX options; this is not a type-check gate.
module.exports = function registerTypeScript({ compilerOptions = {}, extensions = ['.ts'] } = {}) {
  const previous = new Map(extensions.map(extension => [extension, require.extensions[extension]]));
  const loader = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, ...compilerOptions },
    fileName: filename,
  }).outputText, filename);
  for (const extension of extensions) require.extensions[extension] = loader;
  return () => {
    for (const [extension, handler] of previous) {
      if (handler) require.extensions[extension] = handler;
      else delete require.extensions[extension];
    }
  };
};
