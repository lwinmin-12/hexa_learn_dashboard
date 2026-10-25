### Feature

**You own the design. Plan, review, verify.** Delegate implementation. Stay in the lead.

1. `how` over the affected subsystem.
2. `architect` for parallel design exploration.
3. Write the throughput checkpoint as four todo items. A dimension that genuinely does not apply (single file, no fan-out) keeps its item with `n/a: <reason>` rather than being dropped:
   - **Blocking first steps.** Gates run before fan-out.
   - **Independent workstreams.** Disjoint files, services, or layers parallelize. Shared writes serialize.
   - **Shared mutable state.** Default to splitting the target (the **separate-before-serializing-shared-state** principle skill). Serialize only for real invariants.
   - **Smallest safe decomposition.** If one worker is best, name why.
4. Delegate code-writing to a subagent using your configured feature model (default in poteto-mode's Models section) with a specific scope (file paths, named data shape and its organizing structure per **principle-model-the-domain**, a state machine over scattered booleans, a table/registry over branching, a typed model over repeated shape assumptions, chosen before the delegate writes logic, and success criteria). Pick each subagent's reasoning level for the job, per the Subagents section. When the implementation admits multiple valid shapes (error handling, abstraction layer, test structure), delegate via the **arena** skill instead so the runners surface the alternatives and the cross-judge guards the pick. Mandatory: no skip-with-reason escape, and Laziness Protocol does not override it (the gain is review separation, not lines saved). A subagent forbidden to spawn satisfies this by owning the diff directly with the same review separation. No "standing by" reply that waits on a nested agent. **Give every file-writing delegate its own worktree** (spawn it with `isolation: "worktree"`, or hand it an exclusive branch), and do not write files or run a suite in a worktree a delegate still holds. On Claude Code, `isolation: "worktree"` branches from the remote default branch unless the `worktree.baseRef` setting is "head". When a delegate builds on commits the default branch lacks, commit them, create its worktree with `git worktree add <path> -b <delegate-branch> HEAD`, and name that base commit in the brief. Fencing a file in the brief's prose is not a lock (**principle-separate-before-serializing-shared-state**). Comments per **Comments**. Surgical edits, re-ground against the source for upstream-derived files. Port shared-primitive improvements to all consumers and verify each. Commit liberally.
5. Verify on the matching surface. "Inconclusive" or wrong-surface is not a pass. Flag it.
6. Rebase into small, ordered commits. Stack follow-ups.
   Use the **sequence-verifiable-units** principle skill, building, verifying, and committing each small unit before the next.
7. If the design is contested, `interrogate` before shipping.
8. Run **Opening a PR**.

- **Blocking first steps.** Read current UI/API wiring, list endpoint availability, course route, mocks, and relevant tests.
- **Independent workstreams.** Frontend list/dialog/page and its tests/mocks form one coupled workstream. Existing API route inspection is independent; endpoint stays unchanged unless required behavior proves impossible.
- **Shared mutable state.** Frontend files are one shared worktree with no Git metadata, so edits serialize.
- **Smallest safe decomposition.** One owner keeps route/query state, shared quiz components, and MSW data coherent; no safe isolated writer worktree exists in the frontend folder.

### Architecture phases
- Ground: done. Shared course-tab quiz row/dialog are private functions; API has only course-scoped listing, no `GET /admin/quizzes`.
- Sketch: use a shared typed list item; URL state owns filters/sort/page; React Query keys include request filters; list/dialog are extracted for both surfaces.
- Agree: proceed with the user-specified shape; list API absence becomes a normal retry state and is reported.
- Implement: complete; shared components used by both list surfaces and API route added.
- Scrap: if existing API/UI shape contradicts the contract, reconsider before adding a workaround.

### Work
- [x] Fetch and inspect complete global list API and course endpoint support.
- [x] Extract shared QuizList, QuizRow, and NewQuizDialog behavior while keeping course tab behavior.
- [x] Implement URL-filtered global page with loading/error/empty states and query invalidation.
- [x] Expand MSW data and write the requested role/state/interaction tests.
- [x] Run frontend build, lint, and tests. Browser inspection was unavailable because the dev server could not bind in the sandbox.
