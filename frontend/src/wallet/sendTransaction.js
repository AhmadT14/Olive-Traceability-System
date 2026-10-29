import { USE_MOCKS } from "../api";
import { mineMockTx } from "../mocks/batches";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Sends a prepared transaction ({ to, data, value }) and waits until it is
// mined. onSent(hash) runs once the wallet has sent it. Returns the hash.
// With mocks on, MetaMask is skipped and the mock chain mines it.
export async function sendPreparedTransaction(getSigner, transaction, onSent) {
  if (USE_MOCKS) {
    await wait(600);
    const hash = mineMockTx(transaction);
    onSent(hash);
    await wait(800);
    return hash;
  }

  const signer = await getSigner();
  const tx = await signer.sendTransaction({
    to: transaction.to,
    data: transaction.data,
    value: transaction.value,
  });
  onSent(tx.hash);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw Object.assign(new Error("The transaction failed on chain."), {
      code: "CALL_EXCEPTION",
    });
  }
  return tx.hash;
}
