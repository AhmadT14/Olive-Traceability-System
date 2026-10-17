set -e

set -a
source .env
set +a

RPC=$RPC_URL
ADMIN_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
FARMER_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
FARMER_ADDR=0x70997970C51812dc3A010C7d01b50e0d17dc79C8

echo "Registering farmer..."
cast send "$REGISTRY_ADDRESS" "registerParticipant(address,bytes32)" \
  "$FARMER_ADDR" "$(cast keccak "FARMER_ROLE")" \
  --private-key "$ADMIN_KEY" --rpc-url "$RPC" > /dev/null

echo "Creating batch B1..."
cast send "$BATCH_CUSTODY_ADDRESS" "createBatch(string,bytes32)" \
  "B1" "$(cast keccak "test-harvest")" \
  --private-key "$FARMER_KEY" --rpc-url "$RPC" > /dev/null

echo "Seed done."
