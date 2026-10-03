const fs = require('node:fs');
const path = require('node:path');
const { withAndroidManifest, withInfoPlist, withXcodeProject, IOSConfig, createRunOncePlugin } = require('expo/config-plugins');
function withPersonalAgent(config) {
  config = withAndroidManifest(config, mod => {
    const manifest = mod.modResults.manifest;
    manifest.queries ||= [];
    if (!manifest.queries.some(query => query.intent?.some(intent => intent.data?.some(data => data.$?.['android:scheme'] === 'orpheus')))) {
      manifest.queries.push({ intent: [{ action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }], data: [{ $: { 'android:scheme': 'orpheus' } }] }] });
    }
    return mod;
  });
  config = withInfoPlist(config, mod => {
    mod.modResults.LSApplicationQueriesSchemes = [...new Set([...(mod.modResults.LSApplicationQueriesSchemes || []), 'orpheus'])];
    return mod;
  });
  return withXcodeProject(config, mod => {
    const name = mod.modRequest.projectName;
    const destination = path.join(mod.modRequest.platformProjectRoot, name, 'UncoverAgentIntents.swift');
    // Generated native source, deliberately not a tracked duplicate implementation.
    fs.copyFileSync(path.join(mod.modRequest.projectRoot, 'modules/uncover-copilot/UncoverAgentIntents.swift'), destination);
    const filepath = `${name}/UncoverAgentIntents.swift`;
    if (!mod.modResults.hasFile(filepath)) IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName: name, project: mod.modResults });
    return mod;
  });
}
module.exports = createRunOncePlugin(withPersonalAgent, 'uncover-personal-agent', '1.0.0');
