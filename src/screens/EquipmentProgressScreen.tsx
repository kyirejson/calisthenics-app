import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { equipmentGroups, equipmentMovements, type EquipmentGroup } from '../data/equipment';
import { equipmentFocus, equipmentGear, filterEquipmentMovements, getEquipmentMuscleLabel, getEquipmentRegions, getInitialEquipmentRegion, initialEquipmentFilters, type EquipmentLibraryFilters } from '../data/equipmentLibrary';
import { useReducedMotion, useRouteReveal } from '../components/useProgressMotion';
import { appPalette as p, progressPageLayout } from '../theme';
import { EquipmentPhoto } from '../components/EquipmentPhoto';
import { EquipmentMuscleDiagram } from '../components/EquipmentMuscleDiagram';
import { EquipmentTierBadge } from '../components/EquipmentTier';

// Navigation-only memory: return from a detail to the same filters. No profile or training data is changed.
let lastFilters = { ...initialEquipmentFilters };
let lastScrollOffset = 0;
function SearchIcon() { return <Svg width={20} height={20} viewBox="0 0 24 24"><Circle cx="10" cy="10" r="7" stroke={p.muted} strokeWidth="1.8" fill="none" /><Line x1="15" y1="15" x2="22" y2="22" stroke={p.muted} strokeWidth="1.8" /></Svg>; }
function FilterIcon({ active }: { active: boolean }) { const color = active ? p.lime : p.muted; return <Svg width={18} height={18} viewBox="0 0 24 24"><Line x1="3" y1="7" x2="21" y2="7" stroke={color} strokeWidth="1.8" /><Line x1="3" y1="17" x2="21" y2="17" stroke={color} strokeWidth="1.8" /><Circle cx="9" cy="7" r="3" fill={p.card} stroke={color} strokeWidth="1.8" /><Circle cx="16" cy="17" r="3" fill={p.card} stroke={color} strokeWidth="1.8" /></Svg>; }

export function EquipmentProgressScreen({ onOpen }: { onOpen?: (id: string) => void }) {
  const [filters, setFilters] = useState<EquipmentLibraryFilters>(() => ({ ...lastFilters }));
  const [showGear, setShowGear] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const initialScroll = useRef(lastScrollOffset);
  const scrollRestored = useRef(false);
  useEffect(() => { lastFilters = { ...filters }; }, [filters]);
  const { group, region, query, gear } = filters;
  const searching = Boolean(query.trim());
  const reduced = useReducedMotion();
  const reveal = useRouteReveal([group, region, gear, query].join(':'), reduced);
  const regions = getEquipmentRegions(group);
  const selectedRegion = regions.find(item => item.key === region);
  const groupLabel = equipmentGroups.find(item => item.key === group)?.label || '';
  const title = searching ? '搜索结果' : selectedRegion?.label || groupLabel;
  const visible = filterEquipmentMovements(filters);
  const availableGear = equipmentGear.filter(item => filterEquipmentMovements({ ...filters, gear: item.key }).length > 0);
  const patch = (value: Partial<EquipmentLibraryFilters>) => { lastScrollOffset = 0; scroll.current?.scrollTo({ y: 0, animated: false }); setFilters(previous => ({ ...previous, ...value })); };
  function chooseGroup(next: EquipmentGroup) { patch({ group: next, region: getInitialEquipmentRegion(next), gear: 'all', query: '' }); }
  return <SafeAreaView style={s.root}><ScrollView ref={scroll} testID="equipment-library-scroll" showsVerticalScrollIndicator={false} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" scrollEventThrottle={64}
    onScroll={event => { if (scrollRestored.current) lastScrollOffset = event.nativeEvent.contentOffset.y; }}
    onContentSizeChange={() => { if (!scrollRestored.current) { scrollRestored.current = true; scroll.current?.scrollTo({ y: initialScroll.current, animated: false }); } }}>
    <View style={s.heading}><View style={s.headingCopy}><Text style={s.title}>器械动作库</Text><Text style={s.subtitle}>6 大部位 · {equipmentMovements.length} 动作 / 变式</Text></View><Text style={s.brand}>Uncover</Text></View>
    <View style={s.search}><SearchIcon /><TextInput accessibilityLabel="搜索器械动作" value={query} onChangeText={value => patch({ query: value })} placeholder="搜索动作、肌群或器材" placeholderTextColor={p.faint} style={s.input} returnKeyType="search" />
      {query ? <Pressable accessibilityRole="button" accessibilityLabel="清除器械动作搜索" onPress={() => patch({ query: '' })} style={s.clear}><Text style={s.clearText}>×</Text></Pressable> : null}
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.groups} accessibilityRole="tablist">
      {equipmentGroups.map(item => <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={'查看' + item.label + '器械动作'} aria-selected={group === item.key && !searching} onPress={() => chooseGroup(item.key)} style={[s.tab, group === item.key && !searching && s.selected]}><Text style={[s.tabLabel, group === item.key && !searching && s.selectedText]}>{item.label}</Text></Pressable>)}
    </ScrollView>
    {!searching ? <>
      <ScrollView key={group} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.regions} testID="equipment-muscle-filters" accessibilityRole="radiogroup" accessibilityLabel="目标肌群筛选">
        {regions.map(item => <Pressable key={item.key} accessibilityRole="radio" accessibilityLabel={'筛选' + item.label + '肌群动作'} aria-checked={region === item.key} onPress={() => patch({ region: item.key, gear: 'all' })} style={[s.region, region === item.key && s.activeRegion]}><Text style={[s.regionLabel, region === item.key && s.activeRegionLabel]}>{item.label}</Text></Pressable>)}
      </ScrollView>
      <View style={s.overview} testID="equipment-muscle-overview">
        <View style={s.diagram}><EquipmentMuscleDiagram group={group} zones={selectedRegion?.zones || regions.flatMap(item => item.zones)} view={selectedRegion?.view || (group === 'back' ? 'back' : 'front')} label={title} /></View>
        <View style={s.overviewCopy}><Text style={s.overviewTitle}>{title}</Text><Text style={s.overviewDescription}>{selectedRegion?.description || ({ chest: '胸大肌 · 各区域', shoulders: '三角肌 · 肩袖肌群', back: '背阔肌 · 上背 · 竖脊肌', legs: '大腿 · 臀部 · 小腿', core: '腹部肌群 · 核心稳定', arms: '上臂 · 前臂肌群' }[group])}</Text><View style={s.overviewBadge}><Text style={s.overviewBadgeText}>当前筛选</Text></View></View>
      </View>
    </> : <Text style={s.searchScope}>搜索全部部位 · {visible.length} 个结果</Text>}
    <View style={s.section}><View style={s.sectionCopy}><Text style={s.sectionTitle}>{title}{searching ? '' : '动作'}</Text><Text style={s.resultCount}>{visible.length} 个动作 · 按 S–C 推荐等级排序</Text></View><Pressable accessibilityRole="button" accessibilityLabel="筛选器材" aria-expanded={showGear} onPress={() => setShowGear(true)} style={s.gearControl}><FilterIcon active={gear !== 'all'} /><Text style={[s.gearText, gear !== 'all' && s.activeRegionLabel]}>{equipmentGear.find(item => item.key === gear)?.label || '器材'}</Text></Pressable></View>
    <Animated.View testID="equipment-movement-list" style={{ opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
      {visible.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'查看' + item.name + '器械动作指导'} onPress={() => onOpen?.(item.id)} style={s.card}>
        <EquipmentPhoto exerciseId={item.id} name={item.name} compact />
        <View style={s.copy}><Text style={s.name}>{item.name}</Text><Text style={s.muscles} numberOfLines={2}>{getEquipmentMuscleLabel(item.id)}</Text><View style={s.gearChips}><EquipmentTierBadge tier={item.recommendation.tier} showPurpose />{equipmentFocus[item.id]?.gear.map(key => <View key={key} style={s.gearChip}><Text style={s.gearChipText}>{equipmentGear.find(entry => entry.key === key)?.label}</Text></View>)}</View></View><Text style={s.arrow}>›</Text>
      </Pressable>)}
      {!visible.length ? <View style={s.empty}><Text style={s.emptyTitle}>没有匹配的动作</Text><Text style={s.subtitle}>换个关键词，或清除器材筛选。</Text><Pressable accessibilityRole="button" accessibilityLabel="清除动作库筛选" style={s.emptyReset} onPress={() => patch({ query: '', gear: 'all', region: getInitialEquipmentRegion(group) })}><Text style={s.activeRegionLabel}>清除筛选</Text></Pressable></View> : null}
    </Animated.View>
  </ScrollView>
    <Modal visible={showGear} transparent animationType={reduced === false ? 'fade' : 'none'} onRequestClose={() => setShowGear(false)}>
      <View style={s.scrim}><Pressable accessibilityRole="button" accessibilityLabel="关闭器材筛选" onPress={() => setShowGear(false)} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={s.sheet}><View style={s.sheetContent}><View style={s.sheetHeading}><Text style={s.sectionTitle}>筛选器材</Text><Pressable accessibilityRole="button" accessibilityLabel="完成器材筛选" onPress={() => setShowGear(false)} style={s.clear}><Text style={s.clearText}>×</Text></Pressable></View><ScrollView contentContainerStyle={s.gearOptions} accessibilityRole="radiogroup" accessibilityLabel="器材类型筛选">
          {[{ key: 'all' as const, label: '全部器材' }, ...availableGear].map(item => <Pressable key={item.key} accessibilityRole="radio" accessibilityLabel={'筛选' + item.label + '动作'} aria-checked={gear === item.key} onPress={() => { patch({ gear: item.key }); setShowGear(false); }} style={[s.gearOption, gear === item.key && s.activeRegion]}><Text style={[s.regionLabel, gear === item.key && s.activeRegionLabel]}>{item.label}</Text><Text style={[s.subtitle, gear === item.key && s.activeRegionLabel]}>{filterEquipmentMovements({ ...filters, gear: item.key }).length} 个动作</Text></Pressable>)}
        </ScrollView></View></SafeAreaView>
      </View>
    </Modal>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: p.background }, content: { ...progressPageLayout.content },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 8, paddingBottom: 14 }, headingCopy: { flex: 1, minWidth: 0 }, title: { ...progressPageLayout.title, color: p.text }, subtitle: { color: p.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }, brand: { color: p.muted, fontSize: 14, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: p.card, borderWidth: 1, borderColor: p.border, borderRadius: 16, minHeight: 46, paddingLeft: 12 }, input: { flex: 1, minWidth: 0, paddingVertical: 12, paddingRight: 10, color: p.text, fontSize: 13 }, clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, clearText: { color: p.muted, fontSize: 24 },
  groups: { flexGrow: 1, gap: 6, paddingTop: 12, paddingBottom: 8 }, tab: { flex: 1, minWidth: 44, minHeight: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: p.card, borderWidth: 1, borderColor: p.border, borderRadius: 16 }, selected: { backgroundColor: p.lime, borderColor: p.lime }, tabLabel: { color: p.text, fontSize: 13, fontWeight: '800' }, selectedText: { color: p.onLime },
  regions: { gap: 7, paddingBottom: 10 }, region: { minHeight: 44, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, alignItems: 'center', justifyContent: 'center' }, regionLabel: { color: p.muted, fontSize: 13, fontWeight: '700' }, activeRegion: { backgroundColor: p.olive, borderColor: p.lime }, activeRegionLabel: { color: p.lime, fontWeight: '700' },
  overview: { flexDirection: 'row', alignItems: 'center', minHeight: 96, backgroundColor: p.card, borderWidth: 1, borderColor: p.border, borderRadius: 20, overflow: 'hidden' }, diagram: { width: '35%', maxWidth: 140, height: 96, flexShrink: 0 }, overviewCopy: { flex: 1, minWidth: 0, borderLeftWidth: 1, borderLeftColor: p.border, paddingLeft: 14, paddingRight: 10, paddingVertical: 10 }, overviewTitle: { color: p.text, fontSize: 20, fontWeight: '900' }, overviewDescription: { color: p.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }, overviewBadge: { alignSelf: 'flex-start', backgroundColor: p.olive, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 }, overviewBadgeText: { color: p.lime, fontSize: 10, fontWeight: '800' },
  searchScope: { color: p.muted, fontSize: 12, paddingBottom: 8 }, section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 6 }, sectionTitle: { ...progressPageLayout.sectionTitle, color: p.text, flexShrink: 1 }, gearControl: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, paddingHorizontal: 6 }, gearText: { color: p.muted, fontSize: 12 },
  sectionCopy: { flex: 1, minWidth: 0 }, resultCount: { color: p.muted, fontSize: 10, marginTop: 3 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 9, minHeight: 96, backgroundColor: p.card, borderWidth: 1, borderColor: p.border, borderRadius: 20, marginBottom: 8 }, copy: { flex: 1, minWidth: 0 }, name: { color: p.text, fontSize: 14, fontWeight: '800', lineHeight: 20 }, muscles: { color: p.muted, fontSize: 11, lineHeight: 16, marginTop: 4 }, gearChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 }, gearChip: { backgroundColor: p.olive, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 }, gearChipText: { color: p.lime, fontSize: 10, fontWeight: '700' }, arrow: { fontSize: 24, color: p.muted },
  empty: { padding: 22, alignItems: 'center', backgroundColor: p.card, borderRadius: 20 }, emptyTitle: { color: p.text, fontSize: 15, fontWeight: '700' }, emptyReset: { minHeight: 44, marginTop: 12, justifyContent: 'center', paddingHorizontal: 16 },
  scrim: { flex: 1, backgroundColor: '#000000A0', justifyContent: 'flex-end' }, sheet: { width: '100%', maxWidth: 440, alignSelf: 'center', maxHeight: '80%', backgroundColor: p.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: p.border }, sheetContent: { flexShrink: 1, paddingHorizontal: 16, paddingBottom: 20 }, sheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }, gearOptions: { gap: 8, paddingBottom: 8 }, gearOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 48, borderWidth: 1, borderColor: p.border, borderRadius: 14 },
});
