# Backend Plan

Open backend work, split into a Chain track and a DB track. Each track updates
its own items after each step and removes them when they are done.

- **Chain track:** contracts, deploy and seed scripts, ABIs, `src/chain/`, `src/hashing/`, login, signup, and every route that prepares a transaction or verifies a mined one.
- **DB track:** `src/db/`, `src/repositories/`, migrations, DB seed, and DB-only routes (profiles, availability, job board, statistics).

## Chain track

No item in progress; the next one is picked from Later.

### Later

| Status      | Item                                                                                                                                                                                                                                                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Not started | **Rebuild from chain.** A script that rebuilds `batches` and `transporter_jobs` from contract events (record details cannot be rebuilt; they were never on chain). Mostly a replay of the event index (`BatchReserved` and `ReservationReleased` included, since jobs depend on them).                                                                      |
| Not started | **Real network.** Wait for N confirmations before saving, a testnet config, a deploy without Anvil keys, an event index that only takes blocks with enough confirmations (it has no reorg handling), close the backend's direct port (it trusts `X-Forwarded-For`), and a shared nonce store (it lives in memory: one server instance, cleared on restart). |
| Known limit | **Stuck batches.** The contract has no cancel or re-route, so a batch stays stuck if its destination loses its role or never accepts, or nobody claims it. Decide after the demo.                                                                                                                                                                           |
| Known limit | **Draft rows.** Every prepare call adds a `pending_saves` row, so a signed-in user can create many drafts; abandoned ones are marked `failed`, never deleted. Fine for the demo; before a real deployment, limit pending drafts per wallet (chain track) and delete old failed ones (`deleteFailedBefore(cutoff)` in `pendingSave.repository.js` deletes failed drafts resolved before a date; done by the DB track in `a56d3c2`).     |

## DB track

| Status      | Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Known limit | **Reservations never expire.** A job could stay off the board if its transporter stops using the system. Fixed on chain (the facility that listed the batch can release it); closes with Reservation on chain.                                                                                                                                                                                                                                                                                             |
