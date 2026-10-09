const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require('./lib/register-typescript.cjs')({ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, extensions: ['.ts'] });
['.jpeg', '.jpg', '.png', '.webp'].forEach(ext => {
  require.extensions[ext] = (module, filename) => {
    module.exports = filename;
  };
});

const { exercises } = require('../src/domain/training/catalog.ts');
const progression = require('../src/domain/training/progression.ts');
const { supplementalImageMap } = require('../src/data/private/supplementalImageMaps.ts');
const { getDemonImage } = require('../src/data/demonImages.ts');
const { getOriginalActionImage, getOriginalResource } = require('../src/data/originalResources.ts');
const { originalTexts } = require('../src/data/private/originalTexts.ts');

const profile = {
  name: '测试', sex: 'male', age: 28, height: 175, weight: 70,
  goal: 'strength', nutritionGoal: 'performance', dietPattern: 'balanced_cn',
  frequency: 3, experience: 'beginner', planId: 'balanced_3',
  planStartedAt: new Date().toISOString(),
  levels: {},
};

const statuses = progression.getAllProgressionStatuses(profile, []);
const groups = progression.progressionGroups;

console.log('=== AUDITING PROGRESSION GROUPS & ROUTES ===');
console.log(`Total groups: ${groups.length}`);
console.log(`Total routes: ${statuses.length}`);

let totalActions = 0;
let missingImageCount = 0;
let remoteImageCount = 0;
let localSupplementalCount = 0;
let localDemonCount = 0;
let localOriginalCount = 0;
const issues = [];
const allAudited = [];

for (const group of groups) {
  console.log(`\n--- Group: ${group.key} ---`);
  const groupRoutes = statuses.filter(s => s.series.group === group.key);
  
  for (const route of groupRoutes) {
    const seriesExercises = progression.getSeriesExercises(route.series.key);
    console.log(`  Route: ${route.series.label} (${route.series.key}) - ${seriesExercises.length} exercises`);
    
    for (const ex of seriesExercises) {
      totalActions++;
      const supplementalImg = supplementalImageMap[ex.id];
      const demonImg = getDemonImage(ex.id);
      const origImg = getOriginalActionImage(ex.id);
      const origRes = getOriginalResource(ex.id);
      const remoteUri = ex.realImage || ex.image || '';
      const hasRemote = /^https?:\/\//i.test(remoteUri);
      
      let imgType = 'none';
      let assetPath = null;
      let exists = false;
      
      if (supplementalImg) {
        imgType = 'supplemental';
        localSupplementalCount++;
        const p = supplementalImg;
        exists = fs.existsSync(p);
        assetPath = p;
      } else if (demonImg) {
        imgType = 'demon';
        localDemonCount++;
        const p = path.join(__dirname, `../assets/demon-images/${ex.id}.jpeg`);
        exists = fs.existsSync(p);
        assetPath = p;
      } else if (origImg) {
        imgType = 'original';
        localOriginalCount++;
        if (origRes && origRes.primaryImageName) {
          const p = path.join(__dirname, `../assets/original-images/${origRes.primaryImageName}`);
          exists = fs.existsSync(p);
          assetPath = p;
        } else {
          exists = true;
        }
      } else if (hasRemote) {
        imgType = 'remote';
        remoteImageCount++;
      } else {
        imgType = 'missing';
        missingImageCount++;
      }
      
      const record = {
        id: ex.id,
        name: ex.name,
        category: ex.category,
        series: route.series.key,
        group: group.key,
        step: ex.step,
        imgType,
        exists,
        assetPath,
        primaryImageName: origRes ? origRes.primaryImageName : null,
        remoteUri: remoteUri ? remoteUri.substring(0, 60) : null
      };
      
      allAudited.push(record);
      
      if (imgType === 'missing') {
        issues.push({ ...record, reason: 'No local image and no remote URL' });
      } else if (imgType === 'remote') {
        issues.push({ ...record, reason: 'Only remote URL (potential loading failure or low quality)' });
      } else if (imgType === 'supplemental' && !exists) {
        issues.push({ ...record, reason: `Supplemental asset file missing on disk: ${assetPath}` });
      }
    }
  }
  
  if (group.key === '关节与支援') {
    const auxExercises = exercises.filter((exercise) => exercise.category === 'auxiliary');
    console.log(`  Auxiliary: ${auxExercises.length} exercises`);
    for (const ex of auxExercises) {
      totalActions++;
      const supplementalImg = supplementalImageMap[ex.id];
      const origImg = getOriginalActionImage(ex.id);
      const origRes = getOriginalResource(ex.id);
      const remoteUri = ex.realImage || ex.image || '';
      const hasRemote = /^https?:\/\//i.test(remoteUri);
      
      let imgType = 'none';
      if (supplementalImg) { imgType = 'supplemental'; localSupplementalCount++; }
      else if (origImg) { imgType = 'original'; localOriginalCount++; }
      else if (hasRemote) { imgType = 'remote'; remoteImageCount++; }
      else { imgType = 'missing'; missingImageCount++; }
      
      allAudited.push({
        id: ex.id,
        name: ex.name,
        category: ex.category,
        series: 'auxiliary',
        group: group.key,
        step: ex.step,
        imgType,
        primaryImageName: origRes ? origRes.primaryImageName : null,
        remoteUri: remoteUri ? remoteUri.substring(0, 60) : null
      });
      
      if (imgType === 'missing') {
        issues.push({ id: ex.id, name: ex.name, series: 'auxiliary', group: group.key, reason: 'No local image and no remote URL' });
      } else if (imgType === 'remote') {
        issues.push({ id: ex.id, name: ex.name, series: 'auxiliary', group: group.key, reason: 'Only remote URL' });
      }
    }
  }
}

console.log('\n========================================');
console.log(`TOTAL ACTIONS AUDITED: ${totalActions}`);
console.log(`Local Supplemental Images: ${localSupplementalCount}`);
console.log(`Local Demon Images: ${localDemonCount}`);
console.log(`Local Original Images: ${localOriginalCount}`);
console.log(`Remote Only: ${remoteImageCount}`);
console.log(`Completely Missing: ${missingImageCount}`);
console.log(`Issues count: ${issues.length}`);
console.log('========================================');

fs.writeFileSync(path.join(__dirname, 'audit_results.json'), JSON.stringify({ summary: { totalActions, localSupplementalCount, localDemonCount, localOriginalCount, remoteImageCount, missingImageCount }, issues, allAudited }, null, 2));
console.log('Saved detailed results to scripts/audit_results.json');
