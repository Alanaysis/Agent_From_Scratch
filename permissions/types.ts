export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions";

export type PermissionRule = {
  toolName: string;
  pattern?: string;
};

export type PermissionContext = {
  mode: PermissionMode;
  allowRules: PermissionRule[];
  denyRules: PermissionRule[];
  askRules: PermissionRule[];
};
