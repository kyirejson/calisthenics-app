import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
function TabIcon({ tab, active }: { tab: TabKey; active: boolean }) {
  const tone = active ? colors.ink : '#8E9188';
  if (tab === 'today') {
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

export function TabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const selected = active === tab.key;
          return (
            <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={styles.item}>
              <View style={[styles.icon, selected && styles.iconActive]}><TabIcon tab={tab.key} active={selected} /></View>
              <Text style={[styles.label, selected && styles.labelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 12 },
  bar: { height: 74, borderRadius: radius.lg, backgroundColor: '#171914', flexDirection: 'row', paddingHorizontal: 8, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  icon: { width: 30, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  iconActive: { backgroundColor: colors.lime },
  label: { color: '#8E9188', fontSize: 11, fontWeight: '700' },
  labelActive: { color: '#FFFFFF' },

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
