const { withAppBuildGradle } = require('@expo/config-plugins');
module.exports = config => withAppBuildGradle(config, next => {
  const marker = '// BLACK: pinned native speech AAR at the app boundary.';
  if (!next.modResults.contents.includes(marker)) next.modResults.contents += `\n${marker}\ndependencies { implementation files("$rootDir/../modules/uncover-voice/android/libs/sherpa-onnx-1.13.8.aar") }\n`;
  return next;
});
