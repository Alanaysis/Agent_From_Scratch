/**
 * Common selectors for IRG Electron app
 * Uses data-testid attributes for reliable selection
 */

// Navigation
export const NAV = {
  chat: '[data-testid="nav-chat"]',
  tasks: '[data-testid="nav-tasks"]',
  proposals: '[data-testid="nav-proposals"]',
  documents: '[data-testid="nav-documents"]',
  sessions: '[data-testid="nav-sessions"]',
  settings: '[data-testid="nav-settings"]',
};

// Chat View
export const CHAT = {
  input: '[data-testid="chat-input"]',
  sendButton: '[data-testid="chat-send"]',
  stopButton: '[data-testid="chat-stop"]',
  messages: '[data-testid="chat-messages"]',
  message: (role: string) => `[data-testid="message-${role}"]`,
  toolCall: (id: string) => `[data-testid="tool-call-${id}"]`,
  permissionModal: '[data-testid="permission-modal"]',
  permissionAllow: '[data-testid="permission-allow"]',
  permissionDeny: '[data-testid="permission-deny"]',
};

// Tasks View (Kanban)
export const TASKS = {
  column: (status: string) => `[data-testid="column-${status}"]`,
  taskCard: (id: string) => `[data-testid="task-${id}"]`,
  newTaskInput: (status: string) => `[data-testid="new-task-${status}"]`,
  newTaskButton: (status: string) => `[data-testid="add-task-${status}"]`,
  deleteButton: (id: string) => `[data-testid="delete-task-${id}"]`,
};

// Task Detail Panel
export const TASK_DETAIL = {
  panel: '[data-testid="task-detail-panel"]',
  title: '[data-testid="task-title"]',
  description: '[data-testid="task-description"]',
  statusBadge: '[data-testid="task-status"]',
  priorityBadge: '[data-testid="task-priority"]',
  assigneeInput: '[data-testid="task-assignee-input"]',
  assignButton: '[data-testid="task-assign"]',
  releaseButton: '[data-testid="task-release"]',
  executeButton: '[data-testid="task-execute"]',
  submitVerifyButton: '[data-testid="task-submit-verify"]',
  approveButton: '[data-testid="task-approve"]',
  rejectButton: '[data-testid="task-reject"]',
  deleteButton: '[data-testid="task-delete"]',
  commentInput: '[data-testid="task-comment-input"]',
  commentButton: '[data-testid="task-comment-submit"]',
  viewInChat: '[data-testid="task-view-chat"]',
};

// Proposals View
export const PROPOSALS = {
  column: (status: string) => `[data-testid="proposal-column-${status}"]`,
  proposalCard: (id: string) => `[data-testid="proposal-${id}"]`,
  newProposal: '[data-testid="new-proposal"]',
  importYaml: '[data-testid="import-yaml"]',
  deleteButton: (id: string) => `[data-testid="delete-proposal-${id}"]`,
  editButton: (id: string) => `[data-testid="edit-proposal-${id}"]`,
};

// Proposal Detail Panel
export const PROPOSAL_DETAIL = {
  panel: '[data-testid="proposal-detail-panel"]',
  title: '[data-testid="proposal-title"]',
  statusBadge: '[data-testid="proposal-status"]',
  submitButton: '[data-testid="proposal-submit"]',
  approveButton: '[data-testid="proposal-approve"]',
  rejectButton: '[data-testid="proposal-reject"]',
  editButton: '[data-testid="proposal-edit"]',
};

// Proposal Editor
export const PROPOSAL_EDITOR = {
  titleInput: '[data-testid="proposal-title-input"]',
  descriptionInput: '[data-testid="proposal-description-input"]',
  saveDraft: '[data-testid="save-draft"]',
  submit: '[data-testid="submit-proposal"]',
  taskDraft: (id: string) => `[data-testid="task-draft-${id}"]`,
  addTaskDraft: '[data-testid="add-task-draft"]',
  templateSelect: (id: string) => `[data-testid="template-${id}"]`,
};

// Sessions View
export const SESSIONS = {
  searchInput: '[data-testid="session-search"]',
  clearAll: '[data-testid="clear-all-sessions"]',
  sessionItem: (id: string) => `[data-testid="session-${id}"]`,
  deleteButton: (id: string) => `[data-testid="delete-session-${id}"]`,
  continueButton: '[data-testid="continue-session"]',
};

// Settings View
export const SETTINGS = {
  providerSelect: '[data-testid="llm-provider"]',
  apiKeyInput: '[data-testid="api-key"]',
  modelInput: '[data-testid="model-name"]',
  baseUrlInput: '[data-testid="base-url"]',
  saveButton: '[data-testid="save-config"]',
  agentsTab: '[data-testid="agents-tab"]',
  llmTab: '[data-testid="llm-tab"]',
};

// Agents
export const AGENTS = {
  newAgent: '[data-testid="new-agent"]',
  aiGenerate: '[data-testid="ai-generate"]',
  agentCard: (id: string) => `[data-testid="agent-${id}"]`,
  editButton: (id: string) => `[data-testid="edit-agent-${id}"]`,
  deleteButton: (id: string) => `[data-testid="delete-agent-${id}"]`,
};

// Approval Modal
export const APPROVAL = {
  modal: '[data-testid="approval-modal"]',
  executeNow: '[data-testid="approval-execute"]',
  later: '[data-testid="approval-later"]',
  abort: '[data-testid="approval-abort"]',
  stepCounter: '[data-testid="approval-step"]',
  progressBar: '[data-testid="approval-progress"]',
};

// Common
export const COMMON = {
  loading: '[data-testid="loading"]',
  error: '[data-testid="error"]',
  success: '[data-testid="success"]',
  confirmDialog: '[data-testid="confirm-dialog"]',
  confirmYes: '[data-testid="confirm-yes"]',
  confirmNo: '[data-testid="confirm-no"]',
};
