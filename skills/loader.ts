import type { SkillFrontmatter } from './frontmatter'

export type LoadedSkill = {
  name: string
  frontmatter: SkillFrontmatter
  content: string
}

export async function loadSkills(): Promise<LoadedSkill[]> {
  return []
}
