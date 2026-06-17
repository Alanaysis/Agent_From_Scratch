import { ipcMain, dialog, BrowserWindow } from "electron";
import { cwd } from "process";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import {
  readWorkflow,
  saveWorkflow,
  deleteWorkflow,
  listWorkflows,
  parseWorkflowYaml,
  importWorkflowAsProposal,
  proposalToWorkflowYaml,
  type WorkflowDefinition,
} from "../../../storage/workflowIndex";
import { log } from "../logger";

export function registerWorkflowHandlers() {
  log('INFO', 'Workflows', 'Registering workflow handlers')

  ipcMain.handle("workflows:list", async (): Promise<{ workflows: WorkflowDefinition[] }> => {
    log('INFO', 'Workflows', 'workflows:list called')
    try {
      const workflows = await listWorkflows(cwd());
      return { workflows };
    } catch (e) {
      log('ERROR', 'Workflows', 'workflows:list failed', e)
      throw e
    }
  });

  ipcMain.handle("workflows:get", async (_event, workflowId: string): Promise<{ workflow: WorkflowDefinition | null }> => {
    log('INFO', 'Workflows', `workflows:get called for ${workflowId}`)
    try {
      const workflow = await readWorkflow(cwd(), workflowId);
      return { workflow };
    } catch (e) {
      log('ERROR', 'Workflows', `workflows:get ${workflowId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("workflows:delete", async (_event, workflowId: string): Promise<void> => {
    log('INFO', 'Workflows', `workflows:delete called for ${workflowId}`)
    try {
      await deleteWorkflow(cwd(), workflowId);
    } catch (e) {
      log('ERROR', 'Workflows', `workflows:delete ${workflowId} failed`, e)
      throw e
    }
  });

  ipcMain.handle("workflows:import_yaml", async (_event, input: { yamlContent: string; createdBy?: string }): Promise<{ workflow: WorkflowDefinition; proposalId: string }> => {
    log('INFO', 'Workflows', 'workflows:import_yaml called')
    try {
      const workflow = parseWorkflowYaml(input.yamlContent);
      const { proposal } = await importWorkflowAsProposal(cwd(), workflow, input.createdBy);
      log('INFO', 'Workflows', `workflows:import_yaml created workflow ${workflow.id} and proposal ${proposal.id}`)
      return { workflow, proposalId: proposal.id };
    } catch (e) {
      log('ERROR', 'Workflows', 'workflows:import_yaml failed', e)
      throw e
    }
  });

  ipcMain.handle("workflows:import_file", async (_event, input: { filePath: string; createdBy?: string }): Promise<{ workflow: WorkflowDefinition; proposalId: string }> => {
    log('INFO', 'Workflows', `workflows:import_file called for ${input.filePath}`)
    try {
      const content = await readFile(input.filePath, "utf8");
      const workflow = parseWorkflowYaml(content);
      workflow.sourceFile = input.filePath;
      const { proposal } = await importWorkflowAsProposal(cwd(), workflow, input.createdBy, input.filePath);
      log('INFO', 'Workflows', `workflows:import_file created workflow ${workflow.id} and proposal ${proposal.id}`)
      return { workflow, proposalId: proposal.id };
    } catch (e) {
      log('ERROR', 'Workflows', `workflows:import_file failed`, e)
      throw e
    }
  });

  ipcMain.handle("workflows:open_file_dialog", async (): Promise<{ filePath: string | null }> => {
    log('INFO', 'Workflows', 'workflows:open_file_dialog called')
    try {
      const win = BrowserWindow.getFocusedWindow();
      if (!win) return { filePath: null };

      const result = await dialog.showOpenDialog(win, {
        title: 'Import Workflow YAML',
        filters: [
          { name: 'YAML Files', extensions: ['yaml', 'yml'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { filePath: null };
      }

      return { filePath: result.filePaths[0]! };
    } catch (e) {
      log('ERROR', 'Workflows', 'workflows:open_file_dialog failed', e)
      return { filePath: null };
    }
  });

  ipcMain.handle("workflows:save-yaml", async (_event, input: { proposal: any; fileName: string }): Promise<{ filePath: string; fileName: string }> => {
    log('INFO', 'Workflows', `workflows:save-yaml called with fileName=${input.fileName}`)
    try {
      const yamlContent = proposalToWorkflowYaml(input.proposal);
      const fileName = input.fileName || `${input.proposal.title}.yaml`;
      const workflowsDir = join(cwd(), "workflows");
      const filePath = join(workflowsDir, fileName);

      await mkdir(workflowsDir, { recursive: true });
      await writeFile(filePath, yamlContent, "utf8");

      log('INFO', 'Workflows', `workflows:save-yaml saved to ${filePath}`)
      return { filePath, fileName };
    } catch (e) {
      log('ERROR', 'Workflows', 'workflows:save-yaml failed', e)
      throw e
    }
  });
}
