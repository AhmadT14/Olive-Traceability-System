set -e

ADMIN_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
DEPLOYER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
RPC=http://127.0.0.1:8545

echo "Waiting for anvil..."
until curl -s -X POST "$RPC" -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' > /dev/null; do
  sleep 1
done

echo "Deploying contracts..."
cd contracts
ADMIN_ADDRESS=$ADMIN_ADDRESS forge script script/Deploy.s.sol \
  --rpc-url "$RPC" --broadcast --private-key "$DEPLOYER_KEY"

echo "Done. Compare the printed addresses with backend/.env"
