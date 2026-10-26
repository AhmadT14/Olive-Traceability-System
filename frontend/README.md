# Olive Traceability frontend

React app for the Palestinian olive oil traceability system: a public batch trace page and wallet-based dashboards for each supply chain role.

Stack: React 19, Vite, react-router-dom 7, ethers 6, plain JavaScript and plain CSS.

## Run it

1. Start the backend stack from the repo root (Postgres, Anvil, API on port 3000).
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
