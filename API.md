# Backend API

The backend is an Express JSON API that coordinates the Olive Traceability System's smart contracts and PostgreSQL records. It reads current participant and batch state from the blockchain. Record details are stored off chain, while hashes of those details are included in on chain events so the API can check their integrity later.

## Base URL and conventions

The local API address is `http://localhost:3000`. Routes below are relative to that address; the server currently does not add an `/api` prefix. Requests with a body use JSON (`Content-Type: application/json`). Batch IDs are strings up to 64 characters. Ethereum addresses use the `0x` plus 40 hexadecimal character format; transaction hashes use `0x` plus 64 hexadecimal characters.

Protected routes require a JWT in the header:

```http
Authorization: Bearer <token>
```

The API returns JSON. Errors always use the same envelope: `{ "error": "<message>" }`, plus `details` (Zod's `flatten()` output) when a request field failed validation. Status codes are `400` for a malformed request (invalid JSON, unknown path, bad path/query parameter, or a missing body), `422` for a well-formed JSON body that fails its field schema, `401` for missing or invalid authentication, `403` for a role or caller permission failure, `404` for a missing chain record, `409` for a conflict with the current workflow state, and `500` for a chain or database failure. Responses are also validated against a schema before they are sent; a mismatch is a server bug and returns a generic `500`.

## Authentication

Login uses a wallet signature. Request a one time nonce, sign the returned `message` with the wallet, then exchange the signature for a JWT. Nonces expire and are consumed by the login attempt.

| Method and path | Auth | Purpose |
| --- | --- | --- |
| `POST /auth/nonce` | No | Body: `{ "address": "0x…" }`. Returns `{ address, nonce, message }`. |
| `POST /auth/login` | No | Body: `{ "address": "0x…", "signature": "0x…" }`. Verifies the signature, reads active on chain roles, and returns `{ address, roles, isAdmin, expiresAt, token }`. |
| `GET /auth/me` | Bearer | Returns `{ address, roles, isAdmin, expiresAt }`. |

Tokens expire after one hour. `expiresAt` is the token's expiry as an ISO 8601 timestamp, returned by both `/auth/login` and `/auth/me`. `roles` are read from the registry at login time and stay as they were when the token was issued. `isAdmin` is true when the wallet holds the registry admin role; `/auth/me` reads it from the registry on every call, so it follows an admin handover without a new login.

## Read routes

| Method and path | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | No | Liveness check: `{ "ok": true }`. |
| `GET /participants/:address/roles` | No | Reads the participant's active registry roles. |
| `GET /participants/:address/profile` | No | Public profile for the consumer page: `{ address, name, location, roles }`. Contact details (phone, email, postal address) are never included. `404` if the backend has no profile for the wallet. |
| `GET /batches/:id/chain` | No | Reads current batch state from the custody contract. |
| `GET /batches/:id/history` | No | Combines on chain events with matching off chain record details. An event without stored details has `details: null`. |
| `GET /batches/:id/verify` | No | Recomputes hashes for stored records and compares them to their on chain events. See [Integrity results](#integrity-results). |
| `GET /tx/:hash` | No | Decodes a mined transaction and its recognized contract events. |
| `GET /destinations?role=MILL` | Bearer | Lists registered participants that currently have the MILL role. Used when creating a batch. Other roles are not accepted by this route. |
| `GET /batches/:id/destinations` | Bearer | Lists participants with the next stage's role for a batch that is ready to be listed by its current custodian. |
| `GET /transporter-jobs` | Bearer | Transporter only. Lists the open jobs that can be claimed (`status: "available"`). Each job has `id`, `status`, `batchId`, `stage`, `source`, `destination`, `outgoingDetails` and `createdAt`. |
| `GET /transporter-jobs?mine=true` | Bearer | Transporter only. Lists the caller's own jobs that are still in progress, same shape, with `status` `claimed` (picked up) or `handover_pending` (handed over, waiting for the facility to confirm). A completed job drops off the list. Any value other than `true` or `false` is a `400`. |
| `GET /me/batches` | Bearer | Batches that concern the caller, read from live chain state: `{ holding, listedByMe, awaitingMyConfirmation }`, each a list of `{ batchId, status, stage, custodian, pendingTarget, destination }`. `holding` is every batch the caller is custodian of that is not listed (a transporter keeps a batch here until the facility confirms receipt). `listedByMe` is the caller's batches waiting for a transporter. `awaitingMyConfirmation` is batches a transporter has handed over to the caller. Only batches saved through this API are included. |
| `GET /me/profile` | Bearer | The caller's own profile: `{ address, roles, profile: { name, contactPhone, email, address, location, availability, details } }`. `profile.address` is the postal address. `404` if the wallet has no profile (ask the admin to register it). |
| `GET /admin/participants` | Bearer (admin) | The participant directory: `{ participants: [{ address, name, location, availability, roles }] }`. A participant whose roles were all revoked stays in the list with `roles: []`. `403` for a non-admin. |

`/batches/:id/chain` returns `batchId` with the contract state, including stage, status, custodian, active destination, and pending target as applicable. `/history` returns `{ batchId, events }`. `/tx/:hash` returns `{ hash, success, blockNumber, events }`. Chain state is authoritative; database rows are only off-chain details and workflow indexes.

## Profile routes

These change the caller's own record and need a bearer token. They do not involve a transaction.

| Method and path | Body | Purpose |
| --- | --- | --- |
| `PATCH /me/profile` | Any of `name`, `contactPhone`, `email`, `address`, `location`, `details` (at least one) | Updates the sent fields and leaves the rest. `details` is merged into the stored details key by key, then validated for the participant's role (the first role, for a wallet that holds several). Returns the same shape as `GET /me/profile`. `422` for an invalid field. `availability` is not accepted here. |
| `PATCH /me/availability` | `{ "availability": "available" \| "unavailable" }` | Sets availability. Returns `{ address, availability }`. `422` for any other value. See below for what it affects. |

### What availability does

A participant counts as available unless they set `unavailable`; a profile that never set a value is available.

- `GET /destinations` and `GET /batches/:id/destinations` leave out unavailable participants.
- `POST /batches/prepare`, `/batches/prepare-listing`, `/batches/prepare-storage-listing`, `/batches/prepare-exporter-listing` and `/batches/prepare-importer-listing` return `409` (`destination is marked unavailable`) if the chosen destination is unavailable.
- `POST /batches/prepare-claim` returns `409` (`transporter is marked unavailable`) for an unavailable transporter. They can still see the job board.
- Delivering a batch that is already in transit is never blocked: `prepare-handover` and the facility's receipt work whatever the availability, because the delivery has already happened.

## Wallet transaction workflow

The API does not hold participant wallet keys and does not submit these workflow transactions on the user's behalf. A client first requests a prepared transaction, asks the connected wallet to sign and send it, then posts the resulting transaction hash to the matching record endpoint. Preparation responses include a `transaction` object with `to`, encoded `data`, and `value: "0x0"`; clients can pass these transaction fields to their wallet. The API validates caller permissions and workflow state during preparation and verifies the mined event and record hash when saving details.

### Prepare contract calls

All routes in this table require a bearer token and a JSON body. Successful responses include the encoded transaction under `transaction` and usually the computed `dataHash`.

| Method and path | Body fields | Contract action |
| --- | --- | --- |
| `POST /batches/prepare` | `batchId`, `destinationAddress`, farm record fields | Creates a batch (`createBatch`). |
| `POST /batches/prepare-listing` | `batchId`, `destinationAddress`, mill oil record fields | Mill lists the batch for pickup (`postForPickup`). |
| `POST /batches/prepare-storage-listing` | `batchId`, `destinationAddress`, storage outgoing record fields | Storage lists a batch for pickup (`postForPickup`). |
| `POST /batches/prepare-exporter-listing` | `batchId`, `destinationAddress`, exporter outgoing record fields | Exporter lists the batch for pickup (`postForPickup`). |
| `POST /batches/prepare-importer-listing` | `batchId`, `destinationAddress`, importer outgoing record fields | Importer lists the batch for pickup (`postForPickup`). |
| `POST /batches/prepare-claim` | `batchId` and pickup record fields (no `txHash`; that only exists after the wallet sends the transaction) | Transporter claims an available job (`claimBatch`). |
| `POST /batches/prepare-handover` | `batchId`, `targetAddress`, delivery record fields (no `txHash`) | Transporter starts the handover (`initiateHandover`). Target must match the job destination. |
| `POST /batches/prepare-receipt` | `batchId` and receipt record fields for the current stage | Destination confirms receipt (`confirmReceipt`). |
| `POST /admin/participants/prepare-role-change` | `address`, `role`, `action` (`register` or `revoke`) | Registry admin prepares a participant role grant or revoke. |

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
| `POST /batches/:id/transporter-claim` | Save pickup details after a transporter claim. Body: `txHash` and the applicable olive or oil pickup fields. |
| `POST /batches/:id/transporter-handover` | Save delivery details after handover initiation. Body: `txHash` and the applicable olive or oil delivery fields. |
| `POST /batches/:id/receipt` | Save storage, exporter, importer, or retailer receipt details. Body: `txHash` and the receipt fields for the batch's current stage. |
| `POST /batches/:id/mill-intake` | Save mill's olive intake details. Body: `txHash` and mill receipt fields. |
| `POST /batches/:id/mill-outgoing` | Save mill's oil production details after listing. Body: `txHash` and mill outgoing fields. |
| `POST /batches/:id/storage-outgoing` | Save storage outgoing details after listing. Body: `txHash` and storage outgoing fields. |
| `POST /batches/:id/exporter-outgoing` | Save exporter outgoing details after listing. Body: `txHash` and exporter outgoing fields. |
| `POST /batches/:id/importer-outgoing` | Save importer outgoing details after listing. Body: `txHash` and importer outgoing fields. |
| `POST /admin/participants/confirm-role-change` | Confirm a submitted role transaction. Body for registration includes `address`, `role`, `action: "register"`, `txHash`, and `profile`; revocation omits `profile`. Registration profile requires `name`, with optional shared fields `contactPhone`, `email`, `address`, `location`, `availability`, and role-specific validated `details`. |

Record saving can return `409` if the chain event, caller, current batch state, destination, record hash, or corresponding off chain workflow state does not match. Record details are not saved until validation succeeds.

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
- Off chain details are inserted into PostgreSQL only after the API validates the matching on chain transaction and hash.
- The API currently has no pagination or versioned `/api` prefix.
