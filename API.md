# Backend API

The backend is an Express JSON API that coordinates the Olive Traceability System's smart contracts and PostgreSQL records. It reads current participant and batch state from the blockchain. Record details are stored off chain, while hashes of those details are included in on chain events so the API can check their integrity later.

## Base URL and conventions

The local API address is `http://localhost:3000`. Routes below are relative to that address; the server currently does not add an `/api` prefix. Requests with a body use JSON (`Content-Type: application/json`). Batch IDs are strings up to 64 characters. Ethereum addresses use the `0x` plus 40 hexadecimal character format; transaction hashes use `0x` plus 64 hexadecimal characters. Date fields in records (`harvest_date`, `pressing_date`, `storage_start_date`, `storage_end_date`) must be real calendar dates written `YYYY-MM-DD`, with no spaces or time; anything else is a `422`, on the prepare route and on the save route alike. The date is part of the hashed record, so the same text must be sent to both.

Protected routes require a JWT in the header:

```http
Authorization: Bearer <token>
```

The API returns JSON. Errors always use the same envelope: `{ "error": "<message>" }`, plus `details` (Zod's `flatten()` output) when a request field failed validation. Status codes are `400` for a malformed request (invalid JSON, unknown path, bad path/query parameter, or a missing body), `422` for a well-formed JSON body that fails its field schema, `401` for missing or invalid authentication, `403` for a role or caller permission failure, `404` for a missing chain record, `409` for a conflict with the current workflow state, `500` for a chain or database failure, `503` (`chain unavailable`) when login or `/auth/me` cannot read the chain, and `429` (`too many requests; try again in a minute`) when `/auth/nonce` or `/auth/login` is called more than 20 times a minute from one IP address (each route counts separately; the `RateLimit` and `RateLimit-Policy` headers show the remaining allowance). Every response carries an `X-Request-Id` header; a client may send its own (letters, digits, `-` and `_`, up to 64 characters), and the backend logs it with any server error, so quote it when reporting a problem. Responses are also validated against a schema before they are sent; a mismatch is a server bug and returns a generic `500`.

Paging: `GET /transporter-jobs` (every variant), `GET /me/batches/created`, `GET /me/batches/received`, `GET /me/pending`, `GET /admin/participants` and `GET /admin/registration-applications` accept optional `limit` (an integer from 1 to 100) and `offset` (an integer from 0, default 0) query parameters. Without `limit` the whole list is returned, as before. The response shape does not change; a page shorter than `limit` is the last one. Any other value is a `400` (`limit must be an integer from 1 to 100` or `offset must be a non-negative integer`).

CORS is off by default, which is all a same-origin setup needs (the Vite dev proxy, or the frontend and the API behind one domain). To serve the frontend from another origin, set `CORS_ORIGIN` to that origin, or to several separated by commas (for example `CORS_ORIGIN=https://olive.example,http://localhost:5173`). Only the listed origins get CORS headers; preflight requests are answered, and `X-Request-Id` is exposed to the browser.

Proxies: the sign-in rate limit counts requests per client IP. Behind a reverse proxy (such as the nginx of the Docker frontend) every request comes from the proxy's IP, so set `TRUST_PROXY` to the number of proxies in front of the API (`1` for one nginx) and have the proxy send `X-Forwarded-For`; the limit then counts the client address the nearest proxy reports. The default, `0`, ignores `X-Forwarded-For`, which is right when clients reach the API directly. The Docker setup sets `TRUST_PROXY=1`. Only trust a proxy that clients cannot bypass: a client that reaches the API directly can then send its own `X-Forwarded-For`.

## Authentication

Login uses a wallet signature. Request a one time nonce, sign the returned `message` exactly as received with the wallet, then exchange the signature for a JWT. The message follows the Sign-In with Ethereum format (EIP-4361):

```text
localhost:5173 wants you to sign in with your Ethereum account:
0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

Sign in to Olive Traceability.

URI: http://localhost:5173
Version: 1
Chain ID: 31337
Nonce: 52db72babcb5fb8895198386458a970b
Issued At: 2026-11-02T14:46:57.146Z
Expiration Time: 2026-11-02T14:51:57.146Z
```

The first line and `URI` come from the backend settings `AUTH_DOMAIN` (default `localhost:5173`) and `AUTH_URI` (default `http://localhost:5173`); set them to the frontend's address. `Chain ID` is the backend's `CHAIN_ID`. Login answers `401` with `nonce missing or expired`, `invalid signature` or `signature does not match address`, and `503` when the chain cannot be read. Nonces expire after five minutes and are consumed by the login attempt. They are kept in the backend's memory, so a restart invalidates logins in progress, and the store is capped (10,000 pending nonces, oldest dropped first) so unauthenticated requests cannot grow it without limit.

| Method and path | Auth | Purpose |
| --- | --- | --- |
| `POST /auth/nonce` | No | Body: `{ "address": "0x…" }`. Returns `{ address, nonce, message }`. |
| `POST /auth/login` | No | Body: `{ "address": "0x…", "signature": "0x…" }`. Verifies the signature, reads active on chain roles, and returns `{ address, roles, isAdmin, expiresAt, token }`. |
| `GET /auth/me` | Bearer | Returns `{ address, roles, isAdmin, expiresAt }`, with `roles` and `isAdmin` read live from the registry. |
| `POST /auth/refresh` | Bearer | No body. Reads the current roles from the registry and returns a new token in the same shape as `/auth/login`. Use it after the admin grants or revokes a role, so the user needs no new login. |

Tokens are HS256 JWTs with issuer `olive-traceability` and audience `olive-traceability-api`; tokens without them are rejected. Tokens expire after one hour; `/auth/refresh` before expiry gives a new one-hour token. A session never lasts more than 24 hours from the MetaMask sign-in: a refreshed token expires at that limit at the latest, and after it `/auth/refresh` answers `401` (`session too old; sign in again`). `expiresAt` is the token's expiry as an ISO 8601 timestamp, returned by `/auth/login`, `/auth/refresh` and `/auth/me`. `/auth/me` reads `roles` and `isAdmin` from the registry on every call, so it shows a new role or an admin handover at once. The token itself keeps the roles from when it was issued until it is refreshed; every route that acts on chain checks the roles on chain again anyway.

## Read routes

| Method and path | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | No | Liveness check: `{ "ok": true }`. |
| `GET /participants/:address/roles` | No | Reads the participant's active registry roles. |
| `GET /participants/:address/profile` | No | Public profile for the consumer page: `{ address, name, location, roles }`. Contact details (phone, email, postal address) are never included. `404` if the backend has no profile for the wallet. |
| `GET /batches/:id/chain` | No | Reads current batch state from the custody contract. |
| `GET /batches/:id/history` | No | Combines on chain events with matching off chain record details. An event without stored details has `details: null`. Also returns `participants`, a map from lower-case wallet address to `{ name, location }` for every wallet in the batch's events (farmer, custodians, transporters, targets), so the consumer page needs no request per facility. A wallet with no profile is absent from the map. Only the events of this batch are read from the chain. |
| `GET /batches/:id/verify` | No | Recomputes hashes for stored records and compares them to their on chain events. See [Integrity results](#integrity-results). |
| `GET /tx/:hash` | No | Decodes a mined transaction and its recognized contract events. |
| `GET /destinations?role=MILL` | Bearer | Lists registered participants that currently have the MILL role. Used when creating a batch. Other roles are not accepted by this route. |
| `GET /batches/:id/destinations` | Bearer | Lists participants with the next stage's role for a batch that is ready to be listed by its current custodian. |
| `GET /transporter-jobs` | Bearer | Transporter only. Lists the open jobs that can be claimed (`status: "available"`), newest first. Each job has `id`, `status`, `batchId`, `stage`, `source`, `destination`, `outgoingDetails`, `reservedAt` (when the job was reserved, or `null`) and `createdAt`. A reserved job is not on the open board. `outgoingDetails` is what the sender recorded for the listing, in camelCase, or `null` if there is no saved record. Farm listings give `quantity`, `oliveType` and `harvestDate`. Mill listings give `pressingDate`, `extractionMethod`, `outputQuantity`, `oilQuality`, `packagingDetails`, `qrCodeReference` and `notes`. Storage listings give `quantityReleased`, `storageEndDate`, `productCondition`, `packagingCondition`, `loadingDetails` and `notes`. Exporter and importer listings give `quantityShipped`, `shipmentDetails`, `productCondition`, `packagingCondition` and `notes`. |
| `GET /transporter-jobs?mine=true` | Bearer | Transporter only. Lists the caller's own jobs that are still in progress, same shape, with `status` `reserved` (reserved, not picked up yet; `reservedAt` is set), `claimed` (picked up) or `handover_pending` (handed over, waiting for the facility to confirm). A completed job drops off the list. Any value other than `true` or `false` is a `400`. |
| `GET /transporter-jobs?mine=true&status=completed` | Bearer | Transporter only. Lists the caller's completed jobs, same shape, with `status: "completed"`, newest first by `createdAt` (when the job was listed, not when it finished). `completed` is the only accepted `status`; any other value, or `status` without `mine=true`, is a `400`. |
| `GET /me/batches` | Bearer | Batches that concern the caller, read from live chain state: `{ holding, listedByMe, awaitingMyConfirmation }`, each a list of `{ batchId, status, stage, custodian, pendingTarget, destination, reservedBy }`. `holding` is every batch the caller is custodian of that is not listed (a transporter keeps a batch here until the facility confirms receipt). `listedByMe` is the caller's batches waiting for a transporter, whether `Listed` or `Reserved` (then `reservedBy` names the transporter). `awaitingMyConfirmation` is batches a transporter has handed over to the caller. Only batches saved through this API are included. |
| `GET /me/batches/created` | Bearer (farmer) | Every batch the caller created as a farmer, newest first, so a batch stays in the list after a transporter has taken it: `{ batches: [{ batchId, status, stage, custodian, pendingTarget, destination, reservedBy, harvestDate, quantity, olive_type, createdBlock, createdAt }] }`. `status`, `stage`, `custodian`, `pendingTarget`, `destination` and `reservedBy` are the batch's current chain state. `harvestDate` is `YYYY-MM-DD` from the saved farm record (`null` if it has none). `quantity` (a string or a number, as it was saved) and `olive_type` also come from that record and are `null` if missing. `createdBlock` is the block of the `BatchCreated` event, and `createdAt` is that block's time as an ISO timestamp. `403` for a non-farmer. A batch created on chain but never saved through `POST /batches` is not listed. |
| `GET /me/batches/received` | Bearer | Every batch whose receipt the caller confirmed and saved through this API (the facility's intake record), newest first: `{ batches: [{ batchId, txHash, receivedAt, quantityReceived }] }`. `txHash` is the receipt transaction and `receivedAt` is when its record was saved, as an ISO timestamp (normally seconds after the transaction was mined). `quantityReceived` comes from that record (a string or a number, as it was saved) and is `null` if missing. A wallet that never confirmed a receipt gets an empty list. A receipt confirmed on chain but never saved through the API is not listed. |
| `GET /me/profile` | Bearer | The caller's own profile: `{ address, roles, profile: { name, contactPhone, email, address, location, availability, details } }`. `profile.address` is the postal address. `404` if the wallet has no profile (ask the admin to register it). |
| `GET /admin/participants` | Bearer (admin) | The participant directory: `{ participants: [{ address, name, location, availability, roles }] }`. A participant whose roles were all revoked stays in the list with `roles: []`. `403` for a non-admin. |
| `GET /admin/stats/batches` | Bearer (admin) | The number of batches at each chain stage: `{ stages: [{ stage, count }] }`, one entry per stage in chain order (`Farm`, `Mill`, `Storage`, `Exporter`, `Importer`, `Retailer`), with `0` for an empty stage. Counts every batch saved through this API by its current chain stage. `403` for a non-admin. |
| `GET /registration-applications/me` | Bearer | The caller's latest signup application: `{ application: { id, address, role, status, profile, rejectionReason, reviewedBy, createdAt, reviewedAt } }`, or `{ application: null }` if the wallet never applied. `status` is `pending`, `approved` or `rejected`; `rejectionReason`, `reviewedBy` and `reviewedAt` are `null` until the admin reviews it. Any wallet can sign in for this, with or without roles. Submitting, approving and rejecting applications are described under Signup. |
| `GET /admin/registration-applications` | Bearer (admin) | Every signup application, newest first, in the same shape: `{ applications: [...] }`. Optional `status` (`pending`, `approved` or `rejected`) filters the list; any other value is a `400`. `403` for a non-admin. |
| `GET /me/pending` | Bearer | The caller's saved drafts (records stored before signing, so a save is not lost if the browser closes after the transaction is mined), newest first: `{ saves: [{ id, batchId, detailsType, status, txHash, failureReason, payload, createdAt, resolvedAt }] }`. `status` is `pending`, `confirmed` or `failed`; `txHash` is `null` until the draft is confirmed; `payload` is the record as it was sent. The batch prepare routes create the drafts (see Drafts under Wallet transaction workflow). |

`/batches/:id/chain` returns `batchId` with the contract state: `stage`, `status` (`Created`, `Listed`, `Reserved` or `PendingHandover`), `custodian`, `destination` (the active destination), `pendingTarget` and `reservedBy` (the transporter that reserved a listed batch). An address field that does not apply holds the zero address. `/history` returns `{ batchId, events, participants }`. `/tx/:hash` returns `{ hash, success, blockNumber, events }`. In both, each event's `args` maps argument names to strings. `args.batchId` is the batch id's keccak256 topic hash (`0x…`), because the contract indexes the id and the log keeps only its hash; the readable id is the top-level `batchId` in `/history`. Chain state is authoritative; database rows are only off-chain details and workflow indexes.

## Profile routes

These change the caller's own record and need a bearer token. They do not involve a transaction.

| Method and path | Body | Purpose |
| --- | --- | --- |
| `PATCH /me/profile` | Any of `name`, `contactPhone`, `email`, `address`, `location`, `details` (at least one) | Updates the sent fields and leaves the rest. `details` is merged into the stored details key by key, then validated against the keys of every role the participant holds (see [Profile details keys](#profile-details-keys)); keys that belong to none of them are dropped. Returns the same shape as `GET /me/profile`. `422` for an invalid field. `availability` is not accepted here. |
| `PATCH /me/availability` | `{ "availability": "available" \| "unavailable" }` | Sets availability. Returns `{ address, availability }`. `422` for any other value. See below for what it affects. |

### Profile details keys

`details` holds the role-specific profile fields. Keys are camelCase, and that is final. Every key is optional. Text fields are strings; a capacity may be a string or a number.

| Role | Keys |
| --- | --- |
| FARMER | `farmName` (up to 255), `certificationDetails` |
| TRANSPORTER | `companyName` (up to 255), `vehicleDetails`, `licenseDetails` |
| MILL | `facilityName` (up to 255), `processingCapacity`, `certificationDetails` |
| STORAGE | `facilityName` (up to 255), `storageCapacity`, `storageConditions`, `certificationDetails` |
| EXPORTER | `companyName` (up to 255), `exportLicenseDetails`, `destinationMarkets` |
| IMPORTER | `businessName` (up to 255), `importLicenseDetails`, `distributionDetails` |
| RETAILER | `businessName` (up to 255), `retailLicenseDetails`, `businessType` (up to 128) |

With `PATCH /me/profile`, a wallet with several roles may use the keys of all of them. When the admin registers a participant, `profile.details` is checked against the role being registered, then merged into the stored `details` key by key, so registering a second role keeps the keys of the first.

The name keys (`farmName`, `facilityName`, `companyName`, `businessName`) are optional and no route uses them: only `GET /me/profile` returns `details`. `profile.name` is the participant's business or facility name, and it is what every other route shows. A client may leave the name keys out. They stay accepted, so existing profiles keep working.

### Job reservation

A transporter reserves an open job before driving to the facility, and signs the claim (`claimBatch`) at pickup. A job moves `available` → `reserved` → `claimed` → `handover_pending` → `completed`, and a reserved job can be released back to `available`. Reserving and releasing are chain transactions (`reserveBatch`, `releaseBatch`) with no record to save, so the flow is prepare, sign, then post the transaction hash. Only the transporter who reserved a batch can claim it, and the reserver or the facility that listed it can release it. A reservation does not expire; the facility releases it if the transporter never comes. The job id is a positive integer; anything else is a `400` (`invalid job id`).

| Method and path | Body | Purpose |
| --- | --- | --- |
| `POST /transporter-jobs/:id/prepare-reserve` | None | Prepares `reserveBatch` for the job's batch. Returns `{ id, batchId, transaction }`. `403` if the caller does not hold the TRANSPORTER role, `404` for an unknown job, and `409` if the caller is marked unavailable (`transporter is marked unavailable`), the job is not available (`job is not available`, also when another transporter reserved it first), the batch is not listed for pickup on chain (`batch not listed for pickup`), or the batch is no longer listed by the facility that posted this job (`batch is no longer listed by this job's source`). |
| `POST /transporter-jobs/:id/reserve` | `{ txHash }` | After the wallet sends the transaction: checks the mined `BatchReserved` event for the job's batch with the caller as `transporter`, and that the chain still shows the caller's reservation, then marks the job `reserved` for the caller with `reservedAt` (the time of this save). Returns the job in the `GET /transporter-jobs` shape. `403` without the TRANSPORTER role, `422` for a bad body, `404` if the transaction is missing, failed or has no such event (`tx not found or has no BatchReserved event for this batch`), and `409` if the job is not available, the event was sent by another wallet (`reserve event was not submitted by caller`), the chain no longer shows the caller's reservation (`batch is not reserved by caller on chain`), or the transaction was already saved (`reservation already recorded off-chain`). |
| `POST /transporter-jobs/:id/prepare-release` | None | Prepares `releaseBatch`. For the transporter who reserved the job or the facility that listed the batch, whatever their roles. Returns `{ id, batchId, transaction }`. `404` for an unknown job, `409` if the job is not reserved (`job is not reserved`) or the batch is not reserved on chain (`batch not reserved`), and `403` for any other caller (`caller cannot release this reservation`). |
| `DELETE /transporter-jobs/:id/reserve` | `{ txHash }` | Checks the mined `ReservationReleased` event for the job's batch with the caller as `releasedBy`, then puts the job back to `available` with `reservedAt: null`. Returns the job. `422` for a bad body, `404` if the transaction has no such event, `403` if another wallet sent it (`release event was not submitted by caller`), and `409` if the job is not reserved or the event's transporter is not the one the job is reserved for (`job is not reserved by that transporter`). |

`POST /batches/prepare-claim` then requires the caller's reservation: `409` with `batch not reserved for pickup` when nobody has reserved the batch, `batch reserved by another transporter` otherwise, and `no open transporter job for this batch` when the database has no open job for it. The claim save moves the reserved job to `claimed`. If the reserve save never arrived (the job is still `available` in the database while the chain shows the reservation), the claim still works and takes the job. A facility's listing save (`mill-outgoing`, `storage-outgoing`, `exporter-outgoing`, `importer-outgoing`) also goes through while the batch is reserved.

### What availability does

A participant counts as available unless they set `unavailable`; a profile that never set a value is available.

- `GET /destinations` and `GET /batches/:id/destinations` leave out unavailable participants.
- `POST /batches/prepare`, `/batches/prepare-listing`, `/batches/prepare-storage-listing`, `/batches/prepare-exporter-listing` and `/batches/prepare-importer-listing` return `409` (`destination is marked unavailable`) if the chosen destination is unavailable.
- `POST /transporter-jobs/:id/prepare-reserve` and `POST /batches/prepare-claim` return `409` (`transporter is marked unavailable`) for an unavailable transporter. They can still see the job board and release a reservation.
- `POST /batches/prepare-listing` returns `409` (`no mill intake recorded off-chain for this batch yet`) until the mill's intake record is saved, like the storage, exporter and importer listings.
- Delivering a batch that is already in transit is never blocked: `prepare-handover` and the facility's receipt work whatever the availability, because the delivery has already happened.

## Signup

A wallet with no role can ask to join. Any signed-in wallet submits one application for one role; the admin then grants the role on chain (prepare, sign, confirm, like the admin role change) or rejects the application. Approval saves the participant profile from the application. Every route returns `{ application }` in the `GET /registration-applications/me` shape, except `prepare-approval`, which returns the prepared transaction in the `POST /admin/participants/prepare-role-change` shape.

| Method and path | Auth | Body | Purpose |
| --- | --- | --- | --- |
| `POST /registration-applications` | Bearer | `{ role, profile }` | Submits an application (`201`). `role` is one of `FARMER`, `TRANSPORTER`, `MILL`, `STORAGE`, `EXPORTER`, `IMPORTER`, `RETAILER`; `profile` is the registration profile of `confirm-role-change` (`name` required; `contactPhone`, `email`, `address`, `location`, `availability` and role `details` optional; `details` are checked against the role, `422` if invalid). `409` if the wallet already holds the role (`wallet already has this role`) or already has a pending application (`an application is already pending for this wallet`). After a rejection the wallet may apply again. |
| `POST /admin/registration-applications/:id/prepare-approval` | Bearer (admin) | None | Prepares the registry transaction that grants the applicant the role. `403` for a non-admin, `404` for an unknown application, `409` if it is not pending (`application is already approved` or `application is already rejected`) or the wallet already holds the role. |
| `POST /admin/registration-applications/:id/approve` | Bearer (admin) | `{ txHash }` | After the admin's wallet sends the transaction: checks the mined `RoleGranted` event like `confirm-role-change`, saves the profile from the application and marks it `approved` with `reviewedBy`. Same errors as `prepare-approval`, plus those of `confirm-role-change`. Calling it again after a failure is safe. |
| `POST /admin/registration-applications/:id/reject` | Bearer (admin) | `{ reason }` (1 to 1000 characters) | Marks the application `rejected` with `rejectionReason` and `reviewedBy`. No transaction. `403`, `404` and `409` as above. |

The application id is a positive integer; anything else is a `400` (`invalid application id`).

## Wallet transaction workflow

The API does not hold participant wallet keys and does not submit these workflow transactions on the user's behalf. A client first requests a prepared transaction, asks the connected wallet to sign and send it, then posts the resulting transaction hash to the matching record endpoint. Preparation responses include a `transaction` object with `to`, encoded `data`, `value: "0x0"`, `from` (the caller's wallet), `chainId` (a number) and `gas` (a hex gas estimate); clients can pass these fields to their wallet (ethers calls the gas field `gasLimit`). Before answering, every prepare route runs the transaction against the chain as the caller. If it would revert, the route returns `409` with `transaction would fail: <contract reason>` (for example `transaction would fail: BatchCustody: caller is not a farmer`), so the wallet never asks the user to sign a transaction that cannot succeed. The API validates caller permissions and workflow state during preparation and verifies the mined event and record hash when saving details.

### Prepare contract calls

All routes in this table require a bearer token and a JSON body. Successful responses include the encoded transaction under `transaction` and usually the computed `dataHash`.

| Method and path | Body fields | Contract action |
| --- | --- | --- |
| `POST /batches/prepare` | `batchId`, `destinationAddress`, farm record fields | Creates a batch (`createBatch`). |
| `POST /batches/prepare-listing` | `batchId`, `destinationAddress`, mill oil record fields | Mill lists the batch for pickup (`postForPickup`). |
| `POST /batches/prepare-storage-listing` | `batchId`, `destinationAddress`, storage outgoing record fields | Storage lists a batch for pickup (`postForPickup`). |
| `POST /batches/prepare-exporter-listing` | `batchId`, `destinationAddress`, exporter outgoing record fields | Exporter lists the batch for pickup (`postForPickup`). |
| `POST /batches/prepare-importer-listing` | `batchId`, `destinationAddress`, importer outgoing record fields | Importer lists the batch for pickup (`postForPickup`). |
| `POST /transporter-jobs/:id/prepare-reserve` | None | Transporter reserves the job's batch (`reserveBatch`). See [Job reservation](#job-reservation). |
| `POST /transporter-jobs/:id/prepare-release` | None | The reserver or the listing facility releases the reservation (`releaseBatch`). |
| `POST /batches/prepare-claim` | `batchId` and pickup record fields (no `txHash`; that only exists after the wallet sends the transaction) | Transporter claims the job they reserved (`claimBatch`). |
| `POST /batches/prepare-handover` | `batchId`, `targetAddress`, delivery record fields (no `txHash`) | Transporter starts the handover (`initiateHandover`). Target must match the job destination. |
| `POST /batches/prepare-receipt` | `batchId` and receipt record fields for the current stage | Destination confirms receipt (`confirmReceipt`). |
| `POST /admin/participants/prepare-role-change` | `address`, `role`, `action` (`register` or `revoke`) | Registry admin prepares a participant role grant or revoke. |

Drafts: before answering, every batch prepare route above (not the role change, and not the reservation routes, which have no record) saves the record as a draft for the caller, with its `dataHash` (`GET /me/pending` lists them as `pending`). The draft is saved only after the transaction passes the simulation; if it cannot be saved, the route returns `500` (`draft save failed`) and no transaction. When the matching save route succeeds, the caller's draft with the same batch and `dataHash` becomes `confirmed`, with the transaction hash. Saving works the same without a draft.

If the save call never arrives (for example the browser closed after the transaction was mined), the backend saves the details itself: every `RECONCILE_INTERVAL_MS` (default 30000; `0` turns it off) it looks for each pending draft's mined event (same batch, `dataHash` and wallet), runs the same checks on the mined transaction as the save route, saves the details and marks the draft `confirmed`. It does not check the current chain state, because the batch may have moved on since. A draft with no matching event, or whose save keeps failing, becomes `failed` with a `failureReason` after `PENDING_SAVE_MAX_AGE_HOURS` (default 24). A later save call for a record that is already saved returns `409`.

Record fields are optional except where stated. Quantity fields (`quantity`, `quantity_received`, `quantity_shipped`, `quantity_released`, `quantity_picked_up`, `quantity_delivered`, `output_quantity`) accept a number or a numeric string and are rounded to two decimal places before hashing, so `12.5`, `"12.5"` and `"12.50"` produce the same hash. The field names are snake_case because they are part of the canonical hash input.

- Farm: `harvest_date`, `location` and `olive_type` (all three required and non-empty), `quantity`, `cultivation_method`, `irrigation_method`, `fertilizer_details`, `pesticide_details`, `harvesting_method`, `quality_details`, `farm_notes`.
- Mill outgoing: `pressing_date`, `extraction_method`, `output_quantity`, `oil_quality`, `packaging_details`, `qr_code_reference`, `notes`.
- Storage outgoing: `quantity_released`, `storage_end_date`, `product_condition`, `packaging_condition`, `loading_details`, `notes`.
- Transport pickup: `truck_details`, `quantity_picked_up`, `loading_details`, `transport_conditions`, `notes`, and `pickup_condition` plus `olive_condition` for olives, or `oil_condition` plus `packaging_condition` for oil.
- Transport delivery: `quantity_delivered`, `unloading_details`, `transport_conditions`, `notes`, plus `olive_condition` for olives, or `oil_condition` and `packaging_condition` for oil.
- Mill receipt (olive intake): `arrival_condition`, `quantity_received`, `olive_quality`, `storage_condition`, `notes`.
- Storage receipt: `quantity_received`, `storage_start_date`, integer `expected_duration` (in days), `conditions`, `product_condition`, `notes`.
- Exporter receipt: `quantity_received`, `shipment_arrival_details`, `received_product_details`, `product_condition`, `notes`.
- Exporter outgoing: `quantity_shipped`, `shipment_details`, `product_condition`, `packaging_condition`, `notes`.
- Importer receipt: `quantity_received`, `shipment_arrival_details`, `received_product_details`, `product_condition`, `notes`.
- Importer outgoing: `quantity_shipped`, `shipment_details`, `product_condition`, `packaging_condition`, `notes`.
- Retailer receipt: `quantity_received`, `final_receipt_details`, `product_condition`, `notes`.

The admin role preparation body is `{ "address": "0x…", "role": "FARMER|MILL|TRANSPORTER|STORAGE|EXPORTER|IMPORTER|RETAILER", "action": "register|revoke" }`. Exact supported role names are defined by the contract registry.

### Save records after submitting transactions

These routes require a bearer token. The `txHash` must refer to a successful on chain transaction containing the expected event and the hash of the submitted record.

| Method and path | Purpose |
| --- | --- |
| `POST /batches` | Save farm details after batch creation. Body contains `txHash`, `batchId`, and the farm record fields above. |
| `POST /transporter-jobs/:id/reserve` | Mark the job reserved after `reserveBatch`. Body: `txHash` only. Returns `200` with the job, not `201`. See [Job reservation](#job-reservation). |
| `DELETE /transporter-jobs/:id/reserve` | Put the job back to available after `releaseBatch`. Body: `txHash` only. Returns `200` with the job. |
| `POST /batches/:id/transporter-claim` | Save pickup details after a transporter claim. Body: `txHash` and the applicable olive or oil pickup fields. |
| `POST /batches/:id/transporter-handover` | Save delivery details after handover initiation. Body: `txHash` and the applicable olive or oil delivery fields. |
| `POST /batches/:id/receipt` | Save storage, exporter, importer, or retailer receipt details. Body: `txHash` and the receipt fields for the batch's current stage. |
| `POST /batches/:id/mill-intake` | Save mill's olive intake details. Body: `txHash` and mill receipt fields. |
| `POST /batches/:id/mill-outgoing` | Save mill's oil production details after listing. Body: `txHash` and mill outgoing fields. |
| `POST /batches/:id/storage-outgoing` | Save storage outgoing details after listing. Body: `txHash` and storage outgoing fields. |
| `POST /batches/:id/exporter-outgoing` | Save exporter outgoing details after listing. Body: `txHash` and exporter outgoing fields. |
| `POST /batches/:id/importer-outgoing` | Save importer outgoing details after listing. Body: `txHash` and importer outgoing fields. |
| `POST /admin/participants/confirm-role-change` | Confirm a submitted role transaction. Body for registration includes `address`, `role`, `action: "register"`, `txHash`, and `profile`; revocation omits `profile`. Registration profile requires `name`, with optional shared fields `contactPhone`, `email`, `address`, `location`, `availability`, and role-specific validated `details`, merged into any stored `details` key by key (a key sent again replaces the stored value; other stored keys are kept). |

Record saving can return `409` if the chain event, caller, current batch state, destination, record hash, or corresponding off chain workflow state does not match, or if the record was already saved. Record details are not saved until validation succeeds.

Transaction hashes are accepted in any letter case and are stored and returned in lower case.

## Integrity results

`GET /batches/:id/verify` returns an overall `integrityStatus` and an `integrity` object for each stored event. Per-event statuses include:

- `verified`: stored details hash matches the expected on chain event hash.
- `hash_mismatch`: details were found but their computed hash differs.
- `metadata_mismatch`: stored event metadata names an unexpected contract event.
- `event_not_found_on_chain`: transaction or expected event could not be found.
- `unverifiable`: no hash definition exists for that event type, or its payload version is unsupported.

The overall status is `verified` only when every stored event verifies; it is `mismatch` when a hash or metadata mismatch exists, and otherwise `incomplete` (including when there are no stored details).

## Example

Get a nonce and log in (sign the `message` using the wallet):

```sh
curl -X POST http://localhost:3000/auth/nonce \
  -H 'Content-Type: application/json' \
  -d '{"address":"0xYourWalletAddress"}'
```

Then call a protected endpoint with the resulting token:

```sh
curl http://localhost:3000/batches/B1/destinations \
  -H 'Authorization: Bearer <token>'
```

## Implementation notes

- Route paths are registered in `src/app.js` and defined in `src/api/routes/`; request validation lives in `src/validation/`.
- Contract reads and transaction event decoding use the configured RPC connection and generated ABIs.
- Contract events are copied into an event index in PostgreSQL (`chain_events`), from `DEPLOY_BLOCK` on, every `EVENT_SYNC_INTERVAL_MS` (default 5000; `0` turns the timer off). `GET /batches/:id/history`, `GET /me/batches/created` and the draft reconciler read events from it; each of these reads first brings the index up to the latest block, so a just-mined transaction is included. If the chain is reset but the database is kept, the sync stops with an error until `chain_events` and `chain_sync_state` are cleared (or the whole stack is reset with `docker compose down -v`).
- Off chain details are inserted into PostgreSQL only after the API validates the matching on chain transaction and hash.
- The batch list and the transporter jobs can be rebuilt from the contract events with `npm run db:rebuild` in `backend/` (record details cannot; see the README). Job ids change after a rebuild, so a client should not keep them beyond the current page.
- The API currently has no pagination or versioned `/api` prefix.
