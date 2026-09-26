import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { createPortal } from 'react-dom';
import { registerConfirmEmitter, type ConfirmRequest } from '../utils/confirm';
import { colors, radius } from '../theme';

// web 端确认弹窗宿主：confirmAction 通过 registerConfirmEmitter 把请求交给这里渲染，
// 替代浏览器原生 window.confirm，保证与 APP 内弹层风格一致。
// 用 createPortal 直挂 body 末尾 + fixed + 最高 z-index（与 showMessage toast 同一机制），
// 保证盖过业务侧的 RN Modal；原生端 confirmAction 走 Alert.alert，本组件不渲染。
export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    registerConfirmEmitter((next) => setRequest(next));
    return () => registerConfirmEmitter(null);
  }, []);
  if (Platform.OS !== 'web' || !request || typeof document === 'undefined') return null;
  const close = () => setRequest(null);
  // RN 类型不认 'fixed'，但 react-native-web 运行时支持；这里是 web 专用分支。
  const fixed = { position: 'fixed' } as unknown as Record<string, string>;
  return createPortal(<View style={[styles.backdrop, fixed]}>
    <Pressable style={StyleSheet.absoluteFill} onPress={close} />
    <View style={styles.card}>
      <Text style={styles.title}>{request.title}</Text>
      <Text style={styles.message}>{request.message}</Text>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={close} style={styles.cancelButton}>
          <Text style={styles.cancelText}>{request.cancelLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => { const onConfirm = request.onConfirm; close(); onConfirm(); }}
          style={[styles.confirmButton, request.destructive && styles.confirmButtonDanger]}
        >
          <Text style={[styles.confirmText, request.destructive && styles.confirmTextDanger]}>{request.confirmLabel}</Text>
        </Pressable>
      </View>
    </View>
  </View>, document.body);
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 99998, backgroundColor: 'rgba(10,12,9,0.66)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, backgroundColor: colors.paper, borderRadius: radius.lg, padding: 22 },
  title: { color: colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  message: { color: colors.inkMuted, fontSize: 13, lineHeight: 20, marginTop: 9 },
  row: { flexDirection: 'row', gap: 10, marginTop: 19 },
  cancelButton: { flex: 1, minHeight: 50, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  confirmButton: { flex: 1.2, minHeight: 50, borderRadius: radius.pill, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  confirmButtonDanger: { backgroundColor: colors.danger },
  confirmText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  confirmTextDanger: { color: '#FFFFFF' },
});
