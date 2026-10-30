# Olive Traceability

An early-stage olive batch traceability project. The Solidity contracts provide an on-chain participant registry and custody workflow for batches moving from farms through mills, storage, exporters, importers, and retailers. Batch events accept hashes for harvest, outgoing, and intake records so documents can be tied to an on-chain history without storing their contents in the contract.

> **Project status:** the backend API and contract workflows are implemented through the complete Farm → Mill → Storage → Exporter → Importer → Retailer chain. The frontend is still the Vite starter screen.

## Repository layout

- `API.md`: API reference for the project team, including backend routes and integration workflow.
- `contracts/`: Foundry contracts, deployment script, and Solidity tests.
- `backend/`: Node.js API scaffold, PostgreSQL/Drizzle schema, and contract ABI support.
- `backend/src/validation/`: centralized Zod schemas for request payloads and role-specific profile details.
- `frontend/`: React and Vite application scaffold.
- `scripts/`: local Anvil deployment and sample data scripts.
- `docker-compose.yml`: PostgreSQL, backend, and local Anvil services.

## Requirements

- Docker and Docker Compose
- Node.js 20 or newer and npm (only needed for running the backend or frontend outside Docker)

## Local development setup

Run every command from the repo root unless a step says otherwise.

### 1. Start the services

```sh
docker compose up --build
```

This starts PostgreSQL and Anvil, deploys the contracts, registers the demo
participants on chain, creates their database tables (migrations) and stores
their names, and then starts the backend. Run it with `--build` after pulling
changes to `backend/`. Foundry (`forge`, `cast`, and `anvil`) runs inside
Docker; it does not need to be installed on the host.

Startup order is `anvil` → `deploy` → `seed` (chain roles and batch `B1`) →
`migrate` (tables and demo participant rows) → `backend`. To re-run just the
database step, for example after wiping the `postgres-data` volume:

```sh
docker compose run --rm migrate
```

#### Demo participants

The seed registers one wallet per role, using Anvil's built-in dev accounts
(account 0 is the registry admin). They all have a name and profile in the
database, so every role can log in and appear in destination lists with no
manual setup.

| Role        | Anvil account | Address                                      | Name                    |
| ----------- | ------------- | -------------------------------------------- | ----------------------- |
| Admin       | 0             | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | (registry admin)        |
| FARMER      | 1             | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | Nablus Hills Farm       |
| MILL        | 2             | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | Al-Salam Olive Mill     |
| TRANSPORTER | 3             | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | Al-Amal Transport       |
| STORAGE     | 4             | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | Hebron Oil Storage      |
| EXPORTER    | 5             | `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` | Palestine Olive Exports |
| IMPORTER    | 6             | `0x976EA74026E726554dB657fA54763abd0C3a0aa9` | Levant Gourmet Imports  |
| RETAILER    | 7             | `0x14dC79964da2C08b23698B3D3cc7Ca32193d9955` | Green Table Market      |

The private keys are Anvil's public dev keys (mnemonic
`test test test test test test test test test test test junk`). Never use them
on a real network. Batch `B1` is created by the farmer for the mill and has no
stored record details, so `/batches/B1/verify` reports it as `incomplete`.

To start only the local blockchain:

```sh
docker compose up -d anvil
```

Exposed ports:

| Service        | Address                 |
| -------------- | ----------------------- |
| PostgreSQL     | `localhost:5432`        |
| Backend        | `localhost:3000`        |
| Anvil JSON-RPC | `http://127.0.0.1:8545` |

Check that Anvil is up:

```sh
curl -s -X POST http://127.0.0.1:8545 -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
```

Expected result: `0x7a69` (chain id 31337).

### 2. Configure the backend

Docker Compose writes the deployed contract addresses into its shared runtime
volume before starting the backend. No manual address copying is required.
Keep the other application settings in the root `.env` file (`.env.example` is
a template; copy it to `.env`). `JWT_SECRET` is required and must be at least 32
characters, otherwise the backend refuses to start:

```dotenv
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
# These addresses are generated automatically by Docker Compose during startup.
REGISTRY_ADDRESS=0x...
BATCH_CUSTODY_ADDRESS=0x...
DEPLOY_BLOCK=0
DATABASE_URL=postgres://olive_app:olive_pass@localhost:5432/olive_traceability
PORT=3000
JWT_SECRET=change-me-to-at-least-32-random-characters
```

Rules for this file:

- Write `KEY=value` with no spaces around `=`. The shell scripts read this file with `source`, and a space breaks them.
- No trailing backslashes and no quotes.
- Never commit `backend/.env`.

On a fresh Anvil chain the deploy addresses are normally identical every time, so you usually change nothing.

### 4. Generate the ABIs

Run this only in these cases:

- The first time you set up the project, if `backend/src/chain/abis/` is empty or missing.
- After you change a contract's functions or events.

You do **not** need it after an Anvil reset or a restart, because the ABIs describe the contract code, not the chain.

```sh
cd contracts && forge build && cd ../backend
npm run sync:abis
```

Run `npm install` in `backend/` only the first time, and again when `package.json` changes (for example after pulling new dependencies).

### 5. Seed sample data

```sh
bash scripts/seed.sh
```

This registers the seven demo participants (see the table above) and creates batch `B1`. Running it twice on the same chain fails, because `B1` already exists. It only touches the chain; store the participants' names in the database with `npm run db:seed` from `backend/` (after `npm run db:migrate`).

### 6. Verify the chain connection

```sh
cd backend
node scripts/smoke.js
node scripts/read-test.js
```

`read-test.js` should show `B1` as `Created` at stage `Farm`, the farmer role as `true`, and the MILL role as `false`.

These scripts use publicly known Anvil development keys and are strictly for a local chain. Never fund or use those keys on a public or production network.

## Daily workflow

| Situation                          | What to run                                                           |
| ---------------------------------- | --------------------------------------------------------------------- |
| Anvil still running                | Nothing. Just start the backend.                                      |
| Anvil container stopped or deleted | Do the reset routine below.                                           |
| You changed a contract             | `forge build`, then `npm run sync:abis` in `backend/`, then redeploy. |

### Reset routine

Anvil keeps its chain in memory. Stopping or deleting the container wipes every contract, role, batch, and transaction. After any restart, from the repo root:

```sh
docker compose up -d anvil
bash scripts/deploy.sh
bash scripts/seed.sh
```

Then:

- Compare the deploy addresses with `backend/.env` and update the file if they differ.
- Clear old test rows from PostgreSQL. Their transaction hashes no longer exist on the fresh chain. With Docker, `docker compose down -v` followed by `docker compose up --build` resets the chain and the database together.

### Looking at transactions

```sh
docker compose logs anvil | grep "Transaction:"
cast tx <txHash> --rpc-url http://127.0.0.1:8545
cast receipt <txHash> --rpc-url http://127.0.0.1:8545
```

## Run the applications directly

Backend:

```sh
cd backend
npm install
npm run dev
```

The backend config validates `RPC_URL`, `CHAIN_ID`, both contract addresses, `JWT_SECRET`, and optionally `DEPLOY_BLOCK` and `PORT`. The database tables come from the migrations, which are not run by `npm run dev`:

```sh
npm run db:migrate   # create or update the tables
npm run db:seed      # store the demo participants (needs the chain seeded first)
```

Frontend, in another terminal:

```sh
cd frontend
npm install
npm run dev
```

Vite prints the local URL, typically `http://localhost:5173`.

## Troubleshooting

| Symptom                                    | Likely cause and fix                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `Connection refused` on port 8545          | Anvil is not running. Run `docker compose up -d anvil`.                                                                               |
| `No such file or directory` for a script   | Wrong folder. Run `pwd`. Scripts in `scripts/` run from the repo root, and `npm` and `node scripts/...` commands run from `backend/`. |
| `command not found` when running `seed.sh` | A space or backslash in `backend/.env`. Check with `cat -A backend/.env`.                                                             |
| `Cannot find package 'dotenv'`             | Dependencies not installed. Run `npm install` in `backend/`.                                                                          |
| `relation "participants" does not exist`   | The migrations have not run. Run `docker compose run --rm migrate`, or `npm run db:migrate` in `backend/`.                            |
| `ENOENT ... abis/*.json`                   | ABIs not generated. Run `npm run sync:abis` in `backend/`.                                                                            |
| `Missing script: "sync:abis"`              | Add the script to `backend/package.json`.                                                                                             |
| `read-test.js` shows `B1` as `None`        | The chain is fresh. Run deploy and seed.                                                                                              |
| Backend cannot find contracts              | Addresses in `backend/.env` do not match the deploy output.                                                                           |

## Contracts

From `contracts/`:

```sh
forge test
```

`ParticipantRegistry` lets the admin grant and revoke participant roles. `BatchCustody` records batch creation, pickup listing and claims, and named handovers with receipt confirmation. The receiver role must match the next supply-chain stage. Contract events include the supplied record hashes; the underlying records must be stored elsewhere.

## Current limitations

- Frontend is uncustomized Vite starter content.
- The backend requires PostgreSQL, a deployed local chain, and wallet-signature authentication for end-to-end use.
- Variable event and role-specific profile details are stored in validated PostgreSQL JSONB fields; shared participant fields such as name, contact information, location, and availability remain relational.
- `docker-compose.yml` deploys and seeds contracts, runs the database migrations, and stores the demo participants automatically before starting the backend.
- Anvil state is not persisted, so the chain resets whenever the container stops.
- No production network, deployment, or key-management configuration is included.
