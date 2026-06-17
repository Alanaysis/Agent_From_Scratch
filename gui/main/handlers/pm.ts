import { ipcMain } from "electron";
import { cwd } from "process";
import { findRecipesByTrigger, readRecipe } from "../../../storage/recipeIndex";
import { createProposal } from "../../../storage/proposalIndex";
import type { Proposal, TaskDraft } from "../../../storage/proposalIndex";
import type { Recipe } from "../../../storage/recipeIndex";
import { createId } from "../../../shared/ids";
import { log } from "../logger";

function extractKeywords(goal: string): string[] {
  // Split goal into meaningful keywords, filtering out common stop words
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "about", "like",
    "through", "after", "over", "between", "out", "against", "during",
    "without", "before", "under", "around", "among", "and", "or", "but",
    "not", "no", "nor", "so", "yet", "both", "either", "neither", "each",
    "every", "all", "any", "few", "more", "most", "other", "some", "such",
    "than", "too", "very", "just", "because", "if", "when", "where", "how",
    "what", "which", "who", "whom", "this", "that", "these", "those", "i",
    "me", "my", "we", "our", "you", "your", "he", "him", "his", "she",
    "her", "it", "its", "they", "them", "their", "want", "need", "please",
    "make", "create", "build", "set", "up",
  ]);

  return goal
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !stopWords.has(word));
}

function recipeToProposal(recipe: Recipe, goal: string, createdBy?: string): Omit<Proposal, "createdAt" | "updatedAt"> {
  // Convert recipe task templates to proposal task drafts with tempIds
  const tempIdMap = new Map<number, string>();
  const taskDrafts: TaskDraft[] = recipe.tasks.map((template, index) => {
    const tempId = `draft-${index}`;
    tempIdMap.set(index, tempId);

    return {
      tempId,
      title: template.title,
      description: template.description,
      agent: template.agent,
      priority: template.priority,
      dependsOnTempIds: template.dependsOnIndex
        ?.map((depIndex) => tempIdMap.get(depIndex))
        .filter((id): id is string => id !== undefined),
    };
  });

  return {
    id: createId("proposal"),
    title: `Plan: ${goal}`,
    description: `Auto-generated proposal from recipe "${recipe.name}" for goal: ${goal}`,
    inputType: "manual",
    status: "draft",
    taskDrafts,
    documentDrafts: [],
    createdBy,
  };
}

function createGenericProposal(goal: string, createdBy?: string): Omit<Proposal, "createdAt" | "updatedAt"> {
  return {
    id: createId("proposal"),
    title: `Plan: ${goal}`,
    description: `Proposal for goal: ${goal}`,
    inputType: "manual",
    status: "draft",
    taskDrafts: [
      {
        tempId: "draft-0",
        title: goal,
        description: `Complete the following goal: ${goal}`,
        priority: "medium",
      },
    ],
    documentDrafts: [],
    createdBy,
  };
}

export function registerPmHandlers() {
  log("INFO", "PM", "Registering PM handlers");

  ipcMain.handle(
    "pm:create_plan_from_goal",
    async (
      _event,
      input: { goal: string; createdBy?: string },
    ): Promise<{ proposal: Proposal; matchedRecipe?: Recipe }> => {
      log("INFO", "PM", `pm:create_plan_from_goal called: "${input.goal}"`);
      try {
        const keywords = extractKeywords(input.goal);
        log("DEBUG", "PM", `Extracted keywords: ${keywords.join(", ")}`);

        // Search recipes by each keyword and collect matches
        const matchedRecipes = new Map<string, Recipe>();
        for (const keyword of keywords) {
          const recipes = await findRecipesByTrigger(cwd(), keyword);
          for (const recipe of recipes) {
            matchedRecipes.set(recipe.id, recipe);
          }
        }

        let proposalData: Omit<Proposal, "createdAt" | "updatedAt">;
        let matchedRecipe: Recipe | undefined;

        if (matchedRecipes.size > 0) {
          // Pick the recipe with the most matching triggers
          const sortedRecipes = [...matchedRecipes.values()].sort((a, b) => {
            const aMatches = a.triggers.filter((t) =>
              keywords.some((k) => t.toLowerCase().includes(k))
            ).length;
            const bMatches = b.triggers.filter((t) =>
              keywords.some((k) => t.toLowerCase().includes(k))
            ).length;
            return bMatches - aMatches;
          });

          matchedRecipe = sortedRecipes[0]!;
          log("INFO", "PM", `Matched recipe: ${matchedRecipe.name} (${matchedRecipe.id})`);
          proposalData = recipeToProposal(matchedRecipe, input.goal, input.createdBy);
        } else {
          log("INFO", "PM", "No matching recipe found, creating generic proposal");
          proposalData = createGenericProposal(input.goal, input.createdBy);
        }

        const proposal = await createProposal(cwd(), proposalData);
        log("INFO", "PM", `Created proposal ${proposal.id} with ${proposal.taskDrafts.length} tasks`);

        return { proposal, matchedRecipe };
      } catch (e) {
        log("ERROR", "PM", "pm:create_plan_from_goal failed", e);
        throw e;
      }
    },
  );
}
