export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions";

export type ResourceType = 'file' | 'shell' | 'network' | 'agent' | 'image';
export type ActionType = 'read' | 'write' | 'execute' | 'delete';

export type PermissionMatrix = Partial<Record<ResourceType, Partial<Record<ActionType, boolean>>>>;

export type PermissionRule = {
  toolName: string;
  pattern?: string;
};

export type PermissionContext = {
  mode: PermissionMode;
  allowRules: PermissionRule[];
  denyRules: PermissionRule[];
  askRules: PermissionRule[];
  matrix?: PermissionMatrix;
};
