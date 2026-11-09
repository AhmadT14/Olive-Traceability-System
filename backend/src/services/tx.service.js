import { eventArgsToObject } from "../chain/eventArgs.js";
import { decodeCustodyTx } from "../chain/reader.js";
import { internalError, notFound } from "../errors.js";
import { parseTxHash } from "../validation/parse.js";

export async function decodeTransaction(rawHash) {
  const hash = parseTxHash(rawHash);

  let result;
  try {
    result = await decodeCustodyTx(hash);
  } catch (err) {
    throw internalError("chain read failed", err);
  }

  if (!result) throw notFound("transaction not found or not mined yet");

  const events = result.events.map((event) => ({
    name: event.name,
    args: eventArgsToObject(event),
  }));

  return {
    hash,
    success: result.success,
    blockNumber: result.blockNumber,
    events,
  };
}
