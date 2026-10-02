import { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { resolveRecipeArtwork, type RecipeArtworkKey } from '../../nutrition/presentation';
import type { FoodPortion } from '../../nutrition/types';
import { FoodArtwork } from './FoodArtwork';
import { type FoodArtworkInput } from '../../nutrition/foodArtwork';

const illustrations: Record<RecipeArtworkKey, ImageSourcePropType> = {
  'soy-banana-oats': require('../../../assets/nutrition-recipes/soy-banana-oats-v1.png'),
  'chicken-mushroom-pasta': require('../../../assets/nutrition-recipes/chicken-mushroom-pasta-v1.png'),
  'chickpea-cucumber-snack': require('../../../assets/nutrition-recipes/chickpea-cucumber-snack-v1.png'),
  'tilapia-bok-choy-rice': require('../../../assets/nutrition-recipes/tilapia-bok-choy-rice-v1.png'),
};

export function MealArtwork({ portions, photoEstimate = false, size = 64, name = '餐食', food }: {
  portions: readonly FoodPortion[]; photoEstimate?: boolean; size?: number; name?: string; food?: FoodArtworkInput | null;
}) {
  const key = photoEstimate ? undefined : resolveRecipeArtwork(portions);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [key]);
  const label = key ? name + '菜谱配图（示意）' : name + '食品图片，配图不代表本次实拍';
  return <View testID="meal-artwork" accessibilityLabel={label} style={[styles.frame, { width: size, height: size }]}>
    {key && !failed ? <Image testID="meal-recipe-image" source={illustrations[key]} resizeMode="contain" accessibilityLabel={label} style={styles.image} onError={() => setFailed(true)} />
      : <FoodArtwork size={size} food={food ?? (portions.length === 1 ? { id: portions[0].foodId, name } : undefined)} />}
  </View>;
}

const styles = StyleSheet.create({
  frame: { flexShrink: 0, borderRadius: 12, overflow: 'hidden', backgroundColor: '#14191D', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
});
