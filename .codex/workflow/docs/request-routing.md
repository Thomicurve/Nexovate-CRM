# Request routing — V3

Read this compact policy once per active context, before role manuals, planning,
memory or integrations. Use current authorization and a focused read/search to classify.
Do not announce a routing ceremony or ask the user to choose a route.

## DIRECT — default for understood, low-risk requests

Primary Orchestrator may perform bounded application edits and authorized Git operations
itself. Zero subagents; at most one writer in the current checkout. Examples: replace an
existing favicon with a supplied asset, fix a typo/link, change copy, adjust a known cosmetic
value, inspect status/diff, or push existing commits to a verified destination. Locating a
favicon does not require Explorer. Read-only explanations/research remain read-only.

Inspect only relevant files/state; make the minimal authorized change and run pertinent
checks. Passive assets/copy need structural/link/readback checks; behavior needs functional
proof. TDD is N/A for passive assets, copy and Git-only work unless an explicit applicable
project/user policy requires it. No artificial tests, unrelated suite or TDD question for
a favicon or push. No feature spec/task files, execution-mode question, plan approval
ceremony, Context Map, mandatory Caveman load, Linear sync or feature memory record.
Save a durable fact only if there is one; follow installed lifecycle without duplication.

Use the verified current branch when project policy permits. Do not create a branch or
switch checkout merely to satisfy feature rules. Respect existing branch restrictions;
prepare a required branch directly and serially. Never change branch while a writer runs.
For Git-only work inspect root/ref/HEAD and remote/upstream, execute only requested operations
and verify the result. A push request authorizes that push, not a new commit/branch/PR/merge.
A PR request includes its scoped push; merge needs matching explicit authorization.
Preserve dirty/staged work. Never force-push, reset, clean, stash, overwrite branches, stage
unrelated paths or invent remote success. Inspect ambiguous destinations/uncertain writes;
ask one focused question only if the required authority/destination remains unresolved.
No new implementation/review cycle for Git-only work. A standalone Git request does not
bypass an active feature's required acceptance/delivery gate; reuse valid existing proof.

## DELEGATED_SMALL — delegation only for concrete value

One scoped Implementer invocation when direct execution lacks a required capability or a
bounded nontrivial fix benefits from a worker. No Explorer/Architect/Designer simply because
the request mentions code/UI. Supply inline scope/authority, current files/root/ref, checks
and applicable Git/branch policy. Critical small fixes additionally use the FEATURE
independent checks/review with inline criteria when no tracking is useful. Load only its role and the small-handoff section of
agent-contracts.md; delivery instructions only for assigned operations.
No feature artifacts or task continuation gate. Return the result and stop.

## FEATURE — recoverable or materially complex work

Multiple meaningful behavior/architecture outcomes, material UI/UX, complex dependencies
or progress genuinely needing recovery use FEATURE. Locate/edit/check are one bounded
outcome, not three implementation steps.
Security/auth, credentials, data loss, concurrency, migrations, installation and public
contracts need independent review/checks even for small patches. An unfamiliar path alone
is not high risk: inspect locally to classify. Unresolved high-consequence risk cannot use
DIRECT; escalate affected scope instead of guessing a harmless risk level.

Load odd-workflow.md and agent-contracts.md for planning; task-execution.md for tracked
execution; engram-memory.md for actual continuity; delivery-and-tracking.md for delivery or
authorized Linear sync. Read assigned sections once, refresh changed inputs after source
changes/compaction. Workers load their own role/inputs, not parent history or every manual.
Specialists resolve a named material gap; routine corrections stay with the current writer.
frontend-design/Pencil is for material UI/design, not favicon/copy/known cosmetic changes.
Explicitly requested design work may require Designer.

Keep current plan/design approval, independent review, required checks and work-unit commits.
OpenCode waits for named continue/review/pause between tracked Tasks; Codex uses selected
ASK_EACH_TASK or CONTINUOUS. Publication/merge retain matching authorization. If small work
reveals material scope/risk, stop, reuse valid evidence and present the delta for feature
approval before substantial writes. Never split a feature into trivial requests to evade gates.
