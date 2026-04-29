export type ParamType = "string" | "number" | "enum";

export interface ParamConfig {
  name: string;
  type: ParamType;
  default: any;
  description: string;
  required: boolean;
  options?: string[];  // 仅 enum 类型需要
}

export type SkillFrontmatter = {
  description?: string
  allowedTools?: string[]
  context?: "inline" | "fork"
  model?: string
  name?: string
  trigger?: string[]
  params?: ParamConfig[];  // 新增：workmap 参数定义
};
