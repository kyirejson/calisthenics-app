import { StyleSheet, View } from 'react-native';
import type { FoodPortion } from '../../nutrition/types';
import { FoodArtwork } from './FoodArtwork';
import { type FoodArtworkInput } from '../../nutrition/foodArtwork';

export function MealArtwork({ portions, size = 64, name = '餐食', food }: {
  portions: readonly FoodPortion[]; photoEstimate?: boolean; size?: number; name?: string; food?: FoodArtworkInput | null;
}) {
  return <View testID="meal-artwork" accessibilityLabel={name + '食品图片，配图不代表本次实拍'} style={[styles.frame, { width: size, height: size }]}>
    <FoodArtwork size={size} food={food ?? (portions.length === 1 ? { id: portions[0].foodId, name } : undefined)} />
  </View>;
}
const styles = StyleSheet.create({
  frame: { flexShrink: 0, borderRadius: 12, overflow: 'hidden', backgroundColor: '#14191D', alignItems: 'center', justifyContent: 'center' },
});
