import React from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../theme';

export function Page({ children, scroll = true, style }: { children: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  const content = <View style={[styles.pageInner, style]}>{children}</View>;
  return <SafeAreaView style={styles.safe}>{scroll ? <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView> : content}</SafeAreaView>;
}

export function Header({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ label, onPress, variant = 'dark', disabled = false }: { label: string; onPress: () => void; variant?: 'dark' | 'lime' | 'ghost' | 'danger'; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, styles[`button_${variant}`], pressed && { opacity: 0.76 }, disabled && { opacity: 0.38 }]}>
      <Text style={[styles.buttonText, variant === 'ghost' && { color: colors.ink }, variant === 'lime' && { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      {action ? <Pressable onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function ProgressBar({ value, color = colors.lime }: { value: number; color?: string }) {
  return <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }]} /></View>;
}

export const commonStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { color: colors.inkMuted, fontSize: 14, lineHeight: 21 },
  label: { color: colors.inkMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  h2: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  h3: { color: colors.ink, fontSize: 17, fontWeight: '800' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  pageInner: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  eyebrow: { color: colors.inkMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 5, textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900', letterSpacing: -1.2 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 18, borderWidth: 1, borderColor: colors.line },
  button: { minHeight: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  button_dark: { backgroundColor: colors.ink },
  button_lime: { backgroundColor: colors.lime },
  button_ghost: { backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1 },
  button_danger: { backgroundColor: colors.danger },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  pill: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, marginRight: 8 },
  pillActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { color: colors.inkMuted, fontSize: 13, fontWeight: '700' },
  pillTextActive: { color: '#FFFFFF' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 },
  sectionTitleText: { color: colors.ink, fontSize: 19, fontWeight: '900', letterSpacing: -0.3 },
  sectionAction: { color: colors.blue, fontWeight: '700', fontSize: 14 },
  track: { height: 8, borderRadius: 6, overflow: 'hidden', backgroundColor: '#E8E6DF' },
  fill: { height: '100%', borderRadius: 6 },
});
