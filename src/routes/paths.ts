export const ROUTES = {
  planner: '/',
  calendar: '/calendar',
  library: '/library',
  addMeal: '/library/new',
  editMeal: '/library/:mealId',
  mealDetail: '/library/:mealId/view',
  shoppingList: '/shopping-list',
  settings: '/settings',
} as const;

export function editMealPath(mealId: string) {
  return `/library/${mealId}`;
}

export function mealDetailPath(mealId: string) {
  return `/library/${mealId}/view`;
}
