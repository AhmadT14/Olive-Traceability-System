# Backend Plan

Open backend work, split into a Chain track and a DB track. Each track updates
its own items after each step and removes them when they are done.

- **Chain track:** contracts, deploy and seed scripts, ABIs, `src/chain/`, `src/hashing/`, login, signup, and every route that prepares a transaction or verifies a mined one.
- **DB track:** `src/db/` (including `src/db/repositories/`), migrations, DB seed, and DB-only routes (profiles, availability, job board, statistics).

## Chain track

No item in progress.

## DB track

| Status      | Item                                                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Known limit | **Reservations never expire.** A job could stay off the board if its transporter stops using the system. Fixed on chain (the facility that listed the batch can release it); closes with Reservation on chain. |
