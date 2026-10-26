# Chapter status control

- [x] **Blocking first steps.** Gates run before fan-out.
  - Read the chapter editor, status DTO, PATCH route, and schedule behavior before choosing the controls.
- [x] **Independent workstreams.** Disjoint files, services, or layers parallelize. Shared writes serialize.
  - CourseContent.tsx and its behavior tests share the same status control and stay in one implementation path.
- [x] **Shared mutable state.** Default to splitting the target (the **separate-before-serializing-shared-state** principle skill). Serialize only for real invariants.
  - Chapter status is saved through the existing chapter PATCH route and refreshed through the course query.
- [x] **Smallest safe decomposition.** If one worker is best, name why.
  - One chapter card action and one mutation cover the API-backed status update.
- [x] Add Draft and Published actions to each chapter's actions menu.
- [x] Add success and failed-update behavior tests.
- [x] Verify the dashboard with `npm test`, `npm run build`, and `npm run lint`.
  - 18 test files passed with 68 tests total. The production build completed with existing dependency-comment and bundle-size warnings.
