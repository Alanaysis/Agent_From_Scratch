import type { AssistantMessage } from "../runtime/messages";
import type { PermissionRule, PermissionMatrix } from "./types";
import type {
  CanUseToolFn,
  PermissionDecision,
  Tool,
  ToolUseContext,
} from "../tools/Tool";

function getInputPattern(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) {
    return undefined;
  }

  if ("path" in input && typeof input.path === "string" && input.path.trim()) {
    return input.path.trim();
  }

  if (
    "command" in input &&
    typeof input.command === "string" &&
    input.command.trim()
  ) {
    return input.command.trim();
  }

  if ("url" in input && typeof input.url === "string" && input.url.trim()) {
    return input.url.trim();
  }

  if (
    "description" in input &&
    typeof input.description === "string" &&
    input.description.trim()
  ) {
    return input.description.trim();
  }

  return undefined;
}

function matchesRule<Input>(
  rule: PermissionRule,
  tool: Tool<Input, unknown>,
  input: Input,
): boolean {
  if (rule.toolName !== tool.name) {
    return false;
  }
  if (!rule.pattern) {
    return true;
  }
  return getInputPattern(input) === rule.pattern;
}

function checkMatrix(
  matrix: PermissionMatrix | undefined,
  tool: { resourceType?: string; actionType?: string },
): boolean | undefined {
  if (!matrix || !tool.resourceType || !tool.actionType) return undefined;
  const resource = matrix[tool.resourceType as keyof PermissionMatrix];
  if (!resource) return undefined;
  const allowed = resource[tool.actionType as keyof typeof resource];
  return allowed;
}

export function rememberPermissionRule<Input>(
  context: ToolUseContext,
  tool: Tool<Input, unknown>,
  input: Input,
): PermissionRule {
  const rule: PermissionRule = {
    toolName: tool.name,
    pattern: getInputPattern(input),
  };

  context.setAppState((prev) => {
    const exists = prev.permissionContext.allowRules.some(
      (existing) =>
        existing.toolName === rule.toolName &&
        existing.pattern === rule.pattern,
    );
    if (exists) {
      return prev;
    }

    return {
      ...prev,
      permissionContext: {
        ...prev.permissionContext,
        allowRules: [...prev.permissionContext.allowRules, rule],
      },
    };
  });

  return rule;
}

export const canUseTool: CanUseToolFn = async <Input>(
  tool: Tool<Input, unknown>,
  input: Input,
  context: ToolUseContext,
  _parentMessage: AssistantMessage,
  _toolUseId: string,
): Promise<PermissionDecision<Input>> => {
  const validation = await tool.validateInput?.(input, context);
  if (validation && !validation.result) {
    return {
      behavior: "deny",
      message: validation.message,
    };
  }

  const permissionContext = context.getAppState().permissionContext;
  const mode = permissionContext.mode;
  if (mode === "bypassPermissions" || mode === "acceptEdits") {
    return {
      behavior: "allow",
      updatedInput: input,
    };
  }

  const matrixResult = checkMatrix(permissionContext.matrix, tool);
  if (matrixResult === true) {
    return { behavior: "allow", updatedInput: input };
  }
  if (matrixResult === false) {
    return {
      behavior: "deny",
      message: `Tool ${tool.name} is blocked by permission matrix (${tool.resourceType}:${tool.actionType})`,
    };
  }

  if (permissionContext.denyRules.some((rule) => matchesRule(rule, tool, input))) {
    return {
      behavior: "deny",
      message: `Tool ${tool.name} is blocked by a session rule`,
    };
  }

  if (permissionContext.allowRules.some((rule) => matchesRule(rule, tool, input))) {
    return {
      behavior: "allow",
      updatedInput: input,
    };
  }

  if (permissionContext.askRules.some((rule) => matchesRule(rule, tool, input))) {
    return {
      behavior: "ask",
      message: `Tool ${tool.name} requires confirmation by a session rule`,
      updatedInput: input,
    };
  }

  const toolDecision = await tool.checkPermissions?.(input, context);
  if (toolDecision) {
    return toolDecision;
  }

  if (tool.isReadOnly(input)) {
    return {
      behavior: "allow",
      updatedInput: input,
    };
  }

  return {
    behavior: "ask",
    message: `Tool ${tool.name} requires confirmation`,
    updatedInput: input,
  };
};
