import { ipcMain } from "electron";
import { cwd } from "process";
import { listUserSkills } from "../../../skills/skillManager";
import { log } from "../logger";

export function registerSkillHandlers() {
  log('INFO', 'Skills', 'Registering skill handlers')

  ipcMain.handle("skills:list", async (): Promise<{ skills: any[] }> => {
    log('INFO', 'Skills', 'skills:list called')
    try {
      const skills = await listUserSkills(cwd());
      log('INFO', 'Skills', `skills:list returned ${skills.length} skills`)
      return { skills };
    } catch (e) {
      log('ERROR', 'Skills', 'skills:list failed', e)
      return { skills: [] }
    }
  });
}
