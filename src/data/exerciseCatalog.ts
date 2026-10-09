import type { Exercise, Workout } from '../types';
import { supportExercises } from './supportExercises';

// Curated reference data only. Selection, gating and prescriptions live in domain/training.
const originals = require('./legacy/exercises.js') as Exercise[];
const templates = require('./legacy/templates.js') as { workouts: Record<string, Workout> };
export const exercises: Exercise[] = [...originals, ...supportExercises];
export const workouts = templates.workouts;
