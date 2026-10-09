import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';
import { AppGlyph } from './AppGlyph';
import { appPalette as p } from '../theme';

/** One reading canvas for bodyweight and equipment; actions remain owned by each screen. */
export function MovementDetail({ title, kicker, ordinal, subtitle, backLabel, onBack, readingKey, footer, children }: {
  title: string; kicker: string; ordinal?: number; subtitle?: string;
  backLabel: string; onBack: () => void; readingKey?: string; footer: ReactNode; children: ReactNode;
}) {
  const scroll = useRef<ScrollView>(null);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [readingKey]);
  return <SafeAreaView testID="movement-detail" style={s.root}>
    <View style={s.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} style={s.back}><AppGlyph name="back" size={24} color={p.text} /></Pressable>
      <View style={s.heading}><Text style={s.kicker}>{kicker}</Text><Text accessibilityRole="header" style={s.title}>{title}</Text>{subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}</View>
      {ordinal ? <Svg accessible={false} width={80} height={76} style={s.ordinal}><SvgText x={78} y={65} textAnchor="end" fontSize={68} fontWeight="800" fill="none" stroke={p.oliveBorder} strokeWidth={.8}>{String(ordinal).padStart(2, '0')}</SvgText></Svg> : null}
    </View>
    <ScrollView ref={scroll} testID="movement-detail-scroll" showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>{children}</ScrollView>
    <View testID="movement-detail-footer" style={s.footer}><View style={s.actions}>{footer}</View></View>
  </SafeAreaView>;
}

export function DetailAction({ label, accessibilityLabel, onPress, primary = false, disabled = false }: {
  label: string; accessibilityLabel?: string; onPress: () => void; primary?: boolean; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.action, primary && s.primary, disabled && s.disabled, pressed && !disabled && s.pressed]}>
    <Text style={[s.actionText, primary && s.primaryText, disabled && s.disabledText]}>{label}</Text>{primary ? <View style={s.arrow}><AppGlyph name="back" size={18} color={p.onLime} /></View> : null}
  </Pressable>;
}

export function DetailMetrics({ items }: { items: Array<{ label: string; value: string }> }) {
  return <View testID="movement-detail-metrics" style={s.metrics}>{items.map((item, index) => <View key={item.label} style={[s.metric, index > 0 && s.metricBorder]}><Text style={s.metricValue}>{item.value}</Text><Text style={s.metricLabel}>{item.label}</Text></View>)}</View>;
}

export function DetailTabs({ selected, onChange, tabs }: { selected: string; onChange: (id: string) => void; tabs: Array<{ id: string; label: string; accessibilityLabel?: string }> }) {
  return <View accessibilityRole="tablist" style={s.tabs}>{tabs.map(tab => <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.accessibilityLabel || tab.label} accessibilityState={{ selected: selected === tab.id }} aria-selected={selected === tab.id} onPress={() => onChange(tab.id)} style={[s.tab, selected === tab.id && s.selectedTab]}><Text style={[s.tabText, selected === tab.id && s.selectedTabText]}>{tab.label}</Text></Pressable>)}</View>;
}

export function DetailSteps({ items }: { items: Array<{ text: string; title?: string }> }) {
  return <View style={s.steps}>{items.map((item, index) => <View key={index} style={s.step}>
    <View style={s.rail}>{index < items.length - 1 ? <View style={s.railLine} /> : null}<View style={s.number}><Text style={s.numberText}>{String(index + 1).padStart(2, '0')}</Text></View></View>
    <View style={s.stepCopy}>{item.title ? <Text style={s.stepTitle}>{item.title}</Text> : null}<Text style={s.body}>{item.text}</Text></View>
  </View>)}</View>;
}

export function DetailDisclosures({ items, warning = false, initialOpen = null }: {
  items: Array<{ id: string; title: string; content: ReactNode }>; warning?: boolean; initialOpen?: string | null;
}) {
  const [open, setOpen] = useState<string | null>(initialOpen);
  return <View>{items.map(item => <View key={item.id} style={[s.disclosure, warning && s.warningDisclosure]}>
    <Pressable accessibilityRole="button" accessibilityLabel={item.title} accessibilityState={{ expanded: open === item.id }} aria-expanded={open === item.id} onPress={() => setOpen(current => current === item.id ? null : item.id)} style={s.disclosureToggle}>
      {warning ? <AppGlyph name="info" size={18} color={p.warning} /> : null}<Text style={s.disclosureTitle}>{item.title}</Text><View style={{ transform: [{ rotate: open === item.id ? '-90deg' : '90deg' }] }}><AppGlyph name="chevron" size={16} /></View>
    </Pressable>
    {open === item.id ? <View style={s.disclosureBody}>{item.content}</View> : null}
  </View>)}</View>;
}

export const detailStyles = StyleSheet.create({
  section: { paddingTop: 22 }, sectionTitle: { color: p.text, fontSize: 18, lineHeight: 26, fontWeight: '800', marginBottom: 10 },
  body: { color: p.text, fontSize: 14, lineHeight: 23 }, muted: { color: p.muted, fontSize: 12, lineHeight: 20 },
  intro: { paddingTop: 18, paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.border, gap: 6 },
  introTitle: { color: p.text, fontSize: 17, lineHeight: 25, fontWeight: '800' }, source: { color: p.faint, fontSize: 11, lineHeight: 18, marginTop: 4 },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: p.background },
  header: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { width: 44, height: 48, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-start' }, heading: { flex: 1, minWidth: 0 },
  kicker: { color: p.lime, fontSize: 11, lineHeight: 18, fontWeight: '700' }, title: { color: p.text, fontSize: 27, lineHeight: 34, fontWeight: '900', letterSpacing: -.8 },
  subtitle: { color: p.faint, fontSize: 11, lineHeight: 18, marginTop: 3 }, ordinal: { flexShrink: 0 },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 80 },
  footer: { backgroundColor: p.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border },
  actions: { width: '100%', maxWidth: 440, alignSelf: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 12 },
  action: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: p.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primary: { flex: 1.55, backgroundColor: p.lime, borderColor: p.lime }, actionText: { color: p.text, fontSize: 13, fontWeight: '700', textAlign: 'center', flexShrink: 1, lineHeight: 19 }, primaryText: { color: p.onLime, fontWeight: '800' },
  disabled: { borderColor: p.oliveBorder, backgroundColor: p.olive }, disabledText: { color: p.muted }, pressed: { opacity: .7 }, arrow: { transform: [{ rotate: '180deg' }] },
  metrics: { flexDirection: 'row', paddingVertical: 17, marginBottom: 4 }, metric: { flex: 1, minWidth: 0, paddingHorizontal: 8 }, metricBorder: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: p.oliveBorder }, metricValue: { color: p.text, fontSize: 17, lineHeight: 24, fontWeight: '800', fontVariant: ['tabular-nums'] }, metricLabel: { color: p.muted, fontSize: 11, lineHeight: 18, marginTop: 3 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: p.border, marginTop: 2, marginBottom: 2 }, tab: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', paddingHorizontal: 5 }, selectedTab: { borderBottomColor: p.lime }, tabText: { color: p.muted, fontSize: 14, fontWeight: '600' }, selectedTabText: { color: p.text, fontWeight: '800' },
  steps: { paddingTop: 4 }, step: { flexDirection: 'row', gap: 13 }, rail: { width: 28, alignItems: 'center' }, railLine: { position: 'absolute', top: 26, bottom: 0, width: 1, backgroundColor: p.oliveBorder }, number: { width: 28, height: 28, borderRadius: 14, backgroundColor: p.lime, justifyContent: 'center', alignItems: 'center' }, numberText: { color: p.onLime, fontSize: 11, fontWeight: '900' }, stepCopy: { flex: 1, minWidth: 0, paddingBottom: 17, paddingTop: 2 }, stepTitle: { color: p.text, fontSize: 14, lineHeight: 21, fontWeight: '800', marginBottom: 4 }, body: { color: p.text, fontSize: 14, lineHeight: 23 },
  disclosure: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border }, warningDisclosure: { borderWidth: 1, borderColor: p.border, borderRadius: 10, marginBottom: 8 }, disclosureToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 10, paddingVertical: 12 }, disclosureTitle: { color: p.text, fontSize: 14, lineHeight: 21, fontWeight: '700', flex: 1 }, disclosureBody: { paddingHorizontal: 12, paddingBottom: 14 },
});
