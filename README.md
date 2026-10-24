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
- Node.js 20 or newer and npm
- Foundry (`forge` and `cast`)

## Local development setup

Run every command from the repo root unless a step says otherwise.

### 1. Start the services

```sh
docker compose up --build
```

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

### 2. Deploy the contracts

In another terminal:

```sh
bash scripts/deploy.sh
```

The script prints the registry and custody addresses.

### 3. Create `backend/.env`

Copy the example, then fill in the printed addresses:

```sh
cp backend/.env.example backend/.env
```

```dotenv
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
# Use the REGISTRY_ADDRESS printed by deploy.sh
REGISTRY_ADDRESS=0x...
# Use the BATCH_CUSTODY_ADDRESS printed by deploy.sh
BATCH_CUSTODY_ADDRESS=0x...
DEPLOY_BLOCK=0
DATABASE_URL=postgres://olive_app:olive_pass@localhost:5432/olive_traceability
PORT=3000
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

This registers a sample farmer and creates batch `B1`. Running it twice on the same chain fails, because `B1` already exists.

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
- Clear old test rows from PostgreSQL. Their transaction hashes no longer exist on the fresh chain.

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

The backend config validates `RPC_URL`, `CHAIN_ID`, both contract addresses, and optionally `DEPLOY_BLOCK`. The current `src/app.js` server is a minimal scaffold and does not yet load that config or expose API routes.

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
- Variable event and profile details are stored in validated PostgreSQL JSONB fields; common identifiers and workflow relationships remain relational.
- `docker-compose.yml` starts the services but does not deploy contracts automatically.
- Anvil state is not persisted, so the chain resets whenever the container stops.
- No production network, deployment, or key-management configuration is included.
