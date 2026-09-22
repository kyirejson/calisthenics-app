import React, { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { categories, categoryMatches, exercises } from '../data/catalog';
import { colors, radius } from '../theme';
import type { Exercise } from '../types';

export function ExercisesScreen({ onOpen }: { onOpen: (exerciseId: string) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const filtered = useMemo(() => exercises.filter((item) => categoryMatches(item, category) && (!query.trim() || `${item.name} ${item.nameEn || ''} ${item.purpose || ''}`.toLowerCase().includes(query.trim().toLowerCase()))), [category, query]);

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<View><Text style={styles.eyebrow}>188 个完整动作</Text><Text style={styles.title}>动作库</Text><View style={styles.search}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="搜索动作、目标或要点" placeholderTextColor="#969990" style={styles.searchInput} /></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>{categories.map((item) => <Pressable key={item.key} onPress={() => setCategory(item.key)} style={[styles.category, category === item.key && styles.categoryActive]}><Text style={[styles.categoryIcon, category === item.key && styles.categoryTextActive]}>{item.icon}</Text><Text style={[styles.categoryText, category === item.key && styles.categoryTextActive]}>{item.label}</Text></Pressable>)}</ScrollView><View style={styles.resultRow}><Text style={styles.resultText}>{filtered.length} 个动作</Text><Text style={styles.resultSub}>由易到难</Text></View></View>}
        renderItem={({ item }) => <ExerciseRow exercise={item} onPress={() => onOpen(item.id)} />}
        ItemSeparatorComponent={() => <View style={{ height: 11 }} />}
        ListEmptyComponent={<Text style={styles.empty}>没有找到相关动作</Text>}
      />
    </SafeAreaView>
  );
}

function ExerciseRow({ exercise, onPress }: { exercise: Exercise; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}><Image source={{ uri: exercise.realImage || exercise.image }} style={styles.image} /><View style={styles.imageShade} /><View style={styles.step}><Text style={styles.stepText}>{exercise.step ? `第 ${exercise.step} 式` : '专项'}</Text></View><View style={styles.rowContent}><Text style={styles.rowCategory}>{exercise.categoryLabel || exercise.category}</Text><Text style={styles.rowTitle}>{exercise.name}</Text><Text style={styles.rowEn}>{exercise.nameEn || exercise.source || 'Calisthenics'}</Text></View><Text style={styles.arrow}>›</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper }, content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  eyebrow: { color: colors.inkMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 5 }, title: { color: colors.ink, fontSize: 34, fontWeight: '900', letterSpacing: -1.3 },
  search: { height: 52, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, marginTop: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 }, searchIcon: { color: colors.inkMuted, fontSize: 25, marginRight: 9 }, searchInput: { flex: 1, color: colors.ink, fontSize: 15 },
  categories: { paddingVertical: 16 }, category: { minWidth: 68, height: 62, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginRight: 9 }, categoryActive: { backgroundColor: colors.ink, borderColor: colors.ink }, categoryIcon: { color: colors.ink, fontSize: 16, fontWeight: '900' }, categoryText: { color: colors.inkMuted, fontSize: 11, fontWeight: '700', marginTop: 5 }, categoryTextActive: { color: '#FFFFFF' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }, resultText: { color: colors.ink, fontSize: 15, fontWeight: '800' }, resultSub: { color: colors.inkMuted, fontSize: 12 },
  row: { height: 116, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#282B25', flexDirection: 'row', alignItems: 'center' }, image: { position: 'absolute', inset: 0, width: '100%', height: '100%' }, imageShade: { position: 'absolute', inset: 0, backgroundColor: 'rgba(15,17,13,0.68)' }, step: { position: 'absolute', right: 13, top: 12, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 9, paddingVertical: 5 }, stepText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' }, rowContent: { paddingHorizontal: 17, flex: 1 }, rowCategory: { color: colors.lime, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, rowTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 5 }, rowEn: { color: '#C0C3B9', fontSize: 11, marginTop: 3 }, arrow: { color: '#FFFFFF', fontSize: 27, marginRight: 15 }, empty: { textAlign: 'center', color: colors.inkMuted, paddingTop: 60 },
});
