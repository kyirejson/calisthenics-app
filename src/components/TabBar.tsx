import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius } from '../theme';

export type TabKey = 'today' | 'progress' | 'data' | 'profile';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'today', label: '今日' },
  { key: 'progress', label: '进阶' },
  { key: 'data', label: '数据' },
  { key: 'profile', label: '我的' },
];

// 用基本 View 自绘图标（日历 / 上扬箭头 / 人形），替代辨识度弱的 ● ↗ ○ 字形；
// 项目未引入图标字体库，纯 View 在三端渲染一致。
function TabIcon({ tab, active, editorial }: { tab: TabKey; active: boolean; editorial: boolean }) {
  const tone = active ? editorial ? colors.lime : colors.ink : '#8E9188';
  if (tab === 'today') {
    if (editorial) return <Svg width={23} height={23} viewBox="0 0 24 24"><Path d="M3 10l9-8 9 8v11h-6v-7H9v7H3V10z" fill={tone} /></Svg>;
    return <View style={[styles.iconBox, { borderColor: tone }]}>
      <View style={[styles.iconBar, { backgroundColor: tone }]} />
      <View style={[styles.iconDot, { backgroundColor: tone }]} />
    </View>;
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

export function TabBar({ active, onChange, appearance = 'default' }: { active: TabKey; onChange: (tab: TabKey) => void; appearance?: 'default' | 'editorial' | 'profile' }) {
  const editorial = appearance !== 'default';
  return (
    <View style={[styles.wrap, editorial && styles.editorialWrap]}>
      <View style={[styles.bar, editorial && styles.editorialBar]}>
        {tabs.map((tab) => {
          const selected = active === tab.key;
          return (
            <Pressable key={tab.key} accessibilityRole="tab" accessibilityLabel={'切换到' + tab.label} accessibilityState={{ selected }} aria-selected={selected} onPress={() => onChange(tab.key)} style={styles.item}>
              <View style={[styles.icon, selected && !editorial && styles.iconActive, selected && appearance === 'profile' && styles.profileIconActive]}><TabIcon tab={tab.key} active={selected} editorial={editorial} /></View>
              <Text style={[styles.label, selected && styles.labelActive, selected && editorial && styles.editorialActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 12, paddingHorizontal: 16, alignItems: 'center', pointerEvents: 'box-none' },
  bar: { width: '100%', maxWidth: 408, height: 74, borderRadius: radius.lg, backgroundColor: '#171C20', borderWidth: 1, borderColor: '#343C48', flexDirection: 'row', paddingHorizontal: 8, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  item: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 3 },
  icon: { width: 30, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  iconActive: { backgroundColor: colors.lime },
  label: { color: '#8E9188', fontSize: 11, fontWeight: '700' },
  labelActive: { color: '#FFFFFF' },
  editorialWrap: { bottom: 0, paddingHorizontal: 0 },
  editorialBar: { maxWidth: 440, height: 68, borderRadius: 0, borderWidth: 0, borderTopWidth: 1, borderTopColor: '#25312C', backgroundColor: '#0D1114', shadowOpacity: 0, elevation: 0 },
  editorialActive: { color: colors.lime },
  profileIconActive: { width: 56, borderRadius: 20, backgroundColor: '#242E20' },

  iconBox: { width: 15, height: 15, borderWidth: 2, borderRadius: 4, alignItems: 'center' },
  iconBar: { width: 9, height: 2, borderRadius: 1, marginTop: 1.5 },
  iconDot: { width: 3, height: 3, borderRadius: 2, marginTop: 1.5 },

  iconChevron: { width: 11, height: 11, borderTopWidth: 2.5, borderRightWidth: 2.5, borderTopLeftRadius: 1, marginTop: 5, marginLeft: 3 },

  iconBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2.5 },
  iconBarSmall: { width: 3.5, height: 7, borderRadius: 1 },
  iconBarMid: { width: 3.5, height: 11, borderRadius: 1 },
  iconBarTall: { width: 3.5, height: 15, borderRadius: 1 },

  iconPerson: { alignItems: 'center' },
  iconHead: { width: 7, height: 7, borderRadius: 4 },
  iconBody: { width: 14, height: 7.5, borderTopLeftRadius: 7, borderTopRightRadius: 7, marginTop: 1.5 },
});
