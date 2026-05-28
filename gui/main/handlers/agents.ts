import { ipcMain } from "electron"
import { cwd } from "process"
import { listAgents, createAgent, updateAgentInfo, deleteAgentInfo, readAgentInfo, listAgentsByCapability } from "../../../storage/agentIndex"
import { log } from "../logger"
import { createId } from "../../../shared/ids"
import { runLlmTurn } from "../../../runtime/llm"
import type { Message } from "../../../runtime/messages"
import type { Agent } from "../../types"

const TOOL_OPTIONS = [
  { id: 'Read', label: 'Read files' },
  { id: 'Write', label: 'Write files' },
  { id: 'Edit', label: 'Edit files' },
  { id: 'Shell', label: 'Run shell commands' },
  { id: 'WebFetch', label: 'Fetch web pages' },
  { id: 'WebSearch', label: 'Web search' },
  { id: 'FileTree', label: 'List directory tree' },
  { id: 'SearchFiles', label: 'Search files' },
]

export function registerAgentHandlers() {
  log('INFO', 'Agents', 'Registering agent handlers')

  ipcMain.handle("agents:list", async (): Promise<{ agents: Agent[] }> => {
    log('INFO', 'Agents', 'agents:list called')
    try {
      const agents = await listAgents(cwd())
      return { agents }
    } catch (e) {
      log('ERROR', 'Agents', 'agents:list failed', e)
      throw e
    }
  })

  ipcMain.handle("agents:get", async (_event, agentId: string): Promise<{ agent: Agent | null }> => {
    log('INFO', 'Agents', 'agents:get called', agentId)
    try {
      const agent = await readAgentInfo(cwd(), agentId)
      return { agent }
    } catch (e) {
      log('ERROR', 'Agents', 'agents:get failed', e)
      throw e
    }
  })

  ipcMain.handle("agents:create", async (_event, input: {
    name: string
    description: string
    systemPrompt: string[]
    allowedTools: string[] | "*"
    maxTurns?: number
    isReadOnly?: boolean
    permission?: any
  }): Promise<{ agent: Agent }> => {
    log('INFO', 'Agents', 'agents:create called', input.name)
    try {
      const agent = await createAgent(cwd(), {
        id: input.name.toLowerCase().replace(/\s+/g, "-"),
        name: input.name,
        description: input.description,
        systemPrompt: input.systemPrompt,
        allowedTools: input.allowedTools,
        maxTurns: input.maxTurns,
        isReadOnly: input.isReadOnly,
        permission: input.permission,
        isBuiltIn: false,
      })
      log('INFO', 'Agents', 'agents:create success', agent.id)
      return { agent }
    } catch (e) {
      log('ERROR', 'Agents', 'agents:create failed', e)
      throw e
    }
  })

  ipcMain.handle("agents:update", async (_event, input: {
    agentId: string
    updates: {
      name?: string
      description?: string
      systemPrompt?: string[]
      allowedTools?: string[] | "*"
      maxTurns?: number
      isReadOnly?: boolean
    }
  }): Promise<{ agent: Agent | null }> => {
    log('INFO', 'Agents', 'agents:update called', input.agentId)
    try {
      const agent = await updateAgentInfo(cwd(), input.agentId, input.updates)
      return { agent }
    } catch (e) {
      log('ERROR', 'Agents', 'agents:update failed', e)
      throw e
    }
  })

  ipcMain.handle("agents:delete", async (_event, agentId: string): Promise<{ success: boolean }> => {
    log('INFO', 'Agents', 'agents:delete called', agentId)
    try {
      const success = await deleteAgentInfo(cwd(), agentId)
      return { success }
    } catch (e) {
      log('ERROR', 'Agents', 'agents:delete failed', e)
      throw e
    }
  })

  ipcMain.handle("agents:list_by_capability", async (_event, capability: string): Promise<{ agents: Agent[] }> => {
    log('INFO', 'Agents', `agents:list_by_capability called with: ${capability}`)
    try {
      const agents = await listAgentsByCapability(cwd(), capability)
      log('INFO', 'Agents', `agents:list_by_capability returned ${agents.length} agents`)
      return { agents }
    } catch (e) {
      log('ERROR', 'Agents', 'agents:list_by_capability failed', e)
      throw e
    }
  })

  ipcMain.handle("agents:generate", async (_event, userDescription: string): Promise<{ generated: {
    name: string
    description: string
    systemPrompt: string[]
    allowedTools: string[] | "*"
    maxTurns: number
    isReadOnly: boolean
  } }> => {
    log('INFO', 'Agents', 'agents:generate called', userDescription)
    try {
      const prompt = `You are an agent configuration generator. Based on the user's description, generate a complete agent configuration.

User's request: "${userDescription}"

Generate a JSON object with the following structure:
{
  "name": "agent-slug-name",
  "description": "Brief description of what this agent does",
  "systemPrompt": ["Line 1 of system prompt", "Line 2 of system prompt"],
  "allowedTools": ["Read", "Edit"] or "*" for all tools,
  "maxTurns": 8,
  "isReadOnly": false
}

Rules:
- name: lowercase with hyphens, e.g., "recipe-executor", "code-reviewer"
- description: 1-2 sentences
- systemPrompt: 3-5 concise instructions that define the agent's behavior and expertise
- allowedTools: array of tool names or "*" for all tools. Choose only the tools that make sense for the agent's purpose
- maxTurns: typically 8-16 for complex agents, 4-8 for simple ones
- isReadOnly: true if the agent should not modify files or run bash commands

Available tools: ${TOOL_OPTIONS.map(t => t.id).join(', ')}

Respond ONLY with valid JSON, no markdown, no explanation.`

      const messages: Message[] = [
        { id: createId("user"), type: "user", content: prompt } as Message,
      ]

      const response = await runLlmTurn({
        messages,
        systemPrompt: ["You are a helpful assistant that generates agent configurations in JSON format."],
        tools: [],
      })

      let jsonStr = response.text.trim()
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonStr = jsonMatch[0]
      }

      const parsed = JSON.parse(jsonStr)

      log('INFO', 'Agents', 'agents:generate success')
      return {
        generated: {
          name: parsed.name || "generated-agent",
          description: parsed.description || "",
          systemPrompt: Array.isArray(parsed.systemPrompt) ? parsed.systemPrompt : [],
          allowedTools: parsed.allowedTools || "*",
          maxTurns: parsed.maxTurns || 8,
          isReadOnly: parsed.isReadOnly || false,
        }
      }
    } catch (e) {
      log('ERROR', 'Agents', 'agents:generate failed', e)
      throw e
    }
  })
}