set -eu

RPC=${RPC_URL:-http://127.0.0.1:8545}
PRIVATE_KEY=${PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}
export ADMIN_ADDRESS=${ADMIN_ADDRESS:-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266}
DEPLOYMENT_ENV=${DEPLOYMENT_ENV:-}

cd "$(dirname "$0")/../contracts"

echo "Waiting for anvil..."
until cast chain-id --rpc-url "$RPC" > /dev/null 2>&1; do
  sleep 1
done

if [ -n "$DEPLOYMENT_ENV" ] && [ -f "$DEPLOYMENT_ENV" ]; then
  . "$DEPLOYMENT_ENV"
  registry_code="$(cast code "$REGISTRY_ADDRESS" --rpc-url "$RPC")"
  custody_code="$(cast code "$BATCH_CUSTODY_ADDRESS" --rpc-url "$RPC")"
  if [ "$registry_code" != "0x" ] && [ "$custody_code" != "0x" ]; then
    registry_built="$(forge inspect src/ParticipantRegistry.sol:ParticipantRegistry deployedBytecode)"
    custody_built="$(forge inspect src/BatchCustody.sol:BatchCustody deployedBytecode)"
    if [ "$registry_code" = "$registry_built" ] && [ "$custody_code" = "$custody_built" ]; then
      echo "Contracts already deployed at the saved addresses; skipping deploy."
      exit 0
    fi
    echo "The contracts changed since they were deployed. Reset the chain and database: docker compose down -v" >&2
    exit 1
  fi
fi

echo "Deploying contracts..."
if ! output="$(forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC" --broadcast --private-key "$PRIVATE_KEY" 2>&1)"; then
  printf '%s\n' "$output" >&2
  exit 1
fi
printf '%s\n' "$output"

if [ -z "$DEPLOYMENT_ENV" ]; then
  echo "Done. Compare the printed addresses with backend/.env"
  exit 0
fi

registry="$(printf '%s\n' "$output" | sed -n 's/.*REGISTRY_ADDRESS= *\(0x[0-9a-fA-F]\{40\}\).*/\1/p' | tail -n 1)"
custody="$(printf '%s\n' "$output" | sed -n 's/.*BATCH_CUSTODY_ADDRESS= *\(0x[0-9a-fA-F]\{40\}\).*/\1/p' | tail -n 1)"
block="$(cast block-number --rpc-url "$RPC")"
test -n "$registry" && test -n "$custody"
{
  printf 'REGISTRY_ADDRESS=%s\n' "$registry"
  printf 'BATCH_CUSTODY_ADDRESS=%s\n' "$custody"
  printf 'DEPLOY_BLOCK=%s\n' "$block"
} > "$DEPLOYMENT_ENV"
