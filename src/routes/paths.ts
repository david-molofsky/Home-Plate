export const ROUTES = {
  planner: '/',
  calendar: '/calendar',
  library: '/library',
  addMeal: '/library/new',
  importRecipe: '/library/import',
  editMeal: '/library/:mealId',
  mealDetail: '/library/:mealId/view',
  cookingMode: '/library/:mealId/cook',
  shoppingList: '/shopping-list',
  settings: '/settings',
  schoolLunchMenu: '/settings/school-lunch/:menuId',
} as const;

export function editMealPath(mealId: string) {
  return `/library/${mealId}`;
}

/** Pass 'new' to open the editor for a brand-new menu. */
export function schoolLunchMenuPath(menuId: string) {
  return `/settings/school-lunch/${menuId}`;
}

export function mealDetailPath(mealId: string) {
  return `/library/${mealId}/view`;
}

export function cookingModePath(mealId: string) {
  return `/library/${mealId}/cook`;
}
