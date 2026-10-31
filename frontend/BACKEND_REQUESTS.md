# Requests from the frontend

What the frontend still needs from the backend, sorted by priority.
Last updated: 2026-10-31.

Priority:
- **High**: blocks a frontend phase. Nothing is blocked right now.
- **Medium**: needed for a planned feature; the frontend works around it until then.
- **Low**: a fix or a nice-to-have; nothing breaks without it.

Every item below has a mock or workaround in the frontend, so none of them
stops current work.

## Database and API

### Medium: add `quantity` and `olive_type` to `GET /me/batches/created`

- **Now:** each item has the chain state plus `harvestDate`, `createdBlock`
  and `createdAt`.
- **Ask:** also return `quantity` and `olive_type` from the saved farm record
  (`null` if missing), like `harvestDate`.
- **Why:** the farmer's "My batches" page will get sorting and filtering
  (by status, harvest date, olive type, quantity). Without these fields the
  frontend needs one `/history` call per batch.
- **Needed by:** Phase 9 or 10.

### Low: CORS

- **Now:** the backend sends no CORS headers. In development the Vite proxy
  forwards `/api` to `localhost:3000`, so it works.
- **Ask:** add the `cors` middleware, allowing the frontend origin from an
  env variable.
- **Why:** needed only if the frontend is served from a different origin
  than the API in a real deployment. Not needed if both sit behind one
  domain (reverse proxy).
- **Needed by:** deployment, not a phase.

### Low (optional): statistics endpoints

- **Now:** none.
- **Ask:** counts and volumes per role for the dashboards, for example
  batches handled per stage and total kilograms or litres per month. Exact
  shape to be agreed before Phase 9.
- **Why:** the role dashboards in the reference document show these. Until
  then the frontend computes simple counts from `/me/batches` and
  `/me/batches/created`.
- **Needed by:** Phase 9. Optional.

## Smart contract and chain

### Low: `args.batchId` in `GET /batches/:id/history` shows `"[object Object]"`

- **Now:** the `batchId` argument of each event comes back as the text
  `"[object Object]"`. It is an indexed string, so the log only holds its
  hash, and the reader turns that object into a string.
- **Ask:** return the topic hash as a `0x...` string (it cannot be decoded
  back to the readable ID), or leave the field out. The readable ID is
  already at the top level of the response.
- **Why:** wrong data in the response. The frontend does not read this
  field, so nothing breaks today.
- **Where:** the event reader in `backend/src/chain/`.
- **Needed by:** no phase. Fix when convenient.

## Done

Closed and already used by the frontend:

- `isAdmin` and `expiresAt` in login and `/auth/me`
- `GET /me/batches`, `GET /me/profile`, `PATCH /me/profile`,
  `PATCH /me/availability`
- `GET /transporter-jobs?mine=true`
- destination in `/batches/:id/chain`
- public profile `GET /participants/:address/profile`
- `GET /admin/participants`
- exporter and importer routes
- `GET /me/batches/created` (commit cf90a15)
