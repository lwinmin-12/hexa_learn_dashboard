# Payment method QR image upload

## Create error follow-up

- [x] Trace the missing type/name error to the running Docker image: its compiled controller has no multipart interceptor.
- [x] Rebuild and restart the local API container; live API is healthy and advertises multipart type/name/file fields.
- [x] Exercise multipart create/update and JSON create through the real controller and validation pipe: stale build failed 2/3, current build passes 3/3.

## Architect phases

- [x] Ground the payment method form, API, and media storage paths.
- [x] Sketch at least two viable upload designs and compare their interfaces.
- [x] Select the base design and record alternatives.
- [x] Implement the selected design across dashboard, API, validation, and tests.
- [x] Scrap and redesign if implementation shows repeated structural friction; no repeated structural friction appeared.

## Arena phases

- [x] Frame the candidate artifact, scoring rubric, and isolated output directories.
- [x] Fan out design candidates.
- [x] Cross-judge candidate designs.
- [x] Pick a base design.
- [x] Graft worthwhile ideas and record the synthesis.
- [x] Verify the implementation and docs.

## Grounding

- The dashboard form in `src/features/payments/pages/PaymentMethodsPage.tsx` submits JSON through `src/features/payments/api.ts`; QR methods currently accept a manually typed URL.
- The API stores `PaymentMethod.qrImageUrl` as nullable text and validates it as an HTTP(S) URL.
- Admin and learner payment method lists and payment details include this field.
- `StorageService` stores private media objects and returns signed GET URLs. Existing course cover uploads validate image bytes, use the `MEDIA` bucket, and queue replaced files for cleanup.
- There is no payment method image upload route. Uploaded QR images must remain accessible to learners after a signed URL expires, and replacing or deleting an uploaded image must clean up its stored object.

## Design rubric

1. Keep the dashboard caller simple: pick an image, save the method, and display a preview.
2. Keep QR images private in the existing storage bucket and refresh signed URLs on reads.
3. Preserve JSON updates and external QR URLs already stored in existing records.
4. Prevent abandoned uploads and failed saves from leaving unbounded stored files; clean replaced/deleted uploads.
5. Validate actual image content and enforce a size limit at the API boundary.
