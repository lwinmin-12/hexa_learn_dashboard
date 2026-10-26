# Payment method QR image upload

## Problem

The admin payment method form previously stored a manually entered `qrImageUrl`. The API persists that value in one nullable column, but course-cover upload patterns show that private files belong in `MEDIA` and are served through signed URLs. Existing admin and learner endpoints both return payment methods, so every read path must turn a stable stored key into a fresh URL.

## Usage (caller's view)

An admin chooses an image in the payment method dialog, previews it locally, and saves. Editing without a new file keeps the existing image; switching to bank transfer clears it. The API response contains a usable image URL.

```ts
await savePaymentMethod(null, fields, selectedImage);
await savePaymentMethod(method.id, { ...method, ...updatedFields }, null); // keep QR image
```

## Shape

The dashboard keeps its existing JSON write for ordinary edits and sends multipart data with a `file` part only when replacing a QR image. It never sends a signed output URL back as a stored value. The existing POST/PATCH routes validate the image through `imageFile`, store it under a generated `payment-methods/qr/` key in private `MEDIA`, and keep that stable key in `qrImageUrl`. The 5 MiB interceptor limit bounds buffering, and signature plus MIME validation remains at the API trust boundary.

The admin service owns upload, database mutation, and cleanup. A serializable read/update captures the image key actually replaced. Replaced and deleted managed keys use the existing cleanup queue; failed database writes attempt immediate cleanup and queue a retry if that fails. Queue errors after committed writes are logged without turning a successful save into a failed response. A failed cleanup enqueue can still leave an old object orphaned; durable reconciliation is outside this form change.

Both admin and learner services sign the field for method lists and nested payment details. `StorageService.mediaUrl` passes legacy HTTP(S) URLs through unchanged, so no migration is needed. The existing JSON DTO remains compatible, and multipart empty strings for optional account fields are normalized to null at the API boundary.

## Synthesis decision

Candidate C is the base: it uses one multipart save on existing write routes and keeps JSON compatibility. The cross-judge agreed it is the smallest complete design. Candidate A's explicit keep/replace semantics and serializable replacement handling were incorporated. Candidate C's field name `qrImage` was adapted to the existing `file` convention used by course cover uploads. Candidate B's durable cleanup ledger and reconciliation worker were rejected as broader than a single payment-method upload request.

## Tradeoffs accepted

- We accept storing a private object key or legacy URL in the same nullable column in exchange for avoiding a schema migration.
- We accept a multipart save for image replacement in exchange for keeping one user action and no staged-upload cleanup protocol.
- We accept best-effort queue cleanup with logging in exchange for not returning a false failure after a committed change; failed enqueue can orphan a retired image.
- We accept signed URLs with the storage service's normal expiry in exchange for keeping uploaded QR images private.

## Alternatives considered

- A staged upload endpoint followed by JSON save exposes a two-step protocol and creates abandoned uploads when the admin cancels. It loses to multipart on the existing save route.
- A durable cleanup ledger would improve recovery from queue outages but requires schema, worker, and reconciliation changes beyond this request.
- Persisting signed URLs would make learner images expire. Stable keys plus signing at reads avoid that failure.

## Implementation reconciliation

- The dashboard uses `file` rather than the candidate's `qrImage` part name to match the repository's existing upload convention.
- The form retains an existing QR preview and only sends a file on replacement. The API helper suppresses a selected file when the final method type is bank transfer and sends explicit blank account fields as empty multipart values; DTO transforms turn those into null.
- The existing JSON `qrImageUrl` contract remains supported for compatibility, while the dashboard UI no longer exposes URL entry.
- Create-error follow-up: the running Docker image contained the old controller without multipart interception. Rebuilding and restarting the local API activated the implemented routes; no business-logic change was needed.

## Open questions and risks

- A process crash after upload but before the database write can leave an unreferenced object; the repository has no general storage reconciliation facility.
- A configured private MEDIA bucket and working Redis cleanup queue are still required at runtime.

## Next implementation step

No implementation remains; verify the API against the deployment's configured storage and learner payment flow.

## Verification

- Dashboard focused payment API tests: passed (3 tests).
- Dashboard production build and lint: passed.
- API source TypeScript check and lint: passed.
- Standard API build: passed using installed Node 24.12.0, matching the Docker base; Node 22.9.0 is incompatible with installed dependencies.
- Real-controller HTTP regression: stale compiled routes failed multipart create/update (2 failed, 1 passed); rebuilt routes pass all 3 checks, including JSON bank-transfer compatibility.
- Docker API image rebuilt and restarted; running container is healthy, root responds 200, and live OpenAPI exposes type, name, and binary file for payment-method creation.
- A real S3/MinIO upload and learner read round trip was not run.
