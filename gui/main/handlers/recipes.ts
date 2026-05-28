import { ipcMain } from "electron";
import { cwd } from "process";
import {
  listRecipes,
  readRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  findRecipesByTrigger,
} from "../../../storage/recipeIndex";
import type { Recipe, RecipeTaskTemplate } from "../../../storage/recipeIndex";
import { createId } from "../../../shared/ids";
import { log } from "../logger";

interface RecipeCreateInput {
  name: string;
  description?: string;
  triggers: string[];
  tasks: RecipeTaskTemplate[];
}

interface RecipeUpdateInput {
  recipeId: string;
  updates: {
    name?: string;
    description?: string;
    triggers?: string[];
    tasks?: RecipeTaskTemplate[];
  };
}

export function registerRecipeHandlers() {
  log("INFO", "Recipes", "Registering recipe handlers");

  ipcMain.handle("recipes:list", async (): Promise<{ recipes: Recipe[] }> => {
    log("INFO", "Recipes", "recipes:list called");
    try {
      const recipes = await listRecipes(cwd());
      log("INFO", "Recipes", `recipes:list returned ${recipes.length} recipes`);
      return { recipes };
    } catch (e) {
      log("ERROR", "Recipes", "recipes:list failed", e);
      throw e;
    }
  });

  ipcMain.handle("recipes:get", async (_event, recipeId: string): Promise<{ recipe: Recipe | null }> => {
    log("INFO", "Recipes", `recipes:get called for ${recipeId}`);
    try {
      const recipe = await readRecipe(cwd(), recipeId);
      log("INFO", "Recipes", `recipes:get ${recipeId} returned ${recipe ? "found" : "not found"}`);
      return { recipe };
    } catch (e) {
      log("ERROR", "Recipes", `recipes:get ${recipeId} failed`, e);
      throw e;
    }
  });

  ipcMain.handle("recipes:create", async (_event, input: RecipeCreateInput): Promise<{ recipe: Recipe }> => {
    log("INFO", "Recipes", `recipes:create called: ${input.name}`);
    try {
      const recipe = await createRecipe(cwd(), {
        id: createId("recipe"),
        name: input.name,
        description: input.description,
        triggers: input.triggers,
        tasks: input.tasks,
      });
      log("INFO", "Recipes", `recipes:create created ${recipe.id}`);
      return { recipe };
    } catch (e) {
      log("ERROR", "Recipes", "recipes:create failed", e);
      throw e;
    }
  });

  ipcMain.handle("recipes:update", async (_event, input: RecipeUpdateInput): Promise<{ recipe: Recipe | null }> => {
    log("INFO", "Recipes", `recipes:update called for ${input.recipeId}`);
    try {
      const recipe = await updateRecipe(cwd(), input.recipeId, input.updates);
      log("INFO", "Recipes", `recipes:update ${input.recipeId} ${recipe ? "success" : "not found"}`);
      return { recipe };
    } catch (e) {
      log("ERROR", "Recipes", `recipes:update ${input.recipeId} failed`, e);
      throw e;
    }
  });

  ipcMain.handle("recipes:delete", async (_event, input: { recipeId: string }): Promise<void> => {
    log("INFO", "Recipes", `recipes:delete called for ${input.recipeId}`);
    try {
      await deleteRecipe(cwd(), input.recipeId);
      log("INFO", "Recipes", `recipes:delete ${input.recipeId} completed`);
    } catch (e) {
      log("ERROR", "Recipes", `recipes:delete ${input.recipeId} failed`, e);
      throw e;
    }
  });

  ipcMain.handle("recipes:find", async (_event, input: { keyword: string }): Promise<{ recipes: Recipe[] }> => {
    log("INFO", "Recipes", `recipes:find called with keyword: ${input.keyword}`);
    try {
      const recipes = await findRecipesByTrigger(cwd(), input.keyword);
      log("INFO", "Recipes", `recipes:find returned ${recipes.length} recipes`);
      return { recipes };
    } catch (e) {
      log("ERROR", "Recipes", "recipes:find failed", e);
      throw e;
    }
  });
}
