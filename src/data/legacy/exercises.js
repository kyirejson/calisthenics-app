/**
 * 《囚徒健身》全系列完整动作库 (共155式)
 * 包含：
 * 1. 经典六艺十式 (60主式 + 3辅助) - CC1
 * 2. 侧身顺风旗 (抓旗8式、扬旗8式) - CC2
 * 3. 悬挂抓握8式、指尖俯卧撑、颈部力量4式、关节三诀 - CC2
 * 4. 爆发六功 (爆发俯卧撑10式、爆发跳跃10式、功夫打挺10式、前空翻10式、后空翻10式、暴力上杠10式) - CC3
 */

const exercisesCC1 = require('./exercises-cc1.js');
const exercisesCC2 = require('./exercises-cc2.js');
const exercisesCC3 = require('./exercises-cc3.js');

const CATEGORY_IMAGE_MAP = {
  'push': '/assets/images/push.svg',
  'squat': '/assets/images/squat.svg',
  'pull': '/assets/images/pull.svg',
  'leg_raise': '/assets/images/leg.svg',
  'legRaise': '/assets/images/leg.svg',
  'bridge': '/assets/images/bridge.svg',
  'handstand_pushup': '/assets/images/hspu.svg',
  'hspu': '/assets/images/hspu.svg',
  'flag_clutch': '/assets/images/flag.svg',
  'flag_press': '/assets/images/flag.svg',
  'hang_grip': '/assets/images/hang.svg',
  'trifecta': '/assets/images/trifecta.svg',
  'neck': '/assets/images/neck.svg',
  'calves': '/assets/images/squat.svg',
  'power_push': '/assets/images/power.svg',
  'power_pushup': '/assets/images/power.svg',
  'power_jump': '/assets/images/power.svg',
  'power_pull': '/assets/images/power.svg',
  'kip_up': '/assets/images/power.svg',
  'front_flip': '/assets/images/power.svg',
  'back_flip': '/assets/images/power.svg'
};

// 动作配图 CDN 基地址 (基于 GitHub + jsDelivr 免费全球加速 CDN)
// 仓库: https://github.com/kyirejson/calisthenics-assets
const CDN_IMAGE_BASE = 'https://cdn.jsdelivr.net/gh/kyirejson/calisthenics-assets@main/images';

const rawExercises = [...exercisesCC1, ...exercisesCC2, ...exercisesCC3];

const exercises = rawExercises.map(ex => {
  const fallbackSvg = CATEGORY_IMAGE_MAP[ex.category] || '/assets/images/default_exercise.svg';
  // 远程拉取原著高清实拍大图；
  // 若未配置或加载失败，采用内置黑白线稿矢量 SVG 剪影（体积仅 9KB，0 占用包体积，完美通过微信 200K 限制）
  const remotePhoto = CDN_IMAGE_BASE 
    ? `${CDN_IMAGE_BASE.replace(/\/+$/, '')}/${ex.id}.jpeg` 
    : '';
  const displayImage = remotePhoto || fallbackSvg;
  return {
    ...ex,
    image: ex.image || displayImage,
    realImage: remotePhoto,
    fallbackSvg: fallbackSvg,
    categoryHeroImage: displayImage
  };
});

exercises.CATEGORY_IMAGE_MAP = CATEGORY_IMAGE_MAP;

module.exports = exercises;
