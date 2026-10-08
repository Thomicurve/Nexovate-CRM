# Sequential tasks with a feature execution choice

V3 scope: this lifecycle governs tracked FEATURE Tasks only. DIRECT and DELEGATED_SMALL
follow .codex/workflow/docs/request-routing.md without task artifacts or per-task checkpoints.
Critical small changes retain required independent checks/review with scoped inline criteria.

This contract governs Codex only. OpenCode retains its mandatory per-task checkpoint.
Use the existing project checkout and one dedicated requirement branch. No task
worktrees, task branches, parallel writers, launcher or per-task cherry-pick lifecycle.

## Choose how to advance

Before beginning each new feature, Orchestrator asks the user to choose:

- **ASK_EACH_TASK:** show each result and ask before starting the next named task.
- **CONTINUOUS:** complete the tasks of the explicitly approved plan sequentially,
  with required checking/review/commits; ask at blockers or material changes.

Record the submitted choice in task.md (inline Context Map for small work).
The choice does not approve a speculative plan. Present the exact SPEC-n/PLAN-n,
all Task IDs/objectives/criteria, optional Stories, dependencies, scopes, checks,
TDD/design/risk, delivery strategy and the first ready Task for explicit approval.
Missing or canceled mode answers remain PENDING: if the question tool is unavailable,
ask the same concise question in chat and wait. Neither silence nor elapsed time is permission.

In ASK_EACH_TASK, approval permits only the first ready task identified in the
presentation. If unidentified or changed, confirm the exact ready Task ID before writing.
In CONTINUOUS, explicit plan approval together with the explicit mode choice
authorizes every listed task in that revision, one at a time. Plan approval alone
does not select CONTINUOUS. An old 'do everything' instruction from another feature
does not choose the mode or approve this plan.
Small known authorized work retains inline criteria/authorization without artificial
plan approval or durable feature files; a single isolated fix needs no extra mode
dialog. If it becomes a feature/task set, obtain the execution choice before advancing.

## Same-checkout lifecycle

1. Verify root/repository/branch/HEAD, current inputs, active writers and Git operations.
   No application writes on main. Delivery creates/reuses the authorized requirement
   branch. Never reset, stash, overwrite branches or stage everything to obtain a clean state.
2. Check acyclic dependencies and accepted prerequisite proof on this branch.
   Preserve dirty/staged/untracked work. Establish allowed surfaces and an explicit
   baseline. Pause affected actions when attribution/checks/commit cannot be established.
3. Mark only the selected authorized Task IN_PROGRESS. Supply spec.md and task.md
   sections, SPEC/PLAN revisions, mode/approval references, scope/baseline, criteria,
   TDD/checks, design and accepted dependencies. There is at most one application-writing
   invocation. Do not batch Tasks into a worker or prepare the next one in the background.
4. Implementer performs this task and in-scope tests/docs/corrections, reports exact
   results and stops. Reviewer inspects the stopped candidate. High or unresolved high-consequence risk uses
   a fresh verification-only invocation after the writer stops; temporal separation
   provides independent evidence, not filesystem isolation.
5. Delivery commits each accepted coherent work unit on the same feature branch using
   selected paths and preserving unrelated work. No source/integrated SHA pair or
   cherry-pick is required. DONE requires every AC, required check/review and verified
   branch commit. Missing proof remains BLOCKED/IN_PROGRESS, never fabricated DONE.
6. Orchestrator updates minimal task state/result references in task.md, saves the
   meaningful result and why in Engram, reconciles authorized Linear changes and shows
   the result. CONTINUOUS then selects the next approved ready task after verifying
   current authority/dependencies. ASK_EACH_TASK opens the checkpoint below.

All roles stop after their bounded handoff. Only Orchestrator can select the next
Task under the matching mode/approval. Continuous mode does not bypass reviews,
dependencies or commits. A failed/partial task reports its gap: do not skip it or
start another task silently. Ask the user how to resolve a blocker before continuing.

## Per-task checkpoint and user interruption

In ASK_EACH_TASK, show completed Task/outcome, criteria coverage, checks/review,
commits, limitations and next exact ready Task ID/title/dependencies. Ask
continue/review/pause. Keep feature WAITING_FOR_USER and next Task TODO until a
submitted matching decision. Record only the current checkpoint in task.md.
CONTINUE_TASK authorizes that named next task only. Consume the decision when
starting that task; never reuse it for a third task, a changed plan or a different
proposed ID. Clarify an ambiguous 'continue' when the proposed ID is no longer current.

In either mode, an explicit user review/pause interrupts automatic progression.
REVIEW_CURRENT keeps the next task TODO and allows only requested review/in-scope
correction. PAUSE keeps the feature WAITING_FOR_USER and preserves files/commits.
After review, present a fresh checkpoint in ASK_EACH_TASK; in CONTINUOUS reconcile
the valid plan/mode and obtain explicit resume after an interruption. Silence is not resume.

Material scope/criteria/design changes, architecture or delivery changes and added
meaningful Tasks require approval of the affected delta/new PLAN revision. Stop
affected execution and ask; CONTINUOUS never extends its grant to an unapproved
revision. Preserve valid completed work. A mode switch is an explicit user decision,
applies prospectively to the current approved plan and does not alter Git permissions.

After the final task, run genuine feature-level checking/review and report the outcome;
do not invent a nonexistent next task. Push, PR, merge, release and deployment retain
their separate matching authorizations in either mode.

## Recovery and migration

Feature states: PREPARING/WAITING_FOR_USER/READY/IMPLEMENTING/CHECKING/BLOCKED/DONE.
Task states: TODO/IN_PROGRESS/BLOCKED/DONE. Feature state/runtime identity and detailed
progress live in current context and Engram, not in spec.md.
On resume/compaction, reconcile root/ref/HEAD, spec.md/task.md, explicit user choices,
Engram evidence, code/commits, checks and live/stopped invocation. Never dispatch
while prior liveness is unknown. Resume an already authorized active task only
after identity/scope/liveness reconciliation. A missing continuation receipt defaults
to WAITING_FOR_USER in ASK_EACH_TASK; missing mode/current plan approval or an
unresolved pause/blocker defaults to WAITING_FOR_USER in either mode.
CONTINUOUS may resume the next approved TODO only after its recorded explicit grant
and current proof are reconciled. Memory is supporting context, never new authorization.

This policy applies to new Codex features. Existing single-file/legacy features keep
their locator, completed IDs/commits and checkpoint policy until explicit migration.
Propose the split, reconcile approvals/evidence, obtain the mode and plan confirmation
and only then migrate to spec.md/task.md. Do not delete old work or silently convert
old approval into continuous consent. No installation, scheduler or cleanup is implied.
