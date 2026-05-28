import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";

export type RecipeTaskTemplate = {
  title: string;
  description?: string;
  agent?: string;  // agent capability tag
  priority?: "low" | "medium" | "high";
  dependsOnIndex?: number[];  // indices within this recipe
};

export type Recipe = {
  id: string;
  name: string;
  description?: string;
  triggers: string[];  // keywords that match this recipe
  tasks: RecipeTaskTemplate[];
  createdAt: string;
  updatedAt: string;
};

function getRecipesDir(cwd: string): string {
  return join(cwd, ".irg", "recipes");
}

function getRecipePath(cwd: string, recipeId: string): string {
  return join(getRecipesDir(cwd), `${recipeId}.json`);
}

export async function readRecipe(
  cwd: string,
  recipeId: string,
): Promise<Recipe | null> {
  try {
    const content = await readFile(getRecipePath(cwd, recipeId), "utf8");
    return JSON.parse(content) as Recipe;
  } catch {
    return null;
  }
}

export async function createRecipe(
  cwd: string,
  recipe: Omit<Recipe, "createdAt" | "updatedAt">,
): Promise<Recipe> {
  const now = new Date().toISOString();
  const newRecipe: Recipe = {
    ...recipe,
    createdAt: now,
    updatedAt: now,
  };

  await mkdir(getRecipesDir(cwd), { recursive: true });
  await writeFile(
    getRecipePath(cwd, recipe.id),
    `${JSON.stringify(newRecipe, null, 2)}\n`,
    "utf8",
  );
  return newRecipe;
}

export async function updateRecipe(
  cwd: string,
  recipeId: string,
  updates: Partial<Omit<Recipe, "id" | "createdAt">>,
): Promise<Recipe | null> {
  const previous = await readRecipe(cwd, recipeId);
  if (!previous) {
    return null;
  }

  const now = new Date().toISOString();
  const updated: Recipe = {
    ...previous,
    ...updates,
    updatedAt: now,
  };

  await mkdir(getRecipesDir(cwd), { recursive: true });
  await writeFile(
    getRecipePath(cwd, recipeId),
    `${JSON.stringify(updated, null, 2)}\n`,
    "utf8",
  );
  return updated;
}

export async function deleteRecipe(
  cwd: string,
  recipeId: string,
): Promise<void> {
  await rm(getRecipePath(cwd, recipeId), { force: true });
}

export async function listRecipes(cwd: string): Promise<Recipe[]> {
  const recipes: Recipe[] = [];

  try {
    const entries = await readdir(getRecipesDir(cwd));
    for (const entry of entries) {
      if (!entry.endsWith(".json")) {
        continue;
      }
      const recipeId = entry.replace(/\.json$/, "");
      const recipe = await readRecipe(cwd, recipeId);
      if (recipe) {
        recipes.push(recipe);
      }
    }
  } catch {
    // ignore missing recipes dir
  }

  return recipes.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export async function findRecipesByTrigger(
  cwd: string,
  keyword: string,
): Promise<Recipe[]> {
  const allRecipes = await listRecipes(cwd);
  const lowerKeyword = keyword.toLowerCase();
  return allRecipes.filter((recipe) =>
    recipe.triggers.some((trigger) => trigger.toLowerCase().includes(lowerKeyword))
  );
}
