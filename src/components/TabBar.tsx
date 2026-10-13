import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

export type TabKey = 'today' | 'progress' | 'data' | 'profile';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'today', label: '今日' },
  { key: 'progress', label: '进阶' },
  { key: 'data', label: '数据' },
  { key: 'profile', label: '我的' },
];

// Home uses SVG; the other icons use simple Views without an icon-font dependency.
function TabIcon({ tab, active }: { tab: TabKey; active: boolean }) {
  const tone = active ? colors.lime : '#8E9188';
  if (tab === 'today') {
    return <Svg width={23} height={23} viewBox="0 0 24 24"><Path d="M3 10l9-8 9 8v11h-6v-7H9v7H3V10z" fill={tone} /></Svg>;
  }
  if (tab === 'progress') {
    return <View style={[styles.iconChevron, { borderTopColor: tone, borderRightColor: tone }]} />;
  }
  if (tab === 'data') {
    return <View style={styles.iconBars}>
      <View style={[styles.iconBarSmall, { backgroundColor: tone }]} />
      <View style={[styles.iconBarMid, { backgroundColor: tone }]} />
      <View style={[styles.iconBarTall, { backgroundColor: tone }]} />
    </View>;
  }
  return <View style={styles.iconPerson}>
    <View style={[styles.iconHead, { backgroundColor: tone }]} />
    <View style={[styles.iconBody, { backgroundColor: tone }]} />
  </View>;
}

export function TabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <View testID="bottom-navigation" style={styles.wrap}>
      <View accessibilityRole="tablist" style={styles.bar}>
        {tabs.map((tab) => {
          const selected = active === tab.key;
          return (
            <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={'切换到' + tab.label} accessibilityState={{ selected }} aria-selected={selected} onPress={() => onChange(tab.key)} style={styles.item}>
              <View style={styles.icon}><TabIcon tab={tab.key} active={selected} /></View>
              <Text style={[styles.label, selected && styles.labelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', backgroundColor: '#0D1114', pointerEvents: 'box-none' },
  bar: { width: '100%', maxWidth: 440, height: 68, borderRadius: 0, borderTopWidth: 1, borderTopColor: '#25312C', backgroundColor: '#0D1114', flexDirection: 'row', paddingHorizontal: 8, alignItems: 'center' },
  item: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 3 },
  icon: { width: 30, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  label: { color: '#8E9188', fontSize: 11, fontWeight: '700' },
  labelActive: { color: colors.lime },

  iconChevron: { width: 11, height: 11, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopLeftRadius: 1, marginTop: 5, marginLeft: 3 },

  iconBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2.5 },
  iconBarSmall: { width: 3.5, height: 7, borderRadius: 1 },
  iconBarMid: { width: 3.5, height: 11, borderRadius: 1 },
  iconBarTall: { width: 3.5, height: 15, borderRadius: 1 },

  iconPerson: { alignItems: 'center' },
  iconHead: { width: 7, height: 7, borderRadius: 4 },
  iconBody: { width: 14, height: 7.5, borderTopLeftRadius: 7, borderTopRightRadius: 7, marginTop: 1.5 },
});
