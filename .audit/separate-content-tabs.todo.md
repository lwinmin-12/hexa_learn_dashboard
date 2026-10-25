- [x] Ground. Read the course tabs, chapter tools, callers, and existing tests.
- [x] Sketch. Compare a required tool-kind prop with extracting two separate panels.
- [x] Agree. Proceed without a checkpoint for this requested UI change.
- [x] Implement. Add separate tabs, retain chapter selection, and scope each query to its tab.
- [x] Scrap. Remove the combined Content sidebar and verify the result.

Data shape: ChapterTools requires mode 'flashcards' or 'audio', so exactly one tool is presented per tab. The existing course and chapter data remain the API source.

Throughput checkpoint: The tab owner and ChapterTools caller must change together. One writer owns the two files. Existing CRUD, uploads, CSV import, and query keys remain in ChapterTools. Verification checks tab visibility and request isolation, then build and lint.

Synthesis: chose the required tool-kind prop over extracting two new panel files. It preserves the existing editor code and gates queries by the selected tool. Both alternatives were explored by independent read-only agents.

Verification: build and lint pass. All 18 tests pass, including tab visibility, chapter selection, and tool-specific request isolation. Browser inspection confirmed separate Flashcards and Audio tracks views using mock data. The live API was not retested.
