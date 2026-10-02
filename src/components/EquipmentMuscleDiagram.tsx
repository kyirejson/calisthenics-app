import { useId } from 'react';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import type { EquipmentGroup } from '../data/equipment';
import type { MuscleZone } from '../data/equipmentLibrary';

type Part = { zone: MuscleZone; d: string };
const front: Part[] = [
  { zone: 'chestUpper', d: 'M98 67 C84 61 69 59 57 75 L66 84 C79 76 88 78 98 80Z' },
  { zone: 'chestMiddle', d: 'M98 83 C84 78 70 80 62 89 C70 109 86 115 98 106Z' },
  { zone: 'chestLower', d: 'M98 110 C85 119 74 116 63 103 L65 115 C76 130 90 133 98 121Z' },
  { zone: 'shoulderFront', d: 'M55 61 C40 57 30 67 30 83 L41 96 L57 76Z' },
  { zone: 'shoulderSide', d: 'M29 68 C17 77 20 97 26 105 L34 99 L35 79Z' },
  { zone: 'serratus', d: 'M58 110 L71 121 L60 125 L73 134 L60 141 L71 148 L60 154 L55 128Z' },
  { zone: 'biceps', d: 'M30 100 C40 96 44 112 39 131 L28 150 L23 143Z' },
  { zone: 'brachialis', d: 'M40 110 L43 135 L33 153 L29 149Z' },
  { zone: 'forearms', d: 'M26 153 L38 155 L25 202 L17 222 L11 216Z' },
  { zone: 'obliques', d: 'M63 130 L76 144 L81 195 L70 207 L59 168Z' },
  { zone: 'abs', d: 'M95 133 L81 135 L82 153 L96 153Z M96 158 L82 158 L84 176 L96 176Z M96 181 L85 181 L88 202 L97 211Z' },
  { zone: 'quads', d: 'M68 248 C74 239 86 245 87 258 L80 316 L68 329 L60 308Z' },
  { zone: 'adductors', d: 'M90 247 L98 252 L90 309 L83 323 L84 274Z' },
  { zone: 'gastrocnemius', d: 'M67 347 C80 353 78 381 73 397 L64 418 L58 393Z' },
  { zone: 'soleus', d: 'M57 373 L62 407 L62 441 L54 430Z' },
  { zone: 'tibialis', d: 'M79 340 L85 349 L74 423 L69 443 L66 425Z' },
];
const back: Part[] = [
  { zone: 'upperBack', d: 'M98 46 L62 65 L70 83 L91 108 L98 132Z' },
  { zone: 'traps', d: 'M98 44 L63 62 L74 71 L98 60Z' },
  { zone: 'rotator', d: 'M67 80 L87 92 L78 109 L57 96Z' },
  { zone: 'shoulderRear', d: 'M55 61 C36 55 25 73 28 91 L43 98 L60 79Z' },
  { zone: 'triceps', d: 'M30 102 C40 96 45 115 38 138 L29 151 L22 140Z' },
  { zone: 'forearms', d: 'M26 153 L38 155 L25 202 L17 222 L11 216Z' },
  { zone: 'lats', d: 'M55 99 L77 112 L89 151 L83 194 L67 206 L62 158Z' },
  { zone: 'erectors', d: 'M96 138 L88 153 L86 191 L92 210 L97 199Z' },
  { zone: 'glutes', d: 'M94 213 C72 207 60 220 63 239 C68 253 88 257 98 246 L98 223Z' },
  { zone: 'abductors', d: 'M68 211 L84 207 L89 221 L73 227 L62 234 L60 224Z' },
  { zone: 'hamstrings', d: 'M66 258 C73 255 88 258 90 271 L81 319 L67 330 L61 307Z' },
  { zone: 'gastrocnemius', d: 'M67 347 C81 350 81 378 73 396 L64 416 C55 400 56 370 67 347Z' },
  { zone: 'soleus', d: 'M56 381 L64 415 L63 441 L55 433Z' },
];
const outline = 'M89 33 L88 47 C72 51 63 54 48 58 C27 59 18 73 20 98 L23 145 L12 199 L7 230 L15 237 L25 227 L35 190 L45 150 L49 107 L61 124 L60 170 L68 208 L61 236 L55 291 L61 332 L52 392 L54 446 L49 465 L65 469 L72 458 L72 421 L83 375 L80 338 L90 288 L100 264 L110 288 L120 338 L117 375 L128 421 L128 458 L135 469 L151 465 L146 446 L148 392 L139 332 L145 291 L139 236 L132 208 L140 170 L139 124 L151 107 L155 150 L165 190 L175 227 L185 237 L193 230 L188 199 L177 145 L180 98 C182 73 173 59 152 58 C137 54 128 51 112 47 L111 33Z';
const viewBoxes: Record<EquipmentGroup, string> = { chest: '0 38 200 190', shoulders: '0 30 200 126', back: '0 38 200 202', legs: '28 208 144 268', core: '32 114 136 110', arms: '0 50 200 208' };

/** Schematic surface regions, not a medical atlas or a deep-muscle dissection. */
export function EquipmentMuscleDiagram({ group, zones, view, label }: { group: EquipmentGroup; zones: MuscleZone[]; view: 'front' | 'back'; label: string }) {
  const id = useId().replace(/:/g, '');
  return <Svg width="100%" height="100%" viewBox={viewBoxes[group]} accessibilityLabel={label + '部位示意，非独立肌肉隔离示意'} accessible>
    <Defs><LinearGradient id={id + '-grey'} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#92999E" /><Stop offset="0.5" stopColor="#545D67" /><Stop offset="1" stopColor="#313A44" /></LinearGradient>
      <LinearGradient id={id + '-lime'} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#D6FF70" /><Stop offset="1" stopColor="#9AC335" /></LinearGradient></Defs>
    <Path d={outline} fill="#303943" stroke="#67717C" strokeWidth="1.2" />
    <Path d="M89 33 C80 14 85 3 100 3 C115 3 120 14 111 33Z" fill={`url(#${id}-grey)`} />
    {[false, true].map(mirror => <G key={String(mirror)} transform={mirror ? 'translate(200 0) scale(-1 1)' : undefined}>
      {(view === 'front' ? front : back).map(part => <Path key={part.zone} d={part.d} fill={`url(#${id}-${zones.includes(part.zone) ? 'lime' : 'grey'})`} stroke={zones.includes(part.zone) ? '#C7F548' : '#1B232B'} strokeWidth="1.2" />)}
    </G>)}
    {zones.includes('deepCore') ? <Path d="M64 135 Q100 120 136 135 L133 201 Q100 222 67 201Z" fill="#C7F548" fillOpacity="0.17" stroke="#C7F548" strokeDasharray="4 3" strokeWidth="1.6" /> : null}
  </Svg>;
}
