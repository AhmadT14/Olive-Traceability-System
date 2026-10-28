import { decodeTx } from "../chain/reader.js";
import { internalError, notFound } from "../errors.js";
import { parseTxHash } from "../validation/parse.js";

export async function decodeTransaction(rawHash) {
  const hash = parseTxHash(rawHash);

  let result;
  try {
    result = await decodeTx(hash);
  } catch (err) {
    throw internalError("chain read failed", err);
  }

  if (!result) throw notFound("transaction not found or not mined yet");

  const events = result.events.map((event) => ({
    name: event.name,
    args: Object.fromEntries(
      event.args
        .toArray()
        .map((value, index) => [
          event.args.fragment.inputs[index].name,
          String(value),
        ]),
    ),
  }));

  return {
    hash,
    success: result.success,
    blockNumber: result.blockNumber,
    events,
  };
}
