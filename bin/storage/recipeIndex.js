import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { join } from "path";
function getRecipesDir(cwd) {
    return join(cwd, ".irg", "recipes");
}
function getRecipePath(cwd, recipeId) {
    return join(getRecipesDir(cwd), `${recipeId}.json`);
}
export async function readRecipe(cwd, recipeId) {
    try {
        const content = await readFile(getRecipePath(cwd, recipeId), "utf8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
export async function createRecipe(cwd, recipe) {
    const now = new Date().toISOString();
    const newRecipe = {
        ...recipe,
        createdAt: now,
        updatedAt: now,
    };
    await mkdir(getRecipesDir(cwd), { recursive: true });
    await writeFile(getRecipePath(cwd, recipe.id), `${JSON.stringify(newRecipe, null, 2)}\n`, "utf8");
    return newRecipe;
}
export async function updateRecipe(cwd, recipeId, updates) {
    const previous = await readRecipe(cwd, recipeId);
    if (!previous) {
        return null;
    }
    const now = new Date().toISOString();
    const updated = {
        ...previous,
        ...updates,
        updatedAt: now,
    };
    await mkdir(getRecipesDir(cwd), { recursive: true });
    await writeFile(getRecipePath(cwd, recipeId), `${JSON.stringify(updated, null, 2)}\n`, "utf8");
    return updated;
}
export async function deleteRecipe(cwd, recipeId) {
    await rm(getRecipePath(cwd, recipeId), { force: true });
}
export async function listRecipes(cwd) {
    const recipes = [];
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
    }
    catch {
        // ignore missing recipes dir
    }
    return recipes.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}
export async function findRecipesByTrigger(cwd, keyword) {
    const allRecipes = await listRecipes(cwd);
    const lowerKeyword = keyword.toLowerCase();
    return allRecipes.filter((recipe) => recipe.triggers.some((trigger) => trigger.toLowerCase().includes(lowerKeyword)));
}
