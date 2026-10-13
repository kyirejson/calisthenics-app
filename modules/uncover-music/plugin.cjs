const { withAppBuildGradle } = require('@expo/config-plugins');

const marker = '// Uncover: track model/tool ES modules in native JS bundle inputs.';
function trackModuleInputs(contents) {
  if (contents.includes(marker)) return contents;
  return `${contents.trimEnd()}\n\n${marker}\ntasks.withType(com.facebook.react.tasks.BundleHermesCTask).configureEach {\n    sources.include("**/*.mjs", "**/*.cjs")\n}\n`;
}

module.exports = config => withAppBuildGradle(config, next => {
  if (next.modResults.language !== 'groovy') throw Error('Uncover bundle inputs require the current Groovy Android template.');
  next.modResults.contents = trackModuleInputs(next.modResults.contents);
  return next;
});
module.exports.trackModuleInputs = trackModuleInputs;
