import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** RN Modal on Android has a separate window: do not depend on Activity resize alone. */
export function useAssistantKeyboard() {
  const [bottom, setBottom] = useState<number | undefined>();
  const [webFrame, setWebFrame] = useState<{ height: number; top: number }>();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const viewport = window.visualViewport;
      if (!viewport) return;
      const update = () => { setWebFrame({ height: viewport.height, top: viewport.offsetTop }); setOpen(window.innerHeight - viewport.height > 120); };
      update(); viewport.addEventListener('resize', update); viewport.addEventListener('scroll', update);
      return () => { viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update); };
    }
    const show = Keyboard.addListener('keyboardDidShow', e => { setOpen(true); if (Platform.OS === 'android') setBottom(e.endCoordinates.screenY); });
    const hide = Keyboard.addListener('keyboardDidHide', () => { setOpen(false); setBottom(undefined); });
    return () => { show.remove(); hide.remove(); };
  }, []);
  return { bottom, webFrame, open };
}
