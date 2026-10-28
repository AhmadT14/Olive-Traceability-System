import { decodeTx } from "../chain/reader.js";
import { badRequest, internalError, notFound } from "../errors.js";

export async function decodeTransaction(hash) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw badRequest("invalid tx hash");

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
