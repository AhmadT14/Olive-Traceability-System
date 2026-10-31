import { useCallback, useState } from "react";
import { readableError, USE_MOCKS } from "../api";
import { useWallet } from "./useWallet";
import { sendPreparedTransaction } from "./sendTransaction";

export const TX_STEPS = [
  { key: "preparing", label: "Preparing" },
  { key: "wallet", label: "Waiting for wallet" },
  { key: "mining", label: "Mining" },
  { key: "saving", label: "Saving details" },
];

const PENDING_PREFIX = "olive_pending_save:";
const IDLE = {
  step: "idle",
  failedStep: null,
  error: null,
  txHash: null,
  pending: null,
  result: null,
};

// The save kept for retry under `key`, or null. Lets other pages point to it.
export function readPendingSave(key) {
  return readPending(key);
}

function readPending(key) {
  try {
    const raw = localStorage.getItem(PENDING_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writePending(key, pending) {
  try {
    if (pending) {
      localStorage.setItem(PENDING_PREFIX + key, JSON.stringify(pending));
    } else {
      localStorage.removeItem(PENDING_PREFIX + key);
    }
  } catch {
    /* storage unavailable */
  }
}

function pendingState(pending) {
  return {
    ...IDLE,
    step: "error",
    failedStep: "saving",
    error: {
      message: "The transaction is on chain, but its details were not saved.",
      fieldErrors: {},
    },
    txHash: pending.txHash,
    pending,
  };
}

// Prepare, sign, wait, save. `prepare(payload)` and `save(payload, txHash)`
// are api/ functions. The same payload object goes to both, so the record
// hash matches. If saving fails after mining, the payload and hash are kept
// in localStorage under `key`, and retrySave() never asks to sign again.
export function useTxFlow({ key, prepare, save }) {
  const wallet = useWallet();
  const [state, setState] = useState(() => {
    const pending = readPending(key);
    return pending ? pendingState(pending) : IDLE;
  });

  const runSave = useCallback(
    async (payload, txHash) => {
      setState((s) => ({ ...s, step: "saving", error: null, txHash }));
      try {
        const result = await save(payload, txHash);
        writePending(key, null);
        setState({ ...IDLE, step: "done", txHash, result });
        return result;
      } catch (err) {
        const pending = { payload, txHash };
        writePending(key, pending);
        setState({
          ...IDLE,
          step: "error",
          failedStep: "saving",
          error: readableError(err),
          txHash,
          pending,
        });
        return null;
      }
    },
    [key, save],
  );

  const run = useCallback(
    async (payload) => {
      if (readPending(key)) return null;
      const fail = (failedStep, err, txHash = null) => {
        setState({
          ...IDLE,
          step: "error",
          failedStep,
          error: readableError(err),
          txHash,
        });
        return null;
      };

      setState({ ...IDLE, step: "preparing" });
      let prepared;
      try {
        if (!USE_MOCKS) {
          if (!wallet.hasProvider) {
            throw new Error("MetaMask was not found in this browser.");
          }
          if (wallet.wrongChain && !(await wallet.switchChain())) {
            throw new Error("Switch MetaMask to the local network first.");
          }
        }
        prepared = await prepare(payload);
      } catch (err) {
        return fail("preparing", err);
      }

      let sentHash = null;
      let txHash;
      try {
        setState((s) => ({ ...s, step: "wallet" }));
        txHash = await sendPreparedTransaction(
          wallet.getSigner,
          prepared.transaction,
          (hash) => {
            sentHash = hash;
            setState((s) => ({ ...s, step: "mining", txHash: hash }));
          },
        );
      } catch (err) {
        return fail(sentHash ? "mining" : "wallet", err, sentHash);
      }

      return runSave(payload, txHash);
    },
    [key, prepare, wallet, runSave],
  );

  const retrySave = useCallback(() => {
    const pending = readPending(key);
    if (pending) runSave(pending.payload, pending.txHash);
  }, [key, runSave]);

  // Clears a finished or failed run. A pending save is never dropped.
  const reset = useCallback(() => {
    const pending = readPending(key);
    setState(pending ? pendingState(pending) : IDLE);
  }, [key]);

  const busy = ["preparing", "wallet", "mining", "saving"].includes(state.step);
  return { ...state, busy, run, retrySave, reset };
}
