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

export function ProgressBar({ value, color = colors.lime }: { value: number; color?: string }) {
  const dark = useContext(ToneContext) === 'dark';
  return <View style={[styles.track, dark && { height: 5, backgroundColor: appPalette.border }]}><View style={[styles.fill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }]} /></View>;
}

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
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 18, borderWidth: 1, borderColor: colors.line },
  button: { minHeight: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  button_dark: { backgroundColor: colors.ink },
  button_lime: { backgroundColor: colors.lime },
  button_ghost: { backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1 },
  button_danger: { backgroundColor: colors.danger },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  track: { height: 8, borderRadius: 6, overflow: 'hidden', backgroundColor: '#E8E6DF' },
  fill: { height: '100%', borderRadius: 6 },
});
