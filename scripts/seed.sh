set -e

RPC=${RPC_URL:-http://anvil:8545}
ADMIN_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
FARMER_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

# Anvil dev accounts 1-7, one per role. Account 0 is the registry admin.
# backend/scripts/seed-db.js derives the same wallets from Anvil's mnemonic and
# stores their names in the database; keep the two lists in step.
FARMER_ADDR=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
MILL_ADDR=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
TRANSPORTER_ADDR=0x90F79bf6EB2c4f870365E785982E1f101E93b906
STORAGE_ADDR=0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
EXPORTER_ADDR=0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc
IMPORTER_ADDR=0x976EA74026E726554dB657fA54763abd0C3a0aa9
RETAILER_ADDR=0x14dC79964da2C08b23698B3D3cc7Ca32193d9955

register() {
  echo "Registering $1..."
  cast send "$REGISTRY_ADDRESS" "registerParticipant(address,bytes32)" \
    "$2" "$(cast keccak "$1_ROLE")" \
    --private-key "$ADMIN_KEY" --rpc-url "$RPC" > /dev/null
}

register FARMER "$FARMER_ADDR"
register MILL "$MILL_ADDR"
register TRANSPORTER "$TRANSPORTER_ADDR"
register STORAGE "$STORAGE_ADDR"
register EXPORTER "$EXPORTER_ADDR"
register IMPORTER "$IMPORTER_ADDR"
register RETAILER "$RETAILER_ADDR"

echo "Creating batch B1..."
cast send "$BATCH_CUSTODY_ADDRESS" "createBatch(string,address,bytes32)" \
  "B1" "$MILL_ADDR" "$(cast keccak "test-harvest")" \
  --private-key "$FARMER_KEY" --rpc-url "$RPC" > /dev/null

echo "Seed done."
