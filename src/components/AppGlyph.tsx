import Svg, { Circle, Path } from 'react-native-svg';
import { appPalette } from '../theme';

export type GlyphName = 'camera' | 'search' | 'chevron' | 'back' | 'flame' | 'chat' | 'run' | 'clock' | 'pace' | 'pause' | 'stop' | 'plus' | 'check' | 'expand' | 'calendar' | 'settings' | 'edit' | 'shield' | 'download' | 'trash' | 'refresh' | 'vibrate' | 'utensils' | 'dumbbell' | 'info' | 'image' | 'flash' | 'microphone' | 'send' | 'chart';
const paths: Record<GlyphName, string> = {
  chart: 'M3 20h18M4 15l5-5 4 3 7-9m-5 0h5v5',
  microphone: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5zm-3 6v1a6 6 0 0 0 12 0v-1M12 18v4m-4 0h8',
  send: 'M3 3l18 9-18 9 4-9-4-9zm4 9h14',
  camera: 'M3 7h4l2-3h6l2 3h4v13H3V7zm9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  image: 'M3 3h18v18H3V3zm1 14l5-6 4 4 3-3 4 5M7 7h.1',
  flash: 'M13 2L4 14h7l-1 8 10-13h-7l1-7z',
  search: 'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  chevron: 'M9 5l7 7-7 7', back: 'M15 5l-7 7 7 7',
  flame: 'M12 2c1 6 6 6 6 12a6 6 0 0 1-12 0c0-3 2-6 3-7 0 3 1 4 2 4 1-2 2-5 1-9z',
  chat: 'M4 3h16v13H9l-5 5V3zm4 6h8m-8 4h5',
  run: 'M13 6l-3 5 4 3-3 7M4 12l4 1 1 3-4 4M10 11l5-3 3 4h4',
  clock: 'M12 7v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  pace: 'M3 18a10 10 0 1 1 18 0M5 18h14M12 14l5-6M7 8l1 1M12 5v2M17 8l-1 1',
  pause: 'M8 5v14M16 5v14', stop: 'M5 5h14v14H5V5z',
  plus: 'M12 5v14M5 12h14', check: 'M4 12l5 5L20 6',
  expand: 'M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6',
  calendar: 'M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2zm2-2v4m10-4v4M3 10h18M7 14h2m6 0h2m-10 3h2m6 0h2',
  settings: 'M10 3h4l1 3 3 1 3 3v4l-3 1-1 3-3 3h-4l-1-3-3-1-3-3v-4l3-1 1-3 3-3zm2 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  edit: 'M4 16l-1 5 5-1L20 8a2 2 0 0 0-4-4L4 16zm10-10l4 4',
  shield: 'M12 2l8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5l8-3zm-4 9l3 3 5-6',
  download: 'M12 3v12m-4-4l4 4 4-4M4 16v5h16v-5',
  trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  refresh: 'M20 9a8 8 0 0 0-14-4L3 8m0-5v5h5M4 15a8 8 0 0 0 14 4l3-3m0 5v-5h-5',
  vibrate: 'M9 4h6v16H9V4zm-4 3l-2 3 2 3-2 3m16-9l2 3-2 3 2 3',
  utensils: 'M4 3v5a3 3 0 0 0 6 0V3M7 3v18M19 3c-3 3-4 6-4 10h4V3zm0 10v8',
  dumbbell: 'M7 9l8 8M3 8l5-5m-3 9l7-7m-1 14l7-7m-3 9l6-6',
  info: 'M12 10v7m0-10v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
};
export function AppGlyph({ name, size = 20, color = appPalette.muted }: { name: GlyphName; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" pointerEvents="none"><Path d={paths[name]} stroke={color} fill={name === 'flame' ? color : 'none'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />{name === 'run' ? <Circle cx={15} cy={3} r={2} fill={color} /> : null}</Svg>;
}
