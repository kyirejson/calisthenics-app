import React, { createContext, useContext } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { appPalette, colors, progressPageLayout, radius } from '../theme';

type Tone = 'light' | 'dark';
const ToneContext = createContext<Tone>('light');
export function UITheme({ children, tone = 'dark' }: { children: React.ReactNode; tone?: Tone }) {
  return <ToneContext.Provider value={tone}>{children}</ToneContext.Provider>;
}

export function Page({ children, scroll = true, style, scrollRef, tone = 'light', testID }: { children: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>; scrollRef?: React.Ref<ScrollView>; tone?: Tone; testID?: string }) {
  const content = <View style={[styles.pageInner, style]}>{children}</View>;
  return <UITheme tone={tone}><SafeAreaView testID={testID} style={[styles.safe, tone === 'dark' && { backgroundColor: appPalette.background }]}>{scroll ? <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{content}</ScrollView> : content}</SafeAreaView></UITheme>;
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
  const dark = useContext(ToneContext) === 'dark';
  return <View style={[styles.card, dark && { backgroundColor: appPalette.card, borderColor: appPalette.border, borderRadius: progressPageLayout.cardRadius, padding: 16 }, style]}>{children}</View>;
}

export function Button({ label, onPress, variant = 'dark', disabled = false }: { label: string; onPress: () => void; variant?: 'dark' | 'lime' | 'ghost' | 'danger'; disabled?: boolean }) {
  const dark = useContext(ToneContext) === 'dark';
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, styles[`button_${variant}`], dark && { minHeight: 44, borderRadius: 24, backgroundColor: variant === 'lime' ? appPalette.lime : variant === 'danger' ? '#713930' : appPalette.raised, borderWidth: variant === 'ghost' ? 1 : 0, borderColor: appPalette.border }, pressed && { opacity: 0.76 }, disabled && { opacity: 0.38 }]}>
      <Text style={[styles.buttonText, variant === 'ghost' && { color: colors.ink }, variant === 'lime' && { color: colors.ink }, dark && { fontSize: 13, color: variant === 'lime' ? appPalette.onLime : appPalette.text }]}>{label}</Text>
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
  const dark = useContext(ToneContext) === 'dark';
  return (
    <View style={styles.sectionTitle}>
      <Text style={[styles.sectionTitleText, dark && { ...progressPageLayout.sectionTitle, color: appPalette.text }]}>{title}</Text>
      {action ? <Pressable accessibilityRole="button" onPress={onAction} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[styles.sectionAction, dark && { color: appPalette.lime, fontSize: 12 }]}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function ProgressBar({ value, color = colors.lime }: { value: number; color?: string }) {
  const dark = useContext(ToneContext) === 'dark';
  return <View style={[styles.track, dark && { height: 5, backgroundColor: appPalette.border }]}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }]} /></View>;
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
  pageInner: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: progressPageLayout.content.paddingTop,
    paddingBottom: progressPageLayout.content.paddingBottom,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  eyebrow: { color: colors.inkMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 5, textTransform: 'uppercase' },
  title: { color: colors.ink, ...progressPageLayout.title },
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
