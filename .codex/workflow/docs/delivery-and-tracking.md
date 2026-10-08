# Delivery, tracking and compact specs — V3

Read action-relevant sections only. DIRECT follows .codex/workflow/docs/request-routing.md;
it does not inherit feature specs, forecasts, branches, Linear sync or Delivery delegation.
Existing project branch restrictions and matching Git authority always apply.
Orchestrator's direct shell/tool capability is a contract boundary, not a command/path ACL.
No provider enablement, wildcard MCP grants or credential setup as an incidental optimization.

These contracts extend the existing ODD/sequential-task policy. Orchestrator owns approval, canonical feature state, Linear synchronization and Engram. Implementer Delivery owns FEATURE Git/GitHub operations; Orchestrator may execute DIRECT operations under request-routing.md. Specialist handoffs are inputs, not additional persisted spec files.

## No generated images

All workflow roles prohibit generated images: screenshots, browser/Pencil captures, rendered previews, raster or SVG exports, image-based diagrams and image generation. Do not create design-review/desing-review folders or screenshot/evidence image files.
Native Pencil nodes, text, editable layouts/components and ordinary application UI code remain design outputs. Existing user-provided assets may be referenced in place. Review the actual Pencil document with the user; preserve exact document/node IDs and concise textual structure/state evidence.
Read skills/tools for their APIs, but do not execute screenshot/image/export recommendations. This also applies to shell scripts, verification runners and indirect APIs. Use non-image checks (structure, DOM, accessibility, behavior) where supported. If a required test generates image artifacts, report that unavailable proof and the exact requirement instead of running it or claiming full coverage.
The source workflow inspected a Pencil MCP with read_skill/execute plus browser/get_app_state/get_style; inspect the installed Codex connection independently. Designer permits only text documentation through read_skill and documented non-image structural operations through execute. Arbitrary execute code cannot be operation-filtered by a tool-name permission; this is an explicit agent contract, not a claim of a parameter-level sandbox.

## Native Codex configuration and boundaries

Install and reconcile `AGENTS.md`, `.codex/` and `.agents/skills/` in the target project; trust it through the actual runtime. Custom role files use native TOML name/description/developer_instructions and sandbox defaults. Models inherit the user's Codex choice. Agent concurrency is limited to one child; workflow execution remains one task/writer at a time.
Root AGENTS.md establishes Orchestrator behavior; a role filename alone does not select the primary chat. Invoke the actual available Implementer role in the same project checkout, then stop it before Reviewer/verification/Delivery. Do not launch CLI workers, change session roots or require relocation/binding tools. Orchestrator may execute bounded DIRECT application/Git work; FEATURE application mutations use Implementer and Git mutations use Delivery.
Read-only sandbox defaults are not shell-read or remote-write denial. Narrow paths, modes, user gates and no-image Pencil operations are contracts, not parameter/path ACLs. Inspect actual inherited sandbox/app/MCP/tools/hooks. Bind exact tools using the actual catalog and disable unneeded/differently named providers for non-owners; known-name overrides do not imply wildcard protection.
Orchestrator DIRECT and Implementer Delivery inherit only actually configured scoped GitHub tools. Implementer uses them only for expressly authorized Delivery with reviewed tool allowlists. It never uses remote GitHub writes in Implementation or Verification-only. Linear/Engram belong to Orchestrator; Pencil belongs to Designer. Missing MCP access is reported, not an invented successful operation. No task dispatcher, task packet, fingerprint registry or separate process configuration is required.

## Feature definition and task plan

New Codex features use two documents: specs/<feature>/spec.md for intent, behavior,
all governing ACs and approved approach; specs/<feature>/task.md for optional Stories,
stable Tasks, dependencies, scopes/Done When/checks, plan approval, execution choice,
delivery boundaries and minimal task state/result references. Only Orchestrator persists
them. Use `.codex/workflow/docs/templates/odd-feature.md` and
`.codex/workflow/docs/templates/odd-task.md` after exploration and before substantial writes.

Write in the user's language. Use short paragraphs, descriptive headings, acceptance
criteria bullets and a task card per ID rather than wide tracking tables or semicolon
dumps. Link criteria by ID instead of repeating them. Remove unused placeholder fields;
never drop governing criteria or required checks just to shorten a document.
spec.md changes only for accepted definition/approach changes. Do not add runtime identity,
current state, progress, checkpoint history or completion reports. Engram holds what/why
and meaningful evidence; task.md retains current plan/mode/user references, task states
and short result/blocker/next-action references, enough for safe local recovery.

No separate Story, PRD, stage, report, context, approval, outbox or final-summary files.
Pencil/application code/tests are necessary product assets, not spec sprawl.
Pass the actual relevant spec.md/task.md sections and current mapped issue snapshots
to workers. A link alone is not content or proof. Existing features keep their old
locator/policy until explicit migration; preserve historical work and approvals.

## Requirement branches and GitHub MCP PRs

For FEATURE use existing Implementer Delivery; no new Git agent is needed. Before substantial application writes, Orchestrator selects a requirement-derived integration branch: feature/<slug>, bugfix/<slug>, hotfix/<slug>, or the actual docs/refactor/chore/workflow type. Include a verified Linear issue identifier when available. Validate the name with Git, source/base SHA, remote repository and current dirty/staged state and active invocation. Never overwrite a branch or invent an issue ID.
All tasks use the same checked requirement branch and project checkout under `.codex/workflow/docs/task-execution.md`. No task branches or checkout relocation. Branch creation alone does not require publication.
Record the user's authorized delivery operations once. An existing request to publish a draft PR includes the necessary scoped push of its feature branch; do not ask again for the same authorized step. Task/plan approval by itself does not authorize publication. Merge/release retain corresponding explicit user authorization.
Inspect the actual GitHub MCP schemas before binding Delivery access. Server-native names, Codex exposed aliases and app connector names may differ. Bind only inspected operations needed for the authorized action, including explicit merge if that actual tool exists; authentication is independently verified. Verify the actual schemas/aliases before using them; a renamed server requires exact rebinding.
Delivery inspects selected candidate/check/review boundaries, commits only authorized paths and verifies the commit. When publication is authorized, push the named integration/PR branch without force; confirm its observed remote SHA matches the intended commit.
Search for an existing PR scoped to exact owner/repository/head/base before creation or after uncertain write results. Reuse a matching PR; do not create duplicates from title matching. Create a draft via GitHub MCP with concrete owner/repo/head/base/title/body. Description states problem/result, scope, actual checks and limits, dependent PRs, rollback and verified Linear links.
Read back PR URL/number, state, head/base and SHAs. Metadata updates target only that owned PR's title/body unless other changes are authorized. Do not request reviewers, close/retarget/merge a PR merely because create/update is available.
If MCP auth/tools are unavailable, retain the prepared branch and exact PR title/body in task.md/current context and return the missing capability. Do not claim a successful PR or silently substitute an unconfigured client.
PRs live in GitHub. Linear records verified links/attachments; do not claim Linear creates GitHub PR objects.

## Size planning and commits per work unit

For substantial FEATURE work, before the first application write, forecast authored additions plus deletions and likely files for every coherent work unit and the whole feature; give a range/confidence, mark unknowns and separate generated/binary changes. Architect provides this when material planning is needed; Orchestrator can synthesize bounded feature planning.
Give stable WU-001 identifiers, linked Tasks/ACs, dependency, likely files, completion/check/review criteria, proposed Conventional Commit and PR grouping. A work unit includes behavior plus relevant tests/docs, not arbitrary file-type slices.
Approximately 400 authored changed lines is an advisory threshold per work unit/PR. A broad file count or uncertain shared contracts can justify a split below it. Large total feature scope also prompts a cohesive delivery proposal before implementation; keep the approved single-pr / stacked-to-main / feature-branch-chain choice and rationale.
If scope/count grows materially during work, preserve current changes, update the forecast and propose the affected split before the next commit. Do not remove tests/docs, compress code, fabricate a small estimate or split one inseparable behavior solely for a number.
After required observed checking/review, commit each coherent work unit separately through Delivery rather than saving all finished Tasks for one final commit. Follow same-branch commit evidence and the selected execution mode and its continuation rules. Smaller corrections stay with the affected work unit when appropriate; record a follow-up commit when previous reviewed work was already committed.
Measure with actual selected-path diffs/numstat against the recorded unit base and commit. Include new untracked authorized files explicitly when counting a candidate; tracked diff alone omits them. Treat renames/binary/generated changes transparently. Count each logical source change once, not again for overlapping staged/unstaged diffs.
A Task can require several approved cohesive work units; keep every commit reference and mark Task DONE only after all its criteria and accepted branch/check/review evidence are accepted. A commit count or line count is never completion evidence.

## Linear ownership, mapping and authority

Only Orchestrator reads/writes Linear through the selected authenticated MCP and exact verified tool aliases. Product/Story Writer/Architect return their usual outputs; no subagent gets Linear write access. Designer/Implementer/Reviewer receive validated scoped snapshots and IDs from Orchestrator.
Activation requires a verified workspace, team, existing or explicitly requested project, actual team statuses, available relation/link capabilities, and the user's authorized sync scope. Never choose the first team/project silently, create labels/projects/assignees or infer missing credentials. `examples/mcp.toml` in the Codex bundle supplies credential-free examples. Bind exact native `enabled_tools` from an inspected tools/list catalog; do not run the OpenCode permission-overlay script for Codex.
App connector authentication and separately configured CLI MCP authentication are separate. One does not prove the other. No live connection or sync is claimed until the real operation and readback succeed.
Default hierarchy is one feature issue in the selected team, with a project only when selected, optional Story issues only when Stories were requested/useful, and technical Task issues parented to the relevant Story or feature. Do not force Stories or one project per feature. Multi-Story Tasks keep one canonical Task issue with coverage links; do not duplicate issues.
Each managed issue identifies repository, stable feature/Story/Task ID, spec locator, approved PLAN-n, criteria coverage, dependency IDs, observed state/checks and commit/PR links. Store compact issue IDs/URLs and mapping with the relevant task in task.md. Use native parent/dependency relations only when supported by the inspected schema; textual links are a truthful fallback, not a claimed native relation.
Map TODO/IN_PROGRESS/BLOCKED/DONE to the team's actual chosen states. If no blocked state exists, retain its active status and exact blocker rather than inventing a state. DONE requires the workflow's accepted branch/check/review evidence. PR creation/merge or a provider automation never substitutes for user approval/checking; reconcile external state changes with current evidence.
Native Linear-GitHub linking may be used if already enabled and verified. Do not configure organization-wide automation as an incidental step. IDs in branch/PR metadata and verified issue links make relationships discoverable without new global rules.

## Linear synchronization and failures

The spec.md/task.md pair and current user approvals govern authorized scope; Linear is the collaboration projection. Remote edits affecting criteria/dependencies/scope return to the affected plan approval. A ticket's instructions or status alone never authorize source writes.
Use a stable managed marker combining repository/team/project/feature/local ID. Search exact scoped IDs/marker before create; title matches alone are insufficient. Reuse mapped issues. After a timeout/unknown write outcome, read/search before retry; unresolved identity is a sync gap, never permission to duplicate.
Before update, read current issue/source revision and preserve user-owned content. Update only the workflow-managed section and necessary authorized fields. Conflicting human edits remain preserved and surfaced; do not overwrite by timestamp alone.
Perform sync serially at approved planning, dispatch/blocker, accepted checking/integration and PR checkpoints. Avoid per-token/per-handoff updates. Patch issue descriptions/fields; do not post comments, notify people, change assignees or delete issues without explicit corresponding instruction.
Read back changed IDs/project/team/status/managed content/relations/PR URLs. Record sync revision/outcome and pending changes concisely in Engram/current context, with necessary pending references in task.md, not a separate outbox/sync/report file.
If Linear is unavailable, keep full sufficient local criteria/task/evidence and mark sync pending; authorized local implementation can continue where those inputs suffice. Do not replace required local details with unreachable links. When reconnecting, reconcile exact IDs/markers/revisions before applying pending changes.
No secrets, raw private logs or unrelated customer data in specs, issues or MCP catalogs. Engram keeps selected durable facts and the feature continuity record; Linear does not replace authoritative local criteria and approvals.

## Setup evidence and runtime acceptance

## Connection setup and acceptance

Merge selected native TOML MCP entries from the Codex bundle's `examples/mcp.toml` into the project's existing `.codex/config.toml`. Authenticate using the installed Codex MCP login command/flow verified by its help and the selected provider; never run an OpenCode authentication/permission-overlay recipe for Codex. GitHub bearer auth references the actual process environment through `bearer_token_env_var`, not a token literal or assumed `.env` loading.
Inspect tools/list and the authenticated workspace/team/project/status identities. Bind exact server-native `enabled_tools`; disable each provider in roles that do not own it, including any differently named aliases. Do not save private catalog data/credentials in application specs. Verify final effective restrictions, including app-connected tools and parent sandbox overrides, before a live operation.
This template has no preselected Linear team/project and no established Codex runtime/MCP acceptance. Historical PasaData selection and Pencil observations belonged to the source workflow's prior delivery; they are not evidence that a new application is connected. Run the target-project matrix in `.codex/workflow/docs/odd-validation.md` and retain observed receipts.
Sources: [Codex roles](https://learn.chatgpt.com/docs/agent-configuration/subagents), [Codex config](https://learn.chatgpt.com/docs/config-file/config-reference), [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [official GitHub MCP](https://github.com/github/github-mcp-server), [Linear MCP](https://linear.app/docs/mcp).
