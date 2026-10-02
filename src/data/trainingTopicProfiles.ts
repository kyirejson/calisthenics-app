import type { Goal, Profile, TrainingTopicConfig } from '../types';
import { recommendPlanId, RETIRED_PLAN_ID } from './trainingPlans';

export function captureTrainingTopic(profile: Profile): TrainingTopicConfig {
  const { frequency, sessionMinutes, trainingRestSeconds, experience, planId, planStartedAt,
    equipmentSplit, equipmentTrainingDays, equipmentAvailableGear, equipmentPriority, equipmentMovementOverrides } = profile;
  return { frequency, sessionMinutes, trainingRestSeconds, experience, planId, planStartedAt,
    equipmentSplit, equipmentTrainingDays, equipmentAvailableGear, equipmentPriority, equipmentMovementOverrides };
}

export function switchTrainingTopic(profile: Profile, goal: Goal): Profile {
  const topicPlans = { ...profile.topicPlans, [profile.goal]: captureTrainingTopic(profile) };
  const saved = topicPlans[goal];
  const restored = saved?.planId === RETIRED_PLAN_ID ? undefined : saved;
  const firstPlan: TrainingTopicConfig = {
    frequency: goal === 'equipment' ? 4 : 3, experience: profile.experience,
    trainingRestSeconds: goal === 'street_mastery' ? 180 : 120,
    sessionMinutes: goal === 'equipment' ? undefined : 45,
    planStartedAt: new Date().toISOString(), planId: recommendPlanId({ goal }),
    ...(goal === 'equipment' ? { equipmentSplit: 'upper_lower' as const, equipmentTrainingDays: undefined,
      equipmentAvailableGear: profile.equipmentAvailableGear, equipmentPriority: 'balanced' as const, equipmentMovementOverrides: {} } : {}),
  };
  return { ...profile, ...firstPlan, ...(restored || {}), goal, topicPlans };
}
