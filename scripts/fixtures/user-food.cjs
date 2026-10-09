// Synthetic user-entered label fixture; never bundled with the application.
const { createCustomFoodFromLabel } = require('../../src/nutrition/engine.ts');
const food = createCustomFoodFromLabel({ id: 'custom-test-label', name: '测试标签食品', basisGrams: 100, energyUnit: 'kcal', calories: 100, protein: 10, carbs: 10, fat: 2, fiber: 1, allergens: [] });
const FOODS = [food, { ...food, id: 'custom-test-label-two' }];
module.exports = { food, FOODS, getFood: id => FOODS.find(item => item.id === id) };
