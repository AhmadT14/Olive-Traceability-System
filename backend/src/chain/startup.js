const TIMEOUT_MS = 10_000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function checkChain(
  provider,
  { chainId, contracts },
  timeoutMs = TIMEOUT_MS,
) {
  let actualChainId;
  try {
    actualChainId = Number(
      await withTimeout(provider.send("eth_chainId", []), timeoutMs),
    );
  } catch (err) {
    return [
      `cannot reach the chain at RPC_URL (${err.shortMessage ?? err.message})`,
    ];
  }

  if (actualChainId !== chainId) {
    return [`chain id is ${actualChainId}, but CHAIN_ID is ${chainId}`];
  }

  const problems = [];
  for (const [name, address] of Object.entries(contracts)) {
    let code;
    try {
      code = await withTimeout(provider.getCode(address), timeoutMs);
    } catch (err) {
      problems.push(`cannot read ${name} (${err.shortMessage ?? err.message})`);
      continue;
    }
    if (code === "0x") {
      problems.push(
        `no contract at ${name} (${address}); redeploy or check the address`,
      );
    }
  }
  return problems;
}
