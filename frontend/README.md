# Olive Traceability frontend

React app for the Palestinian olive oil traceability system: a public batch trace page and wallet-based dashboards for each supply chain role.

Stack: React 19, Vite, react-router-dom 7, ethers 6, plain JavaScript and plain CSS.

## Run it

1. Start the backend stack from the repo root (Postgres, Anvil, API on port 3000). Skip this in mock mode.
2. Copy `.env.example` to `.env` and fill in the values.
3. `npm install`, then `npm run dev`, and open http://localhost:5173.

The dev server proxies `/api` to `http://localhost:3000` and strips the prefix, because the backend has no CORS.

## Environment

| Variable | Meaning |
| --- | --- |
| `VITE_API_URL` | API base path, `/api` in development |
| `VITE_CHAIN_ID` | Chain the wallet must use, `31337` for local Anvil |
| `VITE_ADMIN_ADDRESS` | Wallet treated as admin until the backend returns an admin flag (Anvil account 0 locally) |
| `VITE_USE_MOCKS` | `true` returns fixtures from `src/mocks` instead of calling the API |

## Testing by hand

What is built so far: the public landing and trace page (Phase 3), wallet login with role areas (Phase 1), and the shared transaction flow with batch pages (Phase 2). Role screens beyond that are placeholders.

### Mock mode or real backend

Set `VITE_USE_MOCKS` in `.env`, then stop and restart `npm run dev`. Vite reads `.env` only at startup.

- `true`: no backend or Docker needed. MetaMask is still used to sign in (it signs a message, no transaction), but transactions are faked and nothing is sent to the chain.
- `false`: calls the real API through the proxy. See [Real backend](#real-backend) for what works there today.

In mock mode the fake chain is kept per browser tab, so it survives a reload. Close the tab and open a new one to start again with only the demo batches.

### Wallets

These are the default Anvil test accounts. Their keys are public and the same on every Anvil install, so **never send real funds to them or use them on a real network**.

To add one in MetaMask: account menu, then **Add account or hardware wallet**, then **Import account**, and paste the private key. Add the local network first if MetaMask does not have it: RPC URL `http://127.0.0.1:8545`, chain ID `31337`, currency `ETH` (signing in from the app also offers to add it).

| Account | Mock role | Mock name |
| --- | --- | --- |
| 0 | Admin | Ministry of Agriculture |
| 1 | Farmer | Al Zaytoun Farm |
| 2 | Mill | Nablus Olive Mill |
| 3 | Transporter | Green Road Transport |
| 4 | Storage | Hebron Oil Storage |
| 5 | Exporter | Holy Land Exports |
| 6 | Importer | Amman Olive Imports |
| 7 | Retailer | Bethlehem Market |

Address and private key of each account:

```text
0  Admin
   Address:     0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   Private key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

1  Farmer
   Address:     0x70997970C51812dc3A010C7d01b50e0d17dc79C8
   Private key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

2  Mill
   Address:     0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
   Private key: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a

3  Transporter
   Address:     0x90F79bf6EB2c4f870365E785982E1f101E93b906
   Private key: 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6

4  Storage
   Address:     0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
   Private key: 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a

5  Exporter
   Address:     0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc
   Private key: 0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba

6  Importer
   Address:     0x976EA74026E726554dB657fA54763abd0C3a0aa9
   Private key: 0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e

7  Retailer
   Address:     0x14dC79964da2C08b23698B3D3cc7Ca32193d9955
   Private key: 0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356
```

On the real backend only accounts 1 (farmer) and 2 (mill) are registered by `seed.sh`. Account 0 is admin through `VITE_ADMIN_ADDRESS`.

### Demo batches (mock mode)

| Batch | What it shows |
| --- | --- |
| `B1` | At the farm, waiting for pickup |
| `DEMO-1` | Full journey from farm to retailer, all records verified |
| `DEMO-2` | Pressed at the mill, waiting for pickup to storage |
| `DEMO-3` | At the mill, but the mill intake record was changed: integrity shows a mismatch |

### Checklist

**Public pages (no sign in)**

1. Open `/`. You see the title, the batch code box, and the system status. Submitting an empty box shows an error.
2. Trace `DEMO-1`: "Olive oil", "Now at Bethlehem Market", a green "Verified on the blockchain" banner, all six stages filled, each record marked "Matches". "Show the blockchain proof" opens a table of blocks and transactions, and "Transport details" opens each transport leg.
3. Trace `DEMO-2`: two stages filled, the other four say "Not yet" with a dashed line.
4. Trace `DEMO-3`: a red "Records do not match" banner, and the mill "On arrival" record is marked "Changed".
5. Open `/trace/XYZ`: "Batch not found" with a box to search again.
6. In DevTools device mode at 375 px wide, the trace page has no sideways scroll.

**Sign in and roles**

1. Sign in with each account. Each lands on its own area with its own sidebar links: farmer on `/farmer`, mill on `/mill/inbox`, admin on `/admin`.
2. As the farmer, type `/mill/inbox` in the address bar. You are sent back to `/farmer`.
3. Reload. You stay signed in.
4. Switch account in MetaMask. You are signed out with a message.
5. In MetaMask, disconnect `localhost:5173`. You stay signed in and a yellow bar says MetaMask is not connected, with a "Connect wallet" button. (Locking MetaMask shows nothing; it asks for the password when you sign.)
6. Switch MetaMask to another network. A yellow bar offers "Switch network".

**Batch pages and the transaction flow (sign in as the farmer)**

1. "Find a batch", then `B1`: status card, integrity, and timeline. `NOPE` shows "Batch not found on chain".
2. "Test: create batch" (temporary page): submitting empty marks the three required fields.
3. Fill harvest date, location and variety, keep ID `B2`, submit. The four steps (Preparing, Waiting for wallet, Mining, Saving details) turn green. "Open batch B2" shows your values.
4. Submit `B2` again. It fails at Preparing because the batch exists.
5. Retry test: "Start over", ID `B3`, Farm notes exactly `mock: fail save once`, submit. Saving fails and "Retry saving details" appears. Reload: the button is still there. Click it: it saves without asking to sign.

### Real backend

Start the stack with `docker compose up -d` from the repo root. Today these work: `/health`, sign in, and reading a batch from the chain. History, verification and creating a batch fail until the backend fixes these:

1. `DATABASE_URL` in `docker-compose.yml` has its credentials replaced with `******`. It should be `postgres://olive_app:olive_pass@postgres:5432/olive_traceability`.
2. Migrations do not run on startup, so the database has no tables.
3. `seed.sh` registers the farmer and mill on chain only, so the mill dropdown is empty. After 1 and 2, add them by hand:

```sh
docker compose exec postgres psql -U olive_app -d olive_traceability -c "INSERT INTO participants (wallet_address) VALUES ('0x70997970c51812dc3a010c7d01b50e0d17dc79c8'),('0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc') ON CONFLICT DO NOTHING; INSERT INTO participant_profiles (wallet_address, name) VALUES ('0x70997970c51812dc3a010c7d01b50e0d17dc79c8','Al Zaytoun Farm'),('0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc','Nablus Olive Mill') ON CONFLICT DO NOTHING;"
```

Facility names on every page come from mock profiles even with mocks off, because the API has no public profile route yet.

## Scripts

- `npm run dev`: development server
- `npm run build`: production build into `dist`
- `npm run lint`: ESLint

## Layout

- `src/api`: every API call, with the mock switch
- `src/mocks`: fixtures shaped like the `API.md` responses
- `src/wallet`: MetaMask connection and network checks
- `src/auth`: login session, role guard, role list
- `src/components`: shared UI pieces
- `src/features`: pages, grouped by area
- `src/routes`: the route table
- `src/styles`: design tokens and base styles
