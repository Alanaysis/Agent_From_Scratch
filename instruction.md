````markdown
# Wafer Inspection AI Copilot System Spec
Version: v0.1

---

# 0. Product Philosophy

## Product Positioning

This product is NOT:
- a chatbot application
- a general-purpose autonomous agent
- a SaaS dashboard
- a conversational-first interface
- a fully autonomous recipe generation system

This product IS:
- an industrial engineering workstation
- a workflow-first semiconductor inspection system
- a visualization-first professional software
- an AI-assisted recipe generation copilot
- a deterministic workflow system with AI decision support

---

## Core Design Principles

1. Workflow > Agent autonomy
2. State > Conversation
3. Visualization > Text
4. Human approval > Autonomous execution
5. Explainability > Magic AI behavior
6. Deterministic execution > Recursive agent loops

---

# 1. High-Level Product Goals

The system assists engineers in:
- loading and analyzing GDS files
- generating wafer inspection recipes
- creating ROI regions
- performing alignment
- running pilot inspections
- tuning sensitivity parameters
- explaining inspection results
- reducing repetitive engineering workload

The system must:
- maintain explicit workflow state
- provide visual engineering feedback
- support AI-assisted suggestions
- keep all operations reversible and explainable

---

# 2. Non-Goals

The system must NOT:
- rely entirely on chat interaction
- allow LLMs to directly control equipment
- allow AI to modify state without validation
- store workflow state inside chat history
- use autonomous recursive planning loops
- expose raw tool infrastructure directly to users
- generate generic SaaS-style UI

---

# 3. UI / UX Philosophy

## UI Style

Target aesthetic:
- industrial engineering software
- semiconductor / EDA style
- KLA / Siemens EDA / CAD-inspired
- dense but organized information layout
- dark theme
- engineering-focused visualization
- practical over decorative
- minimal glassmorphism
- no oversized consumer UI elements

---

## Forbidden UI Patterns

DO NOT:
- create chat-first interfaces
- create centered ChatGPT-style layouts
- use excessive whitespace
- use giant rounded SaaS cards
- create mobile-app-like layouts
- prioritize conversation over workflow
- hide workflow state
- use social/chat product interaction patterns

---

# 4. Main UI Layout

The application layout must contain 4 primary regions.

---

## LEFT PANEL — Workflow State

Persistent workflow visualization.

Example:

✓ Load GDS
✓ Layer Analysis
▶ ROI Generation
□ Pilot Run
□ Sensitivity Optimization
□ Export Recipe

Requirements:
- always visible
- deterministic step ordering
- visual step state
- explicit progress indication

---

## CENTER PANEL — Visualization Workspace

Primary engineering workspace.

Must support:
- wafer map rendering
- die grid visualization
- ROI overlays
- alignment markers
- defect heatmaps
- GDS overlay visualization
- coordinate systems
- engineering measurement overlays

Requirements:
- visualization-first design
- high rendering performance
- GPU accelerated rendering preferred
- scalable to large wafer datasets

---

## RIGHT PANEL — AI Copilot

The AI panel is assistive only.

It contains 4 sections:

### 1. Context Summary

Examples:
- current layer
- optics mode
- alignment confidence
- ROI count
- sensitivity settings
- active recipe

Purpose:
- make AI-visible context explicit to user

---

### 2. AI Suggestions

Examples:
- reduce sensitivity
- expand ROI margin
- edge die sampling recommended
- alignment confidence warning

Requirements:
- suggestions must be actionable
- suggestions must include confidence/reason
- user approval required before execution

---

### 3. AI Explanation

Purpose:
- explain why recommendations were generated
- provide engineering reasoning
- increase operator trust

---

### 4. Chat / Command Input

Purpose:
- optional interaction entry point
- workflow assistance
- querying explanations

Chat is NOT:
- the primary system interface
- the source of workflow state

---

## BOTTOM STATUS BAR

Must display:
- machine connection status
- simulation status
- current workflow state
- runtime execution logs
- active recipe
- compute/GPU status

---

# 5. System Architecture

Architecture:

GUI Layer
↓
Runtime Core
↓
gRPC Tool Layer
↓
C# / C++ Industrial Services

---

# 6. Runtime Core

The existing TypeScript CLI evolves into:

AI Runtime + Workflow Orchestrator

Responsibilities:
- workflow orchestration
- centralized state management
- AI integration
- tool execution routing
- event distribution
- execution logging

The runtime is NOT:
- a chat application
- a recursive autonomous agent
- a direct equipment controller

---

# 7. State Architecture

## Core Principle

The system must maintain a SINGLE authoritative structured state tree.

Conversation history is NEVER the system state.

---

## Global State Example

```ts
type GlobalState = {
  gds: GDSState;
  wafer: WaferState;
  roi: ROIState[];
  alignment: AlignmentState;
  sensitivity: SensitivityState;
  recipe: RecipeState;
  workflow: WorkflowState;
};
````

Requirements:

* serializable
* replayable
* versionable
* observable
* event-driven

---

# 8. Workflow Engine

The workflow engine is deterministic.

AI assists at decision points only.

---

## Example Workflow

Load GDS
→ Analyze Layout
→ Align Wafer
→ Generate ROI
→ Pilot Run
→ Sensitivity Optimization
→ Export Recipe

---

## Workflow Rules

* explicit transitions only
* reversible transitions preferred
* state mutation must be observable
* AI cannot arbitrarily skip workflow steps

---

## Recommended Technology

Preferred:

* XState v5

Alternative:

* custom DAG runtime

---

# 9. AI System Boundaries

## AI Responsibilities

Allowed:

* recommendation generation
* engineering explanation
* parameter suggestion
* anomaly analysis
* workflow guidance
* contextual reasoning

---

## AI Restrictions

Forbidden:

* direct device control
* uncontrolled state mutation
* hidden autonomous execution
* recursive self-triggering loops
* opaque execution logic

---

## AI Output Format

LLM outputs MUST be structured.

Example:

```json
{
  "action": "adjust_sensitivity",
  "value": 0.72,
  "reason": "dense SRAM pattern detected",
  "confidence": 0.83
}
```

---

# 10. Tool Execution Layer

## Communication

All tool communication uses gRPC.

---

## Tool Design Philosophy

Tools are deterministic execution units.

Tools do NOT:

* make workflow decisions
* own workflow state
* own orchestration logic

---

## gRPC Design

Use:

* grpc-js
* ts-proto
* protobuf

---

## Command-Based RPC

DO NOT create one RPC per tool action.

Preferred:

```proto
service ToolRuntime {
  rpc Execute(CommandRequest) returns (CommandResponse);
}
```

---

## Command Example

```json
{
  "command": "generate_roi",
  "params": {
    "margin": 1.3
  }
}
```

---

# 11. Event Architecture

The system is event-driven.

Example:

Runtime Core
→ Event Bus
→ GUI

---

## Event Examples

```json
{
  "type": "ROI_UPDATED"
}
```

```json
{
  "type": "ALIGNMENT_CONFIDENCE_CHANGED",
  "value": 0.91
}
```

---

# 12. GUI Communication Rules

GUI NEVER directly calls tools.

Correct flow:

GUI
→ Runtime Core
→ Tool Runtime

---

# 13. Recommended Technology Stack

## Runtime Core

* TypeScript
* Node.js
* XState v5
* Zod
* WebSocket

---

## GUI

* Electron
* React
* Zustand
* PixiJS / WebGL

---

## Tool Layer

* gRPC
* protobuf
* grpc-js
* ts-proto

---

## Industrial Services

* C#
* C++
* gRPC services

---

# 14. Visualization Requirements

Visualization is a first-class system component.

Priority:

1. wafer map
2. ROI overlays
3. defect visualization
4. alignment visualization
5. optical/sensitivity overlays

The visualization workspace is more important than the chat system.

---

# 15. Explainability Requirements

Every AI recommendation should support:

* explanation
* confidence level
* visible reasoning
* approval/rejection
* auditability

---

# 16. Human-in-the-Loop Rules

AI suggestions must be reviewable.

Preferred interaction:

AI Suggestion
→ User Approval
→ Workflow Execution

NOT:

AI Suggestion
→ Autonomous Execution

---

# 17. Anti-Patterns

DO NOT:

* build a generic AI chatbot
* over-optimize for conversational UX
* allow hidden workflow transitions
* couple GUI directly to tools
* store operational state in prompts
* build recursive autonomous agent systems
* implement SaaS-style dashboards
* prioritize AI novelty over engineering usability

---

# 18. MVP Development Order

## Phase 1

* runtime state model
* workflow engine
* gRPC execution layer

## Phase 2

* GUI shell
* workflow panel
* wafer visualization
* state synchronization

## Phase 3

* AI suggestion layer
* explanation system
* parameter recommendation

## Phase 4

* advanced optimization
* historical learning
* feedback analysis
* explainable overlays

---

# 19. Final System Philosophy

This system is:

"An industrial deterministic workflow platform enhanced with AI-assisted engineering intelligence."

It is NOT:

"A fully autonomous general-purpose AI agent."

