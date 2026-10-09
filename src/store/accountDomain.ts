import type { Goal, Profile, Settings } from '../types';
import {
  captureTrainingTopic,
  switchTrainingTopic,
} from '../domain/training/trainingTopicProfiles';
import { normalizeProfile, normalizeSettings } from './profile';
import { storageKeys as keys, type DomainContext } from './contracts';
import { createWriteQueue } from './writeQueue';
export function createAccountDomain(context: DomainContext) {
  const queue = createWriteQueue(context.guard);
  const updateProfile = (change: (current: Profile | null) => Profile) =>
    queue.enqueue(async () => {
      context.assertWritable(keys.profile);
      const current = context.read().profile,
        next = change(current);
      const profile = normalizeProfile({
        ...next,
        topicPlans: {
          ...current?.topicPlans,
          ...next.topicPlans,
          ...(current && current.goal !== next.goal
            ? { [current.goal]: captureTrainingTopic(current) }
            : {}),
        },
      });
      await context.storage.setItem(keys.profile, JSON.stringify(profile));
      context.commit({ profile });
    });
  return {
    drain: queue.drain,
    actions: {
      saveProfile: (profile: Profile) =>
        updateProfile((current) => {
          if (current) throw Error('档案已存在，请只提交需要修改的字段。');
          return profile;
        }),
      patchProfile: (patch: Partial<Profile> | ((current: Profile) => Partial<Profile>)) =>
        updateProfile((current) => {
          if (!current) throw Error('请先建立个人资料');
          const changes = typeof patch === 'function' ? patch(current) : patch;
          if (changes.goal !== undefined && changes.goal !== current.goal)
            throw Error('请通过专题切换入口更改训练目标。');
          return { ...current, ...changes };
        }),
      switchTrainingGoal: (goal: Goal) =>
        updateProfile((current) => {
          if (!current) throw Error('请先建立个人资料');
          return switchTrainingTopic(current, goal);
        }),
      updateSettings: (patch: Partial<Settings>) =>
        queue.enqueue(async () => {
          context.assertWritable(keys.settings);
          const settings = normalizeSettings({ ...context.read().settings, ...patch });
          await context.storage.setItem(keys.settings, JSON.stringify(settings));
          context.commit({ settings });
        }),
    },
  };
}
