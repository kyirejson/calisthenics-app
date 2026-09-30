import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform } from 'react-native';
import { progressMotion } from '../data/progressChart';

export function useReducedMotion(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(() => Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : null);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setReduced(query.matches);
      query.addEventListener('change', update);
      update();
      return () => query.removeEventListener('change', update);
    }
    let alive = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { if (alive) setReduced(value); });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduced(value); }).catch(() => { if (alive) setReduced(true); });
    return () => { alive = false; subscription.remove(); };
  }, []);
  return reduced;
}

/** Transform/opacity only: native driver on devices, no React render per frame. */
export function useProgressMotion(revealKey: string, ready: boolean) {
  const reduced = useReducedMotion();
  const stairs = useRef(new Animated.Value(0.02)).current;
  const curve = useRef(new Animated.Value(0.02)).current;
  useEffect(() => {
    if (!ready || reduced === null) return;
    stairs.stopAnimation(); curve.stopAnimation();
    if (reduced) { stairs.setValue(1); curve.setValue(1); return; }
    stairs.setValue(0.02); curve.setValue(0.02);
    const common = { easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false };
    const animation = Animated.parallel([
      Animated.timing(stairs, { ...common, toValue: 1, duration: progressMotion.stairsMs }),
      Animated.timing(curve, { ...common, toValue: 1, duration: progressMotion.curveMs, delay: progressMotion.curveDelayMs }),
    ]);
    animation.start();
    const background = AppState.addEventListener('change', state => {
      if (state !== 'active') { animation.stop(); stairs.setValue(1); curve.setValue(1); }
    });
    return () => { animation.stop(); background.remove(); };
  }, [revealKey, ready, reduced, stairs, curve]);
  return { stairs, curve, reduced };
}

/** Route changes animate one native value, not a timer / render for each row. */
export function useRouteReveal(revealKey: string, reduced: boolean | null) {
  const reveal = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    reveal.stopAnimation();
    if (reduced !== false) { reveal.setValue(1); return; }
    reveal.setValue(0);
    const animation = Animated.timing(reveal, {
      toValue: 1, duration: 420, easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web', isInteraction: false,
    });
    animation.start();
    const background = AppState.addEventListener('change', state => { if (state !== 'active') { animation.stop(); reveal.setValue(1); } });
    return () => { animation.stop(); background.remove(); };
  }, [revealKey, reduced, reveal]);
  return reveal;
}
