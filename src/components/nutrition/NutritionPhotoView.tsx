import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NutritionPhoto } from '../../nutrition/types';
import { nutritionPhotoURI, releasePhotoURI } from '../../nutrition/photoStorage';
import { appPalette as c } from '../../theme';
import { FoodArtwork } from './FoodArtwork';
import type { FoodArtworkInput } from '../../nutrition/foodArtwork';

export function NutritionPhotoView({ photo, size = 60, fallbackFood }: { photo: NutritionPhoto; size?: number; fallbackFood?: FoodArtworkInput | null }) {
  const [uri, setUri] = useState<string | null>(null), [expanded, setExpanded] = useState(false), [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true, ownedURI: string | null = null;
    setUri(null); setLoaded(false);
    void nutritionPhotoURI(photo.id).then(value => {
      ownedURI = value;
      if (alive) { setUri(value); setLoaded(true); } else releasePhotoURI(value);
    }).catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; releasePhotoURI(ownedURI); };
  }, [photo.id]);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="查看保存的饮食照片" disabled={!uri} onPress={event => { event.stopPropagation(); setExpanded(true); }} style={[s.thumb, { width: size, height: size }]}>
      {uri ? <Image source={{ uri }} resizeMode="cover" style={s.image} onError={() => setUri(null)} /> : fallbackFood !== undefined ? <FoodArtwork food={fallbackFood} size={size} /> : <Text style={s.hint}>{loaded ? '照片不可用' : '加载照片'}</Text>}
    </Pressable>
    <Modal visible={expanded} transparent animationType="fade" onRequestClose={() => setExpanded(false)}><View style={s.overlay}>
      <View style={s.header}><Text style={s.text}>{photo.kind === 'label' ? '营养标签' : '食品照片'} · 本机保存</Text><Pressable accessibilityRole="button" onPress={() => setExpanded(false)} style={s.close}><Text style={s.text}>关闭照片</Text></Pressable></View>
      {uri ? <Image source={{ uri }} resizeMode="contain" style={s.full} /> : <Text style={s.text}>照片文件不可用，营养记录仍保留。</Text>}
      <Text style={s.hint}>{new Date(photo.capturedAt).toLocaleString('zh-CN')}</Text>
    </View></Modal>
  </>;
}
const s = StyleSheet.create({ thumb: { borderRadius: 12, overflow: 'hidden', backgroundColor: c.background, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' }, hint: { color: c.muted, fontSize: 10, textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.96)', padding: 20, justifyContent: 'center' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  text: { color: c.text, fontSize: 13, fontWeight: '700' }, close: { minHeight: 44, padding: 12, justifyContent: 'center' }, full: { flex: 1, width: '100%', marginVertical: 16 } });
