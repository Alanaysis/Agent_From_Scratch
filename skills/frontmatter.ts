export type ParamType = "string" | "number" | "enum";

export interface ParamConfig {
  name: string;
  type: ParamType;
  default: any;
  description: string;
  required: boolean;
  options?: string[];
}

export type SkillGatingRequires = {
  bins?: string[];
  anyBins?: string[];
  env?: string[];
  config?: string[];
};

export type SkillGating = {
  always?: boolean;
  os?: string[];
  requires?: SkillGatingRequires;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  install?: Array<{
    type: "brew" | "node" | "go" | "uv" | "download";
    item: string;
  }>;
};

export type SkillFrontmatter = {
  description?: string;
  allowedTools?: string[];
  context?: "inline" | "fork";
  model?: string;
  name?: string;
  trigger?: string[];
  params?: ParamConfig[];
  paths?: string[];
  userInvocable?: boolean;
  disableModelInvocation?: boolean;
  argumentHint?: string;
  agent?: string;
  homepage?: string;
  commandDispatch?: "tool";
  commandTool?: string;
  commandArgMode?: "raw";
  metadata?: SkillGating;
};

export type SkillMetadata = {
  name: string;
  description: string;
  trigger: string[];
  paths: string[];
  userInvocable: boolean;
  disableModelInvocation: boolean;
  argumentHint?: string;
  context?: "inline" | "fork";
  agent?: string;
  allowedTools?: string[];
  model?: string;
  params?: ParamConfig[];
  homepage?: string;
  commandDispatch?: "tool";
  commandTool?: string;
  commandArgMode?: "raw";
  gating?: SkillGating;
};

export type SkillInstruction = {
  content: string;
  references: string[];
};

export type SkillResource = {
  name: string;
  path: string;
  type: "file" | "script";
  description?: string;
};
