# Books feature

- [x] **Blocking first steps.** Gates run before fan-out.
  - Inspect the backend books contract and current course editor, query, upload, dialog, and mock patterns.
- [x] **Independent workstreams.** Disjoint files, services, or layers parallelize. Shared writes serialize.
  - skip: task instructions disable delegation; one owner made the integrated UI, API, and mock changes.
- [x] **Shared mutable state.** Default to splitting the target (the **separate-before-serializing-shared-state** principle skill). Serialize only for real invariants.
  - CourseEditorPage, CourseContent, and route ownership were integrated sequentially around the shared Book data contract.
- [x] **Smallest safe decomposition.** If one worker is best, name why.
  - One owner is required because route selection, chapter deep links, book counts, query invalidation, and MSW fixtures share the same data contract.
- [x] Ground the Books API and current course editor patterns.
- [x] Implement API types, query keys, upload limit constant, and MSW fixtures.
- [x] Build Books tab, dialog, preview, permission updates, and ordering.
- [x] Integrate route, editor tab, and chapter book links.
- [x] Add behavior tests and run tests, build, and lint.

## Data model

`Book` is attached to exactly one course or chapter. Its `scope` discriminant matches `attachedTo.type`. `BooksTab` owns URL-backed filters and the list query; create/edit/replace/preview are explicit dialog modes. A section owns its ordered book IDs for optimistic reorder, with the server list as rollback state.

## Verification checkpoint

- `npm test`: 18 files, 66 tests passed.
- `npm run build`: passed; Vite reported existing dependency-comment and large-chunk warnings.
- `npm run lint`: passed.
- Book upload tests inspect the observable multipart payload at the API boundary because jsdom does not reliably complete the XHR upload path.
- Risk: the UI upload limit mirrors the backend default of 50 MB; an overridden `BOOK_MAX_MB` backend setting must be kept in sync.
