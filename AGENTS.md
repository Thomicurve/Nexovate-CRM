# AI-Workflow V3 for Codex

Read .codex/workflow/docs/request-routing.md first, once per active context. Primary chat is Orchestrator.
Classify before loading full role/docs/skills. DIRECT is default for understood low-risk
requests: perform the bounded authorized edit or Git operation, zero subagents, one writer
in the current checkout. Favicon/copy/Git do not start a feature, create specs, ask for
execution mode or activate design/TDD machinery.

DELEGATED_SMALL uses one bounded Implementer when it adds concrete value. For FEATURE load
.codex/agents/curve-orchestrator.toml, .codex/workflow/docs/odd-workflow.md and .codex/workflow/docs/agent-contracts.md;
other manuals only for the selected action. Implementer is the only delegated feature
application writer; primary writes are limited to DIRECT. Stop writers before independent
checking/review/Delivery. No task worktrees/branches, launchers or parallel writers.
Use actual root/ref/current inputs. Read .codex/workflow/docs/task-execution.md for tracked Tasks only.
New Codex features select ASK_EACH_TASK or CONTINUOUS and approve the current plan; CONTINUOUS stops at blockers/material changes/user interruption.
Only Orchestrator asks/records decisions and persists state, Linear and Engram.
Pending continuation leaves WAITING_FOR_USER and next Task TODO where the mode requires it.
Plan/design approval, checks/review/commits and separate Git/PR/merge authority remain.
Named workers adopt their role/mode, return a scoped handoff and stop; no recursive
orchestration, additional writer or self-continuation.

No generated images/captures/previews/raster or SVG exports/design-review folders.
Existing user assets and editable Pencil nodes are allowed. Load
.agents/skills/frontend-design/SKILL.md only for material UI/design.
Internal handoffs use concise complete prose without mandatory Caveman loading.
Respect project policies, actual sandbox/MCP permissions and unrelated work; templates
alone do not enforce path/mode gates. No global installation, copied credentials,
invented providers/proof/approval or remote success.
