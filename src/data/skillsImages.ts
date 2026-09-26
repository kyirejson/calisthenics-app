import type { ImageSourcePropType } from 'react-native';
import { skillsImageMap } from './private/supplementalImageMaps';
export { skillsImageMap };

export function getSkillImage(exerciseId: string | null | undefined): ImageSourcePropType | undefined {
  return exerciseId ? skillsImageMap[exerciseId] : undefined;
}
