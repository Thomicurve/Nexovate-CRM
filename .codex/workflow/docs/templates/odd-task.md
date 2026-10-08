# <Feature title> — plan and tasks

**Definition:** [spec.md](spec.md) · **Feature:** <stable-id>
**Plan revision:** PLAN-1 · **Definition covered:** SPEC-1

## How we will work

- **Execution mode:** PENDING / ASK_EACH_TASK / CONTINUOUS
- **User's mode choice:** <Exact submitted decision reference, or pending.>
- **Plan approval:** PENDING / APPROVE_CURRENT_PLAN / REQUEST_CHANGES
- **Approval reference:** <User decision covering PLAN-1, SPEC-1, task set and delivery scope.>
- **First task:** <Exact ready Task ID, or pending.>
- **TDD and checks:** <ON/OFF, source, real runner and required feature checks.>
- **Delivery:** <Chosen WU/PR strategy, rationale and authorized Git/Linear operations.>

Continuous mode advances one task at a time through this approved plan. It stops
for blockers, material changes, missing proof or a user pause. Publication and
merge require their own authorization.

## User stories

### US-001 — <User-facing outcome>

As <actor>, I want <capability>, so that <value>.

- **Criteria:** AC-001 from spec.md.
- **Functional dependencies:** None / <Story IDs>.

<!-- Omit User stories when they add no value. Story Writer authors them. -->

## Tasks

### TASK-001 — <Concrete outcome>

**Status:** TODO · **Story:** US-001 / N/A · **Criteria:** AC-001

<One short paragraph explaining the work and its boundaries.>

- **Depends on:** None / <Task IDs>.
- **Allowed files:** <Exact paths/narrow globs and authorized new-file directories.>
- **Done when:** <Observable conditions, required tests/docs and review.>
- **Checks:** <Exact commands/checks, or a verified shared checks section.>
- **Work units:** WU-001 — <Coherent behavior/tests/docs boundary, forecast of authored lines/files, confidence and PR grouping.>
- **Result reference:** <Verified commit/evidence locator, or pending.>
- **Blocker or reopening reason:** <Only when applicable.>
- **Linear:** <Verified ID, or not enabled; omit when unused.>

<!-- Repeat this short task card per Task; avoid wide tracking tables.
States: TODO, IN_PROGRESS, BLOCKED, DONE. Only Orchestrator changes states.
Keep all criteria, dependencies and Done When readable. Do not copy AC text.
Result reference is a short locator, not a testing log or progress narrative. -->

## Next step

- **Next task:** <Exact ready ID or None after the last task.>
- **Continuation:** PENDING / CONTINUE_TASK / REVIEW_CURRENT / PAUSE / COVERED_BY_CONTINUOUS_PLAN
- **User decision:** <Reference and named Task for per-task continuation, or approved continuous PLAN/mode reference.>
- **Consumed by:** <Invocation for one-shot continuation, or not consumed; continuous plan grants are revision-scoped.>

<!-- Keep only the current continuation, not a checkpoint history.
In ASK_EACH_TASK keep the next Task TODO while waiting; consume each named choice once.
In CONTINUOUS the next Task remains TODO until its prerequisites and dispatch are verified.
Save meaningful results, reasons, checks, commits and session recovery context in Engram.
If memory is unavailable, keep necessary short approval/evidence/blocker references here
and report pending memory once. Missing required proof or authority blocks dispatch.
Write in the user's language, remove unused fields and do not create extra report files. -->
