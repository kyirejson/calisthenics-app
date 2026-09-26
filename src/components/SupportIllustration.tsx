import React from 'react';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

const illustrated = new Set(['aux_calfBeginner', 'aux_neckNeutral']);
export const hasSupportIllustration = (id: string) => illustrated.has(id);

/** Schematic aids only; not book photographs or anatomical instruction. */
export function SupportIllustration({ id, compact = false }: { id: string; compact?: boolean }) {
  const caption = id === 'aux_calfBeginner' ? '双脚平地 · 缓慢抬起脚跟' : '轻柔抗阻 · 头颈保持中立';
  return <Svg width="100%" height="100%" viewBox="0 0 360 200" accessibilityLabel={caption}>
    <Circle cx="180" cy="96" r="80" fill="#252F1C" />
    {id === 'aux_calfBeginner' ? <G stroke="#D8E6C0" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Circle cx="179" cy="33" r="14" fill="#D8E6C0" strokeWidth="0" />
      <Path d="M179 54 L179 95 M179 62 L142 84 L112 77 M181 63 L206 90 L211 117 M174 96 L156 123 L159 153 L175 161 M184 96 L199 123 L194 153 L211 161" />
      <Line x1="107" y1="60" x2="107" y2="167" stroke="#687A54" strokeWidth="3" />
      <Line x1="130" y1="166" x2="229" y2="166" stroke="#687A54" strokeWidth="2" />
      <Path d="M144 159 L144 140 M138 147 L144 140 L150 147 M218 159 L218 140 M212 147 L218 140 L224 147" stroke="#CDFA39" strokeWidth="3" />
    </G> : <G stroke="#D8E6C0" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <Circle cx="181" cy="67" r="23" fill="#D8E6C0" strokeWidth="0" />
      <Path d="M181 94 L181 145 M157 107 L204 107 M157 108 L133 126 L147 79 M204 107 L218 139" />
      <Path d="M150 59 L151 85" stroke="#CDFA39" strokeWidth="5" />
      <Path d="M120 67 L140 67 M133 61 L140 67 L133 73" stroke="#CDFA39" strokeWidth="3" />
      <Line x1="181" y1="30" x2="181" y2="153" stroke="#687A54" strokeWidth="1" strokeDasharray="4 5" />
    </G>}
    {!compact ? <SvgText x="180" y="188" textAnchor="middle" fontSize="12" fill="#B8C7A6">{caption}</SvgText> : null}
  </Svg>;
}
