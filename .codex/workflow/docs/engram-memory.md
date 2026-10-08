# Engram: decisions and feature continuity

V3: load only for meaningful recall/persistence, never routine favicon/copy/Git plumbing.
No feature record for DIRECT/DELEGATED_SMALL; new tracked features use compact continuity.

Codex uses Engram for meaningful progress, what was done and why, approvals and
recovery context. Local spec.md defines the feature; task.md contains Stories,
the approved plan, execution choice and minimum task status. Do not maintain
Identity and current state in spec.md or mirror a giant spec after each handoff.

## Ownership and actual tools

Only Orchestrator calls Engram. Specialists return Memory Candidates and never
register sessions, write memories or access providers. Inspect actual schemas,
aliases, permissions and installed hooks; do not assume OpenCode aliases/lifecycle.
Confirm workspace identity with mem_current_project; scope reads/writes to this
project. Do not search other projects as a fallback or invent project/session IDs.
Use mem_context once at start/resume, search narrowly for missing context and
retrieve relevant full observations. Never treat snippets as complete evidence.
Do not duplicate plugin-managed session lifecycle. Follow actual returned conflict
schemas; do not grant administrative tools implicitly.

## Selected durable facts

Save confirmed decisions, architecture, discoveries, bugs, patterns, configuration
and preferences when meaningful. Use concise What / Why / Where / Learned with
stable feature/Task IDs, source revision, evidence locators, observed status and
limits. Deduplicate and reuse a topic only for the same evolving fact, such as
feature/<stable-id>/decision/<topic>. Distinguish proposed, implemented and approved.

## Feature continuity record

Keep project-scoped topic odd/<feature>/tasks as the current continuity record,
not a verbatim full feature mirror for new features. Include:

- Relative spec.md/task.md locators, feature ID and current SPEC/PLAN revisions.
- Actual repository/root/branch/base/HEAD and current feature/active Task state.
- Explicit execution mode, exact current approval scope and user decision references.
- Pending/consumed named continuation in ASK_EACH_TASK, or the revision-scoped
  continuous grant; include any pause, review interruption or changed-plan gap.
- Meaningful work/results and reasons, criteria coverage, actual checks/review,
  baseline/candidate/commit boundaries, accepted dependencies and missing proof.
- Verified Linear/PR IDs and outcomes, pending sync, blockers and concrete next action.

Save after approval/mode changes, meaningful results/commits, blockers, interruptions
and closure, not every handoff. Use supported type decision and inspect actual payload
limits. Read back the saved full observation and compare project/topic/revisions and
the intended record before claiming it saved successfully. A summary is a continuity
record, never an exact document mirror. Do not claim unseen Linear bodies were stored.
No credentials, private raw logs, transcripts or duplicated diffs in memory.

## Reconciliation and unavailable memory

Current files, explicit user decisions and observed source/check/commit evidence
govern behavior; memory is not new authorization or proof by itself. Reconcile both
local documents with the continuity record before dispatch. Do not prefer a version
merely by timestamp. Preserve conflicts and pause only affected work.
Missing memory does not erase a recorded valid continuous grant or force repeated
approval when current local evidence suffices. Missing approval, mode, liveness or
required proof blocks dispatch. Unknown interrupted progression is never guessed.

On a save/access/payload failure, keep minimal approval/continuation/evidence/blocker
references in task.md and current context, mark memory pending and report the gap once.
Continue authorized work where local evidence suffices; avoid adding a history log to
spec.md/task.md. On reconnect, reconcile files/commits and save the supported result;
do not claim an abrupt interruption was captured. Local result references need enough
actual check/review scope and observed verdict to support recovery, not bare links.

At significant interruption/end, save Goal / Instructions / Discoveries / Accomplished /
Next Steps / Relevant Files with mode, revisions, authority, results and open gaps.
On compaction recall/reconcile; do not duplicate lifecycle summaries unnecessarily.

## Legacy features and acceptance

Existing full mirrors and single-file specs remain valid under their existing policy
until explicit migration. Retrieve the full old observation, preserve source references,
criteria/Stories/Tasks/approvals and completed evidence, then split the approved inputs
and create a continuity record on the same stable topic only after migration consent.
Never overwrite legacy evidence with a lossy summary before reconciliation.

Runtime acceptance remains pending: verify actual tools, project isolation, save/read
equality for continuity records, stale grant rejection, both modes after resume,
pause/material-change handling, conflicts/outages/payload rejection, subagent access
restrictions and actual hooks. Static tests cannot prove provider or agent behavior.
