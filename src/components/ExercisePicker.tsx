import React, { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { canAddExercise, categories, categoryMatches, exercises } from '../data/catalog';
import { useAppStore } from '../store/AppStore';
import { colors, radius } from '../theme';
import type { Exercise } from '../types';
import { ExercisePhoto } from './ExerciseResource';

export function ExercisePicker({ visible, onClose, onSelect, excludedIds = [] }: {
  visible: boolean; onClose: () => void; onSelect: (exercise: Exercise) => void | Promise<void>; excludedIds?: string[];
}) {
  const { profile, sessions } = useAppStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const filtered = exercises.filter((exercise) => !excludedIds.includes(exercise.id) && categoryMatches(exercise, category)
    && `${exercise.name} ${exercise.nameEn || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const select = async (exercise: Exercise) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await onSelect(exercise); onClose(); } catch { setError('添加失败，请重试。'); } finally { setBusy(false); }
  };
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.shade}><View style={styles.sheet}>
      <View style={styles.head}><View style={{ flex: 1 }}><Text style={styles.title}>添加训练动作</Text><Text style={styles.note}>只修改今天，不改变每周计划。按当前能力选择。</Text></View><Pressable disabled={busy} accessibilityLabel="关闭动作选择" onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
      <TextInput accessibilityLabel="搜索训练动作" value={query} onChangeText={setQuery} placeholder="搜索动作名称" placeholderTextColor={colors.inkMuted} style={styles.search} />
      <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>{categories.map((item) => <Pressable key={item.key} onPress={() => setCategory(item.key)} style={[styles.chip, category === item.key && styles.chipActive]}><Text style={styles.chipText}>{item.label}</Text></Pressable>)}</ScrollView></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList data={filtered} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.note}>没有匹配动作，试试其他名称或分类。</Text>} renderItem={({ item }) => {
        const locked = profile ? !canAddExercise(item, profile, sessions) : true;
        return <Pressable disabled={busy || locked} accessibilityRole="button" accessibilityLabel={`添加${item.name}`} onPress={() => void select(item)} style={[styles.row, locked && styles.locked]}>
          <View style={styles.photo}><ExercisePhoto exercise={item} compact resizeMode="contain" showShade={false} showTag={false} /></View>
          <View style={{ flex: 1 }}><Text style={styles.name}>{item.name}</Text><Text style={styles.note}>{locked ? item.category === 'neck' ? '需标准桥基础，并在今日页确认颈桥适宜性' : '未解锁：单日窄距俯卧撑累计 200 次' : `${item.categoryLabel || '训练动作'}${item.step ? ` · 第 ${item.step} 式` : ''}${item.riskLevel === 'high' ? ' · 高风险' : ''}`}</Text></View><Text style={styles.add}>{locked ? '锁定' : '+'}</Text>
        </Pressable>;
      }} />
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  shade: { flex: 1, backgroundColor: 'rgba(12,15,10,.65)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 640, height: '86%', backgroundColor: colors.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }, title: { color: colors.ink, fontWeight: '900', fontSize: 23 },
  note: { color: colors.inkMuted, fontSize: 11, lineHeight: 17, marginTop: 5 }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, closeText: { fontSize: 28, color: colors.ink },
  search: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 13, color: colors.ink, fontSize: 15 },
  categories: { gap: 7, paddingVertical: 14 }, chip: { backgroundColor: colors.card, borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 14 }, chipActive: { backgroundColor: colors.lime }, chipText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  list: { paddingBottom: 24 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  photo: { height: 64, width: 68, borderRadius: 10, overflow: 'hidden' }, name: { color: colors.ink, fontSize: 14, fontWeight: '800' }, add: { color: colors.green, fontSize: 22, minWidth: 32, textAlign: 'center' }, locked: { opacity: .55 }, error: { color: colors.danger, marginBottom: 10 },
});
