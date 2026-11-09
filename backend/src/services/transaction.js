import { provider } from "../chain/contracts.js";
import { simulateTransaction } from "../chain/simulate.js";
import { config } from "../config.js";

export const prepareTransaction = (user, to, data) =>
  simulateTransaction(provider, config.CHAIN_ID, user.address, {
    to,
    data,
    value: "0x0",
  });
