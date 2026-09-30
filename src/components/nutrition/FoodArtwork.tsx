import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { resolveFoodArtwork, type FoodArtworkInput } from '../../nutrition/foodArtwork';
import { nutritionPhotoURI, releasePhotoURI } from '../../nutrition/photoStorage';

const assets: Record<string, ImageSourcePropType> = {
  staples: require('../../../assets/nutrition-foods/staples-v1.jpg'), vegetables: require('../../../assets/nutrition-foods/vegetables-v1.jpg'),
  fruit: require('../../../assets/nutrition-foods/fruit-v1.jpg'), meat: require('../../../assets/nutrition-foods/meat-v1.jpg'),
  seafood: require('../../../assets/nutrition-foods/seafood-v1.jpg'), dairy: require('../../../assets/nutrition-foods/dairy-v1.jpg'),
  legumes: require('../../../assets/nutrition-foods/legumes-v1.jpg'), nuts: require('../../../assets/nutrition-foods/nuts-v1.jpg'),
  condiments: require('../../../assets/nutrition-foods/condiments-v1.jpg'), mixed: require('../../../assets/nutrition-foods/mixed-v1.jpg'),
  egg: require('../../../assets/nutrition-foods/egg-v1.jpg'), tomato: require('../../../assets/nutrition-foods/tomato-v1.jpg'),
  oil: require('../../../assets/nutrition-foods/oil-v1.jpg'),
};

/** Private user image first; immediately available, labelled local artwork underneath. */
export function FoodArtwork({ food, size = 52 }: { food?: FoodArtworkInput | null; size?: number }) {
  const artwork = resolveFoodArtwork(food);
  const photoId = food?.photo?.id;
  const [stored, setStored] = useState<{ id: string; uri: string } | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    let active = true, ownedURI: string | null = null;
    setStored(null); setLoaded(null);
    if (photoId) void nutritionPhotoURI(photoId).then(uri => {
      if (!active) { releasePhotoURI(uri); return; }
      ownedURI = uri;
      if (uri) setStored({ id: photoId, uri });
    }).catch(() => { /* Missing or inaccessible photos fall back without losing food data. */ });
    return () => { active = false; releasePhotoURI(ownedURI); };
  }, [photoId]);
  const uri = stored && stored.id === photoId ? stored.uri : null;
  const personalVisible = !!uri && loaded === uri;
  const label = personalVisible ? food?.name + (food?.photo?.kind === 'label' ? '，用户保存的包装标签照片' : '，用户保存照片') : artwork.accessibilityLabel;
  return <View testID="food-artwork" accessibilityLabel={label} style={[s.frame, { width: size, height: size, borderRadius: Math.min(14, size * .22) }]}>
    <Image testID="food-artwork-fallback" source={assets[artwork.asset]} resizeMode="cover" accessibilityLabel={artwork.accessibilityLabel} accessibilityElementsHidden={personalVisible} importantForAccessibility={personalVisible ? 'no' : 'auto'} style={s.image} />
    {uri ? <Image key={uri} testID="food-artwork-personal" source={{ uri }} resizeMode="cover" accessibilityLabel={food?.name + '用户照片'}
      style={[s.personal, { opacity: personalVisible ? 1 : 0 }]} onLoad={() => setLoaded(uri)} onError={() => setLoaded(null)} /> : null}
    {!personalVisible || food?.photo?.kind === 'label' ? <Text testID="food-artwork-badge" style={s.badge}>{personalVisible ? '包装' : artwork.badge}</Text> : null}
  </View>;
}
const s = StyleSheet.create({
  frame: { flexShrink: 0, overflow: 'hidden', backgroundColor: '#1B2028' }, image: { width: '100%', height: '100%' },
  personal: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  badge: { position: 'absolute', bottom: 0, right: 0, color: '#D7DDE5', backgroundColor: 'rgba(13,17,20,.82)', fontSize: 9, lineHeight: 14, paddingHorizontal: 4, borderTopLeftRadius: 5 },
});
