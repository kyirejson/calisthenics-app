export type NutritionObjective = 'fat_loss' | 'muscle_gain' | 'maintain' | 'performance';
export type EatingPattern = 'balanced' | 'vegetarian' | 'low_carb' | 'keto';
export type Allergen = 'milk' | 'egg' | 'soy' | 'wheat' | 'peanut' | 'tree_nut' | 'fish' | 'shellfish';
export type NutritionRisk = 'pregnancy' | 'medical_condition' | 'glucose_medication' | 'sglt2' | 'eating_disorder';
export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type TrainingTime = 'unspecified' | 'morning' | 'midday' | 'evening';
export type FoodArtworkCategory = 'staples' | 'vegetables' | 'fruit' | 'meat' | 'seafood' | 'dairy' | 'legumes' | 'nuts' | 'eggs' | 'oil' | 'condiments' | 'mixed';

export type NutritionTrainingContext = {
  type: 'strength' | 'cardio' | 'recovery';
  title: string;
  plannedMinutes: number;
  completedMinutes: number;
  completedSets: number;
  sessionCount: number;
  status: 'planned' | 'partial' | 'complete' | 'rest';
};

export type Nutrients = { calories: number; protein: number; carbs: number; fat: number; fiber: number };
export type NutritionPreferences = {
  version: 1;
  objective: NutritionObjective;
  pattern: EatingPattern;
  activity: 'sedentary' | 'light' | 'active';
  allergens: Allergen[];
  riskFlags: NutritionRisk[];
  screeningCompletedAt: string | null;
  maxCookingMinutes: 15 | 30 | 45;
  budget: 'economy' | 'standard';
};
export type Food = {
  id: string;
  name: string;
  aliases: string[];
  state: string;
  per100g: Nutrients;
  allergens: Allergen[];
  vegetarian: boolean;
  fiberKnown?: boolean;
  serving?: { label: string; grams: number };
  packageGrams?: number;
  photo?: NutritionPhoto;
  artworkCategory?: FoodArtworkCategory;
  source: { title: string; url: string; foodCode: string; version: string; license: string; kind?: 'user_label'; origin?: FoodImportOrigin };
};
export type FoodImportOrigin = { provider: 'label_photo' | 'open_food_facts'; identifier: string; fetchedAt: string; url: string; license: string };
export type FoodLabelDraft = {
  name: string; state: string; basisUnit: 'g' | 'ml' | 'unknown'; basisAmount: number | null;
  energyUnit: 'kcal' | 'kJ' | null; calories: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null;
  serving: { label: string; grams: number } | null; allergens: Allergen[]; warnings: string[]; origin: FoodImportOrigin;
  packageGrams?: number | null;
};
export type FoodPortion = { foodId: string; grams: number };
export type Recipe = {
  id: string;
  name: string;
  slots: MealSlot[];
  ingredients: FoodPortion[];
  steps: string[];
  minutes: number;
  budget: 'economy' | 'standard';
  vegetarian: boolean;
};
export type PlannedMeal = {
  slot: MealSlot;
  recipeId: string;
  name: string;
  ingredients: FoodPortion[];
  nutrients: Nutrients;
  minutes: number;
  steps: string[];
};
export type NutritionTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  bmr: number;
  tdee: number;
  status: 'ready' | 'needs_setup' | 'blocked' | 'unsupported';
  message: string;
};
export type DailyMenu = {
  date: string;
  signature: string;
  planningSignature: string;
  targets: NutritionTargets;
  meals: PlannedMeal[];
  totals: Nutrients;
  warnings: string[];
};
export type NutritionTargetSnapshot = {
  signature: string;
  capturedAt: string;
  targets: NutritionTargets;
  objective: NutritionObjective | null;
  pattern: EatingPattern | null;
  activity: NutritionPreferences['activity'] | null;
  body: { age: number; sex: 'male' | 'female' | 'unspecified'; height: number; weight: number };
  training: { type: NutritionTrainingContext['type']; title: string; plannedMinutes: number; time: TrainingTime };
};
export type NutritionDayState = {
  targetHistory: NutritionTargetSnapshot[];
  confirmedSlots: MealSlot[];
  completedAt: string | null;
};
export type NutritionMealOverride = {
  basis: string;
  meal: PlannedMeal;
  createdAt: string;
  kind: 'swap' | 'rebalance';
};
export type NutritionPlanningContext = {
  training?: Pick<NutritionTrainingContext, 'type'>;
  trainingTime?: TrainingTime;
  overrides?: Record<string, NutritionMealOverride>;
};
/** The model may propose an intent, never quantities, targets, or database IDs. */
export type NutritionAgentAction = {
  type: 'swap_meal' | 'rebalance_meal';
  slot: MealSlot | 'next';
  focus: 'balanced' | 'protein' | 'quick';
};
export type IntakeEntry = {
  id: string;
  date: string;
  slot: MealSlot;
  name: string;
  portions: FoodPortion[];
  nutrients: Nutrients;
  source: 'manual' | 'planned_meal' | 'photo_estimate';
  photoEstimate?: import('./vision').PhotoEstimate;
  sourceKey?: string;
  createdAt: string;
  updatedAt: string;
  foodDataVersion: string;
  customFoods?: Food[];
  fiberIncomplete?: boolean;
  photos?: NutritionPhoto[];
};
/** Opaque local asset references only; never put base64 or remote URLs in the journal. */
export type NutritionPhoto = { id: string; kind: 'food' | 'label'; capturedAt: string };
export type NutritionJournal = {
  version: 1;
  photoConsentAt: string | null;
  assistant: import('./assistantState').AssistantState;
  preferences: NutritionPreferences | null;
  manualAllergens?: Allergen[];
  entries: IntakeEntry[];
  mealRevisions: Record<string, number>;
  customFoods: Food[];
  savedMeals: IntakeEntry[];
  trainingTime: TrainingTime;
  days: Record<string, NutritionDayState>;
  mealOverrides: Record<string, NutritionMealOverride>;
};

export type CustomFoodLabelInput = {
  id: string; name: string; state?: string; basisGrams: number; calories: number;
  energyUnit: 'kcal' | 'kJ'; protein: number; carbs: number; fat: number;
  fiber?: number; allergens: Allergen[]; serving?: { label: string; grams: number };
  origin?: FoodImportOrigin;
  packageGrams?: number;
};
