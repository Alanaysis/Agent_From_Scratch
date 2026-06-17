# IRG Electron App - Feature Documentation & Test Plan

## Application Overview

IRG is a Next.js + Electron desktop application for multi-agent AI task execution. It runs in two modes:
- **Electron mode**: IPC via `contextBridge` (port 3001)
- **Browser mode**: HTTP API fallback (port 3002)

**Tech Stack**: Next.js 15, React 19, Zustand 5, Radix UI, Lucide icons, Tailwind CSS

---

## 1. Navigation & Layout

### Sidebar (200px fixed)
| Element | Type | Action |
|---------|------|--------|
| IRG Logo (Cpu icon) | Display | - |
| Chat | Nav item | Switch to ChatView |
| Tasks | Nav item | Switch to KanbanView |
| Proposals | Nav item | Switch to ProposalView |
| Documents | Nav item | Switch to DocumentsView |
| Sessions | Nav item | Switch to SessionsView |
| Settings | Nav item | Switch to SettingsView |
| PresencePanel | Display | Shows connection status + active agents |

**Test Scenarios:**
- [ ] Click each nav item, verify correct view loads
- [ ] Active nav item shows amber indicator
- [ ] Sidebar collapse/expand works
- [ ] PresencePanel shows "Connected" when backend is up
- [ ] PresencePanel shows agent status (idle/running/thinking)

---

## 2. Chat View

### UI Elements
| Element | Type | Action |
|---------|------|--------|
| Back button | Button | Return to session list |
| Session title | Display | Shows current session title |
| Connection status | Display | CONNECTED (green) / CONNECTING (amber) |
| Message count | Display | Number of messages |
| Delete session | Button | Delete current session with confirmation |
| Messages area | Scrollable | Shows user/assistant messages |
| Streaming cursor | Display | Blinking amber during streaming |
| Tool call cards | Expandable | Shows tool name, status, duration, input/output |
| Input textarea | Input | Auto-resize, Enter to send, Shift+Enter for newline |
| Send button | Button | Send message (amber) |
| Stop button | Button | Cancel generation (red, replaces Send when loading) |

### Permission Modal (4 types)
| Type | UI | Actions |
|------|-----|---------|
| permission | Allow/Deny buttons | Tool access confirmation |
| approval | Cancel/Confirm | General confirmation |
| error_choice | Dynamic buttons | retry/skip/abort options |
| data_input | Dynamic form | text/select/boolean/number fields |

**Test Scenarios:**
- [ ] Send a message, verify it appears in chat
- [ ] Assistant response streams in real-time
- [ ] Tool call cards show correct status (pending→running→completed)
- [ ] Permission modal appears when tool needs approval
- [ ] Allow/Deny permission works correctly
- [ ] Stop button cancels generation
- [ ] Delete session with confirmation works
- [ ] Back button returns to session list
- [ ] Empty state shows "Ready to assist"

---

## 3. Tasks View (Kanban)

### UI Elements
| Element | Type | Action |
|---------|------|--------|
| 5 columns | Kanban | To Do, In Progress, Verify, Done, Failed |
| Column header | Display | Icon, label, task count |
| Task card | Clickable | Open TaskDetailPanel |
| Blocked indicator | Display | Amber dashed border + Link2 icon |
| Priority bar | Display | 3px left border (low=gray, med=amber, high=red) |
| Priority badge | Display | LOW/MED/HI |
| Assignee avatar | Display | Pixel avatar |
| New task input | Input + Button | Add task to column |
| Delete button | Button | Delete task (on hover) |

### TaskDetailPanel (380px right panel)
| Element | Type | Action |
|---------|------|--------|
| Status badge | Display | Current task status |
| Priority badge | Display | Task priority |
| View in Chat | Button | Navigate to task's session |
| Assignee input | Input | Set assignee |
| Agent dropdown | Select | Choose agent |
| Assign button | Button | Assign and start execution |
| Release button | Button | Unassign task |
| Dependencies list | Display | Shows dependency status |
| Acceptance criteria | List | Pass/fail buttons |
| Action buttons | Button | Context-sensitive (Execute/Start/Submit/Approve/Reject/Delete) |
| Comment input | Input + Button | Add comment |
| Activity timeline | Display | Chronological activity log |
| Last error | Display | Red-bordered error (if present) |

**Task State Machine:**
```
todo → in_progress → verify → done
                     ↓
                   failed → todo (retry)
```

**Test Scenarios:**
- [ ] Create task in To Do column
- [ ] Drag/click task to open detail panel
- [ ] Assign agent to task → triggers execution
- [ ] Task moves to In Progress during execution
- [ ] Task moves to Verify when done (with acceptance criteria)
- [ ] Task auto-completes to Done (no acceptance criteria)
- [ ] Approve task in Verify → moves to Done
- [ ] Reject task in Verify → moves back to In Progress
- [ ] Blocked tasks show amber indicator
- [ ] Dependencies resolve when prerequisite completes
- [ ] Add comment to task
- [ ] View task session in Chat
- [ ] Delete task

---

## 4. Proposals View

### UI Elements
| Element | Type | Action |
|---------|------|--------|
| 4 columns | Kanban | Draft, Pending Review, Approved, Rejected |
| Proposal card | Clickable | Open ProposalDetailPanel |
| Edit button | Button | Open ProposalEditor (drafts only) |
| Delete button | Button | Delete proposal |
| New Proposal | Button | Open ProposalEditor (blank) |
| Import Workflow YAML | Button | Import from file/paste |
| Remote file picker | Modal | List YAML files from server |

### ProposalDetailPanel
| Element | Type | Action |
|---------|------|--------|
| Status badge | Display | Proposal status |
| Task drafts list | Expandable | Edit agent, priority, dependencies |
| Document drafts list | Display | View document drafts |
| Edit button | Button | Open ProposalEditor |
| Submit for Review | Button | draft → pending |
| Approve & Create Tasks | Button | pending → approved, creates tasks |
| Reject | Button | pending → rejected |
| WorkflowProgressView | DAG | Visualize task dependencies |

**Test Scenarios:**
- [ ] Create new proposal via editor
- [ ] Import workflow YAML from file
- [ ] Import workflow YAML from paste
- [ ] Edit draft proposal
- [ ] Submit proposal for review
- [ ] Approve proposal → tasks created
- [ ] Reject proposal
- [ ] Delete proposal
- [ ] Task drafts show correct dependencies
- [ ] WorkflowProgressView shows DAG correctly

---

## 5. Proposal Editor

### UI Elements
| Element | Type | Action |
|---------|------|--------|
| Back button | Button | Return to proposals |
| Template selector | 5 templates | Pre-populate drafts |
| Title input | Input | Proposal title |
| Description textarea | Input | Proposal description |
| Task draft cards | Collapsible | Edit title, description, agent, priority |
| gRPC Config editor | Panel | Edit address, payload fields |
| Dependency checkboxes | Checkbox | Set task dependencies |
| Document draft cards | Cards | Edit type, title, content |
| Save Draft button | Button | Save as draft |
| Submit button | Button | Submit for review |

### Templates
| Template | Tasks | Documents |
|----------|-------|-----------|
| Blank | 0 | 0 |
| gRPC Workflow | 3 (chained) | 0 |
| Data Pipeline | 3 (Extract→Transform→Load) | 0 |
| Code Review | 2 (Review→Fix) | 1 (Report) |
| Feature Development | 4 (Design→Implement→Test→Doc) | 1 (Tech Design) |

**Test Scenarios:**
- [ ] Select template → drafts pre-populated
- [ ] Add task draft manually
- [ ] Edit task title, description, agent, priority
- [ ] Set task dependencies via checkboxes
- [ ] Add document draft
- [ ] Remove task/document draft
- [ ] Save as draft
- [ ] Submit directly
- [ ] Edit existing proposal loads data correctly

---

## 6. Documents View

### UI Elements
| Element | Type | Action |
|---------|------|--------|
| Search input | Input | Filter documents |
| New Document | Button | Create form |
| Type selector | Select | PRD/Tech Design/ADR/Spec/Guide/Report |
| Document list | List | Title, type badge, time, char count |
| Document editor | Panel | Edit title, content |
| Related tasks | Links | Navigate to task |

**Test Scenarios:**
- [ ] Create new document
- [ ] Edit document title and content
- [ ] Search documents
- [ ] Delete document
- [ ] Navigate to related task

---

## 7. Sessions View

### UI Elements
| Element | Type | Action |
|---------|------|--------|
| Search input | Input | Filter sessions |
| CLEAR ALL | Button | Delete all sessions |
| Session list | List | Status dot, title, message count, time |
| Session detail | Panel | Status, messages, model, provider |
| Continue Session | Button | Load into ChatView |
| Delete button | Button | Delete session |

**Test Scenarios:**
- [ ] View session list
- [ ] Search sessions
- [ ] View session detail
- [ ] Continue session in chat
- [ ] Delete session
- [ ] Clear all sessions

---

## 8. Settings View

### UI Elements
| Element | Type | Action |
|---------|------|--------|
| Tab bar | Tabs | LLM Configuration / Agents |
| Provider selector | Select | openai/anthropic |
| API Key input | Password | LLM API key |
| Model input | Input | Model name |
| Base URL input | Input | API base URL |
| Save button | Button | Save configuration |
| Connection status | Display | Green/Red dot |

### Agents Tab
| Element | Type | Action |
|---------|------|--------|
| AI Generate | Button | Generate agent from description |
| New Agent | Button | Create agent form |
| Agent cards | Expandable | View/edit/delete agents |
| Agent form | Form | Name, description, system prompt, tools, permissions |

**Test Scenarios:**
- [ ] View current LLM config
- [ ] Update LLM config (provider, model, API key)
- [ ] Save config → verify persisted
- [ ] Create new agent
- [ ] Edit agent configuration
- [ ] Delete agent
- [ ] AI generate agent from description
- [ ] View built-in agents (read-only)

---

## 9. Approval Modal

### UI Elements
| Element | Type | Action |
|---------|------|--------|
| Step counter | Display | "Step 2/5" |
| Progress bar | Display | Green=completed, amber=current, gray=pending |
| Task title | Display | Current task |
| Approval message | Display | Custom message (if set) |
| Execute Now | Button | Execute task immediately |
| Later | Button | Skip for now |
| Abort | Button | Mark task as failed |

**Test Scenarios:**
- [ ] Approval modal appears for requires_approval tasks
- [ ] Execute Now → task executes
- [ ] Later → task stays in todo
- [ ] Abort → task marked as failed
- [ ] Progress bar shows correct step

---

## 10. Backend API Endpoints

### Sessions
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/sessions | List sessions |
| GET | /api/sessions/:id | Get session + messages |
| DELETE | /api/sessions/:id | Delete session |
| POST | /api/sessions/:id/heartbeat | Touch timestamp |
| POST | /api/sessions/:id/close | Close session |

### Tasks
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/tasks | List tasks |
| GET | /api/tasks/:id | Get task |
| POST | /api/tasks | Create task |
| PATCH | /api/tasks/:id | Update task |
| DELETE | /api/tasks/:id | Delete task |
| POST | /api/tasks/:id/assign | Assign + execute |
| POST | /api/tasks/:id/release | Unassign |
| POST | /api/tasks/:id/approve | Approve/reject/defer |
| POST | /api/tasks/:id/comment | Add comment |
| POST | /api/tasks/batch | Batch create with deps |

### Proposals
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/proposals | List proposals |
| POST | /api/proposals | Create proposal |
| PATCH | /api/proposals/:id | Update proposal |
| DELETE | /api/proposals/:id | Delete proposal |
| POST | /api/proposals/:id/submit | Submit for review |
| POST | /api/proposals/:id/approve | Approve + create tasks |
| POST | /api/proposals/:id/reject | Reject proposal |

### Workflows
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/workflows | List workflows |
| GET | /api/workflows/files | List YAML files |
| POST | /api/workflows/import | Import from YAML string |
| POST | /api/workflows/import-remote | Import from server file |
| POST | /api/workflows/import-file | Import from file path |

### Chat (SSE)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/chat/sse | Streaming chat |
| POST | /api/chat/permission-response | Respond to permission |
| POST | /api/chat/cancel | Cancel generation |

---

## 11. Phase 1: Infrastructure & Security (Planned)

### 11.1 Docker Containerization
| Item | Description |
|------|-------------|
| Strategy | Full application containerization (方案A) |
| Network | `--net=host` for LAN gRPC device access |
| Base image | Node.js 18+ Alpine |
| Volumes | cwd mount, ~/.irg config mount |
| Dockerfile | Multi-stage build (build + runtime) |
| docker-compose | Dev and prod profiles |

**Test Scenarios:**
- [ ] Build Docker image successfully
- [ ] Run IRG inside container with cwd volume mounted
- [ ] gRPC tool connects to LAN device via host network
- [ ] File operations limited to mounted volumes
- [ ] Container restart preserves session data
- [ ] Multiple containers can run independently

### 11.2 Path Boundary Check
| Item | Description |
|------|-------------|
| Function | `resolvePathSafe(inputPath, cwd, allowedRoots)` |
| Default | `allowedRoots = [cwd]` |
| Scope | Write/Edit tools mandatory, Read configurable |
| Error | Throws on path traversal outside allowed roots |

**Test Scenarios:**
- [ ] Write to file within cwd → allowed
- [ ] Write to `../../etc/passwd` → blocked with error
- [ ] Read within cwd → allowed
- [ ] Configurable allowedRoots for extended access
- [ ] Symlink traversal detection

### 11.3 LlmConfig Context Window
| Item | Description |
|------|-------------|
| New fields | `contextWindow`, `maxOutputTokens` |
| Default | contextWindow: 200000 (qwen3.6-35b), maxOutputTokens: 4096 |
| Usage | compressMessages, maxTurns auto-adjustment |
| Config | ~/.irg/config.json + env vars |

**Test Scenarios:**
- [ ] Config loads new fields correctly
- [ ] compressMessages activates when approaching contextWindow
- [ ] maxTurns adjusts based on available context
- [ ] Different models can have different settings

---

## 12. Phase 2: Core Capabilities (Implemented)

### 12.1 Hook System ✅
| Item | Description | Status |
|------|-------------|--------|
| Interface | `ToolHooks` with `beforeToolCall` + `afterToolCall` | ✅ |
| Registration | Code-based, type-safe | ✅ |
| Capabilities | Intercept, modify, block, log, retry | ✅ |
| Extensibility | Plugin interface reserved for future | ✅ |

**Hook Points:**
```
beforeToolCall(ctx) → { proceed, modifiedInput?, reason? }
afterToolCall(ctx, result) → modifiedResult
```

**Implemented Hooks:**
- ✅ Knowledge extractor (`tools/knowledgeHook.ts`) — auto-records anti-patterns on errors
- [ ] Audit logger (beforeToolCall → log all commands)
- [ ] Command filter (beforeToolCall → block dangerous commands)
- [ ] Result validator (afterToolCall → verify gRPC responses)

**Test Scenarios:**
- [x] beforeToolCall can block execution
- [x] beforeToolCall can modify tool input
- [x] afterToolCall can transform result
- [x] Hook error doesn't crash main execution
- [x] Knowledge hook auto-records error patterns

### 12.2 Workflow Conditions & Loops ✅
| Item | Description | Status |
|------|-------------|--------|
| Conditions | Declarative `condition` field on steps | ✅ |
| Condition types | `step_result` (deterministic), `llm_judge` (intelligent) | ✅ |
| Step retry | Enhanced `on_error.retry` | ✅ |
| Flow loops | `loop` block with max count + result-driven exit | ✅ |
| Safety | Max loop count prevents infinite loops | ✅ |

**YAML Schema Extensions:**
```yaml
steps:
  - id: step1
    condition:
      type: step_result
      source: prev_step
      field: status
      equals: "success"

  - id: retry_flow
    loop:
      max: 3
      steps: [step_a, step_b]
      until:
        type: step_result
        source: step_b
        field: status
        equals: "success"
      on_exhausted: abort
```

**Test Scenarios:**
- [x] Step with step_result condition executes when match
- [x] Step with step_result condition skips when no match
- [x] llm_judge condition routes to correct branch
- [x] Step retry works with enhanced on_error
- [x] Flow loop repeats steps until condition met
- [x] Flow loop respects max count
- [x] Flow loop aborts on exhausted

### 12.3 Context Management ✅
| Item | Description | Status |
|------|-------------|--------|
| compressMessages | Enabled in query.ts main loop | ✅ |
| Strategy | Sliding window: keep last 30% when >80% of contextWindow | ✅ |
| Inter-task state | buildTaskPrompt injects dependency task results | ✅ |
| Transcript | Full fidelity preserved in JSONL | ✅ |

**Test Scenarios:**
- [x] Long session triggers compression before context overflow
- [x] Compressed messages preserve summary + recent history
- [x] Task B prompt includes Task A's result summary
- [x] Dependency chain results propagate correctly

### 12.4 Reflection System Integration ✅
| Item | Description | Status |
|------|-------------|--------|
| Task completion | `evolveAfterSession` called after task execution | ✅ |
| Error threshold | Reflects when errorCount >= 2 | ✅ |
| Knowledge output | Anti-patterns and patterns saved to knowledge.json | ✅ |
| Fire-and-forget | Reflection runs async, doesn't block task completion | ✅ |

**Test Scenarios:**
- [x] Reflection triggers on task failure with 2+ errors
- [x] Knowledge entries created from reflection
- [x] Reflection doesn't block task completion
- [x] Knowledge appears in Memory.md after rebuild

---

## 13. Phase 3: Intelligence Layer (Implemented)

### 13.1 PM Agent + Plan Mode ✅
| Item | Description | Status |
|------|-------------|--------|
| Role | Project Manager agent for workflow planning | ✅ |
| Input | User's natural language request | ✅ |
| Output | Proposal with taskDrafts + documentDrafts | ✅ |
| Flow | PM generates → User edits in GUI → Approve → Execute | ✅ |
| Agent type | `pm` in agentRegistry | ✅ |

**PM Workflow:**
```
User: "PM，做一个晶圆对准和检测流程"
  → PM Agent analyzes request
  → Reads templates from .irg/templates/
  → Reads project documents for context
  → Generates Proposal (taskDrafts + documentDrafts)
  → User reviews in Proposal GUI
  → approveProposal() creates Tasks + Documents
  → ExecutorAgent runs DAG
```

**Test Scenarios:**
- [x] PM Agent generates valid Proposal from request
- [x] PM Agent selects appropriate templates
- [x] Generated tasks have correct dependencies
- [x] User can edit PM-generated proposal
- [x] PM Agent reads project documents for context
- [x] PM Agent recalls relevant knowledge from knowledge.json

### 13.2 PM Knowledge Building ✅
| Phase | Source | Method | Status |
|-------|--------|--------|--------|
| Phase 1 | Template library | YAML templates in `.irg/templates/` | ✅ |
| Phase 2 | Historical execution | Reflection on completed Proposals | ✅ |
| Phase 3 | Document knowledge | Read Document module for project context | ✅ |

**Test Scenarios:**
- [x] PM loads templates from `.irg/templates/`
- [x] Template search by keywords works
- [x] Templates formatted for prompt injection
- [x] Sample template created (standard-align.yaml)

### 13.3 Hook-Triggered Knowledge Extraction ✅
| Item | Description | Status |
|------|-------------|--------|
| Trigger | `afterToolCall` hook on errors | ✅ |
| Condition | errorCount >= 3 OR known error patterns | ✅ |
| Action | Auto-record anti-patterns and patterns | ✅ |
| Output | Knowledge entries in knowledge.json | ✅ |

**Test Scenarios:**
- [x] Hook detects error pattern → creates anti-pattern entry
- [x] Hook detects recurring errors → creates anti-pattern entry
- [x] Hook detects 15+ tool uses → creates pattern entry
- [x] Knowledge entries appear in knowledge.json
- [x] Memory.md rebuilt after knowledge addition

---

## 14. Known Issues

| # | Issue | Impact | Workaround |
|---|-------|--------|------------|
| 1 | Session delete is optimistic (no rollback) | Low | Re-create session if needed |
| 2 | Permission timeout 120s | Medium | Respond within 2 minutes |
| 3 | HTTP mode: agents:generate not supported | Low | Use Electron mode |
| 4 | HTTP mode: executor start/stop are stubs | Medium | Use Electron mode |
| 5 | Browser mode: 3s polling delay | Low | Use Electron mode for real-time |
| 6 | gRPC config only visible if grpcConfig field exists | Medium | Re-import YAML after code update |
| 7 | Proposal editing only in draft status | By design | Create new proposal if needed |

---

## 15. Test Priority Matrix

### P0 (Critical - Must Test)
- [ ] Chat: Send message → receive response
- [ ] Chat: Permission modal → allow/deny
- [ ] Tasks: Create → assign → execute → complete
- [ ] Tasks: Dependency chain works
- [ ] Proposals: Import YAML → approve → tasks created
- [ ] Proposals: Edit draft → save → submit

### P1 (High - Should Test)
- [ ] Tasks: Acceptance criteria → verify → approve/reject
- [ ] Tasks: Approval modal for requires_approval
- [ ] Documents: CRUD operations
- [ ] Sessions: View, continue, delete
- [ ] Settings: LLM config save/load
- [ ] Settings: Agent CRUD

### P2 (Medium - Nice to Test)
- [ ] Sidebar navigation
- [ ] Presence panel updates
- [ ] WorkflowProgressView DAG
- [ ] Template selection in editor
- [ ] Search functionality (sessions, documents)
- [ ] Clear all sessions

### P3 (Low - Edge Cases)
- [ ] Browser mode fallback
- [ ] Multiple concurrent tasks
- [ ] Large message history
- [ ] Error handling (network failures)
- [ ] Permission timeout behavior

---

## 16. Test Environment Setup

### Prerequisites
1. Electron app running on port 3001
2. HTTP server running on port 3002
3. LLM configured (API key, model)
4. At least one agent configured

### Test Data
- Sample workflow YAML: `workflows/24.82-recipe-align-workflow.yaml`

### Test Framework
- **Location**: `gui/tests/`
- **Framework**: Playwright
- **Configuration**: `gui/tests/playwright.config.ts`
- **Run tests**: `npm test` (in gui directory, dev server must be running)
- **Documentation**: `gui/tests/README.md`
- **Quick start**: `npm run dev` (terminal 1) → `npm test` (terminal 2)

---

*Document generated: 2026-06-03*
*Updated: 2026-06-09 — Added Phase 1-3 roadmap*
*Version: 0.2.0*
*Test framework: Playwright (2026-06-04)*
