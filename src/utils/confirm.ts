import { Alert, Platform } from 'react-native';

type ConfirmOptions = {
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  onConfirm: () => void;
};

// web 端由 <ConfirmHost /> 注册应用内确认弹窗；未注册时退回 window.confirm。
let emitConfirm: ((request: ConfirmRequest) => void) | null = null;

export function registerConfirmEmitter(emit: ((request: ConfirmRequest) => void) | null) {
  emitConfirm = emit;
}

export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  options: ConfirmOptions = {},
) {
  const { confirmLabel = '确认', cancelLabel = '取消', destructive = false } = options;
  if (Platform.OS === 'web') {
    if (emitConfirm) {
      emitConfirm({ title, message, confirmLabel, cancelLabel, destructive, onConfirm });
      return;
    }
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

export function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      let toast = document.getElementById('app-web-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-web-toast';
        toast.style.position = 'fixed';
        toast.style.top = '28px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.backgroundColor = '#151714';
        toast.style.color = '#CDFA39';
        toast.style.border = '1px solid #32382F';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = '999px';
        toast.style.fontSize = '14px';
        toast.style.fontWeight = 'bold';
        toast.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.4)';
        toast.style.zIndex = '99999';
        toast.style.transition = 'all 0.25s ease';
        toast.style.pointerEvents = 'none';
        document.body.appendChild(toast);
      }
      toast.innerText = `${title} · ${message}`;
      toast.style.display = 'block';
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
      setTimeout(() => {
        if (!toast) return;
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-8px)';
        // 淡出结束后移除节点，避免残留在无障碍树里。
        setTimeout(() => { toast?.remove(); }, 300);
      }, 3000);
      return;
    }
    if (typeof window !== 'undefined') {
      console.log(`[Message] ${title}: ${message}`);
    }
    return;
  }
  Alert.alert(title, message);
}
