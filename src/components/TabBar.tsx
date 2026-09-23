import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

export type TabKey = 'today' | 'plans' | 'progress' | 'profile';

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'today', label: '今日', icon: '●' },
  { key: 'plans', label: '计划', icon: '▦' },
  { key: 'progress', label: '进阶', icon: '↗' },
  { key: 'profile', label: '我的', icon: '○' },
];

export function TabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const selected = active === tab.key;
          return (
            <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={styles.item}>
              <View style={[styles.icon, selected && styles.iconActive]}><Text style={[styles.iconText, selected && styles.iconTextActive]}>{tab.icon}</Text></View>
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
  iconText: { color: '#8E9188', fontWeight: '900', fontSize: 17 },
  iconTextActive: { color: colors.ink },
  label: { color: '#8E9188', fontSize: 11, fontWeight: '700' },
  labelActive: { color: '#FFFFFF' },
});
