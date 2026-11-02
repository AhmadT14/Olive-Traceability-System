import { toQuantity } from "ethers";
import { conflict } from "../errors.js";

export function revertReason(err) {
  return err.reason ?? err.revert?.name ?? "execution reverted";
}

export async function simulateTransaction(
  provider,
  chainId,
  from,
  transaction,
) {
  let gas;
  try {
    gas = await provider.estimateGas({ ...transaction, from });
  } catch (err) {
    if (err.code === "CALL_EXCEPTION") {
      throw conflict(`transaction would fail: ${revertReason(err)}`);
    }
    throw err;
  }
  return { ...transaction, from, chainId, gas: toQuantity(gas) };
}
