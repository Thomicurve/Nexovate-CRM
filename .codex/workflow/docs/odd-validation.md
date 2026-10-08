# Codex workflow validation

Repository edits are template changes, not runtime/model/MCP acceptance or global installation.

## Static checks

Run Python 3.11+ `python -m unittest discover -s tests -v` from the repository root.
Checks cover native role formats, one writer, actual references, separate runtime policies,
readable two-file templates, mode/approval boundaries, memory recovery and retained
Git/design/Linear/no-image contracts. OpenCode's separate permission tests are unchanged.

## Runtime acceptance — pending until observed

| Case | Required evidence |
| --- | --- |
| Feature start | Explicit ASK_EACH_TASK/CONTINUOUS answer plus current plan/design approval; canceled or missing answers do not dispatch |
| Per-task mode | Exact next ID shown, WAITING_FOR_USER until matching named choice, consumed once |
| Continuous mode | All listed approved Tasks run serially, each after accepted prerequisites/checks/review/commits; no repeat permission between normal successes |
| Blocker/material delta | Stop affected execution, preserve work, consult; new Tasks/revision are never covered by the old grant |
| Review/pause/mode switch | User interruption stops progression, explicit resume required; prospective mode switch retains plan/Git boundaries |
| Recovery | Reconcile files/authority/HEAD/liveness/proof; resume current continuous plan only if grant remains valid; no duplicate writer |
| Memory outage | task.md retains sufficient compact approval/check/review references; continue only with required local evidence; report pending memory truthfully |
| Documents | Readable spec.md definition and task.md Stories/Tasks; no Identity and current state or progress history in spec; no extra reports |
| Completion | Feature checks/review and true result, separate from PR/merge/deployment |
| Providers | Scoped Engram continuity save/read, actual tool permissions/hooks; owner-only Linear; authorized Delivery-only GitHub with readback |
| Preservation | Same checkout, no parallel writers/task branches/launchers, no indiscriminate staging/reset, legacy migration only by consent |
| Design | Actual approved Pencil nodes, no generated images/captures/exports |

Record meaningful receipts in Engram/current context, with short required fallback
references in task.md. Static checks do not enforce human choices, scheduling, provider
writes or LLM behavior. Do not claim measured token savings or runtime acceptance.


## V3 routing and token acceptance — pending until observed

Install/reconcile a coherent V3 bundle in the already selected test project; no automatic
global install or credential changes. Record the actual primary role, model/settings,
provider tools and source revision. Exercise cases with user-authorized assets/operations;
inspect resulting files/state/remote identities using non-image checks.

| Request / precondition | Expected route and evidence |
| --- | --- |
| Replace existing favicon, supplied asset, no material design change | DIRECT, zero subagents, scoped asset/link readback; no spec, TDD/mode/design question or Linear |
| Correct known text/link/cosmetic value | DIRECT, zero subagents, pertinent check; no extra refactor or full suite |
| Find favicon path in unfamiliar project | Focused primary read/search, not automatic Explorer; classify actual risk |
| Push existing commits to verified upstream | DIRECT, zero subagents; branch/remote/result verified; no new commit/branch/PR/spec/reviewer |
| Push with missing/ambiguous destination or uncertain previous outcome | Inspect first, one required question if unresolved; no inferred remote authority or duplicate write |
| Direct tool blocked/missing, bounded fix still feasible through worker | DELEGATED_SMALL, one scoped Implementer, short handoff, no automatic additional specialists |
| Fix auth/data-loss/public-contract risk in one file | Independent verification/review, no unchecked DIRECT shortcut; preserve scoped criteria/authority |
| Material UI or multi-outcome feature | FEATURE, current plan/design approval and runtime-specific continuation, named specialists only |
| Dirty/staged unrelated files or protected branch policy | Preserve work/restrictions, no broad stage/reset/stash or silent branch change |
| Small request reveals architecture/material scope | Stop affected writes, show delta and obtain required feature approval |
| Resume legacy full mirror feature | Reconcile old locator/evidence/policy; no lossy automatic migration |
| Last tracked Task with unchanged accepted WU receipts | Closure checks unreviewed integration/criteria; no duplicate full review/check pass |

Compare these cases before/after with the same runtime/model/settings and equivalent
project state. Record actual subagent invocations, tool calls, loaded document characters,
and input/output/cached/reasoning token usage when the runtime exposes them. Text size and
call counts are separate metrics, not measured token or price savings. Report unavailable
counters. Reuse manual receipts/current context; do not generate screenshot/export artifacts.
Static tests enforce shipped routing/authority/reference/size regressions only; they do not
prove model compliance, permission enforcement, live provider behavior or token savings.
