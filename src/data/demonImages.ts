import type { ImageSourcePropType } from 'react-native';
import { demonImageMap } from './private/supplementalImageMaps';
export { demonImageMap };

export function getDemonImage(exerciseId: string | null | undefined): ImageSourcePropType | undefined {
  return exerciseId ? demonImageMap[exerciseId] : undefined;
}
