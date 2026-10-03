import type { DailyWorkoutEdits, Profile, TrainingSession } from '../types';
import type { NutritionJournal } from '../nutrition/types';
import type { AdviceContext } from '../nutrition/agentClient';
import { getNutritionTrainingContext } from '../nutrition/training';
import { buildNutritionMenu } from '../nutrition/adjustments';
import { sumNutrients } from '../nutrition/engine';
import { summarizeNutritionWeek } from '../nutrition/timeline';
import { MEAL_SLOTS } from '../nutrition/state';
import { photoUsesOnlyLabels } from '../nutrition/vision';
import { agentWeightContext } from './weightContext';
export function personalAgentContext(profile: Profile, journal: NutritionJournal, sessions: TrainingSession[], edits: DailyWorkoutEdits, date: string): AdviceContext {
  const training = getNutritionTrainingContext(profile, sessions, edits, date), menu = buildNutritionMenu(profile, journal, training, date);
  const entries = journal.entries.filter(e => e.date === date), day = journal.days[date], review = summarizeNutritionWeek(journal, profile, sessions, date);
  const available = MEAL_SLOTS.filter(slot => menu.meals.some(m => m.slot === slot) && !entries.some(e => e.slot === slot) && !day?.confirmedSlots.includes(slot));
  return { safetyStatus: menu.targets.status, preferences: journal.preferences, targets: menu.targets,
    consumed: sumNutrients(entries.map(e => e.nutrients)), menu: menu.meals.map(m => ({ slot: m.slot, name: m.name, nutrients: m.nutrients, editable: available.includes(m.slot) })),
    logging: { date, confirmedSlots: day?.confirmedSlots || [], skippedSlots: day?.skippedSlots || [], recordedSlots: [...new Set(entries.map(e => e.slot))], complete: !!day?.completedAt, recordCount: entries.length, containsPhoto: entries.some(e => e.photoEstimate && !photoUsesOnlyLabels(e.photoEstimate)) },
    training: { ...training, time: journal.trainingTime }, weekly: { completeDays: review.completeDays, comparableDays: review.comparableDays, trainingDays: review.trainingDays, photoDays: review.photoDays, status: review.status, average: review.average },
    weightTrend: agentWeightContext(profile, new Date(date + 'T12:00:00')),
    toolsAllowed: menu.targets.status === 'ready' && available.length > 0 && !day?.completedAt };
}
