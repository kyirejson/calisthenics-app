import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { equipmentArtwork } from '../data/equipmentArtwork';
import { getEquipmentMovement } from '../data/equipment';
import { equipmentFocus, equipmentMuscleRegions } from '../data/equipmentLibrary';
import { EquipmentMuscleDiagram } from './EquipmentMuscleDiagram';
import { appPalette as p } from '../theme';
import { useReducedMotion } from './useProgressMotion';

/** Generated equipment demos never share the privately imported book-image path. */
export function EquipmentPhoto({ exerciseId, name, compact = false, thumbnailWidth = 100 }: { exerciseId: string; name: string; compact?: boolean; thumbnailWidth?: number }) {
  const artwork = equipmentArtwork[exerciseId];
  const reducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); setExpanded(false); }, [exerciseId, artwork?.source]);
  if (!artwork || failed) {
    const movement = getEquipmentMovement(exerciseId);
    const regions = equipmentFocus[exerciseId]?.regions.map(key => equipmentMuscleRegions.find(region => region.key === key)).filter(Boolean) || [];
    return <View testID={'equipment-illustration-' + exerciseId} style={[s.missing, compact ? [s.thumbnail, { width: thumbnailWidth }] : s.missingFull]}>
      <View style={compact ? s.smallDiagram : s.largeDiagram}>{movement ? <EquipmentMuscleDiagram group={movement.group} zones={regions.flatMap(region => region?.zones || [])} view={regions[0]?.view || 'front'} label={name} /> : null}</View>
      {compact ? <Text style={s.illustrationLabel}>部位示意</Text> : <View style={s.missingCopy}><Text style={s.variant}>动作示范图待补</Text><Text style={s.missingText}>当前仅展示部位，不是动作姿势</Text></View>}
    </View>;
  }
  const picture = <Image accessible source={compact ? artwork.thumbnail : artwork.source} accessibilityLabel={name + '彩色人物动作示范：' + artwork.variant} style={s.image} resizeMode="contain" onError={() => setFailed(true)} />;
  if (compact) return <View testID={'equipment-thumbnail-' + exerciseId} style={[s.thumbnail, { width: thumbnailWidth }]}>{picture}</View>;
  return <View style={s.gallery}>
    <Pressable accessibilityRole="button" accessibilityLabel={'放大' + name + '动作示范图'} onPress={() => setExpanded(true)} style={[s.picture, { aspectRatio: artwork.width / artwork.height }]}>
      {picture}<View style={s.expand}><Text style={s.expandText}>⤢</Text></View>
    </Pressable>
    <View style={s.caption}><Text style={s.variant}>{artwork.variant}</Text><Text style={s.provenance}>写实示范 · 非实拍</Text></View>
    <Modal visible={expanded} transparent animationType={reducedMotion === false ? 'fade' : 'none'} onRequestClose={() => setExpanded(false)}>
      <SafeAreaView style={s.overlay}>
        <View style={s.toolbar}><Text numberOfLines={2} style={s.modalTitle}>{name}</Text><Pressable accessibilityRole="button" accessibilityLabel="关闭动作大图" onPress={() => setExpanded(false)} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
        <View testID="equipment-expanded-image" style={s.fullImage}><Image accessible source={artwork.source} accessibilityLabel={name + '完整动作示范图'} style={s.image} resizeMode="contain" /></View>
        <Text style={s.modalCaption}>{artwork.variant} · 写实生成示范，非真人实拍</Text>
      </SafeAreaView>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  thumbnail: { width: 100, aspectRatio: 4 / 3, borderRadius: 12, overflow: 'hidden', backgroundColor: p.raised, flexShrink: 0 },
  gallery: { marginTop: 18, marginBottom: 18 }, picture: { width: '100%', borderRadius: 18, overflow: 'hidden', backgroundColor: p.raised },
  image: { position: 'absolute', width: '100%', height: '100%' }, expand: { position: 'absolute', bottom: 8, right: 8, width: 30, height: 30, borderRadius: 8, backgroundColor: '#0D1114B8', alignItems: 'center', justifyContent: 'center' }, expandText: { color: p.text, fontSize: 22 },
  caption: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between', paddingTop: 9 }, variant: { color: p.muted, fontSize: 11 }, provenance: { color: p.faint, fontSize: 10 },
  overlay: { flex: 1, backgroundColor: '#080B0FF5' }, toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }, modalTitle: { color: p.text, fontSize: 17, fontWeight: '800', flex: 1 }, close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: p.raised }, closeText: { color: p.text, fontSize: 30 },
  fullImage: { flex: 1, marginHorizontal: 8 }, modalCaption: { color: p.muted, fontSize: 12, textAlign: 'center', padding: 20 },
  missing: { backgroundColor: p.raised, alignItems: 'center', justifyContent: 'center', borderRadius: 12, overflow: 'hidden' }, missingFull: { width: '100%', minHeight: 94, flexDirection: 'row', marginVertical: 18, padding: 12, gap: 12 }, smallDiagram: { width: 90, height: 60 }, largeDiagram: { width: 80, height: 74 }, missingCopy: { flex: 1, minWidth: 0, gap: 5 }, missingText: { color: p.faint, fontSize: 11, lineHeight: 17 }, illustrationLabel: { position: 'absolute', bottom: 3, fontSize: 9, color: p.muted, backgroundColor: p.raised, paddingHorizontal: 6, borderRadius: 4 },
});
